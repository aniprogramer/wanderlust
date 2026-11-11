const request = require("supertest");
const mongoose = require("mongoose");
const cheerio = require("cheerio");
const app = require("../../app");
const Listing = require("../../models/listing");
const asset = require("../../utils/assets");
const { clearSitemapCache } = require("../../controllers/pageController");
const { connectDb, disconnectDb, clearDb, createUser, login, guest, createListing, day } = require("../helpers");
const Booking = require("../../models/booking");

beforeAll(connectDb);
afterAll(disconnectDb);
beforeEach(async () => {
  await clearDb();
  clearSitemapCache();
});

describe("health", () => {
  test("says ok when connected, with no session cookie", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  test("gives 503 when the database is down", async () => {
    const connected = mongoose.connection._readyState;
    mongoose.connection._readyState = 0;
    const res = await request(app).get("/health");
    mongoose.connection._readyState = connected;
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "unavailable" });
  });
});

describe("request logging", () => {
  const capture = async (fn) => {
    process.env.LOG_IN_TEST = "1";
    const write = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    await fn();
    delete process.env.LOG_IN_TEST;
    const lines = write.mock.calls.map(([line]) => String(line));
    write.mockRestore();
    return lines;
  };

  test("every response has an id, and the log line has no tokens or emails", async () => {
    await createUser("alice");
    const token = "a".repeat(64);
    let res;
    const lines = await capture(async () => {
      res = await request(app).get(`/reset-password/${token}`);
    });
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    const line = lines.map((l) => JSON.parse(l)).find((l) => l.message === "request");
    expect(line).toMatchObject({
      level: "info",
      requestId: res.headers["x-request-id"],
      route: "/reset-password/:token",
      status: 200,
    });
    expect(lines.join("")).not.toContain(token);
  });

  test("health checks and static files leave no line", async () => {
    const lines = await capture(async () => {
      await request(app).get("/health");
      await request(app).get("/css/style.css");
    });
    expect(lines.join("")).not.toContain('"request"');
  });

  test("a server error is logged with the request id, and hidden from the visitor", async () => {
    jest.spyOn(Listing, "search").mockRejectedValueOnce(new Error("secret database detail"));
    let res;
    const lines = await capture(async () => {
      res = await request(app).get("/listings");
    });
    expect(res.status).toBe(500);
    expect(res.text).not.toContain("secret database detail");
    const logged = lines.map((l) => JSON.parse(l)).find((l) => l.level === "error");
    expect(logged.message).toBe("secret database detail");
    expect(logged.requestId).toBe(res.headers["x-request-id"]);
    jest.restoreAllMocks();
  });
});

describe("speed", () => {
  test("pages are compressed when the client accepts it", async () => {
    const res = await request(app).get("/privacy").set("Accept-Encoding", "gzip");
    expect(res.headers["content-encoding"]).toBe("gzip");
  });

  test("versioned and vendor files are cached for good; pages are not", async () => {
    const versioned = asset("/css/style.css");
    expect(versioned).toMatch(/\/css\/style\.css\?v=[0-9a-f]{10}$/);
    expect((await request(app).get(versioned)).headers["cache-control"]).toContain("immutable");
    expect((await request(app).get("/vendor/flatpickr/4.6.13/flatpickr.min.js")).headers["cache-control"]).toContain("immutable");
    expect((await request(app).get("/fonts/geist-latin.woff2")).headers["cache-control"]).toContain("immutable");
    expect((await request(app).get("/css/style.css")).headers["cache-control"]).toBe("public, max-age=3600");
    expect((await request(app).get("/privacy")).headers["cache-control"]).toBe("private, no-cache");
  });

  test("cards ask Cloudinary for a sensible size, lazily below the first", async () => {
    const owner = await createUser("alice");
    await createListing(owner, { image: { url: "https://res.cloudinary.com/x/image/upload/v1/a.jpg", filename: "a" } });
    await createListing(owner, { image: { url: "https://res.cloudinary.com/x/image/upload/v1/b.jpg", filename: "b" } });
    const $ = cheerio.load((await request(app).get("/listings")).text);
    const images = $("img.wl-card-img");
    expect(images.eq(0).attr("src")).toContain("f_auto,q_auto,w_400");
    expect(images.eq(0).attr("srcset")).toContain("800w");
    expect(images.eq(0).attr("fetchpriority")).toBe("high");
    expect(images.eq(1).attr("loading")).toBe("lazy");
  });
});

describe("no third-party assets", () => {
  test.each(["/listings", "/privacy", "/login"])("%s loads nothing from a CDN", async (url) => {
    const { text } = await request(app).get(url);
    expect(text).not.toMatch(/(src|href)="https:\/\/(cdn\.jsdelivr|cdnjs|api\.mapbox|unpkg)/);
  });
});

describe("search engines", () => {
  test("a stay has its own title, canonical, social tags and structured data", async () => {
    process.env.APP_URL = "https://stay.example";
    const owner = await createUser("alice");
    const listing = await createListing(owner, { title: "Blue <Villa>", location: "Goa", geometry: { type: "Point", coordinates: [73.8, 15.5] } });
    const { text } = await request(app).get(`/listings/${listing._id}`);
    delete process.env.APP_URL;
    const $ = cheerio.load(text);
    expect($("title").text()).toBe("Blue <Villa>, Goa | Wanderlust");
    expect($('link[rel="canonical"]').attr("href")).toBe(`https://stay.example/listings/${listing._id}`);
    expect($('meta[property="og:title"]').attr("content")).toContain("Blue <Villa>");
    expect($('meta[name="twitter:card"]').attr("content")).toBe("summary_large_image");
    const data = JSON.parse($('script[type="application/ld+json"]').html());
    expect(data).toMatchObject({ "@type": "LodgingBusiness", name: "Blue <Villa>" });
    // The approximate point, near the pin: search engines must not get the exact one
    expect(data.geo.latitude).toBeCloseTo(15.5, 1);
    expect(data.geo.latitude).not.toBe(15.5);
    expect(data.aggregateRating).toBeUndefined();
    // The title's "<" cannot close the script element
    expect($('script[type="application/ld+json"]').html()).not.toContain("<Villa");
  });

  test("structured data rates a stay only when it has reviews", async () => {
    const owner = await createUser("alice");
    const listing = await createListing(owner, { avgRating: 4.5, reviewCount: 2 });
    const $ = cheerio.load((await request(app).get(`/listings/${listing._id}`)).text);
    const data = JSON.parse($('script[type="application/ld+json"]').html());
    expect(data.aggregateRating).toMatchObject({ ratingValue: 4.5, reviewCount: 2 });
  });

  test("robots lists private areas and the sitemap", async () => {
    const res = await request(app).get("/robots.txt");
    expect(res.type).toBe("text/plain");
    expect(res.text).toContain("Disallow: /account");
    expect(res.text).toMatch(/Sitemap: .*\/sitemap\.xml/);
  });

  test("the sitemap has public pages and published stays, and is cached", async () => {
    const owner = await createUser("alice");
    const shown = await createListing(owner);
    const hidden = await createListing(owner, { status: "hidden" });
    const res = await request(app).get("/sitemap.xml");
    expect(res.type).toBe("application/xml");
    expect(res.headers["cache-control"]).toContain("max-age=3600");
    expect(res.text).toContain(`/listings/${shown._id}<`);
    expect(res.text).not.toContain(String(hidden._id));
    expect(res.text).toContain("/privacy<");
    await createListing(owner, { title: "Later" });
    const later = await Listing.findOne({ title: "Later" });
    expect((await request(app).get("/sitemap.xml")).text).not.toContain(String(later._id));
  });

  test("private pages ask not to be indexed; public ones do not", async () => {
    await createUser("alice");
    const owner = await createUser("host");
    const listing = await createListing(owner);
    const alice = await login(app, "alice");
    const noindex = (text) => cheerio.load(text)('meta[name="robots"]').attr("content") === "noindex";
    for (const url of ["/users/alice", "/bookings", "/wishlist", "/no-such-page"]) {
      expect(noindex((await alice.get(url)).text)).toBe(true);
    }
    // Reservations only exist in host mode, so a host-mode session reaches it
    const hostMode = await login(app, "host", "host");
    for (const url of ["/bookings/hosting", "/listings/mine"]) {
      expect(noindex((await hostMode.get(url)).text)).toBe(true);
    }
    const visitor = await guest(app);
    for (const url of ["/login", "/signup", "/forgot-password"]) {
      expect(noindex((await visitor.get(url)).text)).toBe(true);
    }
    for (const url of ["/listings", `/listings/${listing._id}`, "/privacy", "/help"]) {
      expect(noindex((await visitor.get(url)).text)).toBe(false);
    }
  });

  test.each(["/listings", "/login", "/signup", "/help", "/contact", "/privacy"])("%s has one h1", async (url) => {
    expect(cheerio.load((await request(app).get(url)).text)("h1")).toHaveLength(1);
  });

  test("signed-in pages have one h1 too", async () => {
    const alice = await createUser("alice");
    const host = await createUser("host");
    const listing = await createListing(host);
    const booking = await Booking.create({
      listing: listing._id,
      guest: alice._id,
      checkIn: new Date(day(4)),
      checkOut: new Date(day(5)),
      nights: [new Date(day(4))],
      totalPrice: 1,
    });
    const agent = await login(app, "alice");
    const hostAgent = await login(app, "host", "host");
    for (const [who, url] of [
      [agent, "/users/alice"],
      [agent, "/bookings"],
      [agent, `/bookings/${booking._id}`],
      [agent, "/wishlist"],
      [agent, "/verify-email"],
      [agent, `/listings/${listing._id}`],
      [hostAgent, "/bookings/hosting"],
      [hostAgent, `/listings/${listing._id}/edit`],
      [hostAgent, "/listings/new"],
    ]) {
      const $ = cheerio.load((await who.get(url)).text);
      expect([url, $("h1").length]).toEqual([url, 1]);
    }
  });
});
