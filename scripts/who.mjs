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

/* AND HOW TO REACH THEM, which is the question this list could not answer.
 *
 * Seven people joined and there was no command on this box that would say what
 * the board holds for any of them — so "can you ask them to sign up again" was
 * the only move left, which is a terrible thing to have to ask somebody who
 * already joined.
 *
 * It is not new information and nothing here is collected for it. Two things
 * the board already has: the WeChat id or line somebody wrote on their own
 * card, and the way to be reached that a waiting row cannot be written
 * without. A member admitted straight off a code who never filled in either is
 * a person this board genuinely cannot reach, and that is said out loud rather
 * than left as a blank column — see the count at the bottom. */
console.log(pad("name", 16) + pad("made", 11) + pad("in browse", 10)
  + pad("reach", 24) + "why not");
console.log("-".repeat(88));

let out = 0;
let noreach = 0;
/* COUNTED BY REASON, because the reasons are not the same kind of thing and
   the advice at the bottom used to treat them as one. See below. */
const held = [];
const theirs = [];
const nameless = [];
const inBrowse = [];
for (const q of people.sort((a, b) => (b.at || "").localeCompare(a.at || ""))) {
  /* THE ORDER OF THESE IS THE ORDER THEY BITE. A profile with no name is not a
     profile yet; after that it is the switch; after that the queue. Only the
     first true one is printed, because the first one is the one to fix. */
  const why = !q.handle ? "no name yet — the form was never finished"
    : q.state !== "published" ? "the profile is " + q.state
    : !q.looking ? "\"Show me in Browse\" is off — only she can turn it on"
    : "";
  if (why) out++; else inBrowse.push(q.handle);
  if (!q.handle) nameless.push(q.handle || "—");
  else if (q.state !== "published") held.push(q.handle);
  else if (!q.looking) theirs.push(q.handle);
  if (!q.reach) noreach++;
  console.log(pad(q.handle || "—", 16) + pad(when(q.at), 11)
    + pad(why ? "no" : "yes", 10) + pad(q.reach || "— nothing", 24) + why);
  /* A face waiting is not a reason to be absent — she is in Browse, with a
     letter where the photograph goes — so it is said underneath rather than
     in the column that means missing. */
  if (!why && q.hasPhoto && q.photoState !== "published") {
    console.log(pad("", 16) + "  photo is still waiting for a person — she shows as a letter");
  }
}

console.log("");
console.log(people.length + " with a page, " + inBrowse.length + " in Browse.");
/* NAMED, not just counted. "5 in Browse" at the foot of twenty-three rows is a
   number somebody has to scroll back up and re-read the table to check, and
   the question this command gets asked is "who can I actually see". */
if (inBrowse.length) console.log("  " + inBrowse.join("  "));

if (noreach) {
  console.log("");
  console.log(noreach + " of them this board cannot reach at all: no card, and they");
  console.log("did not come through the list. Nothing was lost — it was never asked");
  console.log("for. The way to reach them now is the room they are already in.");
}

/* THE ADVICE USED TO BE ONE SENTENCE FOR THREE DIFFERENT PROBLEMS, and it was
   the wrong sentence for the commonest of them. It said "nobody can be put in
   Browse for them — the switch is on their own phone", which is true of
   `looking` and NOT true of a held profile: a hold is the review queue, it is
   the operator's, and `make show` clears it. So eighteen people were sitting
   behind a queue nobody had been told they could clear, under a line saying
   there was nothing to be done. Each reason now says whose it is. */
if (held.length) {
  console.log("");
  console.log(held.length + " " + (held.length === 1 ? "profile is" : "profiles are")
    + " held for review. That is yours to clear:");
  console.log('  make show WHO="' + held[0] + '"');
  if (held.length > 1) console.log("  …and so on for: " + held.slice(1).join("  "));
  console.log("Their words go up as written, so read the row before you do.");
  console.log('If "Show me in Browse" is off underneath, they stay out — see below.');
}
if (theirs.length) {
  console.log("");
  console.log(theirs.length + " have \"Show me in Browse\" off. Nobody can turn that on");
  console.log("for them — the switch is on their own phone, under their name:");
  console.log("  " + theirs.join("  "));
}
if (nameless.length) {
  console.log("");
  console.log(nameless.length + " never finished the form — there is no name on the page,");
  console.log("so there is nothing to show yet.");
}
