/* TWO ROWS, ONE TIN: MOVE THE WORDS, THEN RETIRE THE ROW.
 *
 *   node scripts/review-move.mjs <base> <admin-key> --from <id> --to <id> [--keep]
 *
 * The import added a second row for a product already on the shelf, because
 * it read the 微店 name in English and the catalogue is written in Chinese.
 * Taking the spare row off would take its reviews with it — the reviews page
 * lists only products on the shelf — so the reviews move first.
 *
 * --keep leaves the emptied row on the shelf. Without it, the row is taken
 * off, which is what "these are the same tin" usually means.
 */
const [base, key, ...rest] = process.argv.slice(2);
if (!base || !key) { console.error("review-move.mjs <base> <admin-key> --from <id> --to <id> [--keep]"); process.exit(1); }
const arg = (n) => { const i = rest.indexOf("--" + n); return i >= 0 ? String(rest[i + 1] ?? "") : ""; };
const from = arg("from"), to = arg("to");
if (!from || !to) { console.error("\n  --from and --to are product ids. `make catalogue` prints them.\n"); process.exit(1); }

const r = await fetch(base.replace(/\/$/, "") + "/api/admin/review-move", {
  method: "POST",
  headers: { "content-type": "application/json", "x-admin-secret": key },
  body: JSON.stringify({ from, to, retire: !rest.includes("--keep") }),
});
const j = await r.json().catch(() => null);
if (!r.ok || !j?.ok) { console.error("\n  " + (j?.error || "the board said " + r.status) + "\n"); process.exit(1); }
console.log(`\n  ${j.moved} reviews moved\n    from  ${j.from}\n    to    ${j.to}`);
console.log(j.retired ? "  and the row they left is off the shelf.\n" : "  and the row they left is still on the shelf.\n");
