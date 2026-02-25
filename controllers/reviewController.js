const Listing = require("../models/listing.js");
const Review = require("../models/review");
const ExpressError = require("../utils/ExpressError.js");

/**
 * POST /listings/:id/reviews
 * Creates a new review and associates it with a specific listing
 */
module.exports.createReview = async (req, res) => {
  const { id } = req.params;
  // console.log(`id : ${id}`);

  // 1. Find the listing
  const listing = await Listing.findById(id);

  // 2. Check if listing exists
  if (!listing) {
    throw new ExpressError(404, "Listing not found");
  }

  // 3. Create new review - make sure req.body.review exists
  if (!req.body.review) {
    throw new ExpressError(400, "Review data is required");
  }

  const newReview = new Review(req.body.review);

  newReview.author = req.user._id;

  // 4. Associate review with listing
  listing.reviews.push(newReview);

  // 5. Save both (using transaction if you want better error handling)
  await newReview.save();
  await listing.save();

  console.log("New review saved for listing:", id);

  req.flash("success", "Review added!");

  // 6. Redirect back to the listing's show page
  res.redirect(`/listings/${id}`);
};

/**
 * DELETE /listings/:id/reviews/:reviewId
 * Removes a review from the listing's review array and deletes the review itself
 */
module.exports.destroyReview = async (req, res) => {
  let { id, reviewId } = req.params;

  await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
  await Review.findByIdAndDelete(reviewId);

  req.flash("success", "Review deleted");

  res.redirect(`/listings/${id}`);
};
