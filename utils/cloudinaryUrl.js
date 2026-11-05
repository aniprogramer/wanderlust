// Cloudinary serves any width on demand from the same URL. Other hosts pass through untouched.
const MARKER = "/image/upload/";

const photoUrl = (url, width) =>
  typeof url === "string" && url.includes(MARKER)
    ? url.replace(MARKER, `${MARKER}f_auto,q_auto,w_${width},c_limit/`)
    : url;

const photoSrcset = (url, widths = [400, 800]) =>
  typeof url === "string" && url.includes(MARKER)
    ? widths.map((width) => `${photoUrl(url, width)} ${width}w`).join(", ")
    : "";

module.exports = { photoUrl, photoSrcset };
