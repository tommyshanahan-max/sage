/* One sentence from the doorman, in every room at the door.
 *
 * WHY. Somebody runs this board and had no way to tell the people in it
 * anything. Mo welcomes arrivals and answers questions, and that is the whole
 * of what reaches a room — so a week where three investors came in, or a date
 * the door opens, or "photographs are being looked at tomorrow", reached
 * nobody. Twenty-two people standing in Film & TV and no way to speak to them.
 *
 * IT IS YOUR SENTENCE, NOT HIS. No model runs on this. He may not invent a
 * fact about the world — that rule is the reason anything he says can be
 * trusted — so you write the line and he says it, word for word. What he adds
 * is that it lands in the room they are already reading, in the voice they
 * know.
 *
 *   make mo-say WHAT="Photographs are being looked at tomorrow."
 *   make mo-say WHAT="..." ROOM=film
 *
 * Rooms: film invest raise trade other. No ROOM means all five.
 */

const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error('usage: mosay.mjs <board url> <admin key> --text "..." [--room film]');
  process.exit(2);
}
const arg = (n, d = "") => { const i = rest.indexOf("--" + n); return i < 0 ? d : (rest[i + 1] || d); };

const text = arg("text").trim();
const room = arg("room").trim();

if (!text) {
  console.log("");
  console.log('  What should he say?  make mo-say WHAT="Photographs are being looked at tomorrow."');
  console.log("");
  process.exit(1);
}

const r = await fetch(base + "/api/mo/say", {
  method: "POST",
  headers: { "x-admin-secret": key, "Content-Type": "application/json" },
  body: JSON.stringify({ text, room }),
});
const d = await r.json().catch(() => ({}));

console.log("");
if (!r.ok) {
  /* Each refusal names the thing to do about it. "That did not go through" is
     the answer that costs an evening. */
  if (d.error === "contact") {
    console.log("  That has a way to reach somebody in it, which he may not hand out.");
    console.log("  Say what is happening. The rooms are where people talk.");
  } else if (d.error === "room") {
    console.log("  There is no door called " + JSON.stringify(room) + ".");
    console.log("  Rooms: film  invest  raise  trade  other");
  } else if (d.error === "empty") {
    console.log("  Nothing to say.");
  } else {
    console.log("  That did not go through.");
  }
  console.log("");
  process.exit(1);
}

const where = d.rooms.length === 5 ? "every door" : d.rooms.join(", ");
console.log("  Said in " + where + ":");
console.log("");
console.log("    " + text);
console.log("");
console.log("  It reads in both languages a moment from now.");
console.log("");
