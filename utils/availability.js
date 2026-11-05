// The one place that decides whether nights can be booked. The calendar, the search filter
// and the server all use these rules, or the same rules expressed as a query (Listing.search).
const { nightsBetween, toDay } = require("./dates");
const { TAX_NOTICE } = require("./constants");

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

module.exports = { blockedNights, overlapsBlocked, quote, TAX_NOTICE };
