/* A LETTER TO EVERYBODY, REHEARSED BEFORE IT IS SENT.
 *
 * "we shoiudl emial eveyroen to come to platform."
 *
 * The one-to-one mail already works — somebody writes to you, you do not read
 * it, an hour later it is in your inbox. This is the other kind, and the two
 * are different things: one is the app doing its job, the other is a mailing
 * list. A mailing list that goes wrong takes the first kind down with it,
 * because they leave from the same domain.
 *
 * SO THE FIRST THING THIS PRINTS IS HOW MANY PEOPLE CAN BE REACHED AT ALL.
 * "Email everybody" is a different job depending on whether everybody is four
 * people or four hundred, and that number is not on any screen.
 *
 *   make mailout            who would get it, and exactly what they would read
 *   make mailout SEND=1     send it
 *
 * Nothing leaves the box without SEND=1. Once per person per day, stamped
 * before the first one goes. Every letter carries a one-press way out that is
 * honoured for ever and stops only these.
 */
const [, , base, key, send, origin] = process.argv;
if (!base || !key) {
  console.error("usage: mailout.mjs <board url> <admin key> <send> <origin>");
  process.exit(2);
}
const SEND = String(send) === "true";
const head = { "x-admin-secret": key };
const say = (m) => console.log(m);
const die = (m) => { say("\n  " + m + "\n"); process.exit(1); };

const r0 = await fetch(base + "/api/admin/reach", { headers: head,
  signal: AbortSignal.timeout(20_000) }).catch(() => null);
if (!r0) die("The board did not answer. Is it up?  make ps");
if (r0.status === 401 || r0.status === 403) die("The board refused the key (" + r0.status + ").");
const reach = await r0.json().catch(() => null);
if (!reach) die("The board answered " + r0.status + " with nothing readable.\n"
  + "  If it has not been deployed since this command was written, that is why.");

say("");
say("  WHO CAN BE REACHED");
say("");
say("    on the board      " + reach.people);
say("    with an address   " + reach.reachable);
if (reach.optedOut) say("    asked not to      " + reach.optedOut);
if (reach.hadToday) say("    had one today     " + reach.hadToday);
say("    on the list       " + reach.waiting + "  (not members — this letter is not for them)");
say("");
if (!reach.configured) {
  say("  MAIL IS NOT CONFIGURED on this board. Nothing can be sent until it is.");
  say("");
  process.exit(0);
}
if (!reach.reachable) {
  say("  Nobody has left an address, so there is nobody to write to.");
  say("  That is the thing to fix first, and it is not a mail problem:");
  say("  the app asks for an address as a way back in on a new phone, so");
  say("  most people skip it.");
  say("");
  process.exit(0);
}

const r = await fetch(base + "/api/admin/mailout", {
  method: "POST", headers: { ...head, "content-type": "application/json" },
  body: JSON.stringify({ send: SEND, origin }),
  // A send is one letter a second, on purpose. Long enough for a full list.
  signal: AbortSignal.timeout(SEND ? 20 * 60_000 : 30_000),
}).catch(() => null);
if (!r) die("The send did not come back. Check  make logs  before running it again —\n"
  + "  the rows are stamped before the first letter goes, so a second run\n"
  + "  will not repeat what already left.");
const d = await r.json().catch(() => null);
if (!d) die("The board answered " + r.status + " with nothing readable.");
if (d.error === "unconfigured") die("Mail is not configured on this board.");
if (d.error === "origin") die("No public address set. BOARD_PUBLIC decides what the links say.");
if (d.error) die("The board refused: " + d.error);

if (d.dry) {
  say("  NOTHING HAS BEEN SENT. This is what would go.");
  say("");
  if (!d.n) {
    say("    Nobody is due one. Everybody reachable has had today's, or asked out.");
    say("");
    process.exit(0);
  }
  /* THE WHOLE OF ONE LETTER, not a summary of it. The only way to know
     whether a letter is worth sending is to read one, and the one that
     matters is the one with somebody's real name and real number in it. */
  const first = d.letters[0];
  say("    " + d.n + (d.n === 1 ? " letter" : " letters") + ", one a second.");
  say("");
  say("  THE FIRST ONE, IN FULL");
  say("");
  say("    to       " + first.to);
  say("    subject  " + first.subject);
  say("");
  for (const line of String(first.text).split("\n")) say("    " + line);
  say("");
  say("  AND THE HOOK EACH OF THE OTHERS GETS");
  say("");
  for (const m of d.letters.slice(0, 12)) {
    const nm = String(m.handle);
    say("    " + nm + " ".repeat(Math.max(2, 20 - nm.length)) + m.subject);
  }
  if (d.letters.length > 12) say("    …and " + (d.letters.length - 12) + " more");
  say("");
  say("  Send it:   make mailout SEND=1");
  say("");
  process.exit(0);
}

say("  SENT " + d.sent + " of " + d.n + ".");
if (d.bad && d.bad.length) {
  say("");
  say("  These did not go: " + d.bad.join(", "));
  say("  They are stamped as sent either way — run with AGAIN=1 to retry them,");
  say("  and only if you are sure they did not arrive.");
}
say("");
