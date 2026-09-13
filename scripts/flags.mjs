/* Lines somebody said should be looked at.
 *
 * THE ONE WAY A WORD SAID INSIDE A ROOM IS READ FROM OUTSIDE IT. A line is
 * here because a person in that room reported it, or because the doorman's
 * tripwire marked it — both of which are somebody saying out loud that this
 * particular line should be looked at.
 *
 * There is no command that prints a room's conversation, and there should not
 * be. Everything on this board is in a file on the box in plain text and the
 * product has never claimed otherwise; a file somebody opens for a reason is a
 * different thing from a screen that shows them conversations, and the second
 * one would have to be written on the privacy page.
 *
 *   make flags
 */

const [, , base, key] = process.argv;
if (!base || !key) {
  console.error("usage: flags.mjs <board url> <admin key>");
  process.exit(2);
}

const r = await fetch(base + "/api/flags", { headers: { "x-admin-secret": key } });
if (!r.ok) { console.error("That did not go through."); process.exit(1); }
const d = await r.json().catch(() => ({}));
const rows = d.flags || [];

if (!rows.length) {
  console.log("");
  console.log("  Nothing flagged. Nobody has reported a line and the doorman's");
  console.log("  tripwire has not fired.");
  console.log("");
  process.exit(0);
}

console.log("");
console.log(rows.length + " flagged, newest first.");
console.log("");
for (const f of rows) {
  /* WHY IT IS HERE, FIRST. "screen:" means the tripwire and nobody in the room
     necessarily minded; anything else is a person in that room typing out a
     reason. They are different things and the first line has to say which. */
  const why = String(f.why || "");
  const auto = why.startsWith("screen:");
  console.log("-".repeat(72));
  console.log((auto ? "  TRIPWIRE  " : "  REPORTED  ") + (auto ? why.slice(7).trim() : why));
  console.log("  " + String(f.at).slice(0, 16).replace("T", " ")
    + "   " + (f.who || "—") + "   in “" + (f.room || "—") + "”");
  if ((f.with || []).length) console.log("  who saw it: " + f.with.join(", "));
  console.log("");
  for (const line of String(f.text || "").split("\n")) console.log("      " + line);
  console.log("");
}
console.log("-".repeat(72));
console.log("");
console.log("Take somebody out of Browse:  make hide WHO=\"their name\"");
console.log("");
