if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}

// console.log(process.env.SECRET);

// Import required modules:
// - express: lightweight web framework for building server-side applications
// - mongoose: ODM (Object Data Modeling) library for MongoDB
// Initialize an Express application instance

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const wrapAsync = require("./utils/wrapAsync");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");

// Express Route
const listingRoutes = require("./routes/listingRoute.js");
const reviewRoutes = require("./routes/reviewRoute.js");
const userRoutes = require("./routes/userRoute.js");

// Connection string for MongoDB, pointing to the local server (127.0.0.1) on port 27017,
// and using the "wanderlust" database.

// const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";
const dbUrl = process.env.ATLAS;

// Asynchronous function to establish a connection to MongoDB using Mongoose.
// Ensures the app waits until the database connection is successfully opened before proceeding.
async function main() {
  await mongoose.connect(dbUrl);
}

// Execute the main() function to connect to MongoDB.
// If the connection succeeds, log "connected to DB".
// If it fails, catch the error and log it for debugging.
main()
  .then(() => {
    console.log("connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

const store = MongoStore.create({
  mongoUrl: dbUrl,
  crypto: {
    secret: process.env.SECRET,
  },
  touchAfter: 24 * 3600,
});

store.on("error", (err) => {
  console.log("ERROR in MONGO SESSION STORE", err);
});

const sessionOptions = {
  store,
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};

app.use(session(sessionOptions));
app.use(flash());

// Passport Initialization
app.use(passport.initialize());
app.use(passport.session());

// Passport Configuration
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.successMsg = req.flash("success");
  res.locals.errorMsg = req.flash("error");
  res.locals.currUser = req.user;
  console.log(res.locals.successMsg);
  console.log(res.locals.errorMsg);
  next();
});

// Fake User Registration
// app.get("/demouser", async (req, res) => {
//   let fakeUser = new User({
//     email: "newuser@gmail.com",
//     username: "fake-user",
//   });

//   let registeredUser = await User.register(fakeUser, "helloworld");
//   res.send(registeredUser);
// });

// default route
app.get("/", (req, res) => {
  res.redirect("/listings");
});

// Listing Routes using Router
app.use("/listings", listingRoutes);

// Reviews Routes
app.use("/listings/:id/reviews", reviewRoutes);

// User Routes
app.use("/", userRoutes);

app.use((req, res, next) => {
  next(new ExpressError(404, "Page Not Found!"));
});

// Error Handler
app.use((err, req, res, next) => {
  let { statusCode = 500, message = "Something went wrong!" } = err;
  res.status(statusCode).render("error.ejs", { err });
  // res.status(statusCode).send(message);
});

app.listen(8080, () => {
  console.log("Server is listening to port 8080");
});
