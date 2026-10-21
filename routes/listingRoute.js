const express = require("express");
const listingRoute = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const {
  isLoggedIn,
  isOwner,
  validateListing,
  validateSearch,
  validateBooking,
  csrfAfterUpload,
  geocodeLimiter,
} = require("../middleware.js");
const multer = require("multer");
const ExpressError = require("../utils/ExpressError");
const { ALLOWED_IMAGE_TYPES, IMAGE_ERROR } = require("../utils/constants");

// Multer now stores files temporarily in local /uploads folder
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    cb(
      ALLOWED_IMAGE_TYPES.includes(file.mimetype)
        ? null
        : new ExpressError(400, IMAGE_ERROR),
      ALLOWED_IMAGE_TYPES.includes(file.mimetype),
    ),
});

// Importing Listing Controller
const listingController = require("../controllers/listings.js");
const bookingController = require("../controllers/bookingController.js");

// ==========================================
// INDEX & CREATE ROUTES
// ==========================================

listingRoute
  .route("/")
  .get(validateSearch, wrapAsync(listingController.index))
  .post(
    isLoggedIn,
    upload.single("listing[image]"),
    csrfAfterUpload,
    validateListing,
    wrapAsync(listingController.newListing),
  );

// New Route
listingRoute.get("/new", isLoggedIn, (req, res) => {
  res.render("./listings/new.ejs");
});

// Map of all (filtered) listings, clustered
listingRoute.get("/map", validateSearch, wrapAsync(listingController.mapView));

// Geocoding proxy for the location picker (keeps the API call server-side)
listingRoute.get(
  "/geocode",
  isLoggedIn,
  geocodeLimiter,
  wrapAsync(listingController.geocode),
);

// ==========================================
// SHOW, UPDATE & DELETE ROUTES
// ==========================================

listingRoute
  .route("/:id")
  .get(wrapAsync(listingController.showListings))
  .put(
    isLoggedIn,
    isOwner,
    upload.single("listing[image]"),
    csrfAfterUpload,
    validateListing,
    wrapAsync(listingController.updateListing),
  )
  .delete(isLoggedIn, isOwner, wrapAsync(listingController.destroyListing));

// Booking
listingRoute.post(
  "/:id/bookings",
  isLoggedIn,
  validateBooking,
  wrapAsync(bookingController.createBooking),
);

// ==========================================
// EDIT ROUTE
// ==========================================

listingRoute.get(
  "/:id/edit",
  isLoggedIn,
  isOwner,
  wrapAsync(listingController.renderEditForm),
);

module.exports = listingRoute;
