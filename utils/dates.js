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

// LD9: stays are plain calendar dates, kept at 00:00 UTC. "Today" is the date on the clock
// in APP_TIMEZONE, so a guest in Kolkata can book today just after their midnight.
const DEFAULT_TIMEZONE = "Asia/Kolkata";
const today = (now = new Date(), timeZone = process.env.APP_TIMEZONE) => {
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(`${local}T00:00:00.000Z`);
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
