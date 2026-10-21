const { parseDay, today, nightsBetween, toDay } = require("../../utils/dates");

describe("dates", () => {
  test("parseDay accepts real calendar days", () => {
    expect(parseDay("2030-02-28").toISOString()).toBe(
      "2030-02-28T00:00:00.000Z",
    );
  });

  test.each([
    "2030-02-30",
    "2030-13-01",
    "30-02-2030",
    "",
    null,
    undefined,
    20300101,
  ])("parseDay rejects %p", (value) => expect(parseDay(value)).toBeNull());

  test("nightsBetween is check-in inclusive, check-out exclusive", () => {
    const nights = nightsBetween(
      parseDay("2030-01-30"),
      parseDay("2030-02-02"),
    );
    expect(nights.map(toDay)).toEqual([
      "2030-01-30",
      "2030-01-31",
      "2030-02-01",
    ]);
  });

  test("nightsBetween is empty when range is empty", () => {
    const d = parseDay("2030-01-01");
    expect(nightsBetween(d, d)).toEqual([]);
  });

  test("today is UTC midnight", () => {
    expect(today().getTime() % 864e5).toBe(0);
  });
});

describe("today", () => {
  test("is UTC midnight", () => {
    const t = today();
    expect([
      t.getUTCHours(),
      t.getUTCMinutes(),
      t.getUTCSeconds(),
      t.getUTCMilliseconds(),
    ]).toEqual([0, 0, 0, 0]);
    expect(toDay(t)).toBe(new Date().toISOString().slice(0, 10));
  });
});
