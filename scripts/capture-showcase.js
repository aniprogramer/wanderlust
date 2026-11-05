// scripts/capture-showcase.js
// Boots in-memory MongoDB, seeds rich showcase data, and captures production-grade screenshots.

process.env.NODE_ENV = "test";
process.env.SECRET = "showcase-secret-key-123456789";
process.env.APP_TIMEZONE = "UTC";
process.env.MAPBOX_TOKEN = "pk.eyJ1Ijoic2hvd2Nhc2UiLCJhIjoiZHVtbXkifQ.showcase";

const PORT = 3250;
const PASSWORD = "password123";

// Stub geocoder
const geocoder = require("../utils/geocode");
geocoder.geocode = async (q) => [77.209, 28.613];

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

const app = require("../app");
const User = require("../models/user");
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const Review = require("../models/review");
const sampleListings = require("../init/data").data;

const day = (offset) => {
  const d = new Date(Date.now() + offset * 864e5);
  return d.toISOString().slice(0, 10);
};

async function seedData() {
  await Promise.all([User.init(), Listing.init(), Booking.init(), Review.init()]);

  const alice = await User.register(
    new User({ username: "alice_host", email: "alice@wanderlust.dev" }),
    PASSWORD,
  );
  const bob = await User.register(
    new User({ username: "bob_traveler", email: "bob@wanderlust.dev" }),
    PASSWORD,
  );
  const elena = await User.register(
    new User({ username: "elena_w", email: "elena@wanderlust.dev" }),
    PASSWORD,
  );

  const coordinatesList = [
    [-118.6926, 34.0259], // Malibu
    [-73.9855, 40.7484],  // New York
    [-106.8175, 39.1911], // Aspen
    [11.2558, 43.7696],   // Tuscany / Florence
    [-122.6784, 45.5152], // Portland
    [-86.8515, 21.1619],  // Cancun
    [-120.0324, 39.0968], // Lake Tahoe
    [139.6917, 35.6895],  // Tokyo
    [7.7491, 45.9763],    // Zermatt
  ];

  const galleryImages = [
    [
      { url: "https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?auto=format&fit=crop&w=1200&q=80", filename: "img1", caption: "Oceanfront Deck" },
      { url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80", filename: "img2", caption: "Direct Beach Access" },
      { url: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80", filename: "img3", caption: "Sunlit Living Room" },
    ],
    [
      { url: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80", filename: "img4", caption: "Skyline Lounge" },
      { url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80", filename: "img5", caption: "Master Suite" },
    ],
    [
      { url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80", filename: "img6", caption: "Pine Forest Vista" },
      { url: "https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=800&q=80", filename: "img7", caption: "Cozy Hearth" },
    ],
  ];

  const createdListings = [];
  const selectedSamples = sampleListings.slice(0, 9);

  for (let i = 0; i < selectedSamples.length; i++) {
    const s = selectedSamples[i];
    const coords = coordinatesList[i % coordinatesList.length];
    const gallery = galleryImages[i % galleryImages.length] || [
      { url: s.image.url, filename: `photo_${i}`, caption: s.title },
    ];

    const listing = await Listing.create({
      title: s.title,
      description: s.description,
      image: { url: s.image.url, filename: s.image.filename || `cover_${i}` },
      images: gallery,
      price: s.price || 1500,
      location: s.location,
      country: s.country,
      category: s.category || "Trending",
      propertyType: s.propertyType || "House",
      currency: "INR",
      owner: alice._id,
      geometry: { type: "Point", coordinates: coords },
      avgRating: 4.85 + (i % 3) * 0.05,
      reviewCount: 12 + i * 2,
      amenities: ["wifi", "kitchen", "parking", "air_conditioning", "pool", "workspace"],
      maxGuests: 4,
      bedrooms: 2,
      beds: 2,
      bathrooms: 2,
      status: "published",
    });

    createdListings.push(listing);
  }

  const featured = createdListings[0];

  // Seed verified reviews for featured listing
  const review1 = await Review.create({
    author: bob._id,
    rating: 5,
    comment: "Absolutely breathtaking views and wonderful hospitality. Everything from the check-in to the amenities was 5-star perfection!",
    verifiedStay: true,
  });
  const review2 = await Review.create({
    author: elena._id,
    rating: 5,
    comment: "Waking up to the sunrise here was unforgettable. Quiet, pristine, and well-appointed.",
    verifiedStay: true,
  });

  featured.reviews = [review1._id, review2._id];
  featured.avgRating = 5.0;
  featured.reviewCount = 2;
  await featured.save();

  // Seed bookings for Bob
  const fromNights = 4;
  const toNights = 8;
  await Booking.create({
    listing: featured._id,
    guest: bob._id,
    checkIn: new Date(day(fromNights)),
    checkOut: new Date(day(toNights)),
    nights: Array.from({ length: toNights - fromNights }, (_, i) => new Date(day(fromNights + i))),
    guests: 2,
    currency: "INR",
    nightlyPrice: featured.price,
    cleaningFee: 500,
    subtotal: featured.price * (toNights - fromNights),
    totalPrice: featured.price * (toNights - fromNights) + 500,
    status: "confirmed",
    requestedAt: new Date(),
    respondedAt: new Date(),
  });

  // Seed past completed booking
  await Booking.create({
    listing: createdListings[1]._id,
    guest: bob._id,
    checkIn: new Date(day(-10)),
    checkOut: new Date(day(-7)),
    nights: Array.from({ length: 3 }, (_, i) => new Date(day(-10 + i))),
    guests: 1,
    currency: "INR",
    nightlyPrice: createdListings[1].price,
    cleaningFee: 300,
    subtotal: createdListings[1].price * 3,
    totalPrice: createdListings[1].price * 3 + 300,
    status: "confirmed",
  });

  // Seed wishlist for Bob
  await User.updateOne(
    { _id: bob._id },
    { $set: { wishlist: [featured._id, createdListings[2]._id, createdListings[3]._id] } },
  );

  return { alice, bob, featured, createdListings };
}

async function loginUser(page, username) {
  await page.goto(`http://127.0.0.1:${PORT}/login`);
  await page.fill("#username", username);
  await page.fill("#password", PASSWORD);
  await Promise.all([
    page.waitForURL(/\/listings/),
    page.click("form[action='/login'] button[type=submit]"),
  ]);
}

async function main() {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  console.log("In-memory MongoDB ready.");

  const { alice, bob, featured } = await seedData();
  console.log("Showcase data seeded successfully.");

  const server = app.listen(PORT);
  console.log(`Server listening on ${PORT}`);

  const browser = await chromium.launch({
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  });

  const assetsDir = path.join(__dirname, "../assets");
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 820 },
    deviceScaleFactor: 1.5,
  });

  const page = await context.newPage();

  // Stub external Mapbox calls gracefully
  await page.route("https://api.mapbox.com/**", (route) => {
    const url = route.request().url();
    if (url.includes("/mapbox-gl-js/")) return route.continue();
    if (url.includes("/styles/")) {
      return route.fulfill({
        json: {
          version: 8,
          glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
          sources: {},
          layers: [{ id: "background", type: "background", paint: { "background-color": "#e8e5dc" } }],
        },
      });
    }
    return route.fulfill({ status: 200, body: "" });
  });
  await page.route("https://events.mapbox.com/**", (route) => route.fulfill({ status: 204 }));

  console.log("1. Capturing Explore Listings (Desktop)...");
  await loginUser(page, "bob_traveler");
  await page.goto(`http://127.0.0.1:${PORT}/listings`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(assetsDir, "explore-listings.png") });

  console.log("2. Capturing Property Details...");
  await page.goto(`http://127.0.0.1:${PORT}/listings/${featured._id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(assetsDir, "listing-details.png") });

  console.log("3. Capturing Interactive Map View...");
  await page.goto(`http://127.0.0.1:${PORT}/listings/map`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(assetsDir, "map-view.png") });

  console.log("4. Capturing Guest Trips & Reservations...");
  await page.goto(`http://127.0.0.1:${PORT}/bookings`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(assetsDir, "booking-trips.png") });

  console.log("5. Capturing Saved Wishlist...");
  await page.goto(`http://127.0.0.1:${PORT}/wishlist`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(assetsDir, "wishlist.png") });

  console.log("6. Capturing Host Listing Creation Form...");
  await page.goto(`http://127.0.0.1:${PORT}/listings/new`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(assetsDir, "create-listing.png") });

  console.log("7. Capturing Responsive Mobile View...");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`http://127.0.0.1:${PORT}/listings`, { waitUntil: "networkidle" });
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: path.join(assetsDir, "mobile-view.png") });
  await mobileContext.close();

  await context.close();
  await browser.close();
  server.close();
  await mongoose.disconnect();
  await mongod.stop();

  console.log("All showcase screenshots captured successfully in assets/!");
}

main().catch((err) => {
  console.error("Capture error:", err);
  process.exit(1);
});
