const User = require("../models/user");

/**
 * GET /signup
 * Renders the user registration form
 */
module.exports.renderSignupForm = (req, res) => {
  res.render("users/signup.ejs");
};

/**
 * POST /signup
 * Handles user registration, passport integration, and automatic login
 */
module.exports.signup = async (req, res, next) => {
  try {
    let { username, email, password } = req.body;
    const newUser = new User({
      email,
      username,
    });
    const registeredUser = await User.register(newUser, password);
    console.log(registeredUser);
    req.login(registeredUser, (err) => {
      if (err) {
        return next(err);
      }
      req.flash("success", "Welcome to Wanderlust!!");
      res.redirect("/listings");
    });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/signup");
  }
};

/**
 * GET /login
 * Renders the login form
 */
module.exports.renderLoginForm = (req, res) => {
  res.render("users/login.ejs");
};

/**
 * POST /login
 * Redirects user to their intended destination or listings after success
 */
module.exports.login = async (req, res) => {
  req.flash("success", "Logged in Successfully!");
  let redirectUrl = res.locals.redirectUrl || "/listings";
  console.log(`Redirect URL: ${redirectUrl}`);
  res.redirect(redirectUrl);
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
