const {
  NEW_LISTING_DAYS,
  FAVOURITE_MIN_RATING,
  FAVOURITE_MIN_REVIEWS,
} = require("./constants");

const DAY_MS = 864e5;

// The listing's creation time is carried by its ObjectId, so no extra field is needed.
const isRecentlyListed = (listing, now = Date.now()) => {
  const created = listing._id?.getTimestamp?.();
  return Boolean(created) && now - created.getTime() < NEW_LISTING_DAYS * DAY_MS;
};

// Only labels that follow from stored data. Returns null when nothing is true of the stay.
const cardBadge = (listing, now = Date.now()) => {
  if (
    listing.reviewCount >= FAVOURITE_MIN_REVIEWS &&
    listing.avgRating >= FAVOURITE_MIN_RATING
  ) {
    return "Guest favourite";
  }
  if (!listing.reviewCount && isRecentlyListed(listing, now)) return "New";
  return null;
};

module.exports = { cardBadge, isRecentlyListed };
