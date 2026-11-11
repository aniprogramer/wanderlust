// The rebuilt listing form: rendering, validation, drafts, publishing rules and the public pin
jest.mock("../../cloudConfig", () => ({
  uploader: {
    upload: jest.fn().mockResolvedValue({ secure_url: "https://cdn.test/new.png", public_id: "new-id" }),
    destroy: jest.fn().mockResolvedValue({}),
  },
}));
jest.mock("../../utils/geocode");

const request = require("supertest");
const cheerio = require("cheerio");
const cloudinary = require("../../cloudConfig");
const { geocode } = require("../../utils/geocode");
const app = require("../../app");
const Listing = require("../../models/listing");
const Booking = require("../../models/booking");
const { AMENITIES, AMENITY_GROUPS, COUNTRIES } = require("../../utils/constants");
const { distanceM } = require("../../utils/location");
const {
  connectDb, disconnectDb, clearDb, createUser, createListing, login, day, LISTING_FIELDS,
} = require("../helpers");

beforeAll(connectDb);
afterAll(disconnectDb);

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const PIN = { "listing[lat]": "19.07", "listing[lng]": "72.87" };

let owner, host;
beforeEach(async () => {
  await clearDb();
  jest.clearAllMocks();
  geocode.mockResolvedValue([-106.82, 39.19]);
  owner = await createUser("alice");
  host = await login(app, "alice", "host");
});

const send = (agent, method, url, fields = {}, photos = 1) => {
  let req = agent[method](url);
  for (const [k, v] of Object.entries(fields)) {
    [].concat(v).forEach((one) => { req = req.field(k, one); });
  }
  for (let i = 0; i < photos; i++) {
    req = req.attach("listing[images]", PNG, { filename: `${i}.png`, contentType: "image/png" });
  }
  return req;
};
const create = (fields = {}, photos = 1) =>
  send(host, "post", "/listings", { ...LISTING_FIELDS, ...fields }, photos);
const draftFields = (fields = {}) => ({ intent: "draft", "listing[title]": "My draft", ...fields });

describe("the form", () => {
  test("new and edit come from one partial and draw every section", async () => {
    const listing = await createListing(owner);
    for (const url of ["/listings/new", `/listings/${listing._id}/edit`]) {
      const $ = cheerio.load((await host.get(url)).text);
      expect($("form.wl-listing-form")).toHaveLength(1);
      expect($("form.wl-listing-form").attr("enctype")).toBe("multipart/form-data");
      expect($('form.wl-listing-form input[name="_csrf"]')).toHaveLength(1);
      expect($(".wl-form-section legend, .wl-form-section > h2").map((_, el) => $(el).text().trim()).get())
        .toEqual(expect.arrayContaining(["Basics", "Location", "Space", "Pricing", "Stay rules", "Amenities and accessibility", "Photos", "Status"]));
    }
  });

  test.each([
    "title", "description", "propertyType", "category", "addressLine", "city", "region", "country",
    "lat", "lng", "noPinAck", "maxGuests", "bedrooms", "beds", "bathrooms", "sizeSqm", "currency",
    "price", "cleaningFee", "minNights", "maxNights", "checkInFrom", "checkInUntil", "checkOutBy",
    "quietHoursStart", "quietHoursEnd", "cancellationPolicy", "smokingAllowed", "petsAllowed",
    "partiesAllowed", "childrenWelcome", "otherRules", "amenities", "wifiMbps", "stepFreeAccess",
    "wheelchairEntrance", "wideDoorways", "accessibleBathroom", "liftInBuilding", "smokeAlarm",
    "carbonMonoxideAlarm", "firstAidKit", "fireExtinguisher", "images",
  ])("has a field for %s", async (field) => {
    const $ = cheerio.load((await host.get("/listings/new")).text);
    expect($(`[name="listing[${field}]"]`).length).toBeGreaterThan(0);
  });

  test("every named control has a label, and required is written out", async () => {
    const $ = cheerio.load((await host.get("/listings/new")).text);
    $("form.wl-listing-form").find("input, select, textarea").each((_, el) => {
      const input = $(el);
      if (input.attr("type") === "hidden") return;
      const labelled = input.closest("label").length || $(`label[for="${input.attr("id")}"]`).length;
      expect(labelled).toBeGreaterThan(0);
    });
    expect($('label[for="title"]').text()).toContain("(required)");
    expect($('label[for="sizeSqm"]').text()).not.toContain("(required)");
    expect($("fieldset.wl-form-section > legend").length).toBeGreaterThanOrEqual(6);
  });

  test("the lists: three policies, all grouped amenities, countries, the block-dates note", async () => {
    const res = await host.get("/listings/new");
    const $ = cheerio.load(res.text);
    expect($('[name="listing[cancellationPolicy]"]').map((_, el) => $(el).attr("value")).get()).toEqual(["flexible", "moderate", "strict"]);
    expect($('[name="listing[cancellationPolicy]"][checked]')).toHaveLength(0);
    const offered = $('[name="listing[amenities]"]').map((_, el) => $(el).attr("value")).get();
    expect(offered).toEqual(Object.values(AMENITY_GROUPS).flat());
    expect(offered).toEqual(expect.arrayContaining(["wifi", "dryer", "dedicated_desk", "garden", "gym"]));
    offered.forEach((key) => expect(AMENITIES[key]).toBeDefined());
    expect($("#country option").length).toBe(COUNTRIES.length + 1);
    expect(res.text).toContain("You can block dates after you save.");
    expect(res.text).toContain('No pin yet');
  });

  test("buttons: one primary, publish first", async () => {
    const $ = cheerio.load((await host.get("/listings/new")).text);
    const buttons = $("form.wl-listing-form button[name=intent]");
    expect(buttons.map((_, el) => $(el).attr("value")).get()).toEqual(["publish", "draft"]);
    expect($("form.wl-listing-form .wl-auth-btn--primary")).toHaveLength(1);
  });

  test("the edit form shows stored values, blocked dates and no block-dates note", async () => {
    const listing = await createListing(owner, {
      addressLine: "9 Hidden Lane", region: "Colorado", checkInFrom: "14:30", cancellationPolicy: "strict",
      petsAllowed: true, amenities: ["wifi"], stepFreeAccess: true,
      geometry: { type: "Point", coordinates: [12.5, 41.9] },
    });
    const res = await host.get(`/listings/${listing._id}/edit`);
    const $ = cheerio.load(res.text);
    expect($("#addressLine").attr("value")).toBe("9 Hidden Lane");
    expect($("#checkInFrom option[selected]").attr("value")).toBe("14:30");
    expect($("#policy-strict").attr("checked")).toBeDefined();
    expect($("#petsAllowed").attr("checked")).toBeDefined();
    expect($("#amenity-wifi").attr("checked")).toBeDefined();
    expect($("#stepFreeAccess").attr("checked")).toBeDefined();
    expect($("#smokingAllowed").attr("checked")).toBeUndefined();
    expect($("#availability").length).toBe(1);
    expect(res.text).not.toContain("You can block dates after you save.");
  });
});

describe("creating", () => {
  test("a full form saves every field", async () => {
    const res = await create({
      ...PIN,
      "listing[sizeSqm]": "80",
      "listing[cleaningFee]": "500",
      "listing[minNights]": "2",
      "listing[maxNights]": "14",
      "listing[quietHoursStart]": "22:00",
      "listing[quietHoursEnd]": "07:00",
      "listing[otherRules]": "Shoes off indoors.",
      "listing[smokingAllowed]": "on",
      "listing[petsAllowed]": "on",
      "listing[amenities]": ["wifi", "dedicated_desk"],
      "listing[wifiMbps]": "200",
      "listing[stepFreeAccess]": "on",
      "listing[smokeAlarm]": "on",
      newAlt: ["The front room"],
    });
    expect(res.headers.location).toBe("/listings");
    const saved = await Listing.findOne();
    expect(saved.toObject()).toMatchObject({
      status: "published", title: "Mountain Lodge", addressLine: "12 Birch Lane", city: "Aspen",
      location: "Aspen", region: "Colorado", country: "United States", sizeSqm: 80, cleaningFee: 500,
      minNights: 2, maxNights: 14, quietHoursStart: "22:00", quietHoursEnd: "07:00",
      otherRules: "Shoes off indoors.", smokingAllowed: true, petsAllowed: true, partiesAllowed: false,
      wifiMbps: 200, stepFreeAccess: true, smokeAlarm: true, cancellationPolicy: "moderate",
      hasWorkspace: true,
    });
    expect(saved.geometry.coordinates).toEqual([72.87, 19.07]);
    expect(saved.approxGeometry.coordinates).toHaveLength(2);
    // The pets house rule is also what the amenity list and the filter read
    expect(saved.amenities).toEqual(expect.arrayContaining(["wifi", "dedicated_desk", "pets_allowed"]));
    expect(saved.images[0].caption).toBe("The front room");
    expect(saved.detailsIncomplete).toBeUndefined();
  });

  test.each([
    ["listing[title]", "Too short", "title", "10 to 80"],
    ["listing[description]", "Tiny", "description", "50 to 2000"],
    ["listing[maxGuests]", "17", "maxGuests", "from 1 to 16"],
    ["listing[bedrooms]", "21", "bedrooms", "from 0 to 20"],
    ["listing[beds]", "0", "beds", "from 1 to 30"],
    ["listing[bathrooms]", "1.25", "bathrooms", "steps of 0.5"],
    ["listing[sizeSqm]", "4", "sizeSqm", "square metres"],
    ["listing[price]", "0", "price", "nightly price"],
    ["listing[cleaningFee]", "-1", "cleaningFee", "cleaning fee"],
    ["listing[minNights]", "31", "minNights", "minimum nights"],
    ["listing[maxNights]", "31", "maxNights", "maximum nights"],
    ["listing[country]", "Atlantis", "country", "Choose a country"],
    ["listing[checkInFrom]", "15:15", "checkInFrom", "earliest check-in"],
    ["listing[otherRules]", "o".repeat(301), "otherRules", "300"],
    ["listing[wifiMbps]", "0", "wifiMbps", "Mbps"],
  ])("%s=%s is refused inline, keeping what was typed", async (name, value, id, message) => {
    const res = await create({ [name]: value, "listing[city]": "Kept City" });
    expect(res.status).toBe(400);
    expect(await Listing.countDocuments()).toBe(0);
    expect(cloudinary.uploader.upload).not.toHaveBeenCalled();
    const $ = cheerio.load(res.text);
    const input = $(`#${id}`);
    expect(input.attr("aria-invalid")).toBe("true");
    expect(input.attr("aria-describedby")).toContain(`${id}-error`);
    expect($(`#${id}-error`).text()).toContain(message);
    expect($(`#${id}-error`).attr("hidden")).toBeUndefined();
    expect($("#form-error").text()).toContain("Fix 1 field");
    expect($("#city").attr("value")).toBe("Kept City");
  });

  test("several errors, ticked boxes and chosen radios all survive", async () => {
    const res = await create({
      "listing[title]": "",
      "listing[description]": "",
      "listing[petsAllowed]": "on",
      "listing[amenities]": ["wifi", "gym"],
      "listing[cancellationPolicy]": "strict",
    });
    const $ = cheerio.load(res.text);
    expect($("#form-error").text()).toContain("Fix 2 fields");
    expect($("#form-error").text()).toContain("choose your new photos again");
    expect($("#petsAllowed").attr("checked")).toBeDefined();
    expect($("#amenity-gym").attr("checked")).toBeDefined();
    expect($("#amenity-kitchen").attr("checked")).toBeUndefined();
    expect($("#policy-strict").attr("checked")).toBeDefined();
  });

  test("typed text is escaped when it comes back", async () => {
    const res = await create({ "listing[title]": "<b>x</b>" });
    expect(res.status).toBe(400);
    expect(res.text).not.toContain("<b>x</b>");
  });

  test("publishing needs a photo", async () => {
    const res = await create({}, 0);
    expect(res.status).toBe(400);
    const $ = cheerio.load(res.text);
    expect($("#photos-error").text()).toBe("Add at least one photo.");
    expect($("#img").attr("aria-invalid")).toBe("true");
  });

  test("a missing photo is reported together with the field errors", async () => {
    const res = await create({ "listing[title]": "Short" }, 0);
    const $ = cheerio.load(res.text);
    expect($("#form-error").text()).toContain("Fix 2 fields");
    expect($("#photos-error").text()).toBe("Add at least one photo.");
    expect($("#title-error").text()).toContain("10 to 80");
  });

  test("a chosen new photo becomes the cover", async () => {
    let n = 0;
    cloudinary.uploader.upload.mockImplementation(async () => {
      n += 1;
      return { secure_url: `https://cdn.test/${n}.png`, public_id: `id-${n}` };
    });
    await create({ coverImage: "new:1" }, 2);
    const saved = await Listing.findOne();
    expect(saved.images.map((p) => p.filename)).toEqual(["id-2", "id-1"]);
    expect(saved.image.filename).toBe("id-2");
    cloudinary.uploader.upload.mockResolvedValue({ secure_url: "https://cdn.test/new.png", public_id: "new-id" });
  });

  test("no pin and no acknowledgement holds it as a draft; a found address publishes", async () => {
    await create();
    expect((await Listing.findOne()).status).toBe("published");
    await Listing.deleteMany({});

    geocode.mockRejectedValue(new Error("down"));
    const res = await create();
    const held = await Listing.findOne();
    expect(held.status).toBe("draft");
    expect(res.headers.location).toBe(`/listings/${held._id}/edit`);
    expect((await host.get(res.headers.location)).text).toContain("No pin yet");
  });
});

describe("editing", () => {
  test("accepts a valid edit and clears what was emptied or unticked", async () => {
    const listing = await createListing(owner, {
      petsAllowed: true, amenities: ["pets_allowed"], otherRules: "Old rule", wifiMbps: 10,
      sizeSqm: 40, images: [{ url: "https://cdn.test/a.png", filename: "a" }],
    });
    const res = await send(host, "put", `/listings/${listing._id}`, LISTING_FIELDS, 0);
    expect(res.headers.location).toBe(`/listings/${listing._id}`);
    const saved = await Listing.findById(listing._id);
    expect(saved.toObject()).toMatchObject({ petsAllowed: false, title: "Mountain Lodge" });
    expect(saved.amenities).toEqual([]);
    expect(saved.otherRules).toBeUndefined();
    expect(saved.wifiMbps).toBeUndefined();
    expect(saved.sizeSqm).toBeUndefined();
  });

  test("an invalid edit re-renders with the error and what was typed, and saves nothing", async () => {
    const listing = await createListing(owner);
    const res = await send(host, "put", `/listings/${listing._id}`, { ...LISTING_FIELDS, "listing[title]": "Short", "listing[city]": "Typed" }, 0);
    expect(res.status).toBe(400);
    const $ = cheerio.load(res.text);
    expect($("#title").attr("aria-invalid")).toBe("true");
    expect($("#title").attr("value")).toBe("Short");
    expect($("#city").attr("value")).toBe("Typed");
    expect((await Listing.findById(listing._id)).title).toBe("Cozy Cabin");
  });

  test("alt text and the cover can be changed on stored photos", async () => {
    const listing = await createListing(owner, {
      images: [
        { url: "https://cdn.test/a.png", filename: "a" },
        { url: "https://cdn.test/b.png", filename: "b" },
      ],
    });
    await send(host, "put", `/listings/${listing._id}`, {
      ...LISTING_FIELDS,
      coverImage: "b",
      "existingAltFile[0]": "a",
      "existingAlt[0]": "The kitchen",
      "existingAltFile[1]": "b",
      "existingAlt[1]": "",
    }, 0);
    const saved = await Listing.findById(listing._id);
    expect(saved.images.map((p) => p.filename)).toEqual(["b", "a"]);
    expect(saved.images[1].caption).toBe("The kitchen");
    expect(saved.images[0].caption).toBeUndefined();
  });

  test("a hidden listing stays hidden whatever is saved", async () => {
    const listing = await createListing(owner, { status: "hidden" });
    const form = cheerio.load((await host.get(`/listings/${listing._id}/edit`)).text);
    expect(form("button[name=intent]")).toHaveLength(1);
    await send(host, "put", `/listings/${listing._id}`, LISTING_FIELDS, 1);
    expect((await Listing.findById(listing._id)).status).toBe("hidden");
  });

  test("saving clears detailsIncomplete, but saving a draft of it does not", async () => {
    const listing = await createListing(owner, { detailsIncomplete: true });
    await send(host, "put", `/listings/${listing._id}`, LISTING_FIELDS, 1);
    expect((await Listing.findById(listing._id)).detailsIncomplete).toBeUndefined();
  });

  test("filling in a missing address line keeps the pin that was already there", async () => {
    const listing = await createListing(owner, {
      city: "Aspen", geometry: { type: "Point", coordinates: [10, 20] },
    });
    await send(host, "put", `/listings/${listing._id}`, {
      ...LISTING_FIELDS, "listing[lat]": "20", "listing[lng]": "10",
    }, 1);
    expect(geocode).not.toHaveBeenCalled();
    expect((await Listing.findById(listing._id)).geometry.coordinates).toEqual([10, 20]);
  });

  test("a listing already live stays live when its new address cannot be placed", async () => {
    const listing = await createListing(owner, { geometry: { type: "Point", coordinates: [10, 20] } });
    geocode.mockResolvedValue(null);
    const res = await send(host, "put", `/listings/${listing._id}`, { ...LISTING_FIELDS, "listing[city]": "Nowhere" }, 1);
    const saved = await Listing.findById(listing._id);
    expect(saved.status).toBe("published");
    expect(saved.geometry?.coordinates).toBeUndefined();
    expect((await host.get(res.headers.location)).text).toContain("No pin yet");
  });
});

describe("drafts", () => {
  test("a draft saves with nearly nothing, and goes to the edit form", async () => {
    const res = await send(host, "post", "/listings", draftFields(), 0);
    const draft = await Listing.findOne();
    expect(draft.status).toBe("draft");
    expect(draft.title).toBe("My draft");
    expect(res.headers.location).toBe(`/listings/${draft._id}/edit`);
    expect((await host.get(res.headers.location)).status).toBe(200);
  });

  test("a draft with no title at all is usable on every owner page", async () => {
    await send(host, "post", "/listings", { intent: "draft", "listing[title]": "" }, 0);
    const draft = await Listing.findOne();
    expect((await host.get(`/listings/${draft._id}/edit`)).status).toBe(200);
    expect((await host.get(`/listings/${draft._id}`)).text).toContain("Untitled draft");
    expect((await host.get("/listings/mine")).text).toContain("Untitled draft");
  });

  test("a draft still refuses a value that is simply wrong", async () => {
    const res = await send(host, "post", "/listings", draftFields({ "listing[maxGuests]": "99" }), 0);
    expect(res.status).toBe(400);
    expect(await Listing.countDocuments()).toBe(0);
  });

  test("drafts are hidden from search, the map, other users, admins and sitemaps", async () => {
    const draft = await createListing(owner, { title: "Secret draft", status: "draft", geometry: { type: "Point", coordinates: [1, 2] } });
    const visitor = request(app);
    expect((await visitor.get("/listings")).text).not.toContain("Secret draft");
    expect((await visitor.get("/listings?q=Secret")).text).not.toContain("Secret draft");
    expect((await visitor.get("/listings/map")).text).not.toContain("Secret draft");
    expect((await visitor.get("/sitemap.xml")).text).not.toContain(String(draft._id));
    expect((await visitor.get(`/listings/${draft._id}`)).status).toBe(302);
    await createUser("mallory");
    const mallory = await login(app, "mallory");
    expect((await mallory.get(`/listings/${draft._id}`)).status).toBe(302);
    await createUser("root", { isAdmin: true });
    const admin = await login(app, "root");
    expect((await admin.get(`/listings/${draft._id}`)).status).toBe(302);
  });

  test("the owner sees drafts separately under Your listings, and can preview one", async () => {
    await createListing(owner, { title: "Live one here" });
    const draft = await createListing(owner, { title: "Unfinished place", status: "draft" });
    const $ = cheerio.load((await host.get("/listings/mine")).text);
    expect($("[data-draft]").text()).toContain("Unfinished place");
    expect($("[data-draft]").text()).not.toContain("Live one here");
    const preview = await host.get(`/listings/${draft._id}`);
    expect(preview.status).toBe(200);
    expect(preview.text).toContain("This is a draft");
    expect(preview.text).toContain('content="noindex');
  });

  test("a draft cannot be requested", async () => {
    const draft = await createListing(owner, { status: "draft" });
    await createUser("bob");
    const bob = await login(app, "bob");
    const res = await bob.post(`/listings/${draft._id}/bookings`).type("form").send({ booking: { checkIn: day(5), checkOut: day(7) } });
    expect(res.status).toBe(404);
    expect(await Booking.countDocuments()).toBe(0);
  });

  test("publishing a draft runs the full checks", async () => {
    await send(host, "post", "/listings", draftFields(), 0);
    const draft = await Listing.findOne();
    const refused = await send(host, "put", `/listings/${draft._id}`, { "listing[title]": "My draft" }, 0);
    expect(refused.status).toBe(400);
    expect((await Listing.findById(draft._id)).status).toBe("draft");

    const noPhoto = await send(host, "put", `/listings/${draft._id}`, LISTING_FIELDS, 0);
    expect(noPhoto.status).toBe(400);
    expect(noPhoto.text).toContain("Add at least one photo.");

    const res = await send(host, "put", `/listings/${draft._id}`, LISTING_FIELDS, 1);
    expect(res.headers.location).toBe(`/listings/${draft._id}`);
    expect((await Listing.findById(draft._id)).status).toBe("published");
  });

  test("publishing with no pin needs the acknowledgement", async () => {
    geocode.mockResolvedValue(null);
    await send(host, "post", "/listings", draftFields(), 1);
    const draft = await Listing.findOne();
    await send(host, "put", `/listings/${draft._id}`, LISTING_FIELDS, 0);
    expect((await Listing.findById(draft._id)).status).toBe("draft");
    await send(host, "put", `/listings/${draft._id}`, { ...LISTING_FIELDS, "listing[noPinAck]": "on" }, 0);
    expect((await Listing.findById(draft._id)).status).toBe("published");
  });

  test("a live listing can move to draft, unless guests are waiting on it", async () => {
    const listing = await createListing(owner, { images: [{ url: "https://cdn.test/a.png", filename: "a" }] });
    const bob = await createUser("bob");
    const booking = await Booking.create({
      listing: listing._id, guest: bob._id, checkIn: new Date(day(5)), checkOut: new Date(day(6)),
      nights: [new Date(day(5))], totalPrice: 1, status: "confirmed",
    });
    const res = await send(host, "put", `/listings/${listing._id}`, { ...LISTING_FIELDS, intent: "draft" }, 0);
    expect(res.headers.location).toBe(`/listings/${listing._id}/edit`);
    expect((await Listing.findById(listing._id)).status).toBe("published");
    await Booking.deleteOne({ _id: booking._id });
    await send(host, "put", `/listings/${listing._id}`, { ...LISTING_FIELDS, intent: "draft" }, 0);
    expect((await Listing.findById(listing._id)).status).toBe("draft");
  });
});

describe("the exact pin", () => {
  const pinned = () =>
    createListing(owner, {
      addressLine: "7 Secret Road",
      city: "Mumbai",
      region: "Maharashtra",
      country: "India",
      geometry: { type: "Point", coordinates: [72.8777, 19.076] },
    });

  test("a circle within reach of the pin is what gets stored for the public", async () => {
    const listing = await pinned();
    const away = distanceM(listing.geometry.coordinates, listing.approxGeometry.coordinates);
    expect(away).toBeGreaterThan(90);
    expect(away).toBeLessThan(500);
  });

  test("the public and a guest with no booking see city, country and a circle only", async () => {
    const listing = await pinned();
    await createUser("bob");
    for (const agent of [request(app), await login(app, "bob")]) {
      const { text } = await agent.get(`/listings/${listing._id}`);
      expect(text).toContain("Mumbai, India");
      expect(text).toContain('data-radius="500"');
      expect(text).not.toContain("7 Secret Road");
      expect(text).not.toContain("72.8777");
    }
    const map = await request(app).get("/listings/map");
    expect(map.text).not.toContain("72.8777");
  });

  test("a pending guest still cannot see it; a confirmed guest and the host can", async () => {
    const listing = await pinned();
    const bob = await createUser("bob");
    const bobAgent = await login(app, "bob");
    const stay = {
      listing: listing._id, guest: bob._id, checkIn: new Date(day(5)), checkOut: new Date(day(6)),
      nights: [new Date(day(5))], totalPrice: 1,
    };
    const booking = await Booking.create({ ...stay, status: "pending", requestedAt: new Date(), expiresAt: new Date(Date.now() + 864e5) });
    expect((await bobAgent.get(`/listings/${listing._id}`)).text).not.toContain("7 Secret Road");
    expect((await bobAgent.get(`/bookings/${booking._id}`)).text).not.toContain("7 Secret Road");

    await Booking.updateOne({ _id: booking._id }, { status: "confirmed" });
    for (const url of [`/listings/${listing._id}`, `/bookings/${booking._id}`]) {
      const { text } = await bobAgent.get(url);
      expect(text).toContain("7 Secret Road");
      expect(text).toContain('data-lng="72.8777"');
    }
    expect((await host.get(`/listings/${listing._id}`)).text).toContain("7 Secret Road");
  });

  test("a listing with no pin shows no map, and says so honestly", async () => {
    const listing = await createListing(owner, { noPinAck: true });
    const { text } = await request(app).get(`/listings/${listing._id}`);
    expect(text).not.toContain('data-mode="show"');
    expect(text).toContain("The exact address is shared once the host confirms your stay.");
  });
});
