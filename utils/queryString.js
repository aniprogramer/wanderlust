// Builds "?a=1&b=2" from an object, skipping empty values. Used to keep filters across links.
module.exports = (params = {}) => {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "")
      qs.set(key, value);
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
};
