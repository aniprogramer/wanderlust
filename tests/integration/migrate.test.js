const Listing = require("../../models/listing");
const { migrate } = require("../../init/migrate");
const {
  connectDb,
  disconnectDb,
  clearDb,
  createUser,
  createListing,
} = require("../helpers");

beforeAll(connectDb);
afterAll(disconnectDb);
beforeEach(clearDb);

test("backfills currency once and reports what is still missing", async () => {
  const owner = await createUser("alice");
  // Old rows: inserted raw so no schema defaults apply
  await Listing.collection.insertMany([
    { title: "Old A", price: 1, location: "l", country: "c" },
    {
      title: "Old B",
      price: 1,
      location: "l",
      country: "c",
      category: "Cabins",
    },
  ]);
  await createListing(owner, {
    title: "New",
    category: "Cities",
    currency: "USD",
    geometry: { type: "Point", coordinates: [1, 2] },
  });

  expect(await migrate()).toEqual({
    currencySet: 2,
    missingCategory: 1,
    missingGeometry: 2,
  });
  expect(await migrate()).toEqual({
    currencySet: 0,
    missingCategory: 1,
    missingGeometry: 2,
  });

  const rows = await Listing.collection.find().toArray();
  expect(rows.map((r) => r.currency).sort()).toEqual(["INR", "INR", "USD"]);
  expect(rows.find((r) => r.title === "Old B").category).toBe("Cabins");
});
