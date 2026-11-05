// Every unexpected failure ends here: always logged, and forwarded to Sentry when SENTRY_DSN
// is set. @sentry/node is only loaded in that case, so it costs nothing otherwise.
const logger = require("./logger");

let sentry;
const getSentry = () => {
  if (!process.env.SENTRY_DSN) return null;
  if (!sentry) {
    sentry = require("@sentry/node");
    sentry.init({ dsn: process.env.SENTRY_DSN, sendDefaultPii: false });
  }
  return sentry;
};

module.exports = (err, context = {}) => {
  logger.error(err?.message || String(err), {
    ...context,
    errorName: err?.name,
    code: err?.code,
    stack: process.env.NODE_ENV === "production" ? undefined : err?.stack,
  });
  try {
    getSentry()?.captureException(err, { extra: logger.clean(context) });
  } catch (sentryError) {
    logger.error("Could not report to Sentry", { errorName: sentryError.name });
  }
};
