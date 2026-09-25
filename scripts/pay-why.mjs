// WHY STRIPE REFUSED ONE PAYMENT, IN STRIPE'S OWN WORDS.
//
//   make pay-why ID="pi_…"
//
// THE DASHBOARD SHOWS "Stripe blocked this payment." AND NOTHING ELSE on the
// page you land on, and the reason is one click further in, on a screen
// nobody can be talked through over a terminal. The charge underneath carries
// it as data: outcome.type says blocked or issuer_declined, outcome.reason
// names the category, and outcome.rule carries the actual predicate when a
// Radar rule is what fired.
//
// RISK LEVEL NORMAL AND BLOCKED IS THE INTERESTING CASE. Radar's own score
// blocks at the top of the range, so Normal plus blocked means a rule did it
// — either one somebody wrote or one Stripe applies to the method. The rule
// is printed here in full, predicate included, because "a rule blocked it" is
// not an answer anybody can act on.
//
// Read-only. One GET. It cannot change anything and is safe against the live
// key, which is the only key whose behaviour is worth knowing.
const KEY = (process.env.BOARD_STRIPE_KEY || "").trim();
const ID = (process.argv[2] || "").trim();

if (!KEY) { console.error("No BOARD_STRIPE_KEY in this container."); process.exit(1); }
if (!/^pi_[A-Za-z0-9]+$/.test(ID)) {
  console.error('  make pay-why ID="pi_…"   — the payment id from the dashboard address bar.');
  process.exit(1);
}

const res = await fetch(
  `https://api.stripe.com/v1/payment_intents/${ID}?expand[]=latest_charge`,
  { headers: { Authorization: "Bearer " + KEY }, signal: AbortSignal.timeout(20_000) },
);
const text = await res.text();
let pi = null;
try { pi = JSON.parse(text); } catch { /* Stripe sent prose */ }
if (!res.ok) {
  console.error(`Stripe: ${res.status} ${pi?.error?.message || text.slice(0, 200)}`);
  process.exit(1);
}

const pad = (s) => (s + " ".repeat(18)).slice(0, 18);
const line = (k, v) => console.log("  " + pad(k) + (v ?? "—"));

console.log("");
line("payment", pi.id);
line("amount", `${(pi.amount / 100).toFixed(2)} ${String(pi.currency).toUpperCase()}`);
line("method", (pi.payment_method_types || []).join(", "));
line("status", pi.status);

/* THE ERROR THE API ITSELF RECORDED, which is where a capability problem
   shows up — a method that is not active fails here rather than reaching a
   charge at all. Its absence is as informative as its contents. */
const e = pi.last_payment_error;
if (e) {
  console.log("");
  line("error type", e.type);
  line("error code", e.code);
  line("decline code", e.decline_code);
  line("message", e.message);
}

const ch = pi.latest_charge;
if (!ch || typeof ch !== "object") {
  console.log("");
  console.log("  No charge was ever created, so nothing was blocked at the charge.");
  console.log("  That points at the payment method itself rather than at a rule.");
  console.log("");
  process.exit(0);
}

const o = ch.outcome || {};
console.log("");
line("outcome", o.type);
line("reason", o.reason);
line("seller message", o.seller_message);
line("risk level", o.risk_level);
line("risk score", o.risk_score === undefined ? null : String(o.risk_score));
line("network status", o.network_status);

/* THE WHOLE POINT OF THIS SCRIPT. A rule is an object with the predicate in
   it, and the predicate is the only part anybody can act on. */
if (o.rule) {
  console.log("");
  console.log("  THE RULE THAT DID IT:");
  if (typeof o.rule === "string") {
    console.log("    " + o.rule + "  (id only — open it in Radar to read the predicate)");
  } else {
    console.log("    action:    " + (o.rule.action || "—"));
    console.log("    predicate: " + (o.rule.predicate || "—"));
    console.log("    id:        " + (o.rule.id || "—"));
  }
  console.log("");
  console.log("  Radar → Rules in the dashboard is where it is turned off.");
} else if (o.type === "blocked") {
  console.log("");
  console.log("  Blocked with no rule attached. That is Stripe blocking the method");
  console.log("  rather than a rule somebody wrote — the account, the method or the");
  console.log("  country, not the payer.");
}
console.log("");
