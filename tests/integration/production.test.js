const request = require("supertest");

// Loads a fresh copy of the app with NODE_ENV=production. The Mongo session store is
// swapped for express-session's MemoryStore so no database is needed.
const loadProdApp = (env = {}) => {
  const saved = { ...process.env };
  Object.assign(
    process.env,
    { NODE_ENV: "production", SECRET: "prod-secret" },
    env,
  );
  for (const [key, value] of Object.entries(env))
    if (value === undefined) delete process.env[key];
  try {
    let app;
    jest.isolateModules(() => {
      jest.doMock("connect-mongo", () => {
        const session = require("express-session");
        return { default: { create: () => new session.MemoryStore() } };
      });
      app = require("../../app");
    });
    return app;
  } finally {
    process.env = saved;
  }
};

describe("production settings", () => {
  test("trusts one proxy and sends a Secure, HttpOnly, SameSite=Lax cookie", async () => {
    const app = loadProdApp();
    expect(app.get("trust proxy")).toBe(1);
    // The proxy terminates TLS; without this header express-session would not set a Secure cookie
    const res = await request(app)
      .get("/login")
      .set("X-Forwarded-Proto", "https");
    expect(res.status).toBe(200);
    const cookie = res.headers["set-cookie"][0];
    expect(cookie).toMatch(/; Secure/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  test("over plain HTTP the page still renders but no Secure cookie is issued", async () => {
    const res = await request(loadProdApp()).get("/login");
    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  test("refuses to load without SECRET", () => {
    const listen = jest.spyOn(require("express").application, "listen");
    expect(() => loadProdApp({ SECRET: undefined })).toThrow(
      "SECRET must be set when NODE_ENV=production",
    );
    expect(listen).not.toHaveBeenCalled();
    listen.mockRestore();
  });
});
