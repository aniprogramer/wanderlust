// Facts about the business, read from the environment. Nothing here is invented: a value
// that has not been supplied renders as a bracketed placeholder, so the gap stays visible.
const placeholder = (env, label) => process.env[env]?.trim() || `[${label}]`;

// Flip to true only after a lawyer has reviewed the pages in views/legal (LD5).
const LEGAL_REVIEWED = process.env.LEGAL_REVIEWED === "true";
// Stored on the user when they accept the Terms; bump it when the Terms change.
const TERMS_VERSION = "draft-2026-11";

const SOCIAL = [
  ["Facebook", "SOCIAL_FACEBOOK_URL", "fa-square-facebook"],
  ["Instagram", "SOCIAL_INSTAGRAM_URL", "fa-square-instagram"],
  ["LinkedIn", "SOCIAL_LINKEDIN_URL", "fa-linkedin"],
];

module.exports = {
  LEGAL_REVIEWED,
  TERMS_VERSION,
  // Getters: the environment is read when a page renders, so tests can change it.
  get legalEntity() {
    return placeholder("LEGAL_ENTITY_NAME", "Company legal name");
  },
  get legalAddress() {
    return placeholder("LEGAL_ADDRESS", "Registered address");
  },
  get supportEmail() {
    return placeholder("SUPPORT_EMAIL", "Support email");
  },
  get grievanceOfficer() {
    return placeholder("GRIEVANCE_OFFICER", "Grievance officer name and contact");
  },
  get jurisdiction() {
    return placeholder("GOVERNING_LAW", "Governing law and jurisdiction");
  },
  // Only networks with a configured URL are listed, so the footer never has a dead icon.
  get socialLinks() {
    return SOCIAL.filter(([, env]) => process.env[env]?.trim()).map(
      ([name, env, icon]) => ({ name, icon, url: process.env[env].trim() }),
    );
  },
};
