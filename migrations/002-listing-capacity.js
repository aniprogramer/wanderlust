// Capacity is a guess for older listings, so they are flagged and the host is asked to confirm.
module.exports = {
  description: "Backfill capacity and flag it for the host to confirm",
  up: async (db) => {
    const { modifiedCount } = await db.collection("listings").updateMany(
      { maxGuests: { $exists: false } },
      {
        $set: {
          maxGuests: 4,
          bedrooms: 1,
          beds: 2,
          bathrooms: 1,
          capacityDefaulted: true,
        },
      },
    );
    await db.collection("listings").updateMany(
      { cleaningFee: { $exists: false } },
      { $set: { cleaningFee: 0, minNights: 1 } },
    );
    return `capacity defaulted on ${modifiedCount} listing(s)`;
  },
};
