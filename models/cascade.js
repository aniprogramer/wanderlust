const Review = require("./review");
const Booking = require("./booking");
const User = require("./user");

// Removes everything that hangs off the given listings (docs with _id and reviews).
// Shared by the delete hook and the seeder so neither leaves orphans.
module.exports = async (listings) => {
  const ids = listings.map((l) => l._id);
  await Promise.all([
    Review.deleteMany({
      _id: { $in: listings.flatMap((l) => l.reviews || []) },
    }),
    Booking.deleteMany({ listing: { $in: ids } }),
    User.updateMany(
      { wishlist: { $in: ids } },
      { $pull: { wishlist: { $in: ids } } },
    ),
  ]);
};
