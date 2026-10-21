const fs = require("fs");
const path = require("path");
const request = require("supertest");
const cheerio = require("cheerio");
const app = require("../../app");
const Listing = require("../../models/listing");
const Booking = require("../../models/booking");
const User = require("../../models/user");
const {
  connectDb,
  disconnectDb,
  clearDb,
  createUser,
  login,
  createListing,
  day,
} = require("../helpers");
const { searchSchema } = require("../../schema");

beforeAll(connectDb);
afterAll(disconnectDb);
beforeEach(async () => {
  await clearDb();
  await Listing.init();
});

describe("currency (D6)", () => {
  test("cards and the show page format prices in the listing's currency, with no GST copy", async () => {
    const owner = await createUser("alice");
    const listing = await createListing(owner, {
      currency: "USD",
      price: 1200,
    });
    const index = await request(app).get("/listings");
    expect(index.text).toContain("$1,200");
    expect(index.text).not.toContain("GST");
    expect(index.text).not.toContain("switchCheckDefault");
    const show = await request(app).get(`/listings/${listing._id}`);
    expect(show.text).toContain("$1,200");
    expect(show.text).toContain('data-currency="USD"');
  });

  test("listings without a currency default to INR", async () => {
    const owner = await createUser("alice");
    await createListing(owner, { price: 2500 });
    expect((await request(app).get("/listings")).text).toContain("₹2,500");
  });

  test("forms offer a currency select", async () => {
    await createUser("alice");
    const agent = await login(app);
    expect((await agent.get("/listings/new")).text).toContain(
      'name="listing[currency]"',
    );
  });
});

describe("calendar and star accessibility (D5, D9)", () => {
  test("the show page hands the server's UTC today to the calendar", async () => {
    const owner = await createUser("alice");
    const listing = await createListing(owner);
    const html = (await request(app).get(`/listings/${listing._id}`)).text;
    expect(html).toContain(
      `data-today="${new Date().toISOString().slice(0, 10)}"`,
    );
  });

  test("booking.js disables booked nights and uses the server's date", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../../public/js/booking.js"),
      "utf8",
    );
    expect(src).toContain("disable: [...booked]");
    expect(src).toContain("minDate: form.dataset.today");
    expect(src).toContain("hasBookedNight");
    // dates go into the named inputs, never the hidden _csrf field
    expect(src).toContain('form.elements["booking[checkIn]"]');
    expect(src).not.toContain('querySelectorAll("input[type=hidden]")');
  });

  test("the booked nights reach the page for the calendar", async () => {
    const owner = await createUser("alice");
    const guest = await createUser("bob");
    const listing = await createListing(owner);
    await Booking.create({
      listing: listing._id,
      guest: guest._id,
      checkIn: new Date(day(10)),
      checkOut: new Date(day(12)),
      nights: [new Date(day(10)), new Date(day(11))],
      totalPrice: 1,
    });
    const $ = cheerio.load(
      (await request(app).get(`/listings/${listing._id}`)).text,
    );
    expect(JSON.parse($("#booking-form").attr("data-booked"))).toEqual([
      day(10),
      day(11),
    ]);
  });

  test("star radios are visually hidden rather than display:none", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "../../public/css/style.css"),
      "utf8",
    );
    const rule = css.match(/\.star-rating input \{[^}]*\}/)[0];
    expect(rule).not.toContain("display: none");
    expect(rule).toContain("opacity: 0");
    expect(css).toContain(".star-rating input:focus-visible + label");
  });
});

describe("map picker (A3)", () => {
  test("typing in the address clears the old pin before searching", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../../public/js/map.js"),
      "utf8",
    );
    expect(src).toMatch(/addEventListener\("input", clearPin\)/);
    expect(src).toMatch(/lat\.value = lng\.value = ""/);
  });
});

describe("country cache (D10)", () => {
  test("distinct countries are cached and dropped when a listing is created or deleted", async () => {
    const owner = await createUser("alice");
    const distinct = jest.spyOn(Listing, "distinct");
    await createListing(owner, { country: "India" });
    expect(await Listing.countries()).toEqual(["India"]);
    expect(await Listing.countries()).toEqual(["India"]);
    expect(distinct).toHaveBeenCalledTimes(1);

    const created = await createListing(owner, { country: "Peru" });
    expect(await Listing.countries()).toEqual(["India", "Peru"]);
    await Listing.findByIdAndDelete(created._id);
    expect(await Listing.countries()).toEqual(["India"]);
    expect(distinct).toHaveBeenCalledTimes(3);
    distinct.mockRestore();
  });

  test("saved hearts come from one query for the current user only", async () => {
    const owner = await createUser("alice");
    const bob = await createUser("bob");
    const a = await createListing(owner, { title: "Saved One" });
    await createListing(owner, { title: "Not Saved" });
    await User.updateOne({ _id: bob._id }, { $push: { wishlist: a._id } });
    const $ = cheerio.load(
      (await (await login(app, "bob")).get("/listings")).text,
    );
    const saved = $(".listing-card")
      .filter((_, el) => $(el).find("button.wish-btn.saved").length > 0)
      .map((_, el) => $(el).find("b").first().text())
      .get();
    expect(saved).toEqual(["Saved One"]);
  });
});

describe("map notice (D11)", () => {
  test("warns when more stays match than the map can show", async () => {
    const owner = await createUser("alice");
    const base = {
      description: "d",
      price: 1,
      location: "l",
      country: "c",
      owner: owner._id,
    };
    await Listing.insertMany(
      Array.from({ length: 501 }, (_, i) => ({
        ...base,
        title: `Pin ${i}`,
        geometry: { type: "Point", coordinates: [i % 180, 10] },
      })),
    );
    const res = await request(app).get("/listings/map");
    expect(res.text).toContain(
      "Showing the first 500 of 501 stays. Narrow your filters to see the rest.",
    );
    expect(
      JSON.parse(cheerio.load(res.text)("#map-data").html()).features,
    ).toHaveLength(500);
  });

  test("no notice when everything fits", async () => {
    const owner = await createUser("alice");
    await createListing(owner, {
      geometry: { type: "Point", coordinates: [1, 2] },
    });
    expect((await request(app).get("/listings/map")).text).not.toContain(
      "Showing the first",
    );
  });
});

describe("near search (D12)", () => {
  test("schema accepts lat,lng with a radius and rejects bad input", () => {
    expect(
      searchSchema.validate({ near: "28.6,77.2", radiusKm: "50" }).error,
    ).toBeUndefined();
    expect(searchSchema.validate({ near: "95,0" }).error).toBeDefined();
    expect(searchSchema.validate({ near: "nope" }).error).toBeDefined();
    expect(searchSchema.validate({ radiusKm: 10 }).error).toBeDefined();
  });

  test("only listings inside the radius are returned", async () => {
    const owner = await createUser("alice");
    await createListing(owner, {
      title: "Delhi Flat",
      geometry: { type: "Point", coordinates: [77.2, 28.6] },
    });
    await createListing(owner, {
      title: "Jaipur Flat",
      geometry: { type: "Point", coordinates: [75.8, 26.9] },
    });
    await createListing(owner, { title: "No Pin" });
    const titles = async (qs) => {
      const $ = cheerio.load((await request(app).get(`/listings${qs}`)).text);
      return $(".listing-card .card-text b")
        .map((_, el) => $(el).text())
        .get();
    };
    expect(await titles("?near=28.6,77.2&radiusKm=50")).toEqual(["Delhi Flat"]);
    expect((await titles("?near=28.6,77.2&radiusKm=400")).sort()).toEqual([
      "Delhi Flat",
      "Jaipur Flat",
    ]);
    expect(await titles("")).toHaveLength(3);
  });
});
