const request = require("supertest");
const cheerio = require("cheerio");
const app = require("../../app");
const User = require("../../models/user");
const Listing = require("../../models/listing");
const Booking = require("../../models/booking");
const Report = require("../../models/report");
const SupportMessage = require("../../models/supportMessage");
const mailer = require("../../utils/mailer");
const { clearSitemapCache } = require("../../controllers/pageController");
const { connectDb, disconnectDb, clearDb, createUser, login, guest, createListing, day } = require("../helpers");

beforeAll(connectDb);
afterAll(disconnectDb);

let admin, owner, listing, message, report;
beforeEach(async () => {
  await clearDb();
  clearSitemapCache();
  mailer.outbox.length = 0;
  await createUser("root");
  await User.updateOne({ username: "root" }, { isAdmin: true });
  await createUser("bob");
  owner = await createUser("alice");
  listing = await createListing(owner);
  message = await SupportMessage.create({ reference: "WL-00000001", name: "A", email: "a@example.com", topic: "Hosting", message: "Please help me" });
  report = await Report.create({ reference: "RP-00000001", listing: listing._id, reason: "Something else" });
  admin = await login(app, "root");
});

const writes = () => [
  `/admin/listings/${listing._id}/hide`,
  `/admin/listings/${listing._id}/unhide`,
  `/admin/support/${message._id}/resolve`,
  `/admin/reports/${report._id}/resolve`,
];

test("every admin route refuses visitors and ordinary users", async () => {
  const visitor = await guest(app);
  const bob = await login(app, "bob");
  expect((await visitor.get("/admin")).headers.location).toBe("/login");
  expect((await bob.get("/admin")).status).toBe(403);
  for (const url of writes()) {
    expect((await visitor.post(url)).headers.location).toBe("/login");
    expect((await bob.post(url)).status).toBe(403);
  }
  expect((await Listing.findById(listing._id)).status).toBe("published");
  expect((await SupportMessage.findById(message._id)).resolvedAt).toBeUndefined();
  expect((await Report.findById(report._id)).resolvedAt).toBeUndefined();
});

test("every admin write needs a CSRF token", async () => {
  for (const url of writes()) {
    expect((await request.agent(app).post(url)).status).toBe(403);
  }
});

test("a form cannot grant admin", async () => {
  const visitor = await guest(app);
  await visitor.post("/signup").type("form").send({ username: "sneaky", email: "s@example.com", password: "Secret123!", confirmPassword: "Secret123!", terms: "on", startingMode: "guest", isAdmin: "true" });
  expect(await User.countDocuments({ username: "sneaky" })).toBe(0);
  const bob = await login(app, "bob");
  await bob.post("/account/profile").type("form").send({ username: "bob", email: "bob@example.com", isAdmin: "true" });
  expect((await User.findOne({ username: "bob" })).isAdmin).toBe(false);
});

test("the dashboard lists everything and is not indexed", async () => {
  const { text, status } = await admin.get("/admin");
  expect(status).toBe(200);
  const $ = cheerio.load(text);
  expect($('meta[name="robots"]').attr("content")).toBe("noindex");
  expect(text).toContain("WL-00000001");
  expect(text).toContain("RP-00000001");
  expect(text).toContain(listing.title);
});

test("resolving takes an item off the list", async () => {
  await admin.post(`/admin/support/${message._id}/resolve`);
  await admin.post(`/admin/reports/${report._id}/resolve`);
  const { text } = await admin.get("/admin");
  expect(text).not.toContain("WL-00000001");
  expect(text).not.toContain("RP-00000001");
});

describe("a hidden listing", () => {
  beforeEach(() => admin.post(`/admin/listings/${listing._id}/hide`));

  test("leaves search, the map and the sitemap", async () => {
    expect((await request(app).get("/listings")).text).not.toContain(listing.title);
    expect((await request(app).get("/listings/map")).text).not.toContain(String(listing._id));
    expect((await request(app).get("/sitemap.xml")).text).not.toContain(String(listing._id));
  });

  test("cannot be opened or booked by others, but its owner and admins can see it", async () => {
    const bob = await login(app, "bob");
    expect((await bob.get(`/listings/${listing._id}`)).headers.location).toBe("/listings");
    expect((await request(app).get(`/listings/${listing._id}`)).headers.location).toBe("/listings");
    const booked = await bob
      .post(`/listings/${listing._id}/bookings`)
      .type("form")
      .send({ booking: { checkIn: day(5), checkOut: day(6) } });
    expect(booked.status).toBe(404);
    expect(await Booking.countDocuments()).toBe(0);

    const ownerPage = await (await login(app, "alice")).get(`/listings/${listing._id}`);
    expect(ownerPage.status).toBe(200);
    expect(ownerPage.text).toContain("This listing is hidden");
    expect((await admin.get(`/listings/${listing._id}`)).status).toBe(200);
  });

  test("comes back with Unhide", async () => {
    await admin.post(`/admin/listings/${listing._id}/unhide`);
    expect((await request(app).get("/listings")).text).toContain(listing.title);
  });
});

describe("reporting", () => {
  test("needs an account, a real reason and writes a report", async () => {
    const visitor = await guest(app);
    expect((await visitor.get(`/listings/${listing._id}/report`)).headers.location).toBe("/login");

    process.env.SUPPORT_EMAIL = "help@example.com";
    const bob = await login(app, "bob");
    expect((await bob.get(`/listings/${listing._id}/report`)).status).toBe(200);
    await bob.post(`/listings/${listing._id}/report`).type("form").send({ reason: "Nonsense" });
    expect(await Report.countDocuments()).toBe(1);

    const res = await bob
      .post(`/listings/${listing._id}/report`)
      .type("form")
      .send({ reason: "Unsafe or illegal", details: "The balcony is broken" });
    delete process.env.SUPPORT_EMAIL;
    expect(res.headers.location).toBe(`/listings/${listing._id}`);
    const saved = await Report.findOne({ reason: "Unsafe or illegal" });
    expect(saved.details).toBe("The balcony is broken");
    expect(mailer.outbox.at(-1).to).toBe("help@example.com");
    expect(mailer.outbox.at(-1).text).toContain("The balcony is broken");
  });
});
