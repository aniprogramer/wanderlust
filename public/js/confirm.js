// Forms with data-confirm ask before submitting.
document.addEventListener("submit", (event) => {
  const message = event.target.dataset?.confirm;
  if (message && !confirm(message)) event.preventDefault();
});
