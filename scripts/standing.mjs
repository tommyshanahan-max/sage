/* Who can bring somebody in, and who cannot yet.
 *
 * WHY THIS EXISTS. Standing was put on invitations without anybody being able
 * to see what it did to the people already here, and "it will probably take
 * codes off most of them" is not a thing to deploy on. Every line says whether
 * that person has a code today and, when they do not, every test they are
 * failing — in the words they are seeing on their own screen.
 *
 * NOT A LEAGUE TABLE. It is printed here and nowhere else. Standing is between
 * one person and the door; published on a board where everybody knows each
 * other it would be a ranking, which is the one thing this board has spent its
 * whole life not building.
 *
 *   make standing
 */

const [, , base, key] = process.argv;
if (!base || !key) {
  console.error("usage: standing.mjs <board url> <admin key>");
  process.exit(2);
}

const d = await fetch(base + "/api/standing", { headers: { "x-admin-secret": key } })
  .then((r) => r.json());
const rows = d.rows || [];
if (!rows.length) {
  console.log("Nobody has made a page yet.");
  process.exit(0);
}

/* The same words the member reads, so the table and their screen cannot come
   to different conclusions about the same person. */
const WHY = {
  face: "not in Browse — no name, no face through the queue, or the switch is off",
  days: "here less than three days",
  said: "fewer than two posts, or nothing in the last fortnight",
  guests: "somebody they brought has gone, or their guests never said anything",
  room: "already has three guests in",
};

const pad = (s, n) => String(s).padEnd(n).slice(0, n);
const when = (iso) => String(iso || "").slice(0, 10);

console.log(pad("name", 16) + pad("joined", 12) + pad("posts", 7)
  + pad("guests", 8) + "can invite");
console.log("-".repeat(72));

let can = 0;
for (const r of rows.sort((a, b) => (a.at || "").localeCompare(b.at || ""))) {
  if (r.can) can++;
  console.log(pad(r.handle, 16) + pad(when(r.at), 12) + pad(r.said, 7)
    + pad(r.guests, 8) + (r.can ? "yes" : "no"));
  // Every unmet test, not the first — the same as the screen. A member fixing
  // one of four and finding themselves still refused is how a rule stops being
  // read as a rule.
  for (const k of r.need || []) console.log(pad("", 16) + "  " + (WHY[k] || k));
}

console.log("");
console.log(can + " of " + rows.length + " can bring somebody in today.");
if (can < rows.length) {
  console.log("");
  console.log("Nobody's standing is fixable from here — it is four things they do,");
  console.log("and each one is shown to them under \"An invitation is a vouch\".");
  console.log("A code can still be handed out directly:  make invite WHO=\"their name\"");
}
