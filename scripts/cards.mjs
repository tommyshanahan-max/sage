/* WHAT TONIGHT'S REPORT CARD SAYS TO EACH MEMBER.
 *
 * The card goes out once a day, in one hour of the day, to a phone. So the
 * only way to check whether it is on and what it says was to wait until the
 * evening and ask somebody to look at their lock screen — which is not a way
 * to check anything, and is exactly the sort of thing that ships broken and
 * stays broken for a week.
 *
 * This prints, for every member, the four numbers and the actual sentence
 * that would leave, in the language their own device asked for. It sends
 * nothing.
 *
 *   make cards            what it would say tonight
 *   make cards SEND=1     send it now, for real
 *
 * SEND=1 skips the hour and nothing else. The once-a-day stamp still applies,
 * so a hand run followed by the evening's tick does not buzz anybody twice.
 */
const [, , base, key, send] = process.argv;
if (!base || !key) {
  console.error("usage: cards.mjs <board url> <admin key> [send]");
  process.exit(2);
}
const GO = String(send || "") === "true";

const r = await fetch(base + "/api/admin/cards", {
  method: "POST",
  headers: { "x-admin-secret": key, "content-type": "application/json" },
  body: JSON.stringify({ send: GO }),
  signal: AbortSignal.timeout(30_000),
}).catch(() => null);
if (!r) { console.log("\n  The board did not answer. Is it up?  make ps\n"); process.exit(1); }
if (r.status === 401 || r.status === 403) {
  console.log("\n  The board refused the key (" + r.status + ").\n"); process.exit(1);
}
const d = await r.json().catch(() => null);
if (!d || !Array.isArray(d.rows)) {
  console.log("\n  The board answered " + r.status + " with nothing readable.\n");
  process.exit(1);
}

const pad = (s, n) => String(s).padEnd(n);
const num = (n, w) => String(n || "·").padStart(w);

console.log("");
/* THE SWITCH FIRST, because every number under it is meaningless if it is
   off — and "nobody got a card" reads as a broken feature rather than as a
   flag nobody set. The same mistake this box has made before with .env. */
if (!d.on) {
  console.log("  THE DAILY CARD IS OFF. Nothing is sent, whatever is below.");
  console.log("  To turn it on:  TOMSCODING_CARD=on in .env, then make deploy");
  console.log("");
} else if (!d.push) {
  console.log("  Notifications are not configured, so nothing can be sent.");
  console.log("  make board-keys sets up the browser half.");
  console.log("");
} else {
  console.log("  On. Goes out at " + String(d.hour).padStart(2, "0")
    + ":00 UTC — " + ((d.hour + 8) % 24) + ":00 in Beijing.");
  console.log("");
}

/* THE OPERATOR'S OWN LINE, FIRST, because it is the one he is checking.
   It is a different report from everybody else's — the whole board rather
   than his own page — and it arrives on a quiet night as well, so the
   question "is my nightly report on" has to be answerable separately from
   "will the members get theirs". */
if (!d.boss) {
  console.log("  Nobody is set to get the whole-board report.");
  console.log("  To get it yourself:  TOMSCODING_BOSS=<your handle> in .env, then make deploy");
  console.log("");
} else {
  console.log("  YOURS (" + d.boss + "), every night, quiet day or not:");
  console.log("      \u201c" + d.bossSays + "\u201d");
  if (!d.snap) {
    console.log("      Tapping it opens nothing yet — TOMSCODING_BOARD_SNAP is unset.");
    console.log("      make snap prints the line to add.");
  }
  console.log("");
}

console.log("  " + pad("who", 16) + num("opened", 8) + num("followed", 10)
  + num("replied", 9) + num("wrote", 7) + "   phones");
console.log("  " + "-".repeat(66));
let worth = 0, reachable = 0;
for (const q of d.rows) {
  // He is printed above with his own report; counting him among the members
  // would say somebody is getting a card about their page views who is not.
  if (d.boss && q.who.toLowerCase() === d.boss) continue;
  if (q.worth) worth++;
  if (q.worth && q.phones && !q.sentToday) reachable++;
  console.log("  " + pad(q.who, 16) + num(q.opened, 8) + num(q.followed, 10)
    + num(q.replied, 9) + num(q.wrote, 7) + num(q.phones, 9)
    + (q.sentToday ? "  sent" : ""));
  for (const line of q.says || []) console.log("      “" + line + "”");
}

console.log("");
const members = d.rows.filter((q) => !(d.boss && q.who.toLowerCase() === d.boss)).length;
console.log("  " + members + " members. " + worth + " had something happen today. "
  + reachable + " would get a card now.");
/* THE QUIET ONES ARE NOT A FAILURE AND THE REPORT SHOULD NOT LOOK LIKE ONE.
   Most members on most days have nothing, and a card saying "nobody looked at
   you" is a reason to delete the app — so silence is the design and it is
   said here rather than left to be read as a bug. */
if (worth < members) {
  console.log("  The rest had a quiet day and are sent nothing. That is deliberate:");
  console.log("  a nightly \"nobody looked at you\" is a reason to turn notifications off.");
}
if (d.sent) {
  console.log("");
  console.log("  SENT. Anybody marked \"sent\" above already had tonight's and was");
  console.log("  skipped, so this cannot have buzzed the same person twice.");
}
console.log("");
