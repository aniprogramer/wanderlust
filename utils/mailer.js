const nodemailer = require("nodemailer");

// With no SMTP_HOST nothing leaves the machine: development logs the message and tests
// collect it in `outbox`. Production cannot get here, because startup refuses to run
// without SMTP (see utils/config.js).
const isConfigured = () => Boolean(process.env.SMTP_HOST);

let transport;
const getTransport = () => {
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transport;
};

const outbox = [];

const logInstead = (message) => {
  if (process.env.NODE_ENV === "test") {
    outbox.push(message);
    return;
  }
  // Development only, so a developer can follow the links in the message
  console.log(
    `[mail not sent: SMTP_HOST is unset]\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`,
  );
};

const send = async ({ to, subject, text, html, replyTo }) => {
  const message = { to, subject, text, html, replyTo };
  if (!isConfigured()) return logInstead(message);
  return getTransport().sendMail({
    from: process.env.MAIL_FROM || "Wanderlust <no-reply@wanderlust.local>",
    ...message,
  });
};

module.exports = { isConfigured, send, outbox };
