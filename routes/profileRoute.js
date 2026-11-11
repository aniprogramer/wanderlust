const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const profileController = require("../controllers/profileController");

// Public: a stranger may read a profile (the allowlist lives in utils/profile.js)
router.get("/:username", wrapAsync(profileController.show));

module.exports = router;
