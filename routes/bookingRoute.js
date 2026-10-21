const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn, isBookingParty } = require("../middleware.js");
const bookingController = require("../controllers/bookingController.js");

router.get("/", isLoggedIn, wrapAsync(bookingController.myBookings));
router.get("/hosting", isLoggedIn, wrapAsync(bookingController.hostBookings));
router.delete(
  "/:bookingId",
  isLoggedIn,
  isBookingParty,
  wrapAsync(bookingController.cancelBooking),
);

module.exports = router;
