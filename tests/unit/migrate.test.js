// 3.4 replaced init/migrate.js with the numbered runner, so these tests moved with it.
const { available, refusal } = require("../../migrations/runner");

describe("migration runner", () => {
  test("scripts are numbered, ordered and described", () => {
    const scripts = available();
    expect(scripts.map((s) => s.name)).toEqual([...scripts.map((s) => s.name)].sort());
    expect(scripts.length).toBeGreaterThanOrEqual(5);
    for (const script of scripts) {
      expect(script.description).toBeTruthy();
      expect(typeof script.up).toBe("function");
    }
  });

  test("production needs --force", () => {
    expect(refusal({ env: { NODE_ENV: "production" }, argv: [] })).toMatch(/--force/);
    expect(refusal({ env: { NODE_ENV: "production" }, argv: ["--force"] })).toBeNull();
    expect(refusal({ env: { NODE_ENV: "development" }, argv: [] })).toBeNull();
  });
});
