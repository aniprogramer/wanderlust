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
});

// The wishlist is loaded only on pages that need it, not on every request
userSchema.plugin(passportLocalMongoose, { selectFields: "username email" });

module.exports = mongoose.model("User", userSchema);
