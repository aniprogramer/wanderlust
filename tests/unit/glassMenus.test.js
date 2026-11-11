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

describe("footer", () => {
  const footer = read("views/includes/footer.ejs");
  test("keeps every policy, help and contact link and the brand tagline", () => {
    for (const href of ["/help", "/contact", "/privacy", "/terms", "/cancellation-policy", "/house-rules"])
      expect(footer).toContain(`href="${href}"`);
    expect(footer).toContain("Stays worth the");
  });
  test("sits on the page ground so brass emphasis keeps its contrast", () => {
    expect(block(style, ".f-info")).toMatch(/background-color:\s*var\(--bg\)/);
  });
});

test("menu items are rounded so hover and selected fills have rounded corners", () => {
  expect(block(style, ".dropdown-item,\n.wl-dropdown-item")).toMatch(/border-radius:\s*var\(--radius-lg\)/);
});

describe("responsive details", () => {
  test("narrow phones drop the wordmark from the home header, and small links get a 44px hit area", () => {
    expect(style).toMatch(/@media \(max-width: 380px\)\s*\{\s*\.wl-hero-header \.wl-brand-name\s*\{\s*display:\s*none/);
    expect(style).toMatch(/@media \(max-width: 820px\)\s*\{\s*\.wl-auth-footer__link,\s*\.wl-user-link\s*\{[^}]*min-height:\s*44px/);
  });
  test("the header search hides until there is room (the hero panel searches too)", () => {
    expect(read("views/listings/index.ejs")).toMatch(/wl-topbar-search-form d-none d-xl-flex/);
  });
});

test("ultra-wide screens hold the content to a readable width", () => {
  expect(style).toMatch(/@media \(min-width: 1800px\)\s*\{[^@]*max-width:\s*1800px/);
});

test("on tablets the search panel is a two-column grid in the page flow, not over the hero copy", () => {
  expect(style).toMatch(/@media \(min-width: 769px\) and \(max-width: 991px\)\s*\{[\s\S]*?\.wl-search-wrapper\s*\{\s*position:\s*relative[\s\S]*?grid-template-columns:\s*repeat\(2/);
});
