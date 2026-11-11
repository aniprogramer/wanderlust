const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review");
const Booking = require("./booking");
const removeDependents = require("./cascade");
const {
  CATEGORY_NAMES,
  PROPERTY_TYPES,
  CURRENCIES,
  PAGE_SIZE,
  MAX_GUESTS,
  MAX_BEDROOMS,
  MAX_BEDS,
  MAX_BATHROOMS,
  MAX_IMAGES,
  MAX_STAY_NIGHTS,
  AMENITY_KEYS,
  ADDRESS_MAX,
  PLACE_MAX,
  OTHER_RULES_MAX,
  PHOTO_ALT_MAX,
  SIZE_MIN,
  SIZE_MAX,
  WIFI_MAX,
  TIME_OPTIONS,
  CANCELLATION_POLICY_KEYS,
  DEFAULT_CANCELLATION_POLICY,
  HOUSE_RULE_KEYS,
  ACCESSIBILITY_KEYS,
  SAFETY_KEYS,
  GUEST_NEED_KEYS,
  APPROX_MAX_OFFSET_M,
} = require("../utils/constants");
const { parseDay } = require("../utils/dates");
const { approxPoint, distanceM } = require("../utils/location");

const EARTH_RADIUS_KM = 6378.1;

// A draft may be missing anything; these are enforced from the moment it is published.
const unlessDraft = function () {
  return this.status !== "draft";
};
const time = { type: String, enum: TIME_OPTIONS };
// Unset means the host has not said; false means they said no.
const flags = (keys) => Object.fromEntries(keys.map((key) => [key, Boolean]));

const listingSchema = new Schema({
  title: {
    type: String,
    required: unlessDraft,
  },
  description: { type: String, default: "" },
  image: {
    filename: {
      type: String,
      default: "listingimage",
    },
    url: {
      type: String,
      default:
        "https://images.unsplash.com/photo-1705672323412-e971e3e6a9a6?q=80&w=1157&auto=format&fit=crop&ixlib=rb-4.1.0",
      set: (v) =>
        v === ""
          ? "https://images.unsplash.com/photo-1705672323412-e971e3e6a9a6?q=80&w=1157&auto=format&fit=crop&ixlib=rb-4.1.0"
          : v,
    },
  },
  price: { type: Number, required: unlessDraft, min: 1 },
  // The public place name, shown everywhere and searched. Always a copy of city (see below).
  location: { type: String, required: unlessDraft },
  // Private: shown only to the host and to a guest with a confirmed stay
  addressLine: { type: String, trim: true, maxlength: ADDRESS_MAX },
  city: { type: String, trim: true, maxlength: PLACE_MAX },
  region: { type: String, trim: true, maxlength: PLACE_MAX },
  country: { type: String, required: unlessDraft },
  // GeoJSON Point, coordinates are [longitude, latitude]. The exact pin: private, like addressLine.
  geometry: {
    type: { type: String, enum: ["Point"] },
    coordinates: { type: [Number], default: undefined },
  },
  // A random point near the pin, the centre of the circle everyone else sees (utils/location.js)
  approxGeometry: {
    type: { type: String, enum: ["Point"] },
    coordinates: { type: [Number], default: undefined },
  },
  // The host chose to publish without a map pin
  noPinAck: Boolean,
  currency: { type: String, enum: CURRENCIES, default: "INR" },
  maxGuests: { type: Number, min: 1, max: MAX_GUESTS, default: 4 },
  bedrooms: { type: Number, min: 0, max: MAX_BEDROOMS, default: 1 },
  beds: { type: Number, min: 1, max: MAX_BEDS, default: 2 },
  bathrooms: { type: Number, min: 0, max: MAX_BATHROOMS, default: 1 },
  // Set by migration 002 until the host confirms the guessed capacity
  capacityDefaulted: Boolean,
  cleaningFee: { type: Number, min: 0, default: 0 },
  minNights: { type: Number, min: 1, max: MAX_STAY_NIGHTS, default: 1 },
  maxNights: { type: Number, min: 1, max: MAX_STAY_NIGHTS, default: MAX_STAY_NIGHTS },
  sizeSqm: { type: Number, min: SIZE_MIN, max: SIZE_MAX },
  // Reported by the host and never measured; labelled "Host-reported" wherever it shows
  wifiMbps: { type: Number, min: 1, max: WIFI_MAX },
  checkInFrom: time,
  checkInUntil: time,
  checkOutBy: time,
  quietHoursStart: time,
  quietHoursEnd: time,
  cancellationPolicy: {
    type: String,
    enum: CANCELLATION_POLICY_KEYS,
    required: unlessDraft,
    // Runs after the other values are set, so a draft stays without one until the host picks
    default() {
      return this.status === "draft" ? undefined : DEFAULT_CANCELLATION_POLICY;
    },
  },
  otherRules: { type: String, trim: true, maxlength: OTHER_RULES_MAX },
  ...flags(HOUSE_RULE_KEYS),
  ...flags(ACCESSIBILITY_KEYS),
  ...flags(SAFETY_KEYS),
  // Search filter, kept in step with the amenities below
  hasWorkspace: Boolean,
  // Set by migration 008 until the host saves the full form
  detailsIncomplete: Boolean,
  // Nights the host is away. Both ends are nights and both are included.
  blockedRanges: {
    type: [
      {
        from: { type: Date, required: true },
        to: { type: Date, required: true },
        note: { type: String, maxlength: 100 },
      },
    ],
    default: [],
  },
  // Up to MAX_IMAGES photos, cover first. `image` above always mirrors the cover.
  images: {
    type: [
      {
        url: { type: String, required: true },
        filename: { type: String, required: true },
        // Alt text
        caption: { type: String, maxlength: PHOTO_ALT_MAX },
      },
    ],
    default: [],
    validate: {
      validator: (list) => list.length <= MAX_IMAGES,
      message: `A listing can have up to ${MAX_IMAGES} photos.`,
    },
  },
  amenities: { type: [{ type: String, enum: AMENITY_KEYS }], default: [] },
  // Hidden listings are out of search and the sitemap, and only their owner and admins can open
  // them. A draft is the same, except that only its owner can open it.
  status: {
    type: String,
    enum: ["published", "hidden", "draft"],
    default: "published",
  },
  category: { type: String, enum: CATEGORY_NAMES },
  propertyType: { type: String, enum: PROPERTY_TYPES },
  avgRating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review",
    },
  ],
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
});

listingSchema.index(
  { title: "text", location: "text", country: "text", description: "text" },
  { weights: { title: 10, location: 5, country: 5, description: 1 } },
);
listingSchema.index({ category: 1, price: 1 });
listingSchema.index({ country: 1, price: 1 });
listingSchema.index({ avgRating: -1 });
listingSchema.index({ geometry: "2dsphere" });
listingSchema.index({ approxGeometry: "2dsphere" });
listingSchema.index({ maxGuests: 1 });
listingSchema.index({ currency: 1, price: 1 });
listingSchema.index({ price: 1 });
listingSchema.index({ avgRating: -1, reviewCount: -1 });
listingSchema.index({ amenities: 1 });
listingSchema.index({ status: 1 });

// Photos and the cover. Older code and rows read `image`, so it stays the cover's copy.
listingSchema.virtual("gallery").get(function () {
  return this.images?.length ? this.images : [this.image];
});
listingSchema.pre("validate", function () {
  if (this.images?.length) {
    const [cover] = this.images;
    this.image = { url: cover.url, filename: cover.filename };
  }

  // One place name: the form sets city, and rows written without one are named after location
  if (this.city) this.location = this.city;
  else if (this.location) this.city = this.location;

  // One fact, one answer: the house rule and the amenity always agree
  const pets = this.amenities.includes("pets_allowed");
  if (this.petsAllowed === undefined && pets) this.petsAllowed = true;
  if (this.petsAllowed && !pets) this.amenities.push("pets_allowed");
  if (this.petsAllowed === false && pets) this.amenities.pull("pets_allowed");
  this.hasWorkspace = this.amenities.some((key) =>
    ["workspace", "dedicated_desk"].includes(key),
  );

  // Kept while it still fits, so that saving again does not reveal a new sample of the pin
  const pin = this.geometry?.coordinates;
  if (pin?.length === 2) {
    const area = this.approxGeometry?.coordinates;
    if (area?.length !== 2 || distanceM(area, pin) > APPROX_MAX_OFFSET_M + 1) {
      this.approxGeometry = { type: "Point", coordinates: approxPoint(pin) };
    }
  } else {
    this.approxGeometry = undefined;
  }

  if (this.minNights && this.maxNights && this.maxNights < this.minNights) {
    this.invalidate("maxNights", "Maximum nights cannot be less than minimum nights");
  }
});

// Everything that may appear to the public, as a query fragment. Absent counts as published.
listingSchema.statics.publicStatus = () => ({ $nin: ["hidden", "draft"] });

listingSchema.post("findOneAndDelete", async (listing) => {
  if (listing) await removeDependents([listing]);
});

// The country dropdown rarely changes, so keep the distinct list for 10 minutes and
// drop it whenever a listing is created, updated or deleted. Per process: other
// instances catch up when their own copy expires.
const COUNTRIES_TTL_MS = 10 * 60 * 1000;
let countriesCache = null;
const dropCountries = () => {
  countriesCache = null;
};
listingSchema.post("save", dropCountries);
listingSchema.post("findOneAndDelete", dropCountries);
listingSchema.post("insertMany", dropCountries);
listingSchema.statics.clearCountriesCache = dropCountries;
listingSchema.statics.countries = async function () {
  if (!countriesCache || Date.now() - countriesCache.at > COUNTRIES_TTL_MS) {
    countriesCache = {
      at: Date.now(),
      list: (await this.distinct("country", { status: { $ne: "draft" } })).sort(),
    };
  }
  return countriesCache.list;
};

// Recompute the denormalised rating used for filtering and card display.
listingSchema.statics.refreshRating = async function (id) {
  const listing = await this.findById(id).select("reviews");
  if (!listing) return;
  const [stats] = await Review.aggregate([
    { $match: { _id: { $in: listing.reviews } } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  await this.updateOne(
    { _id: id },
    {
      avgRating: stats ? Math.round(stats.avg * 10) / 10 : 0,
      reviewCount: stats ? stats.count : 0,
    },
  );
};

// "recommended" is absent on purpose: it is the default order below
const SORT_ORDER = {
  price_asc: { price: 1, _id: -1 },
  price_desc: { price: -1, _id: -1 },
  rating: { avgRating: -1, reviewCount: -1, _id: -1 },
  newest: { _id: -1 },
};

// Filtered, paginated search. `filters` is already validated (see searchSchema).
listingSchema.statics.search = async function (
  filters = {},
  { page = 1, limit = PAGE_SIZE, geoOnly = false } = {},
) {
  const {
    q,
    category,
    propertyType,
    country,
    minPrice,
    maxPrice,
    minRating,
    checkIn,
    checkOut,
    near,
    radiusKm = 25,
    guests,
    currency,
    sort,
    amenities,
    needs,
  } = filters;
  const query = geoOnly ? { "geometry.coordinates.0": { $exists: true } } : {};
  query.status = this.publicStatus();
  if (guests) query.maxGuests = { $gte: guests };
  if (amenities?.length) query.amenities = { $all: amenities };
  for (const need of needs || []) {
    if (GUEST_NEED_KEYS.includes(need)) query[need] = true;
  }
  if (q) query.$text = { $search: q };
  if (category) query.category = category;
  if (propertyType) query.propertyType = propertyType;
  if (country) query.country = country;
  if (minPrice != null || maxPrice != null) {
    // Amounts in different currencies cannot be compared, so a price range applies within one
    query.currency = currency || "INR";
    query.price = {};
    if (minPrice != null) query.price.$gte = minPrice;
    if (maxPrice != null) query.price.$lte = maxPrice;
  }
  if (near) {
    // $geoWithin (not $nearSphere) because countDocuments and $text cannot take $nearSphere.
    // The public point, so that narrowing the radius cannot find the exact pin.
    const [lat, lng] = near.split(",").map(Number);
    query.approxGeometry = {
      $geoWithin: { $centerSphere: [[lng, lat], radiusKm / EARTH_RADIUS_KM] },
    };
  }
  if (minRating) query.avgRating = { $gte: minRating };
  if (checkIn && checkOut) {
    const from = parseDay(checkIn);
    const to = parseDay(checkOut);
    const busy = await Booking.distinct("listing", {
      status: "confirmed",
      checkIn: { $lt: to },
      checkOut: { $gt: from },
    });
    query._id = { $nin: busy };
    query.blockedRanges = {
      $not: { $elemMatch: { from: { $lt: to }, to: { $gte: from } } },
    };
    // $not rather than $lte: rows that predate the field have no minimum
    const stay = Math.round((to - from) / 864e5);
    query.minNights = { $not: { $gt: stay } };
    query.maxNights = { $not: { $lt: stay } };
  }

  const find = this.find(query);
  if (sort && SORT_ORDER[sort]) {
    find.sort(SORT_ORDER[sort]);
  } else if (q) {
    find
      .select({ score: { $meta: "textScore" } })
      .sort({ score: { $meta: "textScore" }, _id: -1 });
  } else {
    find.sort({ _id: -1 });
  }
  const [listings, total] = await Promise.all([
    find.skip((page - 1) * limit).limit(limit),
    this.countDocuments(query),
  ]);
  return { listings, total, pages: Math.max(1, Math.ceil(total / limit)) };
};

const Listing = mongoose.model("Listing", listingSchema);

module.exports = Listing;
