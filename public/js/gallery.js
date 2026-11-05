// Show page gallery: thumbnails are buttons, so Tab, Enter and Space work with no extra code.
(() => {
  const main = document.getElementById("gallery-main");
  const thumbs = document.querySelectorAll("[data-gallery-thumb]");
  if (!main || !thumbs.length) return;
  thumbs.forEach((thumb) => {
    thumb.addEventListener("click", () => {
      main.src = thumb.dataset.src;
      main.srcset = thumb.dataset.srcset;
      main.alt = thumb.dataset.alt;
      thumbs.forEach((other) =>
        other.setAttribute("aria-pressed", String(other === thumb)),
      );
    });
  });
})();
