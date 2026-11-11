// Every field on the listing form, at its boundaries, for the publish and draft rule sets
const {
  listingSchema,
  listingDraftSchema,
  startingModeSchema,
  searchSchema,
} = require("../../schema");
const {
  CANCELLATION_POLICIES,
  CANCELLATION_POLICY_KEYS,
  HOUSE_RULE_KEYS,
  ACCESSIBILITY_KEYS,
  SAFETY_KEYS,
  GUEST_NEED_KEYS,
  TIME_OPTIONS,
  COUNTRIES,
} = require("../../utils/constants");

const valid = {
  title: "A".repeat(10),
  description: "D".repeat(50),
  propertyType: "Cabin",
  category: "Mountains",
  addressLine: "1 Main Street",
  city: "Aspen",
  region: "Colorado",
  country: "United States",
  currency: "USD",
  price: 10,
  maxGuests: 2,
  bedrooms: 1,
  beds: 1,
  bathrooms: 1,
  checkInFrom: "15:00",
  checkInUntil: "20:00",
  checkOutBy: "11:00",
  cancellationPolicy: "flexible",
};
const check = (over, schema = listingSchema) => schema.validate({ listing: { ...valid, ...over } });
const accepts = (over) => expect(check(over).error).toBeUndefined();
const rejects = (over) => expect(check(over).error).toBeDefined();

test("the minimum valid listing passes", () => accepts({}));

describe.each([
  ["title", "A".repeat(10), "A".repeat(80), "A".repeat(9), "A".repeat(81)],
  ["description", "D".repeat(50), "D".repeat(2000), "D".repeat(49), "D".repeat(2001)],
  ["maxGuests", 1, 16, 0, 17],
  ["bedrooms", 0, 20, -1, 21],
  ["beds", 1, 30, 0, 31],
  ["bathrooms", 0, 20, -0.5, 20.5],
  ["sizeSqm", 5, 5000, 4, 5001],
  ["minNights", 1, 30, 0, 31],
  ["maxNights", 1, 30, 0, 31],
  ["cleaningFee", 0, 100000, -1, 10000001],
])("%s boundaries", (field, low, high, tooLow, tooHigh) => {
  test.each([[low], [high]])("accepts %s", (value) => accepts({ [field]: value }));
  test.each([[tooLow], [tooHigh]])("rejects %s", (value) => rejects({ [field]: value }));
});

test.each([
  "title", "description", "propertyType", "category", "addressLine", "city", "region", "country",
  "currency", "price", "maxGuests", "bedrooms", "beds", "bathrooms", "checkInFrom", "checkInUntil",
  "checkOutBy", "cancellationPolicy",
])("%s is required to publish, and a blank counts as missing", (field) => {
  rejects({ [field]: undefined });
  rejects({ [field]: "" });
});

test("a draft may leave every required field out", () => {
  const { error, value } = listingDraftSchema.validate({ listing: {} });
  expect(error).toBeUndefined();
  expect(value.intent).toBe("publish");
});

test("a draft may be short of a minimum but not over a maximum or invalid", () => {
  expect(check({ title: "Short" }, listingDraftSchema).error).toBeUndefined();
  expect(check({ title: "A".repeat(81) }, listingDraftSchema).error).toBeDefined();
  expect(check({ maxGuests: 17 }, listingDraftSchema).error).toBeDefined();
  expect(check({ cancellationPolicy: "whenever" }, listingDraftSchema).error).toBeDefined();
});

test("bathrooms move in half steps", () => {
  accepts({ bathrooms: 1.5 });
  rejects({ bathrooms: 1.25 });
});

test("maximum nights cannot be below minimum nights, and they default to 1 and 30", () => {
  accepts({ minNights: 5, maxNights: 5 });
  rejects({ minNights: 5, maxNights: 4 });
  const { value } = check({});
  expect(value.listing).toMatchObject({ minNights: 1, maxNights: 30, cleaningFee: 0 });
});

test("the price must be positive", () => {
  rejects({ price: 0 });
  rejects({ price: -5 });
  accepts({ price: 1 });
});

test("only the three cancellation policies exist, each with plain wording", () => {
  expect(CANCELLATION_POLICY_KEYS).toEqual(["flexible", "moderate", "strict"]);
  expect(Object.values(CANCELLATION_POLICIES).map((p) => p.hoursBefore)).toEqual([24, 120, 336]);
  for (const policy of Object.values(CANCELLATION_POLICIES)) {
    expect(policy.label).toBeTruthy();
    expect(policy.description).toBeTruthy();
    expect(policy.summary).toBeTruthy();
  }
  for (const key of CANCELLATION_POLICY_KEYS) accepts({ cancellationPolicy: key });
  rejects({ cancellationPolicy: "super-strict" });
});

test("times come from the half-hour list", () => {
  expect(TIME_OPTIONS).toHaveLength(48);
  expect(TIME_OPTIONS.slice(0, 3)).toEqual(["00:00", "00:30", "01:00"]);
  accepts({ checkOutBy: "10:30" });
  rejects({ checkOutBy: "10:15" });
  rejects({ checkInFrom: "soon" });
});

test("the latest check-in cannot be before the earliest", () => {
  accepts({ checkInFrom: "15:00", checkInUntil: "15:00" });
  const { error } = check({ checkInFrom: "15:00", checkInUntil: "14:30" });
  expect(error.message).toContain("cannot be before the earliest");
});

test("quiet hours are optional, but a start needs an end", () => {
  accepts({ quietHoursStart: "", quietHoursEnd: "" });
  accepts({ quietHoursStart: "22:00", quietHoursEnd: "07:00" });
  rejects({ quietHoursStart: "22:00" });
  rejects({ quietHoursStart: "22:15", quietHoursEnd: "07:00" });
});

test("the country comes from the list", () => {
  expect(COUNTRIES).toContain("India");
  rejects({ country: "Atlantis" });
});

test("text limits: address, place names and other rules", () => {
  accepts({ addressLine: "a".repeat(160) });
  rejects({ addressLine: "a".repeat(161) });
  accepts({ otherRules: "o".repeat(300) });
  rejects({ otherRules: "o".repeat(301) });
});

test("Wi-Fi speed is optional and has limits", () => {
  accepts({ wifiMbps: "" });
  accepts({ wifiMbps: 1 });
  accepts({ wifiMbps: 10000 });
  rejects({ wifiMbps: 0 });
  rejects({ wifiMbps: 10001 });
});

test("the pin must be real coordinates", () => {
  accepts({ lat: 10, lng: 20 });
  rejects({ lat: 91, lng: 0 });
  rejects({ lat: 0, lng: 181 });
});

test.each([...HOUSE_RULE_KEYS, ...ACCESSIBILITY_KEYS, ...SAFETY_KEYS, "noPinAck"])(
  "the %s box reads as true when ticked and false when not",
  (key) => {
    expect(check({ [key]: "on" }).value.listing[key]).toBe(true);
    expect(check({}).value.listing[key]).toBe(false);
    rejects({ [key]: "maybe" });
  },
);

test("the old free-text location field is no longer accepted", () => rejects({ location: "Aspen" }));

test("the new amenities are accepted, and unknown ones refused", () => {
  accepts({ amenities: ["dryer", "dedicated_desk", "garden", "gym"] });
  rejects({ amenities: ["helipad"] });
});

describe("photo fields", () => {
  const top = (over) => listingSchema.validate({ listing: valid, ...over }).error;
  test("alt text stops at 150 characters", () => {
    expect(top({ newAlt: ["a".repeat(150)] })).toBeUndefined();
    expect(top({ newAlt: ["a".repeat(151)] })).toBeDefined();
    expect(top({ existingAlt: ["a".repeat(151)] })).toBeDefined();
  });
  test("intent is publish or draft", () => {
    expect(top({ intent: "draft" })).toBeUndefined();
    expect(top({ intent: "hide" })).toBeDefined();
  });
});

test("the starting mode is guest or host, and required", () => {
  expect(startingModeSchema.validate({ startingMode: "host" }).error).toBeUndefined();
  expect(startingModeSchema.validate({ startingMode: "guest" }).error).toBeUndefined();
  expect(startingModeSchema.validate({ startingMode: "admin" }).error).toBeDefined();
  expect(startingModeSchema.validate({}).error).toBeDefined();
});

test("search accepts the four guest needs and nothing else", () => {
  expect(GUEST_NEED_KEYS).toEqual(["petsAllowed", "hasWorkspace", "stepFreeAccess", "wheelchairEntrance"]);
  expect(searchSchema.validate({ needs: GUEST_NEED_KEYS }).error).toBeUndefined();
  expect(searchSchema.validate({ needs: "petsAllowed" }).value.needs).toEqual(["petsAllowed"]);
  expect(searchSchema.validate({ needs: ["isAdmin"] }).error).toBeDefined();
});
