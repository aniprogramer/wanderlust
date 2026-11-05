// The backfill init/migrate.js used to do.
module.exports = {
  description: "Set INR on listings with no currency",
  up: async (db) => {
    const listings = db.collection("listings");
    const { modifiedCount } = await listings.updateMany(
      { currency: { $exists: false } },
      { $set: { currency: "INR" } },
    );
    const [noCategory, noPin] = await Promise.all([
      listings.countDocuments({ category: { $exists: false } }),
      listings.countDocuments({ "geometry.coordinates.0": { $exists: false } }),
    ]);
    return `currency set on ${modifiedCount}; ${noCategory} have no category and ${noPin} have no map pin (hosts can set these by editing)`;
  },
};
