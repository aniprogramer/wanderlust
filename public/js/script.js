// Example starter JavaScript for disabling form submissions if there are invalid fields
(() => {
  "use strict";

  // Fetch all the forms we want to apply custom Bootstrap validation styles to
  const forms = document.querySelectorAll(".needs-validation");

  // Loop over them and prevent submission
  Array.from(forms).forEach((form) => {
    form.addEventListener(
      "submit",
      (event) => {
        if (!form.checkValidity()) {
          event.preventDefault();
          event.stopPropagation();
        }

        form.classList.add("was-validated");
      },
      false,
    );
  });

  // Homepage interaction: category track scroller & date validation
  document.addEventListener("DOMContentLoaded", () => {
    const track = document.getElementById("categoryTrack");
    const scrollBtn = document.getElementById("catScrollRight");
    if (track && scrollBtn) {
      scrollBtn.addEventListener("click", () => {
        track.scrollBy({ left: 320, behavior: "smooth" });
      });
    }

    const checkInInput = document.getElementById("check-in-input");
    const checkOutInput = document.getElementById("check-out-input");
    if (checkInInput && checkOutInput) {
      checkInInput.addEventListener("change", () => {
        if (checkInInput.value) {
          checkOutInput.min = checkInInput.value;
          if (checkOutInput.value && checkOutInput.value < checkInInput.value) {
            checkOutInput.value = checkInInput.value;
          }
        }
      });
    }

    // Custom Wanderlust Guest Selector Popover
    const guestsTrigger = document.getElementById("guests-trigger-btn");
    const guestsPopover = document.getElementById("guests-popover");
    const guestsInput = document.getElementById("guests-input");
    const guestsDisplay = document.getElementById("guests-display");
    const adultsDecBtn = document.getElementById("adults-dec-btn");
    const adultsIncBtn = document.getElementById("adults-inc-btn");
    const adultsCountEl = document.getElementById("adults-count");
    const childrenDecBtn = document.getElementById("children-dec-btn");
    const childrenIncBtn = document.getElementById("children-inc-btn");
    const childrenCountEl = document.getElementById("children-count");
    const guestsDoneBtn = document.getElementById("guests-done-btn");

    if (guestsTrigger && guestsPopover && guestsInput && adultsCountEl && childrenCountEl) {
      let adults = Math.max(1, parseInt(adultsCountEl.textContent, 10) || 1);
      // Until someone touches the stepper there is no guest filter at all
      let chosen = Boolean(guestsInput.value);
      let children = Math.max(0, parseInt(childrenCountEl.textContent, 10) || 0);

      const updateGuests = () => {
        const total = adults + children;
        adultsCountEl.textContent = adults;
        childrenCountEl.textContent = children;
        if (chosen) guestsInput.value = total;
        if (guestsDisplay && chosen) {
          guestsDisplay.textContent = total === 1 ? "1 guest" : `${total} guests`;
        }

        if (adultsDecBtn) adultsDecBtn.disabled = adults <= 1;
        if (adultsIncBtn) adultsIncBtn.disabled = total >= 16;
        if (childrenDecBtn) childrenDecBtn.disabled = children <= 0;
        if (childrenIncBtn) childrenIncBtn.disabled = total >= 16;
      };

      updateGuests();

      const openGuests = () => {
        document.dispatchEvent(new CustomEvent("wl:popover-open", { detail: { source: "guests" } }));
        guestsPopover.hidden = false;
        guestsPopover.classList.add("show");
        guestsTrigger.setAttribute("aria-expanded", "true");
      };

      const closeGuests = () => {
        guestsPopover.hidden = true;
        guestsPopover.classList.remove("show");
        guestsTrigger.setAttribute("aria-expanded", "false");
      };

      // Only one menu is open at a time: opening another one closes this
      document.addEventListener("wl:popover-open", (e) => {
        if (e.detail.source !== "guests" && !guestsPopover.hidden) closeGuests();
      });

      guestsTrigger.addEventListener("click", (e) => {
        e.stopPropagation();
        if (guestsPopover.hidden) {
          openGuests();
        } else {
          closeGuests();
        }
      });

      if (adultsDecBtn) {
        adultsDecBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (adults > 1) {
            adults--;
            chosen = true;
            updateGuests();
          }
        });
      }

      if (adultsIncBtn) {
        adultsIncBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (adults + children < 16) {
            adults++;
            chosen = true;
            updateGuests();
          }
        });
      }

      if (childrenDecBtn) {
        childrenDecBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (children > 0) {
            children--;
            chosen = true;
            updateGuests();
          }
        });
      }

      if (childrenIncBtn) {
        childrenIncBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (adults + children < 16) {
            children++;
            chosen = true;
            updateGuests();
          }
        });
      }

      if (guestsDoneBtn) {
        guestsDoneBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          // Done with no change still means "this many guests", including 1
          chosen = true;
          updateGuests();
          closeGuests();
          guestsTrigger.focus();
        });
      }

      document.addEventListener("click", (e) => {
        if (!guestsPopover.hidden && !guestsPopover.contains(e.target) && !guestsTrigger.contains(e.target)) {
          closeGuests();
        }
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !guestsPopover.hidden) {
          closeGuests();
          guestsTrigger.focus();
        }
      });
    }

    // Smooth pagination: update stays and pagination without jarring full-page reloads
    document.addEventListener("click", async (event) => {
      const link = event.target.closest(".wl-pagination a.page-link, .pagination a.page-link");
      if (!link || !link.href) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const targetUrl = new URL(link.href, window.location.origin);
      if (targetUrl.origin !== window.location.origin) return;

      const targetSection = document.getElementById("explore-stays") || document.querySelector(".wl-featured-section");
      if (!targetSection) return;

      event.preventDefault();
      try {
        targetSection.classList.add("is-loading");
        const res = await fetch(targetUrl.href);
        if (!res.ok) throw new Error("Fetch error");
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        const newSection = doc.getElementById("explore-stays") || doc.querySelector(".wl-featured-section");
        if (newSection) {
          targetSection.innerHTML = newSection.innerHTML;
          window.history.pushState({}, "", targetUrl.href);
          targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          window.location.href = targetUrl.href;
        }
      } catch {
        window.location.href = targetUrl.href;
      } finally {
        if (targetSection) targetSection.classList.remove("is-loading");
      }
    });

    window.addEventListener("popstate", () => {
      window.location.reload();
    });
  });
})();

// One menu at a time across the search bar and the header: Bootstrap menus announce themselves
// like the guest and date popovers do, and an open menu is hidden when another popover opens.
document.addEventListener("show.bs.dropdown", () => {
  document.dispatchEvent(new CustomEvent("wl:popover-open", { detail: { source: "dropdown" } }));
});
document.addEventListener("wl:popover-open", (e) => {
  if (e.detail.source === "dropdown" || !window.bootstrap) return;
  document.querySelectorAll('[data-bs-toggle="dropdown"][aria-expanded="true"]').forEach((toggle) => {
    window.bootstrap.Dropdown.getInstance(toggle)?.hide();
  });
});
