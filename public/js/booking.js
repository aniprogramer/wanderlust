(() => {
  const form = document.getElementById("booking-form");
  if (!form || !window.flatpickr) return;

  const booked = new Set(JSON.parse(form.dataset.booked));
  const price = Number(form.dataset.price);
  const money = new Intl.NumberFormat(
    form.dataset.currency === "INR" ? "en-IN" : "en-US",
    {
      style: "currency",
      currency: form.dataset.currency,
      maximumFractionDigits: 0,
    },
  );
  // By name: the form also holds the hidden _csrf input
  const checkIn = form.elements["booking[checkIn]"];
  const checkOut = form.elements["booking[checkOut]"];
  const summary = document.getElementById("booking-summary");
  const reserve = document.getElementById("reserve-btn");
  const fmt = (d) => flatpickr.formatDate(d, "Y-m-d");

  // Every night in [from, to) must be free; the checkout day itself may be booked.
  const hasBookedNight = (from, to) => {
    for (const d = new Date(from); d < to; d.setDate(d.getDate() + 1)) {
      if (booked.has(fmt(d))) return true;
    }
    return false;
  };

  const reset = (message = "") => {
    checkIn.value = checkOut.value = "";
    summary.textContent = message;
    if (reserve) reserve.disabled = true;
  };

  const picker = flatpickr("#date-range", {
    mode: "range",
    inline: true,
    // The server's UTC "today", so the calendar and the booking rules agree on the date
    minDate: form.dataset.today,
    // Booked nights cannot be picked at all; hasBookedNight below stays as a safety net
    disable: [...booked],
    dateFormat: "Y-m-d",
    showMonths: window.innerWidth >= 768 ? 2 : 1,
    onDayCreate: (_dates, _str, _fp, el) => {
      if (booked.has(fmt(el.dateObj))) el.classList.add("booked");
    },
    onChange: ([from, to]) => {
      if (!to) return reset();
      const nights = Math.round((to - from) / 864e5);
      if (nights < 1 || hasBookedNight(from, to)) {
        picker.clear();
        return reset(
          "Those dates include unavailable nights. Please choose again.",
        );
      }
      checkIn.value = fmt(from);
      checkOut.value = fmt(to);
      summary.textContent = `${nights} night${nights > 1 ? "s" : ""} · ${money.format(nights * price)}`;
      if (reserve) reserve.disabled = false;
    },
  });
})();
