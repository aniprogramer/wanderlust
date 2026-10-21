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
  createListing,
} = require("../helpers");

beforeAll(connectDb);
afterAll(disconnectDb);
beforeEach(clearDb);

describe("wishlist", () => {
  let listing;
  beforeEach(async () => {
    const owner = await createUser("alice");
    await createUser("bob");
    listing = await createListing(owner);
  });

  test("requires login", async () => {
    expect(
      (await (await guest(app)).post(`/wishlist/${listing._id}`)).headers
        .location,
    ).toBe("/login");
  });

  test("save is idempotent (no duplicates) and persists across sessions", async () => {
    const bob = await login(app, "bob");
    await bob.post(`/wishlist/${listing._id}`);
    await bob.post(`/wishlist/${listing._id}`);
    expect((await User.findOne({ username: "bob" })).wishlist).toHaveLength(1);

    const newSession = await login(app, "bob");
    expect((await newSession.get("/wishlist")).text).toContain("Cozy Cabin");
  });

  test("cards show saved state", async () => {
    const bob = await login(app, "bob");
    expect((await bob.get("/listings")).text).toContain(
      'aria-label="Save to wishlist"',
    );
    await bob.post(`/wishlist/${listing._id}`);
    expect((await bob.get("/listings")).text).toContain(
      'aria-label="Remove from wishlist"',
    );
  });

  test("remove un-saves; wishlists are per user", async () => {
    const bob = await login(app, "bob");
    await bob.post(`/wishlist/${listing._id}`);
    expect(
      (await (await login(app, "alice")).get("/wishlist")).text,
    ).not.toContain("Cozy Cabin");

    await bob.delete(`/wishlist/${listing._id}`);
    expect((await User.findOne({ username: "bob" })).wishlist).toHaveLength(0);
  });

  test("saving a missing listing is a 404 and malformed ids do not crash", async () => {
    const bob = await login(app, "bob");
    expect((await bob.post("/wishlist/507f1f77bcf86cd799439011")).status).toBe(
      404,
    );
    expect((await bob.post("/wishlist/garbage")).status).toBe(404);
  });

  test("redirects back to the referring page on the same host only", async () => {
    const bob = await login(app, "bob");
    const same = await bob
      .post(`/wishlist/${listing._id}`)
      .set("Host", "site.test")
      .set("Referer", "http://site.test/listings?page=2");
    expect(same.headers.location).toBe(`/listings?page=2#l-${listing._id}`);
    const foreign = await bob
      .post(`/wishlist/${listing._id}`)
      .set("Host", "site.test")
      .set("Referer", "http://evil.test/x");
    expect(foreign.headers.location).toBe("/listings");
  });
});
