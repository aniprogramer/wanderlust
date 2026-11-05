const cheerio = require("cheerio");
const request = require("supertest");
const app = require("../../app");
const Listing = require("../../models/listing");
const Booking = require("../../models/booking");
const { connectDb, disconnectDb, clearDb, createUser, login, createListing, day } = require("../helpers");

beforeAll(connectDb);
afterAll(disconnectDb);

let owner, listing, agent;
beforeEach(async () => {
  await clearDb();
  owner = await createUser("alice");
  listing = await createListing(owner);
  agent = await login(app);
});

const block = (from, to, extra = {}) =>
  agent.post(`/listings/${listing._id}/blocks`).type("form").send({ from, to, ...extra });

test("a blocked range reaches the calendar and search", async () => {
  await block(day(10), day(12), { note: "Family" });
  const fresh = await Listing.findById(listing._id);
  expect(fresh.blockedRanges).toHaveLength(1);
  expect(fresh.blockedRanges[0].note).toBe("Family");

  await createUser("bob");
  const $ = cheerio.load((await (await login(app, "bob")).get(`/listings/${listing._id}`)).text);
  expect(JSON.parse($("#booking-form").attr("data-booked"))).toEqual([day(10), day(11), day(12)]);
  expect($("body").text()).not.toContain("Family");

  const titles = async (qs) =>
    cheerio.load((await request(app).get(`/listings?${qs}`)).text)(".listing-card").length;
  expect(await titles(`checkIn=${day(12)}&checkOut=${day(14)}`)).toBe(0);
  expect(await titles(`checkIn=${day(13)}&checkOut=${day(14)}`)).toBe(1);
  expect(await titles(`checkIn=${day(8)}&checkOut=${day(10)}`)).toBe(1);
});

test("search respects the minimum stay", async () => {
  await Listing.updateOne({ _id: listing._id }, { minNights: 3 });
  const count = async (n) =>
    cheerio.load((await request(app).get(`/listings?checkIn=${day(5)}&checkOut=${day(5 + n)}`)).text)(".listing-card").length;
  expect(await count(2)).toBe(0);
  expect(await count(3)).toBe(1);
});

test("a range over a confirmed booking is refused and names it", async () => {
  const bob = await createUser("bob");
  const booking = await Booking.create({
    listing: listing._id,
    guest: bob._id,
    checkIn: new Date(day(10)),
    checkOut: new Date(day(12)),
    nights: [new Date(day(10)), new Date(day(11))],
    totalPrice: 1,
  });
  await block(day(11), day(11));
  expect((await Listing.findById(listing._id)).blockedRanges).toHaveLength(0);
  expect((await agent.get(`/listings/${listing._id}/edit`)).text).toContain(booking.reference);
  // The check-out day is free: nobody sleeps there that night
  await block(day(12), day(13));
  expect((await Listing.findById(listing._id)).blockedRanges).toHaveLength(1);
});

test("bad ranges are refused and the cap holds", async () => {
  await block(day(12), day(10));
  await block(day(-5), day(-3));
  await block("soon", day(3));
  expect((await Listing.findById(listing._id)).blockedRanges).toHaveLength(0);

  await Listing.updateOne(
    { _id: listing._id },
    {
      blockedRanges: Array.from({ length: 50 }, (_, i) => ({
        from: new Date(day(100 + i * 2)),
        to: new Date(day(100 + i * 2)),
      })),
    },
  );
  await block(day(3), day(3));
  expect((await Listing.findById(listing._id)).blockedRanges).toHaveLength(50);
});

test("a range can be opened again, only by its owner", async () => {
  await block(day(10), day(12));
  const { blockedRanges: [range] } = await Listing.findById(listing._id);
  await createUser("bob");
  await (await login(app, "bob")).delete(`/listings/${listing._id}/blocks/${range._id}`);
  expect((await Listing.findById(listing._id)).blockedRanges).toHaveLength(1);
  await agent.delete(`/listings/${listing._id}/blocks/${range._id}`);
  expect((await Listing.findById(listing._id)).blockedRanges).toHaveLength(0);
});
