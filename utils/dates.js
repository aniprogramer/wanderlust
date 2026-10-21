const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// "YYYY-MM-DD" -> Date at 00:00 UTC, or null when malformed / not a real calendar day.
const parseDay = (str) => {
  if (typeof str !== "string" || !DAY_RE.test(str)) return null;
  const date = new Date(`${str}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== str
    ? null
    : date;
};

const today = () => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
};

// Each night stayed: checkIn inclusive, checkOut exclusive.
const nightsBetween = (checkIn, checkOut) => {
  const nights = [];
  for (let t = checkIn.getTime(); t < checkOut.getTime(); t += DAY_MS) {
    nights.push(new Date(t));
  }
  return nights;
};

const toDay = (date) => date.toISOString().slice(0, 10);

module.exports = { parseDay, today, nightsBetween, toDay };
