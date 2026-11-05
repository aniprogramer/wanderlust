const request = require("supertest");
const app = require("../../app");
const mailer = require("../../utils/mailer");
const { connectDb, disconnectDb, clearDb, guest, createUser, login } = require("../helpers");

beforeAll(async () => {
  await connectDb();
  process.env.ENABLE_RATE_LIMIT = "1";
});
afterAll(async () => {
  delete process.env.ENABLE_RATE_LIMIT;
  await disconnectDb();
});

// Each limiter's counter survives between tests, so every test uses its own address.
const from = (agent, ip) => {
  app.set("trust proxy", true);
  return ip ? agent.set("X-Forwarded-For", ip) : agent;
};

test("login: failures on one identifier do not lock another, until the per-address limit", async () => {
  await clearDb();
  const agent = await guest(app);
  const ip = "10.0.0.1";
  const attempt = (username) =>
    from(agent.post("/login"), ip).type("form").send({ username, password: "y" });
  for (let i = 0; i < 10; i++) expect((await attempt("victim")).status).toBe(302);
  expect((await attempt("VICTIM")).status).toBe(429);
  expect((await attempt("someone-else")).status).toBe(302);
  // 12 used so far, counting the refused one. The wider limit is 30.
  for (let i = 0; i < 18; i++) await attempt(`person${i}`);
  expect((await attempt("yet-another")).status).toBe(429);
});

test("signup is limited per address", async () => {
  const agent = await guest(app);
  const attempt = () => from(agent.post("/signup"), "10.0.0.2").type("form").send({});
  for (let i = 0; i < 10; i++) expect((await attempt()).status).toBe(302);
  expect((await attempt()).status).toBe(429);
});

test("forgot password is limited per address and per email", async () => {
  const agent = await guest(app);
  const attempt = (ip, email) =>
    from(agent.post("/forgot-password"), ip).type("form").send({ email });
  for (let i = 0; i < 5; i++) await attempt("10.0.0.3", `p${i}@example.com`);
  expect((await attempt("10.0.0.3", "new@example.com")).status).toBe(429);
  for (let i = 0; i < 5; i++) await attempt(`10.0.1.${i}`, "target@example.com");
  expect((await attempt("10.0.2.1", "TARGET@example.com")).status).toBe(429);
});

test("reset is limited per address", async () => {
  const attempt = () => from(request(app).get("/health"), "10.0.0.4");
  expect((await attempt()).status).toBe(200);
  const agent = await guest(app);
  const post = () =>
    from(agent.post("/reset-password/abc"), "10.0.0.4").type("form").send({});
  for (let i = 0; i < 10; i++) await post();
  expect((await post()).status).toBe(429);
});

test("support messages are limited per address", async () => {
  const agent = await guest(app);
  const post = () => from(agent.post("/contact"), "10.0.0.5").type("form").send({});
  for (let i = 0; i < 5; i++) expect((await post()).status).toBe(400);
  expect((await post()).status).toBe(429);
});

test("resending a verification link is limited per user", async () => {
  await createUser("resender");
  const agent = await login(app, "resender");
  mailer.outbox.length = 0;
  const post = () => agent.post("/verify-email/resend");
  for (let i = 0; i < 5; i++) await post();
  expect(mailer.outbox).toHaveLength(5);
  expect((await post()).status).toBe(429);
});

test("health is never limited", async () => {
  for (let i = 0; i < 40; i++) expect((await request(app).get("/health")).status).toBe(200);
});
