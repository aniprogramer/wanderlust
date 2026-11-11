const express = require("express");
const router = express.Router();
const multer = require("multer");
const wrapAsync = require("../utils/wrapAsync");
const ExpressError = require("../utils/ExpressError");
const { ALLOWED_IMAGE_TYPES, IMAGE_ERROR } = require("../utils/constants");
const {
  isLoggedIn,
  validateProfile,
  validateStartingMode,
  validateEmailChange,
  validateChangePassword,
  validateDeleteAccount,
  csrfAfterUpload,
  checkImageContent,
} = require("../middleware");
const account = require("../controllers/accountController");

// One photo, same type and size rules as listing photos
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    cb(
      ALLOWED_IMAGE_TYPES.includes(file.mimetype) ? null : new ExpressError(400, IMAGE_ERROR),
      ALLOWED_IMAGE_TYPES.includes(file.mimetype),
    ),
});
const avatarUpload = upload.fields([{ name: "avatar", maxCount: 1 }]);

router.get("/deleted", account.deleted);

router.use(isLoggedIn);
router.get("/", wrapAsync(account.show));
router.get("/export", wrapAsync(account.exportData));
router.post(
  "/profile",
  avatarUpload,
  csrfAfterUpload,
  checkImageContent,
  validateProfile,
  wrapAsync(account.updateProfile),
);
router.post("/starting-mode", validateStartingMode, wrapAsync(account.setStartingMode));
router.post("/email", validateEmailChange, wrapAsync(account.changeEmail));
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
