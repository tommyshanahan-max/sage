/* THE TWO INVOICES OF EVERY DEAL, IN A TERMINAL.
 *
 * The same figures as the Deals screen in the app. It exists because reading
 * a column of numbers on a phone held close is the hardest thing this product
 * asks of anybody, and a ledger is exactly the kind of thing that is read
 * down rather than glanced at.
 *
 *   make books
 *   make books WHO="Tom"
 *
 * THE MARGIN IS NOT RECOMPUTED HERE. It comes off the same lib/books.js the
 * screen uses, so this cannot quietly disagree with the app — which is the
 * whole failure mode of a second place that prints money.
 */

const [, , base, key, rawWho] = process.argv;
/* `make books` passes "$(WHO)" whether or not WHO was set, so an unset one
   arrives as an empty argument rather than as no argument at all. */
const who = String(rawWho ?? "").trim();
if (!base || !key) {
  console.error("usage: books.mjs <board url> <admin key> [who]");
  process.exit(2);
}

const url = base + "/api/admin/books" + (who ? "?who=" + encodeURIComponent(who) : "");
const r = await fetch(url, { headers: { "x-admin-secret": key } });
const body = await r.text();
const json = (() => { try { return JSON.parse(body); } catch { return null; } })();
/* A 404 IS TWO DIFFERENT THINGS AND ONLY ONE OF THEM IS ABOUT A PERSON.
   Express answers 404 for a route it does not have, so a board running an
   older image said `Nobody on this board is called "Tom"` — which is a
   sentence about Tom, is false, and sends somebody looking in the wrong
   place. The route says which it is; anything else is the board being old. */
if (r.status === 404) {
  if (json?.error === "who") {
    console.log(`Nobody on this board is called "${who}".`);
    process.exit(0);
  }
  console.error("This board has no /api/admin/books — it is running older code than this script.");
  console.error("Deploy first, then run this again.");
  process.exit(1);
}
if (!r.ok || !json) {
  console.error("The board answered " + r.status + ".");
  process.exit(1);
}
const { who: all } = json;
if (!all?.length) {
  console.log("No deal has two sides yet, so there is nothing to reconcile.");
  process.exit(0);
}

const pad = (s, n) => String(s ?? "").padEnd(n);
/* Padded by DISPLAY width, not by length. A Chinese company name is two
   columns wide per character in every terminal, so padEnd on its length puts
   every column after it out by the number of Chinese characters in the row —
   which is most rows on this particular screen. */
const wide = (s) => [...String(s ?? "")]
  .reduce((n, c) => n + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]/.test(c) ? 2 : 1), 0);
const padw = (s, n) => String(s ?? "") + " ".repeat(Math.max(0, n - wide(s)));
const rpad = (s, n) => " ".repeat(Math.max(0, n - wide(s))) + String(s ?? "");

for (const p of all) {
  console.log("");
  console.log(p.handle.toUpperCase());
  console.log("=".repeat(Math.max(20, wide(p.handle))));

  for (const t of p.totals) {
    const bits = [`in ${t.in}`, `out ${t.out}`, `margin ${t.gap}`];
    if (t.pct !== null) bits.push(t.pct + "%");
    console.log("  " + bits.join("   "));
  }
  /* MONEY ON DEALS WITH ONLY ONE SIDE, kept out of the margin above and
     said here. It is not profit — it is a job that has not been paid out —
     and leaving it off the screen entirely would be a ledger that does not
     account for everything. */
  for (const o of (p.open || [])) {
    const bits = [o.inMinor ? "in " + o.in : "", o.outMinor ? "out " + o.out : ""]
      .filter(Boolean).join(", ");
    console.log("  no supplier yet: " + bits);
  }
  if (p.cnyIn) console.log("  banked in yuan " + p.cnyInShown);
  /* WHAT IS OWED ON PAPER, said out loud rather than left to be spotted in a
     column. Money without a document is the state that costs money later and
     it is invisible everywhere else. */
  const owed = [
    p.needInvoice ? `${p.needInvoice} to invoice` : "",
    p.needBill ? `${p.needBill} supplier invoice not in` : "",
  ].filter(Boolean);
  if (owed.length) console.log("  " + owed.join(", ").toUpperCase());
  console.log("");

  console.log("  " + pad("NO.", 6) + padw("PAYER", 22) + padw("SUPPLIER", 18)
    + rpad("IN", 12) + rpad("OUT", 12) + rpad("MARGIN", 11) + "  PAPER");
  for (const d of p.deals) {
    const paper = [
      d.in && d.in.state === "paid" ? (d.in.invoice === "issued" ? "invoiced" : "TO INVOICE") : "",
      d.out && d.out.state === "paid" ? (d.out.billed ? "bill in" : "NO BILL") : "",
    ].filter(Boolean).join(" · ");
    console.log("  "
      + pad(d.no ? String(d.no).padStart(4, "0") : "—", 6)
      + padw(d.in?.who || "—", 22)
      + padw(d.out?.who || "—", 18)
      + rpad(d.in?.amount || "—", 12)
      + rpad(d.out?.amount || "—", 12)
      + rpad(d.gap ? d.gap.amount : "—", 11)
      + "  " + paper);
    /* WHY THERE IS NO MARGIN, on its own line and only where there is none.
       A dash in the column the whole thing exists for reads as a bug. */
    if (!d.gap) {
      const why = { noSupplier: "no supplier yet", noPayer: "no money in",
        noCur: "currency unknown", twoCurs: "two currencies — cannot subtract" };
      console.log("  " + " ".repeat(6) + "(" + (why[d.why] || d.why) + ")");
    }
  }
}
console.log("");
