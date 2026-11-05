// npm run migrate            applies what is outstanding
// npm run migrate:status     lists every migration and whether it has run
const path = require("path");
const mongoose = require("mongoose");

if (!["production", "test"].includes(process.env.NODE_ENV)) {
  require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
}
const { migrate, status, refusal } = require("../migrations/runner");
const { describeTarget } = require("../init/seedGuard");

const url = process.env.ATLAS || "mongodb://127.0.0.1:27017/wanderlust";

(async () => {
  const showOnly = process.argv.includes("status");
  const refused = showOnly ? null : refusal();
  if (refused) {
    console.error(refused);
    process.exit(1);
  }
  const { host, name } = describeTarget(url);
  console.log(`Database: ${host}/${name}`);
  await mongoose.connect(url);
  const { db } = mongoose.connection;
  if (showOnly) {
    for (const row of await status(db)) {
      const when = row.appliedAt ? row.appliedAt.toISOString() : "not applied";
      console.log(`${row.name}  ${when}`);
    }
  } else {
    const applied = await migrate(db, { log: console.log });
    console.log(applied.length ? `Applied ${applied.length}.` : "Nothing to apply.");
  }
  await mongoose.disconnect();
})().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
