const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema(
  {
    listing: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
    guest: { type: Schema.Types.ObjectId, ref: "User", required: true },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    // One entry per night stayed; the unique index below makes double booking impossible.
    nights: { type: [Date], required: true },
    totalPrice: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["confirmed", "cancelled"],
      default: "confirmed",
    },
  },
  { timestamps: true },
);

bookingSchema.pre("validate", function () {
  if (this.checkOut <= this.checkIn) {
    this.invalidate("checkOut", "Check-out must be after check-in");
  }
});

// Atomic double-booking guard: a night can belong to only one confirmed booking per listing.
bookingSchema.index(
  { listing: 1, nights: 1 },
  { unique: true, partialFilterExpression: { status: "confirmed" } },
);
bookingSchema.index({ guest: 1, checkIn: -1 });
bookingSchema.index({ listing: 1, checkIn: 1 });
bookingSchema.index({ status: 1, checkIn: 1 });

module.exports = mongoose.model("Booking", bookingSchema);
