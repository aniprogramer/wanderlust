const request = require("supertest");
const app = require("../../app");
const { connectDb, disconnectDb, clearDb, createUser, login } = require("../helpers");

beforeAll(connectDb);
afterAll(disconnectDb);
beforeEach(clearDb);

const PHRASE = /become(\s+a)?\s+host|host your home|sign up as a host/i;
const PAGES = ["/", "/listings", "/login", "/signup", "/forgot-password", "/help", "/privacy", "/terms"];

describe('no "Become a host" call to action', () => {
  test.each(PAGES)("guest sees none on %s", async (url) => {
    const res = await request(app).get(url);
    expect(res.status).toBeLessThan(400);
    expect(res.text).not.toMatch(PHRASE);
  });

  test("signed-in user sees none on home, trips and account", async () => {
    await createUser();
    const agent = await login(app);
    for (const url of ["/listings", "/bookings", "/users/alice", "/bookings/hosting"]) {
      const res = await agent.get(url);
      expect(res.text).not.toMatch(PHRASE);
    }
  });
});
