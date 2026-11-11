// Existing users predate the sign-up choice, so they start in guest mode as they always did.
// Safe to run twice: only users without a value are touched.
module.exports = {
  description: "Set startingMode to guest for existing users",
  up: async (db) => {
    const { modifiedCount } = await db
      .collection("users")
      .updateMany(
        { $or: [{ startingMode: { $exists: false } }, { startingMode: null }] },
        { $set: { startingMode: "guest" } },
      );
    return `set a starting mode on ${modifiedCount} user(s)`;
  },
};
