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

const CURRENCY_INFO = {
  INR: { code: "INR", symbol: "₹", flag: "🇮🇳", label: "Indian Rupee" },
  USD: { code: "USD", symbol: "$", flag: "🇺🇸", label: "US Dollar" },
  EUR: { code: "EUR", symbol: "€", flag: "🇪🇺", label: "Euro" },
  GBP: { code: "GBP", symbol: "£", flag: "🇬🇧", label: "British Pound" },
  AUD: { code: "AUD", symbol: "A$", flag: "🇦🇺", label: "Australian Dollar" },
  CAD: { code: "CAD", symbol: "C$", flag: "🇨🇦", label: "Canadian Dollar" },
  JPY: { code: "JPY", symbol: "¥", flag: "🇯🇵", label: "Japanese Yen" },
  AED: { code: "AED", symbol: "AED", flag: "🇦🇪", label: "UAE Dirham" },
};

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
  dryer: ["Dryer", "fa-shirt"],
  dedicated_desk: ["Dedicated desk", "fa-chair"],
  garden: ["Garden", "fa-seedling"],
  gym: ["Gym", "fa-dumbbell"],
};

// The listing form's checkbox groups. pets_allowed is absent on purpose: the house rule
// "Pets allowed" sets it, so one fact has one control (see the pre-validate hook on Listing).
const AMENITY_GROUPS = {
  Essentials: ["wifi", "kitchen", "washer", "dryer", "air_conditioning", "heating", "tv"],
  "Working here": ["workspace", "dedicated_desk"],
  "Outside and leisure": ["parking", "pool", "hot_tub", "balcony", "garden", "gym", "fireplace"],
  "Food": ["breakfast"],
};

// Boolean fields on a listing -> their label. Listings store the keys as top-level booleans.
// Unset means the host has not said; false means they said no.
const HOUSE_RULES = {
  smokingAllowed: { yes: "Smoking allowed", no: "No smoking" },
  petsAllowed: { yes: "Pets allowed", no: "No pets" },
  partiesAllowed: { yes: "Parties and events allowed", no: "No parties or events" },
  childrenWelcome: { yes: "Children welcome", no: "Not set up for children" },
};
const ACCESSIBILITY = {
  stepFreeAccess: "Step-free access",
  wheelchairEntrance: "Wheelchair-accessible entrance",
  wideDoorways: "Wide doorways",
  accessibleBathroom: "Accessible bathroom",
  liftInBuilding: "Lift in building",
};
const SAFETY = {
  smokeAlarm: "Smoke alarm",
  carbonMonoxideAlarm: "Carbon monoxide alarm",
  firstAidKit: "First-aid kit",
  fireExtinguisher: "Fire extinguisher",
};
// Search filters, each one a boolean on the listing. hasWorkspace is derived from the amenities.
const GUEST_NEEDS = {
  petsAllowed: "Pets allowed",
  hasWorkspace: "Workspace",
  stepFreeAccess: "Step-free access",
  wheelchairEntrance: "Wheelchair-accessible entrance",
};

// Fixed cancellation terms. There is no payment, so these decide only whether a cancellation
// counts as late. A booking stores the key and the deadline it worked out when it was requested.
const CANCELLATION_POLICIES = {
  flexible: {
    label: "Flexible",
    hoursBefore: 24,
    summary: "Free cancellation up to 24 hours before check-in.",
    description:
      "Good for guests whose plans may change. Cancel up to 24 hours before check-in and it is a free cancellation. After that it is recorded as a late cancellation.",
  },
  moderate: {
    label: "Moderate",
    hoursBefore: 5 * 24,
    summary: "Free cancellation up to 5 days before check-in.",
    description:
      "A balance for both sides. Cancel up to 5 days before check-in and it is a free cancellation. After that it is recorded as a late cancellation.",
  },
  strict: {
    label: "Strict",
    hoursBefore: 14 * 24,
    summary: "Free cancellation up to 14 days before check-in.",
    description:
      "For hosts who need notice. Cancel up to 14 days before check-in and it is a free cancellation. After that it is recorded as a late cancellation.",
  },
};
const CANCELLATION_POLICY_KEYS = Object.keys(CANCELLATION_POLICIES);
// What a listing that predates the choice uses until its host picks one (migration 008).
const DEFAULT_CANCELLATION_POLICY = "flexible";

// "00:00" to "23:30"
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) =>
  `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
);

// The address itself is private. Publicly a stay shows a circle this wide around a point up to
// APPROX_MAX_OFFSET_M from the real pin, so the pin is always inside but never at the centre.
const APPROX_RADIUS_M = 500;
const APPROX_MIN_OFFSET_M = 100;
const APPROX_MAX_OFFSET_M = 350;

// Listing form limits
const TITLE_MIN = 10;
const TITLE_MAX = 80;
const DESCRIPTION_MIN = 50;
const DESCRIPTION_MAX = 2000;
const ADDRESS_MAX = 160;
const OTHER_RULES_MAX = 300;
const PHOTO_ALT_MAX = 150;
const SIZE_MIN = 5;
const SIZE_MAX = 5000;
const WIFI_MAX = 10000;
const MAX_PRICE = 10000000;

const TOTAL_LABEL = "Total before taxes";

const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina",
  "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados",
  "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana",
  "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Canada",
  "Cape Verde", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros",
  "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia", "Democratic Republic of the Congo", "Denmark",
  "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador",
  "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea",
  "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran",
  "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan", "Jordan", "Kazakhstan",
  "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia",
  "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives",
  "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova",
  "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal",
  "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia",
  "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru",
  "Philippines", "Poland", "Portugal", "Qatar", "Republic of the Congo", "Romania", "Russia", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino",
  "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone",
  "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea",
  "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan",
  "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago",
  "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates",
  "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela",
  "Vietnam", "Yemen", "Zambia", "Zimbabwe",
];

// Profile fields. Languages come from a fixed list so the public page never shows free text
// we have not seen; city and country are short plain text (no street address is ever stored).
const LANGUAGES = [
  "English", "Hindi", "Bengali", "Marathi", "Tamil", "Telugu", "Gujarati", "Kannada",
  "Malayalam", "Punjabi", "Urdu", "Spanish", "French", "German", "Italian", "Portuguese",
  "Dutch", "Russian", "Arabic", "Turkish", "Japanese", "Korean", "Mandarin", "Cantonese",
  "Thai", "Indonesian",
];
const DISPLAY_NAME_MIN = 2;
const DISPLAY_NAME_MAX = 50;
const BIO_MAX = 300;
const PLACE_MAX = 80;

module.exports = {
  AMENITY_GROUPS,
  HOUSE_RULES,
  HOUSE_RULE_KEYS: Object.keys(HOUSE_RULES),
  ACCESSIBILITY,
  ACCESSIBILITY_KEYS: Object.keys(ACCESSIBILITY),
  SAFETY,
  SAFETY_KEYS: Object.keys(SAFETY),
  GUEST_NEEDS,
  GUEST_NEED_KEYS: Object.keys(GUEST_NEEDS),
  CANCELLATION_POLICIES,
  CANCELLATION_POLICY_KEYS,
  DEFAULT_CANCELLATION_POLICY,
  TIME_OPTIONS,
  APPROX_RADIUS_M,
  APPROX_MIN_OFFSET_M,
  APPROX_MAX_OFFSET_M,
  TITLE_MIN,
  TITLE_MAX,
  DESCRIPTION_MIN,
  DESCRIPTION_MAX,
  ADDRESS_MAX,
  OTHER_RULES_MAX,
  PHOTO_ALT_MAX,
  SIZE_MIN,
  SIZE_MAX,
  WIFI_MAX,
  MAX_PRICE,
  TOTAL_LABEL,
  COUNTRIES,
  LANGUAGES,
  DISPLAY_NAME_MIN,
  DISPLAY_NAME_MAX,
  BIO_MAX,
  PLACE_MAX,
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
  CURRENCY_INFO,
  ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/webp"],
  IMAGE_ERROR: "Image must be a JPEG, PNG or WebP under 5 MB.",
  PAGE_SIZE: 12,
  MAX_STAY_NIGHTS: 30,
  MAP_LIMIT: 500,
};
