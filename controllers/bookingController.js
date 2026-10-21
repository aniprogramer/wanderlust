const Booking = require("../models/booking");
const Listing = require("../models/listing");
const ExpressError = require("../utils/ExpressError");
const { PAGE_SIZE } = require("../utils/constants");
const { parseDay, today, nightsBetween } = require("../utils/dates");

const DUPLICATE_KEY = 11000;

// One page of bookings (newest stay first); `populate` adds the relations a view needs.
const pageOf = async (filter, req, populate) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const [bookings, total] = await Promise.all([
    populate(
      Booking.find(filter)
        .sort({ checkIn: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE),
    ),
    Booking.countDocuments(filter),
  ]);
  return { bookings, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
};

/**
 * POST /listings/:id/bookings
 */
module.exports.createBooking = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) throw new ExpressError(404, "Listing not found");

  if (listing.owner?.equals(req.user._id)) {
    req.flash("error", "You cannot book your own listing.");
    return res.redirect(`/listings/${id}`);
  }

  const checkIn = parseDay(req.body.booking.checkIn);
  const checkOut = parseDay(req.body.booking.checkOut);
  const nights = nightsBetween(checkIn, checkOut);

  try {
    await Booking.create({
      listing: id,
      guest: req.user._id,
      checkIn,
      checkOut,
      nights,
      totalPrice: nights.length * listing.price,
    });
  } catch (err) {
    if (err.code !== DUPLICATE_KEY) throw err;
    req.flash(
      "error",
      "Those dates are no longer available. Please pick different dates.",
    );
    return res.redirect(`/listings/${id}`);
  }

  req.flash("success", "Booking confirmed!");
  res.redirect("/bookings");
};

/**
 * GET /bookings - the current user's reservations
 */
module.exports.myBookings = async (req, res) => {
  const { bookings, page, pages } = await pageOf(
    { guest: req.user._id },
    req,
    (q) => q.populate("listing", "title image location country currency"),
  );
  res.render("bookings/index.ejs", {
    bookings,
    page,
    pages,
    base: "/bookings",
    today: today(),
  });
};

/**
 * GET /bookings/hosting - reservations on the current user's listings
 */
module.exports.hostBookings = async (req, res) => {
  const listings = await Listing.find({ owner: req.user._id }).select("_id");
  const { bookings, page, pages } = await pageOf(
    { listing: { $in: listings.map((l) => l._id) } },
    req,
    (q) =>
      q
        .populate("listing", "title image location country currency")
        .populate("guest", "username"),
  );
  res.render("bookings/hosting.ejs", {
    bookings,
    page,
    pages,
    base: "/bookings/hosting",
    today: today(),
  });
};

/**
 * DELETE /bookings/:bookingId - guest or host cancels an upcoming booking
 */
module.exports.cancelBooking = async (req, res) => {
  const { booking } = req;
  if (booking.status === "cancelled") {
    req.flash("error", "Booking is already cancelled.");
  } else if (booking.checkIn <= today()) {
    req.flash("error", "Bookings that have started cannot be cancelled.");
  } else {
    booking.status = "cancelled";
    await booking.save();
    const byGuest = booking.guest.equals(req.user._id);
    req.flash(
      "success",
      byGuest ? "Booking cancelled." : "Reservation cancelled.",
    );
  }
  res.redirect(
    booking.guest.equals(req.user._id) ? "/bookings" : "/bookings/hosting",
  );
};
