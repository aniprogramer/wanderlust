// Search and social metadata for one stay. Only facts the listing stores; the rating appears
// only when real reviews exist.
const { siteUrl } = require("./config");
const { publicCoords } = require("./location");

module.exports = (listing) => {
  const url = siteUrl(`/listings/${listing._id}`);
  const data = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: listing.title,
    description: listing.description,
    url,
    image: listing.gallery.map((photo) => photo.url),
    address: {
      "@type": "PostalAddress",
      addressLocality: listing.location,
      addressCountry: listing.country,
    },
    priceRange: `${listing.price} ${listing.currency} per night`,
  };
  const [lng, lat] = publicCoords(listing) || [];
  if (lat != null) {
    data.geo = { "@type": "GeoCoordinates", latitude: lat, longitude: lng };
  }
  if (listing.reviewCount > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: listing.avgRating,
      reviewCount: listing.reviewCount,
    };
  }
  return {
    canonicalPath: `/listings/${listing._id}`,
    ogImage: listing.image.url,
    ogType: "website",
    // "<" escaped so a listing title can never close the script element
    jsonLd: JSON.stringify(data).replace(/</g, "\\u003c"),
  };
};
