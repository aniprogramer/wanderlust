// Whole-unit price in the listing's currency, e.g. money(2500, "INR") -> "₹2,500".
module.exports.money = (amount, currency = "INR") =>
  new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
