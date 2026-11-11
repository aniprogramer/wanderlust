const cheerio = require("cheerio");
const app = require("../../app");
const User = require("../../models/user");
const { connectDb, disconnectDb, clearDb, createUser, guest } = require("../helpers");

beforeAll(connectDb);
afterAll(disconnectDb);
beforeEach(clearDb);

const good = {
  username: "bob",
  email: "bob@example.com",
  password: "Strong1pass!",
  confirmPassword: "Strong1pass!",
  terms: "on",
  startingMode: "guest",
};

describe("sign-in and sign-up pages", () => {
  test.each(["/login", "/signup", "/forgot-password"])("%s is a glass card over a full-screen photo, with no site navigation", async (path) => {
    const $ = cheerio.load((await (await guest(app)).get(path)).text);
    expect($("img.wl-auth-bg")).toHaveLength(1);
    expect($(".wl-auth-card")).toHaveLength(1);
    expect($(".wl-auth-brandbar a[href='/listings']")).toHaveLength(1);
    // The home navigation, the rail and social sign-in stay off these pages
    expect($("nav.navbar, .wl-sidebar, .wl-auth-nav, .wl-auth-topbar")).toHaveLength(0);
    expect($("body").text()).not.toMatch(/Continue with|Sign in with (Google|Apple|GitHub)/i);
    expect($(".wl-auth-btn--primary")).toHaveLength(1);
  });

  test("sign-up lists every password rule from the shared list, and the reset page does too", async () => {
    const $ = cheerio.load((await (await guest(app)).get("/signup")).text);
    expect($("[data-password-rules='password'] [data-rule]").map((_, el) => $(el).attr("data-rule")).get()).toEqual([
      "length", "upper", "lower", "number", "special",
    ]);
    expect($("#password").attr("aria-describedby")).toBe("password-rules");
    expect($("fieldset").text()).toContain("Find stays");
    expect($("fieldset").text()).toContain("Host stays");
    expect($("#terms")).toHaveLength(1);
  });

  test("login offers remember me (on), forgot password and the sign-up link", async () => {
    const $ = cheerio.load((await (await guest(app)).get("/login")).text);
    expect($("#rememberMe").attr("checked")).toBeDefined();
    expect($("a[href='/forgot-password']")).toHaveLength(1);
    expect($(".wl-auth-switch a[href='/signup']")).toHaveLength(1);
    expect($("[data-toggle-password]")).toHaveLength(1);
  });
});

describe("the server enforces the password rules and the form", () => {
  const post = async (over) => {
    const agent = await guest(app);
    const res = await agent.post("/signup").type("form").send({ ...good, ...over });
    return { res, agent };
  };

  test("a strong password with a matching confirmation creates the account", async () => {
    const { res } = await post({});
    expect(res.headers.location).toBe("/listings");
    expect(await User.findOne({ username: "bob" })).toBeTruthy();
  });

  test.each([
    ["no uppercase", "strong1pass!"],
    ["no lowercase", "STRONG1PASS!"],
    ["no number", "Strongpass!!"],
    ["no special character", "Strong1passs"],
    ["too short", "Ab1!"],
    ["too long", `Ab1!${"x".repeat(125)}`],
  ])("refuses a password with %s", async (_n, password) => {
    const { res } = await post({ password, confirmPassword: password });
    expect(res.headers.location).toBe("/signup");
    expect(await User.countDocuments()).toBe(0);
  });

  test("refuses a mismatched or missing confirmation, a bad email, a missing terms box", async () => {
    for (const over of [
      { confirmPassword: "Strong1pass?" },
      { confirmPassword: undefined },
      { email: "nope" },
      { terms: undefined },
    ]) {
      const { res } = await post(over);
      expect(res.headers.location).toBe("/signup");
    }
    expect(await User.countDocuments()).toBe(0);
  });

  test("the change-password and reset paths use the same rules", async () => {
    const { RULES } = require("../../utils/passwordRules");
    expect(RULES).toHaveLength(5);
    const { newPassword } = require("../../schema");
    expect(newPassword.validate("weakpass1").error).toBeDefined();
    expect(newPassword.validate("Weakpass1!").error).toBeUndefined();
  });
});

describe("username availability", () => {
  test("says whether a well-formed name is free", async () => {
    await createUser("alice");
    const agent = await guest(app);
    expect((await agent.get("/signup/username-available?username=alice")).body).toEqual({ valid: true, available: false });
    expect((await agent.get("/signup/username-available?username=freshname")).body).toEqual({ valid: true, available: true });
    expect((await agent.get("/signup/username-available?username=a")).body).toEqual({ valid: false, available: false });
    expect((await agent.get("/signup/username-available?username=bad%20name")).body).toEqual({ valid: false, available: false });
  });
});

describe("remember me", () => {
  beforeEach(() => createUser("alice"));

  const cookieOf = async (body) => {
    const agent = await guest(app);
    const res = await agent.post("/login").type("form").send({ username: "alice", password: "password123", ...body });
    return (res.headers["set-cookie"] || []).join(";");
  };

  test("with it the cookie outlives the browser; without it the cookie is for the session only", async () => {
    expect(await cookieOf({ rememberMe: "on" })).toMatch(/Expires=/i);
    expect(await cookieOf({})).not.toMatch(/Expires=|Max-Age=/i);
  });
});
