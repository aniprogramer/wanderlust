const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");
const User = require("../models/user");
const Listing = require("../models/listing");
const Booking = require("../models/booking");

let mongod;

exports.connectDb = async () => {
  mongod = await MongoMemoryServer.create();
  // Jest's VM can't run the driver's dynamic import("os"), so hand it the module directly.
  await mongoose.connect(mongod.getUri(), {
    runtimeAdapters: { os: require("os") },
  });
  // Unique/partial indexes must exist before tests rely on them
  await Promise.all([User.init(), Listing.init(), Booking.init()]);
};

exports.disconnectDb = async () => {
  await mongoose.disconnect();
  await mongod.stop();
};

exports.clearDb = async () => {
  Listing.clearCountriesCache();
  await Promise.all(
    Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})),
  );
};

exports.createUser = (username = "alice") =>
  User.register(
    new User({ username, email: `${username}@example.com` }),
    "password123",
  );

const TOKEN_RE = /name="_csrf" value="([^"]+)"/;

// Makes every write verb of an agent carry the session's CSRF token.
const withToken = (agent, token) => {
  agent.csrfToken = token;
  for (const verb of ["post", "put", "patch", "delete"]) {
    const send = agent[verb].bind(agent);
    agent[verb] = (...args) =>
      send(...args).set("x-csrf-token", agent.csrfToken);
  }
  return agent;
};

// Anonymous agent that already holds a session and token (forms need one to be accepted).
exports.guest = async (app) => {
  const agent = request.agent(app);
  const page = await agent.get("/login");
  return withToken(agent, TOKEN_RE.exec(page.text)[1]);
};

// Returns a supertest agent holding a logged-in session (the session id rotates on login,
// so the token is read again afterwards).
exports.login = async (app, username = "alice") => {
  const agent = await exports.guest(app);
  await agent
    .post("/login")
    .type("form")
    .send({ username, password: "password123" });
  agent.csrfToken = TOKEN_RE.exec((await agent.get("/wishlist")).text)[1];
  return agent;
};

exports.createListing = (owner, overrides = {}) =>
  Listing.create({
    title: "Cozy Cabin",
    description: "A quiet cabin in the woods",
    price: 1000,
    location: "Aspen",
    country: "United States",
    owner: owner._id,
    ...overrides,
  });

// "YYYY-MM-DD" offset days from today (UTC)
exports.day = (offset) =>
  new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
