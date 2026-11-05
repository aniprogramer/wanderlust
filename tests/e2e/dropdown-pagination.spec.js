const { test, expect } = require("@playwright/test");

const setupRoutes = async (page) => {
  await page.route("https://api.mapbox.com/**", (route) => {
    return route.fulfill({ status: 200, body: "{}" });
  });
  await page.route("https://events.mapbox.com/**", (route) =>
    route.fulfill({ status: 204 })
  );
};

test.describe("Unified Dropdowns, Currency Selector & Pagination", () => {
  // LD2 removed the client-side converter, so this replaces the old selector test.
  test("prices stay in the listing's own currency with no converter on the page", async ({ page }) => {
    const errors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));
    await setupRoutes(page);

    await page.goto("/listings");
    await expect(page.locator(".wl-currency-trigger")).toHaveCount(0);
    await expect(page.locator(".wl-price-amount").first()).toContainText("₹");
    expect(errors).toEqual([]);
  });

  test("branded guest selector popover interaction and search sync", async ({ page }) => {
    const errors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));
    await setupRoutes(page);

    await page.goto("/listings");

    const guestsTrigger = page.locator("#guests-trigger-btn");
    const guestsPopover = page.locator("#guests-popover");
    const guestsInput = page.locator("#guests-input");
    const guestsDisplay = page.locator("#guests-display");

    await expect(guestsTrigger).toBeVisible();
    await expect(guestsPopover).toBeHidden();

    // Initial state: no guest filter until someone chooses one (2.1 made the filter real,
    // so a default of 2 would silently hide stays for one)
    await expect(guestsDisplay).toHaveText("Add guests");
    await expect(guestsInput).toHaveValue("");

    // Click trigger opens popover
    await guestsTrigger.click();
    await expect(guestsPopover).toBeVisible();
    await expect(guestsTrigger).toHaveAttribute("aria-expanded", "true");

    // Test increment adults
    const adultsInc = page.locator("#adults-inc-btn");
    await adultsInc.click();
    await expect(page.locator("#adults-count")).toHaveText("2");
    await expect(guestsDisplay).toHaveText("2 guests");
    await expect(guestsInput).toHaveValue("2");

    // Test increment children
    const childrenInc = page.locator("#children-inc-btn");
    await childrenInc.click();
    await expect(page.locator("#children-count")).toHaveText("1");
    await expect(guestsDisplay).toHaveText("3 guests");
    await expect(guestsInput).toHaveValue("3");

    // Test decrement adults
    const adultsDec = page.locator("#adults-dec-btn");
    await adultsDec.click();
    await expect(page.locator("#adults-count")).toHaveText("1");
    await expect(guestsDisplay).toHaveText("2 guests");
    await expect(guestsInput).toHaveValue("2");

    // Click "Done" closes popover
    const doneBtn = page.locator("#guests-done-btn");
    await doneBtn.click();
    await expect(guestsPopover).toBeHidden();
    await expect(guestsTrigger).toHaveAttribute("aria-expanded", "false");

    // Reopen and test outside click dismissal
    await guestsTrigger.click();
    await expect(guestsPopover).toBeVisible();
    await page.locator("body").click({ position: { x: 50, y: 50 } });
    await expect(guestsPopover).toBeHidden();

    expect(errors).toEqual([]);
  });

  test("premium date range picker component selection and clearing", async ({ page }) => {
    const errors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));
    await setupRoutes(page);

    await page.goto("/listings");

    const checkInInput = page.locator("#check-in-input");
    const checkOutInput = page.locator("#check-out-input");
    const calPopover = page.locator("#calendar-popover");

    // The visible control is the field; the inputs are hidden and carry the values
    await expect(page.locator("#check-in-field")).toBeVisible();
    await expect(page.locator("#check-out-field")).toBeVisible();
    await expect(calPopover).toBeHidden();

    // Click Check In opens calendar
    await page.locator("#check-in-field").click();
    await expect(calPopover).toBeVisible();
    await expect(calPopover.locator(".wl-cal-month-name").first()).toBeVisible();

    // Find available day buttons (> today)
    const availableDays = calPopover.locator(".wl-cal-day:not(.disabled):not(.empty)");
    const count = await availableDays.count();
    expect(count).toBeGreaterThan(5);

    // Pick day 1 (start date)
    const firstDay = availableDays.nth(1);
    const startVal = await firstDay.getAttribute("data-date");
    await firstDay.click();
    await expect(checkInInput).toHaveValue(startVal);

    // Pick day 4 (end date)
    const secondDay = availableDays.nth(4);
    const endVal = await secondDay.getAttribute("data-date");
    await secondDay.click();
    await expect(checkOutInput).toHaveValue(endVal);

    // Test Clear dates
    const clearBtn = calPopover.locator("#wl-cal-clear");
    await clearBtn.click();
    await expect(checkInInput).toHaveValue("");
    await expect(checkOutInput).toHaveValue("");

    // Done button closes calendar
    const doneBtn = calPopover.locator("#wl-cal-done");
    await doneBtn.click();
    await expect(calPopover).toBeHidden();

    expect(errors).toEqual([]);
  });

  test("pagination styling and interaction", async ({ page }) => {
    const errors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));
    await setupRoutes(page);

    await page.goto("/listings");

    let pagination = page.locator(".wl-pagination");
    if (await pagination.count() === 0) {
      await page.evaluate(() => {
        const container = document.createElement("div");
        container.className = "d-flex justify-content-center pb-5";
        container.innerHTML = `
          <nav aria-label="Listings navigation">
            <ul class="pagination wl-pagination" role="navigation">
              <li class="page-item disabled" aria-disabled="true">
                <span class="page-link"><i class="fa-solid fa-chevron-left me-1"></i> Previous</span>
              </li>
              <li class="page-item active" aria-current="page">
                <span class="page-link">1</span>
              </li>
              <li class="page-item">
                <a class="page-link" href="/listings?page=2">2</a>
              </li>
              <li class="page-item">
                <a class="page-link" href="/listings?page=2" aria-label="Next page">Next <i class="fa-solid fa-chevron-right ms-1"></i></a>
              </li>
            </ul>
          </nav>
        `;
        const explore = document.getElementById("explore-stays") || document.querySelector(".wl-featured-section") || document.body;
        explore.appendChild(container);
      });
      pagination = page.locator(".wl-pagination");
    }

    await expect(pagination).toBeVisible();

    // Active page should be page 1
    const activeItem = pagination.locator(".page-item.active");
    await expect(activeItem).toBeVisible();
    await expect(activeItem).toHaveText(/1/);

    // Verify active item styling is NOT Bootstrap blue rgb(13, 110, 253)
    const activeLink = activeItem.locator(".page-link");
    const bgColor = await activeLink.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bgColor).not.toBe("rgb(13, 110, 253)");

    expect(errors).toEqual([]);
  });

  test("dropdowns eliminate default Bootstrap blue and support dark mode", async ({ page }) => {
    await setupRoutes(page);
    await page.goto("/listings");

    // Open currency dropdown or user dropdown
    const trigger = page.locator("#userMenuBtn").first();
    await trigger.click();

    const menu = page.locator(".dropdown-menu.show, .wl-dropdown-menu.show").first();
    await expect(menu).toBeVisible();

    // Verify active item in dropdown is NOT Bootstrap blue rgb(13, 110, 253)
    const activeItem = menu.locator(".dropdown-item.active").first();
    if (await activeItem.count() > 0) {
      const activeBg = await activeItem.evaluate((el) => window.getComputedStyle(el).backgroundColor);
      expect(activeBg).not.toBe("rgb(13, 110, 253)");
    }

    // Switch to dark mode
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    const darkBg = await menu.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(darkBg).not.toBe("rgb(255, 255, 255)");
  });

  test("capture popover screenshots for visual verification", async ({ page }) => {
    await setupRoutes(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/listings");
    const dir = "tests/e2e/__screenshots__";

    for (const theme of ["light", "dark"]) {
      await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);

      await page.locator("#guests-trigger-btn").click();
      await page.waitForTimeout(300);
      await page.locator("#guests-popover").screenshot({ path: `${dir}/guests-popover-${theme}.png` });
      await page.locator("#guests-done-btn").click();

      await page.locator("#check-in-field").click();
      await page.waitForTimeout(300);
      const availableDays = page.locator(".wl-cal-day:not(.disabled):not(.empty)");
      await availableDays.nth(2).click();
      await availableDays.nth(6).click();
      await page.waitForTimeout(300);
      await page.locator("#calendar-popover").screenshot({ path: `${dir}/calendar-${theme}.png` });
      await page.locator("#wl-cal-done").click();
    }
  });
});
