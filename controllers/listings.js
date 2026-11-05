const mongoose = require("mongoose");
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const User = require("../models/user");
const cloudinary = require("../cloudConfig");
const fs = require("fs");
const { geocode } = require("../utils/geocode");
const buildQs = require("../utils/queryString");
const { toDay, today, parseDay } = require("../utils/dates");
const {
  MAP_LIMIT,
  MAX_IMAGES,
  MAX_BLOCKED_RANGES,
  MAX_LISTINGS_PER_HOST,
  MAX_LISTINGS_PER_HOST_24H,
  TAX_NOTICE,
  AMENITIES,
  SORTS,
} = require("../utils/constants");
const { blockedNights } = require("../utils/availability");
const { uploadsOf } = require("../middleware");
const seoFor = require("../utils/seo");
const logger = require("../utils/logger");
const { UI_CATEGORIES } = require("../utils/categories");

const hasGeocoder = () =>
  process.env.MAPBOX_SERVER_TOKEN || process.env.MAPBOX_TOKEN;

// Which of these listings has the current user saved? One small query instead of
// loading the whole wishlist on every request.
const savedIdsFor = async (user, listings) => {
  if (!user) return new Set();
  const { wishlist = [] } =
    (await User.findById(user._id).select("wishlist").lean()) || {};
  const onPage = new Set(listings.map((l) => String(l._id)));
  return new Set(wishlist.map(String).filter((id) => onPage.has(id)));
};
module.exports.savedIdsFor = savedIdsFor;

const removeTempFiles = (files) =>
  Promise.all(
    files.map((file) => fs.promises.unlink(file.path).catch(() => {})),
  );

// Uses picker coordinates when given, otherwise geocodes. Returns a GeoJSON Point,
// null when the place cannot be found, or undefined when geocoding is unavailable.
const resolveGeometry = async ({ lat, lng, location, country }) => {
  if (lat != null && lng != null) {
    return { type: "Point", coordinates: [lng, lat] };
  }
  if (!hasGeocoder()) return undefined;
  try {
    const coordinates = await geocode(`${location}, ${country}`);
    return coordinates ? { type: "Point", coordinates } : null;
  } catch (err) {
    logger.warn("Geocoding unavailable", { errorName: err.name });
    return undefined;
  }
};

const unknownLocation = (req, res, redirectTo) => {
  req.flash(
    "error",
    "We couldn't find that location. Pick a point on the map or refine the address.",
  );
  return res.redirect(redirectTo);
};

// ========================
// INDEX (search + filters + pagination)
// ========================
module.exports.index = async (req, res) => {
  const { page, ...filters } = req.filters;
  const [{ listings, total, pages }, countries] = await Promise.all([
    Listing.search(filters, { page }),
    Listing.countries(),
  ]);
  // A page past the end keeps the filters and lands on the last page that has results
  if (total > 0 && page > pages) {
    return res.redirect(302, `/listings${buildQs({ ...filters, page: pages })}`);
  }
  res.locals.savedIds = await savedIdsFor(req.user, listings);
  res.render("./listings/index.ejs", {
    allListings: listings,
    total,
    pages,
    page,
    filters,
    countries,
    isHomePage: true,
    uiCategories: UI_CATEGORIES,
    sorts: SORTS,
    amenityInfo: AMENITIES,
    serverToday: toDay(today()),
    pageTitle: "Stays worth the journey",
    pageDescription:
      "Find homes, cabins and villas, send a request to the host and pay at the property.",
    canonicalPath: "/listings",
    qs: (overrides) => buildQs({ ...filters, ...overrides }),
  });
};

// ========================
// MAP VIEW (same filters, only listings with coordinates)
// ========================
module.exports.mapView = async (req, res) => {
  const { page, ...filters } = req.filters;
  const [{ listings, total }, countries] = await Promise.all([
    Listing.search(filters, { limit: MAP_LIMIT, geoOnly: true }),
    Listing.countries(),
  ]);
  const geojson = {
    type: "FeatureCollection",
    features: listings.map((l) => ({
      type: "Feature",
      geometry: l.geometry,
      properties: {
        id: l._id,
        title: l.title,
        price: l.price,
        currency: l.currency,
        image: l.image.url,
      },
    })),
  };
  res.render("./listings/map.ejs", {
    geojson,
    total,
    mapLimit: MAP_LIMIT,
    sorts: SORTS,
    amenityInfo: AMENITIES,
    pageTitle: "Map of stays",
    pageDescription: "See Wanderlust stays on a map.",
    filters,
    countries,
    qs: (overrides) => buildQs({ ...filters, ...overrides }),
  });
};

// JSON endpoint used by the location picker
module.exports.geocode = async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q || !hasGeocoder()) return res.json({ coordinates: null });
  try {
    res.json({ coordinates: await geocode(q) });
  } catch {
    res.status(502).json({ coordinates: null });
  }
};

// ========================
// CREATE NEW LISTING
// ========================
const PLACEHOLDER_IMAGE = "listingimage";

// Largest side kept at Cloudinary, whatever size was uploaded (3.10)
const UPLOAD_OPTIONS = {
  transformation: [{ width: 2400, height: 2400, crop: "limit" }],
};

const destroyImages = (filenames) =>
  Promise.all(
    filenames
      .filter((name) => name && name !== PLACEHOLDER_IMAGE)
      .map((name) => cloudinary.uploader.destroy(name).catch(() => {})),
  );

// Sends the temp files to Cloudinary. If one fails, the ones already sent are removed.
const uploadAll = async (files) => {
  const photos = [];
  try {
    for (const file of files) {
      const result = await cloudinary.uploader.upload(file.path, UPLOAD_OPTIONS);
      photos.push({ url: result.secure_url, filename: result.public_id });
    }
  } catch (err) {
    await destroyImages(photos.map((photo) => photo.filename));
    throw err;
  }
  return photos;
};

const listingLimitMessage = async (ownerId) => {
  const total = await Listing.countDocuments({ owner: ownerId });
  if (total >= MAX_LISTINGS_PER_HOST) {
    return `An account can have up to ${MAX_LISTINGS_PER_HOST} listings.`;
  }
  // Listings have no createdAt, but their ObjectId holds the creation second
  const since = mongoose.Types.ObjectId.createFromTime(
    Math.floor((Date.now() - 864e5) / 1000),
  );
  const recent = await Listing.countDocuments({
    owner: ownerId,
    _id: { $gt: since },
  });
  return recent >= MAX_LISTINGS_PER_HOST_24H
    ? `You can add up to ${MAX_LISTINGS_PER_HOST_24H} listings a day. Please try again tomorrow.`
    : null;
};

module.exports.newListing = async (req, res, next) => {
  const files = uploadsOf(req);
  try {
    if (!files.length) {
      req.flash("error", "Add at least one photo.");
      return res.redirect("/listings/new");
    }
    if (files.length > MAX_IMAGES) {
      req.flash("error", `A listing can have up to ${MAX_IMAGES} photos.`);
      return res.redirect("/listings/new");
    }
    const limit = await listingLimitMessage(req.user._id);
    if (limit) {
      req.flash("error", limit);
      return res.redirect("/listings/new");
    }

    const { lat, lng, ...data } = req.body.listing;
    const geometry = await resolveGeometry({ lat, lng, ...data });
    if (geometry === null) return unknownLocation(req, res, "/listings/new");

    const photos = await uploadAll(files);

    const newListing = new Listing(data);
    newListing.owner = req.user._id;
    if (geometry) newListing.geometry = geometry;
    newListing.images = photos;
    try {
      await newListing.save();
    } catch (err) {
      await destroyImages(photos.map((photo) => photo.filename));
      throw err;
    }

    req.flash("success", "Your listing is live.");
    res.redirect("/listings");
  } finally {
    await removeTempFiles(files);
  }
};

// ========================
// SHOW LISTING
// ========================
// What the review area offers this visitor (2.8)
const reviewStateFor = async (user, listing) => {
  if (!user) return "wait";
  if (listing.owner?._id.equals(user._id)) return "owner";
  const already = listing.reviews.some((r) => r.author?._id.equals(user._id));
  if (already) return "reviewed";
  const stayed = await Booking.exists({
    listing: listing._id,
    guest: user._id,
    status: "confirmed",
    checkOut: { $lte: today() },
  });
  return stayed ? "form" : "wait";
};

module.exports.showListings = async (req, res) => {
  let { id } = req.params;

  const listing = await Listing.findById(id)
    .populate({
      path: "reviews",
      populate: { path: "author", select: "username" },
    })
    .populate("owner", "username");

  const canSeeHidden =
    req.user?.isAdmin || listing?.owner?._id.equals(req.user?._id);
  if (!listing || (listing.status === "hidden" && !canSeeHidden)) {
    req.flash("error", "Listing does not exist :(");
    return res.redirect("/listings");
  }

  const bookings = await Booking.find({
    listing: id,
    status: "confirmed",
    checkOut: { $gt: today() },
  })
    .sort("checkIn")
    .populate("guest", "username");
  // Both reach the calendar as "unavailable"; a guest does not need to know which is which
  const bookedNights = [
    ...new Set([
      ...bookings.flatMap((b) => b.nights.map(toDay)),
      ...blockedNights(listing),
    ]),
  ].sort();

  res.render("./listings/show", {
    listing,
    bookings,
    bookedNights,
    serverToday: toDay(today()),
    reviewState: await reviewStateFor(req.user, listing),
    taxNotice: TAX_NOTICE,
    amenityInfo: AMENITIES,
    pageTitle: `${listing.title}, ${listing.location}`,
    pageDescription: (listing.description || "").slice(0, 155),
    ...seoFor(listing),
  });
};

// ========================
// EDIT FORM
// ========================
module.exports.renderEditForm = async (req, res) => {
  let { id } = req.params;

  const listing = await Listing.findById(id);

  if (!listing) {
    req.flash("error", "Listing does not exist :(");
    return res.redirect("/listings");
  }

  res.render("./listings/edit.ejs", {
    listing,
    today: toDay(today()),
    pageTitle: `Edit ${listing.title}`,
    noindex: true,
  });
};

// ========================
// UPDATE LISTING
// ========================
const fieldFiles = (req, field) => req.files?.[`listing[${field}]`] || [];

module.exports.updateListing = async (req, res) => {
  const { id } = req.params;
  const editUrl = `/listings/${id}/edit`;
  const files = uploadsOf(req);

  try {
    const listing = await Listing.findById(id);

    if (!listing) {
      req.flash("error", "Listing does not exist :(");
      return res.redirect("/listings");
    }

    let { lat, lng, ...data } = req.body.listing;
    // A changed address with an untouched pin means the pin is stale: look the address up again.
    const [oldLng, oldLat] = listing.geometry?.coordinates || [];
    const pinMoved = lat !== oldLat || lng !== oldLng;
    const addressChanged =
      data.location !== listing.location || data.country !== listing.country;
    if (!pinMoved && addressChanged) {
      lat = lng = undefined;
    }
    const geometry = await resolveGeometry({ lat, lng, ...data });
    if (geometry === null) return unknownLocation(req, res, editUrl);

    // Blank optional selects clear the stored value
    listing.set({ category: undefined, propertyType: undefined, ...data });
    // Saving this form is the host confirming the numbers migration 002 guessed
    listing.capacityDefaulted = undefined;
    if (geometry) listing.geometry = geometry;
    // Geocoder down: a pin for the old address is worse than no pin
    else if (addressChanged) listing.geometry = undefined;

    // Work out the photo list before spending any uploads on it
    const current = listing.images.length
      ? listing.images.map((p) => p.toObject())
      : [{ url: listing.image.url, filename: listing.image.filename }];
    const replacements = fieldFiles(req, "image");
    const dropped = new Set(req.body.removeImages || []);
    // The old single-file field replaces the cover
    if (replacements.length && current[0]) dropped.add(current[0].filename);
    const kept = current.filter((photo) => !dropped.has(photo.filename));
    const count = kept.length + files.length;
    if (count > MAX_IMAGES) {
      req.flash("error", `A listing can have up to ${MAX_IMAGES} photos.`);
      return res.redirect(editUrl);
    }
    if (count === 0) {
      req.flash("error", "Keep at least one photo.");
      return res.redirect(editUrl);
    }

    // Validate before spending an upload on a doomed save
    await listing.validate();

    const uploaded = await uploadAll(files);
    const photos = replacements.length
      ? [...uploaded, ...kept]
      : [...kept, ...uploaded];
    const coverAt = photos.findIndex((p) => p.filename === req.body.coverImage);
    if (coverAt > 0) photos.unshift(...photos.splice(coverAt, 1));
    listing.images = photos;

    try {
      await listing.save();
    } catch (err) {
      await destroyImages(uploaded.map((photo) => photo.filename));
      throw err;
    }

    await destroyImages(
      current
        .filter((photo) => !photos.some((p) => p.filename === photo.filename))
        .map((photo) => photo.filename),
    );

    req.flash("success", "Listing updated.");
    res.redirect(`/listings/${id}`);
  } finally {
    await removeTempFiles(files);
  }
};

// ========================
// AVAILABILITY (nights the host is away)
// ========================
module.exports.addBlock = async (req, res) => {
  const { id } = req.params;
  const back = `/listings/${id}/edit#availability`;
  const from = parseDay(req.body.from);
  const to = parseDay(req.body.to);
  const listing = await Listing.findById(id);
  if (listing.blockedRanges.length >= MAX_BLOCKED_RANGES) {
    req.flash(
      "error",
      `You can have up to ${MAX_BLOCKED_RANGES} blocked periods. Remove one first.`,
    );
    return res.redirect(back);
  }
  const clash = await Booking.findOne({
    listing: id,
    status: "confirmed",
    checkIn: { $lte: to },
    checkOut: { $gt: from },
  });
  if (clash) {
    req.flash(
      "error",
      `Those dates overlap confirmed booking ${clash.reference} (${toDay(clash.checkIn)} to ${toDay(clash.checkOut)}).`,
    );
    return res.redirect(back);
  }
  listing.blockedRanges.push({ from, to, note: req.body.note || undefined });
  await listing.save();
  req.flash("success", "Those dates are now blocked.");
  res.redirect(back);
};

module.exports.removeBlock = async (req, res) => {
  const { id, blockId } = req.params;
  await Listing.updateOne(
    { _id: id },
    { $pull: { blockedRanges: { _id: blockId } } },
  );
  req.flash("success", "Those dates are open again.");
  res.redirect(`/listings/${id}/edit#availability`);
};

// ========================
// DELETE LISTING
// ========================
module.exports.destroyListing = async (req, res) => {
  let { id } = req.params;

  if (
    await Booking.exists({
      listing: id,
      status: "confirmed",
      checkOut: { $gt: today() },
    })
  ) {
    req.flash(
      "error",
      "This listing has upcoming bookings. Cancel them first.",
    );
    return res.redirect(`/listings/${id}`);
  }

  const listing = await Listing.findByIdAndDelete(id);

  await destroyImages([
    ...new Set([
      listing?.image?.filename,
      ...(listing?.images || []).map((photo) => photo.filename),
    ]),
  ]);

  req.flash("success", "Listing Deleted Successfully!");
  res.redirect("/listings");
};
