/* A SHOP'S NAME AND THE PICTURE ACROSS THE TOP OF IT.
 *
 *   node scripts/shop-brand.mjs <base> <admin-key> --who Tom \
 *     [--name "澳洲爸爸汤姆"] [--banner <url>]
 *
 * WHO is the handle the person chose on the board, not how they were
 * described in chat — a wrong one comes back as "Not on this board" and
 * looks like the person is missing when they are not. `make who` knows.
 *
 * NAME IS THE NAME SHE READS, so it is Chinese. Nothing else goes on a
 * storefront: no badge, no "official partner". Those are claims about
 * somebody else's relationship and this trade punishes them hardest.
 */
const [base, key, ...rest] = process.argv.slice(2);
if (!base || !key) { console.error("shop-brand.mjs <base> <admin-key> --who Tom"); process.exit(1); }
const arg = (n) => { const i = rest.indexOf("--" + n); return i >= 0 ? String(rest[i + 1] ?? "") : ""; };

const who = arg("who");
const body = { who };
/* Sent only when given, so setting a banner does not wipe a name, and
   setting a name does not wipe the banner. */
if (rest.includes("--name")) body.name = arg("name");
if (arg("banner")) body.banner = arg("banner");

const r = await fetch(base.replace(/\/$/, "") + "/api/admin/shop-brand", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-admin-secret": key },
  body: JSON.stringify(body),
});
const j = await r.json().catch(() => null);
if (!r.ok || !j?.ok) {
  const said = j?.error === "photo"
    ? "That picture would not come down. Check the link opens in a browser."
    : (String(j?.error || "").startsWith("not on this board")
      ? "Not on this board: " + who + ". `make who` has the handles."
      : "the board said " + r.status);
  console.error("\n  " + said + "\n");
  process.exit(1);
}
console.log("");
console.log("  " + (j.name || who) + "'s shop is dressed.");
console.log("    " + (j.name ? "Name    " + j.name : "Name    — (still the handle)"));
console.log("    " + (j.banner ? "Banner  on this board" : "Banner  — (none yet)"));
console.log("");
console.log("  Open it:");
console.log("    https://thexchange.app/shop/" + encodeURIComponent(who));
console.log("");
