// There is no scheduler: expiry is judged lazily by every query (Booking.activePending), and
// this sweep writes it down and tells the guest. It runs at startup and when a host opens
// their dashboard. The atomic update means two sweeps cannot both send the email.
const Booking = require("../models/booking");
const User = require("../models/user");
const notify = require("./notify");

module.exports = async (filter = {}, now = new Date()) => {
  const stale = await Booking.find({
    ...filter,
    status: "pending",
    expiresAt: { $lte: now },
  }).populate("listing", "title");
  let swept = 0;
  for (const booking of stale) {
    const updated = await Booking.findOneAndUpdate(
      { _id: booking._id, status: "pending" },
      { status: "expired", respondedAt: now },
      { new: true },
    );
    if (!updated) continue;
    swept += 1;
    const guest =
      booking.guest && (await User.findById(booking.guest).select("email"));
    if (guest && booking.listing) {
      await notify(
        "bookingExpired",
        guest.email,
        { booking: updated, listing: booking.listing },
        { bookingId: String(booking._id) },
      );
    }
  }
  return swept;
};
