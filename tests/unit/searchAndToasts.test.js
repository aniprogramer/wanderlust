const fs = require("fs");
const path = require("path");

const read = (f) => fs.readFileSync(path.join(__dirname, "../..", f), "utf8");
const tokens = read("public/css/tokens.css");
const style = read("public/css/style.css");
const lastBlock = (css, selector) => {
  const re = new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "g");
  let m;
  let last = "";
  while ((m = re.exec(css))) last = m[1];
  return last;
};

describe("every token used is defined", () => {
  test("no var(--x) points at a token that does not exist (an undefined token silently drops the whole declaration)", () => {
    const all = tokens + style;
    const defined = new Set([...all.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    const used = new Set([...all.matchAll(/var\((--[\w-]+)\s*[,)]/g)].map((m) => m[1]));
    expect([...used].filter((name) => !defined.has(name))).toEqual([]);
  });
});

describe("dense glass for popovers and pop-ups", () => {
  test("is derived from the raised surface, so it adds no colour and follows the theme", () => {
    expect(tokens).toMatch(/--glass-bg-dense:\s*color-mix\(in srgb, var\(--surface-raised\) 94%, transparent\)/);
  });

  test("the calendar and the guest selector use it, with a stronger glass edge", () => {
    const rule = lastBlock(tokens, ".wl-guests-popover,\n.wl-calendar-popover");
    expect(rule).toMatch(/background:\s*var\(--glass-bg-dense\)/);
    expect(rule).toMatch(/border-color:\s*var\(--glass-border-strong\)/);
  });

  test("both popovers sit one shared gap below the search bar", () => {
    expect(tokens).toMatch(/--popover-gap:\s*22px/);
    expect(lastBlock(style, ".wl-guests-popover")).toMatch(/top:\s*calc\(100% \+ var\(--popover-gap\)\)/);
    expect(lastBlock(style, ".wl-calendar-popover")).toMatch(/top:\s*calc\(100% \+ var\(--popover-gap\)\)/);
  });
});

describe("home search button", () => {
  test("keeps its brass fill on hover and shifts tone with an overlay instead", () => {
    const hover = lastBlock(style, ".wl-search-btn:hover");
    expect(hover).toMatch(/background-color:\s*var\(--accent-fill\)/);
    expect(hover).toMatch(/inset 0 0 0 999px var\(--state-pressed\)/);
    expect(hover).not.toMatch(/accent-fill-hover/);
  });

  test("the icon is ink on brass in both themes and the button has a focus ring", () => {
    expect(lastBlock(style, ".wl-search-btn")).toMatch(/color:\s*var\(--band\)/);
    expect(lastBlock(style, ".wl-search-btn:focus-visible")).toMatch(/outline:\s*2px solid var\(--focus-ring\)/);
  });
});

describe("pop-up notifications", () => {
  test("are dense glass with the blur in tokens.css", () => {
    const rule = lastBlock(tokens, ".wl-toast.wl-auth-alert");
    expect(rule).toMatch(/background:\s*var\(--glass-bg-dense\)/);
    expect(rule).toMatch(/backdrop-filter:\s*var\(--glass-backdrop\)/);
  });

  test("are rounded, with readable text in the main text colour", () => {
    const rule = lastBlock(style, ".wl-toast");
    expect(rule).toMatch(/border-radius:\s*var\(--radius-2xl\)/);
    expect(rule).toMatch(/border:\s*1px solid var\(--glass-border-strong\)/);
    expect(rule).toMatch(/color:\s*var\(--text\)/);
  });

  test.each([
    ["success", "success"],
    ["warning", "warning"],
    ["error", "error"],
  ])("a %s pop-up shows its status in a round chip: colour on its subtle fill, plus the icon", (type, token) => {
    const chip = lastBlock(style, `.wl-toast.wl-auth-alert--${type} > i:first-child`);
    expect(chip).toMatch(new RegExp(`background:\\s*var\\(--${token}-subtle\\)`));
    expect(chip).toMatch(new RegExp(`color:\\s*var\\(--${token}\\)`));
    expect(lastBlock(style, ".wl-toast > i:first-child")).toMatch(/border-radius:\s*50%/);
  });

  test("the close button has a visible focus ring", () => {
    expect(lastBlock(style, ".wl-toast__close:focus-visible")).toMatch(/outline:\s*2px solid var\(--focus-ring\)/);
  });
});
