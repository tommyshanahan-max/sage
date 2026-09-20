/* A REVIEW FROM THE OLD WECHAT STORE.
 *
 *   node scripts/review-add.mjs <base> <admin-key> --n 1 --stars 5 \
 *     --who "李娜" --text "…" [--photo <url>] [--at 2024-03-11]
 *
 * --n is the number beside the thing in `make catalogue`.
 *
 * IT IS LABELLED ON THE PAGE, 来自老店. The reviews written on this board
 * are worth reading because an order nobody can fake stands behind them;
 * one typed in here has nothing behind it but Tom's word. Saying so is what
 * keeps the others worth anything.
 */
const [base, key, ...rest] = process.argv.slice(2);
if (!base || !key) { console.error('review-add.mjs <base> <admin-key> --n 1 --text "…"'); process.exit(1); }
const API = base.replace(/\/$/, "");
const arg = (n) => { const i = rest.indexOf("--" + n); return i >= 0 ? String(rest[i + 1] ?? "") : ""; };

const n = Number(arg("n"));
if (!Number.isInteger(n) || n < 1) { console.error("\n  --n is the number beside it in `make catalogue`.\n"); process.exit(1); }

const list = await fetch(API + "/api/admin/products", { headers: { "x-admin-secret": key } });
const j0 = await list.json().catch(() => null);
if (!list.ok || !j0?.ok) { console.error("\n  the board said " + list.status + "\n"); process.exit(1); }
const row = (j0.products || j0.rows || [])[n - 1];
if (!row) { console.error("\n  There is no " + n + " in the catalogue. `make catalogue` lists them.\n"); process.exit(1); }

const r = await fetch(API + "/api/admin/review-add", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-admin-secret": key },
  body: JSON.stringify({
    product: row.id, stars: arg("stars") || 5, who: arg("who"),
    text: arg("text"), photo: arg("photo"), at: arg("at"),
  }),
});
const j = await r.json().catch(() => null);
if (!r.ok || !j?.ok) {
  console.error("\n  " + (j?.error === "bad"
    ? "Not enough to make a review: a thing and something said about it."
    : "the board said " + r.status) + "\n");
  process.exit(1);
}
console.log("");
console.log("  Added to " + (row.name || ("#" + n)) + ".");
console.log("  " + j.n + (j.n === 1 ? " review" : " reviews") + " on it now.");
console.log("  Shown as 来自老店 — it is not tied to an order here.");
console.log("");
