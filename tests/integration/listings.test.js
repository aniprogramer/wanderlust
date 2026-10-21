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

const submit = (agent, method, url, fields = {}, withImage = true) => {
  const base = {
    "listing[title]": "Mountain Lodge",
    "listing[description]": "Snowy",
    "listing[location]": "Aspen",
    "listing[country]": "United States",
    "listing[price]": "2500",
    ...fields,
  };
  let req = agent[method](url);
  for (const [k, v] of Object.entries(base)) req = req.field(k, v);
  return withImage
    ? req.attach("listing[image]", Buffer.from("png"), "a.png")
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
