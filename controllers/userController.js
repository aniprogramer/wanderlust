const crypto = require("crypto");
const User = require("../models/user");
const mailer = require("../utils/mailer");
const notify = require("../utils/notify");
const logger = require("../utils/logger");
const reportError = require("../utils/reportError");
const { siteUrl } = require("../utils/config");
const { TERMS_VERSION } = require("../utils/siteInfo");

const RESET_TTL_MS = 60 * 60 * 1000;
const { hashToken, newVerifyToken } = require("../utils/tokens");

const signupMessage = (err) => {
  if (err.name === "UserExistsError") return "That username is taken.";
  if (err.code === 11000 && err.keyPattern?.email)
    return "That email is already registered.";
  return "Could not create your account. Please try again.";
};

/**
 * GET /signup
 * Renders the user registration form
 */
module.exports.renderSignupForm = (req, res) => {
  res.render("users/signup.ejs", {
    isAuthPage: true,
    noindex: true,
    pageTitle: "Create an account",
  });
};

/**
 * POST /signup
 * Handles user registration, passport integration, and automatic login
 */
module.exports.signup = async (req, res, next) => {
  try {
    let { username, email, password } = req.body;
    const { token, fields } = newVerifyToken();
    const newUser = new User({
      email,
      username,
      termsAcceptedAt: new Date(),
      termsVersion: TERMS_VERSION,
      ...fields,
    });
    const registeredUser = await User.register(newUser, password);
    await notify(
      "verifyEmail",
      registeredUser.email,
      { username: registeredUser.username, token, welcome: true },
      { userId: String(registeredUser._id) },
    );
    req.login(registeredUser, (err) => {
      if (err) {
        return next(err);
      }
      req.session.authAt = Date.now();
      req.flash(
        "success",
        "Welcome to Wanderlust. Check your email to confirm your address.",
      );
      res.redirect("/listings");
    });
  } catch (err) {
    if (err.name !== "UserExistsError" && err.code !== 11000) {
      reportError(err, { event: "signup" });
    }
    req.flash("error", signupMessage(err));
    res.redirect("/signup");
  }
};

/**
 * GET /login
 * Renders the login form
 */
module.exports.renderLoginForm = (req, res) => {
  res.render("users/login.ejs", {
    isAuthPage: true,
    noindex: true,
    pageTitle: "Sign in",
  });
};

/**
 * POST /login
 * Redirects user to their intended destination or listings after success
 */
module.exports.login = async (req, res) => {
  req.session.authAt = Date.now();
  req.flash("success", "Logged in Successfully!");
  let redirectUrl = res.locals.redirectUrl || "/listings";
  res.redirect(redirectUrl);
};

module.exports.renderForgotForm = (req, res) => {
  res.render("users/forgot.ejs", {
    isAuthPage: true,
    noindex: true,
    pageTitle: "Reset password",
  });
};

/**
 * POST /forgot-password
 * Always answers the same way so it cannot be used to discover registered emails.
 */
module.exports.forgotPassword = async (req, res) => {
  const user = await User.findOne({ email: req.body.email.toLowerCase() });
  // A2.5: never claim mail went out when sending is off (development only; production
  // cannot start without SMTP). The message does not depend on whether the account exists.
  if (!mailer.isConfigured()) {
    if (user) {
      const token = await issueResetToken(user);
      logger.info(`Reset link for user ${user._id}: ${siteUrl(`/reset-password/${token}`)}`);
    }
    req.flash(
      "info",
      "Email is turned off in this environment. If the account exists, the reset link is in the server log.",
    );
    return res.redirect("/forgot-password");
  }
  if (user) {
    const token = await issueResetToken(user);
    // Never reveal delivery trouble to the requester, and never log the link
    await notify(
      "passwordReset",
      user.email,
      { username: user.username, token },
      { userId: String(user._id) },
    );
  }
  req.flash(
    "success",
    "If an account exists for that email, we have sent a reset link.",
  );
  res.redirect("/forgot-password");
};

const issueResetToken = async (user) => {
  const token = crypto.randomBytes(32).toString("hex");
  user.resetTokenHash = hashToken(token);
  user.resetTokenExpires = new Date(Date.now() + RESET_TTL_MS);
  await user.save();
  return token;
};

const findByResetToken = (token) =>
  User.findOne({
    resetTokenHash: hashToken(token),
    resetTokenExpires: { $gt: new Date() },
  }).select("+resetTokenHash +resetTokenExpires");

module.exports.renderResetForm = async (req, res) => {
  const valid = Boolean(await findByResetToken(req.params.token));
  res.render("users/reset.ejs", {
    isAuthPage: true,
    noindex: true,
    pageTitle: "Choose a new password",
    tokenValid: valid,
    token: req.params.token,
  });
};

module.exports.resetPassword = async (req, res) => {
  const user = await findByResetToken(req.params.token);
  if (!user) {
    req.flash("error", "That reset link is invalid or has expired.");
    return res.redirect("/forgot-password");
  }
  await user.setPassword(req.body.password);
  user.resetTokenHash = undefined;
  user.resetTokenExpires = undefined;
  user.passwordChangedAt = new Date();
  await user.save();
  await notify(
    "passwordChanged",
    user.email,
    { username: user.username },
    { userId: String(user._id) },
  );
  req.flash("success", "Password updated. Sign in with your new password.");
  res.redirect("/login");
};

// ---------- Email verification ----------
module.exports.renderVerifyNeeded = (req, res) => {
  if (req.user.emailVerifiedAt) return res.redirect("/listings");
  res.render("users/verify.ejs", {
    pageTitle: "Confirm your email",
    noindex: true,
  });
};

module.exports.verifyEmail = async (req, res) => {
  const user = await User.findOne({
    verifyTokenHash: hashToken(req.params.token),
    verifyTokenExpires: { $gt: new Date() },
  });
  if (!user) {
    req.flash(
      "error",
      "That link is invalid or has expired. Sign in and ask for a new one.",
    );
    return res.redirect(req.user ? "/verify-email" : "/login");
  }
  await User.updateOne(
    { _id: user._id },
    {
      $set: { emailVerifiedAt: new Date() },
      $unset: { verifyTokenHash: 1, verifyTokenExpires: 1 },
    },
  );
  req.flash("success", "Your email is confirmed. Thank you.");
  res.redirect("/listings");
};

module.exports.resendVerification = async (req, res) => {
  if (req.user.emailVerifiedAt) {
    req.flash("info", "Your email is already confirmed.");
    return res.redirect("/listings");
  }
  const { token, fields } = newVerifyToken();
  await User.updateOne({ _id: req.user._id }, { $set: fields });
  await notify(
    "verifyEmail",
    req.user.email,
    { username: req.user.username, token },
    { userId: String(req.user._id) },
  );
  req.flash("success", `We sent a new link to ${req.user.email}.`);
  res.redirect("/verify-email");
};

/**
 * GET /logout
 * Destroys the user session
 */
module.exports.logout = (req, res, next) => {
  req.logOut((err) => {
    if (err) {
      return next(err);
    }
    req.flash("success", "Logout successfull!");
    res.redirect("/listings");
  });
};
