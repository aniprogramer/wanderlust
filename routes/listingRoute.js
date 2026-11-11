const express = require("express");
const listingRoute = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const {
  isLoggedIn,
  isOwner,
  requireMode,
  validateListing,
  validateSearch,
  validateBooking,
  validateBlock,
  validateReport,
  reportLimiter,
  requireVerifiedEmail,
  bookingLimiter,
  listingLimiter,
  csrfAfterUpload,
  geocodeLimiter,
} = require("../middleware.js");
const multer = require("multer");
const ExpressError = require("../utils/ExpressError");
const {
  ALLOWED_IMAGE_TYPES,
  IMAGE_ERROR,
  MAX_IMAGES,
} = require("../utils/constants");
const { checkImageContent } = require("../middleware.js");

// Multer now stores files temporarily in local /uploads folder
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024, files: MAX_IMAGES },
  fileFilter: (req, file, cb) =>
    cb(
      ALLOWED_IMAGE_TYPES.includes(file.mimetype)
        ? null
        : new ExpressError(400, IMAGE_ERROR),
      ALLOWED_IMAGE_TYPES.includes(file.mimetype),
    ),
});

// `listing[image]` is the single-file field older clients post; the form uses `listing[images]`.
const photoUpload = upload.fields([
  { name: "listing[image]", maxCount: 1 },
  { name: "listing[images]", maxCount: MAX_IMAGES },
]);

// Importing Listing Controller
const listingController = require("../controllers/listings.js");
const bookingController = require("../controllers/bookingController.js");
const reportController = require("../controllers/reportController.js");

// ==========================================
// INDEX & CREATE ROUTES
// ==========================================

listingRoute
  .route("/")
  .get(validateSearch, wrapAsync(listingController.index))
  .post(
    isLoggedIn,
    requireMode("host"),
    requireVerifiedEmail,
    listingLimiter,
    photoUpload,
    csrfAfterUpload,
    checkImageContent,
    validateListing,
    wrapAsync(listingController.newListing),
  );

// New Route
listingRoute.get(
  "/new",
  isLoggedIn,
  requireMode("host"),
  requireVerifiedEmail,
  listingController.renderNewForm,
);

// The host's own listings (host mode)
listingRoute.get(
  "/mine",
  isLoggedIn,
  requireMode("host"),
  wrapAsync(listingController.mine),
);

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
    requireMode("host"),
    isOwner,
    photoUpload,
    csrfAfterUpload,
    checkImageContent,
    validateListing,
    wrapAsync(listingController.updateListing),
  )
  .delete(
    isLoggedIn,
    requireMode("host"),
    isOwner,
    wrapAsync(listingController.destroyListing),
  );

// Booking
listingRoute.post(
  "/:id/bookings",
  isLoggedIn,
  requireMode("guest"),
  requireVerifiedEmail,
  bookingLimiter,
  validateBooking,
  wrapAsync(bookingController.createBooking),
);

// ==========================================
// EDIT ROUTE
// ==========================================

listingRoute.get(
  "/:id/edit",
  isLoggedIn,
  requireMode("host"),
  isOwner,
  wrapAsync(listingController.renderEditForm),
);

// Report a listing to the team (5.1)
listingRoute
  .route("/:id/report")
  .get(isLoggedIn, wrapAsync(reportController.form))
  .post(
    isLoggedIn,
    reportLimiter,
    validateReport,
    wrapAsync(reportController.send),
  );

// Availability: nights the host is away
listingRoute.post(
  "/:id/blocks",
  isLoggedIn,
  requireMode("host"),
  isOwner,
  validateBlock,
  wrapAsync(listingController.addBlock),
);
listingRoute.delete(
  "/:id/blocks/:blockId",
  isLoggedIn,
  requireMode("host"),
  isOwner,
  wrapAsync(listingController.removeBlock),
);

module.exports = listingRoute;
