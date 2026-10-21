const request = require("supertest");
const cheerio = require("cheerio");
const app = require("../../app");
const Listing = require("../../models/listing");
const Booking = require("../../models/booking");
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

let owner;
beforeEach(async () => {
  await clearDb();
  owner = await createUser("alice");
  await Listing.init();
});

const titles = (res) => {
  const $ = cheerio.load(res.text);
  return $(".listing-card .card-text b")
    .map((_, el) => $(el).text())
    .get();
};
const search = (qs) => request(app).get(`/listings${qs}`);

describe("search & filters", () => {
  beforeEach(async () => {
    await createListing(owner, {
      title: "Beach Hut",
      description: "sandy shore",
      location: "Goa",
      country: "India",
      price: 800,
      category: "Beachfront",
      propertyType: "Cottage",
      avgRating: 4.6,
      reviewCount: 3,
    });
    await createListing(owner, {
      title: "Alpine Chalet",
      description: "ski in",
      location: "Verbier",
      country: "Switzerland",
      price: 5000,
      category: "Mountains",
      propertyType: "House",
      avgRating: 3.2,
      reviewCount: 2,
    });
    await createListing(owner, {
      title: "City Loft",
      description: "downtown with beach views",
      location: "Mumbai",
      country: "India",
      price: 2500,
      category: "Cities",
      propertyType: "Apartment",
    });
  });

  test("no filters returns everything", async () => {
    expect(titles(await search(""))).toHaveLength(3);
  });

  test("keyword search matches title, location, country and description", async () => {
    expect(titles(await search("?q=chalet"))).toEqual(["Alpine Chalet"]);
    expect(titles(await search("?q=Verbier"))).toEqual(["Alpine Chalet"]);
    expect(titles(await search("?q=Switzerland"))).toEqual(["Alpine Chalet"]);
    // title match outranks a description-only match
    expect(titles(await search("?q=beach"))).toEqual([
      "Beach Hut",
      "City Loft",
    ]);
  });

  test.each([
    ["category", "?category=Cities", ["City Loft"]],
    ["country", "?country=Switzerland", ["Alpine Chalet"]],
    ["property type", "?propertyType=Cottage", ["Beach Hut"]],
    ["min price", "?minPrice=2000", ["City Loft", "Alpine Chalet"]],
    ["max price", "?maxPrice=1000", ["Beach Hut"]],
    ["price range", "?minPrice=1000&maxPrice=3000", ["City Loft"]],
    ["rating", "?minRating=4", ["Beach Hut"]],
    ["combined", "?country=India&minPrice=1000", ["City Loft"]],
  ])("filters by %s", async (_n, qs, expected) => {
    expect(titles(await search(qs))).toEqual(expected);
  });

  test("invalid filters give 400 and unknown params are ignored", async () => {
    expect((await search("?category=Nope")).status).toBe(400);
    expect((await search("?minPrice=9&maxPrice=1")).status).toBe(400);
    expect((await search("?page=0")).status).toBe(400);
    expect(titles(await search("?junk=1"))).toHaveLength(3);
  });

  test("filter values persist in the form", async () => {
    const res = await search("?q=beach&minPrice=100&country=India");
    expect(res.text).toContain('value="beach"');
    expect(res.text).toContain('value="100"');
    expect(res.text).toMatch(/<option value="India" selected>/);
  });

  test("availability excludes listings with overlapping confirmed bookings", async () => {
    const hut = await Listing.findOne({ title: "Beach Hut" });
    const base = {
      listing: hut._id,
      guest: owner._id,
      totalPrice: 1,
      checkIn: new Date(day(10)),
      checkOut: new Date(day(13)),
    };
    await Booking.create({
      ...base,
      nights: [new Date(day(10)), new Date(day(11)), new Date(day(12))],
    });

    expect(
      titles(await search(`?checkIn=${day(12)}&checkOut=${day(14)}`)),
    ).not.toContain("Beach Hut");
    expect(
      titles(await search(`?checkIn=${day(13)}&checkOut=${day(15)}`)),
    ).toContain("Beach Hut");

    await Booking.updateOne({}, { status: "cancelled" });
    expect(
      titles(await search(`?checkIn=${day(12)}&checkOut=${day(14)}`)),
    ).toContain("Beach Hut");
  });
});

describe("pagination", () => {
  beforeEach(async () => {
    await Listing.insertMany(
      Array.from({ length: 30 }, (_, i) => ({
        title: `Stay ${String(i).padStart(2, "0")}`,
        description: "d",
        price: 100,
        location: "l",
        country: "India",
        owner: owner._id,
      })),
    );
  });

  test("12 per page, newest first, with page links that keep filters", async () => {
    const p1 = await search("?country=India");
    expect(titles(p1)).toHaveLength(12);
    expect(titles(p1)[0]).toBe("Stay 29");
    expect(p1.text).toContain("/listings?country=India&amp;page=2");

    const p3 = await search("?country=India&page=3");
    expect(titles(p3)).toEqual([
      "Stay 05",
      "Stay 04",
      "Stay 03",
      "Stay 02",
      "Stay 01",
      "Stay 00",
    ]);
  });

  test("pages beyond the end are empty, not errors", async () => {
    const res = await search("?page=99");
    expect(res.status).toBe(200);
    expect(titles(res)).toHaveLength(0);
  });
});

describe("Listing.search model API", () => {
  test("returns total and page count", async () => {
    await createListing(owner);
    await createListing(owner);
    const result = await Listing.search({}, { page: 1, limit: 1 });
    expect(result).toMatchObject({ total: 2, pages: 2 });
    expect(result.listings).toHaveLength(1);
  });
});
