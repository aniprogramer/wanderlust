const express = require("express");
const listingRoute = express.Router({ mergeParams: true });
const wrapAsync = require("../utils/wrapAsync");
const {
  validateReview,
  isLoggedIn,
  isReviewAuthor,
  requireMode,
} = require("../middleware.js");
const reviewController = require("../controllers/reviewController.js");

listingRoute.post(
  "/",
  isLoggedIn,
  requireMode("guest"),
  validateReview,
  wrapAsync(reviewController.createReview),
);

// Review Delete Route
listingRoute.delete(
  "/:reviewId",
  isLoggedIn,
  isReviewAuthor,
  wrapAsync(reviewController.destroyReview),
);

module.exports = listingRoute;
