const Listing = require("./models/listing");
const Review = require("./models/review.js");
const ExpressError = require("./utils/ExpressError.js");
const { listingSchema, reviewSchema } = require("./schema.js");

module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.redirectUrl = req.originalUrl;
    req.flash("error", "Please login to manage your listings.");
    return res.redirect("/login");
  }
  next();
};

module.exports.saveRedirectUrl = (req, res, next) => {
  if (req.session.redirectUrl) {
    req.locals.redirectUrl = req.session.redirectUrl;
  }
  next();
};

module.exports.isOwner = async (req, res, next) => {
  let { id } = req.params;
  let listing = await Listing.findById(id);
  if (!listing.owner.equals(res.locals.currUser._id)) {
    req.flash("error", "You are not authorized!!");
    return res.redirect(`/listings/${id}`);
  }
  next();
};

// Middle ware for validating listings
module.exports.validateListing = (req, res, next) => {
  const { error } = listingSchema.validate(req.body);
  if (error) {
    throw new ExpressError(
      400,
      error.details.map((el) => el.message).join(", "),
    );
  }
  next();
};

// Review Middleware
module.exports.validateReview = (req, res, next) => {
  // Check if req.body exists first
  if (!req.body || Object.keys(req.body).length == 0) {
    return next(new ExpressError(400, "Request body cannot be empty"));
  }

  const { error } = reviewSchema.validate(req.body);

  if (error) {
    // Format error message nicely
    const errorMessages = error.details
      .map((detail) => detail.message)
      .join(", ");
    return next(new ExpressError(400, `Validation error: ${errorMessages}`));
  }

  next();
};

// Middleware to make sure for deleting user reviews
module.exports.isReviewAuthor = async (req, res, next) => {
  let { id, reviewId } = req.params;
  let review = await Review.findById(reviewId);
  if (!review.author.equals(res.locals.currUser._id)) {
    req.flash("error", "You are not authorized");
    return res.redirect(`/listings/${id}`);
  }
  next();
};
