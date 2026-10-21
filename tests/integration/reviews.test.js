const request = require("supertest");
const app = require("../../app");
const Listing = require("../../models/listing");
const Review = require("../../models/review");
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
afterEach(() => jest.restoreAllMocks());
beforeEach(clearDb);

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
    jest
      .spyOn(Listing, "updateOne")
      .mockRejectedValueOnce(new Error("db down"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await postReview(await login(app, "bob"), listing._id, 4);
    expect(res.status).toBe(500);
    expect(await Review.countDocuments()).toBe(0);
  });
});
