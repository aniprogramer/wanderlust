(() => {
  const form = document.getElementById("booking-form");
  if (!form || !window.flatpickr) return;

  const booked = new Set(JSON.parse(form.dataset.booked));
  const price = Number(form.dataset.price);
  const cleaningFee = Number(form.dataset.cleaningFee) || 0;
  const minNights = Number(form.dataset.minNights) || 1;
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
  const breakdown = document.getElementById("booking-breakdown");
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
    breakdown.hidden = true;
    breakdown.replaceChildren();
    if (reserve) reserve.disabled = true;
  };

  const addLine = (label, value, cls) => {
    const row = document.createElement("div");
    if (cls) row.className = cls;
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    row.append(dt, dd);
    breakdown.append(row);
  };

  const showPrice = (nights) => {
    const subtotal = nights * price;
    const total = subtotal + cleaningFee;
    const word = nights > 1 ? "nights" : "night";
    summary.textContent = `${nights} ${word} · ${money.format(total)}`;
    breakdown.replaceChildren();
    addLine(`${money.format(price)} × ${nights} ${word}`, money.format(subtotal));
    if (cleaningFee) addLine("Cleaning fee", money.format(cleaningFee));
    addLine(
      "Total, paid at the property",
      money.format(total),
      "wl-breakdown__total",
    );
    breakdown.hidden = false;
  };

  const picker = flatpickr("#date-range", {
    mode: "range",
    inline: true,
    // The server's "today", so the calendar and the booking rules agree on the date
    minDate: form.dataset.today,
    // Booked nights cannot be picked at all; hasBookedNight below stays as a safety net
    disable: [...booked],
    dateFormat: "Y-m-d",
    // The panel fits one month; two would overflow it
    showMonths: form.clientWidth >= 620 ? 2 : 1,
    onDayCreate: (_dates, _str, _fp, el) => {
      if (booked.has(fmt(el.dateObj))) el.classList.add("booked");
      // Tell assistive tech what the styling says: these days cannot be chosen
      if (el.classList.contains("flatpickr-disabled")) {
        el.setAttribute("aria-disabled", "true");
      }
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
      if (nights < minNights) {
        picker.clear();
        return reset(`This stay has a minimum of ${minNights} nights.`);
      }
      checkIn.value = fmt(from);
      checkOut.value = fmt(to);
      showPrice(nights);
      if (reserve) reserve.disabled = false;
    },
  });
})();
