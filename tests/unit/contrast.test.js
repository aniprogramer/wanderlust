// 4.4: measures the token pairs in docs/design/color-system.md against tokens.css itself, so a
// palette edit that breaks a pair fails here. Rendered components are measured by axe (a11y.spec.js).
const fs = require("fs");
const path = require("path");

const css = fs.readFileSync(path.join(__dirname, "../../public/css/tokens.css"), "utf8");

const block = (selector) => {
  const start = css.indexOf(selector);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return Object.fromEntries(
    [...css.slice(open, close).matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]),
  );
};

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const TEXT_PAIRS = [
  ["text", "bg"],
  ["text", "surface"],
  ["text-secondary", "bg"],
  ["text-secondary", "surface"],
  ["text-muted", "bg"],
  ["text-muted", "surface"],
  ["accent", "bg"],
  ["accent", "surface"],
  ["secondary", "bg"],
  ["success", "bg"],
  ["warning", "bg"],
  ["error", "bg"],
  ["link", "bg"],
  ["link", "surface"],
  ["on-primary", "primary"],
  ["success", "success-subtle"],
  ["warning", "warning-subtle"],
  ["error", "error-subtle"],
];

describe.each([
  ["Stone", ":root"],
  ["Night", '[data-theme="dark"]'],
])("%s theme", (_name, selector) => {
  const tokens = block(selector);

  test.each(TEXT_PAIRS)("%s on %s meets AA", (fg, bg) => {
    expect(tokens[fg]).toBeDefined();
    expect(tokens[bg]).toBeDefined();
    expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(4.5);
  });

  test("control edges and the focus ring are visible", () => {
    expect(contrast(tokens["border-strong"], tokens.bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(tokens["focus-ring"], tokens.bg)).toBeGreaterThanOrEqual(3);
  });
});
