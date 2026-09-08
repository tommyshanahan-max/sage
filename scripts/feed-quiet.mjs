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
 *   make feed-quiet             say what it would take down
 *   make feed-quiet GO=1        take it down
 *   make feed-quiet WHO=as      one named author instead of the house
 *
 * WHO exists because of a real accident: a make variable clash posted three
 * notices under the name "as" (AS is make's own name for the assembler), and
 * "as" is not a house name — correctly, since somebody could one day be
 * called that. Rather than teach the house list a typo, this takes a name.
 */

const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error("usage: feed-quiet.mjs <board url> <admin key> [--go]");
  process.exit(2);
}
const head = { "x-admin-secret": key };
const GO = rest.includes("--go");
const whoIdx = rest.indexOf("--who");
const WHO = whoIdx >= 0 ? String(rest[whoIdx + 1] || "").trim().toLowerCase() : "";

/* Both halves of every name the house has ever posted under. Matched on the
   handle rather than on a flag, because that is what the board itself matches
   on — see HOUSE in index.html — and two lists of the same thing drift. */
const HOUSE = ["the professor", "the tutor", "教授", "导师"];

const board = await fetch(base + "/api/public", { headers: head }).then((r) => r.json());
const want = WHO ? [WHO] : HOUSE;
const mine = (board.posts || []).filter((p) =>
  p.state === "published"
  && want.includes(String(p.handle || "").toLowerCase()));

if (!mine.length) {
  console.log(WHO
    ? "Nothing up under \"" + WHO + "\". Nothing to do."
    : "The house has nothing up. Nothing to do.");
  process.exit(0);
}

const first = (p) => String(p.note || "").split("\n")[0].slice(0, 58);
for (const p of mine) console.log("  " + p.id + "  " + p.handle.padEnd(16) + first(p));
console.log("");

if (!GO) {
  console.log(mine.length + " would come down. Nothing has changed.");
  console.log("Do it with:  make feed-quiet " + (WHO ? 'WHO="' + WHO + '" ' : "") + "GO=1");
  console.log("");
  console.log("Nothing is deleted either way — a row stays in the file with a");
  console.log("reason on it and readers stop seeing it.");
  process.exit(0);
}

let done = 0;
for (const p of mine) {
  /* The reason goes in the file and stays there. The house has one — its
     answers live in Ask the Professor — and a member's post does not: saying
     so on somebody's row would be a false record of why it came down. */
  const why = WHO
    ? "Taken off the feed by the board."
    : "Answered in Ask the Professor instead.";
  const r = await fetch(base + "/api/feed?id=" + encodeURIComponent(p.id)
    + "&why=" + encodeURIComponent(why),
    { method: "DELETE", headers: head });
  if (!r.ok) { console.error("Could not take down " + p.id + ": " + r.status); continue; }
  done += 1;
}
console.log(done + " down. The feed is members again.");
if (!WHO) {
  console.log("");
  console.log("What they said is in the bell, under Ask the Professor — ten");
  console.log("questions, both languages, and it does not take a slot.");
}
