const { report, missing, MISSING_GEOMETRY } = require("../../init/migrate");

describe("migration helpers", () => {
  test("filters only match rows lacking the field", () => {
    expect(missing("currency")).toEqual({ currency: { $exists: false } });
    expect(MISSING_GEOMETRY).toEqual({
      "geometry.coordinates.0": { $exists: false },
    });
  });

  test("report lists each count", () => {
    const text = report({
      currencySet: 2,
      missingCategory: 3,
      missingGeometry: 0,
    });
    expect(text).toContain("set to INR on 2 listing(s)");
    expect(text).toContain("category: 3 listing(s)");
    expect(text).toContain("geometry: 0 listing(s)");
  });
});
