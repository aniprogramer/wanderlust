// Section 2 of the brief: the honest price, reviews, cancellation terms, house rules, guest-need
// filters and the host's view of new requests.
const request = require("supertest");
const cheerio = require("cheerio");
const app = require("../../app");
const Booking = require("../../models/booking");
const Listing = require("../../models/listing");
const { TAX_NOTICE } = require("../../utils/constants");
const { connectDb, disconnectDb, clearDb, createUser, createListing, login, day } = require("../helpers");

beforeAll(connectDb);
afterAll(disconnectDb);

let host, bob, listing, hostAgent, bobAgent;
beforeEach(async () => {
  await clearDb();
  host = await createUser("host");
  bob = await createUser("bob");
  listing = await createListing(host, {
    price: 1000,
    cleaningFee: 200,
    cancellationPolicy: "strict",
    checkInFrom: "15:00",
    checkInUntil: "20:00",
    checkOutBy: "11:00",
  });
  hostAgent = await login(app, "host", "host");
  bobAgent = await login(app, "bob");
});

const requestStay = (agent, from, to, extra = {}) =>
  agent.post(`/listings/${listing._id}/bookings`).type("form").send({ booking: { checkIn: day(from), checkOut: day(to), ...extra } });

describe("the honest price", () => {
  test("the booking page itemises it, labels the total and adds the tax line", async () => {
    await requestStay(bobAgent, 20, 23);
    const booking = await Booking.findOne();
    expect(booking.totalPrice).toBe(3200);
    expect(booking.cleaningFee).toBe(200);
    for (const agent of [bobAgent, hostAgent]) {
      const { text } = await agent.get(`/bookings/${booking._id}`);
      const $ = cheerio.load(text);
      const rows = $(".wl-breakdown div").map((_, el) => $(el).text().replace(/\s+/g, " ").trim()).get();
      expect(rows[0]).toContain("× 3 nights");
      expect(rows[1]).toContain("Cleaning fee");
      expect(rows[2]).toContain("Total before taxes");
      expect(text).toContain(TAX_NOTICE);
      expect(text).not.toMatch(/service fee|platform fee/i);
    }
    expect(TAX_NOTICE).toBe("Taxes are not included. The host will confirm any applicable taxes.");
  });

  test("the listing page's live quote uses the same label, and has the tax line", async () => {
    const { text } = await request(app).get(`/listings/${listing._id}`);
    expect(text).toContain('data-total-label="Total before taxes"');
    expect(text).toContain(TAX_NOTICE);
    expect(text).toContain("cleaning fee");
  });

  test("a card shows that a cleaning fee is extra", async () => {
    const $ = cheerio.load((await request(app).get("/listings")).text);
    expect($(".wl-price-fee").text()).toContain("cleaning fee");
  });

  test("the stored price stands if the host changes the listing later", async () => {
    await requestStay(bobAgent, 20, 22);
    await Listing.updateOne({ _id: listing._id }, { price: 9000 });
    const { text } = await bobAgent.get(`/bookings/${(await Booking.findOne())._id}`);
    expect(text).toContain("2,200");
    expect(text).not.toContain("9,000");
  });

  test("a stay over the maximum nights is refused by the server", async () => {
    await Listing.updateOne({ _id: listing._id }, { maxNights: 2 });
    await requestStay(bobAgent, 20, 23);
    expect(await Booking.countDocuments()).toBe(0);
    await requestStay(bobAgent, 20, 22);
    expect(await Booking.countDocuments()).toBe(1);
  });
});

describe("honest reviews", () => {
  test("no reviews: New, and no rating number on the listing page", async () => {
    const $ = cheerio.load((await request(app).get(`/listings/${listing._id}`)).text);
    expect($(".wl-stay__place .wl-badge").text()).toBe("New");
    expect($(".wl-stay__place").text()).not.toMatch(/\d\.\d/);
  });

  test("only a completed stay may review, and the review says Verified stay", async () => {
    const empty = await bobAgent.post(`/listings/${listing._id}/reviews`).type("form").send({ review: { rating: 5, comment: "Lovely place to stay" } });
    expect(empty.status).toBeLessThan(500);
    const Review = require("../../models/review");
    expect(await Review.countDocuments()).toBe(0);

    await Booking.create({
      listing: listing._id, guest: bob._id, checkIn: new Date(day(-5)), checkOut: new Date(day(-3)),
      nights: [new Date(day(-5)), new Date(day(-4))], totalPrice: 1, status: "confirmed",
    });
    await bobAgent.post(`/listings/${listing._id}/reviews`).type("form").send({ review: { rating: 5, comment: "Lovely place to stay" } });
    expect(await Review.countDocuments()).toBe(1);
    expect((await request(app).get(`/listings/${listing._id}`)).text).toContain("Verified stay");
  });
});

describe("cancellation terms", () => {
  test("the policy shows on the listing page and links to the full page", async () => {
    const $ = cheerio.load((await request(app).get(`/listings/${listing._id}`)).text);
    expect($("#stay-rules").text()).toContain("Strict");
    expect($('#stay-rules a[href="/cancellation-policy"]')).toHaveLength(1);
  });

  test("the policy is stored on the request and survives a later change to the listing", async () => {
    await requestStay(bobAgent, 20, 22);
    const booking = await Booking.findOne();
    expect(booking.cancellationPolicy).toBe("strict");
    expect(booking.freeCancelUntil.toISOString()).toBe(new Date(new Date(day(20)).getTime() + 15 * 36e5 - 336 * 36e5).toISOString());
    await Listing.updateOne({ _id: listing._id }, { cancellationPolicy: "flexible" });
    const $ = cheerio.load((await bobAgent.get(`/bookings/${booking._id}`)).text);
    expect($("#booking-terms").text()).toContain("Strict");
    expect($('#booking-terms a[href="/cancellation-policy"]')).toHaveLength(1);
  });

  const confirmedStay = (hoursLeft) =>
    Booking.create({
      listing: listing._id, guest: bob._id, checkIn: new Date(day(3)), checkOut: new Date(day(5)),
      nights: [new Date(day(3)), new Date(day(4))], totalPrice: 1, status: "confirmed",
      cancellationPolicy: "flexible", freeCancelUntil: new Date(Date.now() + hoursLeft * 36e5),
    });

  test("cancelling in time is not late", async () => {
    const booking = await confirmedStay(5);
    await bobAgent.delete(`/bookings/${booking._id}`);
    const saved = await Booking.findById(booking._id);
    expect(saved.status).toBe("cancelled");
    expect(saved.cancelledLate).toBeFalsy();
    expect((await bobAgent.get(`/bookings/${booking._id}`)).text).not.toContain("data-late-cancel");
  });

  test.each([["guest"], ["host"]])("a late cancellation by the %s is flagged for both parties", async (who) => {
    const booking = await confirmedStay(-5);
    await (who === "guest" ? bobAgent : hostAgent).delete(`/bookings/${booking._id}`);
    const saved = await Booking.findById(booking._id);
    expect(saved.cancelledLate).toBe(true);
    for (const agent of [bobAgent, hostAgent]) {
      const $ = cheerio.load((await agent.get(`/bookings/${booking._id}`)).text);
      expect($("[data-late-cancel]").text()).toContain("Late cancellation");
    }
  });

  test("the confirm message warns before a late cancellation", async () => {
    const booking = await confirmedStay(-5);
    const $ = cheerio.load((await bobAgent.get(`/bookings/${booking._id}`)).text);
    expect($("[data-confirm]").attr("data-confirm")).toContain("late cancellation");
  });

  test("withdrawing a request is never late", async () => {
    await requestStay(bobAgent, 3, 5);
    const booking = await Booking.findOne();
    await Booking.updateOne({ _id: booking._id }, { freeCancelUntil: new Date(Date.now() - 36e5) });
    await bobAgent.delete(`/bookings/${booking._id}`);
    expect((await Booking.findById(booking._id)).cancelledLate).toBeFalsy();
  });

  test("the policy page explains all three", async () => {
    const { text } = await request(app).get("/cancellation-policy");
    for (const words of ["Flexible", "Moderate", "Strict", "24 hours", "5 days", "14 days", "late cancellation"]) {
      expect(text).toContain(words);
    }
  });
});

describe("house rules on the listing page", () => {
  test("rules, times and quiet hours come before the booking panel", async () => {
    await Listing.updateOne({ _id: listing._id }, {
      quietHoursStart: "22:00", quietHoursEnd: "07:00", petsAllowed: false, smokingAllowed: true,
      otherRules: "Shoes off indoors.", wifiMbps: 90, stepFreeAccess: true, smokeAlarm: true, sizeSqm: 70,
    });
    const { text } = await request(app).get(`/listings/${listing._id}`);
    const $ = cheerio.load(text);
    const rules = $("#stay-rules").text();
    expect(rules).toContain("15:00 to 20:00");
    expect(rules).toContain("By 11:00");
    expect(rules).toContain("22:00 to 07:00");
    expect(rules).toContain("No pets");
    expect(rules).toContain("Smoking allowed");
    expect(rules).toContain("Shoes off indoors.");
    expect(text.indexOf('id="stay-rules"')).toBeLessThan(text.indexOf('class="wl-stay__layout"'));
    expect(text).toContain("90 Mbps (Host-reported)");
    expect(text).toContain("Step-free");
    expect(text).toContain("70 m²");
  });

  test("what the host has not said is not invented", async () => {
    const old = await createListing(host, { detailsIncomplete: true });
    const $ = cheerio.load((await request(app).get(`/listings/${old._id}`)).text);
    const rules = $("#stay-rules").text();
    expect(rules).toContain("The host has not confirmed these details yet");
    expect(rules).toContain("has not listed any house rules");
    expect(rules).not.toContain("No pets");
    expect(rules).not.toContain("Pets allowed");
  });

  test("user text in other rules is escaped", async () => {
    await Listing.updateOne({ _id: listing._id }, { otherRules: "<script>x</script>" });
    expect((await request(app).get(`/listings/${listing._id}`)).text).not.toContain("<script>x</script>");
  });
});

describe("guest-need filters", () => {
  beforeEach(async () => {
    await createListing(host, { title: "Pets welcome here", petsAllowed: true, amenities: ["pets_allowed"] });
    await createListing(host, { title: "Desk for working", amenities: ["dedicated_desk"] });
    await createListing(host, { title: "Step free home", stepFreeAccess: true });
    await createListing(host, { title: "Wheelchair entry", wheelchairEntrance: true });
  });

  test.each([
    ["petsAllowed", "Pets welcome here"],
    ["hasWorkspace", "Desk for working"],
    ["stepFreeAccess", "Step free home"],
    ["wheelchairEntrance", "Wheelchair entry"],
  ])("%s finds only %s", async (need, title) => {
    const $ = cheerio.load((await request(app).get(`/listings?needs=${need}`)).text);
    const titles = $(".listing-card .wl-card-title").map((_, el) => $(el).text()).get();
    expect(titles).toEqual([title]);
    expect($(`input[name="needs"][value="${need}"]`).attr("checked")).toBeDefined();
  });

  test("the filters are labelled checkboxes in the search form, and only those four", async () => {
    const $ = cheerio.load((await request(app).get("/listings")).text);
    const labels = $('input[name="needs"]').first().closest("fieldset").find("label").map((_, el) => $(el).text().trim()).get();
    expect(labels).toEqual(expect.arrayContaining(["Pets allowed", "Workspace", "Step-free access", "Wheelchair-accessible entrance"]));
    expect(labels).toHaveLength(4);
  });
});

describe("the host's requests", () => {
  test("a new request shows the guest's message, the dates and the breakdown, and can be answered", async () => {
    await requestStay(bobAgent, 20, 22, { message: "Arriving with a toddler" });
    const page = await hostAgent.get("/bookings/hosting");
    const $ = cheerio.load(page.text);
    const request_ = $(".wl-request").first();
    expect(request_.text()).toContain("Arriving with a toddler");
    expect(request_.text()).toContain(`${day(20)} → ${day(22)}`);
    expect(request_.text()).toContain("Total before taxes");

    const booking = await Booking.findOne();
    await hostAgent.post(`/bookings/${booking._id}/accept`);
    expect((await Booking.findById(booking._id)).status).toBe("confirmed");
  });

  test("a host can decline", async () => {
    await requestStay(bobAgent, 20, 22);
    const booking = await Booking.findOne();
    await hostAgent.post(`/bookings/${booking._id}/decline`).type("form").send({});
    expect((await Booking.findById(booking._id)).status).toBe("declined");
  });

  test("only flagged listings prompt their host to complete details", async () => {
    expect(cheerio.load((await hostAgent.get("/bookings/hosting")).text)("[data-details-incomplete]")).toHaveLength(0);
    const old = await createListing(host, { title: "An older stay", detailsIncomplete: true });
    const $ = cheerio.load((await hostAgent.get("/bookings/hosting")).text);
    const prompt = $("[data-details-incomplete]");
    expect(prompt.text()).toContain("Complete your listing details");
    expect(prompt.find(`a[href="/listings/${old._id}/edit"]`).text()).toBe("An older stay");
  });
});
