const mongoose = require("mongoose");

const CONNECTED = 1;

// For the host's load balancer. It says nothing beyond up or down.
module.exports = (req, res) => {
  const up = mongoose.connection.readyState === CONNECTED;
  res.set("Cache-Control", "no-store");
  res.status(up ? 200 : 503).json({ status: up ? "ok" : "unavailable" });
};
