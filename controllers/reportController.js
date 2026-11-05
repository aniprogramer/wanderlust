const crypto = require("crypto");
const Listing = require("../models/listing");
const Report = require("../models/report");
const ExpressError = require("../utils/ExpressError");
const notify = require("../utils/notify");
const { siteUrl } = require("../utils/config");
const { REPORT_REASONS } = require("../utils/constants");

const findListing = async (id) => {
  const listing = await Listing.findById(id).select("title status");
  if (!listing || listing.status === "hidden") {
    throw new ExpressError(404, "Listing not found");
  }
  return listing;
};

module.exports.form = async (req, res) => {
  res.render("listings/report.ejs", {
    listing: await findListing(req.params.id),
    reasons: REPORT_REASONS,
    pageTitle: "Report a listing",
    noindex: true,
  });
};

module.exports.send = async (req, res) => {
  const listing = await findListing(req.params.id);
  const report = await Report.create({
    reference: `RP-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
    listing: listing._id,
    reporter: req.user._id,
    reason: req.body.reason,
    details: req.body.details || undefined,
  });
  if (process.env.SUPPORT_EMAIL) {
    await notify(
      "reportForward",
      process.env.SUPPORT_EMAIL,
      {
        reference: report.reference,
        reason: report.reason,
        details: report.details,
        listingTitle: listing.title,
        listingUrl: siteUrl(`/listings/${listing._id}`),
      },
      { reportId: String(report._id) },
    );
  }
  req.flash(
    "success",
    `Thank you. We will look into it. Your reference is ${report.reference}.`,
  );
  res.redirect(`/listings/${listing._id}`);
};
