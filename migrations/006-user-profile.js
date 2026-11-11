// Gives every existing user a display name (their username). The other profile fields
// start empty. Safe to run twice: only users without a display name are touched.
module.exports = {
  description: "Set displayName from username for existing users",
  up: async (db) => {
    const { modifiedCount } = await db
      .collection("users")
      .updateMany(
        { $or: [{ displayName: { $exists: false } }, { displayName: null }, { displayName: "" }] },
        [{ $set: { displayName: "$username" } }],
      );
    return `set a display name on ${modifiedCount} user(s)`;
  },
};
