const fs = require("fs");
const path = require("path");

const css = fs.readFileSync(path.join(__dirname, "../../public/css/style.css"), "utf8");
const rule = (selector) =>
  new RegExp(`(?:^|\\n)${selector.replace(/\./g, "\\.")}\\s*\\{([^}]*)\\}`).exec(css)[1];

describe("sticky sidebar", () => {
  test("sidebar inner is sticky, full height and scrolls on its own", () => {
    const body = rule(".wl-sidebar-inner");
    expect(body).toMatch(/position:\s*sticky/);
    expect(body).toMatch(/top:\s*0/);
    expect(body).toMatch(/height:\s*100vh/);
    expect(body).toMatch(/overflow-y:\s*auto/);
  });

  test.each([".wl-app-shell", ".wl-main-canvas"])(
    "%s does not become a scroll container (that breaks sticky)",
    (selector) => {
      expect(rule(selector)).not.toMatch(/overflow(-x|-y)?:\s*(hidden|auto|scroll)/);
    },
  );
});
