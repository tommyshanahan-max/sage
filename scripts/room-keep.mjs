/* Keep these people in Browse, take everybody else out.
 *
 *   make room-keep KEEP="Keith,Axel,Hugo"     shows what it would do
 *   make room-keep KEEP="Keith,Axel,Hugo" GO=1   does it
 *
 * WHY IT PREVIEWS BY DEFAULT.
 *
 * This is the only command here that acts on everybody at once, and the names
 * are typed by hand at the moment of use. One letter wrong in a name to keep
 * and that person is removed along with the rest — quietly, because nothing
 * on this board announces anything. So the default is to print the two lists
 * and stop, and GO=1 is a second, deliberate keystroke.
 *
 * WHAT IT ACTUALLY DOES, which is less than "remove".
 *
 * Each person's state goes back to held, which is where every profile starts.
 * They leave Browse and their public page stops answering. Nothing is deleted,
 * their posts stay where they are, their own profile looks the same to them,
 * and they are not told. It is undone one at a time with `make show WHO=...`,
 * or by running this again with a longer KEEP.
 *
 * It does not touch the waiting list. A held profile and a waiting-list row
 * are different things: the row is somebody asking to come in, and rewriting
 * history so that a member who was already let in looks like they never were
 * is not something this should do behind a name-matching heuristic.
 */

const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error('usage: room-keep.mjs <board url> <admin key> --keep "A,B,C" [--go]');
  process.exit(2);
}
const arg = (n) => {
  const i = rest.indexOf("--" + n);
  return i >= 0 && rest[i + 1] ? rest[i + 1] : "";
};
const go = rest.includes("--go");
const head = { "x-admin-secret": key, "Content-Type": "application/json" };

/* Names are compared with the punctuation and case taken out, because they are
   typed from memory into a terminal and "O'Brien" is not going to survive that
   twice the same way. */
const flat = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const want = arg("keep").split(",").map((s) => s.trim()).filter(Boolean);
if (!want.length) {
  console.error('Who stays? make room-keep KEEP="Keith,Axel,Hugo"');
  process.exit(2);
}

const d = await fetch(base + "/api/public?queue=1", { headers: head })
  .then((r) => r.json()).catch(() => ({}));
const people = (d.people || []).filter((p) => p.handle);
if (!people.length) {
  console.log("\n  Nobody has a page yet.\n");
  process.exit(0);
}

/* Matched by prefix as well as in full: somebody entered as "Christopher" is
   found by "Chris", and the match is printed so a wrong one is visible before
   anything happens rather than after. */
const matched = new Map();
const unmatched = [];
for (const w of want) {
  const f = flat(w);
  const hit = people.filter((p) => flat(p.handle) === f)
    .concat(people.filter((p) => flat(p.handle).startsWith(f) && flat(p.handle) !== f));
  if (!hit.length) unmatched.push(w);
  else matched.set(w, hit);
}

const keepIds = new Set();
for (const hits of matched.values()) for (const p of hits) keepIds.add(p.handle);
const going = people.filter((p) => !keepIds.has(p.handle) && p.state === "published");

console.log("");
console.log("  STAYING IN BROWSE");
for (const [w, hits] of matched) {
  for (const p of hits) {
    console.log("    " + p.handle + (flat(p.handle) === flat(w) ? "" : "   ← matched \"" + w + "\""));
  }
}
if (unmatched.length) {
  console.log("");
  console.log("  NOBODY HERE IS CALLED");
  for (const w of unmatched) console.log("    " + w + "   ← check the spelling, this person is NOT protected");
}

console.log("");
console.log("  COMING OUT OF BROWSE — " + going.length);
for (const p of going) console.log("    " + p.handle);

const already = people.filter((p) => !keepIds.has(p.handle) && p.state !== "published");
if (already.length) {
  console.log("");
  console.log("  already out, left alone — " + already.length);
}

if (!go) {
  console.log("");
  console.log("  Nothing has happened. Run it again with GO=1 to do it.");
  if (unmatched.length) {
    console.log("  Fix the spellings above first — those people would be removed.");
  }
  console.log("");
  process.exit(0);
}

console.log("");
let done = 0;
for (const p of going) {
  const r = await fetch(base + "/api/person/out", {
    method: "POST", headers: head,
    body: JSON.stringify({ handle: p.handle, back: false }),
  });
  if (r.ok) { done++; console.log("  out: " + p.handle); }
  else console.log("  FAILED: " + p.handle + " (" + r.status + ")");
}
console.log("");
console.log("  " + done + " out of Browse. " + keepIds.size + " still in.");
console.log("  Nobody was told and nothing was deleted.");
console.log('  Put one back with:  make show WHO="their name"');
console.log("");
