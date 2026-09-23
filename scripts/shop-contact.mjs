/* HOW A BUYER REACHES THE PERSON WHO SOLD IT TO HER.
 *
 *   node scripts/shop-contact.mjs <base> <admin-key> --who Mei \
 *     [--wechat meimei_au] [--qr <url>] [--weidian <url>] [--ai 1|0]
 *
 * 联系店家 is on every Chinese shop she has used, bottom left beside the buy
 * button. It is WeChat: an id she can search, or a code she can long press.
 * Not a message box on a web page — adding somebody on WeChat is the gesture
 * she already makes.
 *
 * The code is fetched onto this board rather than linked, like every other
 * picture here: a contact code that has rotted is a shop nobody can reach.
 */
const [base, key, ...rest] = process.argv.slice(2);
if (!base || !key) { console.error("shop-contact.mjs <base> <admin-key> --who Mei --wechat id"); process.exit(1); }
const arg = (n) => { const i = rest.indexOf("--" + n); return i >= 0 ? String(rest[i + 1] ?? "") : ""; };

const who = arg("who");
const body = { who };
/* Sent only when given, so setting a code does not wipe an id. */
if (rest.includes("--wechat")) body.wechat = arg("wechat");
if (arg("qr")) body.qr = arg("qr");
/* The old 微店 shop's address. Beside the WeChat id because it is the same
   fact — where this shop was before it was here — and it is what the 老店
   page sends a buyer to check. */
if (rest.includes("--weidian")) body.weidian = arg("weidian");
if (rest.includes("--ai")) body.ai = arg("ai") === "1";

const r = await fetch(base.replace(/\/$/, "") + "/api/admin/shop-contact", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-admin-secret": key },
  body: JSON.stringify(body),
});
const j = await r.json().catch(() => null);
if (!r.ok || !j?.ok) {
  const said = j?.error === "photo"
    ? "That code would not come down. Check the link opens in a browser."
    : (String(j?.error || "").startsWith("not on this board")
      ? "Not on this board: " + who + ". `make who` has the handles."
      : "the board said " + r.status);
  console.error("\n  " + said + "\n");
  process.exit(1);
}
console.log("");
console.log("  " + who + " can be contacted.");
console.log("    WeChat    " + (j.wechat || "—"));
console.log("    QR code   " + (j.qr ? "on this board" : "—"));
console.log("    微店      " + (j.weidian || "—"));
console.log("    Assistant " + (j.ai ? "on" : "off"));
console.log("");
