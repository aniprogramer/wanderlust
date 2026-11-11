jest.mock("../../models/listing");
jest.mock("../../models/review");
jest.mock("../../models/booking");

const Listing = require("../../models/listing");
const Review = require("../../models/review");
const Booking = require("../../models/booking");
const mw = require("../../middleware");

const mockRes = (userId = "u1") => ({
  locals: { currUser: { _id: userId } },
  redirect: jest.fn(),
});
const mockReq = (over = {}) => ({
  params: {},
  flash: jest.fn(),
  session: {},
  isAuthenticated: () => true,
  method: "GET",
  originalUrl: "/x",
  ...over,
});
const owned = (id) => ({ equals: (other) => other === id });

describe("isLoggedIn", () => {
  test("lets authenticated users through", () => {
    const next = jest.fn();
    mw.isLoggedIn(mockReq(), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test("redirects guests to /login and remembers GET urls only", () => {
    const res = mockRes();
    const req = mockReq({ isAuthenticated: () => false });
    mw.isLoggedIn(req, res, jest.fn());
    expect(res.redirect).toHaveBeenCalledWith("/login");
    expect(req.session.redirectUrl).toBe("/x");

    const post = mockReq({ isAuthenticated: () => false, method: "POST" });
    mw.isLoggedIn(post, mockRes(), jest.fn());
    expect(post.session.redirectUrl).toBeUndefined();
  });
});

describe("isOwner", () => {
  test("404 when listing is missing", async () => {
    Listing.findById.mockResolvedValue(null);
    const next = jest.fn();
    await mw.isOwner(mockReq({ params: { id: "l1" } }), mockRes(), next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 404 });
  });

  test("blocks non-owners, including listings without an owner", async () => {
    for (const owner of [owned("someone-else"), undefined]) {
      Listing.findById.mockResolvedValue({ owner });
      const res = mockRes();
      const next = jest.fn();
      await mw.isOwner(mockReq({ params: { id: "l1" } }), res, next);
      expect(res.redirect).toHaveBeenCalledWith("/listings/l1");
      expect(next).not.toHaveBeenCalled();
    }
  });

  test("allows the owner", async () => {
    Listing.findById.mockResolvedValue({ owner: owned("u1") });
    const next = jest.fn();
    await mw.isOwner(mockReq({ params: { id: "l1" } }), mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe("isReviewAuthor", () => {
  test("blocks other users", async () => {
    Review.findById.mockResolvedValue({ author: owned("other") });
    Listing.exists.mockResolvedValue({ _id: "l1" });
    const res = mockRes();
    await mw.isReviewAuthor(
      mockReq({ params: { id: "l1", reviewId: "r1" } }),
      res,
      jest.fn(),
    );
    expect(res.redirect).toHaveBeenCalledWith("/listings/l1");
  });

  test("404s when the listing does not hold the review", async () => {
    Review.findById.mockResolvedValue({ author: owned("u1") });
    Listing.exists.mockResolvedValue(null);
    const next = jest.fn();
    await mw.isReviewAuthor(
      mockReq({ params: { id: "l2", reviewId: "r1" } }),
      mockRes(),
      next,
    );
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 404 });
  });
});

describe("isBookingParty", () => {
  const run = async (booking) => {
    Booking.findById.mockReturnValue({
      populate: () => Promise.resolve(booking),
    });
    const req = mockReq({ params: { bookingId: "b1" } });
    const res = mockRes();
    const next = jest.fn();
    await mw.isBookingParty(req, res, next);
    return { req, res, next };
  };

  test("allows the guest and the host", async () => {
    for (const booking of [
      { guest: owned("u1"), listing: { owner: owned("x") } },
      { guest: owned("x"), listing: { owner: owned("u1") } },
    ]) {
      const { req, next } = await run(booking);
      expect(next).toHaveBeenCalledWith();
      expect(req.booking).toBe(booking);
    }
  });

  test("blocks strangers", async () => {
    const { res, next } = await run({
      guest: owned("x"),
      listing: { owner: owned("y") },
    });
    expect(res.redirect).toHaveBeenCalledWith("/bookings");
    expect(next).not.toHaveBeenCalled();
  });
});

describe("validators", () => {
  test("validateListing passes cleaned body on, and keeps errors for the form to show", () => {
    const req = {
      body: {
        listing: {
          title: "A valid title",
          description: "A description comfortably longer than the fifty character minimum.",
          propertyType: "Cabin",
          category: "Mountains",
          addressLine: "1 Main Street",
          city: "Aspen",
          region: "Colorado",
          country: "United States",
          currency: "USD",
          price: "5",
          otherRules: "",
          maxGuests: "2",
          bedrooms: "1",
          beds: "1",
          bathrooms: "1",
          checkInFrom: "15:00",
          checkInUntil: "20:00",
          checkOutBy: "11:00",
          cancellationPolicy: "strict",
        },
      },
    };
    const next = jest.fn();
    mw.validateListing(req, {}, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.listingForm).toBeUndefined();
    expect(req.body.listing.price).toBe(5);
    expect(req.body.listing.otherRules).toBeUndefined();

    const bad = { body: { listing: { title: "short" } } };
    const nextBad = jest.fn();
    mw.validateListing(bad, {}, nextBad);
    expect(nextBad).toHaveBeenCalledWith();
    expect(bad.listingForm.errors.title).toContain("10 to 80");
    expect(bad.listingForm.errors.cancellationPolicy).toBeDefined();
    expect(bad.listingForm.values.title).toBe("short");
  });

  test("validateSearch stores cleaned filters and ignores unknown params", () => {
    const req = { query: { q: "x", page: "3", evil: "1" } };
    mw.validateSearch(req, {}, jest.fn());
    expect(req.filters).toEqual({ q: "x", page: 3 });
  });
});
