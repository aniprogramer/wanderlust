// The one place raw colours are allowed outside tokens.css: email clients ignore external
// CSS and custom properties, so values are read from the Stone block of tokens.css.
const fs = require("fs");
const path = require("path");

const css = fs.readFileSync(
  path.join(__dirname, "../public/css/tokens.css"),
  "utf8",
);
const stone = css.slice(0, css.indexOf('[data-theme="dark"]'));
const token = (name) => {
  const match = stone.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`tokens.css has no --${name}`);
  return match[1].trim();
};

module.exports = {
  bg: token("bg"),
  surface: token("surface"),
  border: token("border"),
  text: token("text"),
  textSecondary: token("text-secondary"),
  textMuted: token("text-muted"),
  primary: token("primary"),
  onPrimary: token("on-primary"),
  link: token("link"),
  accent: token("accent"),
  radiusMd: token("radius-md"),
  radiusLg: token("radius-lg"),
  // Web-safe fallbacks only: self-hosted fonts do not reach an inbox
  fontDisplay: "Georgia, 'Times New Roman', serif",
  fontSans: "Arial, Helvetica, sans-serif",
};
