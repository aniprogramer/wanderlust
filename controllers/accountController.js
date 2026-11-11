const User = require("../models/user");
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const Review = require("../models/review");
const SupportMessage = require("../models/supportMessage");
const cloudinary = require("../cloudConfig");
const notify = require("../utils/notify");
const { newVerifyToken } = require("../utils/tokens");
const { today } = require("../utils/dates");
const { profilePath } = require("../utils/profile");
const { uploadsOf } = require("../middleware");
const fs = require("fs");

const context = (user) => ({ userId: String(user._id) });
const withSecrets = (id) => User.findById(id).select("+hash +salt");

// There is one page per person. /account is kept so old links and emails still land on it.
module.exports.show = (req, res) => res.redirect(profilePath(req.user));

module.exports.deleted = (req, res) =>
  res.render("account/deleted.ejs", {
    pageTitle: "Account deleted",
    noindex: true,
  });

const AVATAR_OPTIONS = {
  transformation: [{ width: 512, height: 512, crop: "fill", gravity: "auto" }],
};
const dropTemp = (files) =>
  Promise.all(files.map((file) => fs.promises.unlink(file.path).catch(() => {})));
const dropPhoto = (filename) =>
  filename ? cloudinary.uploader.destroy(filename).catch(() => {}) : null;
const clean = (value) => (value === "" || value == null ? undefined : value);

/**
 * POST /account/profile (multipart) - public profile details and the photo.
 * The email is not here: a new address goes through POST /account/email.
 */
module.exports.updateProfile = async (req, res, next) => {
  const files = uploadsOf(req);
  const { username, displayName, bio, city, country, languages, removeAvatar } = req.body;
  const user = await User.findById(req.user._id);
  const renamed = username !== user.username;
  const oldPhoto = user.avatar?.filename;
  let uploaded;
  try {
    if (files.length) {
      const result = await cloudinary.uploader.upload(files[0].path, AVATAR_OPTIONS);
      uploaded = { url: result.secure_url, filename: result.public_id };
    }
  } finally {
    await dropTemp(files);
  }
  user.username = username;
  user.displayName = clean(displayName);
  user.bio = clean(bio);
  user.city = clean(city);
  user.country = clean(country);
  user.languages = languages || [];
  if (uploaded) user.avatar = uploaded;
  else if (removeAvatar === "on" || removeAvatar === "true" || removeAvatar === "1")
    user.avatar = undefined;
  try {
    await user.save();
  } catch (err) {
    await dropPhoto(uploaded?.filename);
    if (err.code !== 11000) throw err;
    req.flash("error", "That username is taken.");
    return res.redirect(profilePath(req.user));
  }
  if (oldPhoto && oldPhoto !== uploaded?.filename && (uploaded || !user.avatar?.url)) {
    await dropPhoto(oldPhoto);
  }

  const done = () => {
    req.flash("success", "Your profile has been saved.");
    res.redirect(profilePath(user));
  };
  if (!renamed) return done();
  // Sessions are stored by username, so this one has to be renewed after a rename.
  // Logging in again starts a fresh session, so the chosen mode is carried across.
  const { mode, modeSwitched } = req.session;
  req.login(user, (err) => {
    if (err) return next(err);
    req.session.authAt = Date.now();
    if (mode) req.session.mode = mode;
    if (modeSwitched) req.session.modeSwitched = true;
    done();
  });
};

/**
 * POST /account/starting-mode - the mode the next login starts in. The current session keeps the
 * mode it is in; the header switch is what changes that.
 */
module.exports.setStartingMode = async (req, res) => {
  const { startingMode } = req.body;
  await User.updateOne({ _id: req.user._id }, { $set: { startingMode } });
  req.flash(
    "success",
    `You will start in ${startingMode} mode the next time you log in.`,
  );
  res.redirect(profilePath(req.user));
};

/**
 * POST /account/email - the new address waits until its link is used, and the old one stays
 * active until then.
 */
module.exports.changeEmail = async (req, res) => {
  const user = await withSecrets(req.user._id);
  const { error } = await user.authenticate(req.body.currentPassword);
  if (error) {
    req.flash("error", "Your current password is not right.");
    return res.redirect(profilePath(req.user));
  }
  const email = req.body.email.toLowerCase();
  if (email === user.email) {
    req.flash("info", "That is already your email address.");
    return res.redirect(profilePath(req.user));
  }
  if (await User.exists({ $or: [{ email }, { pendingEmail: email }], _id: { $ne: user._id } })) {
    req.flash("error", "That email is already registered.");
    return res.redirect(profilePath(req.user));
  }
  const { token, fields } = newVerifyToken();
  user.set(fields);
  user.pendingEmail = email;
  await user.save();
  await notify("verifyEmail", email, { username: user.username, token }, context(user));
  req.flash(
    "success",
    `We sent a link to ${email}. Your current address stays active until you confirm the new one.`,
  );
  res.redirect(profilePath(req.user));
};

/**
 * POST /account/password - other devices are signed out by sessionFreshness
 */
module.exports.changePassword = async (req, res) => {
  const user = await withSecrets(req.user._id);
  const { error } = await user.authenticate(req.body.currentPassword);
  if (error) {
    req.flash("error", "Your current password is not right.");
    return res.redirect(profilePath(req.user));
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
  res.redirect(profilePath(req.user));
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
    displayName,
    bio,
    city,
    country,
    languages,
    avatar,
    pendingEmail,
    startingMode,
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
          displayName,
          bio,
          city,
          country,
          languages,
          avatar: avatar?.url,
          pendingEmail,
          startingMode,
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
    return res.redirect(profilePath(req.user));
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
    return res.redirect(profilePath(req.user));
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
  const avatarName = user.avatar?.filename;
  await User.deleteOne({ _id: user._id });
  await dropPhoto(avatarName);
  await notify("accountDeleted", email, { username }, context(user));

  req.logout(() => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.redirect("/account/deleted");
    });
  });
};
