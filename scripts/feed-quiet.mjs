/* Take every notice the house has up off the feed.
 *
 * WHY THIS EXISTS. Four Professor posts on a board of fifteen people makes the
 * house the loudest member, which is the opposite of what a new arrival should
 * see — and every one of them was explaining something that is now answered,
 * permanently and in both languages, in Ask the Professor. A notice is worth a
 * slot in the feed when it is news; the moment it is reference, it belongs
 * where somebody goes looking rather than in front of people who did not ask.
 *
 * Nothing is deleted. Each row stays in the file with a reason on it and
 * readers stop seeing it, which is the same thing the panel's own button does.
 *
 *   make feed-quiet          say what it would take down
 *   make feed-quiet GO=1     take it down
 */

const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error("usage: feed-quiet.mjs <board url> <admin key> [--go]");
  process.exit(2);
}
const head = { "x-admin-secret": key };
const GO = rest.includes("--go");

/* Both halves of every name the house has ever posted under. Matched on the
   handle rather than on a flag, because that is what the board itself matches
   on — see HOUSE in index.html — and two lists of the same thing drift. */
const HOUSE = ["the professor", "the tutor", "教授", "导师"];

const board = await fetch(base + "/api/public", { headers: head }).then((r) => r.json());
const mine = (board.posts || []).filter((p) =>
  p.state === "published"
  && HOUSE.includes(String(p.handle || "").toLowerCase()));

if (!mine.length) {
  console.log("The house has nothing up. Nothing to do.");
  process.exit(0);
}

const first = (p) => String(p.note || "").split("\n")[0].slice(0, 58);
for (const p of mine) console.log("  " + p.id + "  " + p.handle.padEnd(16) + first(p));
console.log("");

if (!GO) {
  console.log(mine.length + " would come down. Nothing has changed.");
  console.log("Do it with:  make feed-quiet GO=1");
  console.log("");
  console.log("Nothing is deleted either way — a row stays in the file with a");
  console.log("reason on it and readers stop seeing it.");
  process.exit(0);
}

let done = 0;
for (const p of mine) {
  const r = await fetch(base + "/api/feed?id=" + encodeURIComponent(p.id)
    + "&why=" + encodeURIComponent("Answered in Ask the Professor instead."),
    { method: "DELETE", headers: head });
  if (!r.ok) { console.error("Could not take down " + p.id + ": " + r.status); continue; }
  done += 1;
}
console.log(done + " down. The feed is members again.");
console.log("");
console.log("What they said is in the bell, under Ask the Professor — ten");
console.log("questions, both languages, and it does not take a slot.");
