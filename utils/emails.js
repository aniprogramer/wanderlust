// Every transactional email: one function per type returning its words, rendered through
// the two templates in views/emails. Links always use APP_URL (see siteUrl).
const fs = require("fs");
const path = require("path");
const ejs = require("ejs");
const theme = require("./emailTheme");
const { siteUrl } = require("./config");
const { money } = require("./format");
const { toDay } = require("./dates");
const { TAX_NOTICE, TOTAL_LABEL, CANCELLATION_POLICIES } = require("./constants");

const read = (name) =>
  fs.readFileSync(path.join(__dirname, "../views/emails", name), "utf8");
const HTML = read("message.ejs");
const TEXT = read("message.text.ejs");

const stayFacts = (booking, listing) => [
  ["Stay", listing.title],
  ["Check-in", toDay(booking.checkIn)],
  ["Check-out", toDay(booking.checkOut)],
  ["Guests", booking.guests || 1],
  [TOTAL_LABEL, money(booking.totalPrice, booking.currency)],
  ...(CANCELLATION_POLICIES[booking.cancellationPolicy]
    ? [["Cancellation", CANCELLATION_POLICIES[booking.cancellationPolicy].summary]]
    : []),
  ["Reference", booking.reference],
];

const bookingUrl = (booking) => siteUrl(`/bookings/${booking._id}`);

const BUILDERS = {
  verifyEmail: ({ username, token, welcome }) => ({
    subject: welcome ? "Welcome to Wanderlust" : "Confirm your email address",
    heading: welcome ? `Welcome, ${username}` : "Confirm your email address",
    lines: [
      "Please confirm this email address. You need a confirmed address to send a booking request or list a stay.",
    ],
    action: {
      label: "Confirm my email",
      url: siteUrl(`/verify-email/${token}`),
    },
    note: "This link lasts 24 hours. If you did not ask for it, you can ignore this email.",
  }),

  passwordReset: ({ username, token }) => ({
    subject: "Reset your Wanderlust password",
    heading: "Reset your password",
    lines: [
      `Hi ${username}, use this link to choose a new password. It works once and expires in 1 hour.`,
    ],
    action: {
      label: "Choose a new password",
      url: siteUrl(`/reset-password/${token}`),
    },
    note: "If you did not ask for this, you can ignore this email.",
  }),

  passwordChanged: ({ username }) => ({
    subject: "Your Wanderlust password was changed",
    heading: "Your password was changed",
    lines: [
      `Hi ${username}, the password on your account has just been changed and other devices have been signed out.`,
      "If this was not you, reset your password straight away and contact us.",
    ],
    action: { label: "Reset my password", url: siteUrl("/forgot-password") },
  }),

  bookingRequested: ({ booking, listing }) => ({
    subject: `Request sent: ${listing.title}`,
    heading: "Your request has been sent",
    lines: [
      "The host has 48 hours to accept or decline. Your dates are not held until the host confirms.",
      `You pay at the property, nothing online. ${TAX_NOTICE}`,
    ],
    facts: stayFacts(booking, listing),
    action: { label: "View your request", url: bookingUrl(booking) },
  }),

  bookingRequestToHost: ({ booking, listing, guestName, message }) => ({
    subject: `New booking request: ${listing.title}`,
    heading: "You have a new booking request",
    lines: [
      `${guestName} would like to stay. Please accept or decline within 48 hours, or the request will expire.`,
      ...(message ? [`Their message: ${message}`] : []),
    ],
    facts: stayFacts(booking, listing),
    // A link to the page, never a one-click state change
    action: {
      label: "Accept or decline",
      url: siteUrl("/bookings/hosting"),
    },
  }),

  bookingAccepted: ({ booking, listing, hostName, hostEmail }) => ({
    subject: `Confirmed: ${listing.title}`,
    heading: "Your stay is confirmed",
    lines: [
      `${hostName} has confirmed your stay. You pay at the property.`,
      `You can reach your host at ${hostEmail}. ${TAX_NOTICE}`,
    ],
    facts: stayFacts(booking, listing),
    action: { label: "View your booking", url: bookingUrl(booking) },
  }),

  bookingDeclined: ({ booking, listing, reason }) => ({
    subject: `Request declined: ${listing.title}`,
    heading: "Your request was declined",
    lines: [
      "The host could not accept this request. You have not been charged.",
      ...(reason ? [`Reason: ${reason}`] : []),
    ],
    facts: stayFacts(booking, listing),
    action: { label: "Find another stay", url: siteUrl("/listings") },
  }),

  bookingExpired: ({ booking, listing }) => ({
    subject: `Request expired: ${listing.title}`,
    heading: "Your request has expired",
    lines: [
      "The host did not respond within 48 hours. You have not been charged and you are free to request other dates or stays.",
    ],
    facts: stayFacts(booking, listing),
    action: { label: "Find another stay", url: siteUrl("/listings") },
  }),

  bookingCancelled: ({ booking, listing, cancelledBy, reason, forHost }) => ({
    subject: `Cancelled: ${listing.title}`,
    heading: forHost ? "A guest cancelled" : "Your stay was cancelled",
    lines: [
      `This booking was cancelled by the ${cancelledBy}. No payment was taken online, so there is nothing to refund through Wanderlust.`,
      ...(booking.cancelledLate
        ? ["This was after the free cancellation period, so it is recorded as a late cancellation."]
        : []),
      ...(reason ? [`Reason: ${reason}`] : []),
    ],
    facts: stayFacts(booking, listing),
    action: {
      label: "See the cancellation policy",
      url: siteUrl("/cancellation-policy"),
    },
  }),

  supportReceived: ({ name, reference, topic }) => ({
    subject: `We received your message (${reference})`,
    heading: "We received your message",
    lines: [
      `Thanks, ${name}. We will reply by email. Please quote your reference if you write again.`,
    ],
    facts: [
      ["Reference", reference],
      ["Topic", topic],
    ],
  }),

  supportForward: ({ name, reference, topic, email, bookingReference, message }) => ({
    subject: `[${reference}] ${topic}`,
    heading: `Support message ${reference}`,
    lines: [message],
    facts: [
      ["From", `${name} <${email}>`],
      ["Topic", topic],
      ...(bookingReference ? [["Booking", bookingReference]] : []),
    ],
  }),

  reportForward: ({ reference, reason, details, listingTitle, listingUrl }) => ({
    subject: `[${reference}] Listing report: ${listingTitle}`,
    heading: "A listing was reported",
    lines: [`Reason: ${reason}`, ...(details ? [details] : [])],
    action: { label: "Open the listing", url: listingUrl },
  }),

  accountDeleted: ({ username }) => ({
    subject: "Your Wanderlust account has been deleted",
    heading: "Your account has been deleted",
    lines: [
      `Goodbye, ${username}. Your account, listings and saved stays have been removed and your reviews now show as "Deleted user".`,
      "If you did not do this, contact us straight away.",
    ],
    action: { label: "Contact us", url: siteUrl("/contact") },
  }),
};

const buildEmail = (type, data) => {
  const content = BUILDERS[type](data);
  const locals = {
    theme,
    facts: [],
    action: null,
    note: null,
    ...content,
    logoUrl: siteUrl("/assets/favicon-48x48.png"),
    helpUrl: siteUrl("/contact"),
  };
  return {
    subject: content.subject,
    html: ejs.render(HTML, locals),
    text: ejs.render(TEXT, locals).trim(),
  };
};

module.exports = { buildEmail, types: Object.keys(BUILDERS) };
