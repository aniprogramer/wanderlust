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

// Tax is not calculated until the business decides whether and how GST applies (LD3).
// While this is null, taxAmount is 0 and the breakdown shows TAX_NOTICE instead of a line.
const GST_RATE = null;
const TAX_NOTICE =
  "Taxes are not included. The host will confirm any applicable taxes.";

// Card labels. Both are derived from real data (see utils/listingBadge.js).
const NEW_LISTING_DAYS = 60;
const FAVOURITE_MIN_RATING = 4.7;
const FAVOURITE_MIN_REVIEWS = 5;

// Space and capacity limits for a listing.
const MAX_GUESTS = 16;
const MAX_BEDROOMS = 20;
const MAX_BEDS = 30;
const MAX_BATHROOMS = 20;
const MAX_IMAGES = 6;
const MAX_BLOCKED_RANGES = 50;

// Request-to-book flow (LD1).
const REQUEST_TTL_HOURS = 48;
const MAX_ACTIVE_PENDING_PER_GUEST = 5;
const MAX_REQUESTS_PER_GUEST_24H = 20;
const MAX_LISTINGS_PER_HOST_24H = 10;
const MAX_LISTINGS_PER_HOST = 100;

const SORTS = {
  recommended: "Recommended",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  rating: "Highest rated",
  newest: "Newest",
};

const BOOKING_STATUSES = ["pending", "confirmed", "declined", "cancelled", "expired"];
const REASON_MAX = 300;
const GUEST_MESSAGE_MAX = 500;
const DATES_TAKEN_REASON = "Dates no longer available";

const REPORT_REASONS = [
  "False or misleading listing",
  "Photos are not of this place",
  "Unsafe or illegal",
  "Offensive content",
  "Something else",
];

const SUPPORT_TOPICS = [
  "A booking request",
  "Cancelling a stay",
  "Hosting",
  "My account",
  "Report a problem",
  "Something else",
];

// key -> [label, Font Awesome icon]. Listings store the keys only.
const AMENITIES = {
  wifi: ["Wi-Fi", "fa-wifi"],
  kitchen: ["Kitchen", "fa-kitchen-set"],
  parking: ["Free parking", "fa-square-parking"],
  air_conditioning: ["Air conditioning", "fa-wind"],
  heating: ["Heating", "fa-temperature-high"],
  washer: ["Washer", "fa-soap"],
  workspace: ["Workspace", "fa-laptop"],
  pool: ["Pool", "fa-person-swimming"],
  hot_tub: ["Hot tub", "fa-hot-tub-person"],
  tv: ["TV", "fa-tv"],
  pets_allowed: ["Pets allowed", "fa-paw"],
  breakfast: ["Breakfast", "fa-mug-saucer"],
  balcony: ["Balcony", "fa-building"],
  fireplace: ["Fireplace", "fa-fire"],
};

module.exports = {
  GST_RATE,
  TAX_NOTICE,
  NEW_LISTING_DAYS,
  FAVOURITE_MIN_RATING,
  FAVOURITE_MIN_REVIEWS,
  MAX_GUESTS,
  MAX_BEDROOMS,
  MAX_BEDS,
  MAX_BATHROOMS,
  MAX_IMAGES,
  MAX_BLOCKED_RANGES,
  REQUEST_TTL_HOURS,
  MAX_ACTIVE_PENDING_PER_GUEST,
  MAX_REQUESTS_PER_GUEST_24H,
  MAX_LISTINGS_PER_HOST_24H,
  MAX_LISTINGS_PER_HOST,
  BOOKING_STATUSES,
  REASON_MAX,
  GUEST_MESSAGE_MAX,
  DATES_TAKEN_REASON,
  REPORT_REASONS,
  SUPPORT_TOPICS,
  SORTS,
  SORT_KEYS: Object.keys(SORTS),
  AMENITIES,
  AMENITY_KEYS: Object.keys(AMENITIES),
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
