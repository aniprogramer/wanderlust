const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ROOT = path.join(__dirname, "../..");

describe("Wanderlust Favicon Assets", () => {
  const rootSvgPath = path.join(ROOT, "public/favicon.svg");
  const assetsSvgPath = path.join(ROOT, "public/assets/favicon.svg");

  test("SVG favicons exist and match", () => {
    expect(fs.existsSync(rootSvgPath)).toBe(true);
    expect(fs.existsSync(assetsSvgPath)).toBe(true);
    const rootSvg = fs.readFileSync(rootSvgPath, "utf8");
    const assetsSvg = fs.readFileSync(assetsSvgPath, "utf8");
    expect(rootSvg).toBe(assetsSvg);
  });

  test("SVG favicon has transparent background and no solid rect fill", () => {
    const svg = fs.readFileSync(assetsSvgPath, "utf8");
    expect(svg).not.toMatch(/<rect\b/);
    expect(svg).not.toMatch(/\.bg\b/);
  });

  test("SVG favicon supports prefers-color-scheme: dark and swaps lagoon peaks to #EDE9DF", () => {
    const svg = fs.readFileSync(assetsSvgPath, "utf8");
    expect(svg).toContain("@media (prefers-color-scheme: dark)");
    // Default light mode lagoon
    expect(svg).toMatch(/\.peak\s*\{\s*fill:\s*#0E2B29;\s*\}/);
    // Dark mode primary swap
    expect(svg).toMatch(/\.peak\s*\{\s*fill:\s*#EDE9DF;\s*\}/);
  });

  test("Raster PNG and ICO assets exist in public and public/assets", () => {
    const expectedFiles = [
      "public/favicon.ico",
      "public/favicon-16x16.png",
      "public/favicon-32x32.png",
      "public/favicon-48x48.png",
      "public/assets/favicon.ico",
      "public/assets/favicon-16x16.png",
      "public/assets/favicon-32x32.png",
      "public/assets/favicon-48x48.png",
      "public/assets/favicon-180x180.png",
      "public/assets/favicon-192x192.png",
      "public/assets/favicon-512x512.png",
    ];

    for (const rel of expectedFiles) {
      expect(fs.existsSync(path.join(ROOT, rel))).toBe(true);
    }
  });

  test("PNG assets have alpha transparency", () => {
    const pngPath = path.join(ROOT, "public/assets/favicon-32x32.png");
    const result = cp.spawnSync("identify", ["-verbose", pngPath], { encoding: "utf8" });
    expect(result.stdout).toMatch(/Alpha:[\s\S]*?min:\s*0\b/);
  });

  test("boilerplate.ejs references updated favicon assets and webmanifest", () => {
    const html = fs.readFileSync(path.join(ROOT, "views/layouts/boilerplate.ejs"), "utf8");
    expect(html).toContain('rel="icon" type="image/svg+xml" href="/assets/favicon.svg');
    expect(html).toContain('rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32x32.png');
    expect(html).toContain('rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-16x16.png');
    expect(html).toContain('rel="shortcut icon" href="/favicon.ico');
    expect(html).toContain('rel="apple-touch-icon" href="/assets/favicon-180x180.png');
    expect(html).toContain('rel="manifest" href="/site.webmanifest');
  });

  test("site.webmanifest references transparent favicon assets", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "public/site.webmanifest"), "utf8"));
    const srcs = manifest.icons.map((i) => i.src);
    expect(srcs).toContain("/assets/favicon-16x16.png");
    expect(srcs).toContain("/assets/favicon-32x32.png");
    expect(srcs).toContain("/assets/favicon-48x48.png");
    expect(srcs).toContain("/assets/favicon.svg");
  });
});
