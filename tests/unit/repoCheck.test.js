// AD6: fails the build when raw colours, inline styles or inline scripts slip in.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "../..");
const walk = (dir) =>
  fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? walk(rel) : [rel];
  });

// Email clients need inline styles and literal colours (see utils/emailTheme.js)
const views = walk("views").filter(
  (f) => f.endsWith(".ejs") && !f.startsWith(path.join("views", "emails")),
);
const css = walk("public/css").filter(
  (f) => f.endsWith(".css") && path.basename(f) !== "tokens.css",
);
const scripts = walk("public/js").filter((f) => f.endsWith(".js"));

const COLOUR = /(?<![&\w/%-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\b(?:rgb|hsl)a?\(/;
const findings = (files, pattern) =>
  files.flatMap((file) =>
    fs
      .readFileSync(path.join(ROOT, file), "utf8")
      .split("\n")
      .flatMap((line, i) =>
        pattern.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : [],
      ),
  );

describe("repository check (AD6)", () => {
  test("found the files it is meant to scan", () => {
    expect(views.length).toBeGreaterThan(20);
    expect(css).toContain(path.join("public/css/style.css"));
    expect(scripts.length).toBeGreaterThan(4);
  });

  test("no style attributes in views", () => {
    expect(findings(views, /\sstyle=["']/)).toEqual([]);
  });

  test("no inline event handlers in views", () => {
    expect(findings(views, /\son[a-z]+=["']/)).toEqual([]);
  });

  test("no inline scripts in views", () => {
    const bad = views.flatMap((file) => {
      const text = fs.readFileSync(path.join(ROOT, file), "utf8");
      return (text.match(/<script\b[^>]*>/g) || [])
        .filter((tag) => !/\bsrc=/.test(tag))
        .filter((tag) => !/type="application\/(ld\+)?json"/.test(tag))
        .map((tag) => `${file}: ${tag}`);
    });
    expect(bad).toEqual([]);
  });

  test("no script writes a style attribute or inline handler into markup", () => {
    expect(findings(scripts, /\sstyle=\\?["']|\son[a-z]+=\\?["']/)).toEqual([]);
  });

  test("no raw colours in views, stylesheets or scripts", () => {
    expect(findings([...views, ...css, ...scripts], COLOUR)).toEqual([]);
  });

  test("no gradients or glass effects in stylesheets", () => {
    expect(findings(css, /gradient\(|backdrop-filter/)).toEqual([]);
  });

  test("no href=\"#\" placeholders", () => {
    expect(findings(views, /href="#"/)).toEqual([]);
  });

  test("every listed token is defined for both themes", () => {
    const tokens = fs.readFileSync(
      path.join(ROOT, "public/css/tokens.css"),
      "utf8",
    );
    expect(tokens).toContain("@media (prefers-color-scheme: dark)");
    expect(tokens).toMatch(/:root:not\(\[data-theme="light"\]\)/);
    expect(tokens).toContain('[data-theme="dark"]');
  });

  test("the audit's banned artefacts stay removed", () => {
    expect(fs.existsSync(path.join(ROOT, "public/js/currency.js"))).toBe(false);
    expect(findings(views, /Best seller|Watch the story/)).toEqual([]);
  });
});
