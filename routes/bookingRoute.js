const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const {
  isLoggedIn,
  isBookingParty,
  requireMode,
  requireModeForRole,
  validateReason,
} = require("../middleware.js");
const bookingController = require("../controllers/bookingController.js");

router.get("/", isLoggedIn, requireMode("guest"), wrapAsync(bookingController.myBookings));
router.get("/hosting", isLoggedIn, requireMode("host"), wrapAsync(bookingController.hostBookings));
router
  .route("/:bookingId")
  .get(isLoggedIn, isBookingParty, wrapAsync(bookingController.showBooking))
  .delete(
    isLoggedIn,
    isBookingParty,
    requireModeForRole,
    validateReason,
    wrapAsync(bookingController.cancelBooking),
  );
router.post(
  "/:bookingId/accept",
  isLoggedIn,
  requireMode("host"),
  isBookingParty,
  wrapAsync(bookingController.acceptBooking),
);
router.post(
  "/:bookingId/decline",
  isLoggedIn,
  requireMode("host"),
  isBookingParty,
  validateReason,
  wrapAsync(bookingController.declineBooking),
);

module.exports = router;
