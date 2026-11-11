const { approxPoint, publicCoords, distanceM, APPROX_RADIUS_M } = require("../../utils/location");
const { cancellationTerms, isLateCancellation } = require("../../utils/availability");

describe("the public map area", () => {
  test("the circle always contains the pin, and is never centred on it", () => {
    const pin = [72.87, 19.07];
    for (const random of [0, 0.25, 0.5, 0.99]) {
      let calls = 0;
      const point = approxPoint(pin, () => (calls++ ? random : 1 - random));
      const away = distanceM(pin, point);
      expect(away).toBeGreaterThanOrEqual(95);
      expect(away).toBeLessThan(APPROX_RADIUS_M);
    }
    expect(APPROX_RADIUS_M).toBe(500);
  });

  test("public coordinates prefer the area, and never give an unrounded pin", () => {
    expect(publicCoords({ approxGeometry: { coordinates: [1.5, 2.5] }, geometry: { coordinates: [9, 9] } })).toEqual([1.5, 2.5]);
    expect(publicCoords({ geometry: { coordinates: [72.87123, 19.07123] } })).toEqual([72.87, 19.07]);
    expect(publicCoords({})).toBeNull();
  });
});

describe("cancellation terms", () => {
  const checkIn = new Date("2030-06-20T00:00:00Z");
  test.each([
    ["flexible", "2030-06-19T15:00:00.000Z"],
    ["moderate", "2030-06-15T15:00:00.000Z"],
    ["strict", "2030-06-06T15:00:00.000Z"],
  ])("%s counts back from the earliest check-in", (cancellationPolicy, deadline) => {
    const terms = cancellationTerms({ cancellationPolicy, checkInFrom: "15:00" }, checkIn);
    expect(terms.cancellationPolicy).toBe(cancellationPolicy);
    expect(terms.freeCancelUntil.toISOString()).toBe(deadline);
  });

  test("a listing without terms is treated as flexible from midnight", () => {
    expect(cancellationTerms({}, checkIn).freeCancelUntil.toISOString()).toBe("2030-06-19T00:00:00.000Z");
  });

  test("only a confirmed booking past its deadline is late", () => {
    const freeCancelUntil = new Date("2030-06-19T15:00:00Z");
    const before = new Date("2030-06-19T14:59:00Z");
    const after = new Date("2030-06-19T15:01:00Z");
    expect(isLateCancellation({ status: "confirmed", freeCancelUntil }, before)).toBe(false);
    expect(isLateCancellation({ status: "confirmed", freeCancelUntil }, after)).toBe(true);
    expect(isLateCancellation({ status: "pending", freeCancelUntil }, after)).toBe(false);
    expect(isLateCancellation({ status: "confirmed" }, after)).toBe(false);
  });
});
