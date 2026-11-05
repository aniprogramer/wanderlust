const cheerio = require("cheerio");
const app = require("../../app");
const Booking = require("../../models/booking");
const Listing = require("../../models/listing");
const User = require("../../models/user");
const mailer = require("../../utils/mailer");
const expireRequests = require("../../utils/expireRequests");
const {
  REQUEST_TTL_HOURS,
  MAX_ACTIVE_PENDING_PER_GUEST,
  MAX_REQUESTS_PER_GUEST_24H,
  DATES_TAKEN_REASON,
} = require("../../utils/constants");
const {
  connectDb,
  disconnectDb,
  clearDb,
  createUser,
  login,
  createListing,
  day,
} = require("../helpers");

beforeAll(connectDb);
afterAll(disconnectDb);
afterEach(() => jest.restoreAllMocks());

const request = (agent, id, checkIn, checkOut, extra = {}) =>
  agent
    .post(`/listings/${id}/bookings`)
    .type("form")
    .send({ booking: { checkIn, checkOut, ...extra } });

const raw = (listing, guest, from, to, over = {}) =>
  Booking.create({
    listing: listing._id,
    guest: guest._id,
    checkIn: new Date(day(from)),
    checkOut: new Date(day(to)),
    nights: Array.from({ length: to - from }, (_, i) => new Date(day(from + i))),
    totalPrice: 100,
    status: "pending",
    requestedAt: new Date(),
    expiresAt: new Date(Date.now() + 864e5),
    ...over,
  });

let host, bob, carol, listing, hostAgent, bobAgent;
beforeEach(async () => {
  await clearDb();
  mailer.outbox.length = 0;
  host = await createUser("host");
  bob = await createUser("bob");
  carol = await createUser("carol");
  listing = await createListing(host, {
    price: 1000,
    cleaningFee: 300,
    currency: "EUR",
    maxGuests: 3,
  });
  hostAgent = await login(app, "host");
  bobAgent = await login(app, "bob");
});

const subjectsTo = (to) =>
  mailer.outbox.filter((m) => m.to === to).map((m) => m.subject);

describe("requesting", () => {
  test("stores a price snapshot, guests and message, and emails both sides", async () => {
    const res = await request(bobAgent, listing._id, day(10), day(12), {
      guests: 2,
      message: "We arrive late",
    });
    const booking = await Booking.findOne();
    expect(res.headers.location).toBe(`/bookings/${booking._id}`);
    expect(booking).toMatchObject({
      status: "pending",
      currency: "EUR",
      nightlyPrice: 1000,
      cleaningFee: 300,
      subtotal: 2000,
      taxAmount: 0,
      totalPrice: 2300,
      guests: 2,
      guestMessage: "We arrive late",
    });
    const hours = (booking.expiresAt - booking.requestedAt) / 36e5;
    expect(hours).toBe(REQUEST_TTL_HOURS);
    expect(subjectsTo("bob@example.com")[0]).toContain("Request sent");
    expect(subjectsTo("host@example.com")[0]).toContain("New booking request");
  });

  test("a later listing edit never changes what the booking shows", async () => {
    await request(bobAgent, listing._id, day(10), day(12));
    const booking = await Booking.findOne();
    await Listing.updateOne(
      { _id: listing._id },
      { price: 9999, cleaningFee: 0, currency: "USD" },
    );
    const page = await bobAgent.get(`/bookings/${booking._id}`);
    expect(page.text).toContain("€2,300");
    expect(page.text).not.toContain("9,999");
    expect(page.text).toContain("Taxes are not included");
  });

  test("a client cannot set the price or the status", async () => {
    await request(bobAgent, listing._id, day(10), day(12), {
      totalPrice: 1,
      status: "confirmed",
    });
    expect(await Booking.countDocuments()).toBe(0);
  });

  test("guests above the listing's capacity are refused", async () => {
    const res = await request(bobAgent, listing._id, day(10), day(12), {
      guests: 4,
    });
    expect(res.headers.location).toBe(`/listings/${listing._id}`);
    expect(await Booking.countDocuments()).toBe(0);
    expect((await bobAgent.get(res.headers.location)).text).toContain(
      "sleeps up to 3 guests",
    );
  });

  test("the minimum stay is enforced", async () => {
    await Listing.updateOne({ _id: listing._id }, { minNights: 3 });
    await request(bobAgent, listing._id, day(10), day(12));
    expect(await Booking.countDocuments()).toBe(0);
    await request(bobAgent, listing._id, day(10), day(13));
    expect(await Booking.countDocuments()).toBe(1);
  });

  test("blocked nights are refused, with both ends included", async () => {
    await Listing.updateOne(
      { _id: listing._id },
      { blockedRanges: [{ from: new Date(day(10)), to: new Date(day(11)) }] },
    );
    await request(bobAgent, listing._id, day(11), day(13)); // last blocked night
    await request(bobAgent, listing._id, day(9), day(11)); // first blocked night
    expect(await Booking.countDocuments()).toBe(0);
    await request(bobAgent, listing._id, day(12), day(14)); // day after
    await request(bobAgent, listing._id, day(8), day(10)); // checks out on the first
    expect(await Booking.countDocuments()).toBe(2);
  });

  test("a guest cannot overlap their own request or stay, and is told which", async () => {
    const other = await createListing(host, { title: "Other Place" });
    await request(bobAgent, other._id, day(10), day(12));
    const ref = (await Booking.findOne()).reference;
    const res = await request(bobAgent, listing._id, day(11), day(13));
    expect(await Booking.countDocuments()).toBe(1);
    const text = (await bobAgent.get(res.headers.location)).text;
    expect(text).toContain("Other Place");
    expect(text).toContain(ref);
  });

  test("an expired request no longer counts as an overlap", async () => {
    await raw(listing, bob, 10, 12, { expiresAt: new Date(Date.now() - 1000) });
    await request(bobAgent, listing._id, day(10), day(12));
    expect(await Booking.countDocuments({ guest: bob._id })).toBe(2);
  });

  test("active pending and daily request limits", async () => {
    for (let i = 0; i < MAX_ACTIVE_PENDING_PER_GUEST; i++) {
      await raw(listing, bob, 20 + i * 2, 21 + i * 2);
    }
    let res = await request(bobAgent, listing._id, day(10), day(11));
    expect((await bobAgent.get(res.headers.location)).text).toContain(
      `${MAX_ACTIVE_PENDING_PER_GUEST} requests waiting`,
    );

    await Booking.updateMany({}, { status: "declined" });
    for (let i = 0; i < MAX_REQUESTS_PER_GUEST_24H - MAX_ACTIVE_PENDING_PER_GUEST; i++) {
      await raw(listing, bob, 50 + i * 2, 51 + i * 2, { status: "declined" });
    }
    res = await request(bobAgent, listing._id, day(10), day(11));
    expect((await bobAgent.get(res.headers.location)).text).toContain(
      "a lot of requests today",
    );
  });
});

describe("the host's reply", () => {
  test("pending holds nothing: two guests can request the same dates", async () => {
    await request(bobAgent, listing._id, day(10), day(12));
    await request(await login(app, "carol"), listing._id, day(10), day(12));
    expect(await Booking.countDocuments({ status: "pending" })).toBe(2);
    const $ = cheerio.load((await bobAgent.get(`/listings/${listing._id}`)).text);
    expect(JSON.parse($("#booking-form").attr("data-booked"))).toEqual([]);
  });

  test("accept confirms, blocks the nights and tells the guest how to reach the host", async () => {
    await request(bobAgent, listing._id, day(10), day(12));
    const booking = await Booking.findOne();
    await hostAgent.post(`/bookings/${booking._id}/accept`);
    const updated = await Booking.findById(booking._id);
    expect(updated.status).toBe("confirmed");
    expect(updated.respondedAt).toBeInstanceOf(Date);
    const mail = mailer.outbox.find((m) => m.subject.startsWith("Confirmed"));
    expect(mail.to).toBe("bob@example.com");
    expect(mail.text).toContain("host@example.com");
    const $ = cheerio.load((await hostAgent.get(`/listings/${listing._id}`)).text);
    expect($("#booking-card").text()).toContain("@bob");
  });

  test("only the host can accept or decline", async () => {
    const booking = await raw(listing, bob, 10, 12);
    await bobAgent.post(`/bookings/${booking._id}/accept`);
    await bobAgent.post(`/bookings/${booking._id}/decline`);
    const carolAgent = await login(app, "carol");
    await carolAgent.post(`/bookings/${booking._id}/accept`);
    expect((await Booking.findById(booking._id)).status).toBe("pending");
  });

  test("accepting a second request for the same dates declines it with the reason", async () => {
    const first = await raw(listing, bob, 10, 12);
    const second = await raw(listing, carol, 11, 13);
    await hostAgent.post(`/bookings/${first._id}/accept`);
    await hostAgent.post(`/bookings/${second._id}/accept`);
    const loser = await Booking.findById(second._id);
    expect(loser.status).toBe("declined");
    expect(loser.declineReason).toBe(DATES_TAKEN_REASON);
    expect((await hostAgent.get("/bookings/hosting")).text).toContain(
      "These dates were just taken. This request can no longer be accepted.",
    );
    const mail = mailer.outbox.find((m) => m.to === "carol@example.com");
    expect(mail.text).toContain(DATES_TAKEN_REASON);
  });

  test("ten parallel accepts on the same nights confirm exactly one", async () => {
    const guests = await Promise.all(
      Array.from({ length: 10 }, (_, i) => createUser(`guest${i}`)),
    );
    const requests = await Promise.all(
      guests.map((g) => raw(listing, g, 20, 23)),
    );
    await Promise.all(
      requests.map((r) => hostAgent.post(`/bookings/${r._id}/accept`)),
    );
    expect(await Booking.countDocuments({ status: "confirmed" })).toBe(1);
    expect(await Booking.countDocuments({ status: "declined" })).toBe(9);
  });

  test("an expired request cannot be accepted", async () => {
    const booking = await raw(listing, bob, 10, 12, {
      expiresAt: new Date(Date.now() - 1000),
    });
    await hostAgent.post(`/bookings/${booking._id}/accept`);
    expect((await Booking.findById(booking._id)).status).toBe("pending");
    expect(booking.effectiveStatus).toBe("expired");
  });

  test("decline records the reason, frees nothing and tells the guest", async () => {
    const booking = await raw(listing, bob, 10, 12);
    await hostAgent
      .post(`/bookings/${booking._id}/decline`)
      .type("form")
      .send({ reason: "Family visiting" });
    const updated = await Booking.findById(booking._id);
    expect(updated.status).toBe("declined");
    expect(updated.declineReason).toBe("Family visiting");
    expect(subjectsTo("bob@example.com")[0]).toContain("declined");
  });

  test("a request whose dates the host blocked cannot be accepted", async () => {
    const booking = await raw(listing, bob, 10, 12);
    await Listing.updateOne(
      { _id: listing._id },
      { blockedRanges: [{ from: new Date(day(11)), to: new Date(day(11)) }] },
    );
    await hostAgent.post(`/bookings/${booking._id}/accept`);
    expect((await Booking.findById(booking._id)).status).toBe("declined");
  });
});

describe("expiry", () => {
  test("the sweep writes expiry once and emails the guest once", async () => {
    const stale = await raw(listing, bob, 10, 12, {
      expiresAt: new Date(Date.now() - 1000),
    });
    const fresh = await raw(listing, carol, 10, 12);
    expect(await expireRequests()).toBe(1);
    expect(await expireRequests()).toBe(0);
    expect((await Booking.findById(stale._id)).status).toBe("expired");
    expect((await Booking.findById(fresh._id)).status).toBe("pending");
    expect(subjectsTo("bob@example.com")).toHaveLength(1);
    expect(subjectsTo("carol@example.com")).toHaveLength(0);
  });

  test("the hosting page sweeps its own requests", async () => {
    const stale = await raw(listing, bob, 10, 12, {
      expiresAt: new Date(Date.now() - 1000),
    });
    await hostAgent.get("/bookings/hosting");
    expect((await Booking.findById(stale._id)).status).toBe("expired");
  });

  test("a request for tomorrow expires by the end of its check-in day", async () => {
    await request(bobAgent, listing._id, day(0), day(1));
    const booking = await Booking.findOne();
    expect(booking.expiresAt.getTime()).toBe(new Date(day(1)).getTime());
  });
});

describe("cancelling", () => {
  test("records who cancelled and why, and tells the other party", async () => {
    const booking = await raw(listing, bob, 10, 12, { status: "confirmed" });
    await bobAgent
      .delete(`/bookings/${booking._id}`)
      .type("form")
      .send({ reason: "Plans changed" });
    const updated = await Booking.findById(booking._id);
    expect(updated).toMatchObject({
      status: "cancelled",
      cancelledBy: "guest",
      cancelReason: "Plans changed",
    });
    const mail = mailer.outbox.find((m) => m.to === "host@example.com");
    expect(mail.subject).toContain("Cancelled");
    expect(mail.text).toContain("Plans changed");
  });

  test("a host cancelling tells the guest", async () => {
    const booking = await raw(listing, bob, 10, 12, { status: "confirmed" });
    await hostAgent.delete(`/bookings/${booking._id}`);
    expect((await Booking.findById(booking._id)).cancelledBy).toBe("host");
    expect(subjectsTo("bob@example.com")[0]).toContain("Cancelled");
  });

  test("a guest can withdraw a pending request", async () => {
    const booking = await raw(listing, bob, 10, 12);
    await bobAgent.delete(`/bookings/${booking._id}`);
    expect((await Booking.findById(booking._id)).status).toBe("cancelled");
  });

  test("a reason over the limit is refused", async () => {
    const booking = await raw(listing, bob, 10, 12, { status: "confirmed" });
    const res = await bobAgent
      .delete(`/bookings/${booking._id}`)
      .type("form")
      .send({ reason: "x".repeat(301) });
    expect(res.status).toBe(400);
    expect((await Booking.findById(booking._id)).status).toBe("confirmed");
  });
});

describe("pages", () => {
  test("the booking page is for the guest and the host only", async () => {
    const booking = await raw(listing, bob, 10, 12, {
      nightlyPrice: 50,
      subtotal: 100,
      currency: "EUR",
    });
    const page = await bobAgent.get(`/bookings/${booking._id}`);
    expect(page.status).toBe(200);
    expect(page.text).toContain(booking.reference);
    expect(page.text).toContain("Waiting for the host");
    expect(page.text).toContain("/cancellation-policy");
    expect(page.text).toContain("Need help?");
    expect(cheerio.load(page.text)("h1")).toHaveLength(1);
    expect((await hostAgent.get(`/bookings/${booking._id}`)).status).toBe(200);
    const stranger = await (await login(app, "carol")).get(`/bookings/${booking._id}`);
    expect(stranger.headers.location).toBe("/bookings");
  });

  test("contact details appear only once the host has confirmed", async () => {
    const booking = await raw(listing, bob, 10, 12);
    expect((await bobAgent.get(`/bookings/${booking._id}`)).text).not.toContain("host@example.com");
    const hostView = await hostAgent.get("/bookings/hosting");
    expect(hostView.text).not.toContain("bob@example.com");
    await hostAgent.post(`/bookings/${booking._id}/accept`);
    expect((await bobAgent.get(`/bookings/${booking._id}`)).text).toContain("host@example.com");
    expect((await hostAgent.get("/bookings/hosting")).text).toContain("bob@example.com");
  });

  test("the dashboard counts and estimates per currency, requests first", async () => {
    const other = await createListing(host, { title: "Second", currency: "USD" });
    await raw(listing, bob, 30, 32, { guestMessage: "Hello from Bob" });
    await raw(listing, carol, 40, 42, { status: "confirmed", currency: "EUR", totalPrice: 500 });
    await raw(other, carol, 44, 46, { status: "confirmed", currency: "USD", totalPrice: 700 });
    await raw(listing, carol, -6, -4, { status: "confirmed", currency: "EUR", totalPrice: 100 });
    const { text } = await hostAgent.get("/bookings/hosting");
    const $ = cheerio.load(text);
    const stats = $(".wl-stat").map((_, el) => $(el).find(".wl-stat__value").text().trim()).get();
    expect(stats.slice(0, 2)).toEqual(["1", "2"]);
    expect(Number(stats[2])).toBeGreaterThanOrEqual(0);
    expect(stats[3]).toContain("€600");
    expect(stats[3]).toContain("$700");
    expect(text).toContain("Estimated, paid at the property");
    expect(text).toContain("Hello from Bob");
    expect(text.indexOf("Hello from Bob")).toBeLessThan(text.indexOf("Reservations</h2>"));
  });

  test("defaulted capacity asks the host to confirm until they save", async () => {
    await Listing.updateOne({ _id: listing._id }, { capacityDefaulted: true });
    expect((await hostAgent.get("/bookings/hosting")).text).toContain(
      "Confirm your listing details",
    );
  });
});

test("an account stays usable after guests are removed", async () => {
  const booking = await raw(listing, bob, -6, -4, { status: "confirmed" });
  await Booking.updateOne(
    { _id: booking._id },
    { $unset: { guest: 1 }, $set: { guestDeleted: true } },
  );
  const { text, status } = await hostAgent.get("/bookings/hosting");
  expect(status).toBe(200);
  expect(text).toContain("Deleted user");
  expect(await User.countDocuments({ username: "bob" })).toBe(1);
});
