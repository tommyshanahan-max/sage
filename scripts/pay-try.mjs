/* WHY THAT PAYMENT WAS REFUSED, IN STRIPE'S OWN WORDS, FOR ALL THREE METHODS.
 *
 * WHY THIS EXISTS. WeChat Pay was refused, the other two were never pressed,
 * and the screen read as "none of the payments work". The reason existed in
 * exactly one place — a line in the board's container log — and finding it
 * meant knowing to go and look.
 *
 * It asks Stripe to open a checkout for a real request in each of the three
 * methods and prints what came back. Nothing is charged: sessions nobody
 * completes expire, and nothing is written to the board.
 *
 *   node scripts/pay-try.mjs <base> <admin-key> --id <request id> [--method wechat]
 */
const [base, key, ...rest] = process.argv.slice(2);
if (!base || !key) { console.error("pay-try.mjs <base> <admin-key> --id <request id>"); process.exit(1); }
const arg = (n) => { const i = rest.indexOf("--" + n); return i >= 0 ? String(rest[i + 1] ?? "") : ""; };

const id = arg("id");
if (!id) {
  console.error("\n  Which request? The id is the end of its address:");
  console.error("  https://thexchange.app/pay/<this bit>\n");
  process.exit(1);
}

const r = await fetch(base.replace(/\/$/, "") + "/api/admin/pay-try", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-admin-secret": key },
  body: JSON.stringify({ id, method: arg("method") }),
});
const j = await r.json().catch(() => null);
if (!r.ok || !j?.ok) {
  /* The refusals that happen before Stripe is ever asked, said as themselves.
     Each one is a different thing to go and do. */
  const said = {
    off: "Payments are not switched on — see make pay-check.",
    id: "That is not a request id.",
    gone: "No request with that id. It may have been taken back.",
    currency: "That request carries no currency, so it can never be priced.",
    payee: "Nowhere for the money to land — nobody has a payout account on it.",
  }[j?.error] || ("The board said " + r.status);
  console.error("\n  " + said + "\n");
  process.exit(1);
}

const names = { wechat: "WeChat Pay", alipay: "Alipay", card: "Card" };
console.log("");
console.log("  " + j.amount + (j.to ? " from " + j.to : "") + " · " + String(j.cur).toUpperCase());
console.log("");
for (const t of j.tried) {
  console.log("  " + (names[t.method] || t.method).padEnd(12) + (t.ok ? "opens" : "REFUSED"));
  /* Stripe's sentence under the method it belongs to, wrapped rather than run
     off the side of a terminal. It is the whole reason this command exists. */
  if (!t.ok) {
    const why = t.detail || t.error || "no reason given";
    for (const line of String(why).match(/.{1,64}(\s|$)/g) || [why]) {
      console.log("                " + line.trim());
    }
  }
}
console.log("");
