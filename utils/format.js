// Whole-unit price in the listing's currency or converted to a target currency.
// e.g. money(2500, "INR") -> "₹2,500".
// e.g. money(2500, "INR", "USD") -> "$30".

const RATES_FROM_INR = {
  INR: 1,
  USD: 1 / 84,
  EUR: 1 / 91,
  GBP: 1 / 107,
  AUD: 1 / 55,
  CAD: 1 / 61,
  JPY: 1.80,
  AED: 1 / 22.9,
};

const convertPrice = (amount, from = "INR", to = "INR") => {
  if (!amount || from === to) return amount;
  const inr = from === "INR" ? amount : amount / (RATES_FROM_INR[from] || 1);
  const converted = inr * (RATES_FROM_INR[to] || 1);
  return Math.round(converted);
};

module.exports.convertPrice = convertPrice;
module.exports.RATES_FROM_INR = RATES_FROM_INR;

module.exports.money = (amount, currency = "INR", targetCurrency) => {
  const displayCurrency = targetCurrency || currency;
  const displayAmount = targetCurrency ? convertPrice(amount, currency, targetCurrency) : amount;
  return new Intl.NumberFormat(displayCurrency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency: displayCurrency,
    maximumFractionDigits: 0,
  }).format(displayAmount);
};
