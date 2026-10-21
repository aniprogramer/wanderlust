const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");
const User = require("../models/user.js");
const removeDependents = require("../models/cascade.js");
const { geocode } = require("../utils/geocode.js");

if (!["production", "test"].includes(process.env.NODE_ENV)) {
  require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
}

const MONGO_URL = process.env.ATLAS || "mongodb://127.0.0.1:27017/wanderlust";
const SEED_USERNAME = "seed-host";

const findOrCreateSeedUser = async () =>
  (await User.findOne({ username: SEED_USERNAME })) ||
  User.register(
    new User({ username: SEED_USERNAME, email: "seed-host@example.com" }),
    crypto.randomBytes(24).toString("hex"),
  );

const initDB = async () => {
  const existing = await Listing.find().select("reviews");
  await removeDependents(existing);
  await Listing.deleteMany({});
  const owner = await findOrCreateSeedUser();
  // Coordinates come from Mapbox when a token is set; otherwise listings are seeded without a map pin.
  const hasToken = process.env.MAPBOX_SERVER_TOKEN || process.env.MAPBOX_TOKEN;
  const data = [];
  for (const obj of initData.data) {
    const coordinates = hasToken
      ? await geocode(`${obj.location}, ${obj.country}`).catch(() => null)
      : null;
    data.push({
      ...obj,
      owner: owner._id,
      ...(coordinates && { geometry: { type: "Point", coordinates } }),
    });
  }
  await Listing.insertMany(data);
  console.log("data is initialized!");
};

async function main() {
  if (
    process.env.NODE_ENV === "production" &&
    !process.argv.includes("--force")
  ) {
    console.error(
      "Refusing to wipe listings when NODE_ENV=production. Pass --force to override.",
    );
    process.exit(1);
  }
  await mongoose.connect(MONGO_URL);
  console.log("connected to DB");
  await initDB();
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error("DB initialization error:", err);
    process.exit(1);
  });
}

module.exports = { initDB, findOrCreateSeedUser };
