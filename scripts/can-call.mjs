/* CAN I CALL THIS PERSON, AND AM I SHOWING THEM TO STRANGERS.
 *
 * TWO QUESTIONS THAT USED TO BE ONE, AND THAT WAS THE BUG. "i coudlnt call
 * axel or hugo", then "the buttons still dont work for Hugo and Axel" — and
 * the answer both times was that their row sat in the review queue, which the
 * board was reading as a reason nobody already talking to them could call
 * them either. That rule is gone: see onBoard in server.js, and "every persopn
 * shoild have access to all the function at least for now".
 *
 * So this prints both, per person:
 *
 *   call    whether every button in a conversation with them works. Only a
 *           deleted row, a refused one, a row with no name, or a block closes
 *           this — and a block is not the operator's to undo.
 *   browse  whether a stranger scrolling Browse is shown them. A review hold
 *           is yours and this command clears it; "Show me in Browse" is
 *           theirs and nobody else can touch it.
 *
 *   make can-call WHO="Axel Hugo"     these people
 *   make can-call                     everybody not in Browse
 */
import { boardFetch } from "./wait-board.mjs";
const [, , base, key, who] = process.argv;
if (!base || !key) {
  console.error("usage: can-call.mjs <board url> <admin key> [names]");
  process.exit(2);
}
const say = (m) => console.log(m);

/* Space-separated, so one WHO carries the whole question. The house rule is
   that WHO is a first name; here it is a list of them, because "can I call
   Axel" and "can I call Hugo" are one question asked about two people and
   running the command twice is the thing this exists to stop. */
const WANT = String(who || "").trim().split(/\s+/).filter(Boolean);

/* boardFetch, NOT fetch — see wait-board.mjs. */
const r = await boardFetch(base + "/api/public?queue=1", {
  headers: { "x-admin-secret": key }, signal: AbortSignal.timeout(20_000) })
  .catch(() => null);
if (!r) { say("\n  The board did not answer. Is it up?  make ps\n"); process.exit(1); }
if (r.status === 401 || r.status === 403) {
  say("\n  The board refused the key (" + r.status + ").\n"); process.exit(1);
}
const d = await r.json().catch(() => null);
const people = (d && d.people) || [];
if (!people.length) { say("\n  Nobody has made a page yet.\n"); process.exit(0); }

/* Matched on the first name, case-insensitively, because that is what Tom
   types — "Axel" for "Axel Bergström". A name that matches two people is said
   rather than guessed at: picking one of two Bens and publishing them is the
   kind of quiet wrong answer this command exists to stop. */
const first = (h) => String(h || "").trim().split(/\s+/)[0].toLowerCase();
const find = (name) => people.filter((q) =>
  first(q.handle) === name.toLowerCase()
  || String(q.handle || "").toLowerCase() === name.toLowerCase());

/* CALLING: the same rule onBoard applies on the server, said here so the
   command and the board cannot disagree. A block is not visible from this
   route and is not the operator's to undo, which is said in the footer. */
const canCall = (q) => Boolean(q.handle)
  && q.state !== "removed" && q.state !== "refused";

/* BROWSE: the three reasons who.mjs prints, in the order they bite. A page
   with no name is not a page yet; then the review hold, which is yours; then
   their own switch, which is not. */
const why = (q) => !q.handle ? "nameless"
  : q.state !== "published" ? (q.hasCard ? "held" : "blank")
  : !q.looking ? "theirs" : "";

const rows = WANT.length
  ? WANT.map((n) => ({ name: n, found: find(n) }))
  : people.filter((q) => why(q)).map((q) => ({ name: q.handle, found: [q] }));

if (!rows.length) { say("\n  Everybody with a page can be called.\n"); process.exit(0); }

let fixed = 0, shown = 0;
say("");
for (const row of rows) {
  if (!row.found.length) {
    say("  " + row.name + " — nobody here is called that.  make who");
    continue;
  }
  if (row.found.length > 1) {
    say("  " + row.name + " — " + row.found.length + " people share that name: "
      + row.found.map((q) => q.handle).join(", "));
    say("    Use the whole handle.");
    continue;
  }
  const q = row.found[0];
  const w = why(q);

  /* THE CALL LINE FIRST, because that is the question that gets asked. */
  if (canCall(q)) {
    say("  " + q.handle + " — you can call them, and every other button works.");
  } else if (!q.handle) {
    say("  " + q.handle + " — the form was never finished, so there is no page");
    say("    and nothing to call. Nothing to do here but ask them.");
  } else {
    say("  " + q.handle + " — the row is " + q.state + ". Nothing works, and that");
    say("    is deliberate — put it back with  make show WHO=\"" + q.handle + '"');
  }

  /* AND WHETHER STRANGERS SEE THEM, which is the separate question. */
  if (!w) { shown++; continue; }
  if (w === "held") {
    /* THE ONE THIS COMMAND CAN FIX. A hold is the review queue and the review
       queue is the operator's; it no longer stops a call, but it does stop
       Browse, and eight people were sitting in it unmentioned. */
    const put = await fetch(base + "/api/person/out", {
      method: "POST",
      headers: { "x-admin-secret": key, "Content-Type": "application/json" },
      body: JSON.stringify({ handle: q.handle, back: true }),
    }).catch(() => null);
    if (put && put.ok) {
      say("    Was held for review and not in Browse. Put back.");
      fixed++;
    } else {
      say("    Held for review; putting them back failed ("
        + (put ? put.status : "no answer") + ").");
    }
    continue;
  }
  if (w === "theirs") {
    say("    Not in Browse: \"Show me in Browse\" is off on their own phone.");
    say("    Only they can turn that on. It is under their name.");
    continue;
  }
  if (w === "blank") {
    say("    Not in Browse, and the page is empty — no sentence, no line.");
    say("    Putting them back would be a name over a blank card. Ask them to");
    say("    write something first; you are already in a room with them.");
  }
}
say("");
if (fixed) {
  say("  " + fixed + " put into Browse. Nothing else about " + (fixed === 1
    ? "them" : "them") + " changed — the same posts, the same matches, the");
  say("  same profile.");
}
if (shown) say("  " + shown + (shown === 1 ? " was" : " were") + " already in Browse.");
/* THE ONE THING THIS CANNOT SEE. A block is between two people and this
   command reads the board, not a pair — so a button that is still grey after
   all of the above is the one case left, and it is not the operator's. */
say("  A button still grey after this is a block, which is between the two of");
say("  them and is not yours to undo.");
say("");
