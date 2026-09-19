/* Where somebody's money lands — the link that sets it, from the terminal.
 *
 *   make payout WHO="Tom"
 *
 * WHY THIS EXISTS. Setting up payouts is the one thing a payee does for
 * themselves: the app gives them a button, Stripe takes their bank and their
 * identity on its own pages, and hands an account id back. That is right, and
 * it leaves one person with no way in.
 *
 * `make go-live` clears every payout account on the board. It has to — an
 * account minted under a test key does not exist under a live one, and a row
 * still pointing at it produces a payment that opens and is then refused for
 * an account Stripe has never heard of. The first person it clears is the
 * operator, who is also the only person testing. He then has a real request on
 * a real phone saying "has not said where the money should land", and the
 * button that fixes it is three taps into a page he has to go and find.
 *
 * A place on a screen, where there should be a line to paste. So: this.
 *
 * WHAT COMES BACK IS A LINK AND NOTHING ELSE. It opens as whoever holds it, so
 * it goes to the person it names and nowhere else. Single-use and it expires —
 * Stripe's own rule, not ours — so run it again rather than keeping one.
 *
 * Nothing secret is printed. Not the account id, and never a bank number: the
 * bank details are typed on Stripe's pages and this board has never held one.
 */
const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error("usage: payout.mjs <board url> <admin key> --who NAME");
  process.exit(2);
}
const arg = (n) => { const i = rest.indexOf("--" + n); return i < 0 ? "" : (rest[i + 1] || ""); };

const who = arg("who").trim();
if (!who) {
  console.error('make payout WHO="their name"');
  process.exit(2);
}

/* The public address, handed in by the Makefile off .env — the same value
   `make back` uses and for the same reason: the board answers on its own
   hostname inside the compose network and that is not a name a phone can
   resolve, let alone one Stripe can redirect to. */
const PUBLIC = (process.env.BOARD_PUBLIC_URL || "https://thexchange.app")
  .replace(/\/+$/, "");

const r = await fetch(base + "/api/admin/payout", {
  method: "POST",
  headers: { "x-admin-secret": key, "Content-Type": "application/json" },
  body: JSON.stringify({ who, base: PUBLIC }),
});
const d = await r.json().catch(() => ({}));

const say = (...lines) => { console.log(""); for (const l of lines) console.log("  " + l); console.log(""); };

if (r.status === 404) {
  say(`No member here called "${who}".`,
      "Names are as they appear on the board — make who.");
  process.exit(1);
}
if (d.error === "off") {
  say("Stripe is not configured on this box.",
      "make pay-check says which of the keys is missing.");
  process.exit(1);
}
/* THE ONE THAT IS NOT A BUG. Stripe has not activated this platform for
   Connect, so no account can be created for anybody — which is a form on
   Stripe about the business and nothing this board can fix. Said as itself,
   because "stripe" sends somebody looking in the wrong place. */
if (d.error === "unactivated") {
  say("Stripe has not activated this platform yet.",
      "",
      "Nothing here can fix that — it is the Connect application, and until",
      "it is approved no payout account can be made for anybody.",
      "",
      "Stripe said: " + String(d.detail || "").slice(0, 160));
  process.exit(1);
}
/* AND THE ONE THAT IS A DECISION. Stripe reviewed this platform for Connect
   and said no, so no payout account can be made for anybody — including the
   operator, which is how this is usually found. It came back as the generic
   refusal the first time it happened, which sends somebody looking for a bug
   in the wrong place: it is not a bug and there is nothing here to fix. */
if (d.error === "rejected") {
  say("Stripe has turned this platform down for Connect.",
      "",
      "Not a queue and not a setting — a decision. No payout account can be",
      "made for anybody until it is appealed, so nothing on this board can",
      "take a payment.",
      "",
      "Stripe said: " + String(d.detail || "").slice(0, 160));
  process.exit(1);
}
if (!r.ok || !d.url) {
  say("Refused: " + (d.error || r.status),
      ...(d.detail ? ["", String(d.detail).slice(0, 200)] : []));
  process.exit(1);
}

/* THE LINK, BETWEEN TWO RULES, the way make back and make invite print one —
   because what happens next is somebody opening it on a phone, not reading a
   field called `url`. */
const line = "─".repeat(60);
console.log("\n" + line);
console.log("");
console.log(`  ${d.handle} — this is where your money lands. Open it and`);
console.log("  Stripe asks for the bank details itself.");
console.log("");
console.log("  " + d.url);
console.log("");
console.log(line);
console.log("");
console.log("  One use, and it expires. Run this again rather than keeping it.");
if (d.made) console.log("  A new payout account was made — there was none before.");
console.log("  When Stripe puts you down you land back on Dealio.");
console.log("");
