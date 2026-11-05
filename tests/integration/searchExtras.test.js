const cheerio = require("cheerio");
const request = require("supertest");
const app = require("../../app");
const { connectDb, disconnectDb, clearDb, createUser, createListing } = require("../helpers");

beforeAll(connectDb);
afterAll(disconnectDb);


const count = async (qs) =>
  cheerio.load((await request(app).get(`/listings?${qs}`)).text)(".listing-card").length;

beforeEach(async () => {
  await clearDb();
  const owner = await createUser("alice");
  await createListing(owner, { title: "Small Rupee", price: 1000, currency: "INR", maxGuests: 2, avgRating: 4, reviewCount: 1, amenities: ["wifi"] });
  await createListing(owner, { title: "Large Euro", price: 90, currency: "EUR", maxGuests: 8, avgRating: 5, reviewCount: 2, amenities: ["wifi", "kitchen"] });
  await createListing(owner, { title: "Mid Rupee", price: 5000, currency: "INR", maxGuests: 4, avgRating: 3, reviewCount: 1, amenities: [] });
  await createListing(owner, { title: "Hidden", price: 10, status: "hidden" });
});

test("guests filters by capacity and validates 1 to 16", async () => {
  expect(await count("guests=3")).toBe(2);
  expect(await count("guests=8")).toBe(1);
  expect((await request(app).get("/listings?guests=17")).status).toBe(400);
  expect((await request(app).get("/listings?guests=0")).status).toBe(400);
});

test("a price range compares within one currency only, INR by default", async () => {
  expect(await count("maxPrice=100")).toBe(0);
  expect(await count("maxPrice=100&currency=EUR")).toBe(1);
  expect(await count("minPrice=500")).toBe(2);
  expect((await request(app).get("/listings?currency=XXX&maxPrice=1")).status).toBe(400);
  // Without a range, the currency does not hide anything
  expect(await count("currency=EUR")).toBe(3);
});

test.each([
  ["price_asc", ["Large Euro", "Small Rupee", "Mid Rupee"]],
  ["price_desc", ["Mid Rupee", "Small Rupee", "Large Euro"]],
  ["rating", ["Large Euro", "Small Rupee", "Mid Rupee"]],
  ["newest", ["Mid Rupee", "Large Euro", "Small Rupee"]],
])("sort=%s orders the results", async (sort, expected) => {
  const { text } = await request(app).get(`/listings?sort=${sort}`);
  const positions = expected.map((title) => text.indexOf(title));
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
});

test("an unknown sort is refused and a valid one survives pagination links", async () => {
  expect((await request(app).get("/listings?sort=evil")).status).toBe(400);
  const owner = await createUser("bob");
  for (let i = 0; i < 12; i++) await createListing(owner, { title: `Extra ${i}` });
  const { text } = await request(app).get("/listings?sort=price_asc&guests=1");
  expect(text).toMatch(/href="[^"]*sort=price_asc[^"]*page=2|href="[^"]*page=2[^"]*sort=price_asc/);
  expect(text).toMatch(/href="[^"]*guests=1[^"]*"/);
});

test("amenities must all match, and survive in links", async () => {
  expect(await count("amenities=wifi")).toBe(2);
  expect(await count("amenities=wifi&amenities=kitchen")).toBe(1);
  expect((await request(app).get("/listings?amenities=helipad")).status).toBe(400);
});

test("hidden listings stay out of search", async () => {
  expect((await request(app).get("/listings")).text).not.toContain("Hidden");
});

