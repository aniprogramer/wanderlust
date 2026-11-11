const request = require("supertest");
const cheerio = require("cheerio");
const app = require("../../app");
const Listing = require("../../models/listing");
const Booking = require("../../models/booking");
const User = require("../../models/user");
const { connectDb, disconnectDb, clearDb, createUser, createListing, login, guest, day } = require("../helpers");

beforeAll(connectDb);
afterAll(disconnectDb);
beforeEach(async () => {
  await clearDb();
  await Listing.init();
});

const links = (html) => {
  const $ = cheerio.load(html);
  return $(".navbar a.nav-link")
    .map((_, el) => $(el).text().trim())
    .get();
};
const logIn = (agent, body) =>
  agent.post("/login").type("form").send({ username: "alice", password: "password123", ...body });
const switchTo = (agent, mode, returnTo) => agent.post("/mode").type("form").send({ mode, returnTo });
// Reads the pop-up text that the redirect target shows
const messageAfter = async (agent, res) =>
  cheerio.load((await agent.get(res.headers.location)).text)(".wl-toast").text();
const modeOf = async (agent) =>
  cheerio.load((await agent.get("/users/alice")).text)(".wl-mode-switch").attr("data-mode");

describe("the starting mode is chosen at sign-up, not at login", () => {
  test("login uses the saved starting mode and ignores anything posted", async () => {
    for (const [i, [startingMode, body, expected]] of [
      ["host", {}, "host"],
      ["guest", {}, "guest"],
      ["guest", { mode: "host" }, "guest"],
      ["host", { mode: "guest" }, "host"],
      ["guest", { mode: "admin" }, "guest"],
    ].entries()) {
      const username = `user${i}`;
      await createUser(username);
      await User.updateOne({ username }, { startingMode });
      const agent = await guest(app);
      await agent.post("/login").type("form").send({ username, password: "password123", ...body });
      const $ = cheerio.load((await agent.get(`/users/${username}`)).text);
      expect($(".wl-mode-switch").attr("data-mode")).toBe(expected);
    }
  });

  test("the login form has no mode control", async () => {
    const $ = cheerio.load((await request(app).get("/login")).text);
    expect($('input[name="mode"]')).toHaveLength(0);
    expect($("form[action='/login'] fieldset")).toHaveLength(0);
    expect($("form[action='/login']").text()).not.toContain("Continue as");
  });

  test("sign-up requires the choice: native radios, a visible legend, nothing preselected", async () => {
    const $ = cheerio.load((await request(app).get("/signup")).text);
    expect($("fieldset.wl-segmented legend").text()).toBe("I want to:");
    const radios = $('fieldset input[type="radio"][name="startingMode"]');
    expect(radios.map((_, el) => $(el).attr("value")).get()).toEqual(["guest", "host"]);
    expect(radios.filter("[checked]")).toHaveLength(0);
    expect($("fieldset").text()).toContain("Find stays");
    expect($("fieldset").text()).toContain("Host stays");

    const signup = (extra) => ({
      username: "bob", email: "bob@example.com", password: "Secret123!", confirmPassword: "Secret123!", terms: "on", ...extra,
    });
    for (const bad of [{}, { startingMode: "admin" }]) {
      const agent = await guest(app);
      const res = await agent.post("/signup").type("form").send(signup(bad));
      expect(res.headers.location).toBe("/signup");
      expect((await agent.get("/signup")).text).toContain("Choose whether you want to find stays");
      expect(await User.countDocuments()).toBe(0);
    }
  });

  test.each([
    ["host", "/listings/mine"],
    ["guest", "/listings"],
  ])("signing up to %s saves it, starts there and lands on %s", async (startingMode, home) => {
    const agent = await guest(app);
    const res = await agent.post("/signup").type("form").send({
      username: "bob", email: "bob@example.com", password: "Secret123!", confirmPassword: "Secret123!", terms: "on", startingMode,
    });
    expect(res.headers.location).toBe(home);
    expect((await User.findOne({ username: "bob" })).startingMode).toBe(startingMode);
    const $ = cheerio.load((await agent.get("/users/bob")).text);
    expect($(".wl-mode-switch").attr("data-mode")).toBe(startingMode);
  });

  test("the header switch changes the session only, not the saved default", async () => {
    await createUser("alice");
    const agent = await login(app, "alice");
    await switchTo(agent, "host", "/account");
    expect(await modeOf(agent)).toBe("host");
    expect((await User.findOne({ username: "alice" })).startingMode).toBe("guest");
  });

  test("a mode switched while signed in survives a login in the same session", async () => {
    await createUser("alice");
    const agent = await login(app, "alice");
    await switchTo(agent, "host", "/account");
    await logIn(agent, {});
    expect(await modeOf(agent)).toBe("host");
  });

  test("account settings save a new default without touching this session", async () => {
    await createUser("alice");
    const agent = await login(app, "alice");
    const page = cheerio.load((await agent.get("/users/alice")).text);
    expect(page("[data-starting-mode]").closest("section, div").text()).toBeTruthy();
    expect(page.text()).toContain("Your default mode when you log in");
    expect(page('[data-starting-mode] input[value="guest"]').attr("checked")).toBeDefined();

    await agent.post("/account/starting-mode").type("form").send({ startingMode: "host" });
    expect((await User.findOne({ username: "alice" })).startingMode).toBe("host");
    expect(await modeOf(agent)).toBe("guest");

    await agent.post("/account/starting-mode").type("form").send({ startingMode: "admin" });
    expect((await User.findOne({ username: "alice" })).startingMode).toBe("host");

    const next = await guest(app);
    await logIn(next, {});
    expect(await modeOf(next)).toBe("host");
  });

  test("a saved host-only page opens for a host and explains itself to a guest", async () => {
    for (const [startingMode, location, explains] of [
      ["host", "/listings/new", false],
      ["guest", "/listings", true],
    ]) {
      await clearDb();
      await createUser("alice");
      await User.updateOne({ username: "alice" }, { startingMode });
      const agent = await guest(app);
      await agent.get("/listings/new"); // not signed in: the page is remembered
      const res = await logIn(agent, {});
      expect(res.headers.location).toBe(location);
      const text = await messageAfter(agent, res);
      expect(/Switch to host/.test(text)).toBe(explains);
    }
  });

  test("logging out clears the switched mode", async () => {
    await createUser("alice");
    const agent = await login(app, "alice", "host");
    await agent.post("/logout");
    // Logout starts a new session, so the form token is read again
    agent.csrfToken = /name="_csrf" value="([^"]+)"/.exec((await agent.get("/login")).text)[1];
    await logIn(agent, {});
    expect(await modeOf(agent)).toBe("guest");
  });
});

describe("header and navigation", () => {
  test("guest links, then host links after switching", async () => {
    await createUser("alice");
    const agent = await login(app, "alice");
    let html = (await agent.get("/users/alice")).text;
    expect(links(html)).toEqual(expect.arrayContaining(["Explore", "Saved", "Trips"]));
    expect(links(html)).not.toContain("Reservations");
    expect(cheerio.load(html)(".wl-mode-switch button").text().trim()).toBe("Switch to host");

    await switchTo(agent, "host", "/account");
    html = (await agent.get("/users/alice")).text;
    expect(links(html)).toEqual(expect.arrayContaining(["Your listings", "Create listing", "Reservations"]));
    expect(links(html)).not.toContain("Trips");
    expect(cheerio.load(html)(".wl-mode-switch button").text().trim()).toBe("Switch to guest");
  });

  test("the sidebar on the home page follows the mode too", async () => {
    await createUser("alice");
    const agent = await login(app, "alice", "host");
    const $ = cheerio.load((await agent.get("/listings")).text);
    const side = $(".wl-nav-link span")
      .map((_, el) => $(el).text())
      .get();
    expect(side).toEqual(["Your listings", "Create listing", "Reservations"]);
  });

  test("the switch is a POST form with a CSRF token; a GET never switches", async () => {
    await createUser("alice");
    const agent = await login(app, "alice");
    const $ = cheerio.load((await agent.get("/users/alice")).text);
    const form = $("form.wl-mode-switch");
    expect(form.attr("action")).toBe("/mode");
    expect(form.attr("method")).toBe("POST");
    expect(form.find('input[name="_csrf"]').length).toBe(1);
    await agent.get("/mode?mode=host");
    expect(await modeOf(agent)).toBe("guest");
  });

  test("the account menu has the same items in both modes", async () => {
    await createUser("alice");
    const seen = [];
    for (const mode of ["guest", "host"]) {
      const agent = await login(app, "alice", mode);
      const $ = cheerio.load((await agent.get("/listings")).text);
      seen.push(
        $(".wl-dropdown-menu li:not(.d-lg-none) .dropdown-item")
          .map((_, el) => $(el).text().trim())
          .get(),
      );
    }
    expect(seen[0]).toEqual(["Profile", "Log out"]);
    expect(seen[1]).toEqual(seen[0]);
  });
});

describe("POST /mode", () => {
  test("needs a login, a valid value and a CSRF token", async () => {
    await createUser("alice");
    const visitor = await guest(app);
    expect((await switchTo(visitor, "host")).headers.location).toBe("/login");

    const agent = await login(app, "alice");
    expect((await switchTo(agent, "admin")).status).toBe(400);
    expect((await switchTo(agent, "")).status).toBe(400);

    const bare = request.agent(app);
    expect((await bare.post("/mode").type("form").send({ mode: "host" })).status).toBe(403);
  });

  test("stays on a page that exists in the new mode, otherwise goes to the mode's home", async () => {
    await createUser("alice");
    const owner = await createUser("host");
    const listing = await createListing(owner);
    const agent = await login(app, "alice");
    expect((await switchTo(agent, "host", `/listings/${listing._id}`)).headers.location).toBe(`/listings/${listing._id}`);
    expect((await switchTo(agent, "host", "/account")).headers.location).toBe("/account");
    expect((await switchTo(agent, "host", "/wishlist")).headers.location).toBe("/listings/mine");
    expect((await switchTo(agent, "guest", "/listings/new")).headers.location).toBe("/listings");
    expect((await switchTo(agent, "guest", "/bookings/hosting")).headers.location).toBe("/listings");
  });

  test("never follows a return address that leaves the site", async () => {
    await createUser("alice");
    const agent = await login(app, "alice");
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)"]) {
      expect((await switchTo(agent, "host", bad)).headers.location).toBe("/listings/mine");
      await switchTo(agent, "guest");
    }
  });

  test("confirms the switch in a message", async () => {
    await createUser("alice");
    const agent = await login(app, "alice");
    const res = await switchTo(agent, "host", "/users/alice");
    expect(await messageAfter(agent, res)).toContain("host mode");
  });
});

describe("guards", () => {
  const setup = async () => {
    const owner = await createUser("alice");
    const bob = await createUser("bob");
    const listing = await createListing(owner);
    return { owner, bob, listing };
  };

  test("a guest-mode owner is sent away from host pages with an explanation", async () => {
    const { listing } = await setup();
    const agent = await login(app, "alice");
    for (const url of ["/listings/new", "/listings/mine", `/listings/${listing._id}/edit`, "/bookings/hosting"]) {
      const res = await agent.get(url);
      expect([url, res.status, res.headers.location]).toEqual([url, 302, "/listings"]);
      expect(await messageAfter(agent, res)).toContain("Switch to host mode");
    }
  });

  test("a host-mode user is sent away from guest pages with an explanation", async () => {
    await setup();
    const agent = await login(app, "bob", "host");
    for (const url of ["/bookings", "/wishlist"]) {
      const res = await agent.get(url);
      expect([url, res.status, res.headers.location]).toEqual([url, 302, "/listings/mine"]);
      expect(await messageAfter(agent, res)).toContain("Switch to guest mode");
    }
  });

  test("a host can still read every public page", async () => {
    const { listing } = await setup();
    const agent = await login(app, "bob", "host");
    for (const url of ["/listings", `/listings/${listing._id}`, "/listings/map", "/help", "/users/bob"]) {
      expect([url, (await agent.get(url)).status]).toEqual([url, 200]);
    }
  });

  test("the owner cannot edit, delete or block dates from guest mode", async () => {
    const { listing } = await setup();
    const agent = await login(app, "alice");
    const put = await agent.put(`/listings/${listing._id}`).type("form").send({ listing: { title: "Changed" } });
    const del = await agent.delete(`/listings/${listing._id}`);
    const block = await agent.post(`/listings/${listing._id}/blocks`).type("form").send({ from: day(5), to: day(6) });
    expect([put.status, del.status, block.status]).toEqual([302, 302, 302]);
    const fresh = await Listing.findById(listing._id);
    expect(fresh).not.toBeNull();
    expect(fresh.title).toBe("Cozy Cabin");
    expect(fresh.blockedRanges || []).toHaveLength(0);
  });

  test("a host-mode user cannot request, save or review", async () => {
    const { listing } = await setup();
    const agent = await login(app, "bob", "host");
    const book = await agent
      .post(`/listings/${listing._id}/bookings`)
      .type("form")
      .send({ booking: { checkIn: day(5), checkOut: day(7), guests: 1 } });
    const save = await agent.post(`/wishlist/${listing._id}`);
    const review = await agent
      .post(`/listings/${listing._id}/reviews`)
      .type("form")
      .send({ review: { rating: 5, comment: "Lovely quiet stay here" } });
    expect([book.status, save.status, review.status]).toEqual([302, 302, 302]);
    expect(await Booking.countDocuments()).toBe(0);
    expect((await Listing.findById(listing._id)).reviews).toHaveLength(0);
    expect((await User.findOne({ username: "bob" })).wishlist || []).toHaveLength(0);
  });

  test("guest mode still saves and opens Saved", async () => {
    const { listing } = await setup();
    const agent = await login(app, "bob");
    expect((await agent.post(`/wishlist/${listing._id}`)).headers.location).not.toBe("/listings/mine");
    expect((await agent.get("/wishlist")).status).toBe(200);
  });

  test("accepting and cancelling follow the role and the mode", async () => {
    const { bob, listing } = await setup();
    const booking = await Booking.create({
      listing: listing._id,
      guest: bob._id,
      status: "pending",
      checkIn: new Date(day(4)),
      checkOut: new Date(day(5)),
      nights: [new Date(day(4))],
      totalPrice: 1,
      expiresAt: new Date(Date.now() + 36e5),
    });
    const hostInGuestMode = await login(app, "alice");
    const accept = await hostInGuestMode.post(`/bookings/${booking._id}/accept`);
    expect(accept.headers.location).toBe("/listings");
    expect((await Booking.findById(booking._id)).status).toBe("pending");

    // The guest cannot cancel their own request from host mode
    const bobAsHost = await login(app, "bob", "host");
    await bobAsHost.delete(`/bookings/${booking._id}`).type("form").send({ reason: "" });
    expect((await Booking.findById(booking._id)).status).toBe("pending");

    // Both parties can still read the booking in either mode
    expect((await hostInGuestMode.get(`/bookings/${booking._id}`)).status).toBe(200);
    expect((await bobAsHost.get(`/bookings/${booking._id}`)).status).toBe(200);

    const hostAgent = await login(app, "alice", "host");
    await hostAgent.post(`/bookings/${booking._id}/accept`);
    expect((await Booking.findById(booking._id)).status).toBe("confirmed");
  });
});

describe("Your listings", () => {
  test("empty state names the next step; owners see only their own", async () => {
    await createUser("alice");
    const bob = await createUser("bob");
    await createListing(bob, { title: "Bob's Barn" });
    const agent = await login(app, "alice", "host");
    let $ = cheerio.load((await agent.get("/listings/mine")).text);
    expect($(".wl-empty__title").text()).toBe("You have no listings yet");
    expect($(".wl-empty a").text().trim()).toBe("Create listing");
    expect($(".wl-empty a").attr("href")).toBe("/listings/new");

    const alice = await User.findOne({ username: "alice" });
    await createListing(alice, { title: "Alice's Attic" });
    $ = cheerio.load((await agent.get("/listings/mine")).text);
    expect($("body").text()).toContain("Alice's Attic");
    expect($("body").text()).not.toContain("Bob's Barn");
    expect($(".wl-empty").length).toBe(0);
  });

  test("a host in host mode can open the create form", async () => {
    await createUser("alice");
    const agent = await login(app, "alice", "host");
    expect((await agent.get("/listings/new")).status).toBe(200);
  });
});
