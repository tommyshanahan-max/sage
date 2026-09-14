/* Who is in which layer.
 *
 * WHY IT IS WORTH A COMMAND. The arrival number is stamped once, in the order
 * of the date on each person's row, and it is never recomputed — a layer that
 * moves because a record ahead of somebody was deleted is worth nothing. The
 * cost of that is a mistake being permanent: a card written late for somebody
 * who was here from the beginning carries a late date, and they land in the
 * wrong band for good.
 *
 * So this prints the small layers by name. Reading "the first three" back as
 * three people you recognise is the only check there is, and the only moment
 * it is cheap to do is before anybody has been told.
 *
 *   make layers
 */

const [, , base, key] = process.argv;
if (!base || !key) {
  console.error("usage: layers.mjs <board url> <admin key>");
  process.exit(2);
}

const r = await fetch(base + "/api/layers", { headers: { "x-admin-secret": key } });
const d = await r.json().catch(() => ({}));
console.log("");
if (!r.ok) { console.log("  That did not go through."); console.log(""); process.exit(1); }

const NAMES = {
  l1: "The first three", l2: "The first hundred", l3: "The first thousand",
  l4: "The first four thousand", l5: "The first ten thousand",
  l6: "The last ten thousand",
};
const n = (v) => Number(v).toLocaleString("en");

console.log("  " + n(d.people) + (d.people === 1 ? " person in" : " people in")
  + ", of " + n(d.cap) + " places.");
console.log("");

for (const l of d.layers || []) {
  const open = d.now && d.now.key === l.key;
  const head = "  " + NAMES[l.key].padEnd(26)
    + (l.in ? n(l.in) + " of " + n(l.places) : "empty").padEnd(16)
    + (open ? n(d.now.left) + " places left" : l.in >= l.places ? "full" : "");
  console.log(head.trimEnd());
  /* The names, indented under the band they are in. Only where the server sent
     them — past a hundred a list is a thing you scroll, not a thing you check. */
  if (l.who && l.who.length) {
    for (const w of l.who) console.log("      " + w);
    console.log("");
  }
}

if (!d.now) {
  console.log("");
  console.log("  Every layer is full. Nobody arriving now is in one.");
}
console.log("");
/* Said every time rather than once, because the whole reason to run this is to
   catch an order that is wrong, and the window for that closes quietly. */
console.log("  The order comes from the date on each person's row, and it is");
console.log("  stamped once. Nobody moves after this.");
console.log("");
