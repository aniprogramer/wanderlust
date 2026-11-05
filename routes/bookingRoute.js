const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const {
  isLoggedIn,
  isBookingParty,
  validateReason,
} = require("../middleware.js");
const bookingController = require("../controllers/bookingController.js");

router.get("/", isLoggedIn, wrapAsync(bookingController.myBookings));
router.get("/hosting", isLoggedIn, wrapAsync(bookingController.hostBookings));
router
  .route("/:bookingId")
  .get(isLoggedIn, isBookingParty, wrapAsync(bookingController.showBooking))
  .delete(
    isLoggedIn,
    isBookingParty,
    validateReason,
    wrapAsync(bookingController.cancelBooking),
  );
router.post(
  "/:bookingId/accept",
  isLoggedIn,
  isBookingParty,
  wrapAsync(bookingController.acceptBooking),
);
router.post(
  "/:bookingId/decline",
  isLoggedIn,
  isBookingParty,
  validateReason,
  wrapAsync(bookingController.declineBooking),
);

module.exports = router;
