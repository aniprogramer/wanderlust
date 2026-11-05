const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { supportLimiter } = require("../middleware");
const pages = require("../controllers/pageController");

for (const name of [
  "privacy",
  "terms",
  "cancellation-policy",
  "house-rules",
]) {
  router.get(`/${name}`, pages.legalPage(name));
}

router.get("/robots.txt", pages.robots);
router.get("/sitemap.xml", wrapAsync(pages.sitemap));
router.get("/help", pages.help);
router
  .route("/contact")
  .get(pages.contactForm)
  .post(supportLimiter, wrapAsync(pages.sendContact));
router.get("/contact/sent", pages.contactSent);

module.exports = router;
