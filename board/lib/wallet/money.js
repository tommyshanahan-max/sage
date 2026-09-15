// Money, as whole cents and never as a float.
//
// 0.1 + 0.2 is 0.30000000000000004, and a wallet that adds amounts the way a
// calculator app does loses a cent every few thousand payments and cannot say
// where it went. Every amount in this module is an integer count of the
// currency's smallest unit — cents, fen — and the only place a decimal point
// appears is on the way in from somebody typing and on the way out to a screen.
//
// Every currency the wallet handles today has two decimal places. The table
// still carries `dp` so the one that does not (JPY, KRW) is a row, not a bug.

export const CURRENCIES = {
  EUR: { dp: 2, sym: "€", en: "euros", zh: "欧元" },
  AUD: { dp: 2, sym: "A$", en: "Australian dollars", zh: "澳元" },
  CNY: { dp: 2, sym: "¥", en: "yuan", zh: "元" },
  HKD: { dp: 2, sym: "HK$", en: "Hong Kong dollars", zh: "港元" },
  USD: { dp: 2, sym: "US$", en: "US dollars", zh: "美元" },
};

/* WHERE SOMEBODY LIVES DECIDES MORE THAN THE CURRENCY.
 *
 * `balance: false` for mainland China is the one design decision in this file
 * that is not arithmetic. Holding a stored balance for somebody resident in
 * the mainland is the part of this product most likely to need a licence
 * nobody here has, so a mainland member's wallet is pass-through only: money
 * sent to them is paid straight out to their bank account or UnionPay card,
 * and nothing sits in the Exchange with their name on it.
 *
 * `reasonRequired` because payments into China are checked, and a payment
 * with no stated purpose is the one most likely to be held. Asking the payer
 * at the moment they send costs a line; finding out a day later costs the
 * payment. */
export const REGIONS = {
  FI: { name: "Finland", currency: "EUR", balance: true, reasonRequired: false, send: 200000, recv: 1000000, sca: true },
  AU: { name: "Australia", currency: "AUD", balance: true, reasonRequired: false, send: 300000, recv: 1500000, sca: false },
  CN: { name: "Mainland China", currency: "CNY", balance: false, reasonRequired: true, send: 500000, recv: 2000000, sca: false },
  HK: { name: "Hong Kong", currency: "HKD", balance: true, reasonRequired: false, send: 2000000, recv: 5000000, sca: false },
  US: { name: "United States", currency: "USD", balance: true, reasonRequired: false, send: 250000, recv: 1000000, sca: false },
  OTHER: { name: "Somewhere else", currency: "USD", balance: true, reasonRequired: false, send: 100000, recv: 500000, sca: false },
};

export const isCurrency = (c) => Object.prototype.hasOwnProperty.call(CURRENCIES, c);
export const isRegion = (r) => Object.prototype.hasOwnProperty.call(REGIONS, r);

/** "12.5" or "12.50" or 12.5 → 1250. Anything that is not a plain positive
 *  amount with at most the currency's decimal places is refused, not rounded:
 *  a payment of "1,000" silently read as 1 is worse than an error. */
export function toMinor(input, currency) {
  const { dp } = CURRENCIES[currency] || {};
  if (dp === undefined) return null;
  const s = String(input ?? "").trim();
  const re = new RegExp(`^\\d{1,9}(\\.\\d{1,${dp}})?$`);
  if (!re.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const minor = Number(whole) * 10 ** dp + Number((frac + "0".repeat(dp)).slice(0, dp));
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

/** 1250 → "12.50". */
export function toMajor(minor, currency) {
  const { dp } = CURRENCIES[currency];
  const neg = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 10 ** dp);
  const frac = String(abs % 10 ** dp).padStart(dp, "0");
  return (neg ? "-" : "") + (dp ? `${whole}.${frac}` : String(whole));
}

/** 125000 → "HK$1,250.00". */
export function format(minor, currency) {
  const [w, f] = toMajor(Math.abs(minor), currency).split(".");
  return (minor < 0 ? "−" : "") + CURRENCIES[currency].sym + Number(w).toLocaleString("en-US") + (f ? "." + f : "");
}

/** A percentage of an amount, in basis points, rounded half up to the cent. */
export function bps(minor, basisPoints) {
  return Math.floor((minor * basisPoints + 5000) / 10000);
}

/** Convert with a rate given as a decimal string, rounding down: the person
 *  receiving is never shown a cent the conversion did not produce. */
export function convert(minor, rate, from, to) {
  // BigInt, because a large amount times a rate scaled to eight places runs
  // past the 2^53 where ordinary numbers stop being exact.
  const scale = 100000000n;
  const r = BigInt(Math.round(Number(rate) * 1e8));
  const shift = CURRENCIES[to].dp - CURRENCIES[from].dp;
  const num = BigInt(minor) * r * 10n ** BigInt(Math.max(shift, 0));
  const den = scale * 10n ** BigInt(Math.max(-shift, 0));
  return Number(num / den);
}
