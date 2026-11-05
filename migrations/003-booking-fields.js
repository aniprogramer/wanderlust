// Older bookings get a price snapshot from what they stored. Their status does not change.
module.exports = {
  description: "Backfill currency, guests and price breakdown on bookings",
  up: async (db) => {
    const bookings = db.collection("bookings");
    const listings = db.collection("listings");
    const rows = await bookings
      .find({ currency: { $exists: false } })
      .project({ listing: 1, nights: 1, totalPrice: 1 })
      .toArray();
    const currencyOf = new Map();
    for (const row of rows) {
      const key = String(row.listing);
      if (!currencyOf.has(key)) {
        const listing = await listings.findOne(
          { _id: row.listing },
          { projection: { currency: 1 } },
        );
        currencyOf.set(key, listing?.currency || "INR");
      }
      const nights = row.nights?.length || 1;
      await bookings.updateOne(
        { _id: row._id },
        {
          $set: {
            currency: currencyOf.get(key),
            guests: 1,
            nightlyPrice: Math.round(row.totalPrice / nights),
            cleaningFee: 0,
            subtotal: row.totalPrice,
            taxAmount: 0,
          },
        },
      );
    }
    return `updated ${rows.length} booking(s)`;
  },
};
