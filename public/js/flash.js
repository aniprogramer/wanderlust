// Success and info messages close after 5 seconds, paused while hovered or focused.
// Errors and warnings stay until the visitor closes them.
(() => {
  const AUTO_DISMISS_MS = 5000;
  const close = (el) => el.remove();

  document.querySelectorAll("[data-flash-close]").forEach((button) => {
    button.addEventListener("click", () =>
      close(button.closest(".wl-flash, .wl-banner")),
    );
  });

  document.querySelectorAll("[data-autodismiss]").forEach((el) => {
    let timer;
    const start = () => {
      timer = setTimeout(() => close(el), AUTO_DISMISS_MS);
    };
    const pause = () => clearTimeout(timer);
    el.addEventListener("mouseenter", pause);
    el.addEventListener("focusin", pause);
    el.addEventListener("mouseleave", () => {
      if (!el.contains(document.activeElement)) start();
    });
    el.addEventListener("focusout", (event) => {
      if (!el.contains(event.relatedTarget) && !el.matches(":hover")) start();
    });
    start();
  });
})();
