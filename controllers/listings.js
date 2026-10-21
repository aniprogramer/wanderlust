const Listing = require("../models/listing");
const Booking = require("../models/booking");
const User = require("../models/user");
const cloudinary = require("../cloudConfig");
const fs = require("fs");
const { geocode } = require("../utils/geocode");
const buildQs = require("../utils/queryString");
const { toDay, today } = require("../utils/dates");
const { MAP_LIMIT } = require("../utils/constants");
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

const removeTempFile = (file) =>
  file && fs.promises.unlink(file.path).catch(() => {});

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
    console.error("Geocoding unavailable:", err.message);
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
module.exports.newListing = async (req, res, next) => {
  try {
    if (!req.file) {
      req.flash("error", "Image is required!");
      return res.redirect("/listings/new");
    }

    const { lat, lng, ...data } = req.body.listing;
    const geometry = await resolveGeometry({ lat, lng, ...data });
    if (geometry === null) return unknownLocation(req, res, "/listings/new");

    const result = await cloudinary.uploader.upload(req.file.path);

    const newListing = new Listing(data);
    newListing.owner = req.user._id;
    if (geometry) newListing.geometry = geometry;
    newListing.image = {
      url: result.secure_url,
      filename: result.public_id,
    };
    try {
      await newListing.save();
    } catch (err) {
      await cloudinary.uploader.destroy(result.public_id).catch(() => {});
      throw err;
    }

    req.flash("success", "New Listing Added!");
    res.redirect("/listings");
  } finally {
    await removeTempFile(req.file);
  }
};

// ========================
// SHOW LISTING
// ========================
module.exports.showListings = async (req, res) => {
  let { id } = req.params;

  const listing = await Listing.findById(id)
    .populate({
      path: "reviews",
      populate: { path: "author", select: "username" },
    })
    .populate("owner", "username");

  if (!listing) {
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
  const bookedNights = bookings.flatMap((b) => b.nights.map(toDay));

  res.render("./listings/show", {
    listing,
    bookings,
    bookedNights,
    serverToday: toDay(today()),
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

  let originalImageUrl = listing.image.url;
  originalImageUrl = originalImageUrl.replace("/upload", "/upload/w_250");

  res.render("./listings/edit.ejs", { listing, originalImageUrl });
};

// ========================
// UPDATE LISTING
// ========================
module.exports.updateListing = async (req, res) => {
  const { id } = req.params;
  const editUrl = `/listings/${id}/edit`;

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
    if (geometry) listing.geometry = geometry;
    // Geocoder down: a pin for the old address is worse than no pin
    else if (addressChanged) listing.geometry = undefined;

    // Validate before spending an upload on a doomed save
    await listing.validate();

    const oldImage = listing.image?.filename;
    let uploaded;
    if (req.file) {
      uploaded = await cloudinary.uploader.upload(req.file.path);
      listing.image = {
        url: uploaded.secure_url,
        filename: uploaded.public_id,
      };
    }

    try {
      await listing.save();
    } catch (err) {
      if (uploaded)
        await cloudinary.uploader.destroy(uploaded.public_id).catch(() => {});
      throw err;
    }

    if (uploaded && oldImage && oldImage !== "listingimage") {
      await cloudinary.uploader.destroy(oldImage);
    }

    req.flash("success", "Listing updated successfully!");
    res.redirect(`/listings/${id}`);
  } finally {
    await removeTempFile(req.file);
  }
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

  const imageId = listing?.image?.filename;
  if (imageId && imageId !== "listingimage") {
    await cloudinary.uploader.destroy(imageId);
  }

  req.flash("success", "Listing Deleted Successfully!");
  res.redirect("/listings");
};
