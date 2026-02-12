const express = require("express");
const listingRoute = express.Router();
const Listing = require("../models/listing.js");
const wrapAsync = require("../utils/wrapAsync");
const ExpressError = require("../utils/ExpressError.js");
const { listingSchema } = require("../schema.js");
const { default: mongoose } = require("mongoose");

const validateListing = (req, res, next) => {
  const { error } = listingSchema.validate(req.body);
  if (error) {
    throw new ExpressError(
      400,
      error.details.map((el) => el.message).join(", "),
    );
  }
  next();
};

// Index Route
listingRoute.get("/", async (req, res) => {
  const allListings = await Listing.find({});
  res.render("./listings/index.ejs", { allListings });
});

// Create Route
listingRoute.get("/new", (req, res) => {
  res.render("./listings/new.ejs");
});

listingRoute.post(
  "/",
  validateListing,
  wrapAsync(async (req, res, next) => {
    const newListing = new Listing(req.body.listing);
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
    const listing = await Listing.findById(id).populate("reviews");

    if (!listing) {
      req.flash("error", "Listing does not exists :(");
      res.redirect("/listings");
    }

    res.render("./listings/show", { listing });
  }),
);

// Edit and Update Routes
listingRoute.get(
  "/:id/edit",
  wrapAsync(async (req, res) => {
    let { id } = req.params;

    const listing = await Listing.findById(id);

    res.render("./listings/edit.ejs", { listing });
  }),
);

listingRoute.put(
  "/:id",
  validateListing,
  wrapAsync(async (req, res) => {
    const { id } = req.params;

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
