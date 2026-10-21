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

  if (listing.owner?.equals(req.user._id)) {
    req.flash("error", "You cannot review your own listing.");
    return res.redirect(`/listings/${id}`);
  }
  if (
    await Review.exists({ _id: { $in: listing.reviews }, author: req.user._id })
  ) {
    req.flash("error", "You have already reviewed this listing.");
    return res.redirect(`/listings/${id}`);
  }

  // 3. Create new review - make sure req.body.review exists
  if (!req.body.review) {
    throw new ExpressError(400, "Review data is required");
  }

  const newReview = new Review(req.body.review);

  newReview.author = req.user._id;

  // 4. Save the review, then link it; undo the review if linking fails
  await newReview.save();
  try {
    await Listing.updateOne({ _id: id }, { $push: { reviews: newReview._id } });
  } catch (err) {
    await Review.findByIdAndDelete(newReview._id);
    throw err;
  }
  await Listing.refreshRating(id);

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

  const { modifiedCount } = await Listing.updateOne(
    { _id: id, reviews: reviewId },
    { $pull: { reviews: reviewId } },
  );
  if (modifiedCount) {
    await Review.findByIdAndDelete(reviewId);
    await Listing.refreshRating(id);
  }

  req.flash("success", "Review deleted");

  res.redirect(`/listings/${id}`);
};
