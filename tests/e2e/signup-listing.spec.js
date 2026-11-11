// Sign-up mode choice and the listing form in a real browser: both themes, three widths, the
// keyboard, the Content Security Policy and axe.
const path = require("path");
const fs = require("fs");
const os = require("os");
const { test, expect } = require("@playwright/test");
const { AxeBuilder } = require("@axe-core/playwright");
const { PASSWORD, ids } = require("./fixtures");

const WIDTHS = [375, 768, 1280];
const THEMES = ["light", "dark"];
const SHOTS = path.join(__dirname, "__screenshots__");
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==",
  "base64",
);

// Collects console errors, page errors and CSP violations; the outside world is stubbed
const watch = async (page) => {
  const problems = [];
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      console.error(`CSP: ${e.violatedDirective} blocked ${e.blockedURI || "inline"}`);
    });
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") problems.push(msg.text());
  });
  page.on("pageerror", (err) => problems.push(err.message));
  await page.route("https://api.mapbox.com/**", (route) =>
    route.request().url().includes("/styles/")
      ? route.fulfill({ json: { version: 8, sources: {}, layers: [] } })
      : route.fulfill({ status: 200, body: "{}" }),
  );
  await page.route("https://events.mapbox.com/**", (route) => route.fulfill({ status: 204 }));
  await page.route("https://images.unsplash.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PIXEL }),
  );
  return problems;
};

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

const noSidewaysScroll = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

const axeSerious = async (page) => {
  const { violations } = await new AxeBuilder({ page }).exclude(".mapboxgl-map").analyze();
  return violations
    .filter((v) => ["serious", "critical"].includes(v.impact))
    .map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
};

test.describe("sign-up", () => {
  const fill = async (page, username) => {
    await page.goto("/signup");
    await page.fill("#firstName", "New");
    await page.fill("#lastName", "Person");
    await page.fill("#username", username);
    await page.fill("#email", `${username}@example.com`);
    await page.fill("#password", "Goodpass123!");
    await page.fill("#confirmPassword", "Goodpass123!");
    await page.check("#terms");
  };

  for (const [choice, label, home] of [
    ["host", "Host stays", /\/listings\/mine$/],
    ["guest", "Find stays", /\/listings$/],
  ]) {
    test(`signing up to "${label}" starts as a ${choice}`, async ({ page }) => {
      const problems = await watch(page);
      await fill(page, `new${choice}`);
      await page.locator(".wl-segmented__option", { hasText: label }).click();
      await expect(page.locator(`input[name=startingMode][value=${choice}]`)).toBeChecked();
      await Promise.all([
        page.waitForURL(home),
        page.click("form[action='/signup'] button[type=submit]"),
      ]);
      await expect(page.locator(".wl-mode-switch").first()).toHaveAttribute("data-mode", choice);
      expect(problems).toEqual([]);
    });
  }

  test("nothing is chosen for you, and leaving it empty is explained beside the group", async ({ page }) => {
    await watch(page);
    await fill(page, "undecided");
    await expect(page.locator("input[name=startingMode]:checked")).toHaveCount(0);
    await page.click("form[action='/signup'] button[type=submit]");
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.locator("#startingMode-error")).toBeVisible();
    await expect(page.locator("input[name=startingMode]").first()).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.locator("#startingMode-error")).toBeHidden();
  });

  test("the login page offers no mode choice", async ({ page }) => {
    await watch(page);
    await page.goto("/login");
    await expect(page.locator("input[name=mode]")).toHaveCount(0);
    await expect(page.getByText("Continue as")).toHaveCount(0);
  });

  for (const width of WIDTHS) {
    test(`the choice fits at ${width}px, in both themes`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await watch(page);
      for (const colorScheme of THEMES) {
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        await page.goto("/signup");
        expect(await noSidewaysScroll(page)).toBe(true);
        await page.screenshot({ path: path.join(SHOTS, `signup-choice-${width}-${colorScheme}.png`), fullPage: true });
      }
    });
  }
});

test.describe("the listing form", () => {
  for (const width of WIDTHS) {
    for (const colorScheme of THEMES) {
      test(`fits at ${width}px in ${colorScheme}, with no console or CSP errors`, async ({ page }) => {
        test.setTimeout(60000);
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        const problems = await watch(page);
        await login(page, "alice", "host");
        for (const [name, url] of [["new", "/listings/new"], ["edit", `/listings/${ids.pinned}/edit`]]) {
          await page.goto(url);
          await page.waitForLoadState("load");
          expect(await noSidewaysScroll(page)).toBe(true);
          await page.screenshot({ path: path.join(SHOTS, `form-${name}-${width}-${colorScheme}.png`), fullPage: true });
        }
        expect(problems).toEqual([]);
      });
    }
  }

  test("long checkbox groups are two columns on a tablet and one on a phone", async ({ page }) => {
    await watch(page);
    await login(page, "alice", "host");
    const columns = () =>
      page.locator("#section-amenities .wl-check-cols").first().evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
      );
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto("/listings/new");
    expect(await columns()).toBe(2);
    await page.setViewportSize({ width: 375, height: 800 });
    expect(await columns()).toBe(1);
  });

  test("checkbox groups work from the keyboard, with a visible focus ring", async ({ page }) => {
    await watch(page);
    await login(page, "alice", "host");
    await page.goto("/listings/new");
    await page.locator("#otherRules").focus();
    const wifi = page.locator("#amenity-wifi");
    await page.keyboard.press("Tab");
    await expect(wifi).toBeFocused();
    const ring = await wifi.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(ring).toBe("solid");
    await page.keyboard.press("Space");
    await expect(wifi).toBeChecked();
    await page.keyboard.press("Tab");
    await expect(page.locator("#amenity-kitchen")).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.locator("#amenity-kitchen")).toBeChecked();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Space");
    await expect(wifi).not.toBeChecked();
  });

  test("the cover photo can be chosen from the keyboard", async ({ page }) => {
    await watch(page);
    await login(page, "alice", "host");
    await page.goto(`/listings/${ids.pinned}/edit`);
    const covers = page.locator("input[name=coverImage]");
    await expect(covers).toHaveCount(2);
    await expect(covers.first()).toBeChecked();
    await covers.first().focus();
    await page.keyboard.press("ArrowDown");
    await expect(covers.nth(1)).toBeChecked();
    await expect(covers.nth(1)).toBeFocused();
  });

  test("new photos get a preview, a cover choice and an alt field; six is the limit", async ({ page }) => {
    const problems = await watch(page);
    await login(page, "alice", "host");
    await page.goto("/listings/new");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wl-photos-"));
    const files = Array.from({ length: 7 }, (_, i) => {
      const file = path.join(dir, `${i}.png`);
      fs.writeFileSync(file, PIXEL);
      return file;
    });
    await page.setInputFiles("#img", files.slice(0, 2));
    await expect(page.locator("#new-photo-list li")).toHaveCount(2);
    const covers = page.locator("#new-photo-list input[name=coverImage]");
    await expect(covers.first()).toBeChecked();
    await covers.first().focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator('input[name=coverImage][value="new:1"]')).toBeChecked();
    await expect(page.locator("#new-alt-1")).toHaveAttribute("name", "newAlt[1]");

    await page.setInputFiles("#img", files);
    await expect(page.locator("#photo-note")).toContainText("up to 6");
    fs.rmSync(dir, { recursive: true });
    expect(problems).toEqual([]);
  });

  test("changing the currency changes the words beside the price, and nothing else", async ({ page }) => {
    await watch(page);
    await login(page, "alice", "host");
    await page.goto("/listings/new");
    await page.fill("#price", "1000");
    await page.selectOption("#currency", "USD");
    await expect(page.locator("#price-hint")).toHaveText("In USD.");
    await expect(page.locator("#cleaningFee-hint")).toContainText("USD.");
    await expect(page.locator("#price")).toHaveValue("1000");
  });

  test("a bad publish shows inline errors, focuses the summary and keeps the values", async ({ page }) => {
    const problems = await watch(page);
    await login(page, "alice", "host");
    await page.goto("/listings/new");
    await page.fill("#title", "Short");
    await page.fill("#city", "Kept City");
    await page.check("#amenity-gym");
    await page.click("button[name=intent][value=publish]");
    await expect(page.locator("#form-error")).toBeFocused();
    await expect(page.locator("#title")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#title-error")).toBeVisible();
    await expect(page.locator("#city")).toHaveValue("Kept City");
    await expect(page.locator("#amenity-gym")).toBeChecked();
    expect(await noSidewaysScroll(page)).toBe(true);
    await page.screenshot({ path: path.join(SHOTS, "form-errors.png"), fullPage: true });
    // The 400 itself is what the browser logs here, and it is the expected answer
    expect(problems.filter((text) => !/status of 400/.test(text))).toEqual([]);
    expect(await axeSerious(page)).toEqual([]);
  });

  test("Save as draft keeps the button's choice through the double-submit guard", async ({ page }) => {
    await watch(page);
    await login(page, "alice", "host");
    await page.goto("/listings/new");
    await page.fill("#title", "A draft from the browser");
    await Promise.all([
      page.waitForURL(/\/edit$/),
      page.click("button[name=intent][value=draft]"),
    ]);
    await expect(page.locator(".wl-badge", { hasText: "Draft" }).first()).toBeVisible();
    await expect(page.locator("#title")).toHaveValue("A draft from the browser");
    await page.goto("/listings/mine");
    await expect(page.locator("[data-draft]", { hasText: "A draft from the browser" })).toBeVisible();
    await page.goto("/listings?q=draft");
    await expect(page.locator(".listing-card", { hasText: "A draft from the browser" })).toHaveCount(0);
  });
});

test.describe("the listing page", () => {
  test("the public sees a circle, not a marker; the owner sees the pin", async ({ page }) => {
    const problems = await watch(page);
    await page.goto(`/listings/${ids.pinned}`);
    await page.waitForFunction(() => document.querySelector("#map canvas"));
    await expect(page.locator("#map")).toHaveAttribute("data-radius", "500");
    await expect(page.locator("#map")).not.toHaveAttribute("data-lng", /.+/);
    await expect(page.locator(".mapboxgl-marker")).toHaveCount(0);
    await expect(page.locator("#stay-rules")).toContainText("No smoking");
    await expect(page.getByText("4 Kucha Pati Ram")).toHaveCount(0);
    expect(problems).toEqual([]);

    await login(page, "alice", "host");
    await page.goto(`/listings/${ids.pinned}`);
    // An earlier spec may have moved this pin, so the test asks for a pin, not a place
    await expect(page.locator("#map")).toHaveAttribute("data-lng", /^\d/);
    await expect(page.locator("#map")).not.toHaveAttribute("data-radius", /.+/);
    await expect(page.getByText("4 Kucha Pati Ram")).toBeVisible();
  });

  for (const width of WIDTHS) {
    test(`the terms read before the booking panel at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await watch(page);
      for (const colorScheme of THEMES) {
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        await page.goto(`/listings/${ids.pinned}`);
        expect(await noSidewaysScroll(page)).toBe(true);
        const rules = await page.locator("#stay-rules").boundingBox();
        const panel = await page.locator(".wl-stay__aside").boundingBox();
        expect(rules.y).toBeLessThan(panel.y);
        await page.screenshot({ path: path.join(SHOTS, `stay-terms-${width}-${colorScheme}.png`), fullPage: true });
      }
    });
  }
});

test.describe("axe", () => {
  for (const [name, url, user] of [
    ["sign-up", "/signup", null],
    ["the listing form", "/listings/new", "alice"],
    ["the listing form, editing", `/listings/${ids.pinned}/edit`, "alice"],
    ["the listing page", `/listings/${ids.pinned}`, null],
  ]) {
    test(`${name} has no serious issues in either theme`, async ({ page }) => {
      test.setTimeout(90000);
      await watch(page);
      if (user) await login(page, user, "host");
      for (const colorScheme of THEMES) {
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        await page.goto(url);
        await page.waitForLoadState("load");
        expect({ colorScheme, serious: await axeSerious(page) }).toEqual({ colorScheme, serious: [] });
      }
    });
  }
});
