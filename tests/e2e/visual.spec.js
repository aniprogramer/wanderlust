// Mandatory visual check: every main screen at three widths in both themes, with no console
// errors and no sideways scroll. Screenshots land in __screenshots__ (git-ignored) for review.
const { test, expect } = require("@playwright/test");
const { PASSWORD, ids } = require("./fixtures");

const WIDTHS = [375, 768, 1280];
const THEMES = ["light", "dark"];

const screens = [
  ["home", "/listings", null],
  ["map", "/listings/map", null],
  ["show", `/listings/${ids.pinned}`, "bob"],
  ["new-listing", "/listings/new", "alice"],
  ["edit-listing", `/listings/${ids.pinned}/edit`, "alice"],
  ["login", "/login", null],
  ["signup", "/signup", null],
  ["forgot", "/forgot-password", null],
  ["trips", "/bookings", "bob"],
  ["hosting", "/bookings/hosting", "alice"],
  ["wishlist", "/wishlist", "bob"],
  ["not-found", "/no-such-page", null],
  ["booking-guest", `/bookings/${ids.bookingPending}`, "bob"],
  ["booking-host", `/bookings/${ids.bookingPending}`, "alice"],
  ["your-profile", "/users/bob", "bob"],
  ["profile", "/users/alice", "bob"],
  ["profile-visitor", "/users/bob", null],
  ["your-listings", "/listings/mine", "alice"],
  ["verify-email", "/verify-email", "bob"],
  ["contact", "/contact", null],
  ["help", "/help", null],
  ["privacy", "/privacy", null],
  ["terms", "/terms", null],
  ["cancellation", "/cancellation-policy", null],
  ["house-rules", "/house-rules", null],
  ["report", `/listings/${ids.pinned}/report`, "bob"],
  ["admin", "/admin", "root"],
];

// Login starts in the account's starting mode (guest here); `mode` then switches in the header
const hostPage = (path, name) =>
  /^\/listings\/new|\/edit$|^\/bookings\/hosting|^\/listings\/mine/.test(path) || name === "booking-host";

const login = async (page, username, mode = "guest") => {
  await page.goto("/login");
  await page.fill("#username", username);
  await page.fill("#password", PASSWORD);
  await Promise.all([
    page.waitForURL(/\/listings/),
    page.click("form[action='/login'] button[type=submit]"),
  ]);
  if (mode === "host") {
    // The switch stays on the same page when that page exists in both modes
    await page.evaluate(() => document.querySelector("form.wl-mode-switch").submit());
    await page.waitForSelector('.wl-mode-switch[data-mode="host"]', { state: "attached" });
  }
};

for (const [name, path, user] of screens) {
  test(`visual: ${name}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.route("https://api.mapbox.com/**", (route) => {
      const url = route.request().url();
      if (url.includes("/mapbox-gl-js/")) return route.continue();
      if (url.includes("/styles/")) {
        return route.fulfill({
          json: { version: 8, glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf", sources: {}, layers: [] },
        });
      }
      return route.fulfill({ status: 200, body: "" });
    });
    await page.route("https://events.mapbox.com/**", (route) =>
      route.fulfill({ status: 204 }),
    );
    if (user) await login(page, user, hostPage(path, name) ? "host" : "guest");

    const problems = [];
    page.on("console", (msg) => {
      // The not-found screen logs its own 404, which is the point of that screen
      if (msg.type() === "error" && !msg.text().includes("404")) {
        problems.push(msg.text());
      }
    });
    page.on("pageerror", (err) => problems.push(err.message));

    for (const width of WIDTHS) {
      for (const theme of THEMES) {
        await page.setViewportSize({ width, height: 900 });
        // Real system setting (LD7), so nothing is caught mid-transition
        await page.emulateMedia({ colorScheme: theme });
        await page.goto(path, { waitUntil: "load" });
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        );
        expect(overflow, `${name} ${width}px ${theme} scrolls sideways`).toBeLessThanOrEqual(0);
        await page.screenshot({
          path: `tests/e2e/__screenshots__/${name}-${width}-${theme}.png`,
          fullPage: true,
        });
      }
    }
    expect(problems).toEqual([]);
  });
}

test("system dark mode applies without a data-theme attribute", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto("/login");
  const background = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );
  expect(background).toBe("rgb(10, 19, 18)");
  await context.close();
});

test("system light mode keeps the Stone ground", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "light" });
  const page = await context.newPage();
  await page.goto("/login");
  const background = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );
  expect(background).toBe("rgb(241, 239, 233)");
  await context.close();
});

test("flash: success fades after 5 seconds and pauses on hover; errors stay", async ({ page }) => {
  await login(page, "bob");
  const flash = page.locator(".wl-toast:not([data-verify-banner])");
  await expect(flash).toBeVisible();
  await flash.hover();
  await page.waitForTimeout(6600);
  await expect(flash).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(flash).toHaveCount(0, { timeout: 7000 });

  await page.goto("/listings/507f1f77bcf86cd799439011");
  const error = page.locator(".wl-auth-alert--error.wl-toast");
  await expect(error).toBeVisible();
  await page.waitForTimeout(6600);
  await expect(error).toBeVisible();
  const close = error.locator("[data-toast-close]");
  const box = await close.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await close.click();
  await expect(error).toHaveCount(0);
});
