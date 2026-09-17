/* Pin the terms to a room, from the terminal.
 *
 * ---------------------------------------------------------------------------
 * WHY NOT ONLY IN THE APP. The memo is usually written before the two people
 * have met — the introduction and the terms arrive together, and the terms are
 * the reason the room exists. Typing seven fields into a phone in front of the
 * person you are introducing is not how that goes.
 *
 * THE NAMES ARE HANDLES, not first names, and that is the one exception this
 * repo has to the WHO rule: on the board a person is the handle they chose.
 * `make who` is the only place that knows them. A wrong handle here fails with
 * "not in that room", which is true and reads like the person is missing.
 *
 * WRITING TERMS CLEARS BOTH AGREEMENTS, always, including from here. There is
 * no flag to keep them. "They agreed" has to mean they agreed to these words.
 *
 *   make deal ROOM=<id> HIRES="Claire" PROVIDES="Sasha" \
 *     TITLE="Macau event, 14 March" \
 *     WHAT="..." WHERE="..." WHEN="..." FEE="..." \
 *     DEPOSIT="..." COVERS="..." CANCEL="..."
 *
 *   make groups   lists the rooms and their ids
 *   make who      lists the handles
 */
import { readFile, writeFile, rename } from "node:fs/promises";
import * as store from "/app/lib/store.js";

const FILE = process.env.BOARD_FILE || "/data/board.json";
const arg = (k) => process.env[k] || "";

const board = JSON.parse(await readFile(FILE, "utf8"));
const room = arg("ROOM");
const g = board.groups.find((x) => x.id === room);

if (!g) {
  console.log("");
  console.log("  No room with id " + (room || "(none given)") + ".");
  console.log("  `make groups` lists them.");
  console.log("");
  process.exit(1);
}

const handleOf = (hash) => (board.people.find((q) => q.by === hash) || {}).handle || "";
const inRoom = g.members.map(handleOf).filter(Boolean);
const hires = arg("HIRES");
const provides = arg("PROVIDES");

for (const [label, who] of [["HIRES", hires], ["PROVIDES", provides]]) {
  if (!inRoom.includes(who)) {
    console.log("");
    console.log("  " + label + '="' + who + '" is not in that room.');
    console.log("  In it: " + inRoom.join(", "));
    console.log("");
    process.exit(1);
  }
}
if (hires === provides) {
  console.log("\n  HIRES and PROVIDES are the same person.\n");
  process.exit(1);
}

const deal = store.cleanDeal({
  title: arg("TITLE"),
  hires, provides,
  what: arg("WHAT"), where: arg("WHERE"), when: arg("WHEN"),
  fee: arg("FEE"), deposit: arg("DEPOSIT"),
  covers: arg("COVERS"), cancel: arg("CANCEL"),
  by: "", at: new Date().toISOString(),
  agreed: [],
});

const had = (g.deal?.agreed || []).length;
g.deal = deal;
Object.assign(g, store.cleanGroup(g));

const tmp = FILE + ".tmp";
await writeFile(tmp, JSON.stringify(board, null, 2));
await rename(tmp, FILE);

console.log("");
console.log("  " + (g.name || "the room") + " — " + (deal.title || "terms pinned"));
console.log("  " + deal.hires + " is hiring " + deal.provides);
console.log("");
for (const [k, label] of [["what", "What"], ["where", "Where"], ["when", "When"],
                          ["fee", "Fee"], ["deposit", "Up front"],
                          ["covers", "Who pays what"], ["cancel", "If called off"]]) {
  if (deal[k]) console.log("    " + label.padEnd(14) + deal[k]);
}
console.log("");
if (had) {
  console.log("  " + had + " agreement" + (had === 1 ? "" : "s") + " cleared, because the words changed.");
  console.log("");
}
console.log("  Both of them see it pinned above the first message, and each");
console.log("  taps Agree for themselves. Neither can un-agree — that is said");
console.log("  in the room where the other one can read it.");
console.log("");
