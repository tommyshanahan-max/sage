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
/* --add creates the products the 微店 shop has and this board does not. See
   the long note over add(). Never implied by --dry, which writes nothing. */
const ADD = rest.includes("--add") && !DRY;
/* --photos: put the right picture over the wrong one. See fillPhoto(). */
const REPHOTO = rest.includes("--photos") && !DRY;
/* --names: give a row carrying an English name the Chinese one off 微店.
   One direction only — see where it is used. */
const RENAME = rest.includes("--names") && !DRY;

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
/* The price and picture travel beside the reviews, for --add below. Kept
   separately so the review path is untouched when nothing is being created. */
const meta = new Map();
for (const it of (pulled.items || [])) {
  if (it?.name && it.reviews?.length) {
    byItem.set(it.name, [...it.reviews]);
    meta.set(it.name, { price: it.price || "", photo: it.photo || "" });
  }
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
/* ROWS THAT ARE OFF THE SHOPFRONT ARE NOT CANDIDATES.
 *
 * /api/admin/products returns everything, `off` rows included — it is the
 * admin view, and that is correct for it. This read the lot, so after
 * `catalogue-tidy` took two of three duplicate 爱他美金装 3段 off the shelf,
 * the matcher still saw three, called it a tie and refused the reviews. The
 * tidy had worked; the reader had not.
 *
 * It would also have been wrong on its own terms: /api/shop/:handle/reviews
 * builds its list from products with !off, so a review filed against a
 * retired row is a review nobody can ever read. */
const all0 = j0.products || j0.rows || [];
const products = all0.filter((p) => !p.off);
if (!products.length) {
  console.error("\n  Nothing in the catalogue to match against"
    + (all0.length ? ` (${all0.length} rows, all off the shopfront)` : "") + ".\n");
  process.exit(1);
}
if (all0.length !== products.length) {
  console.log(`  ${products.length} on the shelf, ${all0.length - products.length} taken off — matching against the ${products.length}.`);
}

/* Punctuation, spacing and full-width brackets out; case folded. A 微店 name
   and the same thing typed into this board differ by exactly this much far
   more often than they differ by a word. */
const key0 = (s) => String(s || "")
  .replace(/[\s　()（）[\]【】·・,，.。/\\|-]+/g, "")
  .toLowerCase();

/* THE SCRAPED NAME CARRIES THE DESCRIPTION WITH IT.
   The item page has no clean title element, so the puller comes back with
   "贝拉米 有机婴儿米粉\n\nBellamy's 贝拉米 婴幼儿有机米粉（4个月以上）" — the
   name, then the first line of the blurb. Flattened, that is one long key
   that no board product is a substring of, and nine real reviews were
   refused against a product that is plainly on the shelf. The first line is
   the name; everything after the first newline is prose. Both are tried,
   because a shop whose titles happen to be clean loses nothing by it. */
/* THE NAME, WITHOUT THE BLURB THAT FOLLOWS IT.
   Splitting on a newline was right for the pages that have one and did
   nothing for the pages that do not — those run the description straight on
   from the name, and fourteen products went onto a live shelf reading
   "Nature's Way … 180 tablets Nature's Way Children's brain fish oil, is
   specially designed for…". The seam is where the brand comes back, which is
   how these blurbs open; below sixteen characters the cut is refused, because
   "Bellamy's 4+" says less about the jar than the long name does. Same rule
   as scripts/product-names.mjs, which repairs the ones already written. */
const head = (s) => {
  const line = String(s || "").split("\n")[0].trim();
  const first = line.split(/\s+/)[0] || "";
  const stem = first.replace(/[\u2019'`]s$/i, "").replace(/[^\p{L}\p{N}]/gu, "");
  if (stem.length >= 3) {
    const re = new RegExp(stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu");
    for (const m of line.matchAll(re)) {
      if (m.index > 12) {
        const cut = line.slice(0, m.index).trim().replace(/[,\uFF0C\u3001\-\u2013\u2014]$/, "").trim();
        if (cut.length >= 16) return cut;
        break;
      }
    }
  }
  return line;
};

/* THE REVIEWS ARE THE JOIN, WHEN THE NAMES HAVE STOPPED AGREEING.
 *
 * The first import created fourteen rows named off an English rendering of
 * the 微店 pages. The puller now reads the Chinese title, which is right —
 * and means a scraped item no longer matches the very row it created, so
 * nothing matched, no picture was written, and fourteen products sat on the
 * shopfront wearing 微店's logo through three separate attempts to fix it.
 *
 * But those rows are already carrying that item's reviews, word for word:
 * `review-add` dropped the duplicates, so a review's text is effectively a
 * key. One review in common is an exact identification — nobody writes the
 * same sentence about two different tins — and it survives any amount of
 * renaming in either catalogue.
 *
 * Built once, lazily, and only when a name has already failed: on a shop
 * whose names line up this costs nothing. */
let byText = null;
async function learnReviews() {
  byText = new Map();
  for (const p of products) {
    try {
      const r = await fetch(API + "/api/product/" + encodeURIComponent(p.id) + "/reviews",
        { headers: { "x-admin-secret": key } });
      const j = await r.json().catch(() => null);
      for (const row of (j?.rows || [])) {
        if (row?.text && !byText.has(row.text)) byText.set(row.text, p);
      }
    } catch { /* a product whose reviews will not load simply teaches nothing */ }
  }
}
async function byReview(rows) {
  if (!byText) await learnReviews();
  const hit = new Map();
  for (const r of rows) {
    const p = r?.text && byText.get(r.text);
    if (p) hit.set(p.id, (hit.get(p.id) || 0) + 1);
  }
  if (hit.size !== 1) return null;   /* two products share these words: refuse */
  const [id] = [...hit.keys()];
  return products.find((p) => p.id === id) || null;
}

function match(name) {
  const keys = [...new Set([key0(name), key0(head(name))])].filter(Boolean);
  if (!keys.length) return { row: null, how: "empty name" };
  for (const k of keys) {
    const exact = products.filter((p) => key0(p.name) === k || key0(p.en) === k);
    if (exact.length === 1) return { row: exact[0], how: "name" };
    if (exact.length > 1) return { row: null, how: "two products with that name" };
  }
  for (const k of keys) {
    const part = products.filter((p) => {
      const a = key0(p.name), b = key0(p.en);
      return (a && (a.includes(k) || k.includes(a))) || (b && (b.includes(k) || k.includes(b)));
    });
    if (part.length === 1) return { row: part[0], how: "contains" };
    if (part.length > 1) return { row: null, how: part.length + " products could be it" };
  }
  return { row: null, how: "nothing like it in the catalogue" };
}

let added = 0, sent = 0, done = 0;
const missed = [];

/* --add: PUT THE THING ON THE SHELF, THEN ITS REVIEWS ON THE THING.
 *
 * Every review was being refused and the refusals were all correct: the 微店
 * shop carries far more than the eight products listed here, and the items
 * that have reviews are ones nobody has added yet. "Products matched 0" was
 * the honest answer to a question nobody wanted asked — there was no fault
 * left to fix, only a catalogue to fill.
 *
 * So this creates the missing row from what the pull already read: the name
 * (first line, not the blurb), the 微店 price, and the 微店 photograph. They
 * are his own products at his own prices off his own shop, which is why this
 * is defensible at all — nothing here is invented.
 *
 * BEHIND A FLAG, AND IT WILL ALWAYS BE BEHIND A FLAG. It puts live rows on a
 * storefront that takes money, priced in yuan off another platform. That is
 * a commercial decision and not one a review importer gets to make quietly.
 * An item with no price is skipped rather than guessed at: a product with
 * the wrong number on it is worse than a product that is not there. */
async function add(name) {
  const m = meta.get(name) || {};
  const price = String(m.price || "").trim();
  if (!price) return { row: null, how: "no price on the 微店 page — not added" };
  const post = (photo) => fetch(API + "/api/admin/product", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-secret": key },
    body: JSON.stringify({ name: head(name), price, photo }),
  }).then(async (r) => ({ r, j: await r.json().catch(() => null) }));

  let { r, j } = await post(m.photo || "");
  /* A PICTURE THAT WILL NOT FETCH IS NOT A REASON TO LOSE THE PRODUCT.
     /api/admin/product fetches the image before writing the row and refuses
     the whole thing with {error:"photo"} when it cannot — which is right for
     somebody adding one product by hand, and wrong here: it would drop a
     real product and its real reviews because a CDN in Shanghai did not
     answer a box in Tokyo. The shopfront already draws a named card where a
     picture is missing (see .noimg in shop.html), so a row without one is a
     shelf that still reads. The picture can be added later; the reviews
     cannot be re-scraped for free. */
  if (!r.ok && j?.error === "photo" && m.photo) {
    ({ r, j } = await post(""));
    if (r.ok && j?.ok) return { row: { id: j.id, name: head(name) }, how: "added, without its picture" };
  }
  if (!r.ok || !j?.ok) {
    /* The board's own words, because "price" and "photo" are the two it
       refuses on and both are things the pull may have read badly. */
    return { row: null, how: "could not add it: " + (j?.error || r.status) };
  }
  return { row: { id: j.id, name: head(name) }, how: "added to the shop" };
}

/* A PRODUCT THAT MATCHED BUT HAS NO PICTURE, WHEN 微店 HAS ONE.
 *
 * The shopfront draws a named card where a photograph is missing, and that
 * card is deliberate — but a shelf of them is still a shop with no pictures
 * on it, and the pictures exist: the pull reads one per item and we are
 * already holding it. Tom saw the first product on his own shopfront as a
 * blank square for exactly this reason.
 *
 * ONLY INTO AN EMPTY SLOT. It never replaces a photograph somebody chose —
 * `photo` comes back from the admin list as a Boolean, so "has one" is the
 * only question asked, and a product that has one is left alone. A failure
 * here is a shrug: the reviews are the job, and a missing picture is not a
 * reason to fail the row that carries them. */
async function fillPhoto(row, name) {
  const m = meta.get(name) || {};
  /* PHOTOS=1 REPLACES, the plain run only fills.
     Normally a photograph somebody chose is never overwritten. But fourteen
     products were given the 微店 logo by a bad selector in the puller, and
     without a way to put a better one over the top the only remedy would be
     retiring the row — which takes its reviews with it. So the override
     exists, and it is a flag rather than the default. */
  if (!m.photo) return "";
  if (row.photo && !REPHOTO) return "";
  try {
    const r = await fetch(API + "/api/admin/product/" + encodeURIComponent(row.id), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-secret": key },
      body: JSON.stringify({ photo: m.photo }),
    });
    const j = await r.json().catch(() => null);
    return (r.ok && j?.ok) ? "  + picture" : "";
  } catch { return ""; }
}

for (const [name, rows] of byItem) {
  let { row, how } = match(name);
  /* Before creating anything: is this item's row already here under a name
     that no longer matches? Its own reviews will say so. Checked ahead of
     --add, because adding a second row for a tin already on the shelf is the
     failure this is here to undo. */
  if (!row) {
    const known = await byReview(rows);
    if (known) { row = known; how = "found by its own reviews"; }
  }
  if (!row && ADD && how === "nothing like it in the catalogue") {
    ({ row, how } = await add(name));
  }
  if (!row) { missed.push([name, rows.length, how]); continue; }
  /* Newly added rows already carry their picture from add(); this is for the
     ones that were here first and never had one. */
  if (!DRY && (row.photo === false || REPHOTO)) how += await fillPhoto(row, name);

  /* AND THE NAME, WHEN THE ROW IS CARRYING AN ENGLISH ONE.
     The first import named fourteen rows off an English rendering — "A 2 New
     Zealand formula milk powder 1 paragraph", which is 1段 through a
     translator — on a shopfront every one of whose buyers is Chinese. Those
     rows can only be found now by their reviews, and once found the proper
     Chinese name is sitting right here in the scrape.
     Behind NAMES=1, and only in one direction: an English row takes a
     Chinese name, never the reverse. A row somebody named themselves is not
     something an importer gets to overwrite because it looked at a web
     page. */
  if (!DRY && RENAME && /[\u4e00-\u9fff]/.test(head(name)) && !/[\u4e00-\u9fff]/.test(row.name || "")) {
    try {
      const r = await fetch(API + "/api/admin/product/" + encodeURIComponent(row.id), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": key },
        body: JSON.stringify({ name: head(name) }),
      });
      if (r.ok) { row.name = head(name); how += ", renamed"; }
    } catch { /* a rename that fails leaves the English name, which is what was there */ }
  }

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
    console.log("    " + head(name).slice(0, 40).padEnd(42) + n + " reviews   " + how);
  }
  /* WHAT IT WAS MATCHING AGAINST, said in the same breath.
     "nothing like it in the catalogue" named the 微店 side and not ours, so
     the one fact needed to act on it — what this board calls that product —
     meant a second command and another round trip. Both sides, one screen. */
  console.log("");
  console.log("  What is on this board to match against:");
  products.forEach((p, i) => {
    console.log("    " + String(i + 1).padStart(3) + "  " + (p.name || "—")
      + (p.en ? "   (" + p.en + ")" : ""));
  });
  /* Only commands that exist. An earlier draft of this line offered
     `make shop-rename`, which is not a target on this box — there is no way
     to edit a product's name today, only to add one. Pointing somebody at a
     command that does not exist is worse than pointing at nothing. */
  console.log("");
  console.log("  The names have to line up. If the thing is not on this board yet:");
  console.log("    make product NAME=\"<the 微店 name>\" PRICE=\"¥199\"");
  console.log("  and if it is there under another name, that name is the one to change.");
}
console.log("");
if (!DRY) console.log("  All of them show 来自老店（微信店）.");
console.log("");
