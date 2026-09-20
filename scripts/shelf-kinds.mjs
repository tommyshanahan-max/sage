/* PUT WHAT IS ALREADY IN THE CATALOGUE ONTO SHELVES.
 *
 *   node scripts/shelf-kinds.mjs <base> <admin-key>
 *
 * A one-off, for rows that were added before `kind` existed. New ones are
 * given a shelf when they are added — see `make product KIND=`.
 *
 * MATCHED ON THE NAME, which is guessing, which is why this is a one-off
 * and not how the field is normally set. It prints what it decided and
 * leaves anything it is unsure about alone, because a wrong shelf is worse
 * than no shelf: she taps 奶粉 and does not find the milk powder.
 */
const [base, key] = process.argv.slice(2);
if (!base || !key) { console.error("shelf-kinds.mjs <base> <admin-key>"); process.exit(1); }
const API = base.replace(/\/$/, "");

const RULES = [
  [/益生菌|probiotic/i, "益生菌"],
  [/爱他美|aptamil|贝拉米|bellamy|奶粉|karicare|a2/i, "奶粉"],
  [/swisse|blackmores|维生素|鱼油|钙|vitamin|fish oil/i, "保健品"],
];

const r0 = await fetch(API + "/api/admin/products", { headers: { "x-admin-secret": key } });
const j0 = await r0.json().catch(() => null);
if (!r0.ok || !j0?.ok) { console.error("\n  the board said " + r0.status + "\n"); process.exit(1); }

console.log("");
let n = 0;
for (const p of (j0.products || [])) {
  if (p.kind) { console.log("  " + (p.kind + "").padEnd(6) + p.name + "   (already)"); continue; }
  const hit = RULES.find(([re]) => re.test(p.name + " " + (p.en || "")));
  if (!hit) { console.log("  " + "—".padEnd(6) + p.name + "   (left alone — give it one with make product-kind)"); continue; }
  const r = await fetch(API + "/api/admin/product/" + p.id, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-secret": key },
    body: JSON.stringify({ kind: hit[1] }),
  });
  if (!r.ok) { console.log("  " + "!".padEnd(6) + p.name + "   (the board said " + r.status + ")"); continue; }
  console.log("  " + hit[1].padEnd(6) + p.name);
  n += 1;
}
console.log("");
console.log("  " + n + (n === 1 ? " shelved." : " shelved."));
console.log("");
