const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const reviewSchema = new Schema({
  comment: String,
  rating: {
    type: Number,
    min: 1,
    max: 5,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // Removed when the author deletes their account; the page then shows "Deleted user"
  author: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  // False on reviews written before stays had to be confirmed first (see D9 in the PRD)
  verifiedStay: { type: Boolean, default: false },
  booking: { type: Schema.Types.ObjectId, ref: "Booking" },
});

module.exports = mongoose.model("Review", reviewSchema);
