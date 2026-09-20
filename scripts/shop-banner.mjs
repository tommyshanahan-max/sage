/* THE PICTURE ACROSS THE TOP OF A SHOP, FROM A FILE ON HIS OWN MACHINE.
 *
 *   node scripts/shop-banner.mjs <base> <admin-key> --who Tom < dad.png
 *
 * The bytes arrive on stdin. A picture that is already on the desktop
 * should not need an account somewhere else and a link pasted back — see
 * the note over /api/admin/shop-banner.
 */
const [base, key, ...rest] = process.argv.slice(2);
if (!base || !key) { console.error("shop-banner.mjs <base> <admin-key> --who Tom < dad.png"); process.exit(1); }
const arg = (n) => { const i = rest.indexOf("--" + n); return i >= 0 ? String(rest[i + 1] ?? "") : ""; };
const who = arg("who");

/* Read it all before asking, so a file that is not there fails here
   rather than half way through a request. */
const parts = [];
for await (const chunk of process.stdin) parts.push(chunk);
const body = Buffer.concat(parts);
if (!body.length) {
  console.error("\n  Nothing came down the pipe. The command ends with  < dad.png\n");
  process.exit(1);
}

const r = await fetch(base.replace(/\/$/, "") + "/api/admin/shop-banner?who=" + encodeURIComponent(who), {
  method: "POST",
  headers: { "Content-Type": "application/octet-stream", "x-admin-secret": key },
  body,
});
const j = await r.json().catch(() => null);
if (!r.ok || !j?.ok) {
  const said = {
    kind: "That file is not a picture this board can serve. JPEG, PNG, GIF or WebP.",
    empty: "Nothing came down the pipe. The command ends with  < dad.png",
  }[j?.error] || (String(j?.error || "").startsWith("not on this board")
    ? "Not on this board: " + who + ". `make who` has the handles."
    : (r.status === 413 ? "That picture is over 25MB." : "the board said " + r.status));
  console.error("\n  " + said + "\n");
  process.exit(1);
}
console.log("");
console.log("  " + (j.name || who) + "'s shop has its picture.");
console.log("    " + Math.round(j.bytes / 1024) + "KB, " + j.kind.replace("image/", "").toUpperCase());
console.log("");
console.log("  Open it:");
console.log("    https://thexchange.app/shop/" + encodeURIComponent(who));
console.log("");
