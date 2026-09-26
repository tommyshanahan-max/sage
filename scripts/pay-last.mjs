/* WHY STRIPE TURNED THE LAST FEW PAYMENTS DOWN, IN STRIPE'S OWN WORDS.
 *
 * WHY THIS EXISTS. On 24 Sep a payment reached Stripe's own form on a phone
 * — live keys, CN¥31.00, Alipay chosen, everything this product is for — and
 * came back with four words inside Stripe's frame: "The payment attempt
 * failed." Nothing else. Not on the page, not in the container's log, not in
 * `make pay-why`, because nothing of ours was involved: Stripe asked Alipay
 * and Alipay said no.
 *
 * The reason exists, on a dashboard page, behind a payment id somebody has to
 * find and click. That is a screen, and a screen is the thing this box is not
 * allowed to hand anybody. So it is asked for.
 *
 * WHAT IT PRINTS. The last few payment intents with what happened to each and
 * `last_payment_error.message`, which is the sentence the dashboard shows.
 * The decline code beside it when there is one — `payment_intent_payment_
 * attempt_failed` and a wallet refusing a specific customer are different
 * days' work.
 *
 * NOTHING SECRET COMES BACK and nothing is written: one GET, and the key
 * comes through the environment rather than argv, which is visible in `ps`.
 *
 *   BOARD_STRIPE_KEY=… node scripts/pay-last.mjs [how many]
 */
const KEY = (process.env.BOARD_STRIPE_KEY || "").trim();
if (!KEY) {
  console.error("\n  BOARD_STRIPE_KEY is not set, so there is nobody to ask.\n");
  process.exit(1);
}
const N = Math.min(Math.max(Number(process.argv[2]) || 5, 1), 20);
const mode = /^[sr]k_live/.test(KEY) ? "live" : /^[sr]k_test/.test(KEY) ? "test" : "unknown";

const res = await fetch(
  "https://api.stripe.com/v1/payment_intents?limit=" + N,
  { headers: { Authorization: "Bearer " + KEY }, signal: AbortSignal.timeout(20_000) },
);
const text = await res.text();
let j = null;
try { j = text ? JSON.parse(text) : null; } catch { /* Stripe sent prose */ }
if (!res.ok) {
  console.error("\n  Stripe said " + res.status + ":");
  console.error("  " + (j?.error?.message || text.slice(0, 300)) + "\n");
  process.exit(1);
}

const rows = Array.isArray(j?.data) ? j.data : [];
console.log("");
if (!rows.length) {
  console.log("  Stripe has no payments on this account at all (" + mode + ").");
  console.log("");
  process.exit(0);
}
console.log("  THE LAST " + rows.length + " PAYMENTS STRIPE WAS ASKED FOR   (" + mode + ")");
console.log("");

const money = (a, c) => (a == null ? "?" : (a / 100).toFixed(2) + " " + String(c || "").toUpperCase());
for (const p of rows) {
  const when = new Date((p.created || 0) * 1000).toISOString().replace("T", " ").slice(0, 16);
  /* The wallet that was actually chosen, not the list that was offered — a
     payment offered three ways and refused on one is a different fact. */
  const how = (p.payment_method_types || []).join(",");
  console.log("  " + when + "   " + money(p.amount, p.currency).padEnd(12) + how);
  console.log("      " + (p.status || "?"));
  const err = p.last_payment_error;
  if (err) {
    /* STRIPE'S SENTENCE, WHOLE. A status on its own is the answer thrown
       away: "requires_payment_method" is true of a card with no money on it
       and of a wallet that will never take this account, and those are a
       minute and a fortnight apart. */
    console.log("      " + (err.message || "(no message)"));
    const codes = [err.code, err.decline_code, err.type].filter(Boolean);
    if (codes.length) console.log("      " + codes.join(" · "));
  }
  console.log("");
}
console.log("  succeeded            the money moved.");
console.log("  requires_payment_method   it was attempted and refused — the line above says why.");
console.log("  requires_action      it was handed to the wallet and nobody finished it there.");
console.log("");
