const request = require("supertest");
const app = require("../../app");
const User = require("../../models/user");
const {
  connectDb,
  disconnectDb,
  clearDb,
  createUser,
  login,
  guest,
} = require("../helpers");

beforeAll(connectDb);
afterAll(disconnectDb);
beforeEach(clearDb);

describe("authentication", () => {
  test("signup creates a user, hashes the password and logs in", async () => {
    const agent = await guest(app);
    const res = await agent.post("/signup").type("form").send({
      username: "bob",
      email: "bob@example.com",
      password: "secret123",
    });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/listings");

    const user = await User.findOne({ username: "bob" }).select("+hash");
    expect(user.hash).toBeDefined();
    expect(user.hash).not.toContain("secret123");

    // Session is active: protected page is reachable
    expect((await agent.get("/wishlist")).status).toBe(200);
  });

  test("signup with duplicate username redirects back", async () => {
    await createUser("bob");
    const res = await (await guest(app)).post("/signup").type("form").send({
      username: "bob",
      email: "other@example.com",
      password: "secret123",
    });
    expect(res.headers.location).toBe("/signup");
    expect(await User.countDocuments()).toBe(1);
  });

  describe("signup validation", () => {
    const signup = async (agent, body) => {
      const res = await agent.post("/signup").type("form").send(body);
      expect(res.headers.location).toBe("/signup");
      return (await agent.get("/signup")).text;
    };

    test("duplicate email is caught case-insensitively with a friendly message", async () => {
      jest.spyOn(console, "error").mockImplementation(() => {});
      await createUser("bob");
      const text = await signup(await guest(app), {
        username: "bobby",
        email: "BOB@Example.com",
        password: "secret123",
      });
      expect(text).toContain("That email is already registered.");
      expect(text).not.toContain("E11000");
      expect(await User.countDocuments()).toBe(1);
    });

    test("duplicate username says so", async () => {
      jest.spyOn(console, "error").mockImplementation(() => {});
      await createUser("bob");
      const text = await signup(await guest(app), {
        username: "bob",
        email: "new@example.com",
        password: "secret123",
      });
      expect(text).toContain("That username is taken.");
    });

    test("short password is rejected before touching the database", async () => {
      const text = await signup(await guest(app), {
        username: "bob",
        email: "bob@example.com",
        password: "short",
      });
      expect(text).toContain("at least 8 characters");
      expect(await User.countDocuments()).toBe(0);
    });

    test("email is stored lowercase and trimmed", async () => {
      await (await guest(app)).post("/signup").type("form").send({
        username: "bob",
        email: "  Bob@Example.COM ",
        password: "secret123",
      });
      expect((await User.findOne({ username: "bob" })).email).toBe(
        "bob@example.com",
      );
    });
  });

  test("empty login body flashes a generic error without querying users", async () => {
    const spy = jest.spyOn(User, "findOne");
    const agent = await guest(app);
    const res = await agent.post("/login").type("form").send({});
    expect(res.headers.location).toBe("/login");
    expect(spy).not.toHaveBeenCalled();
    expect((await agent.get("/login")).text).toContain(
      "Incorrect username or password.",
    );
    spy.mockRestore();
  });

  test("login succeeds with valid credentials and fails otherwise", async () => {
    await createUser("alice");
    const agent = await login(app, "alice");
    expect((await agent.get("/bookings")).status).toBe(200);

    const bad = await (await guest(app))
      .post("/login")
      .type("form")
      .send({ username: "alice", password: "nope" });
    expect(bad.headers.location).toBe("/login");
  });

  test("login returns to the originally requested page", async () => {
    await createUser("alice");
    const agent = await guest(app);
    await agent.get("/bookings");
    const res = await agent
      .post("/login")
      .type("form")
      .send({ username: "alice", password: "password123" });
    expect(res.headers.location).toBe("/bookings");
  });

  test("logout ends the session", async () => {
    await createUser("alice");
    const agent = await login(app);
    await agent.post("/logout");
    const res = await agent.get("/wishlist");
    expect(res.headers.location).toBe("/login");
  });

  test.each(["/wishlist", "/bookings", "/bookings/hosting", "/listings/new"])(
    "%s requires login",
    async (path) => {
      const res = await request(app).get(path);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/login");
    },
  );
});
