const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const { REPORT_REASONS } = require("../utils/constants");

const reportSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true },
    listing: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
    reporter: { type: Schema.Types.ObjectId, ref: "User" },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, maxlength: 1000 },
    resolvedAt: Date,
  },
  { timestamps: true },
);

reportSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Report", reportSchema);
