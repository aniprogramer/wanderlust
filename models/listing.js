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
} = require("../utils/constants");
const { parseDay } = require("../utils/dates");

const EARTH_RADIUS_KM = 6378.1;

const listingSchema = new Schema({
  title: {
    type: String,
    required: true,
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
  price: { type: Number, required: true, min: 1 },
  location: { type: String, required: true },
  country: { type: String, required: true },
  // GeoJSON Point, coordinates are [longitude, latitude]
  geometry: {
    type: { type: String, enum: ["Point"] },
    coordinates: { type: [Number], default: undefined },
  },
  currency: { type: String, enum: CURRENCIES, default: "INR" },
  maxGuests: { type: Number, min: 1, max: MAX_GUESTS, default: 4 },
  bedrooms: { type: Number, min: 0, max: MAX_BEDROOMS, default: 1 },
  beds: { type: Number, min: 1, max: MAX_BEDS, default: 2 },
  bathrooms: { type: Number, min: 0, max: MAX_BATHROOMS, default: 1 },
  // Set by migration 002 until the host confirms the guessed capacity
  capacityDefaulted: Boolean,
  cleaningFee: { type: Number, min: 0, default: 0 },
  minNights: { type: Number, min: 1, max: MAX_STAY_NIGHTS, default: 1 },
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
        caption: { type: String, maxlength: 140 },
      },
    ],
    default: [],
    validate: {
      validator: (list) => list.length <= MAX_IMAGES,
      message: `A listing can have up to ${MAX_IMAGES} photos.`,
    },
  },
  amenities: { type: [{ type: String, enum: AMENITY_KEYS }], default: [] },
  // Hidden listings are out of search and the sitemap, and only their owner and admins can open them
  status: {
    type: String,
    enum: ["published", "hidden"],
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
});

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
      list: (await this.distinct("country")).sort(),
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
  } = filters;
  const query = geoOnly ? { "geometry.coordinates.0": { $exists: true } } : {};
  // Absent status means an older row, which counts as published
  query.status = { $ne: "hidden" };
  if (guests) query.maxGuests = { $gte: guests };
  if (amenities?.length) query.amenities = { $all: amenities };
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
    // $geoWithin (not $nearSphere) because countDocuments and $text cannot take $nearSphere
    const [lat, lng] = near.split(",").map(Number);
    query.geometry = {
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
    query.minNights = { $not: { $gt: Math.round((to - from) / 864e5) } };
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
