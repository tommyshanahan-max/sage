/* ONE THING IN THE CATALOGUE.
 *
 *   node scripts/product.mjs <base> <admin-key> --name "…" --price "¥648" \
 *     [--unit "900g *3罐"] [--en "Bellamy Organic Step 3"] [--photo <url>]
 *
 * NAME IS WHAT SHE READS, so it is Chinese with the brand in Latin letters,
 * the way it is written on every shop she has ever used. EN is what a
 * warehouse in Melbourne picks from and what goes on the label.
 */
const [base, key, ...rest] = process.argv.slice(2);
if (!base || !key) { console.error("product.mjs <base> <admin-key> --name … --price ¥648"); process.exit(1); }
const arg = (n) => { const i = rest.indexOf("--" + n); return i >= 0 ? String(rest[i + 1] ?? "") : ""; };

const r = await fetch(base.replace(/\/$/, "") + "/api/admin/product", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-admin-secret": key },
  body: JSON.stringify({
    name: arg("name"), price: arg("price"), unit: arg("unit"),
    en: arg("en"), photo: arg("photo"),
  }),
});
const j = await r.json().catch(() => null);
if (!r.ok || !j?.ok) {
  const said = { price: "That price cannot be read. Write it as ¥648.",
    bad: "Not enough to make a row: a name and a price." }[j?.error]
    || ("the board said " + r.status);
  console.error("\n  " + said + "\n");
  process.exit(1);
}
console.log("");
console.log("  Added. " + j.n + (j.n === 1 ? " thing" : " things") + " in the catalogue.");
console.log("");
console.log("  Every member's shop shows it:");
console.log("    https://thexchange.app/shop/<their handle>");
console.log("");
