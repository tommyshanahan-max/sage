/* WHAT EACH SHOPFRONT HAS EARNED, and what has not been sent on yet.
 *
 *   node scripts/owed.mjs <base> <admin-key>
 *
 * Nothing here pays anybody. Until Airwallex confirms this account can send
 * a transfer at all — make payout-try — a list that is honest about being a
 * list beats a button that fails on somebody else's phone.
 */
const [base, key, ...rest] = process.argv.slice(2);
if (!base || !key) { console.error("owed.mjs <base> <admin-key>"); process.exit(1); }
const API = base.replace(/\/$/, "");

/* --pay sends what is owed before printing the list, so the list that comes
   back is what is still outstanding rather than what was a moment ago. */
if (rest.includes("--pay")) {
  const r0 = await fetch(API + "/api/admin/pay-owed", {
    method: "POST", headers: { "x-admin-secret": key, "Content-Type": "application/json" },
    body: "{}",
  });
  const j0 = await r0.json().catch(() => null);
  if (!r0.ok || !j0?.ok) { console.error("\n  the board said " + r0.status + "\n"); process.exit(1); }
  console.log("");
  if (!j0.tried.length) console.log("  Nothing was owed.");
  for (const t of j0.tried) {
    const why = {
      nowhere: "they have not said where their money goes",
      byhand: "a Chinese card — make pay-list, and send it yourself",
      failed: "the transfer would not go — usually the money has not settled yet",
      refused: "the bank refused it",
      quote: "no rate came back",
    }[t.why] || t.why;
    console.log("  " + (t.ok ? "sent  " : "held  ") + t.amount.padStart(10) + "  " + t.shop
      + (t.ok ? "" : "   — " + why));
  }
}

const r = await fetch(API + "/api/admin/owed", {
  headers: { "x-admin-secret": key },
});
const j = await r.json().catch(() => null);
if (!r.ok || !j?.ok) { console.error("\n  the board said " + r.status + "\n"); process.exit(1); }

console.log("");
if (!j.rows.length) {
  console.log("  Nobody has sold anything yet.\n");
  process.exit(0);
}
console.log("  Commission is " + j.pct + "% of the goods, never the postage.");
console.log("");
for (const row of j.rows) {
  console.log("  " + row.shop.padEnd(14) + row.owed.padStart(10)
    + "   " + row.orders + (row.orders === 1 ? " order" : " orders")
    + (row.paidOut ? "   (" + row.paidOut + " already sent)" : ""));
}
console.log("");
