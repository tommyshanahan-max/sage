/* THE CATALOGUE, AND A PICTURE ON ONE OF IT.
 *
 *   node scripts/catalogue.mjs <base> <admin-key>
 *   node scripts/catalogue.mjs <base> <admin-key> --n 2 --url https://…
 *   node scripts/catalogue.mjs <base> <admin-key> --n 2 --out 1   (sold out)
 *   node scripts/catalogue.mjs <base> <admin-key> --n 2 --off 1   (off the shop)
 *
 * A row number, not an id — the same rule as make ship, for the same reason.
 * The list is re-read inside the command, so the number means what it just
 * printed.
 */
const [base, key, ...rest] = process.argv.slice(2);
if (!base || !key) { console.error("catalogue.mjs <base> <admin-key>"); process.exit(1); }
const arg = (n) => { const i = rest.indexOf("--" + n); return i >= 0 ? String(rest[i + 1] ?? "") : ""; };
const API = base.replace(/\/$/, "");

const r0 = await fetch(API + "/api/admin/products", { headers: { "x-admin-secret": key } });
const j0 = await r0.json().catch(() => null);
if (!r0.ok || !j0?.ok) { console.error("\n  the board said " + r0.status + "\n"); process.exit(1); }
const list = j0.products;

const n = arg("n");
if (n) {
  const p = list[Number(n) - 1];
  if (!p) { console.error("\n  There is no " + n + " in the catalogue.\n"); process.exit(1); }
  const body = {};
  if (arg("url")) body.photo = arg("url");
  if (rest.includes("--out")) body.out = arg("out") !== "0";
  if (rest.includes("--off")) body.off = arg("off") !== "0";
  if (arg("kind")) body.kind = arg("kind");
  if (!Object.keys(body).length) {
    console.error('\n  … --n ' + n + ' --url "https://…"\n');
    process.exit(1);
  }
  const r = await fetch(API + "/api/admin/product/" + p.id, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-secret": key },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) {
    console.error("\n  " + (j?.error === "photo"
      ? "That picture could not be fetched. It has to be a plain image address ending .jpg or .png, reachable without a login."
      : (j?.error || r.status)) + "\n");
    process.exit(1);
  }
  console.log("\n  " + j.name + (j.photo ? " — picture saved." : " — changed.") + "\n");
  process.exit(0);
}

console.log("");
if (!list.length) {
  console.log("  Nothing in the catalogue yet.");
  console.log('    make product NAME="Bellamy 贝拉米3段 900g" PRICE="¥648"');
  console.log("");
  process.exit(0);
}
list.forEach((p, i) => {
  const flags = [p.photo ? "" : "no picture", p.out ? "sold out" : "", p.off ? "off the shop" : ""]
    .filter(Boolean).join(", ");
  console.log("  " + String(i + 1).padStart(2) + ".  " + p.price.padStart(8) + "   " + p.name);
  if (p.unit || p.en) console.log("       " + [p.unit, p.en].filter(Boolean).join("  ·  "));
  if (flags) console.log("       " + flags);
});
console.log("");
console.log("  To put a picture on the first one:");
console.log('    make photo N=1 URL="https://…/tin.jpg"');
console.log("");
