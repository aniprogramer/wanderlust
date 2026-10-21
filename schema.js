const Joi = require("joi");
const {
  CATEGORY_NAMES,
  PROPERTY_TYPES,
  CURRENCIES,
  MAX_STAY_NIGHTS,
} = require("./utils/constants");
const { parseDay, today, nightsBetween } = require("./utils/dates");
const { normalizeCategory } = require("./utils/categories");

// Multipart forms send "" for untouched inputs; treat those as absent.
const optionalNumber = (min, max) => Joi.number().min(min).max(max).empty("");

module.exports.listingSchema = Joi.object({
  listing: Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required().max(2000),
    location: Joi.string().required(),
    country: Joi.string().required(),
    price: Joi.number().required().min(1),
    category: Joi.string()
      .valid(...CATEGORY_NAMES)
      .empty(""),
    propertyType: Joi.string()
      .valid(...PROPERTY_TYPES)
      .empty(""),
    currency: Joi.string()
      .valid(...CURRENCIES)
      .empty(""),
    lat: optionalNumber(-90, 90),
    lng: optionalNumber(-180, 180),
  }).required(),
});

module.exports.reviewSchema = Joi.object({
  review: Joi.object({
    rating: Joi.number().integer().required().min(1).max(5),
    comment: Joi.string().required().max(1000),
  }).required(),
});

module.exports.signupSchema = Joi.object({
  username: Joi.string().pattern(/^\w+$/).min(3).max(30).required().messages({
    "string.pattern.base":
      "Username may only contain letters, numbers and underscores.",
  }),
  email: Joi.string().trim().email().required(),
  password: Joi.string().min(8).max(100).required(),
});

module.exports.loginSchema = Joi.object({
  username: Joi.string().max(100).required(),
  password: Joi.string().max(100).required(),
});

const day = Joi.string().custom((value, helpers) =>
  parseDay(value) ? value : helpers.error("any.invalid"),
);

module.exports.bookingSchema = Joi.object({
  booking: Joi.object({
    checkIn: day.required(),
    checkOut: day.required(),
  })
    .required()
    .custom((value, helpers) => {
      const checkIn = parseDay(value.checkIn);
      const checkOut = parseDay(value.checkOut);
      if (checkIn < today())
        return helpers.message("Check-in cannot be in the past");
      if (checkOut <= checkIn)
        return helpers.message("Check-out must be after check-in");
      if (nightsBetween(checkIn, checkOut).length > MAX_STAY_NIGHTS) {
        return helpers.message(
          `Stays are limited to ${MAX_STAY_NIGHTS} nights`,
        );
      }
      return value;
    }),
});

module.exports.searchSchema = Joi.object({
  q: Joi.string().trim().max(100).empty(""),
  category: Joi.string()
    .trim()
    .empty("")
    .custom((value, helpers) => {
      const canonical = normalizeCategory(value);
      return canonical ? canonical : helpers.error("any.invalid");
    }),
  propertyType: Joi.string()
    .valid(...PROPERTY_TYPES)
    .empty(""),
  country: Joi.string().trim().max(100).empty(""),
  minPrice: Joi.number().min(0).empty(""),
  maxPrice: Joi.number().min(0).empty(""),
  minRating: Joi.number().integer().min(1).max(5).empty(""),
  // "lat,lng" plus a radius; matches listings with a pin inside that circle
  near: Joi.string()
    .pattern(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
    .custom((value, helpers) => {
      const [lat, lng] = value.split(",").map(Number);
      return Math.abs(lat) <= 90 && Math.abs(lng) <= 180
        ? value
        : helpers.error("any.invalid");
    })
    .empty(""),
  radiusKm: Joi.number().min(1).max(1000).empty(""),
  checkIn: day.empty(""),
  checkOut: day.empty(""),
  page: Joi.number().integer().min(1).empty("").default(1),
})
  .and("checkIn", "checkOut")
  .with("radiusKm", "near")
  .custom((value, helpers) =>
    value.minPrice != null &&
    value.maxPrice != null &&
    value.minPrice > value.maxPrice
      ? helpers.message("Min price cannot exceed max price")
      : value,
  )
  .custom((value, helpers) =>
    value.checkIn && value.checkOut && value.checkOut <= value.checkIn
      ? helpers.message("Check-out must be after check-in")
      : value,
  );
