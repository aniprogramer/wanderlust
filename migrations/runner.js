// Applies the numbered scripts in this folder once each, in order, and records them in the
// `migrations` collection. Each script must also be safe to run twice, in case it fails midway.
const fs = require("fs");
const path = require("path");

const COLLECTION = "migrations";

const available = (dir = __dirname) =>
  fs
    .readdirSync(dir)
    .filter((file) => /^\d{3}-.+\.js$/.test(file))
    .sort()
    .map((file) => ({ name: file.replace(/\.js$/, ""), ...require(path.join(dir, file)) }));

const status = async (db, dir) => {
  const done = await db.collection(COLLECTION).find().toArray();
  const appliedAt = new Map(done.map((row) => [row._id, row.appliedAt]));
  return available(dir).map(({ name, description }) => ({
    name,
    description,
    appliedAt: appliedAt.get(name) || null,
  }));
};

// Stops at the first failure and leaves it unrecorded, so the next run retries it.
const migrate = async (db, { dir, log = () => {} } = {}) => {
  const applied = [];
  const done = new Set(
    (await db.collection(COLLECTION).find().toArray()).map((row) => row._id),
  );
  for (const script of available(dir)) {
    if (done.has(script.name)) continue;
    log(`Applying ${script.name}: ${script.description}`);
    const result = await script.up(db);
    if (result) log(`  ${result}`);
    await db
      .collection(COLLECTION)
      .insertOne({ _id: script.name, appliedAt: new Date() });
    applied.push(script.name);
  }
  return applied;
};

// Pure, so the rule can be tested without a database.
const refusal = ({ env = process.env, argv = process.argv } = {}) =>
  env.NODE_ENV === "production" && !argv.includes("--force")
    ? "Refusing to migrate when NODE_ENV=production. Take a backup, then pass --force."
    : null;

module.exports = { available, status, migrate, refusal };
