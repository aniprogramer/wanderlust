const request = require("supertest");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const app = require("../../app");
const Listing = require("../../models/listing");
const { connectDb, disconnectDb, clearDb, createUser, login, guest } = require("../helpers");

beforeAll(connectDb);
afterAll(disconnectDb);
beforeEach(async () => {
  await clearDb();
  await Listing.init();
});

// The email reminder is also a pop-up; these tests look at the messages an action produced
const toastsOf = (html) => cheerio.load(html)(".wl-toasts [data-toast]:not([data-verify-banner])");

describe("pop-up notifications", () => {
  test("a login success renders inside the pop-up container as a polite status", async () => {
    await createUser("alice");
    // Signed in by hand: the login helper loads a page afterwards and would use the message up
    const agent = await guest(app);
    await agent.post("/login").type("form").send({ username: "alice", password: "password123" });
    const $ = cheerio.load((await agent.get("/listings")).text);
    const toast = $(".wl-toasts .wl-toast.wl-auth-alert--success");
    expect(toast).toHaveLength(1);
    expect(toast.text()).toContain("Logged in Successfully!");
    expect(toast.attr("role")).toBe("status");
    expect(toast.attr("aria-live")).toBe("polite");
    expect(toast.attr("data-autodismiss")).toBeDefined();
  });

  test("an error is assertive, stays until closed and has a named close button", async () => {
    await createUser("alice");
    const agent = await login(app, "alice");
    await agent.get("/listings"); // shows and consumes the login message
    await agent.get("/listings/507f1f77bcf86cd799439011"); // a missing stay flashes an error
    const $ = cheerio.load((await agent.get("/listings")).text);
    const toast = $(".wl-toasts .wl-toast.wl-auth-alert--error");
    expect(toast).toHaveLength(1);
    expect(toast.attr("role")).toBe("alert");
    expect(toast.attr("aria-live")).toBe("assertive");
    expect(toast.attr("data-autodismiss")).toBeUndefined();
    expect(toast.find("[data-toast-close]").attr("aria-label")).toBe("Dismiss notification");
  });

  test("warnings are assertive and stay too", async () => {
    await createUser("alice");
    const agent = await login(app, "alice");
    await agent.get("/listings");
    const res = await agent.get("/listings/new"); // guest mode: a host page
    expect(res.headers.location).toBe("/listings");
    const toast = cheerio.load((await agent.get("/listings")).text)(".wl-toast.wl-auth-alert--warning");
    expect(toast).toHaveLength(1);
    expect(toast.attr("role")).toBe("alert");
    expect(toast.attr("data-autodismiss")).toBeUndefined();
  });

  test("every kind of flash renders on every kind of page, once", async () => {
    await createUser("alice");
    const agent = await login(app, "alice");
    await agent.get("/listings"); // shows and consumes the login message
    // Home (app shell) and two plain pages (navbar layout)
    for (const url of ["/listings", "/help", "/users/alice"]) {
      await agent.post("/mode").type("form").send({ mode: "guest", returnTo: url });
      const html = (await agent.get(url)).text;
      expect([url, toastsOf(html).length]).toEqual([url, 1]);
    }
    const visitor = request.agent(app);
    await visitor.get("/login");
    const html = (await visitor.get("/login")).text;
    expect(cheerio.load(html)(".wl-toasts").length).toBe(1);
  });

  test("no message is rendered outside the container, and the old inline alerts are gone", async () => {
    await createUser("alice");
    const agent = await login(app, "alice");
    const $ = cheerio.load((await agent.get("/listings")).text);
    expect($(".wl-auth-alert--success").not(".wl-toast")).toHaveLength(0);
    expect($(".wl-flash, .wl-banner, .wl-flash-stack").length).toBe(0);
    expect($("[data-flash-close], [data-banner-close]").length).toBe(0);
  });

  test("the login page still shows a failed sign-in as a pop-up", async () => {
    await createUser("alice");
    const agent = request.agent(app);
    const token = /name="_csrf" value="([^"]+)"/.exec((await agent.get("/login")).text)[1];
    const res = await agent
      .post("/login")
      .type("form")
      .send({ _csrf: token, username: "alice", password: "wrong-password-1" });
    expect(res.headers.location).toBe("/login");
    const toast = cheerio.load((await agent.get("/login")).text)(".wl-toast.wl-auth-alert--error");
    expect(toast.text()).toContain("Incorrect username or password.");
  });

  test("field-level validation stays inline beside its field", async () => {
    const html = (await request(app).get("/contact")).text;
    const $ = cheerio.load(html);
    // The inline error slots exist next to fields and are not part of the toast container
    expect($(".wl-field__error").length).toBeGreaterThan(0);
    expect($(".wl-toasts .wl-field__error").length).toBe(0);
  });

  test("the email reminder is a floating pop-up too, last in the stack, and never in the page flow", async () => {
    await createUser("alice");
    const agent = await login(app, "alice");
    const $ = cheerio.load((await agent.get("/help")).text);
    const reminder = $(".wl-toasts [data-verify-banner]");
    expect(reminder).toHaveLength(1);
    expect(reminder.hasClass("wl-toast")).toBe(true);
    expect(reminder.attr("role")).toBe("status");
    expect(reminder.attr("data-autodismiss")).toBeDefined();
    expect(reminder.find("a[href='/verify-email']").length).toBe(1);
    expect(reminder.find("[data-toast-close]").attr("aria-label")).toBe("Dismiss notification");
    // Nothing of it sits outside the container, so it takes no room from the page
    expect($("[data-verify-banner]").length).toBe(1);
    expect($(".wl-banner, .wl-flash-stack, .wl-flash-container").length).toBe(0);
    // Last, so a message the person's own action produced is never pushed behind it
    expect($(".wl-toasts [data-toast]").last().attr("data-verify-banner")).toBeDefined();
  });

  test("a verified user gets no reminder", async () => {
    const user = await createUser("alice");
    await require("../../models/user").updateOne({ _id: user._id }, { emailVerifiedAt: new Date() });
    const agent = await login(app, "alice");
    expect(cheerio.load((await agent.get("/help")).text)("[data-verify-banner]").length).toBe(0);
  });

  test("the script keeps the documented timings and limits", () => {
    const js = fs.readFileSync(path.join(__dirname, "../../public/js/flash.js"), "utf8");
    expect(js).toMatch(/AUTO_DISMISS_MS = 5000/);
    expect(js).toMatch(/MAX_VISIBLE = 3/);
    expect(js).toMatch(/Escape/);
    expect(js).not.toMatch(/\.focus\(/);
  });
});
