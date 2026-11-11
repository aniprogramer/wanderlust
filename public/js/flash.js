// Pop-up notifications (DESIGN 7.13).
// - At most three are visible; the rest wait their turn, so nothing is lost.
// - Success and info close after 5 seconds, paused while hovered or focused.
//   Warnings and errors stay until closed.
// - Escape closes the most recent visible one. Focus is never moved to a pop-up.
// - The email reminder is one more info pop-up (last in the stack), so nothing sits in the page flow.
(() => {
  const AUTO_DISMISS_MS = 5000;
  const MAX_VISIBLE = 3;
  const stack = document.querySelector("[data-toasts]");

  if (!stack) return;

  const timers = new WeakMap();
  const visible = () => [...stack.querySelectorAll("[data-toast]:not([hidden])")];
  const queued = () => [...stack.querySelectorAll("[data-toast][hidden]")];

  const stop = (toast) => {
    clearTimeout(timers.get(toast));
    timers.delete(toast);
  };
  const start = (toast) => {
    stop(toast);
    if (toast.hasAttribute("data-autodismiss"))
      timers.set(toast, setTimeout(() => close(toast), AUTO_DISMISS_MS));
  };
  const close = (toast) => {
    stop(toast);
    toast.remove();
    fill();
  };

  const wire = (toast) => {
    if (toast.dataset.wired) return;
    toast.dataset.wired = "true";
    toast.querySelector("[data-toast-close]")?.addEventListener("click", () => close(toast));
    toast.addEventListener("mouseenter", () => stop(toast));
    toast.addEventListener("focusin", () => stop(toast));
    toast.addEventListener("mouseleave", () => {
      if (!toast.contains(document.activeElement)) start(toast);
    });
    toast.addEventListener("focusout", (event) => {
      if (!toast.contains(event.relatedTarget) && !toast.matches(":hover")) start(toast);
    });
  };

  // Show queued messages while there is room; timers run only while a message is visible
  const started = new WeakSet();
  function fill() {
    stack.querySelectorAll("[data-toast]").forEach(wire);
    // Anything past the limit that arrived visible waits instead
    visible().slice(MAX_VISIBLE).forEach((toast) => {
      stop(toast);
      started.delete(toast);
      toast.hidden = true;
    });
    let room = MAX_VISIBLE - visible().length;
    for (const toast of queued()) {
      if (room <= 0) break;
      toast.hidden = false;
      room -= 1;
    }
    visible().forEach((toast) => {
      if (started.has(toast)) return;
      started.add(toast);
      start(toast);
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const last = visible().pop();
    if (last) close(last);
  });

  new MutationObserver(fill).observe(stack, { childList: true });
  fill();
})();
