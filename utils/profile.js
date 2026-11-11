// The only code that decides what a stranger may see about a user. It builds the public
// view-model by picking an allowlist, so a field added to the User model later stays private
// until someone adds it here on purpose.
const PUBLIC_FIELDS = [
  "displayName",
  "username",
  "avatarUrl",
  "initials",
  "bio",
  "city",
  "country",
  "languages",
  "memberSince",
  "emailVerified",
];

const initials = (name) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

const nameOf = (user) => (user && (user.displayName || user.username)) || "";

const publicProfile = (user) => ({
  displayName: nameOf(user),
  username: user.username,
  avatarUrl: user.avatar?.url || null,
  initials: initials(nameOf(user)),
  bio: user.bio || "",
  city: user.city || "",
  country: user.country || "",
  languages: [...(user.languages || [])],
  memberSince: user._id?.getTimestamp ? user._id.getTimestamp() : null,
  emailVerified: Boolean(user.emailVerifiedAt),
});

// One page per person: the owner sees their settings on it
const profilePath = (user) => `/users/${encodeURIComponent(user.username)}`;

module.exports = { profilePath, publicProfile, nameOf, initials, PUBLIC_FIELDS };
