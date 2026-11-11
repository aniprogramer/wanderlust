// Gives existing listings the fields the new form asks for and flags them for their host.
// House rules, accessibility and safety stay unset: a host has said nothing about them, and
// "No pets" would be an invented claim. Safe to run twice: a listing that already has a
// cancellation policy has been migrated or saved through the new form, so it is left alone.
const { approxPoint } = require("../utils/location");
const { DEFAULT_CANCELLATION_POLICY, MAX_STAY_NIGHTS } = require("../utils/constants");

module.exports = {
  description: "Add listing details, the public map area and the detailsIncomplete flag",
  up: async (db) => {
    const listings = db.collection("listings");
    const has = (field, values) => ({
      $gt: [{ $size: { $setIntersection: [{ $ifNull: [`$${field}`, []] }, values] } }, 0],
    });
    const { modifiedCount } = await listings.updateMany(
      { $or: [{ cancellationPolicy: { $exists: false } }, { cancellationPolicy: null }] },
      [
        {
          $set: {
            city: { $ifNull: ["$city", "$location"] },
            cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
            maxNights: { $ifNull: ["$maxNights", MAX_STAY_NIGHTS] },
            checkInFrom: { $ifNull: ["$checkInFrom", "15:00"] },
            checkInUntil: { $ifNull: ["$checkInUntil", "20:00"] },
            checkOutBy: { $ifNull: ["$checkOutBy", "11:00"] },
            hasWorkspace: has("amenities", ["workspace", "dedicated_desk"]),
            detailsIncomplete: true,
          },
        },
      ],
    );
    // A separate step so that only rows that had the amenity gain the house rule
    await listings.updateMany(
      { amenities: "pets_allowed", petsAllowed: { $exists: false } },
      { $set: { petsAllowed: true } },
    );

    const pinned = await listings
      .find({
        "geometry.coordinates.0": { $exists: true },
        "approxGeometry.coordinates.0": { $exists: false },
      })
      .project({ "geometry.coordinates": 1 })
      .toArray();
    if (pinned.length) {
      await listings.bulkWrite(
        pinned.map(({ _id, geometry }) => ({
          updateOne: {
            filter: { _id },
            update: {
              $set: {
                approxGeometry: { type: "Point", coordinates: approxPoint(geometry.coordinates) },
              },
            },
          },
        })),
      );
    }
    return `flagged ${modifiedCount} listing(s), added a map area to ${pinned.length}`;
  },
};
