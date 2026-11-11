// Phase 0: nothing on the page may claim something the product does not know.
const request = require("supertest");
const cheerio = require("cheerio");
const mongoose = require("mongoose");
const app = require("../../app");
const { cardBadge } = require("../../utils/listingBadge");
const {
  connectDb,
  disconnectDb,
  clearDb,
  createUser,
  createListing,
  login,
} = require("../helpers");

beforeAll(connectDb);
afterAll(disconnectDb);
beforeEach(clearDb);

const oldId = () =>
  mongoose.Types.ObjectId.createFromTime(
    Math.floor(Date.now() / 1000) - 400 * 86400,
  );

const home = async () =>
  cheerio.load((await request(app).get("/listings")).text);

describe("listing cards (R2, F1)", () => {
  test("a new stay with no reviews shows New and no star number", async () => {
    const owner = await createUser("alice");
    await createListing(owner);
    const $ = await home();
    const card = $(".listing-card").first();
    expect(card.find(".wl-badge").text()).toBe("New");
    expect(card.find(".wl-rating-num")).toHaveLength(0);
    expect(card.text()).not.toContain("4.8");
    expect(card.text()).not.toContain("(24)");
  });

  test("a stay with reviews shows its real rating and count", async () => {
    const owner = await createUser("alice");
    await createListing(owner, { avgRating: 4.25, reviewCount: 3 });
    const $ = await home();
    const card = $(".listing-card").first();
    expect(card.find(".wl-rating-num").text()).toBe("4.3");
    expect(card.find(".wl-reviews-count").text()).toContain("3");
    expect(card.text()).not.toContain("New");
  });

  // The brief changed this on purpose: every listing without a review says New, and never a number
  test("a stay with no reviews says New, whatever its age, and shows no rating", async () => {
    const owner = await createUser("alice");
    await createListing(owner, { _id: oldId() });
    const card = (await home())(".listing-card").first();
    expect(card.find(".wl-badge").text()).toBe("New");
    expect(card.find(".wl-card-badge")).toHaveLength(0);
    expect(card.find(".wl-rating-num")).toHaveLength(0);
    expect(card.text()).not.toContain("No reviews yet");
  });

  test("no invented badges, photo counts or amenities", async () => {
    const owner = await createUser("alice");
    await createListing(owner, { title: "A long enough title" });
    const { text } = await request(app).get("/listings");
    expect(text).not.toContain("Best seller");
    expect(text).not.toContain("Top rated");
    expect(text).not.toMatch(/1 \/ \d+/);
    // The amenities filter may name Wi-Fi; a card may not claim it
    const cards = cheerio.load(text)(".listing-card").text();
    expect(cards).not.toContain("2 beds");
    expect(cards).not.toContain("Wi-Fi");
  });

  test.each([
    ["5 reviews at 4.7", { reviewCount: 5, avgRating: 4.7 }, "Guest favourite"],
    ["4 reviews at 5.0", { reviewCount: 4, avgRating: 5 }, null],
    ["9 reviews at 4.6", { reviewCount: 9, avgRating: 4.6 }, null],
  ])("badge rule: %s", (_name, stats, expected) => {
    expect(cardBadge({ _id: oldId(), ...stats })).toBe(expected);
  });

  test("New stops after 60 days", () => {
    const fresh = { _id: new mongoose.Types.ObjectId(), reviewCount: 0 };
    expect(cardBadge(fresh)).toBe("New");
    expect(cardBadge({ _id: oldId(), reviewCount: 0 })).toBeNull();
  });
});

describe("dead and misleading controls (F2 to F6, O2 to O4)", () => {
  test("the story button and currency converter are gone", async () => {
    const { text } = await request(app).get("/listings");
    expect(text).not.toContain("Watch the story");
    expect(text).not.toContain("wl-currency");
    expect(text).not.toContain("currency.js");
  });

  test("navigation structure matches approved Wanderlust design", async () => {
    const $ = await home();
    const labels = $(".wl-nav-link")
      .map((_, el) => $(el).text().trim())
      .get();
    expect(labels).toEqual(["Explore", "Map", "Saved", "Trips"]);
    const topLinks = $(".wl-top-nav-links a")
      .map((_, el) => $(el).text().trim())
      .get();
    expect(topLinks).toEqual(["Stays", "Experiences", "Destinations"]);
  });

  test("footer shows social icons only for configured URLs", async () => {
    expect((await home())(".f-info-socials")).toHaveLength(0);
    process.env.SOCIAL_INSTAGRAM_URL = "https://instagram.example/wanderlust";
    try {
      const $ = await home();
      const links = $(".f-info-socials a");
      expect(links).toHaveLength(1);
      expect(links.attr("href")).toBe("https://instagram.example/wanderlust");
      expect(links.attr("rel")).toBe("noopener noreferrer");
      expect(links.attr("target")).toBe("_blank");
      expect(links.attr("aria-label")).toContain("Instagram");
    } finally {
      delete process.env.SOCIAL_INSTAGRAM_URL;
    }
  });

  test("the result count is exact", async () => {
    const owner = await createUser("alice");
    await createListing(owner);
    expect((await home())(".wl-stays-count").text()).toBe("1 stay");
    for (let i = 0; i < 28; i++) {
      await createListing(owner, { title: `Stay ${i}` });
    }
    expect((await home())(".wl-stays-count").text()).toBe("29 stays");
  });

  test("a page past the end redirects to the last page and keeps filters", async () => {
    const owner = await createUser("alice");
    for (let i = 0; i < 13; i++) {
      await createListing(owner, { title: `Stay ${i}`, category: "Cabins" });
    }
    const res = await request(app).get("/listings?category=Cabins&page=99");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/listings?category=Cabins&page=2");
  });

  test("no results shows the empty state, not a redirect", async () => {
    const res = await request(app).get("/listings?page=99");
    expect(res.status).toBe(200);
    expect(cheerio.load(res.text)(".wl-empty__title").text()).toBe(
      "No stays found",
    );
  });
});

describe("flash messages (F13)", () => {
  test("success auto-dismisses; errors stay, carry role=alert and can be closed", async () => {
    await createUser("alice");
    const agent = await login(app, "alice", "host");
    await agent.post("/wishlist/507f1f77bcf86cd799439011"); // 404 sets no flash
    await agent.post("/logout");
    const page = await agent.get("/listings");
    const $ = cheerio.load(page.text);
    const success = $(".wl-toast");
    expect(success.attr("role")).toBe("status");
    expect(success.attr("data-autodismiss")).toBeDefined();

    const failed = await request.agent(app);
    const login2 = await failed.get("/login");
    const token = /name="_csrf" value="([^"]+)"/.exec(login2.text)[1];
    await failed.post("/forgot-password").type("form").send({ _csrf: token, email: "nope" });
    const again = cheerio.load((await failed.get("/forgot-password")).text);
    expect(again(".wl-toast.wl-auth-alert--error").attr("role")).toBe("alert");
    expect(again(".wl-toast.wl-auth-alert--error").attr("data-autodismiss")).toBeUndefined();
  });

  test("an error flash on a normal page has a close button and no timer", async () => {
    await createUser("alice");
    const agent = await login(app, "alice", "host");
    // A missing listing redirects home with an error flash
    await agent.get("/listings/507f1f77bcf86cd799439011");
    const $ = cheerio.load((await agent.get("/listings")).text);
    const error = $(".wl-auth-alert--error.wl-toast");
    expect(error.attr("role")).toBe("alert");
    expect(error.attr("data-autodismiss")).toBeUndefined();
    expect(error.find("[data-toast-close]").attr("aria-label")).toBeTruthy();
  });
});
