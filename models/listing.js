const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const listingSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  description: String,
  image: {
    filename: {
      type: String,
      default: "listingimage",
    },
    url: {
      type: String,
      default:
        "https://images.unsplash.com/photo-1705672323412-e971e3e6a9a6?q=80&w=1157&auto=format&fit=crop&ixlib=rb-4.1.0",
      set: (v) =>
        v === ""
          ? "https://images.unsplash.com/photo-1705672323412-e971e3e6a9a6?q=80&w=1157&auto=format&fit=crop&ixlib=rb-4.1.0"
          : v,
    },
  },
  price: Number,
  location: String,
  country: String,
});
const Listing = mongoose.model("Listing", listingSchema);

module.exports = Listing;
