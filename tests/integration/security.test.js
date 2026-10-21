const fs = require("fs");
const request = require("supertest");
const app = require("../../app");
const {
  connectDb,
  disconnectDb,
  clearDb,
  createUser,
  login,
  guest,
  createListing,
} = require("../helpers");

beforeAll(connectDb);
afterAll(disconnectDb);
beforeEach(clearDb);

describe("CSRF", () => {
  test("writes without a token are refused", async () => {
    await createUser("alice");
    const agent = request.agent(app);
    await agent.get("/login");
    const res = await agent
      .post("/login")
      .type("form")
      .send({ username: "alice", password: "password123" });
    expect(res.status).toBe(403);
  });

  test("a token in the query string does not count", async () => {
    const agent = await guest(app);
    const token = agent.csrfToken;
    const bare = request.agent(app);
    await bare.get("/login");
    const res = await bare
      .post(`/login?_csrf=${token}`)
      .type("form")
      .send({ username: "a", password: "b" });
    expect(res.status).toBe(403);
  });

  test("a token in the form body is accepted", async () => {
    await createUser("alice");
    const agent = request.agent(app);
    const page = await agent.get("/login");
    const token = /name="_csrf" value="([^"]+)"/.exec(page.text)[1];
    const res = await agent
      .post("/login")
      .type("form")
      .send({ _csrf: token, username: "alice", password: "password123" });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/listings");
  });

  test("method-override deletes need a token too", async () => {
    const owner = await createUser("alice");
    const listing = await createListing(owner);
    const agent = await login(app);
    const tokenless = request.agent(app);
    tokenless.jar.setCookies(
      agent.jar.getCookies({
        domain: "127.0.0.1",
        path: "/",
        script: false,
        secure: false,
      }),
    );
    const res = await tokenless.post(`/listings/${listing._id}?_method=DELETE`);
    expect(res.status).toBe(403);
  });

  test("multipart uploads are checked after parsing and the temp file is removed", async () => {
    await createUser("alice");
    const agent = await login(app);
    agent.csrfToken = "wrong";
    const count = () =>
      fs.existsSync("uploads") ? fs.readdirSync("uploads").length : 0;
    const before = count();
    const res = await agent
      .post("/listings")
      .field("listing[title]", "T")
      .attach("listing[image]", Buffer.from("png"), "a.png");
    expect(res.status).toBe(403);
    expect(count()).toBe(before);
  });

  test("multipart is refused on routes that never parse it", async () => {
    const owner = await createUser("alice");
    const listing = await createListing(owner);
    const agent = await login(app);
    const res = await agent
      .post(`/listings/${listing._id}?_method=DELETE`)
      .field("x", "y");
    expect(res.status).toBe(403);
  });

  test("logout is POST only", async () => {
    await createUser("alice");
    const agent = await login(app);
    expect((await agent.get("/logout")).status).toBe(404);
    expect((await agent.post("/logout")).headers.location).toBe("/listings");
  });
});

describe("headers and session", () => {
  test("sends a CSP that allows the CDNs but not inline scripts", async () => {
    const csp = (await request(app).get("/listings")).headers[
      "content-security-policy"
    ];
    expect(csp).toContain("https://cdn.jsdelivr.net");
    expect(csp).toContain("https://api.mapbox.com");
    expect(csp).toContain("https://res.cloudinary.com");
    const scriptSrc = csp.split(";").find((d) => d.startsWith("script-src"));
    expect(scriptSrc).not.toContain("unsafe-inline");
  });

  test("pages render no inline scripts or handlers", async () => {
    const owner = await createUser("alice");
    const listing = await createListing(owner);
    const agent = await login(app);
    for (const path of [
      "/listings",
      `/listings/${listing._id}`,
      "/listings/new",
      "/bookings",
    ]) {
      const { text } = await agent.get(path);
      expect(text).not.toMatch(
        /<script(?![^>]*\bsrc=)(?![^>]*application\/json)[^>]*>/,
      );
      expect(text).not.toMatch(/\son(submit|click|change)=/);
      // style attributes are blocked by the CSP (no style-src 'unsafe-inline')
      expect(text).not.toMatch(/\sstyle="/);
    }
  });

  test("anonymous browsing does not create a session cookie", async () => {
    const owner = await createUser("alice");
    const listing = await createListing(owner);
    expect(
      (await request(app).get("/listings")).headers["set-cookie"],
    ).toBeUndefined();
    expect(
      (await request(app).get(`/listings/${listing._id}`)).headers[
        "set-cookie"
      ],
    ).toBeUndefined();
  });

  test("session cookie is HttpOnly and SameSite=Lax", async () => {
    const cookie = (await request(app).get("/login")).headers["set-cookie"][0];
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });
});

describe("rate limiting", () => {
  beforeAll(() => {
    process.env.ENABLE_RATE_LIMIT = "1";
  });
  afterAll(() => {
    delete process.env.ENABLE_RATE_LIMIT;
  });

  test("the 11th login attempt is throttled", async () => {
    const agent = await guest(app);
    const attempt = () =>
      agent.post("/login").type("form").send({ username: "x", password: "y" });
    for (let i = 0; i < 10; i++) expect((await attempt()).status).toBe(302);
    expect((await attempt()).status).toBe(429);
  });
});
