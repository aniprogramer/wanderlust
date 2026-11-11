const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const passport = require("passport");
const {
  saveRedirectUrl,
  keepSwitchedMode,
  validateSignup,
  validateLogin,
  validateForgot,
  validateReset,
  resolveLoginIdentifier,
  loginLimiter,
  signupLimiter,
  forgotLimiter,
  resetLimiter,
  isLoggedIn,
  validateMode,
  verifyResendLimiter,
} = require("../middleware");
const userController = require("../controllers/userController");

// Signup
router
  .route("/signup")
  .get(userController.renderSignupForm)
  .post(signupLimiter, validateSignup, wrapAsync(userController.signup));

// Login
router
  .route("/login")
  .get(userController.renderLoginForm)
  .post(
    loginLimiter,
    validateLogin,
    resolveLoginIdentifier,
    saveRedirectUrl,
    keepSwitchedMode,
    passport.authenticate("local", {
      failureRedirect: "/login",
      // One message for unknown user and wrong password alike
      failureFlash: "Incorrect username or password.",
    }),
    userController.login,
  );

// Switch between guest and host mode (the mode lives in the session)
router.post("/mode", isLoggedIn, validateMode, userController.switchMode);

// Password recovery
router
  .route("/forgot-password")
  .get(userController.renderForgotForm)
  .post(forgotLimiter, validateForgot, wrapAsync(userController.forgotPassword));

router
  .route("/reset-password/:token")
  .get(wrapAsync(userController.renderResetForm))
  .post(resetLimiter, validateReset, wrapAsync(userController.resetPassword));

// Email verification
router.get("/verify-email", isLoggedIn, userController.renderVerifyNeeded);
router.post(
  "/verify-email/resend",
  isLoggedIn,
  verifyResendLimiter,
  wrapAsync(userController.resendVerification),
);
router.get("/verify-email/:token", wrapAsync(userController.verifyEmail));

// Logout (POST so a stray link or image cannot sign people out)
router.post("/logout", userController.logout);

module.exports = router;
