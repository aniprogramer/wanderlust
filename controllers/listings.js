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
  AMENITIES,
  SORTS,
  AMENITY_GROUPS,
  HOUSE_RULES,
  ACCESSIBILITY,
  SAFETY,
  GUEST_NEEDS,
  CANCELLATION_POLICIES,
  DEFAULT_CANCELLATION_POLICY,
  TIME_OPTIONS,
  COUNTRIES,
  APPROX_RADIUS_M,
  TITLE_MIN,
  TITLE_MAX,
  DESCRIPTION_MIN,
  DESCRIPTION_MAX,
  ADDRESS_MAX,
  PLACE_MAX,
  OTHER_RULES_MAX,
  PHOTO_ALT_MAX,
  SIZE_MIN,
  SIZE_MAX,
  WIFI_MAX,
  MAX_GUESTS,
  MAX_BEDROOMS,
  MAX_BEDS,
  MAX_BATHROOMS,
  MAX_STAY_NIGHTS,
} = require("../utils/constants");
const { publicCoords } = require("../utils/location");
const { blockedNights } = require("../utils/availability");
const ExpressError = require("../utils/ExpressError");
const { normalizeMode } = require("../utils/mode");
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

// Uses picker coordinates when given, otherwise geocodes the address. Returns a GeoJSON Point,
// or null when there is no pin: nothing found, the geocoder is down, or too little to look up.
// A listing without a pin still saves (see saveOutcome).
const resolveGeometry = async ({ lat, lng, addressLine, city, region, country }) => {
  if (lat != null && lng != null) {
    return { type: "Point", coordinates: [lng, lat] };
  }
  if (!city || !country || !hasGeocoder()) return null;
  try {
    const coordinates = await geocode(
      [addressLine, city, region, country].filter(Boolean).join(", "),
    );
    return coordinates ? { type: "Point", coordinates } : null;
  } catch (err) {
    logger.warn("Geocoding unavailable", { errorName: err.name });
    return null;
  }
};

// Every field the form owns. Listed so that one left blank clears the stored value.
const FORM_FIELDS = [
  "title", "description", "propertyType", "category", "addressLine", "city", "region", "country",
  "noPinAck", "maxGuests", "bedrooms", "beds", "bathrooms", "sizeSqm", "currency", "price",
  "cleaningFee", "minNights", "maxNights", "checkInFrom", "checkInUntil", "checkOutBy",
  "quietHoursStart", "quietHoursEnd", "cancellationPolicy", "otherRules", "wifiMbps", "amenities",
  ...Object.keys(HOUSE_RULES), ...Object.keys(ACCESSIBILITY), ...Object.keys(SAFETY),
];
const applyForm = (listing, data) => {
  listing.set({
    ...Object.fromEntries(FORM_FIELDS.map((field) => [field, undefined])),
    ...data,
    location: data.city,
  });
};

const NO_PIN_DRAFT =
  "Saved as a draft. No pin yet: drop a pin on the map, or tick the box to publish without one.";
const NO_PIN_LIVE = "Saved. No pin yet: we could not place this address, so guests will see no map.";

const photoProblem = (count, intent) => {
  if (count > MAX_IMAGES) return `A listing can have up to ${MAX_IMAGES} photos.`;
  return intent === "publish" && count === 0 ? "Add at least one photo." : null;
};

// The lists and limits the form partial draws from. `form` carries what was typed after an error.
const formLocals = (form = {}) => ({
  form: { errors: {}, values: null, ...form },
  formOptions: {
    amenityGroups: AMENITY_GROUPS,
    houseRules: HOUSE_RULES,
    accessibility: ACCESSIBILITY,
    safety: SAFETY,
    policies: CANCELLATION_POLICIES,
    times: TIME_OPTIONS,
    countries: COUNTRIES,
    maxImages: MAX_IMAGES,
    limits: {
      TITLE_MIN, TITLE_MAX, DESCRIPTION_MIN, DESCRIPTION_MAX, ADDRESS_MAX, PLACE_MAX,
      OTHER_RULES_MAX, PHOTO_ALT_MAX, SIZE_MIN, SIZE_MAX, WIFI_MAX, MAX_GUESTS, MAX_BEDROOMS,
      MAX_BEDS, MAX_BATHROOMS, MAX_STAY_NIGHTS,
    },
  },
  noindex: true,
});

// Photo problems join the field errors, so the host sees everything in one pass
const formErrors = (req, photos) => ({
  ...req.listingForm?.errors,
  ...(photos && { photos }),
});

// A browser cannot refill a file input, so the host is told when chosen photos were dropped
const formFrom = (req, extra = {}) => ({
  errors: {},
  values: req.body?.listing || {},
  cover: req.body?.coverImage,
  removed: [].concat(req.body?.removeImages || []),
  photosLost: uploadsOf(req).length > 0,
  ...req.listingForm,
  ...extra,
});

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
    guestNeeds: GUEST_NEEDS,
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
      // The public point, never the exact pin
      geometry: { type: "Point", coordinates: publicCoords(l) },
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
    guestNeeds: GUEST_NEEDS,
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
const uploadAll = async (files, alts = []) => {
  const photos = [];
  try {
    for (const [i, file] of files.entries()) {
      const result = await cloudinary.uploader.upload(file.path, UPLOAD_OPTIONS);
      photos.push({
        url: result.secure_url,
        filename: result.public_id,
        ...(alts[i] && { caption: alts[i] }),
      });
    }
  } catch (err) {
    await destroyImages(photos.map((photo) => photo.filename));
    throw err;
  }
  return photos;
};

// The chosen cover goes first. coverImage is a stored filename, or "new:<i>" for this upload.
const coverFirst = (photos, coverImage, uploaded) => {
  const wanted = /^new:(\d+)$/.exec(coverImage || "");
  const filename = wanted ? uploaded[Number(wanted[1])]?.filename : coverImage;
  const at = photos.findIndex((photo) => photo.filename === filename);
  if (at > 0) photos.unshift(...photos.splice(at, 1));
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

module.exports.renderNewForm = (req, res) =>
  res.render("./listings/new.ejs", { pageTitle: "List your stay", ...formLocals() });

const renderNew = (req, res, extra) =>
  res.status(400).render("./listings/new.ejs", {
    pageTitle: "List your stay",
    ...formLocals(formFrom(req, extra)),
  });

module.exports.newListing = async (req, res, next) => {
  const files = uploadsOf(req);
  try {
    // A failed form has not been through Joi's defaults, so its intent is read here as well
    const intent = req.body.intent || "publish";
    const problem = photoProblem(files.length, intent);
    if (req.listingForm || problem) {
      return renderNew(req, res, { errors: formErrors(req, problem) });
    }
    const limit = await listingLimitMessage(req.user._id);
    if (limit) {
      req.flash("error", limit);
      return res.redirect("/listings/new");
    }

    const { lat, lng, ...data } = req.body.listing;
    const geometry = await resolveGeometry({ lat, lng, ...data });
    // No pin and no acknowledgement: what the host typed is kept, but it cannot go live yet
    const held = intent === "publish" && !geometry && !data.noPinAck;

    const photos = await uploadAll(files, req.body.newAlt);
    const newListing = new Listing();
    newListing.status = intent === "publish" && !held ? "published" : "draft";
    applyForm(newListing, data);
    newListing.owner = req.user._id;
    if (geometry) {
      newListing.geometry = geometry;
      newListing.noPinAck = undefined;
    }
    newListing.images = coverFirst(photos, req.body.coverImage, photos);
    try {
      await newListing.save();
    } catch (err) {
      await destroyImages(photos.map((photo) => photo.filename));
      throw err;
    }

    if (newListing.status === "draft") {
      req.flash(held ? "warning" : "success", held ? NO_PIN_DRAFT : "Draft saved. Only you can see it.");
      return res.redirect(`/listings/${newListing._id}/edit`);
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
      populate: { path: "author", select: "username displayName avatar" },
    })
    .populate("owner", "username displayName avatar");

  const isOwner = Boolean(req.user && listing?.owner?._id.equals(req.user._id));
  // A draft is its owner's alone. A listing the team hid is also open to admins.
  const canOpen =
    listing?.status === "draft"
      ? isOwner
      : listing?.status !== "hidden" || isOwner || req.user?.isAdmin;
  if (!listing || !canOpen) {
    req.flash("error", "Listing does not exist :(");
    return res.redirect("/listings");
  }

  const bookings = await Booking.find({
    listing: id,
    status: "confirmed",
    checkOut: { $gt: today() },
  })
    .sort("checkIn")
    .populate("guest", "username displayName");
  // Both reach the calendar as "unavailable"; a guest does not need to know which is which
  const bookedNights = [
    ...new Set([
      ...bookings.flatMap((b) => b.nights.map(toDay)),
      ...blockedNights(listing),
    ]),
  ].sort();

  // The address and exact pin are for the host and for a guest with a confirmed, unfinished stay
  const seesAddress =
    isOwner ||
    Boolean(
      req.user &&
        (await Booking.exists({
          listing: id,
          guest: req.user._id,
          status: "confirmed",
          checkOut: { $gt: today() },
        })),
    );
  const isDraft = listing.status === "draft";

  res.render("./listings/show", {
    listing,
    bookings,
    bookedNights,
    serverToday: toDay(today()),
    reviewState: await reviewStateFor(req.user, listing),
    amenityInfo: AMENITIES,
    houseRules: HOUSE_RULES,
    accessibility: ACCESSIBILITY,
    safety: SAFETY,
    seesAddress,
    mapCoords: seesAddress ? listing.geometry?.coordinates : publicCoords(listing),
    approxRadius: APPROX_RADIUS_M,
    policy:
      CANCELLATION_POLICIES[listing.cancellationPolicy] ||
      (isDraft ? null : CANCELLATION_POLICIES[DEFAULT_CANCELLATION_POLICY]),
    pageTitle: isDraft
      ? `Draft: ${listing.title || "Untitled"}`
      : `${listing.title}, ${listing.location}`,
    pageDescription: (listing.description || "").slice(0, 155),
    ...(isDraft ? { noindex: true } : seoFor(listing)),
  });
};

// ========================
// EDIT FORM
// ========================
const renderEdit = (res, status, listing, form) =>
  res.status(status).render("./listings/edit.ejs", {
    listing,
    today: toDay(today()),
    pageTitle: `Edit ${listing.title || "draft"}`,
    ...formLocals(form),
  });

module.exports.renderEditForm = async (req, res) => {
  let { id } = req.params;

  const listing = await Listing.findById(id);

  if (!listing) {
    req.flash("error", "Listing does not exist :(");
    return res.redirect("/listings");
  }

  renderEdit(res, 200, listing);
};

// ========================
// UPDATE LISTING
// ========================
const fieldFiles = (req, field) => req.files?.[`listing[${field}]`] || [];

// Defence in depth: the route already requires host mode, the controller refuses without it too
const assertHostMode = (req) => {
  if (normalizeMode(req.session?.mode) !== "host")
    throw new ExpressError(403, "Switch to host mode to manage listings.");
};

module.exports.mine = async (req, res) => {
  assertHostMode(req);
  const owned = await Listing.find({ owner: req.user._id }).sort({ _id: -1 });
  res.render("./listings/mine.ejs", {
    drafts: owned.filter((listing) => listing.status === "draft"),
    allListings: owned.filter((listing) => listing.status !== "draft"),
    pageTitle: "Your listings",
    noindex: true,
  });
};

const hasOpenBookings = (id) =>
  Booking.exists({
    listing: id,
    $or: [
      { status: "confirmed", checkOut: { $gt: today() } },
      Booking.activePending(),
    ],
  });

module.exports.updateListing = async (req, res) => {
  assertHostMode(req);
  const { id } = req.params;
  const editUrl = `/listings/${id}/edit`;
  const files = uploadsOf(req);

  try {
    const listing = await Listing.findById(id);

    if (!listing) {
      req.flash("error", "Listing does not exist :(");
      return res.redirect("/listings");
    }

    const intent = req.body.intent || "publish";
    const wasDraft = listing.status === "draft";

    // Work out the photo list before spending any uploads on it. A draft may have no photo yet,
    // in which case `image` is only the placeholder and does not count.
    const current = listing.images.length
      ? listing.images.map((p) => p.toObject())
      : wasDraft
        ? []
        : [{ url: listing.image.url, filename: listing.image.filename }];
    const replacements = fieldFiles(req, "image");
    const dropped = new Set([].concat(req.body.removeImages || []));
    // The old single-file field replaces the cover
    if (replacements.length && current[0]) dropped.add(current[0].filename);
    const kept = current.filter((photo) => !dropped.has(photo.filename));
    const problem = photoProblem(kept.length + files.length, intent);
    if (req.listingForm || problem) {
      return renderEdit(res, 400, listing, formFrom(req, { errors: formErrors(req, problem) }));
    }

    if (intent === "draft" && !wasDraft && (await hasOpenBookings(id))) {
      req.flash(
        "error",
        "This listing has requests or upcoming bookings, so it cannot go back to draft. Answer or cancel them first.",
      );
      return res.redirect(editUrl);
    }

    // Alt text the host typed against the photos they kept
    (req.body.existingAltFile || []).forEach((filename, i) => {
      const photo = kept.find((p) => p.filename === filename);
      if (photo) photo.caption = req.body.existingAlt?.[i] || undefined;
    });

    let { lat, lng, ...data } = req.body.listing;
    // A changed address with an untouched pin means the pin is stale: look the address up again.
    const [oldLng, oldLat] = listing.geometry?.coordinates || [];
    const pinMoved = lat !== oldLat || lng !== oldLng;
    // Filling in a part that was never stored (a migrated listing) is not a change of address
    const addressChanged = ["addressLine", "city", "region", "country"].some(
      (field) => listing[field] && data[field] !== listing[field],
    );
    if (!pinMoved && addressChanged) {
      lat = lng = undefined;
    }
    const geometry = await resolveGeometry({ lat, lng, ...data });

    // A listing the team hid stays hidden whatever button was used. A draft goes live only with a
    // pin or the acknowledgement; one that is already live is not pulled because a lookup failed.
    const held = intent === "publish" && wasDraft && !geometry && !data.noPinAck;
    if (listing.status !== "hidden") {
      listing.status = intent === "draft" || held ? "draft" : "published";
    }

    applyForm(listing, data);
    if (intent === "publish") {
      // Saving the whole form is the host confirming what migrations 002 and 008 filled in
      listing.capacityDefaulted = undefined;
      listing.detailsIncomplete = undefined;
    }
    if (geometry) {
      listing.geometry = geometry;
      listing.noPinAck = undefined;
    } else {
      listing.geometry = undefined;
    }

    // Validate before spending an upload on a doomed save
    await listing.validate();

    const uploaded = await uploadAll(files, req.body.newAlt);
    const photos = coverFirst(
      replacements.length ? [...uploaded, ...kept] : [...kept, ...uploaded],
      req.body.coverImage,
      uploaded,
    );
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

    if (listing.status === "draft") {
      req.flash(held ? "warning" : "success", held ? NO_PIN_DRAFT : "Draft saved. Only you can see it.");
      return res.redirect(editUrl);
    }
    if (!geometry && !data.noPinAck) {
      req.flash("warning", NO_PIN_LIVE);
      return res.redirect(`/listings/${id}`);
    }
    req.flash("success", wasDraft ? "Your listing is live." : "Listing updated.");
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
  assertHostMode(req);
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
