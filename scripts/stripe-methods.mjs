/* WHICH PAYMENT METHODS THIS PLATFORM CAN ACTUALLY OFFER — ASKED OF STRIPE.
 *
 * WHY THIS EXISTS. The whole product is two wallets, and whether they are on
 * was a question answered by clicking around a dashboard: an Active list on
 * one page, truncated behind "View more", with WeChat Pay and Alipay not in
 * the visible half. That is exactly the shape of thing this box is not
 * allowed to hand anybody — and it is a screen, so it cannot be read back,
 * pasted, or checked by anything.
 *
 * IT ASKS THE PLATFORM AND NOT A MERCHANT, and that is the point. The charge
 * lib/stripe.js builds is a DESTINATION charge — created on this platform
 * with transfer_data.destination — and Stripe's rule for those is that the
 * platform's payment method configuration decides what can be offered. The
 * merchant's own settings do not come into it, which is why a screen telling
 * them to go and switch WeChat Pay on was removed. So this one account's
 * answer is the answer for every payment the product will ever take.
 *
 * TWO DIFFERENT NOS, AND THE FIRST ONE IS NOT A REFUSAL. `available: false`
 * means the method is not available to this account YET. `value: "off"` is a
 * switch that is simply not flipped. They read alike and mean entirely
 * different days' work, so they are printed as different words.
 *
 * THE FIRST VERSION OF THIS PRINTED "Stripe will not give this account the
 * method", and that was a sentence this script cannot say. The dashboard for
 * the same account, the same minute, showed WeChat Pay and Alipay as
 * **Pending approval** — applied for, waiting on Stripe, which is the
 * opposite conclusion. The API field does not carry the difference between
 * pending and refused; only Settings → Payment methods does. So this says
 * what it knows and names the page that knows the rest.
 *
 * NOTHING SECRET COMES BACK and nothing is written: one GET, and the key
 * comes through the environment rather than argv, which is visible in `ps`.
 *
 *   BOARD_STRIPE_KEY=… node scripts/stripe-methods.mjs
 */
const KEY = (process.env.BOARD_STRIPE_KEY || "").trim();
if (!KEY) {
  console.error("\n  BOARD_STRIPE_KEY is not set, so there is nobody to ask.\n");
  process.exit(1);
}
const VERSION = (process.env.BOARD_STRIPE_VERSION || "").trim();

/* The three the product offers, in the order the payer meets them. Card is
   here because it is the fallback the payer page draws beside the two
   wallets, and a platform with only card is a different product. */
const WANT = [
  ["wechat_pay", "WeChat Pay"],
  ["alipay", "Alipay"],
  ["card", "Card"],
];

const res = await fetch("https://api.stripe.com/v1/payment_method_configurations", {
  headers: {
    Authorization: "Bearer " + KEY,
    ...(VERSION ? { "Stripe-Version": VERSION } : {}),
  },
  signal: AbortSignal.timeout(20_000),
});
const text = await res.text();
let j = null;
try { j = text ? JSON.parse(text) : null; } catch { /* Stripe sent prose */ }
if (!res.ok) {
  /* Stripe's own sentence, which names the thing it disliked. A status code
     on its own is the answer thrown away. */
  console.error("\n  Stripe said " + res.status + ":");
  console.error("  " + (j?.error?.message || text.slice(0, 300)) + "\n");
  process.exit(1);
}

const configs = Array.isArray(j?.data) ? j.data : [];
const mode = /^sk_live/.test(KEY) ? "live" : /^sk_test/.test(KEY) ? "test" : "unknown";

console.log("");
if (!configs.length) {
  console.log("  This account has no payment method configurations at all.");
  console.log("  Nothing can be offered to a payer until it has one.");
  console.log("");
  process.exit(0);
}

for (const c of configs) {
  const name = c.name || c.id;
  console.log("  " + name + (c.is_default ? "  (the default)" : "") + " · " + mode);
  for (const [key, label] of WANT) {
    const m = c[key];
    /* A method Stripe does not mention at all is not the same as one it
       mentions and refuses, and saying "off" for both would hide the
       difference that matters. */
    const say = !m ? "not offered on this account"
      : m.available === false ? "NOT YET — Stripe has not made it available to this account"
      : m.display_preference?.value === "on" ? "on"
      : "off — available, not switched on";
    console.log("    " + label.padEnd(12) + " " + say);
  }
  console.log("");
}

/* THE SENTENCE THAT MATTERS, SAID ONCE, ABOUT THE DEFAULT CONFIGURATION —
   because that is the one a charge uses when nothing names another. */
const def = configs.find((c) => c.is_default) || configs[0];
const live = (key) => {
  const m = def?.[key];
  return Boolean(m && m.available !== false && m.display_preference?.value === "on");
};
const wallets = ["wechat_pay", "alipay"].filter(live);
console.log(wallets.length === 2
  ? "  BOTH WALLETS ARE ON. A payer in WeChat can pay."
  : wallets.length === 1
  ? "  ONLY ONE WALLET IS ON (" + wallets[0].replace("_", " ") + "). Half the payers cannot pay."
  : "  NEITHER WALLET IS ON. Nobody in China can pay through this platform.");
/* AND WHETHER THAT IS TEMPORARY IS NOT IN THIS ANSWER. "Not yet" covers an
   application Stripe is still reading and one it has turned down, and those
   are a week apart in what they mean. Naming the page rather than guessing. */
if (["wechat_pay", "alipay"].some((k) => def?.[k]?.available === false)) {
  console.log("");
  console.log("  NOT YET is either pending approval or refused, and this cannot");
  console.log("  tell them apart. Settings \u2192 Payment methods says which.");
}
console.log("");
