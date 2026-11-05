const crypto = require("crypto");

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

// Only the hash is stored, so a database leak does not hand out working links.
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

// Returns the token for the email and the fields to store on the user.
const newVerifyToken = (now = Date.now()) => {
  const token = crypto.randomBytes(32).toString("hex");
  return {
    token,
    fields: {
      verifyTokenHash: hashToken(token),
      verifyTokenExpires: new Date(now + VERIFY_TTL_MS),
    },
  };
};

module.exports = { hashToken, newVerifyToken, VERIFY_TTL_MS };
