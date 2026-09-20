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
 *
 * THE ADDRESS IS BUILT HERE, NOT TAKEN FROM THE ANSWER. The server works out
 * its own address from the Host header of the request, and the request came
 * from inside the compose network — so it printed http://board:8080/pay/...,
 * which is a real page nobody outside that container can open. Tom opened it
 * on his phone and got nothing. BOARD_PUBLIC_URL comes in from the Makefile,
 * the same way `make back` has always done it.
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

/* The public name of this board, or a sensible guess. Never the answer's own
   url — see the note at the top. */
const PUBLIC = (process.env.BOARD_PUBLIC_URL || "https://thexchange.app").replace(/\/+$/, "");
console.log("");
console.log("  " + PUBLIC + "/pay/" + j.id);
console.log("");
/* SAID HERE RATHER THAN FOUND OUT ON THE PHONE. A request from somebody with
   no payout set up opens fine and cannot be paid, and the page says so — but
   by then somebody has walked to another device to find out. */
/* WHICH RAILS THIS ONE IS ON, because "no payout set up, cannot be paid" was
   printed about a request that draws a WeChat code and can be paid perfectly
   well — the payout account belongs to the other path. */
if (j.code) {
  console.log("  It opens with a WeChat Pay or Alipay code. No payout account needed.");
  console.log("");
} else if (!j.ready) {
  console.log("  " + arg("who") + " has no payout set up, so this opens but cannot be paid.");
  console.log("  make payee WHO=\"" + arg("who") + "\" ACCT=acct_…");
  console.log("  Or, for a code instead: make dealio-me WHO=\"" + arg("who") + "\"");
  console.log("");
}

/* --try: ASK STRIPE, HERE, RATHER THAN HAND OVER AN ID TO PASTE INTO A SECOND
   COMMAND. The id is twenty characters at the end of a link, and copying it
   out of a terminal to type into the next line is the kind of step that gets
   done wrong once and then blamed on the product. Same report as
   `make pay-try`, on the request that was just made. */
if (rest.includes("--try")) {
  const t = await fetch(base.replace(/\/$/, "") + "/api/admin/pay-try", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-secret": key },
    body: JSON.stringify({ id: j.id }),
  });
  const p = await t.json().catch(() => null);
  if (!t.ok || !p?.ok) {
    console.log("  Could not ask Stripe: " + (p?.error || t.status));
    console.log("");
  } else {
    const names = { wechat: "WeChat Pay", alipay: "Alipay", card: "Card" };
    for (const one of p.tried) {
      console.log("  " + (names[one.method] || one.method).padEnd(12)
        + (one.ok ? "opens" : "REFUSED"));
      if (one.ok) continue;
      const why = one.detail || one.error || "no reason given";
      for (const line of String(why).match(/.{1,62}(\s|$)/g) || [why]) {
        console.log("                " + line.trim());
      }
    }
    console.log("");
  }
}
