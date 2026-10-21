const ENDPOINT = "https://api.mapbox.com/search/geocode/v6/forward";
const TIMEOUT_MS = 5000;

// Returns [lng, lat] for the best match, or null when nothing is found.
// Throws on network / API failure / timeout so callers can decide how to degrade.
// MAPBOX_SERVER_TOKEN (secret, unrestricted) wins over the URL-restricted public token.
module.exports.geocode = async (query) => {
  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({
    q: query,
    limit: "1",
    access_token: process.env.MAPBOX_SERVER_TOKEN || process.env.MAPBOX_TOKEN,
  });
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Mapbox geocoding failed (${res.status})`);
  const { features } = await res.json();
  return features?.[0]?.geometry?.coordinates ?? null;
};
