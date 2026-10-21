const User = require("../models/user");
const Listing = require("../models/listing");
const ExpressError = require("../utils/ExpressError");

// Send the user back to the page they came from (same host only), anchored at the card.
const backTo = (req, id) => {
  try {
    const ref = new URL(req.get("Referer"));
    if (ref.host === req.get("host"))
      return `${ref.pathname}${ref.search}#l-${id}`;
  } catch {
    // no / malformed Referer
  }
  return "/listings";
};

/**
 * GET /wishlist
 */
module.exports.index = async (req, res) => {
  const { wishlist } = await User.findById(req.user._id).populate("wishlist");
  res.locals.savedIds = new Set(wishlist.map((l) => String(l._id)));
  res.render("wishlist/index.ejs", { allListings: wishlist });
};

/**
 * POST /wishlist/:id - $addToSet keeps saves duplicate-free
 */
module.exports.add = async (req, res) => {
  const { id } = req.params;
  if (!(await Listing.exists({ _id: id }))) {
    throw new ExpressError(404, "Listing not found");
  }
  await User.updateOne({ _id: req.user._id }, { $addToSet: { wishlist: id } });
  req.flash("success", "Saved to your wishlist.");
  res.redirect(backTo(req, id));
};

/**
 * DELETE /wishlist/:id
 */
module.exports.remove = async (req, res) => {
  const { id } = req.params;
  await User.updateOne({ _id: req.user._id }, { $pull: { wishlist: id } });
  req.flash("success", "Removed from your wishlist.");
  res.redirect(backTo(req, id));
};
