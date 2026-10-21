// Backfills fields added after the first release. Safe to run any number of times.
//   node init/migrate.js            (refuses when NODE_ENV=production unless --force)
const path = require("path");
const mongoose = require("mongoose");
const Listing = require("../models/listing.js");

if (!["production", "test"].includes(process.env.NODE_ENV)) {
  require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
}

const MONGO_URL = process.env.ATLAS || "mongodb://127.0.0.1:27017/wanderlust";

// Matches only rows that still need the default, so a second run updates nothing.
const missing = (field) => ({ [field]: { $exists: false } });
const MISSING_GEOMETRY = { "geometry.coordinates.0": { $exists: false } };

const report = ({ currencySet, missingCategory, missingGeometry }) =>
  [
    `currency: set to INR on ${currencySet} listing(s)`,
    `category: ${missingCategory} listing(s) have none (edit them to pick one)`,
    `geometry: ${missingGeometry} listing(s) have no map pin (edit them to set one)`,
  ].join("\n");

const migrate = async () => {
  // updateMany on the raw collection: schema defaults would otherwise hide missing fields
  const { modifiedCount } = await Listing.collection.updateMany(
    missing("currency"),
    {
      $set: { currency: "INR" },
    },
  );
  const [missingCategory, missingGeometry] = await Promise.all([
    Listing.collection.countDocuments(missing("category")),
    Listing.collection.countDocuments(MISSING_GEOMETRY),
  ]);
  return { currencySet: modifiedCount, missingCategory, missingGeometry };
};

async function main() {
  if (
    process.env.NODE_ENV === "production" &&
    !process.argv.includes("--force")
  ) {
    console.error(
      "Refusing to migrate when NODE_ENV=production. Pass --force to override.",
    );
    process.exit(1);
  }
  await mongoose.connect(MONGO_URL);
  console.log(report(await migrate()));
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
  });
}

module.exports = { migrate, report, missing, MISSING_GEOMETRY };
