/* Did anybody come, and where did they stop.
 *
 * Three numbers a day per room: the door was opened, the form was begun, the
 * list was joined. That is the entire record — no addresses, no devices, no
 * rows per visit — so this can print everything it has and still be a page
 * about the board rather than about the people who read it.
 *
 * WHAT IT IS FOR. Somebody posts a room link into a WeChat group and the only
 * question that matters is whether it worked. Three numbers answer it and they
 * answer it differently:
 *
 *   nobody opened the door   →  the post did not travel. Post it again, or
 *                               somewhere else.
 *   opened, nobody began     →  they came and the page did not convince them.
 *                               The words on that door are the problem.
 *   began, nobody finished   →  the form is the problem, and a three-box form
 *                               losing people is worth an evening to fix.
 *
 *   make doors           the last fortnight
 *   make doors DAYS=30   longer
 *   make doors HOURS=2   the last two hours, by the hour
 *
 * WHY HOURS EXISTS. The day table answers "did that post work" a week later.
 * The question asked ten minutes after a link goes up is "is anybody arriving
 * now", and a UTC day cannot answer it: read at two in the morning in Tokyo,
 * "today" is already seventeen hours of history. Hour buckets are kept for
 * three days — see cleanHours — so this window is short on purpose.
 */

const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error("usage: doors.mjs <board url> <admin key> [days]");
  process.exit(2);
}
const DAYS = Math.max(1, Math.min(120, Number(rest[0]) || 14));
const HOURS = Math.max(0, Math.min(72, Number(rest[1]) || 0));

const d = await fetch(base + "/api/counts", { headers: { "x-admin-secret": key } })
  .then((r) => r.json())
  .catch(() => null);
if (!d) { console.error("The board did not answer."); process.exit(1); }

const counts = d.counts || {};
const hours = d.hours || {};

const ROOMS_ = ["film", "invest", "raise", "trade", "other"];
const PAD = (x, n) => String(x).padEnd(n);
const N = (n, w) => String(n || "·").padStart(w);

/* THE LAST FEW HOURS, AND IT RETURNS RATHER THAN FALLING THROUGH.
 *
 * Asked for hours, the day table underneath is not a useful second opinion —
 * it is the same event counted in a bucket seventeen times too big, printed
 * directly beneath the answer, which is how somebody reads the wrong number.
 * One question, one table. */
if (HOURS) {
  const keys = [];
  for (let i = HOURS - 1; i >= 0; i--) {
    keys.push(new Date(Date.now() - i * 3600_000).toISOString().slice(0, 13));
  }
  const hat = (h, r, w) => hours[h + "|" + r + "|" + w] || 0;
  const hsum = (h, w) => ROOMS_.reduce((a, r) => a + hat(h, r, w), 0);
  console.log("");
  console.log("  THE LAST " + HOURS + (HOURS === 1 ? " HOUR" : " HOURS") + "   (UTC)");
  console.log("");
  console.log("  " + PAD("hour", 8) + N("opened", 8) + N("began", 8) + N("joined", 8));
  console.log("  " + "-".repeat(32));
  let O = 0, F = 0, J = 0;
  for (const h of keys) {
    const o = hsum(h, "door"), f = hsum(h, "form"), j = hsum(h, "joined");
    O += o; F += f; J += j;
    console.log("  " + PAD(h.slice(11) + ":00", 8) + N(o, 8) + N(f, 8) + N(j, 8));
  }
  console.log("  " + "-".repeat(32));
  console.log("  " + PAD("total", 8) + N(O, 8) + N(F, 8) + N(J, 8));
  console.log("");
  if (!O && !F && !J) {
    /* NOT "nobody came". The hour buckets only start at the deploy that added
       them, so an empty window on the first day is this counter being new and
       not the link being quiet — and those are opposite things to do next. */
    console.log("  Nothing in that window. If the hour counter was only just");
    console.log("  deployed it has nothing older than that to show:  make doors");
  } else {
    console.log("  Hour buckets are kept for three days. Longer:  make doors DAYS=14");
  }
  console.log("");
  process.exit(0);
}

if (!Object.keys(counts).length) {
  console.log("Nothing counted yet.");
  console.log("");
  console.log("The counter is new: it only knows about doors opened since it");
  console.log("was deployed. Post a room link and look again tomorrow.");
  process.exit(0);
}

const ROOMS = ["film", "invest", "raise", "trade", "other"];
const LABEL = { film: "Film & TV", invest: "Investing", raise: "Raising",
                trade: "Factories", other: "Something else" };

/* Every day in the window, including the empty ones. A table with the quiet
   days missing reads as a busy board; the gaps are the information. */
const days = [];
for (let i = DAYS - 1; i >= 0; i--) {
  const t = new Date(Date.now() - i * 86400000);
  days.push(t.toISOString().slice(0, 10));
}

const at = (day, room, what) => counts[day + "|" + room + "|" + what] || 0;
const sum = (day, what) => ROOMS.reduce((a, r) => a + at(day, r, what), 0);

const pad = (s, n) => String(s).padEnd(n);
const num = (n, w) => String(n || "·").padStart(w);

console.log("");
console.log(pad("day", 12) + num("opened", 8) + num("began", 8) + num("joined", 8));
console.log("-".repeat(36));
let anything = false;
for (const day of days) {
  const o = sum(day, "door"), f = sum(day, "form"), j = sum(day, "joined");
  if (o || f || j) anything = true;
  console.log(pad(day, 12) + num(o, 8) + num(f, 8) + num(j, 8));
}

if (!anything) {
  console.log("");
  console.log("Nothing in the last " + DAYS + " days.");
  process.exit(0);
}

/* BY ROOM, over the whole window. Which door people are actually walking
   through is the thing that decides where the next post goes. */
console.log("");
console.log(pad("room", 18) + num("opened", 8) + num("began", 8) + num("joined", 8));
console.log("-".repeat(42));
for (const r of ROOMS) {
  let o = 0, f = 0, j = 0;
  for (const day of days) { o += at(day, r, "door"); f += at(day, r, "form"); j += at(day, r, "joined"); }
  if (!o && !f && !j) continue;
  console.log(pad(LABEL[r], 18) + num(o, 8) + num(f, 8) + num(j, 8));
}

/* WHERE THEY STOPPED, which is the only line here that says what to do next. */
let O = 0, F = 0, J = 0;
for (const day of days) { O += sum(day, "door"); F += sum(day, "form"); J += sum(day, "joined"); }
const pc = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "—");
console.log("");
console.log(O + " opened a door. " + F + " began the form (" + pc(F, O) + "). "
  + J + " joined (" + pc(J, F) + " of those).");
console.log("");
if (!O) {
  console.log("Nobody came. The link did not travel — post it somewhere else.");
} else if (F / O < 0.15) {
  console.log("They came and the page did not convince them. The words on that");
  console.log("door are what to change, not the form.");
} else if (F && J / F < 0.5) {
  console.log("They started and did not finish. Three boxes losing half the");
  console.log("people who begin them is worth an evening.");
} else {
  console.log("The door is working. More people through it is a distribution");
  console.log("problem now, not a page problem.");
}
console.log("");
console.log("Counted as numbers only — no addresses, no devices, nothing that");
console.log("could say who came.");
