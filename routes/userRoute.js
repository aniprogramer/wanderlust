const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const passport = require("passport");
const {
  saveRedirectUrl,
  validateSignup,
  validateLogin,
  authLimiter,
} = require("../middleware");
const userController = require("../controllers/userController");

// Signup
router
  .route("/signup")
  .get(userController.renderSignupForm)
  .post(authLimiter, validateSignup, wrapAsync(userController.signup));

// Login
router
  .route("/login")
  .get(userController.renderLoginForm)
  .post(
    authLimiter,
    validateLogin,
    saveRedirectUrl,
    passport.authenticate("local", {
      failureRedirect: "/login",
      failureFlash: true,
    }),
    userController.login,
  );

// Logout (POST so a stray link or image cannot sign people out)
router.post("/logout", userController.logout);

module.exports = router;
