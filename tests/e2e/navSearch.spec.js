const { test, expect } = require("@playwright/test");

// The header search on pages outside home: the Search button sits inside the pill with an even inset
for (const width of [1440, 1200]) {
  test(`header search button sits inside the pill at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/help");
    const pill = await page.locator(".wl-navsearch").boundingBox();
    const btn = await page.locator(".wl-navsearch__btn").boundingBox();
    expect(btn.y).toBeGreaterThan(pill.y);
    expect(btn.y + btn.height).toBeLessThan(pill.y + pill.height);
    expect(pill.x + pill.width - (btn.x + btn.width)).toBeGreaterThanOrEqual(4);
    // Even inset: top and bottom gaps match
    expect(Math.abs(btn.y - pill.y - (pill.y + pill.height - btn.y - btn.height))).toBeLessThanOrEqual(1);
  });
}

for (const width of [320, 375]) {
  test(`header search fits the phone menu at ${width}px and searches`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/help");
    await page.getByRole("button", { name: "Menu" }).click();
    const pill = page.locator(".wl-navsearch");
    await expect(pill).toBeVisible();
    const box = await pill.boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect((await page.locator(".wl-navsearch__btn").boundingBox()).height).toBeGreaterThanOrEqual(44);
    await page.locator(".wl-navsearch__input").fill("Delhi");
    await page.locator(".wl-navsearch__input").press("Enter");
    await expect(page).toHaveURL(/\/listings\?q=Delhi$/);
  });
}
