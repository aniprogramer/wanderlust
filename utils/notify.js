// Sending is best effort: a mail failure is logged with an id and never fails the request.
const mailer = require("./mailer");
const { buildEmail } = require("./emails");
const reportError = require("./reportError");

module.exports = async (type, to, data, context = {}) => {
  try {
    await mailer.send({ to, ...buildEmail(type, data) });
    return true;
  } catch (err) {
    reportError(err, { event: `mail.${type}`, ...context });
    return false;
  }
};
