const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const supportMessageSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true, maxlength: 100 },
    email: { type: String, required: true, lowercase: true, trim: true },
    topic: { type: String, required: true },
    bookingReference: { type: String, maxlength: 40 },
    message: { type: String, required: true, maxlength: 2000 },
    resolvedAt: Date,
  },
  { timestamps: true },
);

supportMessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model("SupportMessage", supportMessageSchema);
