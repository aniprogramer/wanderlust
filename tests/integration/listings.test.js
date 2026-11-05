jest.mock("../../cloudConfig", () => ({
  uploader: {
    upload: jest.fn().mockResolvedValue({
      secure_url: "https://cdn.test/new.png",
      public_id: "new-id",
    }),
    destroy: jest.fn().mockResolvedValue({}),
  },
}));
jest.mock("../../utils/geocode");

const request = require("supertest");
const cloudinary = require("../../cloudConfig");
const { geocode } = require("../../utils/geocode");
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

beforeAll(connectDb);
afterAll(disconnectDb);
beforeEach(async () => {
  await clearDb();
  jest.clearAllMocks();
  geocode.mockResolvedValue([-106.82, 39.19]);
});

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

const submit = (agent, method, url, fields = {}, withImage = true) => {
  const base = {
    "listing[title]": "Mountain Lodge",
    "listing[description]": "Snowy",
    "listing[location]": "Aspen",
    "listing[country]": "United States",
    "listing[price]": "2500",
    "listing[maxGuests]": "4",
    "listing[bedrooms]": "2",
    "listing[beds]": "2",
    "listing[bathrooms]": "1.5",
    ...fields,
  };
  let req = agent[method](url);
  for (const [k, v] of Object.entries(base)) req = req.field(k, v);
  return withImage
    ? req.attach("listing[image]", PNG, "a.png")
    : req;
};

describe("listing CRUD", () => {
  test("anyone can browse; show page renders details", async () => {
    const owner = await createUser("alice");
    const listing = await createListing(owner);
    expect((await request(app).get("/listings")).text).toContain("Cozy Cabin");
    expect((await request(app).get(`/listings/${listing._id}`)).text).toContain(
      "Cozy Cabin",
    );
  });

  test("create geocodes the address, uploads the image and sets the owner", async () => {
    const owner = await createUser("alice");
    const agent = await login(app);
    const res = await submit(agent, "post", "/listings", {
      "listing[category]": "Mountains",
    });
    expect(res.headers.location).toBe("/listings");

    const listing = await Listing.findOne({ title: "Mountain Lodge" });
    expect(listing.owner.equals(owner._id)).toBe(true);
    expect(listing.geometry.coordinates).toEqual([-106.82, 39.19]);
    expect(listing.category).toBe("Mountains");
    expect(listing.image.url).toBe("https://cdn.test/new.png");
    expect(geocode).toHaveBeenCalledWith("Aspen, United States");
  });

  test("create prefers picker coordinates over geocoding", async () => {
    await createUser("alice");
    const agent = await login(app);
    await submit(agent, "post", "/listings", {
      "listing[lat]": "10.5",
      "listing[lng]": "20.25",
    });
    const listing = await Listing.findOne({ title: "Mountain Lodge" });
    expect(listing.geometry.coordinates).toEqual([20.25, 10.5]);
    expect(geocode).not.toHaveBeenCalled();
  });

  test("create with an unknown location is rejected gracefully", async () => {
    await createUser("alice");
    const agent = await login(app);
    geocode.mockResolvedValue(null);
    const res = await submit(agent, "post", "/listings");
    expect(res.headers.location).toBe("/listings/new");
    expect(await Listing.countDocuments()).toBe(0);
    expect(cloudinary.uploader.upload).not.toHaveBeenCalled();
  });

  test("create still works when the geocoder is down", async () => {
    await createUser("alice");
    const agent = await login(app);
    geocode.mockRejectedValue(new Error("network"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    await submit(agent, "post", "/listings");
    const listing = await Listing.findOne({ title: "Mountain Lodge" });
    expect(listing).not.toBeNull();
    expect(listing.geometry.coordinates).toBeUndefined();
  });

  test("create validates input (400) and requires an image", async () => {
    await createUser("alice");
    const agent = await login(app);
    expect(
      (await submit(agent, "post", "/listings", { "listing[price]": "0" }))
        .status,
    ).toBe(400);
    const noImage = await submit(agent, "post", "/listings", {}, false);
    expect(noImage.headers.location).toBe("/listings/new");
    expect(await Listing.countDocuments()).toBe(0);
  });

  test("owner can update; blank category clears it; new image replaces old", async () => {
    const owner = await createUser("alice");
    const listing = await createListing(owner, {
      category: "Cabins",
      image: { url: "https://cdn.test/old.png", filename: "old-id" },
    });
    const agent = await login(app);
    const res = await submit(agent, "put", `/listings/${listing._id}`, {
      "listing[title]": "Renamed",
      "listing[category]": "",
    });
    expect(res.headers.location).toBe(`/listings/${listing._id}`);
    const updated = await Listing.findById(listing._id);
    expect(updated.title).toBe("Renamed");
    expect(updated.category).toBeUndefined();
    expect(updated.image.filename).toBe("new-id");
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith("old-id");
  });

  test("changing only the address re-geocodes instead of keeping the old pin", async () => {
    const owner = await createUser("alice");
    const listing = await createListing(owner, {
      geometry: { type: "Point", coordinates: [10, 20] },
    });
    const agent = await login(app);
    geocode.mockResolvedValue([77.1, 28.6]);
    await submit(
      agent,
      "put",
      `/listings/${listing._id}`,
      {
        "listing[location]": "Delhi",
        "listing[lat]": "20",
        "listing[lng]": "10",
      },
      false,
    );
    expect(geocode).toHaveBeenCalledWith("Delhi, United States");
    expect((await Listing.findById(listing._id)).geometry.coordinates).toEqual([
      77.1, 28.6,
    ]);
  });

  test("a changed address drops the old pin when the geocoder is down", async () => {
    const owner = await createUser("alice");
    const listing = await createListing(owner, {
      geometry: { type: "Point", coordinates: [10, 20] },
    });
    const agent = await login(app);
    geocode.mockRejectedValue(new Error("network"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    await submit(
      agent,
      "put",
      `/listings/${listing._id}`,
      {
        "listing[location]": "Delhi",
        "listing[lat]": "20",
        "listing[lng]": "10",
      },
      false,
    );
    const updated = await Listing.findById(listing._id);
    expect(updated.location).toBe("Delhi");
    expect(updated.geometry?.coordinates).toBeUndefined();
  });

  test("an unchanged address keeps the submitted pin", async () => {
    const owner = await createUser("alice");
    const listing = await createListing(owner, {
      geometry: { type: "Point", coordinates: [10, 20] },
    });
    const agent = await login(app);
    await submit(
      agent,
      "put",
      `/listings/${listing._id}`,
      {
        "listing[location]": "Aspen",
        "listing[lat]": "21",
        "listing[lng]": "11",
      },
      false,
    );
    expect(geocode).not.toHaveBeenCalled();
    expect((await Listing.findById(listing._id)).geometry.coordinates).toEqual([
      11, 21,
    ]);
  });

  test("show page says Unknown host when the owner is missing", async () => {
    const listing = await Listing.create({
      title: "Orphan",
      description: "d",
      price: 5,
      location: "x",
      country: "y",
    });
    expect((await request(app).get(`/listings/${listing._id}`)).text).toContain(
      "Unknown host",
    );
  });

  test("non-owner cannot update or delete", async () => {
    const owner = await createUser("alice");
    await createUser("mallory");
    const listing = await createListing(owner);
    const agent = await login(app, "mallory");

    await submit(
      agent,
      "put",
      `/listings/${listing._id}`,
      { "listing[title]": "Hacked" },
      false,
    );
    await agent.delete(`/listings/${listing._id}`);
    expect((await Listing.findById(listing._id)).title).toBe("Cozy Cabin");
  });

  test("delete cascades to reviews, bookings and wishlists", async () => {
    const owner = await createUser("alice");
    const guest = await createUser("bob");
    const listing = await createListing(owner);
    await Booking.create({
      listing: listing._id,
      guest: guest._id,
      checkIn: new Date(day(-6)),
      checkOut: new Date(day(-5)),
      nights: [new Date(day(-6))],
      totalPrice: 1000,
    });
    await User.updateOne(
      { _id: guest._id },
      { $push: { wishlist: listing._id } },
    );

    const agent = await login(app, "alice");
    await agent.delete(`/listings/${listing._id}`);

    expect(await Listing.countDocuments()).toBe(0);
    expect(await Booking.countDocuments()).toBe(0);
    expect((await User.findById(guest._id)).wishlist).toHaveLength(0);
  });

  test("a listing with upcoming confirmed bookings cannot be deleted", async () => {
    const owner = await createUser("alice");
    const guest = await createUser("bob");
    const listing = await createListing(owner);
    const stay = (checkIn, checkOut, status = "confirmed") =>
      Booking.create({
        listing: listing._id,
        guest: guest._id,
        checkIn: new Date(day(checkIn)),
        checkOut: new Date(day(checkOut)),
        nights: [new Date(day(checkIn))],
        totalPrice: 1,
        status,
      });
    await stay(5, 6);
    const agent = await login(app, "alice");
    const res = await agent.delete(`/listings/${listing._id}`);
    expect(res.headers.location).toBe(`/listings/${listing._id}`);
    expect(await Listing.countDocuments()).toBe(1);
    expect((await agent.get(`/listings/${listing._id}`)).text).toContain(
      "This listing has upcoming bookings. Cancel them first.",
    );

    // cancelled upcoming stays no longer block deletion
    await Booking.updateMany({}, { status: "cancelled" });
    await agent.delete(`/listings/${listing._id}`);
    expect(await Listing.countDocuments()).toBe(0);
  });

  test("failed update after upload removes the new image and keeps the old one", async () => {
    const owner = await createUser("alice");
    const listing = await createListing(owner, {
      image: { url: "https://cdn.test/old.png", filename: "old-id" },
    });
    const agent = await login(app);
    jest
      .spyOn(Listing.prototype, "save")
      .mockRejectedValueOnce(new Error("db down"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await submit(agent, "put", `/listings/${listing._id}`, {
      "listing[title]": "New",
    });
    expect(res.status).toBe(500);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith("new-id");
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalledWith("old-id");
    expect((await Listing.findById(listing._id)).image.filename).toBe("old-id");
  });

  test("an update that fails validation never uploads", async () => {
    const owner = await createUser("alice");
    const listing = await createListing(owner);
    const agent = await login(app);
    jest
      .spyOn(Listing.prototype, "validate")
      .mockRejectedValueOnce(new Error("invalid"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    await submit(agent, "put", `/listings/${listing._id}`);
    expect(cloudinary.uploader.upload).not.toHaveBeenCalled();
  });

  test("a failed create removes the uploaded image", async () => {
    await createUser("alice");
    const agent = await login(app);
    jest
      .spyOn(Listing.prototype, "save")
      .mockRejectedValueOnce(new Error("db down"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    await submit(agent, "post", "/listings");
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith("new-id");
  });

  test("malformed and unknown ids give 404 instead of crashing", async () => {
    const owner = await createUser("alice");
    const agent = await login(app);
    expect((await agent.get("/listings/not-an-id")).status).toBe(404);
    expect((await agent.get("/listings/not-an-id/edit")).status).toBe(404);
    expect(
      (await agent.get("/listings/507f1f77bcf86cd799439011/edit")).status,
    ).toBe(404);
    expect(owner).toBeDefined();
  });
});

describe("uploads", () => {
  const fs = require("fs");
  const uploads = () =>
    fs.existsSync("uploads") ? fs.readdirSync("uploads").length : 0;
  const IMAGE_ERROR = "Image must be a JPEG, PNG or WebP under 5 MB.";

  const post = (agent, file, name) => {
    let req = agent.post("/listings");
    for (const [k, v] of Object.entries({
      "listing[title]": "T",
      "listing[description]": "D",
      "listing[location]": "L",
      "listing[country]": "C",
      "listing[price]": "10",
    }))
      req = req.field(k, v);
    return req.attach("listing[image]", file, name);
  };

  test("oversized images get a friendly 400", async () => {
    await createUser("alice");
    const res = await post(
      await login(app),
      Buffer.alloc(5 * 1024 * 1024 + 1),
      "big.png",
    );
    expect(res.status).toBe(400);
    expect(res.text).toContain(IMAGE_ERROR);
  });

  test("non-image uploads get a friendly 400", async () => {
    await createUser("alice");
    const res = await post(await login(app), Buffer.from("hi"), "notes.txt");
    expect(res.status).toBe(400);
    expect(res.text).toContain(IMAGE_ERROR);
  });

  test("temp file is removed when validation fails", async () => {
    await createUser("alice");
    const agent = await login(app);
    const before = uploads();
    const res = await submit(agent, "post", "/listings", {
      "listing[price]": "0",
    });
    expect(res.status).toBe(400);
    expect(uploads()).toBe(before);
  });

  test("temp file is removed after a successful create too", async () => {
    await createUser("alice");
    const agent = await login(app);
    const before = uploads();
    await submit(agent, "post", "/listings");
    expect(uploads()).toBe(before);
  });
});

describe("error handler", () => {
  test("a Mongoose ValidationError renders a 400", async () => {
    await createUser("alice");
    const agent = await login(app);
    jest
      .spyOn(Listing.prototype, "save")
      .mockRejectedValueOnce(new (require("mongoose").Error.ValidationError)());
    const res = await submit(agent, "post", "/listings");
    expect(res.status).toBe(400);
  });
});

describe("forms", () => {
  test("new and edit forms render the picker, selects and current values", async () => {
    const owner = await createUser("alice");
    const listing = await createListing(owner, {
      category: "Cabins",
      geometry: { type: "Point", coordinates: [12.5, 41.9] },
    });
    const agent = await login(app);

    const form = await agent.get("/listings/new");
    expect(form.text).toContain('data-mode="picker"');
    expect(form.text).toContain('name="listing[category]"');

    const edit = await agent.get(`/listings/${listing._id}/edit`);
    expect(edit.text).toMatch(/<option value="Cabins" selected>/);
    expect(edit.text).toContain('name="listing[lng]" value="12.5"');
    expect(edit.text).toContain('name="listing[lat]" value="41.9"');
  });
});

describe("map", () => {
  test("map view lists only listings with coordinates", async () => {
    const owner = await createUser("alice");
    await createListing(owner, {
      title: "Pinned",
      geometry: { type: "Point", coordinates: [1, 2] },
    });
    await createListing(owner, { title: "Unpinned" });
    const res = await request(app).get("/listings/map");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Pinned");
    expect(res.text).not.toContain("Unpinned");
    expect(res.text).toContain('data-mode="cluster"');
  });

  test("show page renders the map only when coordinates exist", async () => {
    const owner = await createUser("alice");
    const pinned = await createListing(owner, {
      geometry: { type: "Point", coordinates: [12.5, 41.9] },
    });
    const plain = await createListing(owner);
    const withMap = await request(app).get(`/listings/${pinned._id}`);
    expect(withMap.text).toContain('data-lng="12.5"');
    expect(withMap.text).toContain('data-lat="41.9"');
    expect(
      (await request(app).get(`/listings/${plain._id}`)).text,
    ).not.toContain('data-mode="show"');
  });

  test("geocode endpoint needs login and proxies the lookup", async () => {
    await createUser("alice");
    expect((await request(app).get("/listings/geocode?q=x")).status).toBe(302);
    const agent = await login(app);
    const res = await agent.get("/listings/geocode?q=Aspen");
    expect(res.body).toEqual({ coordinates: [-106.82, 39.19] });
  });
});

describe("photos (4.3) and upload checks (3.10)", () => {
  const fs = require("fs");
  const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const WEBP = Buffer.from("RIFF\0\0\0\0WEBPVP8 ");
  const form = (agent, method, url, fields = {}) => {
    let req = agent[method](url);
    const base = {
      "listing[title]": "Lodge",
      "listing[description]": "Snowy",
      "listing[location]": "Aspen",
      "listing[country]": "United States",
      "listing[price]": "2500",
      "listing[maxGuests]": "4",
      "listing[bedrooms]": "2",
      "listing[beds]": "2",
      "listing[bathrooms]": "1.5",
      ...fields,
    };
    for (const [k, v] of Object.entries(base)) req = req.field(k, v);
    return req;
  };
  const uploadsCount = () =>
    fs.existsSync("uploads") ? fs.readdirSync("uploads").length : 0;
  let counter;

  beforeEach(() => {
    counter = 0;
    cloudinary.uploader.upload.mockImplementation(async () => {
      counter += 1;
      return { secure_url: `https://cdn.test/${counter}.png`, public_id: `id-${counter}` };
    });
    cloudinary.uploader.destroy.mockResolvedValue({});
  });

  test.each([
    ["a text file named .png", Buffer.from("not an image at all"), "a.png", "image/png"],
    ["a PNG declared as JPEG", PNG, "a.jpg", "image/jpeg"],
    ["a script declared as WebP", Buffer.from("<script>alert(1)</script>"), "a.webp", "image/webp"],
  ])("rejects %s and leaves no temp file", async (_name, bytes, filename, contentType) => {
    await createUser("alice");
    const agent = await login(app);
    const before = uploadsCount();
    const res = await form(agent, "post", "/listings").attach("listing[images]", bytes, { filename, contentType });
    expect(res.status).toBe(400);
    expect(uploadsCount()).toBe(before);
    expect(cloudinary.uploader.upload).not.toHaveBeenCalled();
    expect(await Listing.countDocuments()).toBe(0);
  });

  test("accepts real JPEG, PNG and WebP; the first is the cover", async () => {
    await createUser("alice");
    const agent = await login(app);
    const before = uploadsCount();
    await form(agent, "post", "/listings", { "listing[amenities]": "wifi" })
      .attach("listing[images]", JPEG, { filename: "a.jpg", contentType: "image/jpeg" })
      .attach("listing[images]", PNG, { filename: "b.png", contentType: "image/png" })
      .attach("listing[images]", WEBP, { filename: "c.webp", contentType: "image/webp" });
    const saved = await Listing.findOne();
    expect(saved.images.map((p) => p.filename)).toEqual(["id-1", "id-2", "id-3"]);
    expect(saved.image.filename).toBe("id-1");
    expect(saved.amenities).toEqual(["wifi"]);
    expect(saved.maxGuests).toBe(4);
    expect(uploadsCount()).toBe(before);
    expect(cloudinary.uploader.upload.mock.calls[0][1].transformation[0]).toMatchObject({ crop: "limit", width: 2400 });
  });

  test("more than six photos is refused before anything uploads", async () => {
    await createUser("alice");
    const agent = await login(app);
    let req = form(agent, "post", "/listings");
    for (let i = 0; i < 7; i++) req = req.attach("listing[images]", PNG, `${i}.png`);
    const res = await req;
    expect(res.status).toBe(400);
    expect(cloudinary.uploader.upload).not.toHaveBeenCalled();
  });

  test("a failed save removes every uploaded photo", async () => {
    await createUser("alice");
    const agent = await login(app);
    jest.spyOn(Listing.prototype, "save").mockRejectedValueOnce(new Error("db down"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    await form(agent, "post", "/listings")
      .attach("listing[images]", PNG, "a.png")
      .attach("listing[images]", PNG, "b.png");
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith("id-1");
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith("id-2");
    jest.restoreAllMocks();
  });

  test("editing adds, removes and reorders; removed photos leave Cloudinary", async () => {
    const owner = await createUser("alice");
    const photo = (n) => ({ url: `https://cdn.test/old${n}.png`, filename: `old-${n}` });
    const listing = await createListing(owner, { images: [photo(1), photo(2), photo(3)] });
    const agent = await login(app);
    await form(agent, "put", `/listings/${listing._id}`, {
      removeImages: "old-1",
      coverImage: "old-3",
    }).attach("listing[images]", PNG, "new.png");
    const saved = await Listing.findById(listing._id);
    expect(saved.images.map((p) => p.filename)).toEqual(["old-3", "old-2", "id-1"]);
    expect(saved.image.filename).toBe("old-3");
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith("old-1");
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalledWith("old-2");
  });

  test("the last photo cannot be removed, and the cap holds on edit", async () => {
    const owner = await createUser("alice");
    const photo = (n) => ({ url: `https://cdn.test/${n}.png`, filename: `old-${n}` });
    const listing = await createListing(owner, { images: [photo(1)] });
    const agent = await login(app);
    const res = await form(agent, "put", `/listings/${listing._id}`, { removeImages: "old-1" });
    expect(res.headers.location).toBe(`/listings/${listing._id}/edit`);
    expect((await Listing.findById(listing._id)).images).toHaveLength(1);

    await Listing.updateOne({ _id: listing._id }, { images: [1, 2, 3, 4, 5, 6].map(photo) });
    await form(agent, "put", `/listings/${listing._id}`).attach("listing[images]", PNG, "a.png");
    expect(cloudinary.uploader.upload).not.toHaveBeenCalled();
  });

  test("a listing form clears the confirm-details flag", async () => {
    const owner = await createUser("alice");
    const listing = await createListing(owner, { capacityDefaulted: true });
    const agent = await login(app);
    await form(agent, "put", `/listings/${listing._id}`);
    expect((await Listing.findById(listing._id)).capacityDefaulted).toBeUndefined();
  });

  test("new listings are capped per day and in total", async () => {
    const owner = await createUser("alice");
    const agent = await login(app);
    await Listing.insertMany(
      Array.from({ length: 10 }, (_, i) => ({ title: `L${i}`, price: 1, location: "l", country: "c", owner: owner._id })),
    );
    const res = await form(agent, "post", "/listings").attach("listing[images]", PNG, "a.png");
    expect(res.headers.location).toBe("/listings/new");
    expect(cloudinary.uploader.upload).not.toHaveBeenCalled();
    expect((await agent.get("/listings/new")).text).toContain("10 listings a day");
  });

  test("the show page offers a keyboard gallery and lists amenities", async () => {
    const owner = await createUser("alice");
    const listing = await createListing(owner, {
      images: [
        { url: "https://cdn.test/1.png", filename: "1" },
        { url: "https://cdn.test/2.png", filename: "2", caption: "The courtyard" },
      ],
      amenities: ["wifi", "kitchen"],
    });
    const { text } = await request(app).get(`/listings/${listing._id}`);
    expect(text).toContain("data-gallery-thumb");
    expect(text).toContain("The courtyard");
    expect(text).toContain("Show photo 2 of 2");
    expect(text).toContain("What this place offers");
  });
});
