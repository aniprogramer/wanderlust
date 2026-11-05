const Listing = require("../models/listing");
const Report = require("../models/report");
const SupportMessage = require("../models/supportMessage");
const ExpressError = require("../utils/ExpressError");

const RECENT = 50;

module.exports.dashboard = async (req, res) => {
  const [listings, reports, messages] = await Promise.all([
    Listing.find()
      .select("title location status owner")
      .sort({ _id: -1 })
      .limit(RECENT)
      .populate("owner", "username"),
    Report.find({ resolvedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(RECENT)
      .populate("listing", "title"),
    SupportMessage.find({ resolvedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(RECENT),
  ]);
  res.render("admin/index.ejs", {
    listings,
    reports,
    messages,
    pageTitle: "Admin",
    noindex: true,
  });
};

const setStatus = (status, message) => async (req, res) => {
  const updated = await Listing.findByIdAndUpdate(req.params.id, { status });
  if (!updated) throw new ExpressError(404, "Listing not found");
  req.flash("success", message);
  res.redirect("/admin");
};
module.exports.hide = setStatus("hidden", "Listing hidden.");
module.exports.unhide = setStatus("published", "Listing is visible again.");

const resolve = (Model) => async (req, res) => {
  const updated = await Model.findByIdAndUpdate(req.params.id, {
    resolvedAt: new Date(),
  });
  if (!updated) throw new ExpressError(404, "Not found");
  req.flash("success", "Marked as resolved.");
  res.redirect("/admin");
};
module.exports.resolveMessage = resolve(SupportMessage);
module.exports.resolveReport = resolve(Report);
