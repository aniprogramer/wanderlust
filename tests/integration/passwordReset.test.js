const crypto = require("crypto");
const app = require("../../app");
const User = require("../../models/user");
const mailer = require("../../utils/mailer");
const {
  connectDb,
  disconnectDb,
  clearDb,
  createUser,
  login,
  guest,
} = require("../helpers");

jest.mock("../../utils/mailer");

beforeAll(async () => {
  await connectDb();
  process.env.APP_URL = "https://wanderlust.test";
});
afterAll(disconnectDb);
beforeEach(async () => {
  await clearDb();
  jest.resetAllMocks();
  mailer.isConfigured.mockReturnValue(true);
  mailer.send.mockResolvedValue();
});

const GENERIC =
  "If an account exists for that email, we have sent a reset link.";

const requestReset = async (agent, email) => {
  await agent.post("/forgot-password").type("form").send({ email });
  return (await agent.get("/forgot-password")).text;
};

const emailedToken = () =>
  /\/reset-password\/([0-9a-f]{64})/.exec(mailer.send.mock.calls[0][0].text)[1];

describe("login with email", () => {
  test("accepts the registered email, any case", async () => {
    await createUser("alice");
    const agent = await guest(app);
    const res = await agent
      .post("/login")
      .type("form")
      .send({ username: "Alice@Example.com", password: "password123" });
    expect(res.headers.location).toBe("/listings");
  });

  test("unknown email and wrong password share one message", async () => {
    await createUser("alice");
    const a = await guest(app);
    await a
      .post("/login")
      .type("form")
      .send({ username: "nobody@example.com", password: "password123" });
    const b = await guest(app);
    await b
      .post("/login")
      .type("form")
      .send({ username: "alice@example.com", password: "wrong-password" });
    for (const agent of [a, b]) {
      expect((await agent.get("/login")).text).toContain(
        "Incorrect username or password.",
      );
    }
  });
});

describe("password reset", () => {
  test("unknown email gets the same answer and no mail", async () => {
    const text = await requestReset(await guest(app), "ghost@example.com");
    expect(text).toContain(GENERIC);
    expect(mailer.send).not.toHaveBeenCalled();
  });

  test("known email gets a one-time link; only its hash is stored", async () => {
    await createUser("alice");
    const text = await requestReset(await guest(app), "alice@example.com");
    expect(text).toContain(GENERIC);
    expect(mailer.send).toHaveBeenCalledTimes(1);
    expect(mailer.send.mock.calls[0][0].to).toBe("alice@example.com");

    const token = emailedToken();
    const user = await User.findOne({ username: "alice" }).select(
      "+resetTokenHash +resetTokenExpires",
    );
    expect(user.resetTokenHash).toBe(
      crypto.createHash("sha256").update(token).digest("hex"),
    );
    expect(user.resetTokenHash).not.toContain(token);
    expect(user.resetTokenExpires.getTime()).toBeGreaterThan(Date.now());
  });

  test("a delivery failure is hidden from the requester and logged by user id", async () => {
    process.env.LOG_IN_TEST = "1";
    const write = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    const alice = await createUser("alice");
    mailer.send.mockRejectedValue(new Error("smtp down"));
    const text = await requestReset(await guest(app), "alice@example.com");
    delete process.env.LOG_IN_TEST;
    const logged = write.mock.calls.flat().join(" ");
    write.mockRestore();
    expect(text).toContain(GENERIC);
    expect(logged).toContain(String(alice._id));
    expect(logged).toContain("mail.passwordReset");
    expect(logged).not.toMatch(/[0-9a-f]{64}/);
    expect(logged).not.toContain("alice@example.com");
  });

  // 2.5 changed this: with sending off the page must not claim a link was emailed
  test("with mail off nothing is sent and the page says so honestly", async () => {
    await createUser("alice");
    mailer.isConfigured.mockReturnValue(false);
    const known = await requestReset(await guest(app), "alice@example.com");
    const unknown = await requestReset(await guest(app), "ghost@example.com");
    expect(known).not.toContain(GENERIC);
    expect(known).toContain("Email is turned off in this environment");
    expect(unknown).toContain("Email is turned off in this environment");
    expect(mailer.send).not.toHaveBeenCalled();
  });

  test("malformed email is rejected before any lookup", async () => {
    const agent = await guest(app);
    const text = await requestReset(agent, "not-an-email");
    expect(text).toContain("Enter a valid email address.");
  });

  test("the link sets a new password once, then dies", async () => {
    await createUser("alice");
    await requestReset(await guest(app), "alice@example.com");
    const token = emailedToken();

    const agent = await guest(app);
    expect((await agent.get(`/reset-password/${token}`)).text).toContain(
      "Choose a new password",
    );
    const res = await agent
      .post(`/reset-password/${token}`)
      .type("form")
      .send({ password: "brand-new-pass1", confirmPassword: "brand-new-pass1" });
    expect(res.headers.location).toBe("/login");

    const ok = await (await guest(app))
      .post("/login")
      .type("form")
      .send({ username: "alice", password: "brand-new-pass1" });
    expect(ok.headers.location).toBe("/listings");
    const old = await (await guest(app))
      .post("/login")
      .type("form")
      .send({ username: "alice", password: "password123" });
    expect(old.headers.location).toBe("/login");

    // Single use
    expect((await agent.get(`/reset-password/${token}`)).text).toContain(
      "Link expired",
    );
    const again = await agent
      .post(`/reset-password/${token}`)
      .type("form")
      .send({ password: "another-pass-1", confirmPassword: "another-pass-1" });
    expect(again.headers.location).toBe("/forgot-password");
  });

  test("expired and forged tokens are refused", async () => {
    await createUser("alice");
    await requestReset(await guest(app), "alice@example.com");
    const token = emailedToken();
    await User.updateOne(
      { username: "alice" },
      { resetTokenExpires: new Date(Date.now() - 1000) },
    );
    const agent = await guest(app);
    expect((await agent.get(`/reset-password/${token}`)).text).toContain(
      "Link expired",
    );
    expect(
      (await agent.get(`/reset-password/${"0".repeat(64)}`)).text,
    ).toContain("Link expired");
  });

  test("short or mismatched passwords are rejected and the token survives", async () => {
    await createUser("alice");
    await requestReset(await guest(app), "alice@example.com");
    const token = emailedToken();
    const agent = await guest(app);
    for (const body of [
      { password: "short", confirmPassword: "short" },
      { password: "long-enough-1", confirmPassword: "different-1" },
    ]) {
      const res = await agent
        .post(`/reset-password/${token}`)
        .type("form")
        .send(body);
      expect(res.headers.location).toBe(`/reset-password/${token}`);
    }
    expect((await agent.get(`/reset-password/${token}`)).text).toContain(
      "Choose a new password",
    );
  });

  test("sessions opened before the reset are signed out", async () => {
    await createUser("alice");
    const stolen = await login(app, "alice");
    expect((await stolen.get("/wishlist")).status).toBe(200);

    await requestReset(await guest(app), "alice@example.com");
    const token = emailedToken();
    await (await guest(app))
      .post(`/reset-password/${token}`)
      .type("form")
      .send({ password: "brand-new-pass1", confirmPassword: "brand-new-pass1" });

    const res = await stolen.get("/wishlist");
    expect(res.headers.location).toBe("/login");
  });
});
