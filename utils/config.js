// Production refuses to start until these are set. Each one has a user-facing feature that
// would otherwise fail quietly (mail that never arrives, photos that cannot upload).
const REQUIRED_IN_PRODUCTION = [
  "SECRET",
  "ATLAS",
  "APP_URL",
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASS",
  "MAIL_FROM",
  "SUPPORT_EMAIL",
  "CLOUD_NAME",
  "CLOUD_API_KEY",
  "CLOUD_API_SECRET",
];

const missingProductionEnv = (env = process.env) =>
  REQUIRED_IN_PRODUCTION.filter((name) => !env[name]?.trim());

// Called from the entry point before anything listens.
const assertProductionEnv = (env = process.env) => {
  if (env.NODE_ENV !== "production") return;
  const missing = missingProductionEnv(env);
  if (missing.length) {
    throw new Error(
      `Refusing to start. Missing environment variables: ${missing.join(", ")}`,
    );
  }
};

// Absolute link for emails and SEO tags. Development falls back to the local port.
const siteUrl = (path = "") => {
  const base =
    process.env.APP_URL?.trim() ||
    `http://localhost:${process.env.PORT || 8080}`;
  return `${base.replace(/\/$/, "")}${path}`;
};

module.exports = {
  REQUIRED_IN_PRODUCTION,
  missingProductionEnv,
  assertProductionEnv,
  siteUrl,
};
