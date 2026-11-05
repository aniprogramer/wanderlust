// 3.4 replaced init/migrate.js with the numbered runner. The currency backfill it tested is now 001.
const mongoose = require("mongoose");
const { migrate, status } = require("../../migrations/runner");
const Listing = require("../../models/listing");
const Booking = require("../../models/booking");
const { connectDb, disconnectDb, clearDb } = require("../helpers");

beforeAll(connectDb);
afterAll(disconnectDb);
beforeEach(async () => {
  await clearDb();
  // clearDb only knows the model collections, and the runner's log is not one
  await mongoose.connection.db.collection("migrations").deleteMany({});
});

const db = () => mongoose.connection.db;
const id = () => new mongoose.Types.ObjectId();

test("applies each script once, and records it", async () => {
  await Listing.collection.insertOne({ title: "Old", price: 1, location: "l", country: "c" });
  const first = await migrate(db());
  expect(first.length).toBeGreaterThanOrEqual(5);
  expect(await migrate(db())).toEqual([]);
  const rows = await status(db());
  expect(rows.every((row) => row.appliedAt instanceof Date)).toBe(true);
});

test("a second run of the scripts changes nothing the host has since confirmed", async () => {
  await Listing.collection.insertOne({ title: "Old", price: 1, location: "l", country: "c" });
  await migrate(db());
  await Listing.collection.updateOne({}, { $set: { maxGuests: 9 }, $unset: { capacityDefaulted: 1 } });
  await db().collection("migrations").deleteMany({});
  await migrate(db());
  const row = await Listing.collection.findOne();
  expect(row.maxGuests).toBe(9);
  expect(row.capacityDefaulted).toBeUndefined();
});

test("listings get currency, capacity, a flag, images and defaults", async () => {
  await Listing.collection.insertMany([
    { title: "A", price: 1, location: "l", country: "c", image: { url: "https://x/a.jpg", filename: "a" } },
    { title: "B", price: 1, location: "l", country: "c", image: { url: "https://x/b.jpg", filename: "listingimage" } },
    { title: "C", price: 1, location: "l", country: "c", currency: "USD", maxGuests: 2 },
  ]);
  await migrate(db());
  const [a, b, c] = await Listing.collection.find().sort({ title: 1 }).toArray();
  expect(a).toMatchObject({
    currency: "INR",
    maxGuests: 4,
    bedrooms: 1,
    beds: 2,
    bathrooms: 1,
    capacityDefaulted: true,
    cleaningFee: 0,
    minNights: 1,
    amenities: [],
    status: "published",
    images: [{ url: "https://x/a.jpg", filename: "a" }],
  });
  expect(b.images).toEqual([]);
  expect(c.currency).toBe("USD");
  expect(c.maxGuests).toBe(2);
  expect(c.capacityDefaulted).toBeUndefined();
});

test("bookings take the listing's currency and keep their status", async () => {
  const listing = id();
  await Listing.collection.insertOne({ _id: listing, title: "A", price: 1, location: "l", country: "c", currency: "EUR" });
  await Booking.collection.insertOne({
    listing,
    guest: id(),
    checkIn: new Date("2026-01-01"),
    checkOut: new Date("2026-01-03"),
    nights: [new Date("2026-01-01"), new Date("2026-01-02")],
    totalPrice: 200,
    status: "cancelled",
  });
  await migrate(db());
  expect(await Booking.collection.findOne()).toMatchObject({
    currency: "EUR",
    guests: 1,
    nightlyPrice: 100,
    subtotal: 200,
    taxAmount: 0,
    status: "cancelled",
  });
});

test("existing reviews are marked as not verified", async () => {
  await db().collection("reviews").insertOne({ rating: 5, comment: "x" });
  await migrate(db());
  expect((await db().collection("reviews").findOne()).verifiedStay).toBe(false);
});
