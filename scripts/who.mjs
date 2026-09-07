/* Who is on the board, and who can actually see them.
 *
 * WHY THIS EXISTS. Somebody says "she added herself, I can see her photo on the
 * feed but she is not in Browse" — and there was no way to answer it. The
 * public list contains exactly the people who ARE in Browse, which is the one
 * group the question is never about. So the answer had to be guessed, and a
 * guess about somebody's account is worth nothing.
 *
 * Every line says what is true and, when somebody is missing from Browse, WHY,
 * in the words of the thing they would have to change.
 *
 *   make who
 */

const [, , base, key] = process.argv;
if (!base || !key) {
  console.error("usage: who.mjs <board url> <admin key>");
  process.exit(2);
}

const d = await fetch(base + "/api/public?queue=1", { headers: { "x-admin-secret": key } })
  .then((r) => r.json());
const people = d.people || [];
if (!people.length) {
  console.log("Nobody has made a page yet.");
  process.exit(0);
}

const when = (iso) => String(iso || "").slice(0, 10);
const pad = (s, n) => String(s).padEnd(n).slice(0, n);

console.log(pad("name", 16) + pad("made", 12) + pad("in browse", 11) + "why not");
console.log("-".repeat(64));

let out = 0;
for (const q of people.sort((a, b) => (b.at || "").localeCompare(a.at || ""))) {
  /* THE ORDER OF THESE IS THE ORDER THEY BITE. A profile with no name is not a
     profile yet; after that it is the switch; after that the queue. Only the
     first true one is printed, because the first one is the one to fix. */
  const why = !q.handle ? "no name yet — the form was never finished"
    : q.state !== "published" ? "the profile is " + q.state
    : !q.looking ? "\"Show me in Browse\" is off — only she can turn it on"
    : "";
  if (why) out++;
  console.log(pad(q.handle || "—", 16) + pad(when(q.at), 12)
    + pad(why ? "no" : "yes", 11) + why);
  /* A face waiting is not a reason to be absent — she is in Browse, with a
     letter where the photograph goes — so it is said underneath rather than
     in the column that means missing. */
  if (!why && q.hasPhoto && q.photoState !== "published") {
    console.log(pad("", 16) + "  photo is still waiting for a person — she shows as a letter");
  }
}

console.log("");
console.log(people.length + " with a page, " + (people.length - out) + " in Browse.");
if (out) {
  console.log("");
  console.log("Nobody can be put in Browse for them — the switch is on their own");
  console.log("phone, under their name, and it is theirs to turn on.");
}
