const express = require("express");
const listingRoute = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn, isOwner, validateListing } = require("../middleware.js");
const multer = require("multer");

// Multer now stores files temporarily in local /uploads folder
const upload = multer({ dest: "uploads/" });

// Importing Listing Controller
const listingController = require("../controllers/listings.js");

// ==========================================
// INDEX & CREATE ROUTES
// ==========================================

listingRoute
  .route("/")
  .get(wrapAsync(listingController.index))
  .post(
    isLoggedIn,
    upload.single("listing[image]"),
    validateListing,
    wrapAsync(listingController.newListing),
  );

// New Route
listingRoute.get("/new", isLoggedIn, (req, res) => {
  res.render("./listings/new.ejs");
});

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
    validateListing,
    wrapAsync(listingController.updateListing),
  )
  .delete(isLoggedIn, isOwner, wrapAsync(listingController.destroyListing));

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
