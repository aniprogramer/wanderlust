// 4.4: axe on the main screens in both themes, plus keyboard behaviour of the search controls.
const { test, expect } = require("@playwright/test");
const { AxeBuilder } = require("@axe-core/playwright");
const { PASSWORD, ids } = require("./fixtures");

const stubMapbox = async (page) => {
  await page.route("https://api.mapbox.com/**", (route) =>
    route.request().url().includes("/styles/")
      ? route.fulfill({ json: { version: 8, sources: {}, layers: [] } })
      : route.fulfill({ status: 200, body: "{}" }),
  );
  await page.route("https://events.mapbox.com/**", (route) => route.fulfill({ status: 204 }));
};

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

const SCREENS = [
  ["home", "/listings", null],
  ["search", "/listings?q=Haveli&guests=2", null],
  ["show", `/listings/${ids.pinned}`, "bob"],
  ["login", "/login", null],
  ["signup", "/signup", null],
  ["trips", "/bookings", "bob"],
  ["booking", `/bookings/${ids.bookingPending}`, "alice"],
  ["hosting", "/bookings/hosting", "alice"],
  ["edit", `/listings/${ids.pinned}/edit`, "alice"],
  ["new-listing", "/listings/new", "alice"],
  ["wishlist", "/wishlist", "bob"],
  ["your-profile", "/users/bob", "bob"],
  ["profile", "/users/alice", "bob"],
  ["profile-visitor", "/users/bob", null],
  ["your-listings", "/listings/mine", "alice"],
  ["contact", "/contact", null],
  ["help", "/help", null],
  ["privacy", "/privacy", null],
  ["terms", "/terms", null],
  ["report", `/listings/${ids.pinned}/report`, "bob"],
  ["admin", "/admin", "root"],
];

for (const [name, url, user] of SCREENS) {
  test(`axe: ${name}`, async ({ page }) => {
    test.setTimeout(90000);
    await stubMapbox(page);
    if (user) await login(page, user, hostPage(url, name) ? "host" : "guest");
    for (const colorScheme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto(url);
      await page.waitForLoadState("load");
      const { violations } = await new AxeBuilder({ page })
        // Mapbox draws its own controls, and third-party markup is not ours to fix
        .exclude(".mapboxgl-map")
        .analyze();
      const serious = violations
        .filter((v) => ["serious", "critical"].includes(v.impact))
        .map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
      expect({ colorScheme, serious }).toEqual({ colorScheme, serious: [] });
    }
  });
}

test.describe("keyboard", () => {
  test("the skip link is first and goes to the content", async ({ page }) => {
    await page.goto("/help");
    await page.keyboard.press("Tab");
    await expect(page.locator(".wl-skip-link")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
  });

  test("the calendar opens with Enter, holds focus, closes with Escape and returns", async ({ page }) => {
    await page.goto("/listings");
    const field = page.locator("#check-in-field");
    await field.focus();
    await page.keyboard.press("Enter");
    const popover = page.locator("#calendar-popover");
    await expect(popover).toBeVisible();
    await expect(popover).toHaveAttribute("aria-modal", "true");
    expect(await page.evaluate(() => document.getElementById("calendar-popover").contains(document.activeElement))).toBe(true);
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.getElementById("calendar-popover").contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
    await expect(field).toBeFocused();
  });

  test("Space opens the check-out field too", async ({ page }) => {
    await page.goto("/listings");
    await page.locator("#check-out-field").focus();
    await page.keyboard.press(" ");
    await expect(page.locator("#calendar-popover")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#check-out-field")).toBeFocused();
  });

  test("the gallery works from the keyboard", async ({ page }) => {
    await page.goto(`/listings/${ids.pinned}`);
    const thumbs = page.locator("[data-gallery-thumb]");
    await expect(thumbs).toHaveCount(2);
    await thumbs.nth(1).focus();
    await page.keyboard.press("Enter");
    await expect(thumbs.nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(thumbs.nth(0)).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#gallery-main")).toHaveAttribute("alt", /Photo 2/);
  });
});

test.describe("date picker and guests stepper (4.6)", () => {
  const iso = (d) => d.toISOString().slice(0, 10);
  const addDays = (n) => iso(new Date(Date.now() + n * 864e5));

  test("past days are disabled and today comes from the server", async ({ page }) => {
    await page.goto("/listings");
    await page.locator("#check-in-field").click();
    const yesterday = addDays(-1);
    const today = addDays(0);
    expect(await page.locator("#calendar-popover").getAttribute("data-today")).toBe(today);
    const past = page.locator(`[data-date="${yesterday}"]`);
    if (await past.count()) await expect(past).toBeDisabled();
    await expect(page.locator(`[data-date="${today}"]`)).toBeEnabled();
  });

  test("picking a range fills the fields and is sent with the search, then restored", async ({ page }) => {
    await page.goto("/listings");
    const from = addDays(40);
    const to = addDays(43);
    await page.locator("#check-in-field").click();
    await page.evaluate(([f, t]) => {
      const p = window.wanderlustDatePicker;
      p.selectDate(f);
      p.selectDate(t);
    }, [from, to]);
    await expect(page.locator("#check-in-field [data-date-value]")).toHaveText(from);
    await expect(page.locator("#check-out-field")).toHaveAttribute("aria-label", `Check out: ${to}`);
    await page.locator("#wl-cal-done").click();
    await page.locator(".wl-search-panel button[type=submit]").click();
    await page.waitForURL(/checkIn=/);
    expect(page.url()).toContain(`checkIn=${from}`);
    expect(page.url()).toContain(`checkOut=${to}`);
    await expect(page.locator("#check-in-field [data-date-value]")).toHaveText(from);
    await expect(page.locator("#check-in-input")).toHaveValue(from);
  });

  test("an earlier second click moves the start, and clear empties both", async ({ page }) => {
    await page.goto("/listings");
    await page.locator("#check-in-field").click();
    const result = await page.evaluate(([later, earlier]) => {
      const p = window.wanderlustDatePicker;
      p.selectDate(later);
      p.selectDate(earlier);
      const moved = [p.startDate, p.endDate];
      p.clearDates();
      return { moved, cleared: [p.startDate, p.endDate] };
    }, [addDays(20), addDays(10)]);
    expect(result.moved).toEqual([addDays(10), null]);
    expect(result.cleared).toEqual([null, null]);
    await expect(page.locator("#check-in-field [data-date-value]")).toHaveText("Add date");
  });

  test("guests: Done with no change sends one guest; the value comes back from the URL", async ({ page }) => {
    await page.goto("/listings");
    await expect(page.locator("#guests-input")).toHaveValue("");
    await page.locator("#guests-trigger-btn").click();
    await page.locator("#guests-done-btn").click();
    await expect(page.locator("#guests-input")).toHaveValue("1");
    await expect(page.locator("#guests-display")).toHaveText("1 guest");

    await page.goto("/listings?guests=3");
    await expect(page.locator("#guests-display")).toHaveText("3 guests");
    await expect(page.locator("#guests-input")).toHaveValue("3");
  });

  test("guests: the stepper stops at 1 and at 16, and Escape returns focus", async ({ page }) => {
    await page.goto("/listings?guests=15");
    await page.locator("#guests-trigger-btn").click();
    await expect(page.locator("#adults-dec-btn")).toBeEnabled();
    await page.locator("#adults-inc-btn").click();
    await expect(page.locator("#adults-inc-btn")).toBeDisabled();
    await expect(page.locator("#guests-display")).toHaveText("16 guests");
    await page.locator("#adults-dec-btn").focus();
    await page.keyboard.press("Escape");
    await expect(page.locator("#guests-popover")).toBeHidden();
    await expect(page.locator("#guests-trigger-btn")).toBeFocused();
  });

  test("on a phone the controls fit and the calendar shows one month", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/listings");
    await page.locator("#check-in-field").click();
    await expect(page.locator(".wl-cal-month")).toHaveCount(1);
    const box = await page.locator("#calendar-popover").boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    await page.keyboard.press("Escape");
    await page.locator("#guests-trigger-btn").click();
    await expect(page.locator("#guests-popover")).toBeVisible();
    const guests = await page.locator("#guests-popover").boundingBox();
    expect(guests.x + guests.width).toBeLessThanOrEqual(375);
  });
});

test("the longest navigation (admin) fits the narrowest desktop width on one line", async ({ page }) => {
  await login(page, "root");
  await page.setViewportSize({ width: 1200, height: 700 });
  await page.goto("/help");
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    heights: [...document.querySelectorAll(".navbar .nav-link")].map((el) => el.offsetHeight),
  }));
  expect(result.overflow).toBeLessThanOrEqual(0);
  expect(Math.max(...result.heights)).toBeLessThanOrEqual(48);
});
