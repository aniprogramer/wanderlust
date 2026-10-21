const { defineConfig } = require("@playwright/test");
const { PORT } = require("./tests/e2e/fixtures");

module.exports = defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // Use installed Playwright Chromium
    // channel: "chrome",
    timezoneId: "Asia/Kolkata",
    launchOptions: {
      args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
    },
  },
  webServer: {
    command: "node tests/e2e/server.js",
    url: `http://127.0.0.1:${PORT}/login`,
    timeout: 60000,
    reuseExistingServer: false,
  },
});
