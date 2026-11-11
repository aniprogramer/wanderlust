const fs = require("fs");
const path = require("path");

const css = fs.readFileSync(path.join(__dirname, "../../public/css/style.css"), "utf8");
const rule = (selector) =>
  new RegExp(`(?:^|\\n)${selector.replace(/\./g, "\\.")}\\s*\\{([^}]*)\\}`).exec(css)[1];

describe("floating navigation rail", () => {
  test("the rail is fixed over the page, so it reserves no layout column", () => {
    const body = rule(".wl-sidebar");
    expect(body).toMatch(/position:\s*fixed/);
    expect(body).toMatch(/z-index:\s*var\(--z-rail\)/);
    expect(rule(".wl-app-shell")).toMatch(/display:\s*block/);
    expect(rule(".wl-app-shell")).not.toMatch(/grid-template-columns/);
  });

  test("the main canvas runs the full width", () => {
    expect(rule(".wl-main-canvas")).toMatch(/width:\s*100%/);
  });

  test.each([".wl-app-shell", ".wl-main-canvas"])(
    "%s does not become a scroll container",
    (selector) => {
      expect(rule(selector)).not.toMatch(/overflow(-x|-y)?:\s*(hidden|auto|scroll)/);
    },
  );
});
