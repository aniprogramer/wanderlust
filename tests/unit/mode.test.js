const { normalizeMode, onlyIn, landingFor, navFor, HOMES } = require("../../utils/mode");

describe("mode helpers", () => {
  test.each([["host", "host"], ["guest", "guest"], [undefined, "guest"], ["admin", "guest"], ["HOST", "guest"], [["host"], "guest"]])(
    "normalizeMode(%p) is %s",
    (value, expected) => expect(normalizeMode(value)).toBe(expected),
  );

  test("onlyIn names the mode a page belongs to; public pages belong to neither", () => {
    expect(onlyIn("/listings/new")).toBe("host");
    expect(onlyIn("/listings/mine")).toBe("host");
    expect(onlyIn("/listings/abc123/edit")).toBe("host");
    expect(onlyIn("/bookings/hosting?page=2")).toBe("host");
    expect(onlyIn("/bookings")).toBe("guest");
    expect(onlyIn("/wishlist")).toBe("guest");
    expect(onlyIn("/listings")).toBeNull();
    expect(onlyIn("/listings/abc123")).toBeNull();
    expect(onlyIn("/bookings/abc123")).toBeNull();
    expect(onlyIn("/account")).toBeNull();
  });

  test("landingFor keeps a page that exists in the mode, else goes home", () => {
    expect(landingFor("/listings/abc", "host")).toBe("/listings/abc");
    expect(landingFor("/account", "guest")).toBe("/account");
    expect(landingFor("/listings/new", "guest")).toBe(HOMES.guest);
    expect(landingFor("/wishlist", "host")).toBe(HOMES.host);
  });

  test("landingFor never follows an unsafe or missing target", () => {
    for (const bad of [undefined, "", "//evil.com", "/\\evil.com", "https://evil.com", 5]) {
      expect(landingFor(bad, "guest")).toBe(HOMES.guest);
      expect(landingFor(bad, "host")).toBe(HOMES.host);
    }
  });

  test("header links follow the mode; visitors see the guest links", () => {
    const labels = (user, mode) => navFor(user, mode).map((l) => l.label);
    expect(labels({}, "guest")).toEqual(["Explore", "Map", "Saved", "Trips"]);
    expect(labels({}, "host")).toEqual(["Your listings", "Create listing", "Reservations"]);
    expect(labels(undefined, "host")).toEqual(["Explore", "Map", "Saved", "Trips"]);
  });
});
