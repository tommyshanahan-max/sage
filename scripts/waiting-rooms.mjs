/* The queue, by room and by which half of the sentence they are.
 *
 *   make waiting-rooms
 *
 * WHY THIS IS NOT `make waiting` WITH A SORT. Deciding who to let in is not a
 * question about people, it is a question about pairs. A hundred admitted off
 * the top of the queue is twenty in each of five rooms, and twenty people who
 * mostly want the same thing match with nobody — the room is full and the
 * product does not work, which is the worst of both.
 *
 * So this answers the question actually being asked: in this room, who is
 * waiting to find what, and is there anybody waiting who IS that. A row with
 * demand and no supply is a person to leave in the queue; a row on both sides
 * is a match the day they are both let in.
 *
 * Members already inside count as supply too — an agent waiting outside is
 * worth admitting if the performers are already through the door. Counted per
 * ROLE and never per room: a member belongs to a matching room (agent, talent)
 * and a waiting person belongs to a door (film, invest), and those are two
 * different namespaces with some of the same words in them. Counting one
 * against the other reads as zero members every time, which is wrong in the
 * one direction that would make somebody leave people in the queue.
 */
const [, , base, key] = process.argv;
if (!base || !key) {
  console.error("usage: waiting-rooms.mjs <board url> <admin key>");
  process.exit(2);
}
const head = { "x-admin-secret": key };

const get = async (p) => {
  const r = await fetch(base + p, { headers: head });
  if (!r.ok) { console.error(p + ": " + r.status); process.exit(1); }
  return r.json();
};

/* The room tables come from the board's own container — /app/lib/store.js —
   so a role added there is a role here, and never a second copy to drift. */
let ROLES = {}, answerTo = (r) => r, ROOMS = ["film", "invest", "raise", "trade", "other"];
for (const where of ["/app/lib/store.js",
                     new URL("../board/lib/store.js", import.meta.url).href]) {
  try {
    const s = await import(where);
    ROLES = s.ROLES || {}; answerTo = s.answerTo || answerTo;
    ROOMS = s.WAITROOMS || ROOMS;
    break;
  } catch { /* the other one */ }
}

const { waits } = await get("/api/waiting");
const { people } = await get("/api/faces").catch(() => ({ people: [] }));

const open = waits.filter((w) => !w.done);
const pad = (s, n) => String(s).padEnd(n).slice(0, n);

console.log("");
for (const room of ROOMS) {
  const here = open.filter((w) => (w.room || "other") === room);
  if (!here.length) continue;

  /* WHO THEY ARE and WHAT THEY WANT, counted separately. The first is supply,
     the second is demand, and a room works when they meet in the middle. */
  const are = new Map();
  const want = new Map();
  for (const w of here) {
    if (w.me) are.set(w.me, (are.get(w.me) || 0) + 1);
    if (w.want) want.set(w.want, (want.get(w.want) || 0) + 1);
  }
  const said = here.filter((w) => w.me || w.want).length;

  console.log(room.toUpperCase() + "   " + here.length + " waiting"
    + (said < here.length ? "   (" + (here.length - said) + " said nothing yet)" : ""));
  console.log("  " + "-".repeat(56));

  if (!want.size) {
    console.log("  nobody here has said what they are looking for yet.\n");
    continue;
  }

  console.log("  " + pad("they want", 18) + pad("asking", 8)
    + pad("waiting", 9) + "inside");
  for (const [role, n] of [...want.entries()].sort((a, b) => b[1] - a[1])) {
    /* The people who ARE the thing being asked for — the other half of the
       sentence, which is the only number that decides whether letting these
       ones in produces a match or a wall. */
    const supply = are.get(role) || 0;
    const within = people.filter((q) => q.state === "published"
      && (q.says || []).includes(role)).length;
    const mark = supply + within === 0 ? "   ← nobody" : "";
    console.log("  " + pad(role, 18) + pad(n, 8)
      + pad(supply, 9) + within + mark);
  }
  console.log("");
}

const none = open.filter((w) => !w.me && !w.want).length;
console.log(open.length + " waiting in all."
  + (none ? "  " + none + " have not said what they want." : ""));
console.log("");
console.log("Let in the rows that have somebody on the other side — a want with");
console.log("nobody who is it is a person to leave in the queue for now.");
console.log("  make waiting-in ID=...  &&  make invite WHO=\"Tom\" FOR=\"their name\"");
