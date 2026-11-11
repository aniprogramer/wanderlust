const Joi = require("joi");
const {
  CATEGORY_NAMES,
  PROPERTY_TYPES,
  CURRENCIES,
  MAX_STAY_NIGHTS,
  SUPPORT_TOPICS,
  MAX_IMAGES,
  MAX_GUESTS,
  MAX_BEDROOMS,
  MAX_BEDS,
  MAX_BATHROOMS,
  GUEST_MESSAGE_MAX,
  REASON_MAX,
  SORT_KEYS,
  AMENITY_KEYS,
  REPORT_REASONS,
  LANGUAGES,
  DISPLAY_NAME_MIN,
  DISPLAY_NAME_MAX,
  BIO_MAX,
  PLACE_MAX,
  COUNTRIES,
  CANCELLATION_POLICY_KEYS,
  HOUSE_RULE_KEYS,
  ACCESSIBILITY_KEYS,
  SAFETY_KEYS,
  GUEST_NEED_KEYS,
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
} = require("./utils/constants");
const { parseDay, today, nightsBetween } = require("./utils/dates");
const { normalizeCategory } = require("./utils/categories");

// Multipart forms send "" for untouched inputs; treat those as absent.
const optionalNumber = (min, max) => Joi.number().min(min).max(max).empty("");

// A1: one rule for signup, reset and change-password.
const PASSWORD_HINT = "Use 8 to 128 characters with at least one letter and one digit.";
const newPassword = Joi.string()
  .min(8)
  .max(128)
  .pattern(/[A-Za-z]/)
  .pattern(/\d/)
  .required()
  .messages({
    "string.min": PASSWORD_HINT,
    "string.max": PASSWORD_HINT,
    "string.pattern.base": PASSWORD_HINT,
  });
module.exports.PASSWORD_HINT = PASSWORD_HINT;
module.exports.newPassword = newPassword;

// A ticked box posts "on" and an unticked one posts nothing, so absent means no.
// The same times as TIME_OPTIONS. A pattern, because valid() skips any custom rule after a match.
const HALF_HOUR = /^([01]\d|2[0-3]):(00|30)$/;

const tickBox = () => Joi.boolean().truthy("on", "1").falsy("", "0").default(false);

// A named error code, because a catch-all message would replace helpers.message()
const notBefore = (other) => (value, helpers) => {
  const start = helpers.state.ancestors[0][other];
  return start && value < start ? helpers.error("time.order") : value;
};

// One rule set for both buttons. A draft may leave anything out and may be short of a minimum
// length, but what it does contain must still be valid.
const listingBody = (draft) => {
  const need = (rule, message) =>
    (draft ? rule : rule.required()).messages({ "*": message });
  const atLeast = (rule, min) => (draft ? rule : rule.min(min));
  const time = (message) =>
    Joi.string()
      .pattern(HALF_HOUR)
      .empty("")
      .messages({ "*": message });

  return Joi.object({
    // Basics
    title: need(
      atLeast(Joi.string().trim().max(TITLE_MAX).empty(""), TITLE_MIN),
      `Enter a title of ${TITLE_MIN} to ${TITLE_MAX} characters.`,
    ),
    description: need(
      atLeast(Joi.string().trim().max(DESCRIPTION_MAX).empty(""), DESCRIPTION_MIN),
      `Enter a description of ${DESCRIPTION_MIN} to ${DESCRIPTION_MAX} characters.`,
    ),
    propertyType: need(
      Joi.string()
        .valid(...PROPERTY_TYPES)
        .empty(""),
      "Choose a property type.",
    ),
    category: need(
      Joi.string()
        .valid(...CATEGORY_NAMES)
        .empty(""),
      "Choose a category.",
    ),

    // Location
    addressLine: need(
      Joi.string().trim().max(ADDRESS_MAX).empty(""),
      `Enter the address, up to ${ADDRESS_MAX} characters.`,
    ),
    city: need(
      Joi.string().trim().max(PLACE_MAX).empty(""),
      `Enter the city, up to ${PLACE_MAX} characters.`,
    ),
    region: need(
      Joi.string().trim().max(PLACE_MAX).empty(""),
      `Enter the region or state, up to ${PLACE_MAX} characters.`,
    ),
    country: need(
      Joi.string()
        .valid(...COUNTRIES)
        .empty(""),
      "Choose a country.",
    ),
    lat: optionalNumber(-90, 90).messages({ "*": "That map pin is not valid. Place it again." }),
    lng: optionalNumber(-180, 180).messages({ "*": "That map pin is not valid. Place it again." }),
    noPinAck: tickBox(),

    // Space
    maxGuests: need(
      Joi.number().integer().min(1).max(MAX_GUESTS).empty(""),
      `Enter how many guests can stay, from 1 to ${MAX_GUESTS}.`,
    ),
    bedrooms: need(
      Joi.number().integer().min(0).max(MAX_BEDROOMS).empty(""),
      `Enter the bedrooms, from 0 to ${MAX_BEDROOMS}.`,
    ),
    beds: need(
      Joi.number().integer().min(1).max(MAX_BEDS).empty(""),
      `Enter the beds, from 1 to ${MAX_BEDS}.`,
    ),
    bathrooms: need(
      Joi.number().min(0).max(MAX_BATHROOMS).multiple(0.5).empty(""),
      `Enter the bathrooms, from 0 to ${MAX_BATHROOMS} in steps of 0.5.`,
    ),
    sizeSqm: Joi.number()
      .min(SIZE_MIN)
      .max(SIZE_MAX)
      .empty("")
      .messages({ "*": `Enter the size from ${SIZE_MIN} to ${SIZE_MAX} square metres, or leave it blank.` }),

    // Pricing
    currency: need(
      Joi.string()
        .valid(...CURRENCIES)
        .empty(""),
      "Choose a currency.",
    ),
    price: need(
      Joi.number().min(1).max(MAX_PRICE).empty(""),
      "Enter a nightly price of at least 1.",
    ),
    cleaningFee: Joi.number()
      .min(0)
      .max(MAX_PRICE)
      .empty("")
      .default(0)
      .messages({ "*": "Enter a cleaning fee of 0 or more, or leave it blank." }),
    minNights: Joi.number()
      .integer()
      .min(1)
      .max(MAX_STAY_NIGHTS)
      .empty("")
      .default(1)
      .messages({ "*": `Enter minimum nights from 1 to ${MAX_STAY_NIGHTS}.` }),
    maxNights: Joi.number()
      .integer()
      .min(Joi.ref("minNights"))
      .max(MAX_STAY_NIGHTS)
      .empty("")
      .default(MAX_STAY_NIGHTS)
      .messages({
        "*": `Enter maximum nights up to ${MAX_STAY_NIGHTS}, and not less than the minimum.`,
      }),

    // Stay rules
    checkInFrom: need(time(""), "Choose the earliest check-in time."),
    checkInUntil: need(
      time("").custom(notBefore("checkInFrom")),
      "Choose the latest check-in time.",
    ).messages({ "time.order": "The latest check-in cannot be before the earliest." }),
    checkOutBy: need(time(""), "Choose the check-out time."),
    quietHoursStart: time("Choose a time from the list."),
    quietHoursEnd: time("Choose a time from the list.").when("quietHoursStart", {
      is: Joi.exist(),
      then: Joi.required().messages({ "any.required": "Choose when quiet hours end." }),
    }),
    cancellationPolicy: need(
      Joi.string()
        .valid(...CANCELLATION_POLICY_KEYS)
        .empty(""),
      "Choose a cancellation policy.",
    ),
    otherRules: Joi.string()
      .trim()
      .max(OTHER_RULES_MAX)
      .empty("")
      .messages({ "*": `Keep other rules to ${OTHER_RULES_MAX} characters.` }),
    ...Object.fromEntries(
      [...HOUSE_RULE_KEYS, ...ACCESSIBILITY_KEYS, ...SAFETY_KEYS].map((key) => [key, tickBox()]),
    ),

    // Amenities
    amenities: Joi.array()
      .items(Joi.string().valid(...AMENITY_KEYS))
      .single()
      .max(AMENITY_KEYS.length)
      .default([])
      .messages({ "*": "Choose amenities from the list." }),
    wifiMbps: Joi.number()
      .min(1)
      .max(WIFI_MAX)
      .empty("")
      .messages({ "*": `Enter the Wi-Fi speed from 1 to ${WIFI_MAX} Mbps, or leave it blank.` }),
  }).required();
};

const listingForm = (draft) =>
  Joi.object({
    listing: listingBody(draft),
    intent: Joi.string().valid("draft", "publish").empty("").default("publish"),
    // Edit form: stored filenames of the photos to drop, and of the one to make the cover
    removeImages: Joi.array().items(Joi.string().max(300)).single().max(MAX_IMAGES),
    // A stored filename, or "new:<index>" for a photo in this upload
    coverImage: Joi.string().max(300).allow(""),
    // Alt text, by position: the stored photos named in existingAltFile, then this upload
    existingAlt: Joi.array().items(Joi.string().trim().max(PHOTO_ALT_MAX).allow("")).single().max(MAX_IMAGES).messages({
      "string.max": `Keep alt text to ${PHOTO_ALT_MAX} characters.`,
    }),
    existingAltFile: Joi.array().items(Joi.string().max(300)).single().max(MAX_IMAGES),
    newAlt: Joi.array().items(Joi.string().trim().max(PHOTO_ALT_MAX).allow("")).single().max(MAX_IMAGES).messages({
      "string.max": `Keep alt text to ${PHOTO_ALT_MAX} characters.`,
    }),
  });

module.exports.listingSchema = listingForm(false);
module.exports.listingDraftSchema = listingForm(true);

module.exports.reviewSchema = Joi.object({
  review: Joi.object({
    rating: Joi.number().integer().required().min(1).max(5),
    comment: Joi.string().required().max(1000),
  }).required(),
});

const STARTING_MODE_HINT = "Choose whether you want to find stays or list your home.";
module.exports.signupSchema = Joi.object({
  firstName: Joi.string().trim().max(50).allow("").optional(),
  lastName: Joi.string().trim().max(50).allow("").optional(),
  username: Joi.string().pattern(/^\w+$/).min(3).max(30).required().messages({
    "string.pattern.base":
      "Username may only contain letters, numbers and underscores.",
  }),
  email: Joi.string().trim().email().required(),
  password: newPassword,
  confirmPassword: Joi.string().allow("").optional(),
  startingMode: Joi.string().valid("guest", "host").required().messages({
    "any.required": STARTING_MODE_HINT,
    "any.only": STARTING_MODE_HINT,
    "string.base": STARTING_MODE_HINT,
    "string.empty": STARTING_MODE_HINT,
  }),
  terms: Joi.valid("on").required().messages({
    "any.required": "Accept the Terms and Privacy Policy to create an account.",
    "any.only": "Accept the Terms and Privacy Policy to create an account.",
  }),
});

module.exports.contactSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().messages({
    "string.empty": "Enter your name.",
    "any.required": "Enter your name.",
    "string.max": "Keep your name under 100 characters.",
  }),
  email: Joi.string().trim().email().max(254).required().messages({
    "string.empty": "Enter your email address.",
    "any.required": "Enter your email address.",
    "string.email": "Enter a valid email address.",
  }),
  topic: Joi.string()
    .valid(...SUPPORT_TOPICS)
    .required()
    .messages({ "any.only": "Choose a topic.", "any.required": "Choose a topic." }),
  bookingReference: Joi.string().trim().max(40).allow("").messages({
    "string.max": "That booking reference is too long.",
  }),
  message: Joi.string().trim().min(10).max(2000).required().messages({
    "string.empty": "Tell us what you need help with.",
    "any.required": "Tell us what you need help with.",
    "string.min": "Add a little more detail, at least 10 characters.",
    "string.max": "Keep your message under 2000 characters.",
  }),
});

// "username" carries either a username or an email address
module.exports.loginSchema = Joi.object({
  username: Joi.string().trim().max(254).required(),
  password: Joi.string().max(128).required(),
  // The starting mode comes from the account. A page opened before the login control was removed
  // may still post this, and it must not fail the sign-in or have any effect.
  mode: Joi.any().strip(),
  rememberMe: Joi.string().valid("on", "true", "1").allow("").optional(),
});

module.exports.modeSchema = Joi.object({
  mode: Joi.string().valid("guest", "host").required(),
  returnTo: Joi.string().max(500).allow("").optional(),
});

module.exports.startingModeSchema = Joi.object({
  startingMode: Joi.string().valid("guest", "host").required().messages({
    "any.required": "Choose guest or host.",
    "any.only": "Choose guest or host.",
    "string.empty": "Choose guest or host.",
  }),
});

module.exports.forgotSchema = Joi.object({
  email: Joi.string().trim().email().max(254).required(),
});

module.exports.resetSchema = Joi.object({
  password: newPassword,
  confirmPassword: Joi.valid(Joi.ref("password")).required().messages({
    "any.only": "Passwords do not match.",
  }),
});

const day = Joi.string().custom((value, helpers) =>
  parseDay(value) ? value : helpers.error("any.invalid"),
);

module.exports.bookingSchema = Joi.object({
  booking: Joi.object({
    checkIn: day.required(),
    checkOut: day.required(),
    guests: Joi.number().integer().min(1).max(MAX_GUESTS).empty("").default(1),
    message: Joi.string().trim().max(GUEST_MESSAGE_MAX).allow("").messages({
      "string.max": `Keep your message under ${GUEST_MESSAGE_MAX} characters.`,
    }),
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
  guests: Joi.number().integer().min(1).max(MAX_GUESTS).empty(""),
  currency: Joi.string()
    .valid(...CURRENCIES)
    .empty(""),
  sort: Joi.string()
    .valid(...SORT_KEYS)
    .empty(""),
  amenities: Joi.array()
    .items(Joi.string().valid(...AMENITY_KEYS))
    .single()
    .empty(""),
  needs: Joi.array()
    .items(Joi.string().valid(...GUEST_NEED_KEYS))
    .single()
    .empty(""),
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

module.exports.reasonSchema = Joi.object({
  reason: Joi.string().trim().max(REASON_MAX).allow("").messages({
    "string.max": `Keep the reason under ${REASON_MAX} characters.`,
  }),
});

module.exports.blockSchema = Joi.object({
  from: day.required().messages({ "any.required": "Choose a first night." }),
  to: day.required().messages({ "any.required": "Choose a last night." }),
  note: Joi.string().trim().max(100).allow(""),
}).custom((value, helpers) => {
  if (parseDay(value.to) < parseDay(value.from))
    return helpers.message("The last night cannot be before the first night.");
  if (parseDay(value.to) < today())
    return helpers.message("Those dates are in the past.");
  return value;
});

const EMPTY = ["", null];
module.exports.profileSchema = Joi.object({
  displayName: Joi.string().trim().min(DISPLAY_NAME_MIN).max(DISPLAY_NAME_MAX).allow(...EMPTY).messages({
    "string.min": `Display names are ${DISPLAY_NAME_MIN} to ${DISPLAY_NAME_MAX} characters.`,
    "string.max": `Display names are ${DISPLAY_NAME_MIN} to ${DISPLAY_NAME_MAX} characters.`,
  }),
  bio: Joi.string().trim().max(BIO_MAX).allow(...EMPTY).messages({
    "string.max": `Keep your bio to ${BIO_MAX} characters.`,
  }),
  city: Joi.string().trim().max(PLACE_MAX).allow(...EMPTY).messages({
    "string.max": `City is up to ${PLACE_MAX} characters.`,
  }),
  country: Joi.string().trim().max(PLACE_MAX).allow(...EMPTY).messages({
    "string.max": `Country is up to ${PLACE_MAX} characters.`,
  }),
  languages: Joi.array()
    .items(Joi.string().valid(...LANGUAGES))
    .single()
    .max(LANGUAGES.length)
    .default([])
    .messages({ "any.only": "Choose languages from the list." }),
  removeAvatar: Joi.valid("on", "true", "1", "").optional(),
  username: Joi.string().pattern(/^\w+$/).min(3).max(30).required().messages({
    "string.pattern.base": "Usernames can use letters, numbers and underscores.",
    "string.min": "Usernames are 3 to 30 characters.",
    "string.max": "Usernames are 3 to 30 characters.",
    "string.empty": "Enter a username.",
  }),
});

module.exports.emailChangeSchema = Joi.object({
  currentPassword: Joi.string().max(128).required().messages({
    "string.empty": "Enter your current password.",
    "any.required": "Enter your current password.",
  }),
  email: Joi.string().trim().email().max(254).required().messages({
    "string.email": "Enter a valid email address.",
    "string.empty": "Enter your email address.",
  }),
});

module.exports.changePasswordSchema = Joi.object({
  currentPassword: Joi.string().max(128).required().messages({
    "string.empty": "Enter your current password.",
    "any.required": "Enter your current password.",
  }),
  password: newPassword,
});

module.exports.deleteAccountSchema = Joi.object({
  currentPassword: Joi.string().max(128).required().messages({
    "string.empty": "Enter your current password.",
    "any.required": "Enter your current password.",
  }),
  confirm: Joi.valid("DELETE").required().messages({
    "any.only": "Type DELETE to confirm.",
    "any.required": "Type DELETE to confirm.",
  }),
});

module.exports.reportSchema = Joi.object({
  reason: Joi.string()
    .valid(...REPORT_REASONS)
    .required()
    .messages({ "any.only": "Choose a reason.", "any.required": "Choose a reason." }),
  details: Joi.string().trim().max(1000).allow("").messages({
    "string.max": "Keep the details under 1000 characters.",
  }),
});
