const { default: mongoose } = require("mongoose");
const Listing = require("../models/listing");

// index route controller
module.exports.index = async (req, res) => {
  const allListings = await Listing.find({});
  res.render("./listings/index.ejs", { allListings });
};

// post: new listing
module.exports.newListing = async (req, res, next) => {
  const url = req.file.path;
  const filename = req.file.filename;
  const newListing = new Listing(req.body.listing);

  newListing.owner = req.user._id;
  newListing.image = { filename, url };
  await newListing.save();

  req.flash("success", "New Listing Added!");
  res.redirect("/listings");
};

// show listing details route
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
    req.flash("error", "Listing does not exists :(");
    res.redirect("/listings");
  }
  console.log(listing);
  res.render("./listings/show", { listing });
};

// Edit Route - Renders the form to edit a specific listing
module.exports.renderEditForm = async (req, res) => {
  let { id } = req.params;

  const listing = await Listing.findById(id);

  let originalImageUrl = listing.image.url;
  originalImageUrl = originalImageUrl.replace("/upload", "/upload/w_250");

  res.render("./listings/edit.ejs", { listing, originalImageUrl });
};

// Update Route - Handles the logic for updating the listing in the database
module.exports.updateListing = async (req, res) => {
  const { id } = req.params;

  // const listing = await Listing.findById(id);

  const listing = await Listing.findByIdAndUpdate(id, req.body.listing, {
    runValidators: true,
  });

  if (typeof req.file != "undefined") {
    const url = req.file.path;
    const filename = req.file.filename;
    listing.image = { filename, url };
    await listing.save();
  }

  req.flash("success", "Listing updated successfully!");

  res.redirect(`/listings/${id}`);
};

/**
 * DELETE /listings/:id
 * Removes a specific listing from the database
 */
module.exports.destroyListing = async (req, res) => {
  let { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).send("Invalid listing ID");
  }

  await Listing.findByIdAndDelete(id);

  req.flash("success", "Listing Deleted Successfully!");

  res.redirect("/listings");
};
