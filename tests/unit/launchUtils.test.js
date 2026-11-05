const { today } = require("../../utils/dates");
const { missingProductionEnv, assertProductionEnv, REQUIRED_IN_PRODUCTION, siteUrl } = require("../../utils/config");
const { sniffImageType } = require("../../utils/imageType");
const { photoUrl, photoSrcset } = require("../../utils/cloudinaryUrl");
const { buildEmail, types } = require("../../utils/emails");
const logger = require("../../utils/logger");
const buildQs = require("../../utils/queryString");
const { quote, overlapsBlocked, blockedNights } = require("../../utils/availability");

describe("today (LD9)", () => {
  // 18:30 UTC is midnight in Kolkata
  const before = new Date("2026-03-10T18:29:59Z");
  const after = new Date("2026-03-10T18:30:00Z");

  test("turns over at midnight in the app's timezone", () => {
    expect(today(before, "Asia/Kolkata").toISOString()).toBe("2026-03-10T00:00:00.000Z");
    expect(today(after, "Asia/Kolkata").toISOString()).toBe("2026-03-11T00:00:00.000Z");
  });

  test("a different zone can still be on the previous day", () => {
    expect(today(new Date("2026-03-11T02:00:00Z"), "America/New_York").toISOString()).toBe("2026-03-10T00:00:00.000Z");
    expect(today(new Date("2026-03-11T02:00:00Z"), "UTC").toISOString()).toBe("2026-03-11T00:00:00.000Z");
  });

  test("defaults to Asia/Kolkata", () => {
    const saved = process.env.APP_TIMEZONE;
    delete process.env.APP_TIMEZONE;
    expect(today(after).toISOString()).toBe("2026-03-11T00:00:00.000Z");
    process.env.APP_TIMEZONE = saved;
  });
});

describe("production config", () => {
  const complete = Object.fromEntries(REQUIRED_IN_PRODUCTION.map((name) => [name, "x"]));

  test("lists exactly what is missing", () => {
    expect(missingProductionEnv(complete)).toEqual([]);
    expect(missingProductionEnv({ ...complete, SMTP_HOST: " ", APP_URL: undefined }).sort()).toEqual(["APP_URL", "SMTP_HOST"]);
  });

  test("refuses to start in production only", () => {
    expect(() => assertProductionEnv({ NODE_ENV: "production" })).toThrow(/SMTP_HOST.*MAIL_FROM/);
    expect(() => assertProductionEnv({ NODE_ENV: "production", ...complete })).not.toThrow();
    expect(() => assertProductionEnv({ NODE_ENV: "development" })).not.toThrow();
  });

  test("links use APP_URL without a doubled slash", () => {
    process.env.APP_URL = "https://stay.example/";
    expect(siteUrl("/a")).toBe("https://stay.example/a");
    delete process.env.APP_URL;
  });
});

describe("image sniffing (3.10)", () => {
  const buf = (...bytes) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(12)]).subarray(0, 12);
  test.each([
    [buf(0xff, 0xd8, 0xff, 0xe0), "image/jpeg"],
    [buf(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), "image/png"],
    [Buffer.from("RIFF\0\0\0\0WEBP"), "image/webp"],
    [Buffer.from("<svg onload=x"), null],
    [Buffer.from("GIF89a000000"), null],
    [Buffer.alloc(12), null],
  ])("%#", (bytes, expected) => {
    expect(sniffImageType(bytes)).toBe(expected);
  });
});

describe("cloudinary urls", () => {
  const url = "https://res.cloudinary.com/x/image/upload/v1/a.jpg";
  test("adds format, quality and width", () => {
    expect(photoUrl(url, 400)).toBe("https://res.cloudinary.com/x/image/upload/f_auto,q_auto,w_400,c_limit/v1/a.jpg");
    expect(photoSrcset(url, [400, 800])).toContain("w_800,c_limit/v1/a.jpg 800w");
  });
  test("leaves other hosts alone", () => {
    expect(photoUrl("https://images.unsplash.com/a", 400)).toBe("https://images.unsplash.com/a");
    expect(photoSrcset("https://images.unsplash.com/a")).toBe("");
  });
});

describe("emails", () => {
  const booking = {
    _id: "abc",
    reference: "BK-1",
    checkIn: new Date("2030-01-01"),
    checkOut: new Date("2030-01-03"),
    guests: 2,
    totalPrice: 2000,
    currency: "INR",
  };
  const listing = { title: "<b>Cabin</b>" };
  const data = {
    verifyEmail: { username: "a", token: "t", welcome: true },
    passwordReset: { username: "a", token: "t" },
    passwordChanged: { username: "a" },
    bookingRequested: { booking, listing },
    bookingRequestToHost: { booking, listing, guestName: "a", message: "hi" },
    bookingAccepted: { booking, listing, hostName: "h", hostEmail: "h@x" },
    bookingDeclined: { booking, listing, reason: "r" },
    bookingExpired: { booking, listing },
    bookingCancelled: { booking, listing, cancelledBy: "host", reason: "r" },
    supportReceived: { name: "a", reference: "WL-1", topic: "t" },
    supportForward: { name: "a", reference: "WL-1", topic: "t", email: "a@x", message: "m" },
    reportForward: { reference: "R-1", reason: "r", listingTitle: "c", listingUrl: "http://x" },
    accountDeleted: { username: "a" },
  };

  test.each(types)("%s renders html and text", (type) => {
    const mail = buildEmail(type, data[type]);
    expect(mail.subject).toBeTruthy();
    expect(mail.text).not.toContain("<%");
    expect(mail.html).toContain("max-width:600px");
    expect(mail.html).not.toMatch(/undefined|\[object/);
  });

  test("escapes listing text in html", () => {
    const { html } = buildEmail("bookingRequested", data.bookingRequested);
    expect(html).not.toContain("<b>Cabin</b>");
    expect(html).toContain("&lt;b&gt;Cabin&lt;/b&gt;");
  });

  test("a request email to a host links to a page, never a state change", () => {
    const { html, text } = buildEmail("bookingRequestToHost", data.bookingRequestToHost);
    expect(text).toContain("/bookings/hosting");
    expect(html + text).not.toMatch(/\/accept|\/decline/);
  });
});

describe("logger", () => {
  test("drops anything that could identify or open an account", () => {
    expect(logger.clean({ route: "/x", password: "p", email: "e", resetToken: "t", sessionId: "s", cookie: "c", body: {}, userId: "u" }))
      .toEqual({ route: "/x", userId: "u" });
  });
});

describe("small helpers", () => {
  test("query strings repeat array values", () => {
    expect(buildQs({ amenities: ["wifi", "pool"], q: "" })).toBe("?amenities=wifi&amenities=pool");
  });
  test("a quote is nights plus the cleaning fee, with no tax", () => {
    expect(quote({ price: 100, cleaningFee: 50, currency: "USD" }, 3)).toEqual({
      currency: "USD", nightlyPrice: 100, cleaningFee: 50, subtotal: 300, taxAmount: 0, totalPrice: 350,
    });
  });
  test("blocked ranges include both ends", () => {
    const listing = { blockedRanges: [{ from: new Date("2030-01-05"), to: new Date("2030-01-06") }] };
    expect(blockedNights(listing)).toEqual(["2030-01-05", "2030-01-06"]);
    expect(overlapsBlocked(listing, new Date("2030-01-06"), new Date("2030-01-08"))).toBe(true);
    expect(overlapsBlocked(listing, new Date("2030-01-03"), new Date("2030-01-05"))).toBe(false);
    expect(overlapsBlocked(listing, new Date("2030-01-07"), new Date("2030-01-08"))).toBe(false);
  });
});
