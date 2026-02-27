const mongoose = require("mongoose");
const Listing = require("../models/listing");
const cloudinary = require("../cloudConfig");
const fs = require("fs");

// ========================
// INDEX
// ========================
module.exports.index = async (req, res) => {
  const allListings = await Listing.find({});
  res.render("./listings/index.ejs", { allListings });
};

// ========================
// CREATE NEW LISTING
// ========================
module.exports.newListing = async (req, res, next) => {
  if (!req.file) {
    req.flash("error", "Image is required!");
    return res.redirect("/listings/new");
  }

  // Upload to Cloudinary
  const result = await cloudinary.uploader.upload(req.file.path);

  const newListing = new Listing(req.body.listing);

  newListing.owner = req.user._id;

  newListing.image = {
    url: result.secure_url,
    filename: result.public_id,
  };

  await newListing.save();

  // Delete local temp file
  fs.unlinkSync(req.file.path);

  req.flash("success", "New Listing Added!");
  res.redirect("/listings");
};

// ========================
// SHOW LISTING
// ========================
module.exports.showListings = async (req, res) => {
  let { id } = req.params;

  const listing = await Listing.findById(id)
    .populate({
      path: "reviews",
      populate: {
        path: "author",
      },
    })
    .populate("owner");

  if (!listing) {
    req.flash("error", "Listing does not exist :(");
    return res.redirect("/listings");
  }

  res.render("./listings/show", { listing });
};

// ========================
// EDIT FORM
// ========================
module.exports.renderEditForm = async (req, res) => {
  let { id } = req.params;

  const listing = await Listing.findById(id);

  if (!listing) {
    req.flash("error", "Listing does not exist :(");
    return res.redirect("/listings");
  }

  let originalImageUrl = listing.image.url;
  originalImageUrl = originalImageUrl.replace("/upload", "/upload/w_250");

  res.render("./listings/edit.ejs", { listing, originalImageUrl });
};

// ========================
// UPDATE LISTING
// ========================
module.exports.updateListing = async (req, res) => {
  const { id } = req.params;

  const listing = await Listing.findByIdAndUpdate(id, req.body.listing, {
    runValidators: true,
    new: true,
  });

  if (!listing) {
    req.flash("error", "Listing does not exist :(");
    return res.redirect("/listings");
  }

  // If new image uploaded
  if (req.file) {
    // Delete old image from Cloudinary
    if (listing.image && listing.image.filename) {
      await cloudinary.uploader.destroy(listing.image.filename);
    }

    // Upload new image
    const result = await cloudinary.uploader.upload(req.file.path);

    listing.image = {
      url: result.secure_url,
      filename: result.public_id,
    };

    await listing.save();

    // Delete local temp file
    fs.unlinkSync(req.file.path);
  }

  req.flash("success", "Listing updated successfully!");
  res.redirect(`/listings/${id}`);
};

// ========================
// DELETE LISTING
// ========================
module.exports.destroyListing = async (req, res) => {
  let { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).send("Invalid listing ID");
  }

  const listing = await Listing.findById(id);

  if (listing && listing.image && listing.image.filename) {
    await cloudinary.uploader.destroy(listing.image.filename);
  }

  await Listing.findByIdAndDelete(id);

  req.flash("success", "Listing Deleted Successfully!");
  res.redirect("/listings");
};
