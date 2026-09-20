/* WHAT A SHOP ROW ACTUALLY HOLDS.
 *
 *   node scripts/shop-check.mjs <base> <admin-key> --who Tom
 *
 * Two questions that were being answered as one: what is stored, and
 * whether the picture behind it is still on disk.
 */
const [base, key, ...rest] = process.argv.slice(2);
if (!base || !key) { console.error("shop-check.mjs <base> <admin-key> --who Tom"); process.exit(1); }
const arg = (n) => { const i = rest.indexOf("--" + n); return i >= 0 ? String(rest[i + 1] ?? "") : ""; };
const who = arg("who");

const r = await fetch(base.replace(/\/$/, "") + "/api/admin/shop-check?who=" + encodeURIComponent(who),
  { headers: { "x-admin-secret": key } });
const j = await r.json().catch(() => null);
if (!r.ok || !j?.ok) {
  console.error("\n  " + (j?.error || ("the board said " + r.status)) + "\n");
  process.exit(1);
}
const line = (k, v, note) => console.log("    " + k.padEnd(10) + (v || "—") + (note ? "   " + note : ""));
console.log("");
console.log("  " + j.handle);
line("Name", j.name);
line("WeChat", j.wechat);
line("Banner", j.banner ? "set" : "", j.banner ? j.bannerFile : "");
line("Your photo", j.photo ? "set" : "", j.photo ? j.photoFile : "");
line("Contact QR", j.qr ? "set" : "", j.qr ? j.qrFile : "");
line("Card", j.payout ? "on file" : "");
line("Assistant", j.ai ? "on" : "off");
console.log("");
