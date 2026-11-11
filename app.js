if (!["production", "test"].includes(process.env.NODE_ENV)) {
  require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const multer = require("multer");
const { money } = require("./utils/format.js");
const { cardBadge } = require("./utils/listingBadge.js");
const siteInfo = require("./utils/siteInfo.js");
const { primary: themeColor } = require("./utils/emailTheme.js");
const helmet = require("helmet");
const compression = require("compression");
const asset = require("./utils/assets.js");
const { requestContext, logRequest, logRoute } = require("./utils/requestLog.js");
const expireRequests = require("./utils/expireRequests.js");
const healthCheck = require("./utils/healthCheck.js");
const { siteUrl } = require("./utils/config.js");
const {
  csrfGuard,
  csrfTokenFor,
  sessionFreshness,
} = require("./middleware.js");
const {
  CATEGORIES,
  PROPERTY_TYPES,
  CURRENCIES,
  CURRENCY_INFO,
  IMAGE_ERROR,
  TAX_NOTICE,
  TOTAL_LABEL,
} = require("./utils/constants.js");

const listingRoutes = require("./routes/listingRoute.js");
const reviewRoutes = require("./routes/reviewRoute.js");
const bookingRoutes = require("./routes/bookingRoute.js");
const wishlistRoutes = require("./routes/wishlistRoute.js");
const userRoutes = require("./routes/userRoute.js");
const profileRoutes = require("./routes/profileRoute.js");
const { normalizeMode, navFor } = require("./utils/mode");
const pageRoutes = require("./routes/pageRoute.js");
const accountRoutes = require("./routes/accountRoute.js");
const adminRoutes = require("./routes/adminRoute.js");

const dbUrl = process.env.ATLAS;

const isProd = process.env.NODE_ENV === "production";
const logger = require("./utils/logger.js");
const reportError = require("./utils/reportError.js");
const { photoUrl, photoSrcset } = require("./utils/cloudinaryUrl.js");
const { AMENITIES } = require("./utils/constants.js");
const { assertProductionEnv } = require("./utils/config.js");
// Fail at load, before any listener exists, rather than signing cookies with "undefined"
if (isProd && !process.env.SECRET) {
  throw new Error("SECRET must be set when NODE_ENV=production");
}
// Behind Render's proxy the secure cookie flag and client IPs need the forwarded headers.
if (isProd) app.set("trust proxy", 1);

const MAPBOX = [
  "https://api.mapbox.com",
  "https://events.mapbox.com",
  "https://*.tiles.mapbox.com",
];

// Before everything else: a request id for the logs, and a health check that needs no
// session, no rate limit and no log line.
app.use(requestContext);
app.get("/health", healthCheck);
app.use(logRequest);
app.use(compression());

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Every library is self-hosted under public/vendor
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        fontSrc: ["'self'"],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://images.unsplash.com",
          "https://plus.unsplash.com",
          "https://res.cloudinary.com",
          ...MAPBOX,
        ],
        connectSrc: ["'self'", ...MAPBOX],
        // Mapbox GL renders in blob: web workers
        workerSrc: ["'self'", "blob:"],
        childSrc: ["blob:"],
        objectSrc: ["'none'"],
        // Plain http is expected in local development
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },
  }),
);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.locals.asset = asset;
app.use(
  express.static(path.join(__dirname, "/public"), {
    setHeaders: (res, filePath) => {
      // Versioned paths never change; ?v= changes whenever the file does. Others may change.
      const permanent =
        /[\\/](vendor|fonts)[\\/]/.test(filePath) || res.req.query.v;
      res.setHeader(
        "Cache-Control",
        permanent ? "public, max-age=31536000, immutable" : "public, max-age=3600",
      );
    },
  }),
);
// Pages can hold personal details, so shared caches keep none of them
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "private, no-cache");
  next();
});

// Tests use the default in-memory store; real runs persist sessions in MongoDB.
// The store reuses mongoose's client once startup has connected (see the bottom of
// this file), so a bad ATLAS URL fails in exactly one place.
let store;
let resolveDbClient;
if (process.env.NODE_ENV !== "test") {
  store = MongoStore.create({
    clientPromise: new Promise((resolve) => (resolveDbClient = resolve)),
    crypto: {
      secret: process.env.SECRET,
    },
    touchAfter: 24 * 3600,
  });
  store.on("error", (err) => reportError(err, { event: "session.store" }));
}

app.use(
  session({
    store,
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
    },
  }),
);
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
app.use(sessionFreshness);

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  // Reading flash on a fresh session would write to it and set a cookie for every visitor
  const flashed = req.session.flash;
  res.locals.successMsg = flashed ? req.flash("success") : [];
  res.locals.errorMsg = flashed ? req.flash("error") : [];
  res.locals.infoMsg = flashed ? req.flash("info") : [];
  res.locals.warningMsg = flashed ? req.flash("warning") : [];
  res.locals.csrfToken = csrfTokenFor(req);
  res.locals.currUser = req.user;
  // Guest unless a signed-in user has chosen host; anything else in the session counts as guest
  res.locals.currentPath = req.originalUrl;
  res.locals.mode = req.user ? normalizeMode(req.session?.mode) : "guest";
  if (req.query.currency && CURRENCIES.includes(req.query.currency)) {
    if (req.session) req.session.preferredCurrency = req.query.currency;
  }
  const queried = CURRENCIES.includes(req.query.currency) ? req.query.currency : null;
  const stored = CURRENCIES.includes(req.session?.preferredCurrency) ? req.session.preferredCurrency : null;
  const activeCurrency = queried || stored || null;
  res.locals.currentCurrency = activeCurrency || "INR";
  res.locals.displayCurrency = activeCurrency;
  res.locals.currencyInfo = CURRENCY_INFO;
  // Pages that show listing cards fill this in (see savedIdsFor in the controllers)
  res.locals.navLinks = navFor(req.user, res.locals.mode);
  res.locals.savedIds = new Set();
  res.locals.money = money;
  res.locals.cardBadge = cardBadge;
  res.locals.site = siteInfo;
  res.locals.themeColor = themeColor;
  res.locals.mapboxToken = process.env.MAPBOX_TOKEN;
  res.locals.categories = CATEGORIES;
  res.locals.propertyTypes = PROPERTY_TYPES;
  res.locals.currencies = CURRENCIES;
  res.locals.amenities = AMENITIES;
  res.locals.taxNotice = TAX_NOTICE;
  res.locals.totalLabel = TOTAL_LABEL;
  res.locals.canonicalUrl = siteUrl(req.path);
  res.locals.siteUrl = siteUrl;
  res.locals.photoUrl = photoUrl;
  res.locals.photoSrcset = photoSrcset;
  next();
});

app.use(csrfGuard);

app.get("/", (req, res) => {
  res.redirect("/listings");
});

app.use("/listings", listingRoutes);
app.use("/listings/:id/reviews", reviewRoutes);
app.use("/bookings", bookingRoutes);
app.use("/wishlist", wishlistRoutes);
app.use("/account", accountRoutes);
app.use("/users", profileRoutes);
app.use("/admin", adminRoutes);
app.use("/", pageRoutes);
app.use("/", userRoutes);

app.use((req, res, next) => {
  next(new ExpressError(404, "Page Not Found!"));
});

app.use((err, req, res, next) => {
  // Malformed ObjectIds in URLs are "not found", not server errors
  if (err.name === "CastError") err = new ExpressError(404, "Page Not Found!");
  else if (err instanceof multer.MulterError)
    err = new ExpressError(400, IMAGE_ERROR);
  else if (err.name === "ValidationError")
    err = new ExpressError(400, err.message);
  const { statusCode = 500 } = err;
  if (statusCode >= 500) {
    reportError(err, {
      requestId: res.locals.requestId,
      route: logRoute(req),
      userId: req.user && String(req.user._id),
    });
    err.message = "Something went wrong!";
  }
  res.status(statusCode).render("error.ejs", {
    err,
    pageTitle: statusCode === 404 ? "Page not found" : "Something went wrong",
    noindex: true,
  });
});

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 8080;
  (async () => {
    process.on("unhandledRejection", (err) =>
      reportError(err, { event: "unhandledRejection" }),
    );
    process.on("uncaughtException", (err) => {
      reportError(err, { event: "uncaughtException" });
      process.exit(1);
    });
    try {
      assertProductionEnv();
    } catch (err) {
      logger.error(err.message);
      process.exit(1);
    }
    if (isProd && !siteInfo.LEGAL_REVIEWED) {
      logger.warn(
        "Legal pages are still drafts. Set LEGAL_REVIEWED=true after legal review.",
      );
    }
    try {
      await mongoose.connect(dbUrl);
    } catch (err) {
      logger.error("Could not connect to the database", { errorName: err.name });
      process.exit(1);
    }
    logger.info("Connected to the database");
    resolveDbClient(mongoose.connection.getClient());
    // No scheduler (see utils/expireRequests.js): catch up on anything that expired while down
    expireRequests().catch((err) => reportError(err, { event: "startup.sweep" }));
    app.listen(port, () => logger.info("Server is listening", { port }));
  })();
}
