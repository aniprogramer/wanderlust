const express = require("express");
const listingRoute = express.Router();
const Listing = require("../models/listing.js");
const wrapAsync = require("../utils/wrapAsync");
const { default: mongoose } = require("mongoose");
const { isLoggedIn, isOwner, validateListing } = require("../middleware.js");
const multer = require("multer");
const { storage } = require("../cloudConfig.js");
const upload = multer({ storage });

// Importing Listing Controller
const listingController = require("../controllers/listings.js");

// ==========================================
// INDEX & CREATE ROUTES
// ==========================================

listingRoute
  .route("/")
  // Index Route - Fetches and displays all listings
  .get(wrapAsync(listingController.index))
  // Create Route - Processes the form to add a new listing
  .post(
    isLoggedIn,
    validateListing,
    upload.single("listing[image]"),
    wrapAsync(listingController.newListing),
  );

// New Route - Renders the form to create a new listing
// (Must be above /:id so "new" isn't treated as an ID)
listingRoute.get("/new", isLoggedIn, (req, res) => {
  res.render("./listings/new.ejs");
});

// ==========================================
// SHOW, UPDATE & DELETE ROUTES
// ==========================================

listingRoute
  .route("/:id")
  // Show Route - Displays details for a single listing
  .get(wrapAsync(listingController.showListings))
  // Update Route - Processes form submission to update a listing
  .put(
    isLoggedIn,
    isOwner,
    validateListing,
    upload.single("listing[image]"),
    wrapAsync(listingController.updateListing),
  )
  // Delete Route - Removes a listing from the database
  .delete(isLoggedIn, isOwner, wrapAsync(listingController.destroyListing));

// ==========================================
// EDIT ROUTE
// ==========================================

// Edit Route - Renders the form to edit an existing listing
listingRoute.get(
  "/:id/edit",
  isLoggedIn,
  isOwner,
  wrapAsync(listingController.renderEditForm),
);

module.exports = listingRoute;
