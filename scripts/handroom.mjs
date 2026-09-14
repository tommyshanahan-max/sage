/* A room whose list you keep yourself.
 *
 * WHY IT IS NOT MADE IN THE APP. Every other room on this board is made out of
 * something the board knows — who matched, who is at which door. This one is
 * for the opposite case: a room where being in it depends on something that
 * happened somewhere else and that no rule in the server can check. An offer
 * signed on the crowdfundme ledger, for instance. The board has no idea, and
 * should not be taught to guess.
 *
 * So the gate is a person with the ledger in front of them. Nobody joins it,
 * nobody is invited into it, and there is no link. The app refuses Add
 * somebody, Take out and minting an invite on it — one list, one keeper.
 *
 *   make handroom                          who is in it
 *   make handroom WHO="Ray Chen"           put them in
 *   make handroom WHO="Ray Chen" OFF=1     take them out
 *   make handroom NAME="Something else" …  a different room
 *
 * They have to be on the board first — this adds a member to a room, it does
 * not make anybody a member. `make card NAME="Ray Chen" …` does that.
 */

const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error('usage: handroom.mjs <board url> <admin key> [--name N] [--who WHO] [--off]');
  process.exit(2);
}
const arg = (n, d = "") => { const i = rest.indexOf("--" + n); return i < 0 ? d : (rest[i + 1] || d); };

const name = arg("name").trim() || "Crowdfund The Exchange";
const who = arg("who").trim();
const off = rest.includes("--off");

const head = { "x-admin-secret": key, "Content-Type": "application/json" };

/* Nothing named, so this is the question rather than the change. */
if (!who) {
  const r = await fetch(base + "/api/room/hand?name=" + encodeURIComponent(name), { headers: head });
  const d = await r.json().catch(() => ({}));
  console.log("");
  if (!r.ok) { console.log("  That did not go through."); console.log(""); process.exit(1); }
  if (!d.room) {
    console.log("  There is no room called " + JSON.stringify(name) + " yet.");
    console.log("");
    console.log('  Make it by putting the first person in:  make handroom WHO="Tom"');
    console.log("");
    process.exit(0);
  }
  console.log("  " + d.room.name + " — " + d.room.who.length
    + (d.room.who.length === 1 ? " person" : " people"));
  console.log("");
  for (const h of d.room.who) console.log("    " + h);
  console.log("");
  console.log("  " + d.room.said + " said in it"
    + (d.room.flags ? ", " + d.room.flags + " marked" : ""));
  console.log("");
  process.exit(0);
}

const body = { name, add: off ? [] : [who], drop: off ? [who] : [] };
const r = await fetch(base + "/api/room/hand", { method: "POST", headers: head, body: JSON.stringify(body) });
const d = await r.json().catch(() => ({}));

console.log("");
if (!r.ok) {
  if (d.error === "who") {
    /* The one failure worth naming precisely: a handle this board has never
       heard of. Said back, because a typo that silently adds nobody leaves
       somebody believing a person is in a room they cannot see. */
    console.log("  Not on this board: " + (d.miss || []).join(", "));
    console.log("");
    console.log("  They have to be a member before they can be in a room.");
    console.log('  make card NAME="' + who + '" ME=investor WANT=producer LINE="..."');
  } else if (d.error === "few") {
    console.log("  That would leave the room with nobody in it.");
  } else if (d.error === "many") {
    console.log("  That room is full.");
  } else {
    console.log("  That did not go through.");
  }
  console.log("");
  process.exit(1);
}

console.log(off
  ? "  " + who + " is out of " + name + "."
  : "  " + who + (d.made ? " opened " : " is in ") + name + ".");
console.log("  " + d.who + (d.who === 1 ? " person" : " people") + " in it now.");
console.log("");
if (d.made) {
  console.log("  It is in their Messages, under Groups. There is no link to it");
  console.log("  and nobody can be invited into it — you put people in.");
  console.log("");
}
