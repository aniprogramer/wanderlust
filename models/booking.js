const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const {
  BOOKING_STATUSES,
  REASON_MAX,
  GUEST_MESSAGE_MAX,
  CANCELLATION_POLICY_KEYS,
} = require("../utils/constants");

const bookingSchema = new Schema(
  {
    listing: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
    // Removed when the guest deletes their account; the row stays for the host's records
    guest: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required() {
        return !this.guestDeleted;
      },
    },
    guestDeleted: Boolean,
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    // One entry per night stayed; the unique index below makes double booking impossible.
    nights: { type: [Date], required: true },
    guests: { type: Number, min: 1, default: 1 },
    // The price as quoted when requested. Later listing edits never change these.
    currency: String,
    nightlyPrice: { type: Number, min: 0 },
    cleaningFee: { type: Number, min: 0, default: 0 },
    subtotal: { type: Number, min: 0 },
    taxAmount: { type: Number, min: 0, default: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    // The default suits direct inserts (seed, fixtures). Guests only ever create "pending".
    status: { type: String, enum: BOOKING_STATUSES, default: "confirmed" },
    requestedAt: Date,
    respondedAt: Date,
    expiresAt: Date,
    cancelledBy: { type: String, enum: ["guest", "host"] },
    cancelReason: { type: String, maxlength: REASON_MAX },
    // The listing's terms when this was requested. Later listing edits never change them.
    cancellationPolicy: { type: String, enum: CANCELLATION_POLICY_KEYS },
    freeCancelUntil: Date,
    // A confirmed booking cancelled after freeCancelUntil. Both parties see it. No money moves.
    cancelledLate: Boolean,
    declineReason: { type: String, maxlength: REASON_MAX },
    guestMessage: { type: String, maxlength: GUEST_MESSAGE_MAX },
  },
  { timestamps: true },
);

bookingSchema.pre("validate", function () {
  if (this.checkOut <= this.checkIn) {
    this.invalidate("checkOut", "Check-out must be after check-in");
  }
});

// Short enough to quote to support; derived from the id, so it needs no storage.
bookingSchema.virtual("reference").get(function () {
  return `BK-${String(this._id).slice(-8).toUpperCase()}`;
});

// A pending request past its deadline counts as expired even before a sweep persists it.
bookingSchema.virtual("effectiveStatus").get(function () {
  return this.status === "pending" && this.expiresAt && this.expiresAt <= new Date()
    ? "expired"
    : this.status;
});

// Query fragments, so every screen agrees on what "active" means
bookingSchema.statics.activePending = (now = new Date()) => ({
  status: "pending",
  expiresAt: { $gt: now },
});
bookingSchema.statics.holdingGuest = (now = new Date()) => ({
  $or: [{ status: "confirmed" }, { status: "pending", expiresAt: { $gt: now } }],
});

// Atomic double-booking guard: a night can belong to only one confirmed booking per listing.
// Pending requests are outside this index, so they never hold dates.
bookingSchema.index(
  { listing: 1, nights: 1 },
  { unique: true, partialFilterExpression: { status: "confirmed" } },
);
bookingSchema.index({ guest: 1, checkIn: -1 });
bookingSchema.index({ guest: 1, status: 1, checkIn: 1, checkOut: 1 });
bookingSchema.index({ listing: 1, checkIn: 1 });
bookingSchema.index({ status: 1, checkIn: 1 });
bookingSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model("Booking", bookingSchema);
