const Booking = require("../models/booking");
const Listing = require("../models/listing");
const User = require("../models/user");
const ExpressError = require("../utils/ExpressError");
const notify = require("../utils/notify");
const expireRequests = require("../utils/expireRequests");
const {
  overlapsBlocked,
  quote,
  cancellationTerms,
  isLateCancellation,
} = require("../utils/availability");
const {
  PAGE_SIZE,
  REQUEST_TTL_HOURS,
  MAX_ACTIVE_PENDING_PER_GUEST,
  MAX_REQUESTS_PER_GUEST_24H,
  DATES_TAKEN_REASON,
  CANCELLATION_POLICIES,
} = require("../utils/constants");
const { parseDay, today, nightsBetween } = require("../utils/dates");

const DUPLICATE_KEY = 11000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const LISTING_FIELDS = "title image images location country currency owner";

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

const context = (booking) => ({ bookingId: String(booking._id) });

const refuse = (req, res, id, message) => {
  req.flash("error", message);
  return res.redirect(`/listings/${id}`);
};

/**
 * POST /listings/:id/bookings - sends a request to the host. Nothing is held until they accept.
 */
module.exports.createBooking = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) throw new ExpressError(404, "Listing not found");
  if (listing.status === "draft") throw new ExpressError(404, "Listing not found");
  if (listing.status === "hidden" && !listing.owner?.equals(req.user._id)) {
    throw new ExpressError(404, "Listing not found");
  }

  if (listing.owner?.equals(req.user._id)) {
    return refuse(req, res, id, "You cannot book your own listing.");
  }

  const { guests = 1, message } = req.body.booking;
  const checkIn = parseDay(req.body.booking.checkIn);
  const checkOut = parseDay(req.body.booking.checkOut);
  const nights = nightsBetween(checkIn, checkOut);

  if (guests > listing.maxGuests) {
    return refuse(
      req,
      res,
      id,
      `This stay sleeps up to ${listing.maxGuests} guest${listing.maxGuests === 1 ? "" : "s"}.`,
    );
  }
  if (nights.length < (listing.minNights || 1)) {
    return refuse(
      req,
      res,
      id,
      `This stay has a minimum of ${listing.minNights} nights.`,
    );
  }
  if (listing.maxNights && nights.length > listing.maxNights) {
    return refuse(
      req,
      res,
      id,
      `This stay has a maximum of ${listing.maxNights} night${listing.maxNights === 1 ? "" : "s"}.`,
    );
  }
  const taken = await Booking.exists({
    listing: id,
    status: "confirmed",
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
  });
  if (taken || overlapsBlocked(listing, checkIn, checkOut)) {
    return refuse(
      req,
      res,
      id,
      "Those dates are no longer available. Please pick different dates.",
    );
  }

  const now = new Date();
  const clash = await Booking.findOne({
    guest: req.user._id,
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
    ...Booking.holdingGuest(now),
  }).populate("listing", "title");
  if (clash) {
    return refuse(
      req,
      res,
      id,
      `You already have a ${clash.status === "pending" ? "request" : "booking"} for those dates: ${clash.listing?.title || "another stay"} (${clash.reference}).`,
    );
  }

  const [active, recent] = await Promise.all([
    Booking.countDocuments({
      guest: req.user._id,
      ...Booking.activePending(now),
    }),
    Booking.countDocuments({
      guest: req.user._id,
      requestedAt: { $gt: new Date(now - DAY_MS) },
    }),
  ]);
  if (active >= MAX_ACTIVE_PENDING_PER_GUEST) {
    return refuse(
      req,
      res,
      id,
      `You can have ${MAX_ACTIVE_PENDING_PER_GUEST} requests waiting at a time. Wait for a reply or withdraw one from Trips.`,
    );
  }
  if (recent >= MAX_REQUESTS_PER_GUEST_24H) {
    return refuse(
      req,
      res,
      id,
      "You have sent a lot of requests today. Please try again tomorrow.",
    );
  }

  // Never later than the end of the check-in day, so a request cannot be accepted after it
  const expiresAt = new Date(
    Math.min(
      now.getTime() + REQUEST_TTL_HOURS * HOUR_MS,
      checkIn.getTime() + DAY_MS,
    ),
  );
  const booking = await Booking.create({
    listing: id,
    guest: req.user._id,
    checkIn,
    checkOut,
    nights,
    guests,
    ...quote(listing, nights.length),
    ...cancellationTerms(listing, checkIn),
    status: "pending",
    requestedAt: now,
    expiresAt,
    guestMessage: message || undefined,
  });

  const host = await User.findById(listing.owner).select("email");
  await Promise.all([
    notify(
      "bookingRequested",
      req.user.email,
      { booking, listing },
      context(booking),
    ),
    host &&
      notify(
        "bookingRequestToHost",
        host.email,
        {
          booking,
          listing,
          guestName: req.user.username,
          message: booking.guestMessage,
        },
        context(booking),
      ),
  ]);

  req.flash(
    "success",
    "Your request has been sent. The host has 48 hours to reply.",
  );
  res.redirect(`/bookings/${booking._id}`);
};

/**
 * GET /bookings/:bookingId - one booking, for its guest or its host
 */
module.exports.showBooking = async (req, res) => {
  const { booking, bookingRole } = req;
  await booking.populate("guest", "username displayName email");
  const confirmed = booking.effectiveStatus === "confirmed";
  const host =
    confirmed && booking.listing?.owner
      ? await User.findById(booking.listing.owner).select("username displayName email")
      : null;
  res.render("bookings/show.ejs", {
    booking,
    role: bookingRole,
    host,
    today: today(),
    now: new Date(),
    policy: CANCELLATION_POLICIES[booking.cancellationPolicy] || null,
    // The address and the exact pin: the host always, the guest once the stay is confirmed
    showAddress: bookingRole === "host" || confirmed,
    pageTitle: `Booking ${booking.reference}`,
    noindex: true,
  });
};

/**
 * GET /bookings - the current user's reservations
 */
module.exports.myBookings = async (req, res) => {
  const { bookings, page, pages } = await pageOf(
    { guest: req.user._id },
    req,
    (q) => q.populate("listing", LISTING_FIELDS),
  );
  res.render("bookings/index.ejs", {
    bookings,
    page,
    pages,
    base: "/bookings",
    today: today(),
    pageTitle: "Trips",
    noindex: true,
  });
};

// Totals across every one of the host's bookings, not only the current page
const hostSummary = async (listingIds, now) => {
  const startOfDay = today(now);
  const startOfYear = new Date(Date.UTC(startOfDay.getUTCFullYear(), 0, 1));
  const onListings = { listing: { $in: listingIds } };
  const [pending, upcoming, completed, earnings] = await Promise.all([
    Booking.countDocuments({ ...onListings, ...Booking.activePending(now) }),
    Booking.countDocuments({
      ...onListings,
      status: "confirmed",
      checkOut: { $gt: startOfDay },
    }),
    Booking.countDocuments({
      ...onListings,
      status: "confirmed",
      checkOut: { $lte: startOfDay, $gte: startOfYear },
    }),
    Booking.aggregate([
      { $match: { ...onListings, status: "confirmed" } },
      {
        $group: {
          _id: { $ifNull: ["$currency", "INR"] },
          total: { $sum: "$totalPrice" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);
  return { pending, upcoming, completed, earnings };
};

/**
 * GET /bookings/hosting - requests and reservations on the current user's listings
 */
module.exports.hostBookings = async (req, res) => {
  const listings = await Listing.find({ owner: req.user._id }).select(
    "_id title capacityDefaulted detailsIncomplete",
  );
  const ids = listings.map((l) => l._id);
  const now = new Date();
  await expireRequests({ listing: { $in: ids } }, now);

  const [{ bookings, page, pages }, requests, summary] = await Promise.all([
    pageOf(
      { listing: { $in: ids }, status: { $ne: "pending" } },
      req,
      (q) =>
        q
          .populate("listing", LISTING_FIELDS)
          .populate("guest", "username displayName"),
    ),
    Booking.find({ listing: { $in: ids }, ...Booking.activePending(now) })
      .sort({ expiresAt: 1 })
      .limit(50)
      .populate("listing", LISTING_FIELDS)
      .populate("guest", "username displayName"),
    hostSummary(ids, now),
  ]);
  res.render("bookings/hosting.ejs", {
    bookings,
    requests,
    summary,
    toConfirm: listings.filter((l) => l.capacityDefaulted),
    toComplete: listings.filter((l) => l.detailsIncomplete),
    page,
    pages,
    base: "/bookings/hosting",
    today: today(),
    pageTitle: "Hosting",
    noindex: true,
  });
};

const backTo = (req) =>
  req.bookingRole === "host" ? "/bookings/hosting" : "/bookings";

const hostOnly = (req, res) => {
  if (req.bookingRole === "host") return true;
  req.flash("error", "You are not authorized");
  res.redirect("/bookings");
  return false;
};

const notifyGuest = async (booking, type, data) => {
  const guest =
    booking.guest && (await User.findById(booking.guest).select("email"));
  if (guest) {
    await notify(
      type,
      guest.email,
      { booking, listing: booking.listing, ...data },
      context(booking),
    );
  }
};

/**
 * POST /bookings/:bookingId/accept - the unique index is the only judge of who gets the dates
 */
module.exports.acceptBooking = async (req, res) => {
  if (!hostOnly(req, res)) return;
  const { booking } = req;
  const now = new Date();

  const decline = async (message) => {
    const declined = await Booking.findOneAndUpdate(
      { _id: booking._id, status: "pending" },
      { status: "declined", respondedAt: now, declineReason: DATES_TAKEN_REASON },
      { new: true },
    );
    if (declined) {
      declined.listing = booking.listing;
      await notifyGuest(declined, "bookingDeclined", {
        reason: DATES_TAKEN_REASON,
      });
    }
    req.flash("error", message);
    return res.redirect("/bookings/hosting");
  };

  const listing = await Listing.findById(booking.listing._id).select("blockedRanges");
  if (overlapsBlocked(listing, booking.checkIn, booking.checkOut)) {
    return decline(
      "You have blocked some of these nights, so this request can no longer be accepted.",
    );
  }

  let updated;
  try {
    updated = await Booking.findOneAndUpdate(
      { _id: booking._id, status: "pending", expiresAt: { $gt: now } },
      { status: "confirmed", respondedAt: now },
      { new: true },
    );
  } catch (err) {
    if (err.code !== DUPLICATE_KEY) throw err;
    return decline(
      "These dates were just taken. This request can no longer be accepted.",
    );
  }
  if (!updated) {
    req.flash("error", "This request is no longer waiting for a reply.");
    return res.redirect("/bookings/hosting");
  }

  updated.listing = booking.listing;
  await notifyGuest(updated, "bookingAccepted", {
    hostName: req.user.username,
    hostEmail: req.user.email,
  });
  req.flash("success", "Request accepted. The guest has been told.");
  res.redirect(`/bookings/${booking._id}`);
};

/**
 * POST /bookings/:bookingId/decline
 */
module.exports.declineBooking = async (req, res) => {
  if (!hostOnly(req, res)) return;
  const { booking } = req;
  const reason = req.body.reason || undefined;
  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: "pending" },
    { status: "declined", respondedAt: new Date(), declineReason: reason },
    { new: true },
  );
  if (!updated) {
    req.flash("error", "This request is no longer waiting for a reply.");
    return res.redirect("/bookings/hosting");
  }
  updated.listing = booking.listing;
  await notifyGuest(updated, "bookingDeclined", { reason });
  req.flash("success", "Request declined. The guest has been told.");
  res.redirect("/bookings/hosting");
};

/**
 * DELETE /bookings/:bookingId - guest or host cancels before the check-in day
 */
module.exports.cancelBooking = async (req, res) => {
  const { booking, bookingRole } = req;
  if (["cancelled", "declined", "expired"].includes(booking.effectiveStatus)) {
    req.flash("error", `This booking is already ${booking.effectiveStatus}.`);
    return res.redirect(backTo(req));
  }
  if (booking.checkIn <= today()) {
    req.flash("error", "Bookings that have started cannot be cancelled.");
    return res.redirect(backTo(req));
  }

  const reason = req.body?.reason || undefined;
  const now = new Date();
  const late = isLateCancellation(booking, now);
  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: { $in: ["pending", "confirmed"] } },
    {
      status: "cancelled",
      cancelledBy: bookingRole,
      cancelReason: reason,
      respondedAt: now,
      ...(late && { cancelledLate: true }),
    },
    { new: true },
  );
  if (!updated) {
    req.flash("error", "This booking has already been changed.");
    return res.redirect(backTo(req));
  }
  updated.listing = booking.listing;

  // Tell the other party
  const data = { booking: updated, listing: booking.listing, cancelledBy: bookingRole, reason };
  if (bookingRole === "guest") {
    const host = await User.findById(booking.listing?.owner).select("email");
    if (host) {
      await notify("bookingCancelled", host.email, { ...data, forHost: true }, context(booking));
    }
  } else {
    await notifyGuest(updated, "bookingCancelled", {
      cancelledBy: bookingRole,
      reason,
      forHost: false,
    });
  }

  const done = bookingRole === "guest" ? "Booking cancelled." : "Reservation cancelled.";
  req.flash(
    "success",
    late ? `${done} It was after the free cancellation period, so it is marked as late.` : done,
  );
  res.redirect(backTo(req));
};

