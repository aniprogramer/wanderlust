const User = require("../models/user");
const Listing = require("../models/listing");
const Review = require("../models/review");
const ExpressError = require("../utils/ExpressError");
const { publicProfile } = require("../utils/profile");
const { PASSWORD_HINT } = require("../schema");
const { LANGUAGES, DISPLAY_NAME_MAX, BIO_MAX, PLACE_MAX } = require("../utils/constants");
const { savedIdsFor } = require("./listings");
const { PAGE_SIZE } = require("../utils/constants");

const REVIEWS_SHOWN = 20;

/**
 * GET /users/:username - public, no login needed.
 * Only what publicProfile() picks leaves this function. The queries below select just the
 * fields that function reads, so nothing else is even loaded.
 */
module.exports.show = async (req, res) => {
  const user = await User.findOne({ username: String(req.params.username) }).select(
    "username displayName bio city country languages avatar emailVerifiedAt profileHidden",
  );
  // A hidden profile looks exactly like one that never existed
  if (!user || user.profileHidden) throw new ExpressError(404, "Page Not Found!");

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const hostFilter = { owner: user._id, status: "published" };
  const [listings, listingTotal, written] = await Promise.all([
    Listing.find(hostFilter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE),
    Listing.countDocuments(hostFilter),
    Review.find({ author: user._id }).sort({ createdAt: -1 }).limit(REVIEWS_SHOWN),
  ]);

  // A review does not point at its stay, so the stay is found through the listing's review list
  const stays = written.length
    ? await Listing.find({
        reviews: { $in: written.map((review) => review._id) },
        status: "published",
      }).select("title reviews")
    : [];
  const reviews = written
    .map((review) => ({
      review,
      listing: stays.find((stay) => stay.reviews.some((id) => id.equals(review._id))),
    }))
    .filter((row) => row.listing);

  res.locals.savedIds = await savedIdsFor(req.user, listings);
  const profile = publicProfile(user);
  const isSelf = Boolean(req.user && req.user._id.equals(user._id));
  res.render("users/profile.ejs", {
    profile,
    // Only the owner gets the settings; the allowlisted view above is what everyone else sees
    manage: isSelf
      ? {
          user: user.toObject(),
          languages: LANGUAGES,
          limits: { displayName: DISPLAY_NAME_MAX, bio: BIO_MAX, place: PLACE_MAX },
          passwordHint: PASSWORD_HINT,
          pendingEmail: req.user.pendingEmail,
          termsVersion: req.user.termsVersion,
          termsAcceptedAt: req.user.termsAcceptedAt,
        }
      : null,
    listings,
    reviews,
    page,
    pages: Math.max(1, Math.ceil(listingTotal / PAGE_SIZE)),
    isSelf,
    pageTitle: isSelf ? "Your profile" : `${profile.displayName} on Wanderlust`,
    noindex: isSelf,
    pageDescription: profile.bio ? profile.bio.slice(0, 160) : undefined,
  });
};
