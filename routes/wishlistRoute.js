const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn, requireMode } = require("../middleware.js");
const wishlistController = require("../controllers/wishlistController.js");

router.get("/", isLoggedIn, requireMode("guest"), wrapAsync(wishlistController.index));
router
  .route("/:id")
  .post(isLoggedIn, requireMode("guest"), wrapAsync(wishlistController.add))
  .delete(isLoggedIn, requireMode("guest"), wrapAsync(wishlistController.remove));

module.exports = router;
