/* Why two people cannot talk.
 *
 * A match is three tests, and somebody can pass two of them and see nothing at
 * all. There is no screen that says which one failed, and there should not be:
 * the honest screen for it would be a screen about somebody else's settings.
 * So it is asked for here.
 *
 * Every line says what is true and, where it is not, what would have to change
 * and WHO would have to change it. Half the answers are the other person's to
 * make, which is the point — knowing that is the difference between waiting
 * and sending them a message.
 *
 *   make pair A="Tom" B="Hugo"
 */

const [, , base, key, ...rest] = process.argv;
const arg = (n) => { const i = rest.indexOf("--" + n); return i >= 0 ? rest[i + 1] : ""; };
const A = arg("a"), B = arg("b");
if (!base || !key || !A || !B) {
  console.error('usage: pair.mjs <board url> <admin key> --a "Name" --b "Name"');
  process.exit(2);
}

const r = await fetch(base + "/api/pair?a=" + encodeURIComponent(A) + "&b=" + encodeURIComponent(B),
  { headers: { "x-admin-secret": key } });
const d = await r.json().catch(() => ({}));
if (!r.ok) {
  if (d.error === "who") {
    console.error("No page on this board under: " + (d.missing || []).join(", "));
    console.error("Names are the ones on their profile. See them all with:  make who");
  } else console.error("That did not go through.");
  process.exit(1);
}

const yes = (b) => (b ? "yes" : "NO");
const line = (label, ok, fix) => {
  console.log("  " + (ok ? "✓ " : "✗ ") + label + "  " + yes(ok));
  if (!ok && fix) console.log("      " + fix);
};

console.log("");
console.log(d.a.name + "  ↔  " + d.b.name);
console.log("-".repeat(60));
console.log("");
console.log("  " + d.a.name + ": " + (d.a.rooms.length ? d.a.rooms.join(", ") : "no rooms")
  + "   in " + d.a.where + ", wants " + d.a.wants);
console.log("  " + d.b.name + ": " + (d.b.rooms.length ? d.b.rooms.join(", ") : "no rooms")
  + "   in " + d.b.where + ", wants " + d.b.wants);
console.log("");

/* THE ORDER IS THE ORDER THEY BITE, and the first false one is the answer.
   Printing all four anyway, because "which of these am I one away from" is the
   next question every single time. */
line("both follow each other — " + d.a.name + " → " + d.b.name,
  d.aFollowsB, d.a.name + " taps Follow on " + d.b.name + "'s card in Browse.");
line("both follow each other — " + d.b.name + " → " + d.a.name,
  d.bFollowsA, d.b.name + " has to do this themselves. Nobody can do it for them.");
line("each is where the other asked for",
  d.scopeFits, "One of them is asking for people in the half of the world the other is not in — Profile → where you are, and where you want people.");
line("something in common: " + (d.shared.length ? d.shared.join(", ") : "nothing"),
  d.shared.length > 0, "Their rooms do not answer each other. Buying answers selling, raising answers investing, looking for work answers hiring. Two people both selling are not a pair.");

console.log("");
console.log(d.matched
  ? "They are a match. A private thread is open between them and cards can move."
  : "Not a match yet. Fix the first ✗ above.");
console.log("");
