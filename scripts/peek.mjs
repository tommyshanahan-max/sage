/* Who somebody still at the door can browse.
 *
 * The waiting room is a form and a clock. A few members shown outside it turn
 * that into a reason to stay — and then a wall, with a number on it.
 *
 * SHORT ON PURPOSE. Everybody else on this board decided to be in a directory
 * that members read; these few are in one that strangers read. It is not a
 * difference to hand somebody by flipping a switch, which is why it is one
 * name at a time and why the list is meant to stay small.
 *
 *   make peeks
 *   make peek WHO="ray"
 *   make peek-off WHO="ray"
 */

const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error("usage: peek.mjs <board url> <admin key> [--who NAME] [--off]");
  process.exit(2);
}
const arg = (n) => { const i = rest.indexOf("--" + n); return i < 0 ? "" : (rest[i + 1] || ""); };
const who = arg("who");
const off = rest.includes("--off");

const head = { "x-admin-secret": key };

if (!who) {
  const r = await fetch(base + "/api/peek", { headers: head });
  if (!r.ok) { console.error("That did not go through."); process.exit(1); }
  const d = await r.json();
  console.log("");
  console.log("  Browsable from outside the door (" + d.shown.length + " of " + d.max + "):");
  console.log("    " + (d.shown.join("  ") || "nobody yet"));
  console.log("");
  if (d.could.length) {
    console.log("  Could be:");
    console.log("    " + d.could.join("  "));
    console.log("");
    console.log('  make peek WHO="' + d.could[0] + '"');
    console.log("");
  }
  process.exit(0);
}

const r = await fetch(base + "/api/peek", {
  method: "POST", headers: { ...head, "Content-Type": "application/json" },
  body: JSON.stringify({ who, on: !off }),
});
const d = await r.json().catch(() => ({}));
if (!r.ok) {
  console.log("");
  console.log("  No published member called " + who + ".");
  console.log("  make peeks   to see who there is.");
  console.log("");
  process.exit(1);
}
console.log("");
console.log(off
  ? "  " + d.who + " is no longer shown outside the door."
  : "  " + d.who + " is now browsable by people at the door.");
console.log("");
