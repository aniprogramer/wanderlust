const User = require("../models/user");
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const Review = require("../models/review");
const SupportMessage = require("../models/supportMessage");
const cloudinary = require("../cloudConfig");
const notify = require("../utils/notify");
const { newVerifyToken } = require("../utils/tokens");
const { today } = require("../utils/dates");
const { PASSWORD_HINT } = require("../schema");

const context = (user) => ({ userId: String(user._id) });
const withSecrets = (id) => User.findById(id).select("+hash +salt");

module.exports.show = (req, res) =>
  res.render("account/index.ejs", {
    pageTitle: "Account",
    noindex: true,
    passwordHint: PASSWORD_HINT,
  });

module.exports.deleted = (req, res) =>
  res.render("account/deleted.ejs", {
    pageTitle: "Account deleted",
    noindex: true,
  });

/**
 * POST /account/profile - a new email address must be confirmed again
 */
module.exports.updateProfile = async (req, res, next) => {
  const { username, email } = req.body;
  const user = await User.findById(req.user._id);
  const emailChanged = email.toLowerCase() !== user.email;
  user.username = username;
  user.email = email;
  let token;
  if (emailChanged) {
    const issued = newVerifyToken();
    token = issued.token;
    user.set(issued.fields);
    user.emailVerifiedAt = undefined;
  }
  try {
    await user.save();
  } catch (err) {
    if (err.code !== 11000) throw err;
    req.flash(
      "error",
      err.keyPattern?.email
        ? "That email is already registered."
        : "That username is taken.",
    );
    return res.redirect("/account");
  }
  if (token) {
    await notify(
      "verifyEmail",
      user.email,
      { username: user.username, token },
      context(user),
    );
  }
  // Sessions are stored by username, so this one has to be renewed after a rename
  req.login(user, (err) => {
    if (err) return next(err);
    req.session.authAt = Date.now();
    req.flash(
      "success",
      token
        ? "Saved. Check your new email address for a link to confirm it."
        : "Your profile has been saved.",
    );
    res.redirect("/account");
  });
};

/**
 * POST /account/password - other devices are signed out by sessionFreshness
 */
module.exports.changePassword = async (req, res) => {
  const user = await withSecrets(req.user._id);
  const { error } = await user.authenticate(req.body.currentPassword);
  if (error) {
    req.flash("error", "Your current password is not right.");
    return res.redirect("/account");
  }
  await user.setPassword(req.body.password);
  user.passwordChangedAt = new Date();
  await user.save();
  req.session.authAt = Date.now();
  await notify(
    "passwordChanged",
    user.email,
    { username: user.username },
    context(user),
  );
  req.flash("success", "Password changed. Other devices have been signed out.");
  res.redirect("/account");
};

/**
 * GET /account/export - everything we hold for this user, as a download
 */
module.exports.exportData = async (req, res) => {
  const id = req.user._id;
  const [user, bookings, reviews, listings] = await Promise.all([
    User.findById(id).populate("wishlist", "title location country").lean(),
    Booking.find({ guest: id }).populate("listing", "title").lean(),
    Review.find({ author: id }).lean(),
    Listing.find({ owner: id }).select("-reviews").lean(),
  ]);
  const {
    wishlist,
    _id,
    username,
    email,
    emailVerifiedAt,
    termsAcceptedAt,
    termsVersion,
  } = user;
  res.attachment("wanderlust-data.json");
  res.type("application/json");
  res.send(
    JSON.stringify(
      {
        exportedAt: new Date(),
        account: {
          id: _id,
          username,
          email,
          emailVerifiedAt,
          termsAcceptedAt,
          termsVersion,
        },
        bookings,
        reviews,
        wishlist,
        listings,
      },
      null,
      2,
    ),
  );
};

/**
 * POST /account/delete
 */
module.exports.deleteAccount = async (req, res) => {
  const user = await withSecrets(req.user._id);
  const { error } = await user.authenticate(req.body.currentPassword);
  if (error) {
    req.flash("error", "Your current password is not right.");
    return res.redirect("/account");
  }

  const owned = await Listing.find({ owner: user._id });
  const ownedIds = owned.map((listing) => listing._id);
  const upcoming = await Booking.exists({
    $or: [{ guest: user._id }, { listing: { $in: ownedIds } }],
    status: "confirmed",
    checkOut: { $gt: today() },
  });
  if (upcoming) {
    req.flash(
      "error",
      "You have upcoming confirmed stays as a guest or a host. Cancel them first, then delete your account.",
    );
    return res.redirect("/account");
  }

  // Guests with a request waiting on these listings are told before the listing goes
  const waiting = await Booking.find({
    listing: { $in: ownedIds },
    ...Booking.activePending(),
  })
    .populate("listing", "title")
    .populate("guest", "email");
  await Promise.all(
    waiting
      .filter((booking) => booking.guest)
      .map((booking) =>
        notify(
          "bookingDeclined",
          booking.guest.email,
          {
            booking,
            listing: booking.listing,
            reason: "The host closed their account.",
          },
          { bookingId: String(booking._id) },
        ),
      ),
  );

  // Listings go through the delete hook, which removes their reviews, bookings and saved marks
  for (const listing of owned) {
    await Listing.findByIdAndDelete(listing._id);
    const names = new Set([
      listing.image?.filename,
      ...listing.images.map((photo) => photo.filename),
    ]);
    for (const name of names) {
      if (name && name !== "listingimage") {
        await cloudinary.uploader.destroy(name).catch(() => {});
      }
    }
  }

  await Promise.all([
    Review.updateMany({ author: user._id }, { $unset: { author: 1 } }),
    Booking.updateMany(
      { guest: user._id, status: "pending" },
      { status: "cancelled", cancelledBy: "guest", respondedAt: new Date() },
    ),
    SupportMessage.updateMany({ user: user._id }, { $unset: { user: 1 } }),
  ]);
  // After the update above, because that one matches on guest
  await Booking.updateMany(
    { guest: user._id },
    { $unset: { guest: 1, guestMessage: 1 }, $set: { guestDeleted: true } },
  );

  const { email, username } = user;
  await User.deleteOne({ _id: user._id });
  await notify("accountDeleted", email, { username }, context(user));

  req.logout(() => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.redirect("/account/deleted");
    });
  });
};
