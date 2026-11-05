const request = require("supertest");
const app = require("../../app");
const Listing = require("../../models/listing");
const Review = require("../../models/review");
const User = require("../../models/user");
const Booking = require("../../models/booking");
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

beforeAll(connectDb);
afterAll(disconnectDb);
afterEach(() => jest.restoreAllMocks());
beforeEach(clearDb);

// 2.8: reviews need a confirmed stay that has ended. Each stay gets its own nights.
let stayOffset = 40;
const stayed = async (username, listing) => {
  const guestUser = await User.findOne({ username });
  stayOffset += 2;
  return Booking.create({
    listing: listing._id,
    guest: guestUser._id,
    checkIn: new Date(day(-stayOffset)),
    checkOut: new Date(day(-stayOffset + 1)),
    nights: [new Date(day(-stayOffset))],
    totalPrice: 1,
  });
};

const postReview = (agent, id, rating, comment = "Nice") =>
  agent
    .post(`/listings/${id}/reviews`)
    .type("form")
    .send({ review: { rating, comment } });

describe("reviews", () => {
  test("guests cannot review", async () => {
    const owner = await createUser("alice");
    const listing = await createListing(owner);
    const res = await postReview(await guest(app), listing._id, 5);
    expect(res.headers.location).toBe("/login");
    expect(await Review.countDocuments()).toBe(0);
  });

  test("create links review to listing and author, and updates the average rating", async () => {
    const owner = await createUser("alice");
    const bob = await createUser("bob");
    const carol = await createUser("carol");
    const listing = await createListing(owner);

    await stayed("bob", listing);
    await stayed("carol", listing);
    await postReview(await login(app, "bob"), listing._id, 5);
    await postReview(await login(app, "carol"), listing._id, 4);

    const updated = await Listing.findById(listing._id).populate("reviews");
    expect(updated.reviews).toHaveLength(2);
    expect(updated.reviews.map((r) => String(r.author)).sort()).toEqual(
      [String(bob._id), String(carol._id)].sort(),
    );
    expect(updated.avgRating).toBe(4.5);
    expect(updated.reviewCount).toBe(2);
  });

  test("invalid rating is rejected with 400", async () => {
    const owner = await createUser("alice");
    await createUser("bob");
    const listing = await createListing(owner);
    const res = await postReview(await login(app, "bob"), listing._id, 9);
    expect(res.status).toBe(400);
    expect(await Review.countDocuments()).toBe(0);
  });

  test("a review cannot be deleted through another listing", async () => {
    const owner = await createUser("alice");
    await createUser("bob");
    const listing1 = await createListing(owner);
    const listing2 = await createListing(owner, { title: "Other" });
    const bob = await login(app, "bob");
    await stayed("bob", listing1);
    await postReview(bob, listing1._id, 4);
    const review = await Review.findOne();

    const res = await bob.delete(
      `/listings/${listing2._id}/reviews/${review._id}`,
    );
    expect(res.status).toBe(404);
    expect(await Review.countDocuments()).toBe(1);
    const untouched = await Listing.findById(listing1._id);
    expect(untouched.reviews).toHaveLength(1);
    expect(untouched.avgRating).toBe(4);
  });

  test("only the author can delete; deleting refreshes the rating", async () => {
    const owner = await createUser("alice");
    await createUser("bob");
    await createUser("mallory");
    const listing = await createListing(owner);
    const bob = await login(app, "bob");
    await stayed("bob", listing);
    await postReview(bob, listing._id, 3);
    const review = await Review.findOne();

    await (
      await login(app, "mallory")
    ).delete(`/listings/${listing._id}/reviews/${review._id}`);
    expect(await Review.countDocuments()).toBe(1);

    await bob.delete(`/listings/${listing._id}/reviews/${review._id}`);
    expect(await Review.countDocuments()).toBe(0);
    const updated = await Listing.findById(listing._id);
    expect(updated.reviews).toHaveLength(0);
    expect(updated.avgRating).toBe(0);
    expect(updated.reviewCount).toBe(0);
  });
});

describe("review rules", () => {
  test("owners cannot review their own listing", async () => {
    const owner = await createUser("alice");
    const listing = await createListing(owner);
    const agent = await login(app, "alice");
    const res = await postReview(agent, listing._id, 5);
    expect(res.headers.location).toBe(`/listings/${listing._id}`);
    expect(await Review.countDocuments()).toBe(0);
    expect((await agent.get(`/listings/${listing._id}`)).text).toContain(
      "You cannot review your own listing.",
    );
  });

  test("one review per user per listing", async () => {
    const owner = await createUser("alice");
    await createUser("bob");
    const listing = await createListing(owner);
    const bob = await login(app, "bob");
    await stayed("bob", listing);
    await postReview(bob, listing._id, 5);
    await postReview(bob, listing._id, 1);
    expect(await Review.countDocuments()).toBe(1);
    expect((await Listing.findById(listing._id)).avgRating).toBe(5);
    expect((await bob.get(`/listings/${listing._id}`)).text).toContain(
      "You have already reviewed this listing.",
    );
  });

  test("a failed link to the listing leaves no orphan review", async () => {
    const owner = await createUser("alice");
    await createUser("bob");
    const listing = await createListing(owner);
    await stayed("bob", listing);
    jest
      .spyOn(Listing, "updateOne")
      .mockRejectedValueOnce(new Error("db down"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await postReview(await login(app, "bob"), listing._id, 4);
    expect(res.status).toBe(500);
    expect(await Review.countDocuments()).toBe(0);
  });

  test("nobody reviews before a confirmed stay has ended", async () => {
    const owner = await createUser("alice");
    const bob = await createUser("bob");
    const listing = await createListing(owner);
    const agent = await login(app, "bob");
    const stay = (over) =>
      Booking.create({
        listing: listing._id,
        guest: bob._id,
        checkIn: new Date(day(-3)),
        checkOut: new Date(day(-1)),
        nights: [new Date(day(-3)), new Date(day(-2))],
        totalPrice: 1,
        ...over,
      });
    await postReview(agent, listing._id, 5);
    expect(await Review.countDocuments()).toBe(0);
    expect((await agent.get(`/listings/${listing._id}`)).text).toContain(
      "You can review this stay after you have stayed here.",
    );

    const pending = await stay({ status: "pending", expiresAt: new Date(day(9)) });
    await postReview(agent, listing._id, 5);
    expect(await Review.countDocuments()).toBe(0);
    await pending.deleteOne();

    const future = await stay({
      checkIn: new Date(day(3)),
      checkOut: new Date(day(4)),
      nights: [new Date(day(3))],
    });
    await postReview(agent, listing._id, 5);
    expect(await Review.countDocuments()).toBe(0);
    await future.deleteOne();

    const real = await stay();
    await postReview(agent, listing._id, 5);
    const review = await Review.findOne();
    expect(review.verifiedStay).toBe(true);
    expect(String(review.booking)).toBe(String(real._id));
    expect((await agent.get(`/listings/${listing._id}`)).text).toContain(
      "Verified stay",
    );
  });
});
