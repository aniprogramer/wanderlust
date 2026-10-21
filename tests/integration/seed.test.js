jest.mock("../../utils/geocode", () => ({
  geocode: jest.fn().mockResolvedValue([1, 2]),
}));

const mongoose = require("mongoose");
const Listing = require("../../models/listing");
const Review = require("../../models/review");
const Booking = require("../../models/booking");
const User = require("../../models/user");
const removeDependents = require("../../models/cascade");
const { initDB } = require("../../init");
const {
  connectDb,
  disconnectDb,
  clearDb,
  createUser,
  createListing,
  day,
} = require("../helpers");

beforeAll(connectDb);
afterAll(disconnectDb);
beforeEach(clearDb);

const seedDependents = async () => {
  const owner = await createUser("alice");
  const guest = await createUser("bob");
  const review = await Review.create({
    rating: 4,
    comment: "ok",
    author: guest._id,
  });
  const listing = await createListing(owner, { reviews: [review._id] });
  await Booking.create({
    listing: listing._id,
    guest: guest._id,
    checkIn: new Date(day(5)),
    checkOut: new Date(day(6)),
    nights: [new Date(day(5))],
    totalPrice: 1,
  });
  await User.updateOne(
    { _id: guest._id },
    { $push: { wishlist: listing._id } },
  );
  return { listing, guest };
};

describe("cascade helper", () => {
  test("removes reviews, bookings and wishlist entries of the given listings", async () => {
    const { listing, guest } = await seedDependents();
    await removeDependents([listing]);
    expect(await Review.countDocuments()).toBe(0);
    expect(await Booking.countDocuments()).toBe(0);
    expect((await User.findById(guest._id)).wishlist).toHaveLength(0);
  });

  test("leaves other listings' data alone", async () => {
    const { listing } = await seedDependents();
    const other = await createListing(
      await User.findOne({ username: "alice" }),
      { title: "Other" },
    );
    await removeDependents([other]);
    expect(await Review.countDocuments()).toBe(1);
    expect(await Booking.countDocuments()).toBe(1);
    expect(listing).toBeDefined();
  });
});

describe("seeder", () => {
  test("wipes old listings with their dependents and owns the new ones by seed-host", async () => {
    await seedDependents();
    jest.spyOn(console, "log").mockImplementation(() => {});
    await initDB();
    expect(await Review.countDocuments()).toBe(0);
    expect(await Booking.countDocuments()).toBe(0);
    const seedUser = await User.findOne({ username: "seed-host" });
    expect(seedUser).not.toBeNull();
    const listings = await Listing.find();
    expect(listings.length).toBeGreaterThan(0);
    expect(listings.every((l) => l.owner.equals(seedUser._id))).toBe(true);
    // second run reuses the seed user
    await initDB();
    expect(await User.countDocuments({ username: "seed-host" })).toBe(1);
    expect(mongoose.connection.readyState).toBe(1);
  });
});
