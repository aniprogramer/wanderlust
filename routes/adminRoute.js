const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn, isAdmin } = require("../middleware");
const admin = require("../controllers/adminController");

// Admin rights come only from scripts/make-admin.js
router.use(isLoggedIn, isAdmin);
router.get("/", wrapAsync(admin.dashboard));
router.post("/listings/:id/hide", wrapAsync(admin.hide));
router.post("/listings/:id/unhide", wrapAsync(admin.unhide));
router.post("/support/:id/resolve", wrapAsync(admin.resolveMessage));
router.post("/reports/:id/resolve", wrapAsync(admin.resolveReport));

module.exports = router;
