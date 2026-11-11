// Responsive check: every main screen from a 320px phone to a 2560px monitor, including a short
// landscape phone. Nothing may scroll the page sideways or poke past the right edge of the
// viewport (except inside a container that scrolls on its own), and on touch widths every
// control must be at least 44px tall or wide enough to hit.
const { test, expect } = require("@playwright/test");
const { PASSWORD, ids } = require("./fixtures");

const SIZES = [
  [320, 640], [360, 740], [414, 896], [568, 320], [600, 900], [768, 1024],
  [820, 1180], [1024, 768], [1180, 820], [1440, 900], [1920, 1080], [2560, 1440],
];

const screens = [
  ["home", "/listings", null],
  ["map", "/listings/map", null],
  ["show", `/listings/${ids.pinned}`, "bob"],
  ["new-listing", "/listings/new", "alice"],
  ["login", "/login", null],
  ["signup", "/signup", null],
  ["forgot", "/forgot-password", null],
  ["trips", "/bookings", "bob"],
  ["hosting", "/bookings/hosting", "alice"],
  ["wishlist", "/wishlist", "bob"],
  ["not-found", "/no-such-page", null],
  ["booking", `/bookings/${ids.bookingPending}`, "bob"],
  ["profile", "/users/alice", "bob"],
  ["your-listings", "/listings/mine", "alice"],
  ["contact", "/contact", null],
  ["help", "/help", null],
  ["terms", "/terms", null],
  ["admin", "/admin", "root"],
];

const hostPage = (path) => /^\/listings\/new|^\/bookings\/hosting|^\/listings\/mine/.test(path);

const login = async (page, username, mode) => {
  await page.goto("/login");
  await page.fill("#username", username);
  await page.fill("#password", PASSWORD);
  await Promise.all([page.waitForURL(/\/listings/), page.click("form[action='/login'] button[type=submit]")]);
  if (mode === "host") {
    await page.evaluate(() => document.querySelector("form.wl-mode-switch").submit());
    await page.waitForSelector('.wl-mode-switch[data-mode="host"]', { state: "attached" });
  }
};

// Elements that stick out past the right edge and are not inside something that scrolls sideways
const pokingOut = () => {
  const width = document.documentElement.clientWidth;
  const scrolls = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if ((o === "auto" || o === "scroll" || o === "hidden" || o === "clip") && p.clientWidth <= width) return true;
    }
    return false;
  };
  return [...document.querySelectorAll("body *")]
    .filter((el) => {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (!box.width || !box.height || style.visibility === "hidden" || style.display === "none") return false;
      if (el.closest("[hidden], .mapboxgl-map, .sr-only, .visually-hidden, .wl-skip-link")) return false;
      // A fixed element cannot scroll the page, and a background photo may be mid-animation
      if (style.position === "fixed") return false;
      return box.right > width + 1 && !scrolls(el);
    })
    .slice(0, 5)
    .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} right=${Math.round(el.getBoundingClientRect().right)}`);
};

const smallTargets = () =>
  [...document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button]")]
    .filter((el) => {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (!box.width || style.visibility === "hidden" || style.display === "none") return false;
      if (el.closest("[hidden], .mapboxgl-map, .wl-skip-link, .flatpickr-calendar")) return false;
      if (el.matches("input[type=checkbox], input[type=radio], input[type=file]")) return false;
      // A link inside running text is exempt
      if (el.matches("a") && el.closest("p, li, .wl-prose") && getComputedStyle(el).display === "inline") return false;
      return Math.max(box.height, box.width) < 44 && Math.min(box.height, box.width) < 24;
    })
    .slice(0, 5)
    .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);

for (const [name, path, user] of screens) {
  test(`responsive: ${name}`, async ({ page }) => {
    test.setTimeout(180000);
    await page.route("https://api.mapbox.com/**", (route) => {
      const url = route.request().url();
      if (url.includes("/mapbox-gl-js/")) return route.continue();
      if (url.includes("/styles/"))
        return route.fulfill({ json: { version: 8, glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf", sources: {}, layers: [] } });
      return route.fulfill({ status: 200, body: "" });
    });
    await page.route("https://events.mapbox.com/**", (route) => route.fulfill({ status: 204 }));
    if (user) await login(page, user, hostPage(path) ? "host" : "guest");

    const problems = [];
    for (const [width, height] of SIZES) {
      await page.setViewportSize({ width, height });
      await page.goto(path, { waitUntil: "load" });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 0) problems.push(`${width}x${height}: page scrolls sideways by ${overflow}px`);
      const out = await page.evaluate(pokingOut);
      if (out.length) problems.push(`${width}x${height}: past the right edge: ${out.join(", ")}`);
      if (width <= 820) {
        const small = await page.evaluate(smallTargets);
        if (small.length) problems.push(`${width}x${height}: small targets: ${small.join(", ")}`);
      }
    }
    expect(problems, `${name}\n${problems.join("\n")}`).toEqual([]);
  });
}
