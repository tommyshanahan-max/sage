/* THE SAME THING THREE TIMES IS NOT THREE THINGS.
 *
 *   node scripts/catalogue-tidy.mjs <base> <admin-key> [--go]
 *
 * scripts/shelf-mei.sh got run more than once and the shop ended up with
 * every product on it two and three times. A shopfront with the same tin
 * in it three times does not read as a big shop, it reads as a broken one.
 *
 * PRINTS FIRST, CHANGES ON --go. Anything that takes rows off a live shop
 * should be readable before it is run.
 *
 * WHICH ONE IT KEEPS: the one with a picture, and the earliest of those —
 * a duplicate that somebody attached a photograph to is the one that has
 * had work done on it.
 *
 * It does not delete. `off` takes a row off the shopfront and leaves it in
 * the file, so an order that already points at it still reads.
 */
const [base, key, ...rest] = process.argv.slice(2);
if (!base || !key) { console.error("catalogue-tidy.mjs <base> <admin-key> [--go]"); process.exit(1); }
const API = base.replace(/\/$/, "");
const go = rest.includes("--go");

const r0 = await fetch(API + "/api/admin/products", { headers: { "x-admin-secret": key } });
const j0 = await r0.json().catch(() => null);
if (!r0.ok || !j0?.ok) { console.error("\n  the board said " + r0.status + "\n"); process.exit(1); }

const live = (j0.products || []).filter((p) => !p.off);
const by = new Map();
for (const p of live) {
  const k = String(p.name || "").trim();
  if (!by.has(k)) by.set(k, []);
  by.get(k).push(p);
}

const drop = [];
for (const [name, rows] of by) {
  if (rows.length < 2) continue;
  /* The one with a picture, earliest first — the API returns them oldest
     first, so the first match is the earliest. */
  const keep = rows.find((p) => p.photo) || rows[0];
  for (const p of rows) if (p !== keep) drop.push({ name, p });
}

console.log("");
if (!drop.length) {
  console.log("  Nothing is on the shop twice.\n");
  process.exit(0);
}
for (const [name, rows] of by) {
  if (rows.length < 2) continue;
  console.log("  " + name);
  console.log("    " + rows.length + " copies — keeping the "
    + (rows.find((p) => p.photo) ? "one with a picture" : "first")
    + ", taking " + (rows.length - 1) + " off");
}
console.log("");
if (!go) {
  console.log("  Nothing changed. Run it again with PLEASE=1 to do it.");
  console.log("");
  process.exit(0);
}
let n = 0;
for (const { p } of drop) {
  const r = await fetch(API + "/api/admin/product/" + p.id, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-secret": key },
    body: JSON.stringify({ off: true }),
  });
  if (r.ok) n += 1;
}
console.log("  " + n + " taken off. " + (live.length - n) + " left on the shop.");
console.log("");
