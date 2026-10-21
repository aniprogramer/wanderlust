module.exports = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/setupEnv.js"],
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  // Browser checks run separately via `npm run test:e2e`
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/tests/e2e/"],
  collectCoverageFrom: [
    "app.js",
    "middleware.js",
    "schema.js",
    "controllers/**/*.js",
    "models/**/*.js",
    "routes/**/*.js",
    "utils/**/*.js",
  ],
  // Integration tests share one in-memory MongoDB, so run files serially.
  maxWorkers: 1,
  testTimeout: 30000,
};
