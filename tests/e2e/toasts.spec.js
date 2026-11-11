// Pop-up notifications: placement, timing, stacking, keyboard and axe, in both themes.
const { test, expect } = require("@playwright/test");
const { AxeBuilder } = require("@axe-core/playwright");
const { PASSWORD } = require("./fixtures");

const login = async (page, username) => {
  await page.goto("/login");
  await page.fill("#username", username);
  await page.fill("#password", PASSWORD);
  await Promise.all([
    page.waitForURL(/\/listings/),
    page.click("form[action='/login'] button[type=submit]"),
  ]);
};
// bob's email is not confirmed, so the reminder pop-up is also there; most tests look at the
// messages of the action itself and close the reminder first
const closeReminder = (page) => page.locator("[data-verify-banner] [data-toast-close]").click();
// Adds copies of the first pop-up, the way a second and third message would arrive
const addCopies = (page, count, type = "success") =>
  page.evaluate(
    ({ count, type }) => {
      const stack = document.querySelector("[data-toasts]");
      const source = stack.querySelector("[data-toast]");
      for (let i = 0; i < count; i++) {
        const copy = source.cloneNode(true);
        delete copy.dataset.wired;
        copy.querySelector(".wl-toast__text").textContent = `Copy ${i + 1}`;
        copy.className = `wl-auth-alert wl-auth-alert--${type} wl-toast`;
        if (type === "error") {
          copy.setAttribute("role", "alert");
          copy.removeAttribute("data-autodismiss");
        }
        copy.hidden = false;
        stack.appendChild(copy);
      }
    },
    { count, type },
  );
const visibleToasts = (page) => page.locator("[data-toast]:not([hidden])");

test("the email reminder floats over the page, takes no room, and goes away by itself", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page, "bob");
  const reminder = page.locator("[data-verify-banner]");
  await expect(reminder).toBeVisible();
  expect(await page.locator(".wl-toasts").evaluate((el) => getComputedStyle(el).position)).toBe("fixed");
  const hero = page.locator(".wl-hero-section");
  const withIt = (await hero.boundingBox()).y;
  await closeReminder(page);
  await expect(reminder).toHaveCount(0);
  // The page did not move when the reminder left, so it never pushed anything down
  expect((await hero.boundingBox()).y).toBe(withIt);
  // And it closes itself: back on the next page, gone after five seconds
  await page.goto("/help");
  await expect(page.locator("[data-verify-banner]")).toBeVisible();
  await expect(page.locator("[data-verify-banner]")).toHaveCount(0, { timeout: 9000 });
});

test("a success floats at the top centre on a laptop and closes itself after 5 seconds", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page, "bob");
  await closeReminder(page);
  await page.mouse.move(5, 5); // the sign-in click left the mouse where the toast now floats, and hover pauses it
  const toast = page.locator(".wl-toast");
  await expect(toast).toBeVisible();
  const box = await toast.boundingBox();
  // Top centre, narrow enough to leave the controls on either side free
  expect(Math.abs(box.x + box.width / 2 - 640)).toBeLessThan(4);
  expect(box.y).toBeLessThan(80);
  expect(box.y).toBeGreaterThanOrEqual(0);
  await page.waitForTimeout(3500);
  await expect(toast).toBeVisible();
  await expect(toast).toHaveCount(0, { timeout: 3000 });
});

test("on a phone it is top-centre without overflowing", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await login(page, "bob");
  await closeReminder(page);
  await page.locator(".wl-toast").hover(); // pauses the timer so a slow run cannot measure a closed toast
  const box = await page.locator(".wl-toast").boundingBox();
  expect(Math.abs(box.x + box.width / 2 - 187.5)).toBeLessThan(4);
  expect(box.y).toBeLessThan(80);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(375);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});

test("hovering and focusing pause the timer", async ({ page }) => {
  await login(page, "bob");
  await closeReminder(page);
  const toast = page.locator(".wl-toast");
  await toast.hover();
  await page.waitForTimeout(6600);
  await expect(toast).toBeVisible();
  await page.mouse.move(0, 400);
  await expect(toast).toHaveCount(0, { timeout: 8000 });

  await login(page, "bob");
  await closeReminder(page);
  await page.locator(".wl-toast [data-toast-close]").focus();
  await page.waitForTimeout(6600);
  await expect(page.locator(".wl-toast")).toBeVisible();
});

test("errors persist, close with a 44px button, and focus is never moved to them", async ({ page }) => {
  await login(page, "bob");
  await page.goto("/listings/507f1f77bcf86cd799439011");
  await closeReminder(page);
  const error = page.locator(".wl-toast.wl-auth-alert--error");
  await expect(error).toBeVisible();
  await expect(error).toHaveAttribute("role", "alert");
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  await page.waitForTimeout(6600);
  await expect(error).toBeVisible();
  const close = error.getByRole("button", { name: "Dismiss notification" });
  const box = await close.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await close.click();
  await expect(error).toHaveCount(0);
});

test("Escape closes the most recent pop-up first", async ({ page }) => {
  await login(page, "bob");
  await closeReminder(page);
  await addCopies(page, 1, "error");
  await expect(visibleToasts(page)).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(visibleToasts(page)).toHaveCount(1);
  await expect(page.locator(".wl-toast__text", { hasText: "Copy 1" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(visibleToasts(page)).toHaveCount(0);
});

test("at most three are visible; the others wait and appear as room opens", async ({ page }) => {
  await login(page, "bob");
  await closeReminder(page);
  await addCopies(page, 4, "error");
  await expect(visibleToasts(page)).toHaveCount(3);
  await expect(page.locator("[data-toast]")).toHaveCount(5);
  await visibleToasts(page).first().locator("[data-toast-close]").click();
  await expect(visibleToasts(page)).toHaveCount(3);
  await expect(page.locator("[data-toast]")).toHaveCount(4);
});

for (const colorScheme of ["light", "dark"]) {
  test(`axe passes with pop-ups open (${colorScheme}), and they stay readable`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await login(page, "bob");
    await closeReminder(page);
    await addCopies(page, 2, "error");
    await expect(visibleToasts(page)).toHaveCount(3);
    await page.locator("[data-toast]").first().hover(); // keeps the success open while axe runs
    const { violations } = await new AxeBuilder({ page }).include(".wl-toasts").analyze();
    const serious = violations
      .filter((v) => ["serious", "critical"].includes(v.impact))
      .map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
    expect(serious).toEqual([]);
    const whole = await new AxeBuilder({ page }).exclude(".mapboxgl-map").analyze();
    expect(whole.violations.filter((v) => ["serious", "critical"].includes(v.impact)).map((v) => v.id)).toEqual([]);
    await page.screenshot({ path: `tests/e2e/__screenshots__/toasts-${colorScheme}.png` });
  });
}

test("no console errors or CSP violations while pop-ups show", async ({ page }) => {
  const problems = [];
  page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && problems.push(m.text()));
  page.on("pageerror", (e) => problems.push(String(e)));
  await login(page, "bob");
  await closeReminder(page);
  await addCopies(page, 2, "error");
  await page.keyboard.press("Escape");
  expect(problems).toEqual([]);
});
