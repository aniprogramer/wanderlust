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
  });
})();
