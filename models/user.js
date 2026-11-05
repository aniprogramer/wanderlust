const mongoose = require("mongoose");
const Schema = mongoose.Schema;
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
  // Set only by scripts/make-admin.js, never by a form.
  isAdmin: { type: Boolean, default: false },
});

// The wishlist is loaded only on pages that need it, not on every request
userSchema.plugin(passportLocalMongoose, {
  selectFields: "username email passwordChangedAt emailVerifiedAt isAdmin",
});

module.exports = mongoose.model("User", userSchema);
