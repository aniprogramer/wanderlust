const { seedRefusal, describeTarget } = require("../../init/seedGuard");

const ok = { env: { ALLOW_DESTRUCTIVE_SEED: "true" }, argv: ["--yes"], url: "mongodb://127.0.0.1/wl" };

describe("seed guard (BE6)", () => {
  test("runs only when asked for explicitly", () => {
    expect(seedRefusal(ok)).toBeNull();
  });

  test("refuses without the flag", () => {
    expect(seedRefusal({ ...ok, env: {} })).toMatch(/ALLOW_DESTRUCTIVE_SEED/);
    expect(
      seedRefusal({ ...ok, env: { ALLOW_DESTRUCTIVE_SEED: "1" } }),
    ).toMatch(/ALLOW_DESTRUCTIVE_SEED/);
  });

  test("refuses without --yes", () => {
    expect(seedRefusal({ ...ok, argv: [] })).toMatch(/--yes/);
  });

  test("refuses in production even with every flag", () => {
    expect(
      seedRefusal({
        ...ok,
        env: { ALLOW_DESTRUCTIVE_SEED: "true", NODE_ENV: "production" },
      }),
    ).toMatch(/production/);
  });

  test("refuses a connection string carrying a protected marker", () => {
    const env = {
      ALLOW_DESTRUCTIVE_SEED: "true",
      PROTECTED_DB_MARKERS: "cluster0, prod",
    };
    expect(
      seedRefusal({ ...ok, env, url: "mongodb+srv://u:p@cluster0.x.net/wl" }),
    ).toMatch(/cluster0/);
    expect(seedRefusal({ ...ok, env })).toBeNull();
  });

  test("the printed target never includes credentials", () => {
    const target = describeTarget("mongodb://user:secret@db.example:27017/wl");
    expect(target).toEqual({ host: "db.example", name: "wl" });
    expect(JSON.stringify(target)).not.toContain("secret");
  });
});

describe("startup", () => {
  test("app.js no longer seeds anything", () => {
    const src = require("fs").readFileSync(require.resolve("../../app"), "utf8");
    expect(src).not.toContain("initDB");
    expect(src).not.toContain("Auto-seeding");
  });
});
