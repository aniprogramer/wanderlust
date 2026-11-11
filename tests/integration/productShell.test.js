const cheerio = require("cheerio");
const app = require("../../app");
const { connectDb, disconnectDb, clearDb, createUser, login, guest } = require("../helpers");

beforeAll(connectDb);
afterAll(disconnectDb);
beforeEach(clearDb);

const page = async (agent, path) => cheerio.load((await agent.get(path)).text);

describe("one product shell on every page outside home and auth", () => {
  test.each(["/help", "/contact", "/privacy", "/listings/map"])("%s has the glass header and the floating rail", async (path) => {
    const $ = await page(await guest(app), path);
    expect($("body").hasClass("wl-rail-body")).toBe(true);
    expect($("nav.navbar.wl-navbar")).toHaveLength(1);
    // The old opaque Bootstrap fill is gone, so the glass can show
    expect($("nav.navbar").hasClass("bg-body")).toBe(false);
    expect($("aside.wl-sidebar .wl-nav-rail")).toHaveLength(1);
    expect($("main#main-content.wl-shell-main")).toHaveLength(1);
  });

  test("home keeps its own shell and auth pages stay bare", async () => {
    const agent = await guest(app);
    const home = await page(agent, "/listings");
    expect(home("body").hasClass("wl-home-body")).toBe(true);
    expect(home("nav.wl-navbar")).toHaveLength(0);
    const auth = await page(agent, "/login");
    expect(auth(".wl-sidebar, .wl-navbar")).toHaveLength(0);
  });

  test("the current page is marked in the header links", async () => {
    await createUser("bob");
    const $ = await page(await login(app, "bob"), "/bookings");
    const current = $(".wl-navbar a.nav-link[aria-current='page']");
    expect(current).toHaveLength(1);
    expect(current.text().trim()).toBe("Trips");
    expect(current.hasClass("active")).toBe(true);
    expect($(".wl-sidebar a.wl-nav-link.active").attr("href")).toBe("/bookings");
  });

  test("the header mode switch keeps its button styles, at every width", async () => {
    await createUser("bob");
    const $ = await page(await login(app, "bob"), "/help");
    const button = $(".wl-navbar .wl-mode-switch button");
    expect(button.hasClass("wl-auth-btn")).toBe(true);
    expect(button.hasClass("wl-mode-btn")).toBe(true);
    // Hidden at no width: on phones it sits in the collapsed menu
    expect(button.attr("class")).not.toMatch(/d-none/);
  });
});

describe("error and empty states", () => {
  test("a 404 says what happened and offers a way back and a way to get help", async () => {
    const res = await (await guest(app)).get("/no-such-page");
    expect(res.status).toBe(404);
    const $ = cheerio.load(res.text);
    expect($(".wl-state__label").text().trim()).toBe("Error 404");
    expect($("h1.wl-empty__title").text()).toBe("We couldn't find that page");
    expect($(".wl-state__icon[aria-hidden='true']")).toHaveLength(1);
    expect($(".wl-state__actions a.wl-auth-btn--primary").attr("href")).toBe("/listings");
    expect($(".wl-state__actions a[href='/help']")).toHaveLength(1);
    // One primary action only
    expect($("main .wl-auth-btn--primary")).toHaveLength(1);
  });

  test("a client error shows its own message", async () => {
    const $ = cheerio.load((await (await guest(app)).get("/listings/not-an-id")).text);
    expect($(".wl-state__label").text().trim()).toMatch(/^Error 4\d\d$/);
  });

  test("empty states carry a decorative icon", async () => {
    await createUser("bob");
    const agent = await login(app, "bob");
    for (const path of ["/bookings", "/wishlist"]) {
      const $ = await page(agent, path);
      expect($(".wl-empty .wl-state__icon[aria-hidden='true'] i")).toHaveLength(1);
    }
  });

  test("Saved has a page header that counts the stays", async () => {
    await createUser("bob");
    const $ = await page(await login(app, "bob"), "/wishlist");
    expect($(".wl-page-head h1.wl-page-title").text()).toBe("Saved");
    expect($(".wl-page-head .wl-page-lede").text()).toBe("Stays you keep for later.");
  });
});
