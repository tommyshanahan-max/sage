/* ONE PAYMENT REQUEST, MADE FROM A TERMINAL, AND THE LINK PRINTED.
 *
 * WHY IT EXISTS. The person paying needs no account — that is the design —
 * but the person asking does, and putting an identity on a particular phone
 * takes a sign-in and a code typed by hand. For a ¥1 test of the paying
 * screens that is three steps too many.
 *
 * This makes the request as somebody already on the board and prints the
 * address. Open it on any phone, signed in or not, and it is exactly what
 * the person being asked sees.
 *
 *   node scripts/ask.mjs <base> <admin-key> --who Claire --amount "¥1" \
 *     [--to Tom] [--for "a test"] [--when "now"] [--cur cny]
 */
const [base, key, ...rest] = process.argv.slice(2);
if (!base || !key) { console.error("ask.mjs <base> <admin-key> --who NAME --amount N"); process.exit(1); }

const arg = (name) => {
  const i = rest.indexOf("--" + name);
  return i >= 0 ? String(rest[i + 1] ?? "") : "";
};

const r = await fetch(base.replace(/\/$/, "") + "/api/admin/request", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-admin-secret": key },
  body: JSON.stringify({
    who: arg("who"), to: arg("to"), amount: arg("amount"),
    what: arg("for"), when: arg("when"), cur: arg("cur"),
  }),
});
const j = await r.json().catch(() => null);
if (!r.ok || !j?.ok) {
  console.error("\n  " + (j?.error || ("the board said " + r.status)) + "\n");
  process.exit(1);
}

console.log("");
console.log("  " + j.url);
console.log("");
/* SAID HERE RATHER THAN FOUND OUT ON THE PHONE. A request from somebody with
   no payout set up opens fine and cannot be paid, and the page says so — but
   by then somebody has walked to another device to find out. */
if (!j.ready) {
  console.log("  " + arg("who") + " has no payout set up, so this opens but cannot be paid.");
  console.log("  make payee WHO=\"" + arg("who") + "\" ACCT=acct_…");
  console.log("");
}
