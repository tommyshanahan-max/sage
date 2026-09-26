/* WHOSE PHOTOGRAPH IS NOT SHOWING, AND WHY — and putting one back.
 *
 * THE REPORT THAT MADE THIS. "Her photo got removed when she was put on the
 * waiting list." It was not removed. A picture uploaded at the door goes onto
 * the waiting row as "held" — nobody has looked at it yet — and when that row
 * becomes a person the state comes across unchanged, on purpose: carrying the
 * state rather than the permission is the difference between moving somebody
 * and approving them. The consequence is that the photograph disappears from
 * every screen at the moment they are let in, which from the outside is
 * exactly what a failed upload looks like.
 *
 * Three places it can be, three different answers:
 *
 *   held     on their row, waiting to be looked at   -> release it
 *   behind   still on the waiting row they came in on -> copy it across
 *   gone     nowhere                                  -> they must upload again
 *
 *   make faces                  who is missing one, and which of the three
 *   make faces WHO="Nicole"     put hers back
 */
const [, , base, key, who] = process.argv;
if (!base || !key) {
  console.error("usage: faces.mjs <board url> <admin key> [who]");
  process.exit(2);
}
const WHO = String(who || "").trim();

const head = { "x-admin-secret": key };
const say = (m) => console.log(m);

if (WHO) {
  const r = await fetch(base + "/api/admin/face-fix", {
    method: "POST", headers: { ...head, "content-type": "application/json" },
    body: JSON.stringify({ who: WHO }), signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  const d = r ? await r.json().catch(() => null) : null;
  console.log("");
  if (!r || !d) { say("  The board did not answer. Is it up?  make ps"); say(""); process.exit(1); }
  if (d.error === "nobody") {
    /* THE COMMONEST WAY THIS FAILS, and it is worth spending three lines on.
       The name on somebody's profile is the handle THEY chose, which is not
       always the name they were introduced by — and "Not on this board" reads
       as the person being missing when they are not. */
    say("  Nobody here is called “" + WHO + "”, by that name or by a first name.");
    if (d.near && d.near.length) {
      /* THE NEAR ONES, AS COMMANDS. The name on a profile is the handle they
         chose and it is often spelled differently from the way it is said —
         Lisa is Liza here. Printing the list is the answer; making him go and
         run make who and come back is three commands for one letter. */
      say("");
      say("  Did you mean one of these?");
      say("");
      for (const h of d.near) say("    make faces WHO=\"" + h + "\"");
    } else {
      say("  The name on a profile is the handle they chose, which is not always");
      say("  the name you know them by.  make who lists them.");
    }
  } else if (d.error === "two") {
    say("  “" + WHO + "” matches " + d.n + " people here:");
    say("");
    for (const h of d.who || []) say("    make faces WHO=\"" + h + "\"");
    say("");
    say("  It will not guess between them. Publishing the wrong person's face");
    say("  is not a thing that can be undone once somebody has seen it.");
  } else if (d.error === "gone") {
    say("  " + d.handle + " has no photograph anywhere — not on their row and not");
    say("  on the waiting row they came in on. There is nothing to put back;");
    say("  they have to upload one again.");
  } else {
    say("  " + d.handle + "'s photograph is showing again.");
    /* WHICH OF THE TWO IT WAS, off the flag the board set before it moved
       anything — not guessed from the state afterwards, which is how the
       first version of this reported a picture that had never come across at
       all as one that had been sitting on the row the whole time. */
    if (d.was && d.was.from === "wait") {
      say("  It was still on the waiting row they came in on, and had never come across.");
    } else if (d.was && d.was.photoState) {
      say("  It was “" + d.was.photoState + "” — on their row the whole time, never looked at.");
    }
    if (d.admitted) {
      /* SAID OUT LOUD, because it is the bigger of the two things that just
         happened. A face on a held profile shows nowhere, so this cannot
         publish one without the other — but letting somebody INTO the board
         is not what he asked for, and finding it out afterwards is worse. */
      say("");
      say("  Their profile was held and is now published as well. A face on a held");
      say("  profile shows nowhere, so the two go together — but that is somebody");
      say("  admitted, not just a picture. make hide WHO=\"" + d.handle + "\" undoes it.");
    }
  }
  say("");
  process.exit(0);
}

const r = await fetch(base + "/api/admin/faces-why", { headers: head, signal: AbortSignal.timeout(20_000) })
  .catch(() => null);
if (!r) { console.log("\n  The board did not answer. Is it up?  make ps\n"); process.exit(1); }
if (r.status === 401 || r.status === 403) {
  console.log("\n  The board refused the key (" + r.status + ").\n"); process.exit(1);
}
const d = await r.json().catch(() => null);
if (!d || !Array.isArray(d.people)) {
  console.log("\n  The board answered " + r.status + " with nothing readable.");
  console.log("  If it has not been deployed since this command was written, that is why.\n");
  process.exit(1);
}

const WORDS = {
  held:   "on their row, never looked at",
  behind: "still on the waiting row",
  gone:   "no photograph anywhere",
};
/* NOT ON THE BOARD AT ALL, FIRST AND SEPARATELY.
 *
 * "Her photo is missing" and "she is not there" are the same absence from
 * outside, and this command used to answer only the first — so a face could
 * be released, reported as fixed, and the screen go on showing nothing
 * because the person was never in Browse to begin with. That is a different
 * afternoon's work and it goes above, not mixed in. */
const away = d.people.filter((q) => q.notThere);
if (away.length) {
  console.log("  NOT IN BROWSE AT ALL  (" + away.length + ")");
  console.log("");
  for (const q of away) {
    /* A NAME WIDER THAN ITS COLUMN RAN STRAIGHT INTO THE REASON — "Liza
       Landazuri KovalenkoShow me in Browse is off". padEnd does nothing when
       the string is already longer, so a fixed column is only a column for
       the names that happen to fit, and full-name handles are half of this
       board. Two spaces at minimum, always. */
    const nm = String(q.handle || "(no name)");
    console.log("  " + nm + " ".repeat(Math.max(2, 26 - nm.length)) + q.notThere);
  }
  console.log("");
  console.log("  A photograph on one of these shows nowhere until that is fixed.");
  console.log("  make who says the same thing with the rest of the detail.");
  console.log("");
}

const missing = d.people.filter((q) => !q.showing && q.inBrowse);
const showing = d.people.length - missing.length;
console.log("");
if (!missing.length) {
  console.log("  Everybody with a page has their photograph showing. "
    + "(" + showing + " of " + d.people.length + ")");
  console.log("");
  process.exit(0);
}
console.log("  NOT SHOWING  (" + missing.length + " of " + d.people.length + ")");
console.log("");
for (const q of missing) {
  const nm = String(q.handle);
  console.log("  " + nm + " ".repeat(Math.max(2, 26 - nm.length))
    + String(WORDS[q.why] || q.why).padEnd(32)
    + (q.alsoAdmits ? "profile held too" : ""));
}
console.log("");
/* THE FIXABLE ONES COUNTED SEPARATELY. "Six people have no photograph" and
   "six photographs are sitting here waiting to be let out" are the same row
   count and completely different afternoons. */
const fixable = missing.filter((q) => q.why !== "gone");
if (fixable.length) {
  console.log("  " + fixable.length + (fixable.length === 1 ? " is" : " are")
    + " there and can be put back now:");
  for (const q of fixable.slice(0, 6)) console.log("    make faces WHO=\"" + q.handle + "\"");
  if (fixable.length > 6) console.log("    …and " + (fixable.length - 6) + " more");
} else {
  console.log("  None of them is recoverable from here — they have to upload again.");
}
console.log("");
