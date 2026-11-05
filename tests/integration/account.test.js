const request = require("supertest");
const app = require("../../app");
const User = require("../../models/user");
const Listing = require("../../models/listing");
const Booking = require("../../models/booking");
const Review = require("../../models/review");
const mailer = require("../../utils/mailer");
const { requireVerifiedEmail } = require("../../middleware");
const {
  connectDb,
  disconnectDb,
  clearDb,
  createUser,
  login,
  guest,
  createListing,
  day,
} = require("../helpers");

jest.mock("../../cloudConfig", () => ({
  uploader: { upload: jest.fn(), destroy: jest.fn().mockResolvedValue({}) },
}));

beforeAll(connectDb);
afterAll(disconnectDb);
beforeEach(async () => {
  await clearDb();
  mailer.outbox.length = 0;
});

const tokenIn = (mail) => mail.text.match(/verify-email\/([0-9a-f]{64})/)[1];

describe("email verification", () => {
  const signup = async () => {
    const agent = await guest(app);
    await agent.post("/signup").type("form").send({
      username: "bob",
      email: "bob@example.com",
      password: "secret123",
      terms: "on",
    });
    return agent;
  };

  test("signup emails a link that confirms once; only a hash is stored", async () => {
    const agent = await signup();
    const token = tokenIn(mailer.outbox[0]);
    const before = await User.findOne({ username: "bob" }).select("+verifyTokenHash");
    expect(before.emailVerifiedAt).toBeUndefined();
    expect(before.verifyTokenHash).not.toBe(token);

    await agent.get(`/verify-email/${token}`);
    expect((await User.findOne({ username: "bob" })).emailVerifiedAt).toBeInstanceOf(Date);
    const again = await agent.get(`/verify-email/${token}`);
    expect(again.headers.location).toBe("/verify-email");
  });

  test("an expired link does nothing", async () => {
    const agent = await signup();
    await User.updateOne({}, { verifyTokenExpires: new Date(Date.now() - 1000) });
    await agent.get(`/verify-email/${tokenIn(mailer.outbox[0])}`);
    expect((await User.findOne()).emailVerifiedAt).toBeUndefined();
  });

  test("the banner shows until confirmed, and resend replaces the link", async () => {
    const agent = await signup();
    expect((await agent.get("/listings")).text).toContain("data-verify-banner");
    // Signing up rotated the session, so the token the agent holds is stale
    agent.csrfToken = /name="_csrf" value="([^"]+)"/.exec((await agent.get("/verify-email")).text)[1];
    await agent.post("/verify-email/resend");
    const fresh = mailer.outbox.at(-1);
    await agent.get(`/verify-email/${tokenIn(mailer.outbox[0])}`);
    expect((await User.findOne()).emailVerifiedAt).toBeUndefined();
    await agent.get(`/verify-email/${tokenIn(fresh)}`);
    expect((await User.findOne()).emailVerifiedAt).toBeInstanceOf(Date);
    expect((await agent.get("/listings")).text).not.toContain("data-verify-banner");
  });

  describe("the production gate", () => {
    const original = process.env.NODE_ENV;
    afterEach(() => {
      process.env.NODE_ENV = original;
    });

    test("stops listing and requesting, not browsing", async () => {
      const owner = await createUser("alice");
      const listing = await createListing(owner);
      await createUser("bob");
      const agent = await login(app, "bob");
      process.env.NODE_ENV = "production";
      const newForm = await agent.get("/listings/new");
      const post = await agent
        .post(`/listings/${listing._id}/bookings`)
        .type("form")
        .send({ booking: { checkIn: day(5), checkOut: day(6) } });
      const browse = await agent.get(`/listings/${listing._id}`);
      process.env.NODE_ENV = original;
      expect(newForm.headers.location).toBe("/verify-email");
      expect(post.headers.location).toBe("/verify-email");
      expect(browse.status).toBe(200);
      expect(await Booking.countDocuments()).toBe(0);
    });

    test("lets confirmed users through and is off outside production", () => {
      const res = { redirect: jest.fn() };
      const next = jest.fn();
      process.env.NODE_ENV = "production";
      requireVerifiedEmail({ user: { emailVerifiedAt: new Date() } }, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      process.env.NODE_ENV = "development";
      requireVerifiedEmail({ user: {} }, res, next);
      expect(next).toHaveBeenCalledTimes(2);
      expect(res.redirect).not.toHaveBeenCalled();
    });
  });
});

describe("account page", () => {
  test("requires login on every route", async () => {
    const agent = await guest(app);
    for (const res of [
      await agent.get("/account"),
      await agent.get("/account/export"),
      await agent.post("/account/profile"),
      await agent.post("/account/password"),
      await agent.post("/account/delete"),
    ]) {
      expect(res.headers.location).toBe("/login");
    }
  });

  test("requires a CSRF token on every write", async () => {
    await createUser("alice");
    const agent = await login(app);
    for (const url of ["/account/profile", "/account/password", "/account/delete"]) {
      // The helper adds the token, so these go out without it through a raw cookie-carrying agent
      const res = await request(app).post(url).set("Cookie", agent.jar.getCookies({ path: "/", domain: "127.0.0.1", secure: false, script: false }).toValueString());
      expect(res.status).toBe(403);
    }
    expect(await User.countDocuments()).toBe(1);
  });

  test("a rename keeps the session working", async () => {
    await createUser("alice");
    const agent = await login(app);
    await agent.post("/account/profile").type("form").send({ username: "alicia", email: "alice@example.com" });
    expect(await User.countDocuments({ username: "alicia" })).toBe(1);
    expect((await agent.get("/account")).status).toBe(200);
  });

  test("a new email must be confirmed again", async () => {
    const user = await createUser("alice");
    await User.updateOne({ _id: user._id }, { emailVerifiedAt: new Date() });
    const agent = await login(app);
    await agent.post("/account/profile").type("form").send({ username: "alice", email: "new@example.com" });
    const updated = await User.findById(user._id);
    expect(updated.email).toBe("new@example.com");
    expect(updated.emailVerifiedAt).toBeUndefined();
    expect(mailer.outbox.at(-1).to).toBe("new@example.com");
  });

  test("a taken username or email is explained", async () => {
    await createUser("alice");
    await createUser("bob");
    const agent = await login(app);
    await agent.post("/account/profile").type("form").send({ username: "alice", email: "bob@example.com" });
    expect((await agent.get("/account")).text).toContain("already registered");
    expect((await User.findOne({ username: "alice" })).email).toBe("alice@example.com");
  });

  test("changing the password needs the current one and signs out other devices", async () => {
    await createUser("alice");
    const here = await login(app);
    const there = await login(app);

    await here.post("/account/password").type("form").send({ currentPassword: "wrong-pass1", password: "brand-new-pass1" });
    expect((await here.get("/account")).text).toContain("current password is not right");

    await new Promise((resolve) => setTimeout(resolve, 5));
    await here.post("/account/password").type("form").send({ currentPassword: "password123", password: "brand-new-pass1" });
    expect((await here.get("/account")).status).toBe(200);
    expect((await there.get("/account")).headers.location).toBe("/login");
    expect(mailer.outbox.at(-1).subject).toContain("password was changed");
  });

  test("a weak new password is refused", async () => {
    await createUser("alice");
    const agent = await login(app);
    await agent.post("/account/password").type("form").send({ currentPassword: "password123", password: "short" });
    const user = await User.findOne().select("+hash +salt");
    expect((await user.authenticate("password123")).user).toBeTruthy();
  });

  test("the export holds the user's data and no secrets", async () => {
    const alice = await createUser("alice");
    const owner = await createUser("host");
    const listing = await createListing(owner);
    await Booking.create({
      listing: listing._id,
      guest: alice._id,
      checkIn: new Date(day(5)),
      checkOut: new Date(day(6)),
      nights: [new Date(day(5))],
      totalPrice: 1,
    });
    await User.updateOne({ _id: alice._id }, { wishlist: [listing._id] });
    const agent = await login(app);
    const res = await agent.get("/account/export");
    expect(res.headers["content-disposition"]).toContain("attachment");
    const data = JSON.parse(res.text);
    expect(data.account.email).toBe("alice@example.com");
    expect(data.bookings).toHaveLength(1);
    expect(data.wishlist).toHaveLength(1);
    expect(res.text).not.toMatch(/"(hash|salt|resetTokenHash)"/);
  });
});

describe("deleting an account", () => {
  const remove = (agent, over = {}) =>
    agent.post("/account/delete").type("form").send({
      currentPassword: "password123",
      confirm: "DELETE",
      ...over,
    });

  test("needs the password and the word DELETE", async () => {
    await createUser("alice");
    const agent = await login(app);
    await remove(agent, { currentPassword: "nope-nope1" });
    await remove(agent, { confirm: "delete" });
    expect(await User.countDocuments()).toBe(1);
  });

  test.each(["guest", "host"])("is refused with an upcoming confirmed stay as a %s", async (role) => {
    const alice = await createUser("alice");
    const other = await createUser("other");
    const listing = await createListing(role === "host" ? alice : other);
    await Booking.create({
      listing: listing._id,
      guest: role === "host" ? other._id : alice._id,
      checkIn: new Date(day(5)),
      checkOut: new Date(day(6)),
      nights: [new Date(day(5))],
      totalPrice: 1,
    });
    const agent = await login(app);
    await remove(agent);
    expect(await User.countDocuments({ username: "alice" })).toBe(1);
    expect((await agent.get("/account")).text).toContain("upcoming confirmed stays");
  });

  test("removes the account and listings, anonymises reviews and past stays", async () => {
    const alice = await createUser("alice");
    const host = await createUser("host");
    const hostListing = await createListing(host);
    const owned = await createListing(alice, { title: "Alice Place" });
    const review = await Review.create({ comment: "Fine", rating: 4, author: alice._id, verifiedStay: true });
    await Listing.updateOne({ _id: hostListing._id }, { $push: { reviews: review._id } });
    const past = await Booking.create({
      listing: hostListing._id,
      guest: alice._id,
      checkIn: new Date(day(-5)),
      checkOut: new Date(day(-4)),
      nights: [new Date(day(-5))],
      totalPrice: 1,
      guestMessage: "Private note",
    });

    const agent = await login(app);
    const res = await remove(agent);
    expect(res.headers.location).toBe("/account/deleted");
    expect(await User.countDocuments({ username: "alice" })).toBe(0);
    expect(await Listing.exists({ _id: owned._id })).toBeNull();

    const kept = await Booking.findById(past._id).lean();
    expect(kept.guest).toBeUndefined();
    expect(kept.guestMessage).toBeUndefined();
    expect(kept.guestDeleted).toBe(true);
    expect(kept.totalPrice).toBe(1);

    expect((await Review.findById(review._id).lean()).author).toBeUndefined();
    expect((await request(app).get(`/listings/${hostListing._id}`)).text).toContain("Deleted user");
    expect(mailer.outbox.at(-1).subject).toContain("has been deleted");

    // The session is gone
    expect((await agent.get("/account")).headers.location).toBe("/login");
  });
});
