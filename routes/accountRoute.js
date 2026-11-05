const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const {
  isLoggedIn,
  validateProfile,
  validateChangePassword,
  validateDeleteAccount,
} = require("../middleware");
const account = require("../controllers/accountController");

router.get("/deleted", account.deleted);

router.use(isLoggedIn);
router.get("/", account.show);
router.get("/export", wrapAsync(account.exportData));
router.post("/profile", validateProfile, wrapAsync(account.updateProfile));
router.post(
  "/password",
  validateChangePassword,
  wrapAsync(account.changePassword),
);
router.post(
  "/delete",
  validateDeleteAccount,
  wrapAsync(account.deleteAccount),
);

module.exports = router;
