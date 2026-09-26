/* Did anybody arrive, and where from.
 *
 * WHY THIS EXISTS. A link went on Instagram and there was no command on this
 * box that answered "any traffic?". `make who` lists who has a page and says
 * why each one is or is not in Browse — a different question, asked about a
 * named person. `make numbers-days` counts page views, which is the half
 * before this one. Between them was the number that actually matters: how
 * many people arrived, on which day, and through which door.
 *
 * TWO KINDS OF ARRIVAL AND BOTH ARE COUNTED. A person row is somebody who
 * made a page. A wait row is somebody who typed a name and stopped. Counting
 * only the first makes the link look worse than it is; counting only the
 * second makes it look like nobody finished. Both, side by side.
 *
 *   make traffic [DAYS=14]
 */

const [, , base, key, days] = process.argv;
if (!base || !key) {
  console.error("usage: traffic.mjs <board url> <admin key> [days]");
  process.exit(2);
}
const DAYS = Math.max(1, Math.min(90, Number(days) || 14));

/* A REFUSAL AND A DEAD BOARD ARE NOT THE SAME PROBLEM, and telling somebody
   to check whether the board is up when the board just answered 401 sends
   them to look at the one thing that is working. The status says which. */
const r = await fetch(base + "/api/public?queue=1", { headers: { "x-admin-secret": key } })
  .catch(() => null);
if (!r) {
  console.log("\n  The board did not answer at all. Is it up?  make ps\n");
  process.exit(1);
}
if (r.status === 401 || r.status === 403) {
  console.log("\n  The board refused the key (" + r.status + ").");
  console.log("  TOMSCODING_BOARD_KEY in .env is what this reads.\n");
  process.exit(1);
}
const d = await r.json().catch(() => null);
if (!d || !Array.isArray(d.people)) {
  console.log("\n  The board answered " + r.status + " with nothing readable in it.\n");
  process.exit(1);
}

const people = d.people;
const waits = Array.isArray(d.waits) ? d.waits : [];

/* THE BOARD MUST BE RUNNING THE CODE THIS SCRIPT WAS WRITTEN AGAINST.
 *
 * scripts/ is bind-mounted and board/ is COPYed into the image, so a fetch
 * with no build puts this file on disk in front of a server that has never
 * heard of `via`, `waits` or `publicDoor`. Every one of them would come back
 * undefined and the report would print, in confident columns, that nobody
 * came through the link, nobody is on the list, and the door is shut — three
 * falsehoods, none of them marked as missing data. An answer that cannot
 * tell "no" from "not asked" is worse than no answer.
 *
 * Checked on publicDoor, which is a boolean the route always sends now, so
 * `undefined` can only mean old code. */
if (d.publicDoor === undefined) {
  console.log("\n  The board is running older code than this command.");
  console.log("  board/ is built into the image, so a fetch alone does not move it:");
  console.log("");
  console.log("    make up && make traffic");
  console.log("");
  process.exit(1);
}

/* THE DAY SOMETHING HAPPENED, IN THE ONLY TIME ZONE THAT MATTERS HERE.
 * Rows are stamped in UTC and Tom reads this in Tokyo, where the box is. A
 * report that puts last night's arrivals on yesterday is a report that says
 * nothing happened today. */
const dayOf = (iso) => {
  const t = Date.parse(String(iso || ""));
  if (!Number.isFinite(t)) return "";
  return new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 10);
};
const today = dayOf(new Date().toISOString());
const back = (n) => {
  const t = Date.parse(today + "T00:00:00Z") - n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
};
const since = back(6);           // today and the six before it

// Blank means they were here before the public door existed — vouched, by the
// same rule tierOf uses on the server.
const door = (q) => q.via === "door";
const made = (q) => q.state === "published" && q.handle;

const count = (rows, from) => rows.filter((q) => dayOf(q.at) >= from).length;

/* THE HEADLINE IS A ROLLING WINDOW, NOT A CALENDAR DAY.
 *
 * It said TODAY, and the first run of it printed "0 arrived" at three in the
 * morning Tokyo time — true, three hours old, and exactly the wrong answer to
 * "any traffic?": it reads as the link having died. A day that has barely
 * started is a bad denominator. Twenty-four hours back from now is the same
 * question and always a real window, whatever time it is read at. */
const msSince = (rows, ms) => {
  const cut = Date.now() - ms;
  return rows.filter((q) => Date.parse(String(q.at || "")) >= cut).length;
};

const pad = (s, n) => String(s).padEnd(n);
const num = (n, w) => String(n).padStart(w);

console.log("");
console.log("  TRAFFIC");
console.log("");

/* THE HEADLINE IS THE ANSWER TO THE QUESTION ASKED. "Any traffic?" is a yes
   or a no, and the number that makes it one is how many people arrived —
   both kinds of arrival, together, because a half-finished arrival is still
   somebody who came. The breakdown is underneath for whoever wants it. */
const say = (label, p, w) => console.log("  " + pad(label, 14) + num(p + w, 4)
  + " arrived" + "    " + num(p, 3) + " made a page");
say("LAST 24 HOURS", msSince(people, 86400000), msSince(waits, 86400000));
say("LAST 7 DAYS", count(people, since), count(waits, since));
say("ALL TIME", people.length, waits.length);

console.log("");
console.log("  WHICH DOOR");
console.log("");
const viaDoor = people.filter(door);
const viaVouch = people.filter((q) => !door(q));
console.log("    " + num(viaDoor.length, 4) + "  came through the public link");
console.log("    " + num(viaVouch.length, 4) + "  vouched in by a member");
console.log("    " + num(waits.length, 4) + "  on the list, never made a page");
if (!d.publicDoor) {
  /* NOT "nobody came through the link". With the flag off nobody CAN, and a
     report that cannot tell a quiet link from a shut door is the same trap as
     grepping .env for a name nobody set — see the env note in CLAUDE.md. */
  console.log("");
  console.log("    The public door is SHUT. Nobody can come in through the");
  console.log("    link at all, so that first number cannot grow.");
  console.log("    To open it:  TOMSCODING_PUBLIC=on in .env, then make deploy");
}

console.log("");
console.log("  DAY BY DAY      arrived · made a page");
console.log("");
let any = false;
for (let i = DAYS - 1; i >= 0; i--) {
  const day = back(i);
  const p = people.filter((q) => dayOf(q.at) === day);
  const w = waits.filter((q) => dayOf(q.at) === day);
  const n = p.length + w.length;
  if (!n) continue;
  any = true;
  /* A BAR, BECAUSE A COLUMN OF SMALL FIGURES IS THE HARDEST THING TO READ ON
     THIS BOX. The number is beside it for the exact answer; the bar is what
     says "that afternoon" from across the room. */
  console.log("    " + pad(day.slice(5).replace("-", "/"), 7)
    + pad("#".repeat(Math.min(n, 30)), 31) + num(n, 3)
    + "  " + num(p.length, 3));
}
if (!any) console.log("    Nothing in the last " + DAYS + " days.");

/* AND WHO, WHEN IT IS A SHORT ENOUGH LIST TO BE WORTH NAMING. The counts say
   whether to care; this says who to go and look at. Capped, because past a
   dozen it is `make who` you want and not this. */
const fresh = [...people.filter((q) => dayOf(q.at) >= since).map((q) => ({
                 name: q.handle || "(no name yet)",
                 note: made(q) ? (door(q) ? "link" : "vouched") : "unfinished" })),
               ...waits.filter((w) => dayOf(w.at) >= since).map((w) => ({
                 name: w.name, note: "on the list" }))];
if (fresh.length && fresh.length <= 12) {
  console.log("");
  console.log("  THIS WEEK");
  console.log("");
  for (const f of fresh) console.log("    " + pad(f.name, 20) + f.note);
}

console.log("");
console.log("  Page views, including people who never signed up:  make numbers-days");
console.log("");
