const crypto = require("crypto");
const SupportMessage = require("../models/supportMessage");
const Listing = require("../models/listing");
const { siteUrl } = require("../utils/config");
const notify = require("../utils/notify");
const { contactSchema } = require("../schema");
const { SUPPORT_TOPICS } = require("../utils/constants");

// Rendered with the same file name as the route
const LEGAL = {
  privacy: {
    pageTitle: "Privacy Policy",
    pageDescription:
      "What Wanderlust collects, why, who processes it, and how to access or delete your data.",
  },
  terms: {
    pageTitle: "Terms of Service",
    pageDescription:
      "The rules for using Wanderlust, a platform that connects guests and hosts.",
  },
  "cancellation-policy": {
    pageTitle: "Cancellation Policy",
    pageDescription:
      "How guests and hosts cancel on Wanderlust, and why there is nothing to refund online.",
  },
  "house-rules": {
    pageTitle: "House Rules",
    pageDescription: "What Wanderlust expects from guests and hosts.",
  },
};

module.exports.legalPage = (name) => (req, res) =>
  res.render(`legal/${name}.ejs`, LEGAL[name]);

module.exports.help = (req, res) =>
  res.render("pages/help.ejs", {
    pageTitle: "Help",
    pageDescription:
      "Answers about booking requests, cancelling, hosting, passwords and deleting your account.",
  });

const renderContact = (res, status, values, errors = {}) =>
  res.status(status).render("pages/contact.ejs", {
    pageTitle: "Contact us",
    pageDescription: "Write to the Wanderlust support team.",
    topics: SUPPORT_TOPICS,
    values,
    errors,
    errorCount: Object.keys(errors).length,
  });

module.exports.contactForm = (req, res) =>
  renderContact(res, 200, {
    name: req.user?.username || "",
    email: req.user?.email || "",
    bookingReference: req.query.booking || "",
  });

// Readable, unguessable, and short enough to quote in an email
const newReference = () =>
  `WL-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

module.exports.sendContact = async (req, res) => {
  const { error, value } = contactSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    const errors = {};
    for (const detail of error.details) {
      errors[detail.path[0]] ??= detail.message;
    }
    return renderContact(res, 400, req.body, errors);
  }

  // Saved first: a mail failure must never lose the message
  const saved = await SupportMessage.create({
    ...value,
    reference: newReference(),
    user: req.user?._id,
  });
  const context = { supportMessageId: String(saved._id) };
  await Promise.all([
    process.env.SUPPORT_EMAIL &&
      notify("supportForward", process.env.SUPPORT_EMAIL, saved, context),
    notify("supportReceived", saved.email, saved, context),
  ]);
  res.redirect(`/contact/sent?ref=${encodeURIComponent(saved.reference)}`);
};

module.exports.contactSent = (req, res) => {
  const ref = /^WL-[0-9A-F]{8}$/.test(req.query.ref) ? req.query.ref : null;
  res.render("pages/contact-sent.ejs", {
    pageTitle: "Message received",
    reference: ref,
    noindex: true,
  });
};

module.exports.robots = (req, res) =>
  res.type("text/plain").send(
    [
      "User-agent: *",
      "Disallow: /account",
      "Disallow: /bookings",
      "Disallow: /wishlist",
      "Disallow: /login",
      "Disallow: /signup",
      "Disallow: /listings/new",
      `Sitemap: ${siteUrl("/sitemap.xml")}`,
      "",
    ].join("\n"),
  );

// Rebuilt at most once an hour, per process
const SITEMAP_MAX = 5000;
const SITEMAP_TTL_MS = 60 * 60 * 1000;
let sitemapCache = null;
module.exports.clearSitemapCache = () => {
  sitemapCache = null;
};

module.exports.sitemap = async (req, res) => {
  if (!sitemapCache || Date.now() - sitemapCache.at > SITEMAP_TTL_MS) {
    const listings = await Listing.find({ status: { $ne: "hidden" } })
      .select("_id")
      .sort({ _id: -1 })
      .limit(SITEMAP_MAX)
      .lean();
    const paths = [
      "/listings",
      ...Object.keys(LEGAL).map((name) => `/${name}`),
      "/help",
      "/contact",
      ...listings.map((listing) => `/listings/${listing._id}`),
    ];
    sitemapCache = {
      at: Date.now(),
      xml: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
        .map((path) => `  <url><loc>${siteUrl(path)}</loc></url>`)
        .join("\n")}\n</urlset>\n`,
    };
  }
  res.set("Cache-Control", "public, max-age=3600").type("application/xml").send(sitemapCache.xml);
};
