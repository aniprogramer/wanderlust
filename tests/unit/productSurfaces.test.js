const fs = require("fs");
const path = require("path");

const read = (f) => fs.readFileSync(path.join(__dirname, "../..", f), "utf8");
const tokens = read("public/css/tokens.css");
const style = read("public/css/style.css");
const mapJs = read("public/js/map.js");
// The last rule for a selector list wins, so read the last match
const lastBlock = (css, selector) => {
  const re = new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "g");
  let m;
  let last = "";
  while ((m = re.exec(css))) last = m[1];
  return last;
};

describe("shared product surfaces", () => {
  test("the site header is glass, with the blur defined in tokens.css", () => {
    const rule = lastBlock(tokens, ".wl-navbar");
    expect(rule).toMatch(/background:\s*var\(--glass-bg\)/);
    expect(rule).toMatch(/backdrop-filter:\s*var\(--glass-backdrop\)/);
    expect(lastBlock(style, ".wl-navbar")).toMatch(/border-bottom:\s*1px solid var\(--glass-border\)/);
  });

  test("panels, empty states, stats and contents lists share one fine glass card", () => {
    const rule = lastBlock(style, ".wl-panel,\n.wl-empty,\n.wl-stat,\n.wl-toc,\n.wl-rail-body .card:not(.wl-listing-card)");
    expect(rule).toMatch(/background:\s*var\(--glass-bg-subtle\)/);
    expect(rule).toMatch(/border:\s*1px solid var\(--glass-border\)/);
    expect(rule).toMatch(/border-radius:\s*var\(--radius-xl\)/);
  });

  test("buttons are pills and fields are rounded on a translucent fill", () => {
    expect(lastBlock(style, ".wl-auth-btn,\n.btn")).toMatch(/border-radius:\s*var\(--radius-pill\)/);
    const fields = lastBlock(style, ".wl-input,\n.form-control,\n.form-select");
    expect(fields).toMatch(/background-color:\s*var\(--glass-bg-subtle\)/);
    expect(fields).toMatch(/border-radius:\s*var\(--radius-xl\)/);
  });

  test("content clears the floating rail on both sides from 993px", () => {
    expect(style).toMatch(/@media \(min-width: 993px\)\s*\{\s*\.wl-rail-body \.wl-shell-main\s*\{\s*max-width:\s*min\(1320px, calc\(100% - 2 \* var\(--rail-gutter\)\)\)/);
  });

  test("the page entrance only runs with motion allowed and leaves no transform behind", () => {
    const guarded = /@media \(prefers-reduced-motion: no-preference\)\s*\{\s*\.wl-rail-body \.wl-shell-main > \*\s*\{[^}]*animation:\s*wlPageIn[^;]*backwards;/;
    expect(style).toMatch(guarded);
  });

  test("rail labels wrap inside the rail instead of spilling out", () => {
    const label = lastBlock(style, ".wl-sidebar .wl-rail-label");
    expect(label).toMatch(/white-space:\s*normal/);
    expect(label).toMatch(/text-align:\s*center/);
    expect(lastBlock(style, ".wl-sidebar .wl-rail-link")).toMatch(/height:\s*auto/);
  });

  test("status states use tokens only", () => {
    for (const sel of [".wl-state__icon", ".wl-state__label", ".wl-map__fallback"]) {
      const rule = lastBlock(style, sel);
      expect(rule).not.toBe("");
      expect(rule).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    }
  });
});

describe("map fallback", () => {
  test("a map that cannot load says so in its place instead of failing silently", () => {
    expect(mapJs).toMatch(/map\.on\("error"/);
    expect(mapJs).toMatch(/map\.isStyleLoaded\(\)/);
    expect(mapJs).toMatch(/className = "wl-map__fallback"/);
    expect(mapJs).toMatch(/setAttribute\("role", "status"\)/);
  });
});

describe("header search", () => {
  const nav = read("views/includes/navbar.ejs");

  test("is one pill with its own field and button, not the general form-control and .btn styles", () => {
    expect(nav).toMatch(/<form class="wl-navsearch" role="search" action="\/listings" method="GET">/);
    expect(nav).toMatch(/class="wl-navsearch__input"/);
    expect(nav).toMatch(/<button class="wl-navsearch__btn" type="submit">Search<\/button>/);
    expect(nav).not.toMatch(/btn-search|id="search-box"|form-control/);
  });

  test("the button is inset inside the pill: it fills the pill height minus an even padding", () => {
    const pill = lastBlock(style, ".wl-navsearch");
    expect(pill).toMatch(/height:\s*48px/);
    expect(pill).toMatch(/padding:\s*4px 4px 4px 16px/);
    expect(pill).toMatch(/border-radius:\s*var\(--radius-pill\)/);
    const btn = lastBlock(style, ".wl-navsearch__btn");
    expect(btn).toMatch(/height:\s*100%/);
    expect(btn).toMatch(/background:\s*var\(--primary\)/);
  });

  test("the field starts from zero width so it can never push the phone menu off screen", () => {
    const input = lastBlock(style, ".wl-navsearch__input");
    expect(input).toMatch(/flex:\s*1 1 0/);
    expect(input).toMatch(/width:\s*0/);
  });

  test("the pill shows one focus ring and the button keeps its own", () => {
    expect(lastBlock(style, ".wl-navsearch:has(.wl-navsearch__input:focus)")).toMatch(/outline:\s*2px solid var\(--focus-ring\)/);
    expect(lastBlock(style, ".wl-navsearch__btn:focus-visible")).toMatch(/outline:\s*2px solid var\(--focus-ring\)/);
  });
});
