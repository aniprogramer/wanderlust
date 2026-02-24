const express = require("express");
const listingRoute = express.Router();
const Listing = require("../models/listing.js");
const wrapAsync = require("../utils/wrapAsync");
const { default: mongoose } = require("mongoose");
const { isLoggedIn, isOwner, validateListing } = require("../middleware.js");

// Index Route
listingRoute.get("/", async (req, res) => {
  const allListings = await Listing.find({});
  res.render("./listings/index.ejs", { allListings });
});

// Create Route
listingRoute.get("/new", isLoggedIn, (req, res) => {
  res.render("./listings/new.ejs");
});

listingRoute.post(
  "/",
  isLoggedIn,
  validateListing,
  wrapAsync(async (req, res, next) => {
    const newListing = new Listing(req.body.listing);
    console.log(req.user);
    newListing.owner = req.user._id;
    await newListing.save();

    req.flash("success", "New Listing Added!");

    res.redirect("/listings");
  }),
);

// Show Route
listingRoute.get(
  "/:id",
  validateListing,
  wrapAsync(async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id)
      .populate("reviews")
      .populate("owner");

    if (!listing) {
      req.flash("error", "Listing does not exists :(");
      res.redirect("/listings");
    }
    console.log(listing);
    res.render("./listings/show", { listing });
  }),
);

// Edit and Update Routes
listingRoute.get(
  "/:id/edit",
  isLoggedIn,
  isOwner,
  wrapAsync(async (req, res) => {
    let { id } = req.params;

    const listing = await Listing.findById(id);

    res.render("./listings/edit.ejs", { listing });
  }),
);

listingRoute.put(
  "/:id",
  isLoggedIn,
  isOwner,
  validateListing,
  wrapAsync(async (req, res) => {
    const { id } = req.params;

    const listing = await Listing.findById(id);

    await Listing.findByIdAndUpdate(id, req.body.listing, {
      runValidators: true,
    });

    req.flash("success", "Listing updated successfully!");

    res.redirect(`/listings/${id}`);
  }),
);

//Delete Route
listingRoute.delete(
  "/:id",
  isLoggedIn,
  isOwner,
  wrapAsync(async (req, res) => {
    let { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).send("Invalid listing ID");
    }

    await Listing.findByIdAndDelete(id);

    req.flash("success", "Listing Deleted Successfully!");

    res.redirect("/listings");
  }),
);

module.exports = listingRoute;
