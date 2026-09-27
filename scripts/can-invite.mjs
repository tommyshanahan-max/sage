/* WHO CAN BRING SOMEBODY IN, AND WHAT IS STOPPING THE REST.
 *
 * THE REPORT THAT MADE THIS. "i just tried to add someone new from the chat
 * page, it doesnt seem to work." Three different faults wear that one
 * sentence, and only one of them is visible from a phone:
 *
 *   the screen    it was three taps deep and the middle one was a sheet
 *                 saying "Nobody yet" — fixed in notes.html
 *   the refusal   it said "your profile page says what is left", which is a
 *                 dead end — it now names the one thing to do
 *   the member    somebody with no photograph on their row cannot bring
 *                 anybody in at all, and there is no way to see that from
 *                 the outside. That is this command.
 *
 * Bringing people in is rationed on purpose — see standing() in server.js —
 * and the rationing is invisible until somebody tries. This makes it readable
 * without opening anybody's profile.
 *
 *   make can-invite                everybody, and who is blocked
 *   make can-invite WHO="Tom"      one person
 */
import { boardFetch } from "./wait-board.mjs";
const [, , base, key, who] = process.argv;
if (!base || !key) {
  console.error("usage: can-invite.mjs <board url> <admin key> [who]");
  process.exit(2);
}
const WHO = String(who || "").trim();
const say = (m) => console.log(m);

const url = base + "/api/admin/can-invite"
  + (WHO ? "?who=" + encodeURIComponent(WHO) : "");
/* boardFetch, NOT fetch: run straight after `make board` this lands on a
   container that has restarted and is not listening yet. See wait-board.mjs. */
const r = await boardFetch(url, { headers: { "x-admin-secret": key },
  signal: AbortSignal.timeout(20_000) }).catch(() => null);
if (!r) { say("\n  The board did not answer. Is it up?  make ps\n"); process.exit(1); }
if (r.status === 401 || r.status === 403) {
  say("\n  The board refused the key (" + r.status + ").\n"); process.exit(1);
}
const d = await r.json().catch(() => null);
if (!d) {
  say("\n  The board answered " + r.status + " with nothing readable.");
  say("  If it has not been deployed since this command was written, that is why.\n");
  process.exit(1);
}

say("");
if (d.error === "nobody") {
  /* The name on a profile is the handle THEY chose, which is not always the
     name they are introduced by. Same trap as make faces. */
  say("  Nobody here is called “" + WHO + "”, by that name or by a first name.");
  if (d.near && d.near.length) {
    say("");
    for (const h of d.near) say("    make can-invite WHO=\"" + h + "\"");
  }
  say("");
  process.exit(0);
}
if (d.error === "two") {
  say("  “" + WHO + "” matches " + d.n + " people here:");
  say("");
  for (const h of d.who || []) say("    make can-invite WHO=\"" + h + "\"");
  say("");
  process.exit(0);
}

/* THE ONE THING TO DO, in the order the tests run in — somebody missing two
   of them is told the first, because that is the next thing they can act on
   and a list of three is a list nobody reads. */
const WORDS = {
  face: "no photograph on their profile",
  days: "joined too recently — tomorrow",
  said: "has posted nothing on the feed this week",
};

const rows = d.people || [];
if (!rows.length) { say("  Nobody has a page yet.\n"); process.exit(0); }
const can = rows.filter((q) => q.can);
const no = rows.filter((q) => !q.can);

if (!no.length) {
  say("  Everybody with a page can bring somebody in. (" + can.length + ")");
  say("");
  process.exit(0);
}

say("  CANNOT BRING ANYBODY IN  (" + no.length + " of " + rows.length + ")");
say("");
for (const q of no) {
  const nm = String(q.handle || "(no name)");
  const first = ["face", "days", "said"].find((k) => (q.need || []).includes(k));
  /* A name wider than its column runs straight into the reason if padEnd is
     trusted — it does nothing to a string that is already longer, and half
     the handles on this board are full names. Two spaces at minimum. */
  say("  " + nm + " ".repeat(Math.max(2, 26 - nm.length))
    + (WORDS[first] || (q.need || []).join(", ") || "—"));
}
say("");
if (no.some((q) => (q.need || []).includes("face"))) {
  say("  A photograph is the commonest one, and it is the one that looks like");
  say("  a broken button from a phone.  make faces  says whose is missing and");
  say("  can put one back where the board already has it.");
  say("");
}
/* AND WHO CAN, because "two people are blocked" and "two of forty are
   blocked" are the same list and completely different mornings. */
if (can.length) {
  say("  " + can.length + " of " + rows.length + " can bring somebody in"
    + (can.length <= 4 ? ": " + can.map((q) => q.handle).join(", ") : "."));
  say("");
}
