const Listing = require("../../models/listing");
const Booking = require("../../models/booking");
const mongoose = require("mongoose");
const Review = require("../../models/review");

const id = () => new mongoose.Types.ObjectId();

describe("Listing model", () => {
  test("rejects unknown category and property type", () => {
    const err = new Listing({
      title: "t",
      category: "X",
      propertyType: "Y",
    }).validateSync();
    expect(Object.keys(err.errors)).toEqual(
      expect.arrayContaining(["category", "propertyType"]),
    );
  });

  test("price, title, location and country are required; description defaults to empty", async () => {
    const l = new Listing({ title: "t" });
    const err = await l.validate().catch((e) => e);
    expect(Object.keys(err.errors)).toEqual(
      expect.arrayContaining(["price", "location", "country"]),
    );
    expect(l.description).toBe("");
    const cheap = await new Listing({
      title: "t",
      location: "l",
      country: "c",
      price: 0,
    })
      .validate()
      .catch((e) => e);
    expect(cheap.errors.price).toBeDefined();
  });

  test("defaults the image and rating, leaves geometry unset", () => {
    const l = new Listing({ title: "t", image: { url: "" } });
    expect(l.image.url).toMatch(/^https:\/\/images\.unsplash\.com/);
    expect(l.avgRating).toBe(0);
    expect(l.geometry.coordinates).toBeUndefined();
  });
});

describe("Booking model", () => {
  const base = () => ({
    listing: id(),
    guest: id(),
    checkIn: new Date("2030-01-01"),
    checkOut: new Date("2030-01-03"),
    nights: [new Date("2030-01-01"), new Date("2030-01-02")],
    totalPrice: 100,
  });

  test("valid booking defaults to confirmed", async () => {
    const b = new Booking(base());
    await expect(b.validate()).resolves.toBeUndefined();
    expect(b.status).toBe("confirmed");
  });

  test("check-out must be after check-in", async () => {
    const b = new Booking({ ...base(), checkOut: new Date("2030-01-01") });
    await expect(b.validate()).rejects.toThrow(/Check-out/);
  });

  test("declares the double-booking guard as a unique partial index", () => {
    const guard = Booking.schema.indexes().find(([keys]) => keys.nights);
    expect(guard[1]).toMatchObject({
      unique: true,
      partialFilterExpression: { status: "confirmed" },
    });
  });
});

describe("Review model", () => {
  test("createdAt defaults to the creation time, not server start", async () => {
    const first = new Review({ rating: 5, comment: "a" });
    await new Promise((resolve) => setTimeout(resolve, 15));
    const second = new Review({ rating: 5, comment: "b" });
    expect(second.createdAt.getTime()).toBeGreaterThan(
      first.createdAt.getTime(),
    );
  });
});
