/* CAN THIS BOARD TAKE A PAYMENT — asked of the box, answered in words.
 *
 * WHY THIS EXISTS. "Can the app do payments" is a question about a running
 * system, and until now the only way to answer it was to read a commit and
 * guess at five environment variables nobody can see. A guess about whether
 * money moves is the worst kind.
 *
 * It prints a verdict first and the reasons under it, because the verdict is
 * the answer and the reasons are what to do about it.
 *
 * NOTHING SECRET COMES BACK. The route reports whether each key is set and
 * which mode the Stripe key's prefix says it is in. Never a key, never a
 * fragment, never anybody's account id.
 *
 *   node scripts/pay-check.mjs <base> <admin-key>
 */
const [base, key] = process.argv.slice(2);
if (!base || !key) { console.error("pay-check.mjs <base> <admin-key>"); process.exit(1); }

const r = await fetch(base.replace(/\/$/, "") + "/api/admin/pay", {
  headers: { "x-admin-secret": key },
});
if (!r.ok) {
  console.error("The board said " + r.status + ". Is TOMSCODING_BOARD_KEY right?");
  process.exit(1);
}
const j = await r.json();

const yes = (b) => (b ? "yes" : "no");
const line = (k, v) => console.log("  " + k.padEnd(26) + v);

console.log("");
console.log(j.takesPayments
  ? "  PAYMENTS ARE ON" + (j.mode === "live" ? "" : " — in " + j.mode + " mode, so no real money moves")
  : "  PAYMENTS ARE OFF");
console.log("");
line("Stripe key", j.key ? "set · " + j.mode : "not set");
line("Publishable key", yes(j.publishable));
line("Webhook secret", yes(j.webhook));
line("API version", j.apiVersion || "not pinned");
line("Fee", j.feePct + "%" + (j.feePage ? ", with a page to pay it on" : ", no page to pay it on"));
line("People set up to be paid", String(j.payees));
line("Deals with a plan", String(j.deals));
if (j.demo) line("Demo stand-in", "ON — the payment screen is a drawing");
console.log("");
if (j.why.length) {
  console.log("  Why not:");
  for (const w of j.why) console.log("    · " + w);
  console.log("");
}
