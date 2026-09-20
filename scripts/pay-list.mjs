/* THE TRANSFERS TO MAKE BY HAND, ONE SCREEN, LARGEST FIRST.
 *
 *   node scripts/pay-list.mjs <base> <admin-key>
 *
 * Everybody running a storefront is in mainland China, and Airwallex will
 * not take a yuan beneficiary yet — note 2 in providers/airwallex.js. So
 * until it does, a representative is paid by one transfer each, off this.
 *
 * IT PRINTS CARD NUMBERS. That is the point of it: a list without the
 * number is a list that sends somebody back to a filing cabinet. It answers
 * to the admin key, on the box, into his own terminal, and nowhere else.
 */
const [base, key] = process.argv.slice(2);
if (!base || !key) { console.error("pay-list.mjs <base> <admin-key>"); process.exit(1); }

const r = await fetch(base.replace(/\/$/, "") + "/api/admin/pay-list", {
  headers: { "x-admin-secret": key },
});
const j = await r.json().catch(() => null);
if (!r.ok || !j?.ok) { console.error("\n  the board said " + r.status + "\n"); process.exit(1); }

console.log("");
if (!j.rows.length) {
  console.log("  Nothing is owed to anybody.\n");
  process.exit(0);
}

/* Grouped in fours down the screen rather than across it: a card number and
   an amount side by side on one line is the thing that gets misread. */
for (const row of j.rows) {
  console.log("  " + row.amount);
  if (row.ready) {
    console.log("    " + (row.name || row.shop));
    console.log("    " + (row.bank || "—"));
    if (row.card) console.log("    " + row.card.replace(/(.{4})/g, "$1 ").trim());
  } else {
    console.log("    " + row.shop + " — no card yet. Send them:");
    console.log("    https://thexchange.app/paid");
  }
  console.log("");
}
console.log("  Sent one? Mark it:  make paid-out WHO=\"" + (j.rows[0].shop || "Tom") + "\"");
console.log("");
