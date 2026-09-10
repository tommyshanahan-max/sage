/* Why a person in the room has no waiting row, told from the data itself.
 *
 *   make why-no-row
 *
 * Reads /data/board.json directly rather than asking the API, because the
 * question is about fields the API deliberately does not hand out — a device
 * hash is the middle of the chain and has no business leaving the box. This
 * runs inside the container that already has the file.
 *
 * The chain that is supposed to exist:
 *
 *   person.by  →  invite.usedBy  →  invite.who  →  a wait row of that name
 *
 * It can break at any of the three, and which one it broke at is the whole
 * answer: a person with no `by` never redeemed an invite at all, an invite
 * with no matching row was minted by hand, and a name that matches nothing
 * means the row was renamed or removed after they came through it.
 */

import { readFile } from "node:fs/promises";

const file = process.argv[2] || "/data/board.json";
const board = JSON.parse(await readFile(file, "utf8"));
const people = board.people || [];
const invites = board.invites || [];
const waits = board.waits || [];

const flat = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const spent = new Map(invites.filter((v) => v.usedBy).map((v) => [v.usedBy, v]));
const byName = new Map(waits.map((w) => [flat(w.name), w]));

const pad = (s, n) => String(s ?? "").padEnd(n).slice(0, n);

console.log("");
console.log(pad("who", 26) + pad("device?", 9) + pad("invite?", 9) +
  pad("minted for", 22) + "row?");
console.log("-".repeat(78));

const tally = { fine: 0, noDevice: 0, noInvite: 0, noRow: 0 };
for (const q of people) {
  const dev = Boolean(q.by);
  const v = dev ? spent.get(q.by) : null;
  const who = v ? v.who : "";
  const row = who ? byName.get(flat(who)) : null;
  let verdict;
  if (!dev) { verdict = "— never redeemed an invite"; tally.noDevice++; }
  else if (!v) { verdict = "— no invite carries this device"; tally.noInvite++; }
  else if (!row) { verdict = "— nothing on the list by that name"; tally.noRow++; }
  else { verdict = row.done === "in" ? "yes (marked in)" : "yes (" + (row.done || "waiting") + ")"; tally.fine++; }
  console.log(pad(q.handle || "—", 26) + pad(dev ? "yes" : "no", 9) +
    pad(v ? "yes" : "no", 9) + pad(who || "—", 22) + verdict);
}

console.log("");
console.log("  " + people.length + " people · " + tally.fine + " trace back to a row");
if (tally.noDevice) console.log("  " + tally.noDevice + " never redeemed an invite — they were let in some other way");
if (tally.noInvite) console.log("  " + tally.noInvite + " have a device no invite records spending");
if (tally.noRow) console.log("  " + tally.noRow + " came in on an invite minted for a name the list no longer holds");
console.log("");
console.log("  " + waits.length + " rows on the list · " +
  waits.filter((w) => !w.done).length + " waiting · " +
  waits.filter((w) => w.done === "in").length + " marked in · " +
  waits.filter((w) => w.done === "no").length + " turned down");
console.log("");
