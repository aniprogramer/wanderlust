// Moves the single photo into the photo list, keeping `image` as the cover's copy.
const PLACEHOLDER = "listingimage";

module.exports = {
  description: "Copy the single image into images, and set amenities and status",
  up: async (db) => {
    const listings = db.collection("listings");
    const { modifiedCount } = await listings.updateMany(
      {
        images: { $exists: false },
        "image.url": { $exists: true },
        "image.filename": { $ne: PLACEHOLDER },
      },
      [{ $set: { images: [{ url: "$image.url", filename: "$image.filename" }] } }],
    );
    await listings.updateMany(
      { images: { $exists: false } },
      { $set: { images: [] } },
    );
    await listings.updateMany(
      { amenities: { $exists: false } },
      { $set: { amenities: [] } },
    );
    await listings.updateMany(
      { status: { $exists: false } },
      { $set: { status: "published" } },
    );
    return `copied the photo on ${modifiedCount} listing(s)`;
  },
};
