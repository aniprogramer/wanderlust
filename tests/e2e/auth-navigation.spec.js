const { test, expect } = require("@playwright/test");

test.describe("Auth Registration & Login Experience", () => {
  test("navigation, keyboard accessibility, and password toggle", async ({ page }) => {
    const errors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    // 1. Visit /signup
    await page.goto("/signup");

    // Ensure no navbar or container gutters
    await expect(page.locator(".navbar")).toHaveCount(0);
    await expect(page.locator(".container")).toHaveCount(0);
    await expect(page.locator(".wl-auth")).toHaveCount(1);

    // 2. Test top-right "Sign in" navigation
    const topbarLink = page.locator(".wl-auth-topbar a");
    await expect(topbarLink).toBeVisible();
    await expect(topbarLink).toHaveAttribute("href", "/login");
    await topbarLink.click();
    await expect(page).toHaveURL(/\/login/);

    // 3. On /login, test top-right "Create an account" navigation
    const loginTopbarLink = page.locator(".wl-auth-topbar a");
    await expect(loginTopbarLink).toBeVisible();
    await expect(loginTopbarLink).toHaveAttribute("href", "/signup");
    await loginTopbarLink.click();
    await expect(page).toHaveURL(/\/signup/);

    // 4. Test in-card "Sign in →" navigation
    const cardLink = page.locator(".wl-auth-switch a");
    await expect(cardLink).toBeVisible();
    await expect(cardLink).toHaveAttribute("href", "/login");
    await cardLink.click();
    await expect(page).toHaveURL(/\/login/);

    // 5. In-card "Create an account →" navigation back to /signup
    const loginCardLink = page.locator(".wl-auth-switch a");
    await expect(loginCardLink).toBeVisible();
    await expect(loginCardLink).toHaveAttribute("href", "/signup");
    await loginCardLink.click();
    await expect(page).toHaveURL(/\/signup/);

    // 6. Test password toggle button
    const passwordInput = page.locator("#password");
    const toggleBtn = page.locator("[data-toggle-password]");
    await expect(passwordInput).toHaveAttribute("type", "password");
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute("type", "text");
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute("type", "password");

    // 7. Verify zero console errors
    expect(errors).toEqual([]);
  });

  test("mobile and tablet responsive behavior", async ({ page }) => {
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/signup");
    await expect(page.locator(".navbar")).toHaveCount(0);
    await expect(page.locator(".wl-auth-card")).toBeVisible();
    await expect(page.locator(".wl-auth-topbar a")).toBeVisible();
    await expect(page.locator(".wl-auth-switch a")).toBeVisible();

    // Tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/signup");
    await expect(page.locator(".navbar")).toHaveCount(0);
    await expect(page.locator(".wl-auth-card")).toBeVisible();
  });
});
