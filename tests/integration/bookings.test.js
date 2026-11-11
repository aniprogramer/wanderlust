const request = require("supertest");
const app = require("../../app");
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
beforeEach(clearDb);

// LD1: a request holds nothing until the host accepts, so older tests confirm it first.
const confirmAll = () =>
  Booking.updateMany({ status: "pending" }, { status: "confirmed" });

const book = (agent, id, checkIn, checkOut) =>
  agent
    .post(`/listings/${id}/bookings`)
    .type("form")
    .send({ booking: { checkIn, checkOut } });

let host, listing;
beforeEach(async () => {
  host = await createUser("host");
  await createUser("bob");
  await createUser("carol");
  listing = await createListing(host, { price: 1000 });
});

describe("creating bookings", () => {
  test("sends a request and computes the total on the server", async () => {
    const res = await book(
      await login(app, "bob"),
      listing._id,
      day(10),
      day(13),
    );
    const booking = await Booking.findOne();
    expect(res.headers.location).toBe(`/bookings/${booking._id}`);
    expect(booking.totalPrice).toBe(3000);
    expect(booking.nights).toHaveLength(3);
    expect(booking.status).toBe("pending");
  });

  test("requires login", async () => {
    const res = await book(await guest(app), listing._id, day(10), day(12));
    expect(res.headers.location).toBe("/login");
  });

  test("owner cannot book their own listing", async () => {
    await book(await login(app, "host", "host"), listing._id, day(10), day(12));
    expect(await Booking.countDocuments()).toBe(0);
  });

  test.each([
    ["past dates", () => [day(-3), day(2)]],
    ["inverted range", () => [day(5), day(3)]],
    ["over 30 nights", () => [day(2), day(40)]],
    ["bad format", () => ["soon", day(3)]],
  ])("rejects %s with 400", async (_name, dates) => {
    const res = await book(await login(app, "bob"), listing._id, ...dates());
    expect(res.status).toBe(400);
    expect(await Booking.countDocuments()).toBe(0);
  });

  test("prevents overlapping bookings but allows back-to-back stays", async () => {
    const bob = await login(app, "bob");
    const carol = await login(app, "carol");
    await book(bob, listing._id, day(10), day(13));
    await confirmAll();

    await book(carol, listing._id, day(12), day(15)); // overlaps the last night
    await book(carol, listing._id, day(8), day(11)); // overlaps the first night
    await book(carol, listing._id, day(9), day(14)); // encloses it
    expect(await Booking.countDocuments()).toBe(1);

    await book(carol, listing._id, day(13), day(15)); // starts on bob's check-out day
    await book(carol, listing._id, day(8), day(10)); // ends on bob's check-in day
    expect(await Booking.countDocuments()).toBe(3);
  });

  test("cancelled dates become available again", async () => {
    const bob = await login(app, "bob");
    await book(bob, listing._id, day(10), day(12));
    await confirmAll();
    const booking = await Booking.findOne();
    await bob.delete(`/bookings/${booking._id}`);
    await book(await login(app, "carol"), listing._id, day(10), day(12));
    await confirmAll();
    expect(await Booking.countDocuments({ status: "confirmed" })).toBe(1);
  });

  test("unknown listing gives 404", async () => {
    const res = await book(
      await login(app, "bob"),
      "507f1f77bcf86cd799439011",
      day(3),
      day(5),
    );
    expect(res.status).toBe(404);
  });
});

describe("viewing and cancelling", () => {
  test("guest sees own reservations, host sees reservations at their listings", async () => {
    const bob = await login(app, "bob");
    await book(bob, listing._id, day(10), day(12));
    await confirmAll();

    expect((await bob.get("/bookings")).text).toContain("Cozy Cabin");
    expect(
      (await (await login(app, "carol")).get("/bookings")).text,
    ).not.toContain("Cozy Cabin");

    const hosting = await (await login(app, "host", "host")).get("/bookings/hosting");
    expect(hosting.text).toContain('class="wl-user-link" href="/users/bob"');
    expect((await (await login(app, "bob", "host")).get("/bookings/hosting")).text).not.toContain('class="wl-user-link" href="/users/bob"');
  });

  test("listing page shows unavailable dates publicly, guest names only to host", async () => {
    await book(await login(app, "bob"), listing._id, day(10), day(12));
    await confirmAll();
    const publicPage = await request(app).get(`/listings/${listing._id}`);
    expect(publicPage.text).toContain(day(10));
    expect(publicPage.text).not.toContain('class="wl-user-link" href="/users/bob"');
    const hostPage = await (
      await login(app, "host", "host")
    ).get(`/listings/${listing._id}`);
    expect(hostPage.text).toContain('class="wl-user-link" href="/users/bob"');
  });

  test("guest and host can cancel; strangers cannot", async () => {
    const bob = await login(app, "bob");
    await book(bob, listing._id, day(10), day(12));
    await book(bob, listing._id, day(15), day(17));
    await confirmAll();
    const [first, second] = await Booking.find().sort("checkIn");

    await (await login(app, "carol")).delete(`/bookings/${first._id}`);
    expect((await Booking.findById(first._id)).status).toBe("confirmed");

    await bob.delete(`/bookings/${first._id}`);
    expect((await Booking.findById(first._id)).status).toBe("cancelled");

    const hostAgent = await login(app, "host", "host");
    await hostAgent.delete(`/bookings/${second._id}`);
    expect((await Booking.findById(second._id)).status).toBe("cancelled");
    expect((await hostAgent.get("/bookings/hosting")).text).toContain(
      "Reservation cancelled.",
    );
    expect((await bob.get("/bookings")).text).toContain("Booking cancelled.");
  });

  test("started bookings cannot be cancelled", async () => {
    const bob = await login(app, "bob");
    const started = await Booking.create({
      listing: listing._id,
      guest: (await Booking.db.model("User").findOne({ username: "bob" }))._id,
      checkIn: new Date(day(0)),
      checkOut: new Date(day(2)),
      nights: [new Date(day(0)), new Date(day(1))],
      totalPrice: 2000,
    });
    await bob.delete(`/bookings/${started._id}`);
    expect((await Booking.findById(started._id)).status).toBe("confirmed");
  });
});

describe("pagination", () => {
  test("bookings are paged 12 at a time for guests and hosts", async () => {
    const bob = await createUser("bob2");
    for (let i = 0; i < 14; i++) {
      await Booking.create({
        listing: listing._id,
        guest: bob._id,
        checkIn: new Date(day(20 + i)),
        checkOut: new Date(day(21 + i)),
        nights: [new Date(day(20 + i))],
        totalPrice: 1,
      });
    }
    const guestAgent = await login(app, "bob2");
    const rows = (res) =>
      (res.text.match(/class="card border p-3 mb-3 booking-row"/g) || [])
        .length;
    expect(rows(await guestAgent.get("/bookings"))).toBe(12);
    const page2 = await guestAgent.get("/bookings?page=2");
    expect(rows(page2)).toBe(2);
    expect(page2.text).toContain('href="/bookings?page=1"');

    const hostAgent = await login(app, "host", "host");
    expect(rows(await hostAgent.get("/bookings/hosting"))).toBe(12);
    expect(rows(await hostAgent.get("/bookings/hosting?page=2"))).toBe(2);
  });
});
