// npm run make-admin -- <username> [--revoke] [--yes]
// The only way to change admin rights: there is no form for it. It prints the database it is
// about to change and asks for --yes in production.
const path = require("path");
const mongoose = require("mongoose");

if (!["production", "test"].includes(process.env.NODE_ENV)) {
  require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
}
const { describeTarget } = require("../init/seedGuard");

const target = (url) => {
  const { host, name } = describeTarget(url);
  return `${host}/${name}`;
};

(async () => {
  const [username] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  if (!username) {
    console.error("Usage: npm run make-admin -- <username> [--revoke]");
    process.exit(1);
  }
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--yes")) {
    console.error("In production, pass --yes after checking the database below.");
    console.error(`Database: ${target(process.env.ATLAS || "")}`);
    process.exit(1);
  }
  const url = process.env.ATLAS || "mongodb://127.0.0.1:27017/wanderlust";
  console.log(`Database: ${target(url)}`);
  await mongoose.connect(url);
  const { matchedCount } = await mongoose.connection.db
    .collection("users")
    .updateOne(
      { username },
      { $set: { isAdmin: !process.argv.includes("--revoke") } },
    );
  await mongoose.disconnect();
  if (!matchedCount) {
    console.error(`No user named ${username}.`);
    process.exit(1);
  }
  console.log(`Updated ${username}.`);
})().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
