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
} = require("../utils/constants");

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
  } = filters;
  const query = geoOnly ? { "geometry.coordinates.0": { $exists: true } } : {};
  if (q) query.$text = { $search: q };
  if (category) query.category = category;
  if (propertyType) query.propertyType = propertyType;
  if (country) query.country = country;
  if (minPrice != null || maxPrice != null) {
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
    const busy = await Booking.distinct("listing", {
      status: "confirmed",
      checkIn: { $lt: checkOut },
      checkOut: { $gt: checkIn },
    });
    query._id = { $nin: busy };
  }

  const find = this.find(query);
  if (q) {
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
