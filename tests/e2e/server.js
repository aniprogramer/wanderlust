// Boots the real app against a throw-away MongoDB for the browser checks.
// NODE_ENV=test keeps the in-memory session store and turns rate limits off;
// headers, CSP and views are identical to production.
process.env.NODE_ENV = "test";
process.env.SECRET = "e2e-secret";
// Fake-but-well-formed public token; the browser never reaches real Mapbox (routes are stubbed).
process.env.MAPBOX_TOKEN = "pk.eyJ1IjoiZTJlIiwiYSI6ImR1bW15In0.e2e";

// Server-side geocoding is faked before the controllers capture it.
const geocoder = require("../../utils/geocode");
geocoder.geocode = async (q) =>
  q.startsWith("Mumbai") ? [72.87, 19.07] : null;

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../../app");
const User = require("../../models/user");
const Listing = require("../../models/listing");
const Booking = require("../../models/booking");
const { PORT, PASSWORD, ids, booked, day } = require("./fixtures");

const stay = (_id, guest, from, to) =>
  Booking.create({
    _id,
    listing: ids.pinned,
    guest,
    checkIn: new Date(day(from)),
    checkOut: new Date(day(to)),
    nights: Array.from(
      { length: to - from },
      (_, i) => new Date(day(from + i)),
    ),
    totalPrice: (to - from) * 1500,
  });

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([User.init(), Listing.init(), Booking.init()]);

  const alice = await User.register(
    new User({ _id: ids.alice, username: "alice", email: "alice@example.com" }),
    PASSWORD,
  );
  const bob = await User.register(
    new User({ _id: ids.bob, username: "bob", email: "bob@example.com" }),
    PASSWORD,
  );
  await Listing.create({
    _id: ids.pinned,
    title: "Pinned Haveli",
    description: "Old courtyard house",
    price: 1500,
    location: "Old Delhi",
    country: "India",
    category: "Cities",
    owner: alice._id,
    geometry: { type: "Point", coordinates: [77.23, 28.65] },
  });
  await stay(ids.bookingSoon, bob._id, 3, 3 + booked.length);
  await stay(ids.bookingLater, bob._id, 12, 14);
  await User.updateOne({ _id: bob._id }, { $push: { wishlist: ids.pinned } });

  app.listen(PORT, () => console.log(`e2e server on ${PORT}`));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
