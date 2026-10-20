const path = require("path");
const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
}

const MONGO_URL = process.env.ATLAS || "mongodb://127.0.0.1:27017/wanderlust";

const initDB = async () => {
  await Listing.deleteMany({});
  initData.data = initData.data.map((obj) => ({
    ...obj,
    owner: "698bf32c86e1e7f133033312",
  }));
  await Listing.insertMany(initData.data);
  console.log("data is initialized!");
};

async function main() {
  await mongoose.connect(MONGO_URL);
  console.log("connected to DB");
  await initDB();
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("DB initialization error:", err);
});
