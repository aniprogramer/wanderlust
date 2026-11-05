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
    maxGuests: Joi.number().integer().min(1).max(MAX_GUESTS).required().messages({
      "any.required": "Enter how many guests can stay.",
      "number.base": "Enter how many guests can stay.",
      "number.min": `Guests must be between 1 and ${MAX_GUESTS}.`,
      "number.max": `Guests must be between 1 and ${MAX_GUESTS}.`,
    }),
    bedrooms: Joi.number().integer().min(0).max(MAX_BEDROOMS).required(),
    beds: Joi.number().integer().min(1).max(MAX_BEDS).required(),
    bathrooms: Joi.number().min(0).max(MAX_BATHROOMS).multiple(0.5).required(),
    cleaningFee: Joi.number().min(0).max(1000000).empty("").default(0),
    minNights: Joi.number().integer().min(1).max(MAX_STAY_NIGHTS).empty("").default(1),
    amenities: Joi.array()
      .items(Joi.string().valid(...AMENITY_KEYS))
      .single()
      .max(AMENITY_KEYS.length)
      .default([]),
  }).required(),
  // Edit form: stored filenames of the photos to drop, and of the one to make the cover
  removeImages: Joi.array().items(Joi.string().max(300)).single().max(MAX_IMAGES),
  coverImage: Joi.string().max(300).allow(""),
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
  password: newPassword,
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

module.exports.profileSchema = Joi.object({
  username: Joi.string().pattern(/^\w+$/).min(3).max(30).required().messages({
    "string.pattern.base": "Usernames can use letters, numbers and underscores.",
    "string.min": "Usernames are 3 to 30 characters.",
    "string.max": "Usernames are 3 to 30 characters.",
    "string.empty": "Enter a username.",
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
