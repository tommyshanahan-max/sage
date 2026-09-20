/* A PICTURE ON ONE THING, FROM A FILE ON HIS OWN MACHINE.
 *
 *   node scripts/product-photo.mjs <base> <admin-key> --n 1 < tin.jpg
 *
 * N is the number beside it in `make catalogue`. The bytes arrive on stdin
 * — a photograph already on the desktop should not need an account
 * somewhere else and a link pasted back. See /api/admin/product-photo.
 */
const [base, key, ...rest] = process.argv.slice(2);
if (!base || !key) { console.error("product-photo.mjs <base> <admin-key> --n 1 < tin.jpg"); process.exit(1); }
const API = base.replace(/\/$/, "");
const arg = (n) => { const i = rest.indexOf("--" + n); return i >= 0 ? String(rest[i + 1] ?? "") : ""; };

const n = Number(arg("n"));
if (!Number.isInteger(n) || n < 1) { console.error("\n  --n is the number beside it in `make catalogue`.\n"); process.exit(1); }

const parts = [];
for await (const chunk of process.stdin) parts.push(chunk);
const body = Buffer.concat(parts);
if (!body.length) {
  console.error("\n  Nothing came down the pipe. The command ends with  < tin.jpg\n");
  process.exit(1);
}

const l = await fetch(API + "/api/admin/products", { headers: { "x-admin-secret": key } });
const j0 = await l.json().catch(() => null);
if (!l.ok || !j0?.ok) { console.error("\n  the board said " + l.status + "\n"); process.exit(1); }
const row = (j0.products || [])[n - 1];
if (!row) { console.error("\n  There is no " + n + " in the catalogue.\n"); process.exit(1); }

const r = await fetch(API + "/api/admin/product-photo?id=" + encodeURIComponent(row.id), {
  method: "POST",
  headers: { "Content-Type": "application/octet-stream", "x-admin-secret": key },
  body,
});
const j = await r.json().catch(() => null);
if (!r.ok || !j?.ok) {
  console.error("\n  " + ({
    kind: "That file is not a picture this board can serve. JPEG, PNG, GIF or WebP.",
    empty: "Nothing came down the pipe. The command ends with  < tin.jpg",
  }[j?.error] || (r.status === 413 ? "That picture is over 25MB." : "the board said " + r.status)) + "\n");
  process.exit(1);
}
console.log("");
console.log("  " + (j.name || row.name));
console.log("    " + Math.round(j.bytes / 1024) + "KB, " + j.kind.replace("image/", "").toUpperCase());
console.log("");
