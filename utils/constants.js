// Category name -> FontAwesome icon class. Single source for schema enums, Joi and views.
const CATEGORIES = {
  Trending: "fa-fire",
  Beachfront: "fa-umbrella-beach",
  Mountains: "fa-mountain",
  Cabins: "fa-house-chimney",
  Cities: "fa-city",
  Countryside: "fa-tractor",
  Luxury: "fa-gem",
  Budget: "fa-piggy-bank",
  "Tiny Homes": "fa-house",
  "Unique Stays": "fa-star",
};

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AUD", "CAD", "JPY", "AED"];

const PROPERTY_TYPES = [
  "House",
  "Apartment",
  "Cabin",
  "Villa",
  "Cottage",
  "Treehouse",
  "Castle",
  "Tiny Home",
];

// GST display is disabled until the business decides whether and how GST applies.
// While this is null, no tax line is rendered anywhere.
const GST_RATE = null;

module.exports = {
  GST_RATE,
  CATEGORIES,
  CATEGORY_NAMES: Object.keys(CATEGORIES),
  PROPERTY_TYPES,
  CURRENCIES,
  ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/webp"],
  IMAGE_ERROR: "Image must be a JPEG, PNG or WebP under 5 MB.",
  PAGE_SIZE: 12,
  MAX_STAY_NIGHTS: 30,
  MAP_LIMIT: 500,
};
