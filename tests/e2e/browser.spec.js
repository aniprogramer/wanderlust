const { test, expect } = require("@playwright/test");
const { PASSWORD, ids, booked, freeRange } = require("./fixtures");

// Minimal valid style so Mapbox GL fully loads without real Mapbox access.
// `glyphs` is required because the cluster map renders text labels.
const EMPTY_STYLE = {
  version: 8,
  glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
  sources: {},
  layers: [],
};

// Collects CSP violations, SRI failures, uncaught errors and console errors.
const watch = async (page) => {
  const problems = [];
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      console.error(
        `CSP: ${e.violatedDirective} blocked ${e.blockedURI || "inline"}`,
      );
    });
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") problems.push(msg.text());
  });
  page.on("pageerror", (err) => problems.push(`uncaught: ${err.message}`));
  // Only the GL library itself (JS/CSS, SRI-checked) comes from the real CDN;
  // every Mapbox API call (styles, fonts, sessions) is answered locally.
  await page.route("https://api.mapbox.com/**", (route) => {
    const url = route.request().url();
    if (url.includes("/mapbox-gl-js/")) return route.continue();
    if (url.includes("/styles/")) return route.fulfill({ json: EMPTY_STYLE });
    return route.fulfill({ status: 200, body: "" });
  });
  await page.route("https://events.mapbox.com/**", (route) =>
    route.fulfill({ status: 204 }),
  );
  return problems;
};

const login = async (page, username) => {
  await page.goto("/login");
  await page.fill("#username", username);
  await page.fill("#password", PASSWORD);
  await Promise.all([
    page.waitForURL(/\/listings/),
    page.click("form[action='/login'] button[type=submit]"),
  ]);
};

const pages = [
  ["/listings", null],
  ["/listings/map", null],
  [`/listings/${ids.pinned}`, "bob"],
  ["/listings/new", "alice"],
  [`/listings/${ids.pinned}/edit`, "alice"],
  ["/login", null],
  ["/signup", null],
  ["/bookings", "bob"],
  ["/bookings/hosting", "alice"],
  ["/wishlist", "bob"],
];

for (const [path, user] of pages) {
  test(`console is clean on ${path}${user ? ` (as ${user})` : ""}`, async ({
    page,
  }) => {
    const problems = await watch(page);
    if (user) await login(page, user);
    problems.length = 0; // only count the page under test
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    if (await page.locator("#map").count()) {
      await page.waitForFunction(() => document.querySelector("#map canvas"));
    }
    expect(problems).toEqual([]);
  });
}

test("self-hosted Plus Jakarta Sans loads", async ({ page }) => {
  const problems = await watch(page);
  await page.goto("/login");
  const loaded = await page.evaluate(async () => {
    const faces = await document.fonts.load('16px "Plus Jakarta Sans"');
    return faces.length > 0 && document.fonts.check('16px "Plus Jakarta Sans"');
  });
  expect(loaded).toBe(true);
  expect(problems).toEqual([]);
});

// ---------- Show page calendar ----------
const dayCell = (page, ymd) =>
  page.evaluateHandle((ymd) => {
    const fp = document.querySelector("#date-range")._flatpickr;
    return [...document.querySelectorAll(".flatpickr-day")].find(
      (el) =>
        !el.classList.contains("prevMonthDay") &&
        fp.formatDate(el.dateObj, "Y-m-d") === ymd,
    );
  }, ymd);

test("booked nights are disabled and cannot be selected", async ({ page }) => {
  await watch(page);
  await login(page, "bob");
  await page.goto(`/listings/${ids.pinned}`);
  for (const night of booked) {
    const cell = (await dayCell(page, night)).asElement();
    expect(await cell.getAttribute("class")).toContain("flatpickr-disabled");
    await cell.click({ force: true });
  }
  const selected = await page.evaluate(
    () => document.querySelector("#date-range")._flatpickr.selectedDates.length,
  );
  expect(selected).toBe(0);
  await expect(page.locator("#reserve-btn")).toBeDisabled();
});

test("reserve stays disabled until a valid range is picked", async ({
  page,
}) => {
  await watch(page);
  await login(page, "bob");
  await page.goto(`/listings/${ids.pinned}`);
  const reserve = page.locator("#reserve-btn");
  await expect(reserve).toBeDisabled();
  await (await dayCell(page, freeRange[0])).asElement().click();
  await expect(reserve).toBeDisabled();
  await (await dayCell(page, freeRange[1])).asElement().click();
  await expect(reserve).toBeEnabled();
  await expect(page.locator("input[name='booking[checkIn]']")).toHaveValue(
    freeRange[0],
  );
  await expect(page.locator("input[name='booking[checkOut]']")).toHaveValue(
    freeRange[1],
  );
  // the CSRF token must survive date picking, and the booking must go through
  await expect(page.locator("#booking-form input[name=_csrf]")).not.toHaveValue(
    freeRange[0],
  );
  await Promise.all([
    page.waitForURL(/\/bookings$/),
    page.locator("#reserve-btn").click(),
  ]);
  await expect(page.getByText("Booking confirmed!")).toBeVisible();
});

// ---------- Location picker ----------
const mapLoaded = (page) =>
  page.waitForFunction(() => {
    const canvas = document.querySelector("#map canvas");
    return canvas && canvas.width > 0;
  });

for (const path of ["/listings/new", `/listings/${ids.pinned}/edit`]) {
  test(`clicking the map fills lat/lng on ${path}`, async ({ page }) => {
    await watch(page);
    await login(page, "alice");
    await page.goto(path);
    await mapLoaded(page);
    await page.waitForTimeout(500);
    await page.locator("#map canvas").click({ position: { x: 120, y: 90 } });
    await expect(page.locator("#lat")).not.toHaveValue("");
    await expect(page.locator("#lng")).not.toHaveValue("");
    await expect(page.locator(".mapboxgl-marker")).toHaveCount(1);
  });
}

test("editing the address clears the pin and saving re-geocodes", async ({
  page,
}) => {
  await watch(page);
  // The client-side lookup finds nothing, so only the server's geocode sets the point
  await page.route("**/listings/geocode?**", (route) =>
    route.fulfill({ json: { coordinates: null } }),
  );
  await login(page, "alice");
  await page.goto(`/listings/${ids.pinned}/edit`);
  await mapLoaded(page);
  await expect(page.locator("#lat")).toHaveValue("28.65");
  await expect(page.locator(".mapboxgl-marker")).toHaveCount(1);

  await page.fill("#location", "Mumbai");
  await expect(page.locator("#lat")).toHaveValue("");
  await expect(page.locator("#lng")).toHaveValue("");
  await expect(page.locator(".mapboxgl-marker")).toHaveCount(0);

  await Promise.all([
    page.waitForURL(new RegExp(`/listings/${ids.pinned}$`)),
    page.click("form[action*='_method=PUT'] button[type=submit]"),
  ]);
  await expect(page.locator("#map")).toHaveAttribute("data-lng", "72.87");
  await expect(page.locator("#map")).toHaveAttribute("data-lat", "19.07");
});

// ---------- Star rating keyboard access ----------
test("star radios are reachable with Tab and selectable from the keyboard", async ({
  page,
}) => {
  await watch(page);
  await login(page, "bob");
  await page.goto(`/listings/${ids.pinned}`);
  let reached = false;
  for (let i = 0; i < 80 && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate(
      () => document.activeElement?.name === "review[rating]",
    );
  }
  expect(reached).toBe(true);
  await page.keyboard.press("Space");
  const first = await page.evaluate(
    () => document.querySelector("input[name='review[rating]']:checked")?.value,
  );
  expect(first).toBeTruthy();
  await page.keyboard.press("ArrowRight");
  const second = await page.evaluate(
    () => document.querySelector("input[name='review[rating]']:checked")?.value,
  );
  expect(second).toBeTruthy();
  expect(second).not.toBe(first);
  // focus is visible on the matching label
  const outline = await page.evaluate(
    () =>
      getComputedStyle(
        document.querySelector(`label[for='${document.activeElement.id}']`),
      ).outlineStyle,
  );
  expect(outline).toBe("solid");
});

// ---------- Confirm dialogs ----------
const declineAndCheck = async (page, button) => {
  const writes = [];
  page.on("request", (req) => {
    // only writes to the app count; Mapbox telemetry POSTs are irrelevant
    if (req.method() !== "GET" && req.url().startsWith("http://127.0.0.1"))
      writes.push(req.url());
  });
  let message;
  page.once("dialog", (dialog) => {
    message = dialog.message();
    dialog.dismiss();
  });
  await button.click();
  await page.waitForTimeout(300);
  expect(message).toBeTruthy();
  expect(writes).toEqual([]);
  return message;
};

test("declining the delete-listing confirm keeps the listing", async ({
  page,
}) => {
  await watch(page);
  await login(page, "alice");
  await page.goto(`/listings/${ids.pinned}`);
  const msg = await declineAndCheck(
    page,
    page.getByRole("button", { name: /Delete Listing/ }),
  );
  expect(msg).toContain("delete this listing");
  expect((await page.goto(`/listings/${ids.pinned}`)).status()).toBe(200);
});

test("declining the cancel-booking confirm keeps the booking", async ({
  page,
}) => {
  await watch(page);
  await login(page, "bob");
  await page.goto("/bookings");
  const msg = await declineAndCheck(
    page,
    page.getByRole("button", { name: "Cancel" }).first(),
  );
  expect(msg).toBe("Cancel this booking?");
  await page.reload();
  await expect(
    page.locator(".booking-row .badge", { hasText: "cancelled" }),
  ).toHaveCount(0);
});

test("declining the cancel-reservation confirm keeps the reservation", async ({
  page,
}) => {
  await watch(page);
  await login(page, "alice");
  await page.goto(`/listings/${ids.pinned}`);
  const cancels = page
    .locator("#booking-card")
    .getByRole("button", { name: "Cancel" });
  const before = await cancels.count();
  expect(before).toBeGreaterThan(0);
  const msg = await declineAndCheck(
    page,
    page
      .locator("#booking-card")
      .getByRole("button", { name: "Cancel" })
      .first(),
  );
  expect(msg).toBe("Cancel this reservation?");
  await page.reload();
  await expect(cancels).toHaveCount(before);
});
