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
 */

const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error("usage: doors.mjs <board url> <admin key> [days]");
  process.exit(2);
}
const DAYS = Math.max(1, Math.min(120, Number(rest[0]) || 14));

const d = await fetch(base + "/api/counts", { headers: { "x-admin-secret": key } })
  .then((r) => r.json())
  .catch(() => null);
if (!d) { console.error("The board did not answer."); process.exit(1); }

const counts = d.counts || {};
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
