const fs = require("fs");
const { csrfSync } = require("csrf-sync");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const Listing = require("./models/listing");
const Review = require("./models/review.js");
const Booking = require("./models/booking.js");
const ExpressError = require("./utils/ExpressError.js");
const wrapAsync = require("./utils/wrapAsync");
const {
  listingSchema,
  listingDraftSchema,
  reviewSchema,
  bookingSchema,
  searchSchema,
  signupSchema,
  loginSchema,
  modeSchema,
  startingModeSchema,
  forgotSchema,
  resetSchema,
  reasonSchema,
  blockSchema,
  profileSchema,
  emailChangeSchema,
  changePasswordSchema,
  deleteAccountSchema,
  reportSchema,
} = require("./schema.js");
const User = require("./models/user");
const { sniffImageType } = require("./utils/imageType");
const { IMAGE_ERROR } = require("./utils/constants");
const { profilePath } = require("./utils/profile");
const { HOMES, normalizeMode, onlyIn, isSafePath } = require("./utils/mode");

module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    if (req.method === "GET") req.session.redirectUrl = req.originalUrl;
    req.flash("error", "Please login to continue.");
    return res.redirect("/login");
  }
  next();
};

// The login box takes a username or an email. Emails are mapped to the username that
// passport authenticates with; an unknown email falls through and fails like any bad login.
module.exports.resolveLoginIdentifier = wrapAsync(async (req, res, next) => {
  const id = req.body.username;
  if (id.includes("@")) {
    const user = await User.findOne({ email: id.toLowerCase() });
    if (user) req.body.username = user.username;
  }
  next();
});

// Ends sessions that predate the last password change (a reset must log out thieves too).
module.exports.sessionFreshness = (req, res, next) => {
  const changed = req.user?.passwordChangedAt;
  if (!changed || req.session.authAt >= changed.getTime()) return next();
  req.logOut((err) => next(err));
};

// Mode guards. Ownership checks (isOwner, isBookingParty) still run whatever the mode;
// these only decide which side of the account the action belongs to.
const MODE_MESSAGES = {
  host: "That is a host action. Switch to host mode to continue.",
  guest: "That is a guest action. Switch to guest mode to continue.",
};
const sendBack = (req, res, mode) => {
  req.flash("warning", MODE_MESSAGES[mode]);
  const here = req.method === "GET" ? null : req.get("Referer");
  let back = null;
  try {
    if (here) back = new URL(here).pathname;
  } catch {}
  const other = mode === "host" ? "guest" : "host";
  res.redirect(back && isSafePath(back) && onlyIn(back) !== mode ? back : HOMES[other]);
};
module.exports.requireMode = (mode) => (req, res, next) =>
  normalizeMode(req.session?.mode) === mode ? next() : sendBack(req, res, mode);
// For routes both parties use: the mode must match the role isBookingParty found
module.exports.requireModeForRole = (req, res, next) =>
  normalizeMode(req.session?.mode) === req.bookingRole
    ? next()
    : sendBack(req, res, req.bookingRole);

// Passport starts a new session at login, so a mode this person chose by hand in this session is
// noted first. It only carries over to the same account (see userController.login).
module.exports.keepSwitchedMode = (req, res, next) => {
  if (req.user && req.session?.modeSwitched) {
    res.locals.switchedMode = { userId: String(req.user._id), mode: req.session.mode };
  }
  next();
};

module.exports.saveRedirectUrl = (req, res, next) => {
  const url = req.session.redirectUrl;
  // Only same-site paths; "//host" and "/\\host" are protocol-relative tricks
  if (typeof url === "string" && /^\/(?![/\\])/.test(url)) {
    res.locals.redirectUrl = url;
  }
  next();
};

module.exports.isOwner = wrapAsync(async (req, res, next) => {
  let { id } = req.params;
  let listing = await Listing.findById(id);
  if (!listing) throw new ExpressError(404, "Listing not found");
  if (!listing.owner?.equals(res.locals.currUser._id)) {
    req.flash("error", "You are not authorized!!");
    return res.redirect(`/listings/${id}`);
  }
  next();
});

// Middleware to make sure for deleting user reviews
module.exports.isReviewAuthor = wrapAsync(async (req, res, next) => {
  let { id, reviewId } = req.params;
  let review = await Review.findById(reviewId);
  if (!review || !(await Listing.exists({ _id: id, reviews: reviewId }))) {
    throw new ExpressError(404, "Review not found");
  }
  if (!review.author?.equals(res.locals.currUser._id)) {
    req.flash("error", "You are not authorized");
    return res.redirect(`/listings/${id}`);
  }
  next();
});

// Loads req.booking; only the guest or the listing's host may continue.
module.exports.isBookingParty = wrapAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.bookingId).populate(
    "listing",
    "owner title location country image images currency addressLine city region geometry",
  );
  if (!booking) throw new ExpressError(404, "Booking not found");
  const userId = res.locals.currUser._id;
  const isGuest = Boolean(booking.guest?.equals(userId));
  const isHost = Boolean(booking.listing?.owner?.equals(userId));
  if (!isGuest && !isHost) {
    req.flash("error", "You are not authorized");
    return res.redirect("/bookings");
  }
  req.booking = booking;
  req.bookingRole = isHost ? "host" : "guest";
  next();
});

// Refused rather than hidden: the routes are not secret, only forbidden.
module.exports.isAdmin = (req, res, next) =>
  req.user?.isAdmin
    ? next()
    : next(new ExpressError(403, "You are not authorized"));

// LD4: production needs a confirmed address before anyone can list or send a request.
// Read at request time, not at load, so a test can switch it on for a single request.
module.exports.requireVerifiedEmail = (req, res, next) => {
  if (process.env.NODE_ENV !== "production" || req.user?.emailVerifiedAt) {
    return next();
  }
  return res.redirect("/verify-email");
};

// Every file multer stored for this request, whichever field it came in on
const uploadsOf = (req) => Object.values(req.files || {}).flat();
module.exports.uploadsOf = uploadsOf;
const removeUploads = (req) =>
  uploadsOf(req).forEach((file) =>
    fs.promises.unlink(file.path).catch(() => {}),
  );

// Multer only knows the type the browser declared; this reads the file's first bytes (3.10).
module.exports.checkImageContent = wrapAsync(async (req, res, next) => {
  for (const file of uploadsOf(req)) {
    const handle = await fs.promises.open(file.path, "r");
    const { buffer } = await handle.read(Buffer.alloc(12), 0, 12, 0);
    await handle.close();
    if (sniffImageType(buffer) !== file.mimetype) {
      removeUploads(req);
      throw new ExpressError(400, IMAGE_ERROR);
    }
  }
  next();
});

// Form pages that should flash and redirect (not render a 400) pass `redirectTo`.
const validate =
  (schema, source = "body", { redirectTo, message } = {}) =>
  (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      stripUnknown: source === "query",
    });
    if (error) {
      // Multer already wrote the upload to disk; don't leave it behind
      removeUploads(req);
      const text = message || error.details.map((el) => el.message).join(", ");
      if (redirectTo) {
        req.flash("error", text);
        return res.redirect(redirectTo);
      }
      return next(new ExpressError(400, text));
    }
    if (source === "query") req.filters = value;
    else req[source] = value;
    next();
  };

// The listing form shows every problem beside its field, so nothing is thrown here: the controller
// sees req.listingForm and renders the form again with what was typed.
const fieldErrors = (error) => {
  const errors = {};
  for (const { path, message } of error.details) {
    const key = path[0] === "listing" && path.length > 1 ? path[1] : path[0];
    errors[key] = errors[key] || message;
  }
  return errors;
};
module.exports.validateListing = (req, res, next) => {
  const schema = req.body?.intent === "draft" ? listingDraftSchema : listingSchema;
  const { error, value } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    removeUploads(req);
    req.listingForm = { errors: fieldErrors(error), values: req.body?.listing || {} };
  } else {
    req.body = value;
  }
  next();
};
module.exports.validateReview = validate(reviewSchema);
module.exports.validateBooking = validate(bookingSchema);
module.exports.validateSignup = validate(signupSchema, "body", {
  redirectTo: "/signup",
});
module.exports.validateLogin = validate(loginSchema, "body", {
  redirectTo: "/login",
  message: "Incorrect username or password.",
});
module.exports.validateForgot = validate(forgotSchema, "body", {
  redirectTo: "/forgot-password",
  message: "Enter a valid email address.",
});
module.exports.validateReset = (req, res, next) =>
  validate(resetSchema, "body", {
    redirectTo: `/reset-password/${encodeURIComponent(req.params.token)}`,
  })(req, res, next);
module.exports.validateMode = validate(modeSchema, "body", { message: "Choose guest or host." });
module.exports.validateSearch = validate(searchSchema, "query");
module.exports.validateReason = validate(reasonSchema);
module.exports.validateReport = (req, res, next) =>
  validate(reportSchema, "body", {
    redirectTo: `/listings/${req.params.id}/report`,
  })(req, res, next);
module.exports.validateStartingMode = (req, res, next) =>
  validate(startingModeSchema, "body", { redirectTo: profilePath(req.user) })(req, res, next);
module.exports.validateProfile = (req, res, next) =>
  validate(profileSchema, "body", { redirectTo: profilePath(req.user) })(req, res, next);
module.exports.validateEmailChange = (req, res, next) =>
  validate(emailChangeSchema, "body", { redirectTo: profilePath(req.user) })(req, res, next);
module.exports.validateChangePassword = (req, res, next) =>
  validate(changePasswordSchema, "body", { redirectTo: profilePath(req.user) })(req, res, next);
module.exports.validateDeleteAccount = (req, res, next) =>
  validate(deleteAccountSchema, "body", { redirectTo: profilePath(req.user) })(req, res, next);
module.exports.validateBlock = (req, res, next) =>
  validate(blockSchema, "body", {
    redirectTo: `/listings/${req.params.id}/edit#availability`,
  })(req, res, next);

// ---------- CSRF ----------
// Token travels in the form body (_csrf) or an x-csrf-token header, never the query string.
const { csrfSynchronisedProtection, generateToken } = csrfSync({
  getTokenFromRequest: (req) => req.body?._csrf || req.get("x-csrf-token"),
});

const checkCsrf = (req, res, next) =>
  csrfSynchronisedProtection(req, res, (err) => {
    if (err) removeUploads(req);
    if (!err && req.body) delete req.body._csrf; // keep it out of Joi's way
    next(err);
  });

// Multipart bodies are only parsed by multer inside the listing routes, so for those two
// routes the check runs there (csrfAfterUpload). Any other multipart write is refused outright.
const UPLOAD_ROUTE = /^\/(listings(\/[^/]+)?|account\/profile)$/;
const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

module.exports.csrfGuard = (req, res, next) => {
  if (req.is("multipart/form-data") && !SAFE_METHODS.includes(req.method)) {
    return UPLOAD_ROUTE.test(req.path) && ["POST", "PUT"].includes(req.method)
      ? next()
      : next(new ExpressError(403, "Invalid CSRF token"));
  }
  checkCsrf(req, res, next);
};
module.exports.csrfAfterUpload = checkCsrf;
// A function (not a string) so pages that render no form never start a session.
module.exports.csrfTokenFor = (req) => () => generateToken(req);

// ---------- Rate limiting ----------
const limiter = (limit, windowMs, extra = {}) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    // Test suites log in constantly; the rate-limit test opts back in.
    skip: () =>
      process.env.NODE_ENV === "test" && !process.env.ENABLE_RATE_LIMIT,
    handler: (req, res, next) =>
      next(new ExpressError(429, "Too many requests. Please try again later.")),
    ...extra,
  });

// In memory, per process (AD5): a restart clears them and two instances count separately.
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const ipKey = (req) => ipKeyGenerator(req.ip);
const lower = (value) => String(value ?? "").trim().toLowerCase();

// Keyed by address and identifier, so one person's failures do not lock out another account
// on the same address, until the wider per-address limit below.
module.exports.loginLimiter = [
  limiter(30, 15 * MINUTE),
  limiter(10, 15 * MINUTE, {
    keyGenerator: (req) => `${ipKey(req)}:${lower(req.body?.username)}`,
  }),
];
module.exports.signupLimiter = limiter(10, HOUR);
module.exports.forgotLimiter = [
  limiter(5, HOUR),
  limiter(5, HOUR, {
    keyGenerator: (req) => `forgot:${lower(req.body?.email)}`,
  }),
];
module.exports.resetLimiter = limiter(10, HOUR);
module.exports.supportLimiter = limiter(5, HOUR);
module.exports.reportLimiter = limiter(5, HOUR);
// Per signed-in user, so a shared address cannot exhaust someone else's allowance
module.exports.verifyResendLimiter = limiter(5, 60 * 60 * 1000, {
  keyGenerator: (req) => `verify:${req.user?._id}`,
});
module.exports.bookingLimiter = limiter(30, 60 * 60 * 1000, {
  keyGenerator: (req) => `booking:${req.user?._id}`,
});
module.exports.listingLimiter = limiter(30, 60 * 60 * 1000, {
  keyGenerator: (req) => `listing:${req.user?._id}`,
});
module.exports.geocodeLimiter = limiter(60, 60 * 1000, {
  keyGenerator: (req) => req.sessionID,
});
