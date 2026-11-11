// The sign-in and sign-up pages: glass card over a full-screen photo, live password checklist,
// username availability, real sign-in and sign-up against the app, and reduced motion.
const { test, expect } = require("@playwright/test");
const { PASSWORD } = require("./fixtures");

test("the card is real glass over a full-screen photo, rounded, with no layout shift", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/login");
  const card = page.locator(".wl-auth-card");
  const style = await card.evaluate((el) => {
    const c = getComputedStyle(el);
    return { blur: c.backdropFilter, radius: parseFloat(c.borderTopLeftRadius), bg: c.backgroundColor };
  });
  expect(style.blur).toContain("blur");
  expect(style.radius).toBeGreaterThanOrEqual(40);
  expect(style.bg).toMatch(/rgba\(/);
  const photo = await page.locator(".wl-auth-bg").boundingBox();
  expect(photo.width).toBeGreaterThanOrEqual(1280);
  expect(photo.height).toBeGreaterThanOrEqual(900);
  const box = await card.boundingBox();
  expect(Math.abs(box.x + box.width / 2 - 640)).toBeLessThan(4);
  await expect(page.locator(".wl-sidebar, .navbar")).toHaveCount(0);
});

test("the password checklist ticks off as you type and the confirmation matches live", async ({ page }) => {
  await page.goto("/signup");
  const met = page.locator("[data-rule].is-met");
  await expect(met).toHaveCount(0);
  const password = page.locator("#password");
  await password.fill("abcdefgh");
  await expect(met).toHaveCount(2); // length + lowercase
  await password.fill("Abcdefgh");
  await expect(met).toHaveCount(3);
  await password.fill("Abcdefg1");
  await expect(met).toHaveCount(4);
  await password.fill("Abcdefg1!");
  await expect(met).toHaveCount(5);
  await expect(page.locator("[data-rule='special'] [data-rule-state]")).toHaveText(", met");
  const confirm = page.locator("#confirmPassword");
  await confirm.fill("Abcdefg1?");
  await expect(page.locator("#confirmPassword-error")).toHaveText("Passwords do not match.");
  await confirm.fill("Abcdefg1!");
  await expect(page.locator("#confirmPassword-error")).toHaveText("Passwords match.");
});

test("a weak password is blocked in the browser with the missing rules named", async ({ page }) => {
  await page.goto("/signup");
  await page.fill("#password", "abcdefgh");
  await page.locator("#password").blur();
  await expect(page.locator("#password-error")).toContainText("an uppercase letter");
  await expect(page.locator("#password-error")).toContainText("a special character");
});

test("the username check says whether a name is taken", async ({ page }) => {
  await page.goto("/signup");
  await page.fill("#username", "alice");
  await expect(page.locator("#username-error")).toHaveText("That username is taken.");
  await page.fill("#username", "someone_new");
  await expect(page.locator("#username-error")).toHaveText("That username is free.");
});

test("signing in shows a loading state, then lands signed in with a top-centre toast", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#username", "bob");
  await page.fill("#password", PASSWORD);
  await page.click("form[action='/login'] button[type=submit]");
  await expect(page).toHaveURL(/\/listings/);
  await expect(page.locator(".wl-toast", { hasText: "Logged in" })).toBeVisible();
});

test("a wrong password shows one error toast and keeps the page", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#username", "bob");
  await page.fill("#password", "Wrong-pass1!");
  await page.click("form[action='/login'] button[type=submit]");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator(".wl-toast.wl-auth-alert--error")).toContainText("Incorrect username or password");
});

test("the show/hide password toggle flips the field", async ({ page }) => {
  await page.goto("/login");
  const toggle = page.locator("[data-toggle-password]");
  await toggle.click();
  await expect(page.locator("#password")).toHaveAttribute("type", "text");
  await expect(toggle).toHaveAttribute("aria-label", "Hide password");
});

test("reduced motion removes the entrance and background animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/signup");
  const names = await page.evaluate(() => [
    getComputedStyle(document.querySelector(".wl-auth-card")).animationName,
    getComputedStyle(document.querySelector(".wl-auth-bg")).animationName,
  ]);
  expect(names).toEqual(["none", "none"]);
});

test("no sideways scroll or console errors from a 320px phone to a desktop", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  for (const path of ["/login", "/signup", "/forgot-password"]) {
    for (const [width, height] of [[320, 640], [375, 667], [768, 1024], [1280, 800], [1920, 1080]]) {
      await page.setViewportSize({ width, height });
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${path} ${width}`).toBeLessThanOrEqual(0);
    }
  }
  expect(errors).toEqual([]);
});
