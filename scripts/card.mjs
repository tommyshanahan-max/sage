/* A card on the board for somebody who is not holding a phone.
 *
 * WHY THIS EXISTS. The board is joined by a person: a code, a browser, a
 * sentence they choose. That is the right way and it stays the only way most
 * people arrive. But the first members of a private board are not people who
 * signed up — they are people the operator knows and brought, and the page
 * they land on has to already be worth landing on. Damon, Nathin and Keith
 * were each put up this way, by hand, before this script existed; all it does
 * is stop that being by hand.
 *
 * WHAT IT IS NOT. `make demo` invents people, and refuses to act as anybody
 * who exists, for a good reason — a row saying somebody did something they did
 * not do is the one thing that makes the whole board worth nothing. This is
 * the opposite case and it has its own rule:
 *
 *   ONLY FOR SOMEBODY REAL, WHOSE CARD YOU COULD READ OUT TO THEM.
 *
 * The line on the card is written here and shown to everybody as theirs. That
 * is a thing to do for somebody you know, with facts they have told you, in
 * words they would recognise — not a way to fill a board up. If you would not
 * send them the card and expect "yes, that's me", do not put it up.
 *
 * AND THEY CAN TAKE IT OVER. The card is made against a device this script
 * derives from their name, which is a browser nobody is sitting at. One
 * command hands it to them for real:
 *
 *   make back WHO="Ray Chen"
 *
 * — six characters, typed at the door on their own phone, and the page moves
 * onto it. After that it is theirs and this script will not touch it: run it
 * again on the same name and it edits the same row, which is what you want
 * while you are still writing it and not what you want afterwards, so it says
 * plainly when the row has moved.
 *
 *   make card NAME="Ray Chen" ME=investor WANT=producer LINE="..."
 *   make card NAME="Ray Chen" LINE="..."        (edit the line, keep the rest)
 */

import { createHash } from "node:crypto";

const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error('usage: card.mjs <board url> <admin key> --name NAME [--me ROLE] [--want ROLE] [--line "..."] [--by WHO]');
  process.exit(2);
}
const arg = (n, d = "") => { const i = rest.indexOf("--" + n); return i < 0 ? d : (rest[i + 1] || d); };

const name = arg("name").trim();
const me = arg("me").trim().toLowerCase();
const want = arg("want").trim().toLowerCase();
const line = arg("line").trim();
const by = arg("by", "Tom").trim();

if (!name) {
  console.error('  whose card? make card NAME="Ray Chen" ME=investor WANT=producer LINE="..."');
  process.exit(1);
}

const head = { "x-admin-secret": key, "Content-Type": "application/json" };
const call = async (path, opts = {}) => {
  const r = await fetch(base + path, { ...opts, headers: { ...head, ...(opts.headers || {}) } });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, d };
};

/* THE BROWSER THIS CARD HANGS OFF, and it is derived rather than random so
   that running this twice for one person edits one row instead of making two.
   Not a secret and not meant to be one: it is a placeholder identity, and the
   moment the person takes the page over with `make back` it stops mattering
   what it was. */
const device = "card-" + createHash("sha256").update("card:" + name.toLowerCase()).digest("hex").slice(0, 24);

const people = await call("/api/people");
if (!people.ok) {
  console.error("  The board did not answer. Is it up?");
  process.exit(1);
}
const already = (people.d.people || []).find(
  (q) => String(q.handle || "").toLowerCase() === name.toLowerCase());

/* NEW, so it goes through the door the way anybody does: a code, and a browser
   that spends it. Nothing here writes a member row directly — the one route
   that makes members is the one everybody else uses, so a card made here is
   the same shape as a card made by a person. */
if (!already) {
  if (!me || !want) {
    console.log("");
    console.log("  " + name + " is new, so the sentence has to be on the first run:");
    console.log('    make card NAME="' + name + '" ME=investor WANT=producer LINE="..."');
    console.log("");
    console.log("  Roles: director writer performer crew founder maker student");
    console.log("         agent producer brand investor lawyer");
    console.log("");
    process.exit(1);
  }
  const inv = await call("/api/invite", { method: "POST", body: JSON.stringify({ n: 1, who: by }) });
  const code = inv.ok && inv.d?.made?.[0]?.code;
  if (!code) { console.error("  Could not mint a code."); process.exit(1); }
  const enter = await call("/api/enter", { method: "POST", body: JSON.stringify({ code, device }) });
  if (!enter.ok) { console.error("  The door refused the code."); process.exit(1); }
}

/* The card itself. `looking` is what puts them in Browse at all — a published
   page with it off is a person nobody is shown, which is a switch that exists
   and is not what anybody means by "make a card". */
const body = { device, handle: name, looking: true };
if (line) body.goal = line;
if (me && want) body.say = [{ me, want }];

const put = await call("/api/me", { method: "PUT", opts: null, body: JSON.stringify(body) });
if (!put.ok) {
  console.log("");
  if (put.d?.error === "contact") {
    /* The rule the whole board runs on, and this is the one place it would be
       easiest to break: a line written by the operator, about somebody else,
       with their WeChat id helpfully included. */
    console.log("  That line has a way to reach them in it, which cards may not carry.");
    console.log("  Say what they do. The room is where people talk.");
  } else if (already) {
    /* The likely cause, and it is the good one: they took the page over. */
    console.log("  " + name + "'s page did not take that.");
    console.log("  If they have taken it over with `make back`, it is theirs now —");
    console.log("  this script cannot write to it and should not.");
  } else {
    console.log("  That did not go through.");
  }
  console.log("");
  process.exit(1);
}

console.log("");
console.log("  " + name + (already ? " — card updated." : " is on the board."));
if (me && want) console.log("  Says:  " + me + " looking for " + want);
if (line) console.log("  Line:  " + line);
console.log("");
console.log("  Shown to members now. Two more things you may want:");
console.log("");
console.log('    make peek WHO="' + name + '"     shown to people at the door too');
console.log('    make back WHO="' + name + '"     six characters, and the page is theirs');
console.log("");
console.log("  No photograph on it yet — that is the slot worth the most.");
console.log("  The panel's People tab takes one from the machine you are sitting at.");
console.log("");
