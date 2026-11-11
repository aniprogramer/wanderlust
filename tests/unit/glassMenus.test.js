const fs = require("fs");
const path = require("path");

const read = (f) => fs.readFileSync(path.join(__dirname, "../..", f), "utf8");
const tokens = read("public/css/tokens.css");
const style = read("public/css/style.css");
const block = (css, selector) =>
  new RegExp(`(?:^|\\n)${selector.replace(/[.]/g, "\\.")}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? "";

describe("liquid glass menus, cards and pagination", () => {
  test("every menu and popover shares one glass surface, including the calendar", () => {
    const rule = /\.dropdown-menu,\s*\.wl-guests-popover,\s*\.wl-calendar-popover\s*\{([^}]*)\}/.exec(tokens)[1];
    expect(rule).toMatch(/background:\s*var\(--glass-bg\)/);
    expect(tokens).toMatch(/\.wl-calendar-popover\s*\{\s*background:\s*var\(--glass-bg-hover\)/);
    expect(rule).toMatch(/backdrop-filter:\s*var\(--glass-backdrop\)/);
    expect(rule).toMatch(/border:\s*1px solid var\(--glass-border\)/);
  });

  test("style.css does not put an opaque fill back on them", () => {
    for (const sel of [".wl-guests-popover", ".wl-calendar-popover", ".dropdown-menu,\n.wl-dropdown-menu"]) {
      expect(block(style, sel)).not.toMatch(/background(-color)?:/);
    }
  });

  test("the calendar corners are rounded by a token that exists", () => {
    expect(block(style, ".wl-calendar-popover")).toMatch(/border-radius:\s*var\(--radius-2xl\)/);
    expect(tokens).toMatch(/--radius-2xl:\s*24px/);
  });

  test("listing cards have a glass border and surface", () => {
    expect(block(tokens, ".wl-listing-card")).toMatch(/border:\s*1px solid var\(--glass-border\)/);
    expect(block(tokens, ".wl-listing-card")).toMatch(/background:\s*var\(--glass-bg-subtle\)/);
  });

  test("pagination is a glass pill with pill-shaped pages", () => {
    expect(block(tokens, ".wl-pagination")).toMatch(/var\(--glass-border\)/);
    expect(style).toMatch(/\.pagination,\s*\.wl-pagination\s*\{[^}]*border-radius:\s*var\(--radius-pill\)/);
  });

  test("opening one popover closes the others", () => {
    const script = read("public/js/script.js");
    const picker = read("public/js/datepicker.js");
    expect(script).toMatch(/wl:popover-open/);
    expect(script).toMatch(/show\.bs\.dropdown/);
    expect(picker).toMatch(/dispatchEvent\(new CustomEvent\("wl:popover-open"/);
    expect(picker).toMatch(/addEventListener\("wl:popover-open"/);
  });
});
