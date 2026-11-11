const request = require("supertest");
const cheerio = require("cheerio");
const fs = require("fs");
const app = require("../../app");
const User = require("../../models/user");
const Listing = require("../../models/listing");
const Booking = require("../../models/booking");
const Review = require("../../models/review");
const cloudinary = require("../../cloudConfig");
const mailer = require("../../utils/mailer");
const { publicProfile, PUBLIC_FIELDS } = require("../../utils/profile");
const { connectDb, disconnectDb, clearDb, createUser, createListing, login, day } = require("../helpers");

jest.mock("../../cloudConfig", () => ({
  uploader: { upload: jest.fn(), destroy: jest.fn().mockResolvedValue({}) },
}));

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

beforeAll(connectDb);
afterAll(disconnectDb);
beforeEach(async () => {
  await clearDb();
  mailer.outbox.length = 0;
  jest.clearAllMocks();
  cloudinary.uploader.upload.mockResolvedValue({ secure_url: "https://cdn.test/me.png", public_id: "me-id" });
  cloudinary.uploader.destroy.mockResolvedValue({});
});

const profileOf = async (username = "alice", agent = request(app)) => agent.get(`/users/${username}`);
const post = (agent, fields = {}, file) => {
  const req = agent.post("/account/profile").field("username", fields.username ?? "alice");
  for (const [key, value] of Object.entries(fields)) {
    if (key === "username") continue;
    [].concat(value).forEach((one) => req.field(key, one));
  }
  return file ? req.attach("avatar", file[0], file[1]) : req;
};

describe("public profile: the allowlist", () => {
  const SECRETS = {
    email: "secret-alice@example.com",
    pendingEmail: "pending-alice@example.com",
    note: "PRIVATE-NOTE-123",
    wish: "Secret Wish Cabin",
  };

  const seed = async () => {
    const alice = await createUser("alice");
    const host = await createUser("host");
    await User.updateOne(
      { _id: alice._id },
      {
        email: SECRETS.email,
        pendingEmail: SECRETS.pendingEmail,
        displayName: "Alice Wonder",
        bio: "I love old harbours.",
        city: "Lisbon",
        country: "Portugal",
        languages: ["English", "Spanish"],
        isAdmin: true,
        emailVerifiedAt: new Date(),
        termsVersion: "v-secret-terms",
        passwordChangedAt: new Date(),
        avatar: { url: "https://cdn.test/alice.png", filename: "alice-id" },
      },
    );
    const wished = await createListing(host, { title: SECRETS.wish });
    await User.updateOne({ _id: alice._id }, { wishlist: [wished._id] });
    await Booking.create({
      listing: wished._id,
      guest: alice._id,
      checkIn: new Date(day(5)),
      checkOut: new Date(day(6)),
      nights: [new Date(day(5))],
      totalPrice: 987654,
      guestMessage: SECRETS.note,
    });
    return alice;
  };

  test("a stranger sees the allowlist and nothing else", async () => {
    await seed();
    const res = await profileOf();
    expect(res.status).toBe(200);
    const $ = cheerio.load(res.text);
    const main = $("main").text();
    expect($("h1").text()).toBe("Alice Wonder");
    expect(main).toContain("@alice");
    expect(main).toContain("I love old harbours.");
    expect(main).toContain("Lisbon, Portugal");
    expect(main).toContain("English, Spanish");
    expect(main).toMatch(/Member since [A-Z][a-z]+ \d{4}/);
    expect(main).toContain("Email verified");
    expect($("img.wl-avatar").attr("src")).toBe("https://cdn.test/alice.png");
  });

  test("email, pending email, admin flag, terms, wishlist, bookings and hashes never appear", async () => {
    await seed();
    const html = (await profileOf()).text;
    for (const secret of [
      SECRETS.email, SECRETS.pendingEmail, SECRETS.note, SECRETS.wish,
      "987654", "v-secret-terms", "isAdmin", "passwordChangedAt", "hash", "salt", "alice-id",
      "alice@example.com",
    ]) {
      expect([secret, html.includes(secret)]).toEqual([secret, false]);
    }
    // The Admin link is for admins viewing the site; nothing about the profile's owner leaks
    expect(cheerio.load(html)("main").text()).not.toMatch(/admin/i);
  });

  test("the view-model is built by picking, so a new User field stays private", () => {
    const everything = {
      _id: new (require("mongoose").Types.ObjectId)(),
      username: "u",
      displayName: "Name",
      email: "a@b.c",
      hash: "h",
      salt: "s",
      isAdmin: true,
      wishlist: [1],
      phone: "123",
      dateOfBirth: "2000-01-01",
      address: "1 Street",
      termsVersion: "1",
      passwordChangedAt: new Date(),
      pendingEmail: "p@q.r",
      avatar: { url: "https://cdn.test/x.png", filename: "secret-filename" },
      emailVerifiedAt: new Date(),
    };
    const view = publicProfile(everything);
    expect(Object.keys(view).sort()).toEqual([...PUBLIC_FIELDS].sort());
    expect(JSON.stringify(view)).not.toMatch(/a@b\.c|"h"|secret-filename|123|2000-01-01|Street|p@q\.r/);
  });

  test("markup in a name or bio is escaped, and a line break in the bio is kept as text", async () => {
    const alice = await createUser("alice");
    await User.updateOne(
      { _id: alice._id },
      { displayName: "<b>Bold</b>", bio: "<script>alert(1)</script>\nsecond line" },
    );
    const html = (await profileOf()).text;
    expect(html).not.toContain("<script>alert(1)");
    expect(html).not.toContain("<b>Bold</b>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;b&gt;Bold&lt;/b&gt;");
  });

  test("without a photo or display name: initials tile and the username", async () => {
    await createUser("alice");
    const $ = cheerio.load((await profileOf()).text);
    expect($("h1").text()).toBe("alice");
    expect($("img.wl-avatar").length).toBe(0);
    expect($("span.wl-avatar--tile").text()).toBe("A");
    expect($("span.wl-avatar--tile").attr("aria-hidden")).toBe("true");
  });

  test("optional fields that are empty leave no empty labels", async () => {
    await createUser("alice");
    const $ = cheerio.load((await profileOf()).text);
    expect($(".wl-profile__facts").text()).not.toMatch(/Lives in|Speaks/);
    expect($(".wl-profile__bio").length).toBe(0);
    expect($("main").text()).not.toContain("Email verified");
  });

  test("an unknown or hidden user is a plain 404 that says nothing about deletion", async () => {
    const alice = await createUser("alice");
    await User.updateOne({ _id: alice._id }, { profileHidden: true });
    const hidden = await profileOf("alice");
    const unknown = await profileOf("nobody-here");
    expect([hidden.status, unknown.status]).toEqual([404, 404]);
    expect(hidden.text).toBe(unknown.text.split("nobody-here").join("alice"));
    expect(cheerio.load(hidden.text)("main").text()).not.toMatch(/delet|hidden|suspend|banned/i);
    expect(hidden.text).not.toContain("alice@example.com");
  });

  test("needs no login", async () => {
    await createUser("alice");
    expect((await request(app).get("/users/alice")).status).toBe(200);
  });
});

describe("public profile: what each role shows", () => {
  test("a host's published listings appear as cards; hidden ones do not", async () => {
    const alice = await createUser("alice");
    await createListing(alice, { title: "Shown Stay" });
    await createListing(alice, { title: "Hidden Stay", status: "hidden" });
    const $ = cheerio.load((await profileOf()).text);
    expect($("#listings-title").text()).toContain("Stays hosted by");
    expect($(".wl-listing-card").length).toBe(1);
    expect($("main").text()).toContain("Shown Stay");
    expect($("main").text()).not.toContain("Hidden Stay");
  });

  test("a long list is paginated", async () => {
    const alice = await createUser("alice");
    for (let i = 0; i < 13; i++) await createListing(alice, { title: `Stay number ${i}` });
    const first = cheerio.load((await profileOf()).text);
    expect(first(".wl-listing-card").length).toBe(12);
    expect(first(".wl-pagination a[href='/users/alice?page=2']").length).toBeGreaterThan(0);
    const second = cheerio.load((await request(app).get("/users/alice?page=2")).text);
    expect(second(".wl-listing-card").length).toBe(1);
  });

  test("a guest's reviews show the stay and the Verified stay label only where it applies", async () => {
    const alice = await createUser("alice");
    const host = await createUser("host");
    const one = await createListing(host, { title: "Verified Villa" });
    const two = await createListing(host, { title: "Older Cottage" });
    const hiddenStay = await createListing(host, { title: "Secret Hidden Hut", status: "hidden" });
    const make = async (listing, over) => {
      const review = await Review.create({ comment: `About ${listing.title}`, rating: 4, author: alice._id, ...over });
      await Listing.updateOne({ _id: listing._id }, { $push: { reviews: review._id } });
    };
    await make(one, { verifiedStay: true });
    await make(two, { verifiedStay: false });
    await make(hiddenStay, { verifiedStay: true });
    const $ = cheerio.load((await profileOf()).text);
    const cards = $(".review-card");
    expect(cards.length).toBe(2);
    expect($("main").text()).not.toContain("Secret Hidden Hut");
    const verified = cards.filter((_, el) => $(el).text().includes("Verified Villa"));
    const older = cards.filter((_, el) => $(el).text().includes("Older Cottage"));
    expect(verified.text()).toContain("Verified stay");
    expect(older.text()).not.toContain("Verified stay");
    expect(verified.find("a.wl-user-link").attr("href")).toMatch(/^\/listings\//);
  });

  test("an owner sees an edit link on their own profile and a stranger does not", async () => {
    await createUser("alice");
    await createUser("bob");
    const own = cheerio.load((await profileOf("alice", await login(app, "alice"))).text);
    expect(own("main a[href='#edit-profile']").text()).toContain("Edit profile");
    const other = cheerio.load((await profileOf("alice", await login(app, "bob"))).text);
    expect(other("main a[href='#edit-profile']").length).toBe(0);
    expect(other("#edit-profile, #contact-title, #delete-title").length).toBe(0);
  });
});

describe("names link to the public profile", () => {
  test("host and review author on a stay; the other party on a booking; menus", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const listing = await createListing(alice);
    await User.updateOne({ _id: alice._id }, { displayName: "Alice Wonder" });
    const review = await Review.create({ comment: "Lovely", rating: 5, author: bob._id });
    await Listing.updateOne({ _id: listing._id }, { $push: { reviews: review._id } });
    const stay = cheerio.load((await request(app).get(`/listings/${listing._id}`)).text);
    expect(stay(".wl-stay__host a[href='/users/alice']").text()).toBe("Alice Wonder");
    expect(stay(".review-card a[href='/users/bob']").text()).toBe("bob");

    const booking = await Booking.create({
      listing: listing._id,
      guest: bob._id,
      status: "confirmed",
      checkIn: new Date(day(5)),
      checkOut: new Date(day(6)),
      nights: [new Date(day(5))],
      totalPrice: 1,
    });
    const guestSees = cheerio.load((await (await login(app, "bob")).get(`/bookings/${booking._id}`)).text);
    expect(guestSees("a.wl-user-link[href='/users/alice']").text()).toBe("Alice Wonder");
    const hostSees = cheerio.load((await (await login(app, "alice", "host")).get(`/bookings/${booking._id}`)).text);
    expect(hostSees("a.wl-user-link[href='/users/bob']").text()).toBe("bob");
    expect(cheerio.load((await (await login(app, "bob")).get("/help")).text)(".navbar a[href='/users/bob']").text()).toBe("Profile");
  });

  test("a deleted reviewer is plain text, not a link", async () => {
    const alice = await createUser("alice");
    const listing = await createListing(alice);
    const review = await Review.create({ comment: "Gone", rating: 3 });
    await Listing.updateOne({ _id: listing._id }, { $push: { reviews: review._id } });
    const $ = cheerio.load((await request(app).get(`/listings/${listing._id}`)).text);
    expect($(".review-card strong").text()).toContain("Deleted user");
    expect($(".review-card strong a").length).toBe(0);
  });
});

describe("contact details are shared only on a confirmed booking, with the two parties", () => {
  const setup = async () => {
    const host = await createUser("host");
    const guestUser = await createUser("bob");
    await createUser("carol");
    const listing = await createListing(host);
    const booking = await Booking.create({
      listing: listing._id,
      guest: guestUser._id,
      status: "confirmed",
      checkIn: new Date(day(5)),
      checkOut: new Date(day(6)),
      nights: [new Date(day(5))],
      totalPrice: 1,
    });
    return { host, guestUser, listing, booking };
  };

  test("both parties see each other's email; a third user does not and is turned away", async () => {
    const { booking } = await setup();
    const bob = await login(app, "bob");
    const host = await login(app, "host", "host");
    const carol = await login(app, "carol");
    expect((await bob.get(`/bookings/${booking._id}`)).text).toContain("host@example.com");
    expect((await host.get(`/bookings/${booking._id}`)).text).toContain("bob@example.com");
    const third = await carol.get(`/bookings/${booking._id}`);
    expect(third.status).toBe(302);
    expect(third.text).not.toMatch(/bob@example\.com|host@example\.com/);
    expect((await (await login(app, "carol", "host")).get(`/bookings/${booking._id}`)).status).toBe(302);
  });

  test("no email in lists or on public pages, even for a confirmed booking", async () => {
    const { listing } = await setup();
    const host = await login(app, "host", "host");
    for (const url of ["/bookings/hosting", `/listings/${listing._id}`, "/users/bob", "/users/host"]) {
      const text = (await host.get(url)).text;
      expect([url, /bob@example\.com/.test(text)]).toEqual([url, false]);
    }
    const bob = await login(app, "bob");
    for (const url of ["/bookings", `/listings/${listing._id}`, "/users/host"]) {
      expect([url, /host@example\.com/.test((await bob.get(url)).text)]).toEqual([url, false]);
    }
    expect(/bob@example\.com|host@example\.com/.test((await request(app).get(`/listings/${listing._id}`)).text)).toBe(false);
  });

  test("a pending request shares nothing, and cancelling takes it away again", async () => {
    const { booking } = await setup();
    const bob = await login(app, "bob");
    const host = await login(app, "host", "host");
    await Booking.updateOne({ _id: booking._id }, { status: "pending", expiresAt: new Date(Date.now() + 36e5) });
    expect((await bob.get(`/bookings/${booking._id}`)).text).not.toContain("host@example.com");
    expect((await host.get(`/bookings/${booking._id}`)).text).not.toContain("bob@example.com");
    await Booking.updateOne({ _id: booking._id }, { status: "confirmed" });
    expect((await bob.get(`/bookings/${booking._id}`)).text).toContain("host@example.com");
    await Booking.updateOne({ _id: booking._id }, { status: "cancelled", cancelledBy: "host" });
    expect((await bob.get(`/bookings/${booking._id}`)).text).not.toContain("host@example.com");
    expect((await host.get(`/bookings/${booking._id}`)).text).not.toContain("bob@example.com");
  });
});

describe("editing the profile", () => {
  test("every field is saved and shows on the public page", async () => {
    await createUser("alice");
    const agent = await login(app, "alice");
    const res = await post(agent, {
      displayName: "Alice W",
      bio: "Hello there",
      city: "Pune",
      country: "India",
      languages: ["Hindi", "English"],
    });
    expect(res.headers.location).toBe("/users/alice");
    const user = await User.findOne({ username: "alice" });
    expect([user.displayName, user.bio, user.city, user.country]).toEqual(["Alice W", "Hello there", "Pune", "India"]);
    expect(user.languages).toEqual(["Hindi", "English"]);
    const page = cheerio.load((await profileOf()).text);
    expect(page("h1").text()).toBe("Alice W");
    expect(page(".wl-profile__facts").text()).toContain("Pune, India");
    expect(cheerio.load((await agent.get("/listings")).text)(".wl-toast").text()).toContain("profile has been saved");
  });

  test("blank optional fields are cleared", async () => {
    const alice = await createUser("alice");
    await User.updateOne({ _id: alice._id }, { displayName: "Old", bio: "Old bio", city: "X", languages: ["English"] });
    const agent = await login(app, "alice");
    await post(agent, { displayName: "", bio: "", city: "", country: "" });
    const user = await User.findOne({ username: "alice" }).lean();
    expect([user.displayName, user.bio, user.city, user.languages]).toEqual([undefined, undefined, undefined, []]);
  });

  test.each([
    ["a one-letter display name", { displayName: "A" }, "2 to 50"],
    ["a display name over 50", { displayName: "x".repeat(51) }, "2 to 50"],
    ["a bio over 300", { bio: "x".repeat(301) }, "300 characters"],
    ["a city over 80", { city: "x".repeat(81) }, "80"],
    ["a language that is not on the list", { languages: ["Klingon"] }, "from the list"],
  ])("refuses %s and saves nothing", async (_, fields, message) => {
    await createUser("alice");
    const agent = await login(app, "alice");
    await agent.get("/users/alice");
    await post(agent, fields);
    const toast = cheerio.load((await agent.get("/users/alice")).text)(".wl-toast").text();
    expect(toast).toContain(message);
    const user = await User.findOne({ username: "alice" }).lean();
    expect(user.displayName).toBeUndefined();
    expect(user.bio).toBeUndefined();
  });

  test("the account form is multipart and carries the allowlisted fields", async () => {
    await createUser("alice");
    const agent = await login(app, "alice");
    const $ = cheerio.load((await agent.get("/users/alice")).text);
    const form = $("form[action='/account/profile']");
    expect(form.attr("enctype")).toBe("multipart/form-data");
    expect(form.find("input[name=avatar][type=file]").length).toBe(1);
    expect(form.find("textarea[name=bio]").attr("maxlength")).toBe("300");
    expect(form.find("input[name=languages]").length).toBeGreaterThan(5);
    expect(form.find("input[name=email]").length).toBe(0);
    expect($("#profile-title, #contact-title, #security-title, #data-title, #delete-title").length).toBe(5);
  });

  test("the security section shows the mode and the terms acceptance", async () => {
    const alice = await createUser("alice");
    await User.updateOne({ _id: alice._id }, { termsAcceptedAt: new Date("2026-03-04T10:00:00Z"), termsVersion: "2026-03" });
    const agent = await login(app, "alice", "host");
    const text = cheerio.load((await agent.get("/users/alice")).text)("[aria-labelledby=security-title]").text();
    expect(text).toContain("host mode");
    expect(text).toContain("2026-03-04");
    expect(text).toContain("2026-03");
  });
});

describe("profile photo", () => {
  test("an upload is stored, shown, and replacing it removes the old one", async () => {
    const alice = await createUser("alice");
    await User.updateOne({ _id: alice._id }, { avatar: { url: "https://cdn.test/old.png", filename: "old-id" } });
    const agent = await login(app, "alice");
    await post(agent, {}, [PNG, "me.png"]);
    const user = await User.findOne({ username: "alice" });
    expect(user.avatar.url).toBe("https://cdn.test/me.png");
    expect(user.avatar.filename).toBe("me-id");
    expect(cloudinary.uploader.upload).toHaveBeenCalledTimes(1);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith("old-id");
    expect(cheerio.load((await profileOf()).text)("img.wl-avatar").attr("src")).toBe("https://cdn.test/me.png");
  });

  test("the temp file is removed after the upload", async () => {
    await createUser("alice");
    const agent = await login(app, "alice");
    const before = fs.existsSync("uploads") ? fs.readdirSync("uploads").length : 0;
    await post(agent, {}, [PNG, "me.png"]);
    const after = fs.existsSync("uploads") ? fs.readdirSync("uploads").length : 0;
    expect(after).toBe(before);
  });

  test.each([
    ["a text file named .png", Buffer.from("not an image at all"), "a.png", "image/png"],
    ["a script declared as WebP", Buffer.from("<script>alert(1)</script>"), "a.webp", "image/webp"],
    ["a PDF", Buffer.from("%PDF-1.4"), "a.pdf", "application/pdf"],
  ])("rejects %s and uploads nothing", async (_, content, name, type) => {
    await createUser("alice");
    const agent = await login(app, "alice");
    const res = await agent
      .post("/account/profile")
      .field("username", "alice")
      .attach("avatar", content, { filename: name, contentType: type });
    expect(res.status).toBe(400);
    expect(cloudinary.uploader.upload).not.toHaveBeenCalled();
    expect((await User.findOne({ username: "alice" })).avatar?.url).toBeUndefined();
  });

  test("a failed save removes the new upload and keeps the old photo", async () => {
    const alice = await createUser("alice");
    await createUser("bob");
    await User.updateOne({ _id: alice._id }, { avatar: { url: "https://cdn.test/old.png", filename: "old-id" } });
    const agent = await login(app, "alice");
    await post(agent, { username: "bob" }, [PNG, "me.png"]); // username taken
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith("me-id");
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalledWith("old-id");
    expect((await User.findOne({ username: "alice" })).avatar.url).toBe("https://cdn.test/old.png");
  });

  test("the photo can be removed", async () => {
    const alice = await createUser("alice");
    await User.updateOne({ _id: alice._id }, { avatar: { url: "https://cdn.test/old.png", filename: "old-id" } });
    const agent = await login(app, "alice");
    await post(agent, { removeAvatar: "on" });
    expect((await User.findOne({ username: "alice" })).avatar?.url).toBeUndefined();
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith("old-id");
  });

  test("deleting the account removes the photo too", async () => {
    const alice = await createUser("alice");
    await User.updateOne({ _id: alice._id }, { avatar: { url: "https://cdn.test/old.png", filename: "old-id" } });
    const agent = await login(app, "alice");
    await agent.post("/account/delete").type("form").send({ currentPassword: "password123", confirm: "DELETE" });
    expect(await User.countDocuments({ username: "alice" })).toBe(0);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith("old-id");
  });

  test("an upload needs a CSRF token", async () => {
    await createUser("alice");
    const agent = await login(app, "alice");
    const raw = request(app)
      .post("/account/profile")
      .set("Cookie", agent.jar.getCookies({ path: "/", domain: "127.0.0.1", secure: false, script: false }).toValueString())
      .field("username", "alice")
      .attach("avatar", PNG, "me.png");
    expect((await raw).status).toBe(403);
    expect(cloudinary.uploader.upload).not.toHaveBeenCalled();
  });
});

describe("the data download", () => {
  test("includes the profile and no secrets", async () => {
    const alice = await createUser("alice");
    await User.updateOne({ _id: alice._id }, { displayName: "Alice W", bio: "Hi", city: "Pune", languages: ["Hindi"] });
    const agent = await login(app, "alice");
    const data = JSON.parse((await agent.get("/account/export")).text);
    expect(data.account.displayName).toBe("Alice W");
    expect(data.account.bio).toBe("Hi");
    expect(data.account.languages).toEqual(["Hindi"]);
    expect(JSON.stringify(data)).not.toMatch(/"(hash|salt|resetTokenHash|verifyTokenHash)"/);
  });
});
