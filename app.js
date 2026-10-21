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
const helmet = require("helmet");
const { csrfGuard, csrfTokenFor } = require("./middleware.js");
const {
  CATEGORIES,
  PROPERTY_TYPES,
  CURRENCIES,
  IMAGE_ERROR,
} = require("./utils/constants.js");

const listingRoutes = require("./routes/listingRoute.js");
const reviewRoutes = require("./routes/reviewRoute.js");
const bookingRoutes = require("./routes/bookingRoute.js");
const wishlistRoutes = require("./routes/wishlistRoute.js");
const userRoutes = require("./routes/userRoute.js");

const dbUrl = process.env.ATLAS;

const isProd = process.env.NODE_ENV === "production";
// Fail at load, before any listener exists, rather than signing cookies with "undefined"
if (isProd && !process.env.SECRET) {
  throw new Error("SECRET must be set when NODE_ENV=production");
}
// Behind Render's proxy the secure cookie flag and client IPs need the forwarded headers.
if (isProd) app.set("trust proxy", 1);

const CDNS = ["https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"];
const MAPBOX = [
  "https://api.mapbox.com",
  "https://events.mapbox.com",
  "https://*.tiles.mapbox.com",
];
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", ...CDNS, "https://api.mapbox.com"],
        styleSrc: ["'self'", ...CDNS, "https://api.mapbox.com"],
        fontSrc: ["'self'", ...CDNS],
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
app.use(express.static(path.join(__dirname, "/public")));

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
  store.on("error", (err) => {
    console.log("ERROR in MONGO SESSION STORE", err);
  });
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

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  // Reading flash on a fresh session would write to it and set a cookie for every visitor
  const flashed = req.session.flash;
  res.locals.successMsg = flashed ? req.flash("success") : [];
  res.locals.errorMsg = flashed ? req.flash("error") : [];
  res.locals.csrfToken = csrfTokenFor(req);
  res.locals.currUser = req.user;
  // Pages that show listing cards fill this in (see savedIdsFor in the controllers)
  res.locals.savedIds = new Set();
  res.locals.money = money;
  res.locals.mapboxToken = process.env.MAPBOX_TOKEN;
  res.locals.categories = CATEGORIES;
  res.locals.propertyTypes = PROPERTY_TYPES;
  res.locals.currencies = CURRENCIES;
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
    console.error(err);
    err.message = "Something went wrong!";
  }
  res.status(statusCode).render("error.ejs", { err });
});

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 8080;
  (async () => {
    try {
      await mongoose.connect(dbUrl);
    } catch (err) {
      console.error("Could not connect to DB:", err.message);
      process.exit(1);
    }
    console.log("connected to DB");
    resolveDbClient(mongoose.connection.getClient());
    if (process.env.NODE_ENV !== "production") {
      const Listing = require("./models/listing.js");
      const count = await Listing.countDocuments();
      if (count === 0) {
        console.log("Database has 0 listings. Auto-seeding initial data...");
        const { initDB } = require("./init");
        await initDB();
      }
    }
    app.listen(port, () => console.log(`Server is listening to port ${port}`));
  })();
}
