// The one place that decides whether nights can be booked. The calendar, the search filter
// and the server all use these rules, or the same rules expressed as a query (Listing.search).
const { nightsBetween, toDay } = require("./dates");
const {
  TAX_NOTICE,
  CANCELLATION_POLICIES,
  DEFAULT_CANCELLATION_POLICY,
} = require("./constants");

// Each blocked night as "YYYY-MM-DD", for the calendar
const blockedNights = (listing) =>
  (listing.blockedRanges || []).flatMap((range) =>
    nightsBetween(range.from, new Date(range.to.getTime() + 864e5)).map(toDay),
  );

// Nights stayed are [checkIn, checkOut); blocked ranges include both ends.
const overlapsBlocked = (listing, checkIn, checkOut) =>
  (listing.blockedRanges || []).some(
    (range) => range.from < checkOut && range.to >= checkIn,
  );

// Server-side price. The booking stores this copy, so later edits cannot change it (LD3: no tax).
const quote = (listing, nights) => {
  const nightlyPrice = listing.price;
  const cleaningFee = listing.cleaningFee || 0;
  const subtotal = nightlyPrice * nights;
  return {
    currency: listing.currency || "INR",
    nightlyPrice,
    cleaningFee,
    subtotal,
    taxAmount: 0,
    totalPrice: subtotal + cleaningFee,
  };
};

// The terms a request is made under. The deadline counts back from the earliest check-in time on
// the check-in day. Like every stay date it is treated as UTC, because a listing stores no time zone.
const cancellationTerms = (listing, checkIn) => {
  const cancellationPolicy = listing.cancellationPolicy || DEFAULT_CANCELLATION_POLICY;
  const [hours, minutes] = (listing.checkInFrom || "00:00").split(":").map(Number);
  const arrival = checkIn.getTime() + (hours * 60 + minutes) * 60 * 1000;
  const { hoursBefore } = CANCELLATION_POLICIES[cancellationPolicy];
  return {
    cancellationPolicy,
    freeCancelUntil: new Date(arrival - hoursBefore * 60 * 60 * 1000),
  };
};

// A request that was never accepted held nothing, so withdrawing one is never late.
const isLateCancellation = (booking, now = new Date()) =>
  booking.status === "confirmed" &&
  Boolean(booking.freeCancelUntil) &&
  now > booking.freeCancelUntil;

module.exports = {
  blockedNights,
  overlapsBlocked,
  quote,
  cancellationTerms,
  isLateCancellation,
  TAX_NOTICE,
};
