const cheerio = require("cheerio");
const request = require("supertest");
const app = require("../../app");
const User = require("../../models/user");
const SupportMessage = require("../../models/supportMessage");
const mailer = require("../../utils/mailer");
const { TERMS_VERSION } = require("../../utils/siteInfo");
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
beforeEach(async () => {
  await clearDb();
  mailer.outbox.length = 0;
});

const LEGAL = [
  ["/privacy", "Privacy Policy"],
  ["/terms", "Terms of Service"],
  ["/cancellation-policy", "Cancellation Policy"],
  ["/house-rules", "House Rules"],
];

describe("legal pages", () => {
  test.each(LEGAL)("%s renders with one h1 and a unique title", async (url, title) => {
    const res = await (await guest(app)).get(url);
    expect(res.status).toBe(200);
    const $ = cheerio.load(res.text);
    expect($("h1")).toHaveLength(1);
    expect($("h1").text()).toBe(title);
    expect($("title").text()).toBe(`${title} | Wanderlust`);
    expect(res.text).toContain("Draft: this page is awaiting legal review.");
  });

  test("placeholders are visible instead of invented facts", async () => {
    const terms = (await (await guest(app)).get("/terms")).text;
    expect(terms).toContain("[Company legal name]");
    expect(terms).toContain("[Registered address]");
    expect(terms).toContain("[Governing law and jurisdiction]");
    const privacy = (await (await guest(app)).get("/privacy")).text;
    expect(privacy).toContain("[Support email]");
    expect(privacy).toContain("MongoDB Atlas");
    expect(privacy).toContain("Cloudinary");
    expect(privacy).toContain("Mapbox");
  });

  test("no rendered public page has a dead href", async () => {
    const agent = await guest(app);
    for (const url of ["/listings", "/help", "/contact", "/login", "/signup", ...LEGAL.map(([u]) => u)]) {
      const { text } = await agent.get(url);
      expect(text).not.toMatch(/href="#"/);
    }
  });

  test("the footer links every policy, help and contact", async () => {
    const { text } = await (await guest(app)).get("/listings");
    for (const href of ["/privacy", "/terms", "/cancellation-policy", "/house-rules", "/help", "/contact"]) {
      expect(text).toContain(`href="${href}"`);
    }
  });
});

describe("signup agreement", () => {
  const body = { username: "bob", email: "bob@example.com", password: "Secret123!", confirmPassword: "Secret123!" };

  test("is refused without the box ticked", async () => {
    const agent = await guest(app);
    const res = await agent.post("/signup").type("form").send(body);
    expect(res.headers.location).toBe("/signup");
    expect(await User.countDocuments()).toBe(0);
    expect((await agent.get("/signup")).text).toContain("Accept the Terms");
  });

  test("records when and which version was accepted", async () => {
    const agent = await guest(app);
    await agent.post("/signup").type("form").send({ ...body, terms: "on", startingMode: "guest" });
    const user = await User.findOne({ username: "bob" });
    expect(user.termsAcceptedAt).toBeInstanceOf(Date);
    expect(user.termsVersion).toBe(TERMS_VERSION);
  });
});

describe("help", () => {
  test("uses native disclosures and ends with a contact link", async () => {
    const $ = cheerio.load((await (await guest(app)).get("/help")).text);
    expect($("details.wl-disclosure").length).toBeGreaterThanOrEqual(6);
    expect($("main a[href='/contact']").length).toBeGreaterThan(0);
  });
});

describe("contact", () => {
  const valid = {
    name: "Asha",
    email: "asha@example.com",
    topic: "Hosting",
    message: "I would like some help with my listing.",
  };
  const send = async (agent, body) => {
    return agent.post("/contact").type("form").send(body);
  };

  test("prefills a signed-in user", async () => {
    await createUser("alice");
    const agent = await login(app, "alice");
    const $ = cheerio.load((await agent.get("/contact")).text);
    expect($("#name").attr("value")).toBe("alice");
    expect($("#email").attr("value")).toBe("alice@example.com");
  });

  test("saves, emails support and the sender, then shows a reference", async () => {
    process.env.SUPPORT_EMAIL = "help@example.com";
    const agent = await guest(app);
    const res = await send(agent, valid);
    delete process.env.SUPPORT_EMAIL;
    expect(res.status).toBe(302);
    const saved = await SupportMessage.findOne();
    expect(saved.reference).toMatch(/^WL-[0-9A-F]{8}$/);
    expect(mailer.outbox.map((m) => m.to).sort()).toEqual(["asha@example.com", "help@example.com"]);
    const done = await agent.get(res.headers.location);
    expect(done.text).toContain(saved.reference);
  });

  test("a mail failure keeps the message and still shows the reference", async () => {
    const spy = jest.spyOn(mailer, "send").mockRejectedValue(new Error("smtp down"));
    const agent = await guest(app);
    const res = await send(agent, valid);
    spy.mockRestore();
    const saved = await SupportMessage.findOne();
    expect(saved).not.toBeNull();
    expect((await agent.get(res.headers.location)).text).toContain(saved.reference);
  });

  test("invalid input is explained inline and keeps what was typed", async () => {
    const agent = await guest(app);
    const res = await send(agent, { ...valid, email: "nope", message: "short", topic: "Hacking" });
    expect(res.status).toBe(400);
    const $ = cheerio.load(res.text);
    expect($("#email").attr("aria-invalid")).toBe("true");
    expect($("#email-error").text()).toContain("valid email");
    expect($("#message-error").text()).toContain("at least 10");
    expect($("#topic-error").text()).toContain("Choose a topic");
    expect($("#message").text()).toBe("short");
    expect(await SupportMessage.countDocuments()).toBe(0);
  });

  test("requires a CSRF token", async () => {
    const res = await request.agent(app).post("/contact").type("form").send(valid);
    expect(res.status).toBe(403);
    expect(await SupportMessage.countDocuments()).toBe(0);
  });
});
