const express = require("express");
const listingRoute = express.Router();
const Listing = require("../models/listing.js");
const wrapAsync = require("../utils/wrapAsync");
const { default: mongoose } = require("mongoose");
const { isLoggedIn, isOwner, validateListing } = require("../middleware.js");

// Importing Listing Controller
const listingController = require("../controllers/listings.js");

// Index Route
listingRoute.get("/", wrapAsync(listingController.index));

// Create Route
listingRoute.get("/new", isLoggedIn, (req, res) => {
  res.render("./listings/new.ejs");
});

listingRoute.post(
  "/",
  isLoggedIn,
  validateListing,
  wrapAsync(listingController.newListing),
);

// Show Route
listingRoute.get(
  "/:id",
  validateListing,
  wrapAsync(listingController.showListings),
);

// Edit and Update Routes
listingRoute.get(
  "/:id/edit",
  isLoggedIn,
  isOwner,
  wrapAsync(listingController.renderEditForm),
);

listingRoute.put(
  "/:id",
  isLoggedIn,
  isOwner,
  validateListing,
  wrapAsync(listingController.updateListing),
);

//Delete Route
listingRoute.delete(
  "/:id",
  isLoggedIn,
  isOwner,
  wrapAsync(listingController.destroyListing),
);

module.exports = listingRoute;
