// One list of password rules. The server checks it in schema.js, the forms render it as the
// live checklist, and public/js/auth.js reads the same patterns from the page, so the browser
// and the server can never disagree about what a strong password is.
const RULES = [
  { id: "length", label: "8 to 128 characters", pattern: "^[\\s\\S]{8,128}$" },
  { id: "upper", label: "An uppercase letter", pattern: "[A-Z]" },
  { id: "lower", label: "A lowercase letter", pattern: "[a-z]" },
  { id: "number", label: "A number", pattern: "[0-9]" },
  { id: "special", label: "A special character", pattern: "[^A-Za-z0-9\\s]" },
];

const failing = (password) =>
  RULES.filter((rule) => !new RegExp(rule.pattern).test(String(password ?? "")));

const message = (missing) =>
  `Password needs ${missing.map((rule) => rule.label.toLowerCase()).join(", ")}.`;

module.exports = { RULES, failing, message };
