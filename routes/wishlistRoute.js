const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn } = require("../middleware.js");
const wishlistController = require("../controllers/wishlistController.js");

router.get("/", isLoggedIn, wrapAsync(wishlistController.index));
router
  .route("/:id")
  .post(isLoggedIn, wrapAsync(wishlistController.add))
  .delete(isLoggedIn, wrapAsync(wishlistController.remove));

module.exports = router;
