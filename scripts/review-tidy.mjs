/* TAKE THE ROWS THAT ARE NOT REVIEWS BACK OFF THE PAGE.
 *
 *   node scripts/review-tidy.mjs <base> <admin-key> [--go]
 *
 * The 微店 import reads blocks off a page, and a page carries more than
 * reviews: the reviewer's own masked name, the specification line under the
 * stars. Without --go it only says what it would take.
 *
 * IMPORTED ROWS ONLY. A review written against a real order here is somebody's
 * words about a parcel they received; the server refuses to touch one, and so
 * does this.
 */
const [base, key, ...rest] = process.argv.slice(2);
if (!base || !key) { console.error("review-tidy.mjs <base> <admin-key> [--go]"); process.exit(1); }
const go = rest.includes("--go");

const r = await fetch(base.replace(/\/$/, "") + "/api/admin/review-tidy", {
  method: "POST",
  headers: { "content-type": "application/json", "x-admin-secret": key },
  body: JSON.stringify({ go }),
});
const j = await r.json().catch(() => null);
if (!r.ok || !j?.ok) {
  console.error("\n  " + (j?.error || "the board said " + r.status) + "\n");
  process.exit(1);
}

if (!go) {
  console.log(`\n  ${j.would} rows would go, ${j.kept} would stay.\n`);
  for (const t of j.sample) console.log("    " + JSON.stringify(t));
  console.log(j.would ? "\n  Run it with GO=1 to take them off.\n" : "\n  Nothing to tidy.\n");
} else {
  console.log(`\n  ${j.removed} taken off, ${j.kept} left.\n`);
}
