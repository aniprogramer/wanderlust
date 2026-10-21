const wrapAsync = require("../../utils/wrapAsync");
const ExpressError = require("../../utils/ExpressError");
const buildQs = require("../../utils/queryString");
const { geocode } = require("../../utils/geocode");

describe("wrapAsync", () => {
  test("forwards rejections to next", async () => {
    const err = new Error("boom");
    const next = jest.fn();
    await wrapAsync(async () => {
      throw err;
    })({}, {}, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});

describe("ExpressError", () => {
  test("carries status code and message", () => {
    const err = new ExpressError(418, "teapot");
    expect(err).toMatchObject({ statusCode: 418, message: "teapot" });
    expect(err).toBeInstanceOf(Error);
  });
});

describe("queryString", () => {
  test("skips empty values and encodes the rest", () => {
    expect(
      buildQs({ q: "a b", page: 2, country: "", x: undefined, y: null }),
    ).toBe("?q=a+b&page=2");
    expect(buildQs({})).toBe("");
  });
});

describe("geocode", () => {
  afterEach(() => jest.restoreAllMocks());

  test("returns [lng, lat] of the first feature", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [{ geometry: { coordinates: [-106.8, 39.19] } }],
      }),
    });
    await expect(geocode("Aspen, USA")).resolves.toEqual([-106.8, 39.19]);
    expect(String(fetchMock.mock.calls[0][0])).toContain("q=Aspen%2C+USA");
  });

  test("returns null when nothing matches", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue({ ok: true, json: async () => ({ features: [] }) });
    await expect(geocode("zzzz")).resolves.toBeNull();
  });

  test("rejects when the request times out", async () => {
    const abort = Object.assign(new Error("timed out"), {
      name: "TimeoutError",
    });
    jest.spyOn(global, "fetch").mockRejectedValue(abort);
    await expect(geocode("x")).rejects.toThrow("timed out");
  });

  test("passes an abort signal and prefers MAPBOX_SERVER_TOKEN", async () => {
    process.env.MAPBOX_SERVER_TOKEN = "sk.server";
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue({ ok: true, json: async () => ({}) });
    try {
      await geocode("x");
      expect(String(fetchMock.mock.calls[0][0])).toContain(
        "access_token=sk.server",
      );
      expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    } finally {
      delete process.env.MAPBOX_SERVER_TOKEN;
    }
    await geocode("x");
    expect(String(fetchMock.mock.calls[1][0])).toContain(
      "access_token=pk.test-token",
    );
  });

  test("throws on API failure", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 401 });
    await expect(geocode("x")).rejects.toThrow(/401/);
  });
});
