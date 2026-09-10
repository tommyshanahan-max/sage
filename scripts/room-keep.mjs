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
 * AND THE WAITING LIST, which is the point of the exercise.
 *
 * Holding a profile takes somebody out of Browse and leaves them nowhere —
 * not in the room and not in the queue, so the number on the door does not
 * move and they have no way back short of being admitted again by hand.
 *
 * Everybody who was let in still has the waiting-list row they were let in
 * from, marked done. Their row is turned back on rather than a new one being
 * written: the original name, the original way of reaching them, the original
 * date they asked. A second row would be the same person asking twice.
 *
 * Most people here never came through the list at all: they were invited
 * directly by a member, so there is no row of theirs to turn back on. Those
 * get a new row written, with the way to reach them taken from the contact
 * card they filled in — the only contact this board holds.
 *
 * Anybody with no card either is held and named, because inventing a way to
 * reach somebody is worse than admitting there isn't one. `make wait-add` puts
 * them on by hand once you know how to reach them.
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
const pad = (v, n) => String(v ?? "").padEnd(n).slice(0, n);

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

/* The rows people were let in from, so the queue step can find them. Read
   before anything is decided, because who needs putting back on the list is
   not the same set as who needs holding — somebody held on an earlier run is
   already out of Browse and still missing from the queue, which is exactly
   the state this had left them in. */
const wd = await fetch(base + "/api/waiting", { headers: head })
  .then((r) => r.json()).catch(() => ({}));
const waits = wd.waits || [];
const byId = new Map(waits.map((w) => [w.id, w]));
/* The board resolves this: person → the invite their device spent → the row it
   was minted for. Exact, and it survives somebody renaming themselves, which
   matching on the handle does not — a person called "j j j" in Browse joined
   the list under something else entirely. Name matching stays as a fallback
   for anybody admitted before that link existed. */
const rowFor = (p) => byId.get(p.fromWait)
  || waits.find((w) => flat(w.name) === flat(p.handle))
  || waits.find((w) => flat(w.name).startsWith(flat(p.handle)) && flat(p.handle).length > 2);

const rest2 = people.filter((p) => !keepIds.has(p.handle));
const toHold = rest2.filter((p) => p.state === "published");
/* Already on the list and open — nothing to do for them. */
const onList = (p) => {
  const w = rowFor(p);
  return w && !w.done;
};
/* Their own row, turned back on. */
const toList = rest2.filter((p) => rowFor(p) && rowFor(p).done === "in");
/* No row, but a way to reach them — a new row. */
const toAdd = rest2.filter((p) => !rowFor(p) && p.reach);
/* No row and no card. Named, and left alone. */
const noRow = rest2.filter((p) => !rowFor(p) && !p.reach);

console.log("");
console.log("  STAYING IN BROWSE");
for (const [w, hits] of matched) {
  for (const p of hits) {
    console.log("    " + p.handle + (flat(p.handle) === flat(w) ? "" : "   \u2190 matched \"" + w + "\""));
  }
}
if (unmatched.length) {
  console.log("");
  console.log("  NOBODY HERE IS CALLED");
  for (const w of unmatched) console.log("    " + w + "   \u2190 check the spelling, this person is NOT protected");
}

if (toHold.length) {
  console.log("");
  console.log("  COMING OUT OF BROWSE \u2014 " + toHold.length);
  for (const p of toHold) console.log("    " + p.handle);
}

if (toList.length) {
  console.log("");
  console.log("  BACK ON THE WAITING LIST \u2014 " + toList.length);
  for (const p of toList) {
    const w = rowFor(p);
    /* The name on the row printed beside the handle when they differ, so a
       wrong match is visible before it is made rather than after. */
    console.log("    " + p.handle +
      (flat(w.name) === flat(p.handle) ? "" : "  \u2192 " + w.name) +
      (p.state === "published" ? "" : "   (already out of Browse)"));
  }
}

if (toAdd.length) {
  console.log("");
  console.log("  ADDED TO THE LIST \u2014 " + toAdd.length +
    "   (they came in on a member's invite, not off the list)");
  for (const p of toAdd) {
    console.log("    " + pad(p.handle, 24) + p.reach +
      (p.state === "published" ? "" : "   (already out of Browse)"));
  }
}

if (noRow.length) {
  console.log("");
  console.log("  OUT, BUT NOT ON THE LIST \u2014 " + noRow.length);
  for (const p of noRow) console.log("    " + p.handle + "   \u2190 no way to reach them on file");
}

if (!toHold.length && !toList.length && !toAdd.length) {
  console.log("");
  console.log("  Nothing to do.");
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
let done = 0, back = 0;
for (const p of toHold) {
  const r = await fetch(base + "/api/person/out", {
    method: "POST", headers: head,
    body: JSON.stringify({ handle: p.handle, back: false }),
  });
  if (r.ok) { done++; console.log("  out of Browse: " + p.handle); }
  else console.log("  FAILED to hold " + p.handle + " (" + r.status + ")");
}
for (const p of toList) {
  const row = rowFor(p);
  const w = await fetch(base + "/api/waiting", {
    method: "POST", headers: head,
    body: JSON.stringify({ id: row.id, done: "" }),
  });
  if (w.ok) { back++; console.log("  back on the list: " + p.handle); }
  else console.log("  FAILED to list " + p.handle + " (" + w.status + ")");
}
for (const p of toAdd) {
  /* Their handle as the name, because it is what this board knows them as and
     what you will recognise in the queue. The list deduplicates on the way of
     reaching somebody, so running this twice does not write them twice. */
  const w = await fetch(base + "/api/waiting/add", {
    method: "POST", headers: head,
    body: JSON.stringify({ name: p.handle, reach: p.reach,
      why: "was in the room, moved back to the list" }),
  });
  if (w.ok) { back++; console.log("  added to the list: " + p.handle); }
  else console.log("  FAILED to add " + p.handle + " (" + w.status + ")");
}
console.log("");
console.log("  " + done + " taken out of Browse, " + back + " back on the list. " +
  keepIds.size + " still in.");
console.log("  Nobody was told and nothing was deleted \u2014 the queue is longer by " +
  back + ", so the number on the door moves.");
console.log('  Put one back in with:  make show WHO="their name"');
console.log("");
