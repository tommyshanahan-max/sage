/* The rooms, and their ids.
 *
 * Only so a group invite can be minted. `make group-invite` needs an id, and
 * an id is not a thing anybody has in their head — it is twenty characters of
 * hex that only ever appears in the address bar of somebody else's phone.
 *
 * NAMES AND COUNTS, NEVER A WORD ANYBODY SAID. What is in a group is between
 * the people in it; whoever runs the board needs to know a room exists and has
 * space, and nothing else. A report is still the only way a message outside a
 * room is read by anybody, which is the same rule the rest of this board runs.
 *
 *   make groups
 */

const [, , base, key] = process.argv;
if (!base || !key) {
  console.error("usage: groups.mjs <board url> <admin key>");
  process.exit(2);
}

const r = await fetch(base + "/api/rooms", { headers: { "x-admin-secret": key } });
if (!r.ok) { console.error("That did not go through."); process.exit(1); }
const d = await r.json().catch(() => ({}));
const rooms = d.rooms || [];

if (!rooms.length) {
  console.log("");
  console.log("  No rooms yet. They are made in the app: Messages, the Groups");
  console.log("  circle, Start a group. Three people minimum.");
  console.log("");
  process.exit(0);
}

const when = (at) => String(at || "").slice(0, 10);
console.log("");
console.log("id".padEnd(22) + "made".padEnd(12) + "room");
console.log("-".repeat(72));
for (const g of rooms) {
  console.log(g.id.padEnd(22) + when(g.at).padEnd(12) + (g.name || "—"));
  console.log(" ".repeat(34) + g.who.join(", ") + "   made by " + (g.by || "—"));
  /* SPACE, AND WHY IT MIGHT BE LESS THAN IT LOOKS. Somebody holding an unspent
     code for this room is already sitting in one of its seats — see groupRoom
     — so a room of three with a code out has room for one, not two. Saying so
     here is the difference between that being a rule and being a surprise. */
  const bits = [
    g.said + " said",
    g.guests ? g.guests + " reading, not in yet" : "",
    g.held ? g.held + " code" + (g.held === 1 ? "" : "s") + " out" : "",
    g.room ? "room for " + g.room + " more" : "full",
  ].filter(Boolean);
  console.log(" ".repeat(34) + bits.join("  ·  "));
  console.log("");
}
console.log("Invite somebody into one:");
console.log('  make group-invite GROUP=' + rooms[0].id + ' WHO="Tom" FOR="Ava"');
console.log("");
