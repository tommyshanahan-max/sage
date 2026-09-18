/* Where somebody's money goes, set from the terminal.
 *
 *   make payee WHO="Claire" ACCT=acct_1UH4r20H237ev5bJ
 *   make payee WHO="Claire" OFF=1
 *
 * A payee normally does this themselves — the room shows them a button, Stripe
 * takes their bank and identity on its own pages, and hands the id back. This
 * is for the other end of a test: a sandbox payee onboarded from a terminal has
 * an account id and nobody to put it on, and until some row carries it the
 * payment path cannot be walked once. Pay only makes a Stripe session when the
 * payee's account is ready, and an account nobody points at is invisible.
 *
 * IT IS AN ACCOUNT ID AND NOTHING ELSE. Stripe's own identifier, useless to
 * anybody who is not this platform. Never a bank number — the board has never
 * held one and this does not start.
 */
const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error("usage: payee.mjs <board url> <admin key> --who WHO [--acct acct_…] [--off]");
  process.exit(2);
}
const arg = (n, d = "") => { const i = rest.indexOf("--" + n); return i < 0 ? d : (rest[i + 1] || d); };
const who = arg("who").trim();
const acct = arg("acct").trim();
const off = rest.includes("--off");
const say = (...l) => { console.log(""); for (const x of l) console.log("  " + x); console.log(""); };

if (!who || (!acct && !off)) {
  say("Who, and which account:",
      "",
      '  make payee WHO="Claire" ACCT=acct_1UH4r20H237ev5bJ',
      '  make payee WHO="Claire" OFF=1',
      "",
      "WHO is their handle on the board — `make who` lists them.");
  process.exit(2);
}

const r = await fetch(base + "/api/person/payee", {
  method: "POST",
  headers: { "x-admin-secret": key, "Content-Type": "application/json" },
  body: JSON.stringify({ who, acct, off }),
});
const d = await r.json().catch(() => ({}));

if (!r.ok) {
  if (d.error === "who") say("Not on this board: " + who, "", "`make who` lists the handles.");
  else if (d.error === "acct") say("That is not a Stripe account id.",
    "", "They start with acct_ and the rest is letters and numbers.");
  else say("That did not go through.");
  process.exit(1);
}

if (!d.payee) { say(d.handle + " is no longer paid through the board."); process.exit(0); }
say(d.handle + " is paid into " + d.payee + ".",
    "",
    "Pay in a room where they are doing the work now opens the payment",
    "inside the app, as long as that account has finished onboarding.",
    "",
    'Undo:  make payee WHO="' + who + '" OFF=1');
