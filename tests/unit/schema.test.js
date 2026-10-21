const {
  listingSchema,
  bookingSchema,
  searchSchema,
  reviewSchema,
  signupSchema,
  loginSchema,
} = require("../../schema");
const { day } = require("../helpers");

const listing = (over = {}) => ({
  listing: {
    title: "t",
    description: "d",
    location: "l",
    country: "c",
    price: 10,
    ...over,
  },
});

describe("listingSchema", () => {
  test("accepts valid input and blank optional fields", () => {
    const { error, value } = listingSchema.validate(
      listing({ category: "", lat: "", lng: "" }),
    );
    expect(error).toBeUndefined();
    expect(value.listing.category).toBeUndefined();
  });

  test.each([
    [{ price: 0 }],
    [{ category: "Spaceships" }],
    [{ propertyType: "Igloo" }],
    [{ lat: 91, lng: 0 }],
    [{ lng: 181 }],
  ])("rejects %j", (over) => {
    expect(listingSchema.validate(listing(over)).error).toBeDefined();
  });
});

describe("reviewSchema", () => {
  test("rating must be 1-5", () => {
    expect(
      reviewSchema.validate({ review: { rating: 6, comment: "x" } }).error,
    ).toBeDefined();
    expect(
      reviewSchema.validate({ review: { rating: 5, comment: "x" } }).error,
    ).toBeUndefined();
  });
});

describe("bookingSchema", () => {
  const book = (checkIn, checkOut) =>
    bookingSchema.validate({ booking: { checkIn, checkOut } });

  test("accepts a future range", () => {
    expect(book(day(5), day(7)).error).toBeUndefined();
  });

  test("rejects past check-in", () => {
    expect(book(day(-2), day(2)).error.message).toMatch(/past/);
  });

  test("rejects check-out on or before check-in", () => {
    expect(book(day(5), day(5)).error.message).toMatch(/after check-in/);
    expect(book(day(6), day(5)).error.message).toMatch(/after check-in/);
  });

  test("rejects stays over 30 nights", () => {
    expect(book(day(1), day(40)).error.message).toMatch(/30 nights/);
  });

  test("rejects malformed dates", () => {
    expect(book("tomorrow", day(3)).error).toBeDefined();
  });
});

describe("searchSchema", () => {
  test("coerces numbers, defaults page, drops blanks", () => {
    const { error, value } = searchSchema.validate({
      q: "beach",
      minPrice: "100",
      maxPrice: "",
      page: "",
    });
    expect(error).toBeUndefined();
    expect(value).toEqual({ q: "beach", minPrice: 100, page: 1 });
  });

  test("rejects inverted price range and unknown category", () => {
    expect(
      searchSchema.validate({ minPrice: 10, maxPrice: 5 }).error,
    ).toBeDefined();
    expect(searchSchema.validate({ category: "Nope" }).error).toBeDefined();
  });

  test("availability needs both dates in order", () => {
    expect(searchSchema.validate({ checkIn: day(3) }).error).toBeDefined();
    expect(
      searchSchema.validate({ checkIn: day(5), checkOut: day(3) }).error,
    ).toBeDefined();
    expect(
      searchSchema.validate({ checkIn: day(3), checkOut: day(5) }).error,
    ).toBeUndefined();
  });
});

describe("length and type limits", () => {
  test("description is capped at 2000 characters", () => {
    expect(
      listingSchema.validate(listing({ description: "a".repeat(2000) })).error,
    ).toBeUndefined();
    expect(
      listingSchema.validate(listing({ description: "a".repeat(2001) })).error,
    ).toBeDefined();
  });

  test("review comment is capped at 1000 characters and rating must be an integer", () => {
    const review = (over) => ({
      review: { rating: 4, comment: "ok", ...over },
    });
    expect(
      reviewSchema.validate(review({ comment: "a".repeat(1000) })).error,
    ).toBeUndefined();
    expect(
      reviewSchema.validate(review({ comment: "a".repeat(1001) })).error,
    ).toBeDefined();
    expect(reviewSchema.validate(review({ rating: 3.5 })).error).toBeDefined();
  });
});

describe("signupSchema", () => {
  const user = (over = {}) => ({
    username: "bob_1",
    email: "bob@example.com",
    password: "longenough",
    ...over,
  });

  test("accepts valid input", () => {
    expect(signupSchema.validate(user()).error).toBeUndefined();
  });

  test.each([
    [{ username: "ab" }],
    [{ username: "a".repeat(31) }],
    [{ username: "bad name!" }],
    [{ email: "not-an-email" }],
    [{ password: "short" }],
  ])("rejects %j", (over) => {
    expect(signupSchema.validate(user(over)).error).toBeDefined();
  });
});

describe("loginSchema", () => {
  test("needs both fields, each at most 100 characters", () => {
    expect(
      loginSchema.validate({ username: "a", password: "b" }).error,
    ).toBeUndefined();
    expect(loginSchema.validate({}).error).toBeDefined();
    expect(
      loginSchema.validate({ username: "a", password: "b".repeat(101) }).error,
    ).toBeDefined();
  });
});
