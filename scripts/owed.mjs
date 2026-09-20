/* WHAT EACH SHOPFRONT HAS EARNED, and what has not been sent on yet.
 *
 *   node scripts/owed.mjs <base> <admin-key>
 *
 * Nothing here pays anybody. Until Airwallex confirms this account can send
 * a transfer at all — make payout-try — a list that is honest about being a
 * list beats a button that fails on somebody else's phone.
 */
const [base, key] = process.argv.slice(2);
if (!base || !key) { console.error("owed.mjs <base> <admin-key>"); process.exit(1); }
const r = await fetch(base.replace(/\/$/, "") + "/api/admin/owed", {
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
