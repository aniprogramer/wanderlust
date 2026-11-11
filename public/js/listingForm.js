// Listing form: previews chosen photos with a cover choice and alt text, keeps the currency label
// in step, guards against a double submit, and enhances the availability dates.
(() => {
  const input = document.getElementById("img");
  const list = document.getElementById("new-photo-list");
  const MAX_BYTES = 5 * 1024 * 1024;
  if (input && list) {
    const maxCount = Number(input.dataset.max) || 6;
    const altMax = Number(input.dataset.altMax) || 150;
    const existing = () =>
      document.querySelectorAll("[data-photo]:not(.is-removed)").length;
    const note = document.getElementById("photo-note");

    const coverChoice = (index, checked) => {
      const label = document.createElement("label");
      label.className = "wl-check wl-check--small";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "coverImage";
      radio.value = `new:${index}`;
      radio.checked = checked;
      const text = document.createElement("span");
      text.textContent = "Make cover";
      label.append(radio, text);
      return label;
    };

    const altField = (index) => {
      const wrap = document.createElement("div");
      wrap.className = "wl-field wl-photo__alt";
      const label = document.createElement("label");
      label.htmlFor = `new-alt-${index}`;
      label.textContent = `Alt text for new photo ${index + 1}`;
      const box = document.createElement("div");
      box.className = "wl-input wl-input--plain";
      const text = document.createElement("input");
      text.type = "text";
      text.id = `new-alt-${index}`;
      text.name = `newAlt[${index}]`;
      text.maxLength = altMax;
      box.append(text);
      wrap.append(label, box);
      return wrap;
    };

    input.addEventListener("change", () => {
      list.replaceChildren();
      const hasCover = document.querySelector('[data-photo] input[name="coverImage"]');
      [...input.files].forEach((file, index) => {
        const item = document.createElement("li");
        item.className = "wl-photo";
        const img = document.createElement("img");
        img.alt = "";
        img.src = URL.createObjectURL(file);
        img.addEventListener("load", () => URL.revokeObjectURL(img.src));
        const name = document.createElement("span");
        name.className = "wl-note";
        name.textContent = file.name;
        item.append(img, name, coverChoice(index, !hasCover && index === 0), altField(index));
        list.append(item);
      });
      const total = existing() + input.files.length;
      const big = [...input.files].filter((file) => file.size > MAX_BYTES);
      note.textContent =
        total > maxCount
          ? `That is ${total} photos. A listing can have up to ${maxCount}, so remove some before saving.`
          : big.length
            ? `${big[0].name} is over 5 MB. Choose a smaller photo before saving.`
            : "";
    });
  }

  // Greys a photo out when it is ticked for removal
  document.querySelectorAll("[data-photo-remove]").forEach((box) => {
    box.addEventListener("change", () =>
      box.closest("[data-photo]").classList.toggle("is-removed", box.checked),
    );
  });

  // The currency sets the words beside the price fields and nothing else
  const currency = document.getElementById("currency");
  if (currency) {
    currency.addEventListener("change", () => {
      document.querySelectorAll("[data-currency-hint]").forEach((field) => {
        const hint = document.getElementById(`${field.id}-hint`);
        if (hint) hint.textContent = hint.textContent.replace(/[A-Z]{3}\.$/, `${currency.value}.`);
      });
    });
  }

  // aria-disabled (not disabled), so the clicked button's intent still reaches the server
  const form = document.querySelector("[data-listing-form]");
  if (form) {
    form.addEventListener("submit", (event) => {
      if (form.dataset.submitting) return event.preventDefault();
      form.dataset.submitting = "true";
      form.querySelectorAll("button[type=submit]").forEach((button) =>
        button.setAttribute("aria-disabled", "true"),
      );
    });
    window.addEventListener("pageshow", (event) => {
      if (!event.persisted) return;
      delete form.dataset.submitting;
      form.querySelectorAll("button[type=submit]").forEach((button) =>
        button.removeAttribute("aria-disabled"),
      );
    });
  }

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
