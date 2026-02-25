const { default: mongoose } = require("mongoose");
const Listing = require("../models/listing");

// index route controller
module.exports.index = async (req, res) => {
  const allListings = await Listing.find({});
  res.render("./listings/index.ejs", { allListings });
};

// post: new listing
module.exports.newListing = async (req, res, next) => {
  const newListing = new Listing(req.body.listing);
  console.log(req.user);
  newListing.owner = req.user._id;
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

  res.render("./listings/edit.ejs", { listing });
};

// Update Route - Handles the logic for updating the listing in the database
module.exports.updateListing = async (req, res) => {
  const { id } = req.params;

  const listing = await Listing.findById(id);

  await Listing.findByIdAndUpdate(id, req.body.listing, {
    runValidators: true,
  });

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
