// End-to-end checks for the launch work: request flow, price display, gallery, account.
const { test, expect } = require("@playwright/test");
const { PASSWORD, ids, day } = require("./fixtures");

test.beforeEach(async ({ page }) => {
  await page.route("https://api.mapbox.com/**", (route) => {
    const url = route.request().url();
    if (url.includes("/mapbox-gl-js/")) return route.continue();
    return route.fulfill({ status: 200, body: "{}" });
  });
  await page.route("https://events.mapbox.com/**", (route) =>
    route.fulfill({ status: 204 }),
  );
});

// Login starts in the account's starting mode (guest here); `mode` then switches in the header
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

const pick = (page, ymd) =>
  page.evaluateHandle((date) => {
    const picker = document.querySelector("#date-range")._flatpickr;
    picker.jumpToDate(date);
    return [...document.querySelectorAll(".flatpickr-day")].find(
      (el) =>
        !el.classList.contains("prevMonthDay") &&
        picker.formatDate(el.dateObj, "Y-m-d") === date,
    );
  }, ymd);

test("the summary and the breakdown use the listing's currency and the same total", async ({ page }) => {
  await login(page, "bob");
  await page.goto(`/listings/${ids.pinned}`);
  await expect(page.locator(".wl-stay__price")).toContainText("₹1,500");
  await (await pick(page, day(60))).asElement().click();
  await (await pick(page, day(63))).asElement().click();
  await expect(page.locator("#booking-summary")).toHaveText("3 nights · ₹4,500");
  await expect(page.locator(".wl-breakdown__total")).toContainText("₹4,500");
  await expect(page.locator("#booking-card")).toContainText("pay at the property");
  await expect(page.locator("#booking-card")).toContainText("Taxes are not included");
  await expect(page.locator("#booking-guests option")).toHaveCount(4);
});

test("the host sees the request first and can open it", async ({ page }) => {
  await login(page, "alice", "host");
  await page.goto("/bookings/hosting");
  const request = page.locator("[data-request]").first();
  await expect(request).toContainText("We would arrive in the evening.");
  await expect(request.getByRole("button", { name: "Accept" })).toBeVisible();
  await expect(page.locator(".wl-stat")).toHaveCount(4);
  await request.locator(".wl-row__title").click();
  await expect(page.getByRole("button", { name: "Accept" })).toBeVisible();
});

test("the email reminder pop-up can be closed, and is back on the next page", async ({ page }) => {
  await login(page, "bob");
  await page.goto("/wishlist");
  const banner = page.locator("[data-verify-banner]");
  await expect(banner).toBeVisible();
  await banner.locator("[data-toast-close]").click();
  await expect(banner).toHaveCount(0);
  await page.goto("/help");
  await expect(page.locator("[data-verify-banner]")).toBeVisible();
});

test("help answers open from the keyboard", async ({ page }) => {
  await page.goto("/help");
  const first = page.locator("details.wl-disclosure summary").first();
  await first.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("details.wl-disclosure").first()).toHaveAttribute("open", "");
});

test("the contact form explains problems beside the field without leaving the page", async ({ page }) => {
  await page.goto("/contact");
  await page.click("form[action='/contact'] button[type=submit]");
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.locator("#name-error")).toBeVisible();
  await expect(page.locator("#topic-error")).toBeVisible();
  await expect(page.locator("#message")).toHaveAttribute("aria-invalid", "true");
});

test("signup asks for the agreement beside the box", async ({ page }) => {
  await page.goto("/signup");
  await page.fill("#username", "newperson");
  await page.fill("#email", "newperson@example.com");
  await page.fill("#password", "Goodpass123!");
  await page.locator("input[name=startingMode][value=guest]").check();
  await page.click("form[action='/signup'] button[type=submit]");
  await expect(page.locator("#terms-error")).toBeVisible();
  await expect(page).toHaveURL(/\/signup$/);
});
