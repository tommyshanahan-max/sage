/* EVERY OLD 微店 REVIEW ONTO THE MATCHING PRODUCT, IN ONE PASS.
 *
 *   node scripts/weidian-reviews.mjs <base> <admin-key> --file weidian.json [--dry]
 *
 * WHY THIS EXISTS. `weidian-pull` writes one file holding every item and the
 * reviews under it; `review-import` takes ONE product, found by its number in
 * `make catalogue`, and a flat array of rows. Between them sat a join nobody
 * had written: read the file, work out which 微店 item is which board
 * product, build a file per item, run the importer forty times. Forty
 * commands typed by hand, each one with a number in it that has to be right,
 * is the shape of work this box is supposed to delete — so it is one command
 * now and the join happens here.
 *
 * THE JOIN IS BY NAME, AND IT REFUSES RATHER THAN GUESSES. Three passes,
 * each one narrower than a human would accept:
 *   1. the same name, once punctuation and spacing are taken out
 *   2. one name wholly contains the other (爱他美3段 vs 爱他美白金版3段)
 *   3. nothing — it is listed as unmatched and its reviews stay out
 * A wrong match puts somebody's words about infant formula under a jar of
 * honey. That is worse than an empty reviews page, because it is a lie in
 * the one place this shop is asking to be believed, and nobody would ever
 * find it. So a tie between two candidates is also a refusal: if two board
 * products both contain the 微店 name, neither is chosen.
 *
 * NOTHING IS INVENTED. Every row that lands came off his own old shop and is
 * labelled 来自老店（微信店） on the page — see the note over
 * /api/admin/review-add. A product with no reviews on 微店 gets none here.
 *
 * SAFE TO RUN TWICE. review-add drops a review whose words already sit on
 * that product, so a re-run after fixing one name adds only what is new.
 */
import { readFileSync } from "node:fs";

const [base, key, ...rest] = process.argv.slice(2);
if (!base || !key) {
  console.error("weidian-reviews.mjs <base> <admin-key> --file weidian.json [--dry]");
  process.exit(1);
}
const API = base.replace(/\/$/, "");
const arg = (n) => { const i = rest.indexOf("--" + n); return i >= 0 ? String(rest[i + 1] ?? "") : ""; };
const DRY = rest.includes("--dry");

let pulled;
try {
  pulled = JSON.parse(readFileSync(arg("file") || "weidian.json", "utf8"));
} catch (err) {
  console.error("\n  That file would not read: " + err.message
    + "\n  Run `make weidian-pull SHOP=…` first.\n");
  process.exit(1);
}

/* The puller writes items[] with reviews under each, and a flat reviews[]
   carrying `item`. Either shape is accepted: the flat list is what somebody
   hand-editing the file tends to leave behind. */
const byItem = new Map();
for (const it of (pulled.items || [])) {
  if (it?.name && it.reviews?.length) byItem.set(it.name, [...it.reviews]);
}
for (const r of (pulled.reviews || [])) {
  if (!r?.item || !r.text) continue;
  if (!byItem.has(r.item)) byItem.set(r.item, []);
  const have = byItem.get(r.item);
  if (!have.some((x) => x.text === r.text)) have.push(r);
}
if (!byItem.size) {
  console.error("\n  No reviews in that file. `make weidian-json` shows what was read.\n");
  process.exit(1);
}

const list = await fetch(API + "/api/admin/products", { headers: { "x-admin-secret": key } });
const j0 = await list.json().catch(() => null);
if (!list.ok || !j0?.ok) { console.error("\n  the board said " + list.status + "\n"); process.exit(1); }
const products = j0.products || j0.rows || [];
if (!products.length) { console.error("\n  Nothing in the catalogue to match against.\n"); process.exit(1); }

/* Punctuation, spacing and full-width brackets out; case folded. A 微店 name
   and the same thing typed into this board differ by exactly this much far
   more often than they differ by a word. */
const key0 = (s) => String(s || "")
  .replace(/[\s　()（）[\]【】·・,，.。/\\|-]+/g, "")
  .toLowerCase();

function match(name) {
  const k = key0(name);
  if (!k) return { row: null, how: "empty name" };
  const exact = products.filter((p) => key0(p.name) === k || key0(p.en) === k);
  if (exact.length === 1) return { row: exact[0], how: "name" };
  if (exact.length > 1) return { row: null, how: "two products with that name" };
  const part = products.filter((p) => {
    const a = key0(p.name), b = key0(p.en);
    return (a && (a.includes(k) || k.includes(a))) || (b && (b.includes(k) || k.includes(b)));
  });
  if (part.length === 1) return { row: part[0], how: "contains" };
  if (part.length > 1) return { row: null, how: part.length + " products could be it" };
  return { row: null, how: "nothing like it in the catalogue" };
}

let added = 0, sent = 0, done = 0;
const missed = [];

for (const [name, rows] of byItem) {
  const { row, how } = match(name);
  if (!row) { missed.push([name, rows.length, how]); continue; }

  /* stars defaults to 5 — 好评100% is what the old shop actually carried, and
     the puller cannot read a star count off those pages. Said here rather
     than silently: an invented 4 would be worse than an honest 5. */
  const clean = rows
    .filter((r) => r?.text)
    .map((r) => ({ who: r.who || "", stars: Number(r.stars) || 5, text: r.text, at: r.at || "" }));
  if (!clean.length) continue;

  if (DRY) {
    console.log("  " + (row.name || row.id) + "  ←  " + name + "   " + clean.length + " (" + how + ")");
    sent += clean.length;
    done++;
    continue;
  }

  /* Four hundred at a time: five hundred is the cap on one request. */
  for (let i = 0; i < clean.length; i += 400) {
    const r = await fetch(API + "/api/admin/review-add", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-secret": key },
      body: JSON.stringify({ product: row.id, rows: clean.slice(i, i + 400) }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) {
      console.error("\n  " + (row.name || row.id) + ": the board said " + r.status + "\n");
      process.exit(1);
    }
    added += j.added;
  }
  sent += clean.length;
  done++;
  console.log("  " + (row.name || row.id) + "  ←  " + name + "   " + clean.length + " (" + how + ")");
}

console.log("");
console.log("  Products matched  " + done);
console.log("  Reviews " + (DRY ? "ready     " : "added     ")
  + (DRY ? sent : added + " of " + sent)
  + (!DRY && added < sent ? "  (the rest were already there)" : ""));

if (missed.length) {
  console.log("");
  console.log("  NOT MATCHED — their reviews stayed out rather than going somewhere wrong:");
  for (const [name, n, how] of missed) {
    console.log("    " + name.slice(0, 40).padEnd(42) + n + " reviews   " + how);
  }
  console.log("");
  console.log("  Fix by renaming the product on this board to the 微店 name, then run it again.");
}
console.log("");
if (!DRY) console.log("  All of them show 来自老店（微信店）.");
console.log("");
