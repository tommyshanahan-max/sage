/* THE NAME WITH ITS OWN DESCRIPTION RUN ONTO THE END OF IT.
 *
 *   node scripts/product-names.mjs <base> <admin-key> [--go]
 *   node scripts/product-names.mjs <base> <admin-key> --id <id> --name "…"
 *
 * The 微店 import took each item's name off a page with no clean title
 * element, so fourteen products went onto the shelf reading
 *
 *   Nature's Way Jiasi children's brain fish oil 180 tablets Nature's Way
 *   Children's brain fish oil, is specially designed for children's brain
 *
 * — the name, then the blurb, with no newline between them to cut at.
 *
 * THE CUT IS WHERE THE BRAND COMES BACK. These blurbs open by repeating the
 * brand ("… 180 tablets **Nature's Way** Children's brain …"), which is the
 * one reliable seam in them: a second occurrence of the first word, far
 * enough in to be a repeat rather than part of the name itself. Anything
 * without that seam is left alone and listed, because a name cut in the wrong
 * place is worse than a long one — it can say the wrong thing about what is
 * in the tin.
 *
 * NOTHING IS WRITTEN WITHOUT --go, and every proposal is printed first.
 */
const [base, key, ...rest] = process.argv.slice(2);
if (!base || !key) { console.error('product-names.mjs <base> <admin-key> [--go] | --id <id> --name "…"'); process.exit(1); }
const API = base.replace(/\/$/, "");
const arg = (n) => { const i = rest.indexOf("--" + n); return i >= 0 ? String(rest[i + 1] ?? "") : ""; };
const go = rest.includes("--go");

const head = { "x-admin-secret": key, "content-type": "application/json" };
const rename = async (id, name) => {
  const r = await fetch(`${API}/api/admin/product/${encodeURIComponent(id)}`, {
    method: "POST", headers: head, body: JSON.stringify({ name }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.error || "the board said " + r.status);
  return j.name;
};

/* One by hand, for whatever the seam cannot do. */
if (arg("id")) {
  const name = arg("name");
  if (!name) { console.error("\n  --name is what it should say.\n"); process.exit(1); }
  console.log("\n  " + await rename(arg("id"), name) + "\n");
  process.exit(0);
}

const list = await fetch(API + "/api/admin/products", { headers: head });
const j = await list.json().catch(() => null);
if (!list.ok || !j?.ok) { console.error("\n  the board said " + list.status + "\n"); process.exit(1); }
const products = (j.products || j.rows || []).filter((p) => !p.off);

/** Where the blurb starts: the brand said a second time. */
function seam(name) {
  const n = String(name || "").trim();
  const first = n.split(/\s+/)[0];
  if (!first || first.length < 3) return "";
  /* Past the first 12 characters, so a two-word brand does not match itself,
     and matched loosely because the repeat is often possessive: Bellamy /
     Bellamy's, Nature's Way / Nature's. */
  const stem = first.replace(/[’'`]s$/i, "").replace(/[^\p{L}\p{N}]/gu, "");
  if (stem.length < 3) return "";
  const re = new RegExp(stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu");
  for (const m of n.matchAll(re)) {
    if (m.index > 12) return n.slice(0, m.index).trim().replace(/[,，、\-–—]$/, "").trim();
  }
  return "";
}

const jobs = [];
const left = [];
for (const p of products) {
  if (String(p.name).length <= 40) continue;
  const cut = seam(p.name);
  /* A CUT SHORTER THAN THIS IS NOT A NAME. "Bellamy's 4+ Bellamy Baby
     Organic Mango Blueberry Apple Puree" cuts at the second Bellamy and
     leaves "Bellamy's 4+", which says nothing about what is in the jar — a
     worse row than the long one. Sixteen characters is where the real cuts
     in this shop sit and the bad one does not. */
  if (cut && cut.length >= 16 && cut.length < String(p.name).length) jobs.push({ p, cut });
  else left.push(p);
}

console.log("");
for (const { p, cut } of jobs) {
  console.log("  " + String(p.name).slice(0, 72));
  console.log("    -> " + cut);
}
if (left.length) {
  console.log("\n  Left alone, no seam to cut at — rename by hand if they read badly:");
  for (const p of left) console.log("    " + p.id + "  " + String(p.name).slice(0, 64));
}
if (!jobs.length) { console.log("\n  Nothing to shorten.\n"); process.exit(0); }
if (!go) { console.log(`\n  ${jobs.length} would be shortened. Run with GO=1 to write them.\n`); process.exit(0); }

let done = 0;
for (const { p, cut } of jobs) {
  try { await rename(p.id, cut); done++; } catch (err) { console.error("  " + p.id + ": " + err.message); }
}
console.log(`\n  ${done} renamed.\n`);
