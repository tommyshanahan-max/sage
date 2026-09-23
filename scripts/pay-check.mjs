/* CAN THIS BOARD TAKE A PAYMENT — asked of the box, answered in words.
 *
 * WHY THIS EXISTS. "Can the app do payments" is a question about a running
 * system, and until now the only way to answer it was to read a commit and
 * guess at five environment variables nobody can see. A guess about whether
 * money moves is the worst kind.
 *
 * It prints a verdict first and the reasons under it, because the verdict is
 * the answer and the reasons are what to do about it.
 *
 * NOTHING SECRET COMES BACK. The route reports whether each key is set and
 * which mode the Stripe key's prefix says it is in. Never a key, never a
 * fragment, never anybody's account id.
 *
 *   node scripts/pay-check.mjs <base> <admin-key>
 */
const [base, key, ...rest] = process.argv.slice(2);
if (!base || !key) { console.error("pay-check.mjs <base> <admin-key> [--names]"); process.exit(1); }
/* --names prints the payee handles, one per line, and nothing else. For a
   script rather than a person: `make go-live` has to clear every payout
   account when the keys change mode, and a connected account made under a
   test key does not exist under a live one. Grepping this command's pretty
   output for them would be a parser that breaks the next time a line moves. */
const NAMES = rest.includes("--names");

const r = await fetch(base.replace(/\/$/, "") + "/api/admin/pay", {
  headers: { "x-admin-secret": key },
});
if (!r.ok) {
  console.error("The board said " + r.status + ". Is TOMSCODING_BOARD_KEY right?");
  process.exit(1);
}
const j = await r.json();

if (NAMES) {
  for (const h of (Array.isArray(j.payees) ? j.payees : [])) console.log(h);
  process.exit(0);
}

const yes = (b) => (b ? "yes" : "no");
const line = (k, v) => console.log("  " + k.padEnd(26) + v);

console.log("");
console.log(j.takesPayments
  ? "  PAYMENTS ARE ON" + (j.mode === "live" ? "" : " — in " + j.mode + " mode, so no real money moves")
  : "  PAYMENTS ARE OFF");
console.log("");
line("Stripe key", j.key ? "set · " + j.mode : "not set");
line("Publishable key", yes(j.publishable));
line("Webhook secret", yes(j.webhook));
line("API version", j.apiVersion || "not pinned");
/* The one that answers "why is the first button on /china/connect greyed
   out". It is not a reason payments are off — without it the board still
   opens accounts and still takes money; it just cannot connect an account
   somebody already has. */
line("Connect an existing account", j.canLink ? "yes" : "no — BOARD_STRIPE_CLIENT_ID is not set");
line("Fee", j.feePct + "%" + (j.feePage ? ", with a page to pay it on" : ", no page to pay it on"));
/* By name, because the next thing to type is `make ask WHO="…"` and a count
   leaves that command half-written. */
const paid = Array.isArray(j.payees) ? j.payees : [];
line("Can be paid", paid.length ? paid.join(", ") : "nobody yet");
line("Deals with a plan", String(j.deals));
line("Requests made", String(j.asks) + (j.asks ? " · " + j.asksPaid + " paid" : ""));
if (j.demo) line("Demo stand-in", "ON — the payment screen is a drawing");
console.log("");

/* THE CODES, WHICH ARE A SEPARATE ANSWER FROM STRIPE'S.
   "Payments are off" was the whole verdict, and on the box that draws WeChat
   codes and has no Stripe it was both true and useless: the thing that
   actually works did not appear anywhere on this screen. */
const c = j.codes || {};
/* "ARE ON" WAS A CLAIM THIS PAGE CANNOT MAKE, and it made it for two days
   while Airwallex was dead. Everything here is read out of .env and
   board.json: which provider is named, whether a handle matches, how many
   codes were ever drawn. Not one of it is a question put to the provider.
   On 22 Sep it printed "WECHAT AND ALIPAY CODES ARE ON — sandbox keys" with
   17 codes beside it, on a box whose every request to Airwallex had been
   answered with an HTML 403 since the night before.
   So it says what it actually knows. `make wallet-why` is the one that
   asks, and it is named here rather than left to be remembered. */
console.log(c.on
  ? "  WECHAT AND ALIPAY CODES ARE SET UP" + (c.sandbox ? " — sandbox keys, so the money would be test money" : " — LIVE keys, real money")
  : "  WECHAT AND ALIPAY CODES ARE OFF");
if (c.on) console.log("  Whether the provider still answers is a different question: make wallet-why");
console.log("");
line("Provider", c.provider || "none");
line("Whose requests", c.owner ? (c.ownerOnBoard ? c.owner : c.owner + " — NOT ON THIS BOARD") : "nobody named");
/* The date, not just the total. A count with no date reads as a heartbeat,
   and this one was seventeen codes none of which were from the last two
   days. */
line("Codes drawn so far", String(c.drawn ?? 0)
  + (c.lastAt ? "  (last " + String(c.lastAt).slice(0, 10) + ")" : ""));
/* The difference between a row that settles on its own and one that settles
   when somebody remembers to look. */
line("Airwallex tells us", c.told ? "yes" : "no — a page has to ask");
console.log("");
if (Array.isArray(c.why) && c.why.length) {
  for (const w of c.why) console.log("    · " + w);
  console.log("");
}
if (c.on && !c.told) {
  console.log("  To have a row settle with nobody looking:");
  console.log("    make dealio-webhook");
  console.log("");
}
if (c.on) {
  console.log("  To see a code on a phone:");
  console.log("    make ask WHO=\"" + c.owner + "\" AMOUNT=\"¥1\" FOR=\"a test\"");
  console.log("");
}
/* THE NEXT COMMAND, WRITTEN OUT. The whole point of this page is to answer
   "what now", and the answer is almost always one line somebody can paste. */
if (paid.length) {
  console.log("  To see the paying screens on a phone:");
  console.log("    make ask WHO=\"" + paid[0] + "\" AMOUNT=\"¥1\" FOR=\"a test\"");
  console.log("");
}
if (j.why.length) {
  console.log("  Why Stripe is off:");
  for (const w of j.why) console.log("    · " + w);
  console.log("");
}
