/* SIX HUNDRED REVIEWS FROM THE OLD WECHAT STORE, IN ONE GO.
 *
 *   node scripts/review-import.mjs <base> <admin-key> --n 1 --file rows.json
 *
 * The file is a JSON array, one object per review:
 *
 *   [ { "who": "李娜", "stars": 5, "text": "…", "at": "2024-11-02" }, … ]
 *
 * `who` and `at` may be missing. `stars` defaults to 5, which is what a
 * store with 好评100% actually had.
 *
 * SAFE TO RUN TWICE. The same words on the same thing are the same review
 * and the second one is dropped — imports get re-run, and six hundred of
 * somebody else's sentences cannot be eyeballed for duplicates afterwards.
 *
 * Every one of them is labelled 来自老店 on the page. See the note over
 * /api/admin/review-add for why that label is not optional.
 */
import { readFileSync } from "node:fs";

const [base, key, ...rest] = process.argv.slice(2);
if (!base || !key) { console.error("review-import.mjs <base> <admin-key> --n 1 --file rows.json"); process.exit(1); }
const API = base.replace(/\/$/, "");
const arg = (n) => { const i = rest.indexOf("--" + n); return i >= 0 ? String(rest[i + 1] ?? "") : ""; };

const n = Number(arg("n"));
if (!Number.isInteger(n) || n < 1) { console.error("\n  --n is the number beside it in `make catalogue`.\n"); process.exit(1); }

let rows;
try {
  rows = JSON.parse(readFileSync(arg("file"), "utf8"));
} catch (err) {
  console.error("\n  That file would not read: " + err.message + "\n");
  process.exit(1);
}
if (!Array.isArray(rows) || !rows.length) {
  console.error("\n  The file should be a JSON array of reviews, and it is empty.\n");
  process.exit(1);
}

const list = await fetch(API + "/api/admin/products", { headers: { "x-admin-secret": key } });
const j0 = await list.json().catch(() => null);
if (!list.ok || !j0?.ok) { console.error("\n  the board said " + list.status + "\n"); process.exit(1); }
const row = (j0.products || j0.rows || [])[n - 1];
if (!row) { console.error("\n  There is no " + n + " in the catalogue.\n"); process.exit(1); }

/* In batches, because five hundred is the cap on one request and six
   hundred is what he has. */
let added = 0, total = 0;
for (let i = 0; i < rows.length; i += 400) {
  const r = await fetch(API + "/api/admin/review-add", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-secret": key },
    body: JSON.stringify({ product: row.id, rows: rows.slice(i, i + 400) }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) { console.error("\n  the board said " + r.status + "\n"); process.exit(1); }
  added += j.added;
  total = j.n;
}

console.log("");
console.log("  " + (row.name || ("#" + n)));
console.log("    Added     " + added + " of " + rows.length
  + (added < rows.length ? "  (the rest were already there)" : ""));
console.log("    On it now " + total);
console.log("");
console.log("  All of them show 来自老店（微信店）.");
console.log("");
