// "/css/style.css" -> "/css/style.css?v=<hash of the file>". The hash is worked out once per
// process, so a deploy changes the URL only for files that changed. No bundler needed.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const versions = new Map();

module.exports = (webPath) => {
  if (!versions.has(webPath)) {
    let version = "";
    try {
      const file = fs.readFileSync(path.join(__dirname, "../public", webPath));
      version = crypto.createHash("sha256").update(file).digest("hex").slice(0, 10);
    } catch {
      // A missing file still gets its plain URL, and a plain 404 in the browser
    }
    versions.set(webPath, version);
  }
  const version = versions.get(webPath);
  return version ? `${webPath}?v=${version}` : webPath;
};
