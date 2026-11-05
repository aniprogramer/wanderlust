// Listing form: previews the photos chosen for upload, and enhances the availability dates.
(() => {
  const input = document.getElementById("img");
  const list = document.getElementById("new-photo-list");
  if (input && list) {
    const maxCount = Number(input.dataset.max) || 6;
    const existing = () =>
      document.querySelectorAll("[data-photo]:not(.is-removed)").length;
    const note = document.getElementById("photo-note");
    input.addEventListener("change", () => {
      list.replaceChildren();
      for (const file of input.files) {
        const item = document.createElement("li");
        item.className = "wl-photo";
        const img = document.createElement("img");
        img.alt = "";
        img.src = URL.createObjectURL(file);
        img.addEventListener("load", () => URL.revokeObjectURL(img.src));
        const name = document.createElement("span");
        name.className = "wl-note";
        name.textContent = file.name;
        item.append(img, name);
        list.append(item);
      }
      const total = existing() + input.files.length;
      note.textContent =
        total > maxCount
          ? `That is ${total} photos. A listing can have up to ${maxCount}, so remove some before saving.`
          : "";
    });
  }

  // Greys a photo out when it is ticked for removal
  document.querySelectorAll("[data-photo-remove]").forEach((box) => {
    box.addEventListener("change", () =>
      box.closest("[data-photo]").classList.toggle("is-removed", box.checked),
    );
  });

  if (window.flatpickr) {
    document.querySelectorAll("[data-date-input]").forEach((el) =>
      flatpickr(el, {
        minDate: el.dataset.today,
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "j M Y",
        // Flatpickr's generated input must keep the label, or screen readers lose the name
        onReady: (_d, _s, fp) => {
          fp.altInput.id = `${el.id}-alt`;
          document.querySelector(`label[for="${el.id}"]`).htmlFor = fp.altInput.id;
        },
      }),
    );
  }
})();
