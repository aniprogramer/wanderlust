// Reviews from before stays had to be confirmed first do not get the "Verified stay" label.
module.exports = {
  description: "Mark existing reviews as not verified",
  up: async (db) => {
    const { modifiedCount } = await db
      .collection("reviews")
      .updateMany(
        { verifiedStay: { $exists: false } },
        { $set: { verifiedStay: false } },
      );
    return `marked ${modifiedCount} review(s)`;
  },
};
