// Publicly a stay is an area, not a point. The exact pin stays in `geometry`; everyone without a
// confirmed stay sees a circle around `approxGeometry`, which is a random nearby point.
const {
  APPROX_RADIUS_M,
  APPROX_MIN_OFFSET_M,
  APPROX_MAX_OFFSET_M,
} = require("./constants");

const METRES_PER_DEGREE = 111320;
const rad = (deg) => (deg * Math.PI) / 180;
const round = (value) => Math.round(value * 1e5) / 1e5;

// Good enough over a few hundred metres, which is all it is used for
const distanceM = ([aLng, aLat], [bLng, bLat]) => {
  const x = (aLng - bLng) * Math.cos(rad((aLat + bLat) / 2));
  return Math.hypot(x, aLat - bLat) * METRES_PER_DEGREE;
};

const approxPoint = ([lng, lat], random = Math.random) => {
  const metres =
    APPROX_MIN_OFFSET_M + random() * (APPROX_MAX_OFFSET_M - APPROX_MIN_OFFSET_M);
  const angle = random() * 2 * Math.PI;
  const dLat = (metres * Math.sin(angle)) / METRES_PER_DEGREE;
  // Near the poles the cosine vanishes; a pin that far out does not need a precise offset
  const dLng =
    (metres * Math.cos(angle)) /
    (METRES_PER_DEGREE * Math.max(Math.cos(rad(lat)), 0.01));
  return [
    round(Math.min(180, Math.max(-180, lng + dLng))),
    round(Math.min(90, Math.max(-90, lat + dLat))),
  ];
};

// The point that may be shown to anyone. A row the migration has not reached yet falls back to
// about 1 km of precision rather than the exact pin.
const publicCoords = (listing) => {
  const approx = listing.approxGeometry?.coordinates;
  if (approx?.length === 2) return [approx[0], approx[1]];
  const exact = listing.geometry?.coordinates;
  if (exact?.length !== 2) return null;
  return [Math.round(exact[0] * 100) / 100, Math.round(exact[1] * 100) / 100];
};

module.exports = { distanceM, approxPoint, publicCoords, APPROX_RADIUS_M };
