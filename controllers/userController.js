const crypto = require("crypto");
const User = require("../models/user");
const mailer = require("../utils/mailer");
const notify = require("../utils/notify");
const logger = require("../utils/logger");
const reportError = require("../utils/reportError");
const { siteUrl } = require("../utils/config");
const { TERMS_VERSION } = require("../utils/siteInfo");
const { profilePath } = require("../utils/profile");
const { normalizeMode, landingFor, onlyIn, HOMES } = require("../utils/mode");

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
    let { username, email, password, firstName, lastName, startingMode } = req.body;
    const { token, fields } = newVerifyToken();
    const displayName = [firstName, lastName].filter(Boolean).join(" ").trim() || undefined;
    const newUser = new User({
      email,
      username,
      displayName,
      termsAcceptedAt: new Date(),
      termsVersion: TERMS_VERSION,
      startingMode,
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
      const mode = normalizeMode(startingMode);
      req.session.mode = mode;
      req.flash(
        "success",
        "Welcome to Wanderlust. Check your email to confirm your address.",
      );
      res.redirect(HOMES[mode]);
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
  // Passport starts a fresh session at login, so the mode is set here: the account's starting
  // mode, unless this person already switched by hand in the session they just came from.
  const kept = res.locals.switchedMode;
  const stayed = kept?.userId === String(req.user._id);
  const mode = normalizeMode(stayed ? kept.mode : req.user.startingMode);
  req.session.mode = mode;
  if (stayed) req.session.modeSwitched = true;
  const wanted = res.locals.redirectUrl;
  const needs = wanted && onlyIn(wanted);
  if (needs && needs !== mode) {
    // They asked for a page from the other mode: land on this mode's home and say why
    req.flash("success", "Logged in Successfully!");
    req.flash(
      "info",
      needs === "host"
        ? "That page is for hosts. You are in guest mode. Use Switch to host in the header to open it."
        : "That page is for guests. You are in host mode. Use Switch to guest in the header to open it.",
    );
    return res.redirect(HOMES[mode]);
  }
  req.flash("success", "Logged in Successfully!");
  res.redirect(landingFor(wanted, mode));
};

/**
 * POST /mode
 * Switches the signed-in user between guest and host. Stays on the same page when that
 * page exists in the new mode, otherwise lands on the new mode's home.
 */
module.exports.switchMode = (req, res) => {
  const mode = normalizeMode(req.body.mode);
  req.session.mode = mode;
  req.session.modeSwitched = true;
  req.flash(
    "success",
    mode === "host" ? "You are now in host mode." : "You are now in guest mode.",
  );
  res.redirect(landingFor(req.body.returnTo, mode));
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
  // Whoever resets starts over from their starting mode on their next sign-in
  delete req.session.mode;
  delete req.session.modeSwitched;
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
  // A pending address replaces the current one only now that its link has been used
  const set = { emailVerifiedAt: new Date() };
  const unset = { verifyTokenHash: 1, verifyTokenExpires: 1 };
  if (user.pendingEmail) {
    set.email = user.pendingEmail;
    unset.pendingEmail = 1;
  }
  try {
    await User.updateOne({ _id: user._id }, { $set: set, $unset: unset });
  } catch (err) {
    if (err.code !== 11000) throw err;
    req.flash("error", "That email is already registered.");
    return res.redirect(req.user ? profilePath(req.user) : "/login");
  }
  req.flash(
    "success",
    user.pendingEmail ? "Your new email address is confirmed." : "Your email is confirmed. Thank you.",
  );
  res.redirect(user.pendingEmail ? (req.user ? profilePath(req.user) : "/login") : "/listings");
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
