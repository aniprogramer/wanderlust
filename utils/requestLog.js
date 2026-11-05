const crypto = require("crypto");
const logger = require("./logger");

module.exports.requestContext = (req, res, next) => {
  res.locals.requestId = crypto.randomUUID();
  res.setHeader("X-Request-Id", res.locals.requestId);
  next();
};

// The route pattern, not the URL: real URLs can hold reset tokens and search text.
const logRoute = (req) =>
  req.route ? `${req.baseUrl}${req.route.path}` : "unmatched";
module.exports.logRoute = logRoute;

module.exports.logRequest = (req, res, next) => {
  const started = process.hrtime.bigint();
  res.on("finish", () => {
    // Static files never reach a route. Their failures are the only ones worth a line.
    if (!req.route && res.statusCode < 400) return;
    logger.info("request", {
      requestId: res.locals.requestId,
      method: req.method,
      route: logRoute(req),
      status: res.statusCode,
      durationMs: Number((process.hrtime.bigint() - started) / 1000000n),
      userId: req.user && String(req.user._id),
    });
  });
  next();
};
