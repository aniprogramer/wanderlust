// One account, two modes. The active mode lives in the server-side session only
// (never on the user document) and anything but "host" means "guest".
const MODES = ["guest", "host"];
const HOMES = { guest: "/listings", host: "/listings/mine" };

const normalizeMode = (value) => (value === "host" ? "host" : "guest");

// Pages that only exist in one mode. Public pages (home, a stay, a profile) are in neither list.
const HOST_ONLY = [
  /^\/listings\/new\/?$/,
  /^\/listings\/mine\/?$/,
  /^\/listings\/[^/]+\/edit\/?$/,
  /^\/bookings\/hosting\/?$/,
];
const GUEST_ONLY = [/^\/bookings\/?$/, /^\/wishlist(\/|$)/];

const onlyIn = (path) => {
  const clean = String(path).split(/[?#]/)[0];
  if (HOST_ONLY.some((re) => re.test(clean))) return "host";
  if (GUEST_ONLY.some((re) => re.test(clean))) return "guest";
  return null;
};

// Same-site paths only; "//host" and "/\\host" are protocol-relative tricks
const isSafePath = (url) => typeof url === "string" && /^\/(?![/\\])/.test(url);

// Where to send someone who asked for `path` after (or while) being in `mode`
const landingFor = (path, mode) => {
  if (!isSafePath(path)) return HOMES[mode];
  const needs = onlyIn(path);
  return needs && needs !== mode ? HOMES[mode] : path;
};

// Header links per mode. Guests browse, host mode manages. The account menu is the same in both.
const NAV = {
  guest: [
    { href: "/listings", label: "Explore", icon: "fa-solid fa-compass" },
    { href: "/listings/map", label: "Map", icon: "fa-solid fa-location-dot" },
    { href: "/wishlist", label: "Saved", icon: "fa-regular fa-bookmark" },
    { href: "/bookings", label: "Trips", icon: "fa-solid fa-suitcase-rolling" },
  ],
  host: [
    { href: "/listings/mine", label: "Your listings", icon: "fa-solid fa-house-chimney" },
    { href: "/listings/new", label: "Create listing", icon: "fa-solid fa-plus" },
    { href: "/bookings/hosting", label: "Reservations", icon: "fa-solid fa-calendar-check" },
  ],
};
// Signed-out visitors see the guest links (Saved and Trips ask them to log in)
const navFor = (user, mode) => (user ? NAV[mode] : NAV.guest);

module.exports = { NAV, navFor, MODES, HOMES, normalizeMode, onlyIn, isSafePath, landingFor };
