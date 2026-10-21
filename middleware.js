const fs = require("fs");
const { csrfSync } = require("csrf-sync");
const rateLimit = require("express-rate-limit");
const Listing = require("./models/listing");
const Review = require("./models/review.js");
const Booking = require("./models/booking.js");
const ExpressError = require("./utils/ExpressError.js");
const wrapAsync = require("./utils/wrapAsync");
const {
  listingSchema,
  reviewSchema,
  bookingSchema,
  searchSchema,
  signupSchema,
  loginSchema,
} = require("./schema.js");

module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    if (req.method === "GET") req.session.redirectUrl = req.originalUrl;
    req.flash("error", "Please login to continue.");
    return res.redirect("/login");
  }
  next();
};

module.exports.saveRedirectUrl = (req, res, next) => {
  if (req.session.redirectUrl) {
    res.locals.redirectUrl = req.session.redirectUrl;
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
    "owner",
  );
  if (!booking) throw new ExpressError(404, "Booking not found");
  const userId = res.locals.currUser._id;
  if (
    !booking.guest.equals(userId) &&
    !booking.listing?.owner?.equals(userId)
  ) {
    req.flash("error", "You are not authorized");
    return res.redirect("/bookings");
  }
  req.booking = booking;
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
      if (req.file) fs.promises.unlink(req.file.path).catch(() => {});
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

module.exports.validateListing = validate(listingSchema);
module.exports.validateReview = validate(reviewSchema);
module.exports.validateBooking = validate(bookingSchema);
module.exports.validateSignup = validate(signupSchema, "body", {
  redirectTo: "/signup",
});
module.exports.validateLogin = validate(loginSchema, "body", {
  redirectTo: "/login",
  message: "Incorrect username or password.",
});
module.exports.validateSearch = validate(searchSchema, "query");

// ---------- CSRF ----------
// Token travels in the form body (_csrf) or an x-csrf-token header, never the query string.
const { csrfSynchronisedProtection, generateToken } = csrfSync({
  getTokenFromRequest: (req) => req.body?._csrf || req.get("x-csrf-token"),
});

const checkCsrf = (req, res, next) =>
  csrfSynchronisedProtection(req, res, (err) => {
    if (err && req.file) fs.promises.unlink(req.file.path).catch(() => {});
    if (!err && req.body) delete req.body._csrf; // keep it out of Joi's way
    next(err);
  });

// Multipart bodies are only parsed by multer inside the listing routes, so for those two
// routes the check runs there (csrfAfterUpload). Any other multipart write is refused outright.
const UPLOAD_ROUTE = /^\/listings(\/[^/]+)?$/;
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

module.exports.authLimiter = limiter(10, 15 * 60 * 1000);
module.exports.geocodeLimiter = limiter(60, 60 * 1000, {
  keyGenerator: (req) => req.sessionID,
});
