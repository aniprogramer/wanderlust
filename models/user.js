const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const { LANGUAGES } = require("../utils/constants");
const passportLocalMongoose = require("passport-local-mongoose").default;

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  wishlist: [{ type: Schema.Types.ObjectId, ref: "Listing" }],
  // Only a SHA-256 of the emailed token is stored, so a database leak cannot be replayed.
  resetTokenHash: { type: String, select: false },
  resetTokenExpires: { type: Date, select: false },
  // Sessions that signed in before this moment are ended (see sessionFreshness).
  passwordChangedAt: Date,
  // What they agreed to at signup (LD5). Older accounts have neither field.
  termsAcceptedAt: Date,
  termsVersion: String,
  // Unset until the emailed link is used (LD4). Only a SHA-256 of the token is stored.
  emailVerifiedAt: Date,
  verifyTokenHash: { type: String, select: false },
  verifyTokenExpires: { type: Date, select: false },
  // Which mode a login starts in. Chosen at sign-up, changed in settings. The active mode is
  // session.mode; the header switch changes only that.
  startingMode: { type: String, enum: ["guest", "host"], default: "guest" },
  // Set only by scripts/make-admin.js, never by a form.
  isAdmin: { type: Boolean, default: false },

  // Profile. Everything here except displayName is optional, and only the allowlist in
  // utils/profile.js ever reaches the public page.
  displayName: { type: String, trim: true, minlength: 2, maxlength: 50 },
  bio: { type: String, trim: true, maxlength: 300 },
  city: { type: String, trim: true, maxlength: 80 },
  country: { type: String, trim: true, maxlength: 80 },
  languages: [{ type: String, enum: LANGUAGES }],
  // Same shape as a listing photo
  avatar: { url: String, filename: String },
  // Moderation: a hidden profile answers 404 as if it did not exist. Set by hand, never by a form.
  profileHidden: { type: Boolean, default: false },
  // A new address waits here until its link is used; the old one stays active until then.
  pendingEmail: { type: String, lowercase: true, trim: true },
});

// The wishlist is loaded only on pages that need it, not on every request
userSchema.plugin(passportLocalMongoose, {
  selectFields:
    "username email passwordChangedAt emailVerifiedAt isAdmin displayName avatar pendingEmail termsAcceptedAt termsVersion startingMode",
});

module.exports = mongoose.model("User", userSchema);
