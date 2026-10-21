// Flash alerts close themselves after 3 seconds.
document.querySelectorAll("[data-autodismiss]").forEach((el) => {
  setTimeout(() => bootstrap.Alert.getOrCreateInstance(el).close(), 3000);
});
