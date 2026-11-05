// BE6: the seeder wipes listings, bookings and wishlists, so it must be asked for loudly.
// Returns the reason to refuse, or null when it may run. Pure so it can be tested directly.
module.exports.seedRefusal = ({ env = {}, argv = [], url = "" }) => {
  if (env.NODE_ENV === "production") {
    return "NODE_ENV is production. The seeder never runs in production.";
  }
  if (env.ALLOW_DESTRUCTIVE_SEED !== "true") {
    return "Set ALLOW_DESTRUCTIVE_SEED=true to allow wiping this database.";
  }
  if (!argv.includes("--yes")) {
    return "Pass --yes after checking the target database printed above.";
  }
  const markers = (env.PROTECTED_DB_MARKERS || "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const hit = markers.find((m) => url.includes(m));
  if (hit) return `The connection string contains the protected marker "${hit}".`;
  return null;
};

// Host and database name only: never print the credentials in the connection string.
module.exports.describeTarget = (url) => {
  try {
    const { hostname, pathname } = new URL(url);
    return { host: hostname, name: pathname.replace(/^\//, "") || "(default)" };
  } catch {
    return { host: "(unparseable connection string)", name: "(unknown)" };
  }
};
