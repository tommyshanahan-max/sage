/* THE TWO INVOICES, SIDE BY SIDE
 * ===========================================================================
 *
 * A deal is two invoices and one of them is ours:
 *
 *     the payer      →  invoiced by us, in yuan, inside China
 *     the supplier   →  invoices us, in their own currency, at home
 *
 * Nobody is paid across a border in either direction, which is the whole
 * reason the structure exists. What is left between the two numbers is the
 * margin, and the margin is trading profit — not a cut held on somebody
 * else's behalf, which is the line that keeps this the right side of 二清.
 *
 * SO THE MARGIN IS NEVER A STORED NUMBER. It is one row minus the other,
 * worked out here, every time. Store it and there are three numbers where
 * there should be two, and on the day they disagree nothing can say which is
 * lying. The 5% decides what the supplier's row is written for; after that it
 * is arithmetic and the arithmetic is the truth.
 *
 * THE CURRENCY TRAP, AND WHY A GAP CAN BE MISSING. Both rows of one deal are
 * written in the SUPPLIER's currency — A$2,000 in, A$1,900 out — because that
 * is the only way a subtraction means anything. The yuan the payer actually
 * handed over is a third number, taken at the rate on the day the code was
 * drawn, and it is carried beside them rather than folded in: it is what the
 * WFOE's own books are kept in, and it is what a Chinese auditor will ask
 * for. Where the two rows are in different currencies the gap is left empty
 * and says why, because a figure invented from a rate this board guessed at
 * is worse than no figure.
 *
 * BUILT TO LEAVE. The money helpers come in as arguments — nothing here
 * imports the board or the store. requestState is imported rather than
 * copied: it was copied, with a comment claiming store.js asserted the two
 * agreed, and store.js does no such thing. Two state machines that must match
 * and nothing making them is the bug, not the import.
 */
import { requestState } from "./request.js";

/** What is still owed on the paperwork, as one word.
 *
 *  Three states and no fourth, the same discipline as requestState:
 *    "none"   nothing to issue it from — the payer has given no 开票信息
 *    "held"   we have what we need and it has not been issued
 *    "issued" done
 */
export function invoiceState(r) {
  if (!r?.inv) return "none";
  return r.inv.done ? "issued" : "held";
}

/** Rows into deals. Each deal is the row coming in, the row going out where
 *  there is one, and what is left between them.
 *
 *  Every row appears exactly once. A request with no supplier behind it is
 *  still a deal — a one-sided one — because the money came in and the books
 *  have to account for it whether or not anything went out again. */
export function books(rows, { toMinor, fromMinor }, { feePct = 5 } = {}) {
  const live = (rows || []).filter((r) => r && !r.off);
  const byDeal = new Map();
  const loose = [];
  for (const r of live) {
    if (r.deal) {
      const g = byDeal.get(r.deal) || { deal: r.deal, in: null, out: null };
      /* TWO ROWS THE SAME WAY ROUND IS NOT A DEAL, and it happens — a
         supplier row made twice, or a deal id pasted onto the wrong row. The
         second one is set loose rather than silently overwriting the first,
         so it shows up on the screen as its own line instead of vanishing
         out of the totals. */
      const slot = (r.way || "in") === "out" ? "out" : "in";
      if (g[slot]) loose.push(r); else g[slot] = r;
      byDeal.set(r.deal, g);
    } else loose.push(r);
  }
  for (const r of loose) {
    const slot = (r.way || "in") === "out" ? "out" : "in";
    byDeal.set("~" + r.id, { deal: "", in: null, out: null, [slot]: r });
  }

  const side = (r) => {
    if (!r) return null;
    const minor = r.cur ? toMinor(r.amount, r.cur) : null;
    return {
      id: r.id, no: r.no || 0, who: r.to || "", what: r.what || "",
      amount: r.amount, cur: r.cur || "", minor: minor || 0,
      state: requestState(r),
      /* What the payer actually handed over, in yuan, at the rate on the day
         the code was drawn. Empty on a request written in yuan already —
         there the amount IS the yuan. */
      cny: r.pay?.cny ? Number(r.pay.cny) : (r.cur === "cny" ? minor || 0 : 0),
      invoice: invoiceState(r),
      inv: r.inv ? { kind: r.inv.kind, title: r.inv.title, taxId: r.inv.taxId } : null,
      billed: Boolean(r.billed),
      at: r.at,
    };
  };

  const deals = [...byDeal.values()].map((g) => {
    const a = side(g.in), b = side(g.out);
    let gap = null, why = "";
    if (!b) why = "noSupplier";
    else if (!a) why = "noPayer";
    else if (!a.cur || !b.cur) why = "noCur";
    else if (a.cur !== b.cur) why = "twoCurs";
    else {
      const minor = a.minor - b.minor;
      gap = { cur: a.cur, minor, amount: fromMinor(Math.abs(minor), a.cur),
        /* Against what came in, which is what a margin is. Against what went
           out it would read a fraction higher and flatter the wrong way. */
        pct: a.minor ? Math.round((minor / a.minor) * 1000) / 10 : 0,
        under: minor < 0 };
    }
    return {
      deal: g.deal, in: a, out: b, gap, why,
      no: a?.no || b?.no || 0,
      at: a?.at || b?.at || "",
      /* THE ONE LINE SOMEBODY SCANNING THIS SCREEN IS LOOKING FOR. A deal is
         done when the money moved both ways AND both pieces of paper exist.
         Money without paper is the state that costs money later, so it is
         not allowed to read as finished. */
      done: Boolean(a && b && a.state === "paid" && b.state === "paid"
        && a.invoice === "issued" && b.billed),
    };
  }).sort((x, y) => String(y.at).localeCompare(String(x.at)));

  /* ONE TOTAL PER CURRENCY AND NEVER ADDED TOGETHER — the same rule the
     Earned card runs on. ¥30,000 and A$2,000 are two numbers, and one of
     them needs a rate this board would have to invent.
 
     AND ONLY DEALS THAT HAVE BOTH SIDES. This summed every row and it made
     the one figure the screen exists for into a lie: a book with three deals
     paid in and no supplier attached to them yet reported a 32.4% margin,
     because the money in was counted and there was nothing out to take off
     it. Every number in that sentence was individually true.
 
     So a deal joins the margin only once it has both invoices in the same
     currency — which is exactly when a margin exists. Money in on a deal with
     no supplier is real and is counted, separately, as `open`: it is not
     profit, it is a job that has not been paid out. */
  const pots = new Map();
  const opens = new Map();
  let cnyIn = 0;
  for (const d of deals) {
    if (d.in) cnyIn += d.in.cny || 0;
    if (!d.gap) {
      for (const s of [d.in, d.out]) {
        if (!s || !s.cur || !s.minor) continue;
        const o = opens.get(s.cur) || { cur: s.cur, inMinor: 0, outMinor: 0 };
        o[s === d.in ? "inMinor" : "outMinor"] += s.minor;
        opens.set(s.cur, o);
      }
      continue;
    }
    const pot = pots.get(d.in.cur) || { cur: d.in.cur, inMinor: 0, outMinor: 0 };
    pot.inMinor += d.in.minor;
    pot.outMinor += d.out.minor;
    pots.set(d.in.cur, pot);
  }
  const totals = [...pots.values()].map((p) => ({
    cur: p.cur,
    in: fromMinor(p.inMinor, p.cur), out: fromMinor(p.outMinor, p.cur),
    gap: fromMinor(p.inMinor - p.outMinor, p.cur),
    inMinor: p.inMinor, outMinor: p.outMinor, gapMinor: p.inMinor - p.outMinor,
    pct: p.inMinor
      ? Math.round(((p.inMinor - p.outMinor) / p.inMinor) * 1000) / 10 : null,
  })).sort((a, b) => b.inMinor - a.inMinor);
  /* MONEY ON DEALS THAT HAVE ONLY ONE SIDE. Named for what it is so that
     nobody reads it as profit, and carried so that it is not simply missing
     from a screen whose job is to account for everything. */
  const open = [...opens.values()]
    .map((o) => ({ cur: o.cur, in: fromMinor(o.inMinor, o.cur),
      out: fromMinor(o.outMinor, o.cur), inMinor: o.inMinor, outMinor: o.outMinor }))
    .sort((a, b) => b.inMinor - a.inMinor);

  return {
    deals, totals, open, feePct,
    /* Yuan through the WFOE, which is the figure its own books are kept in
       and the one a Chinese auditor asks for first. */
    cnyIn, cnyInShown: fromMinor(cnyIn, "cny"),
    /* WHAT IS ACTUALLY OUTSTANDING, counted here rather than on the screen so
       the list and the number can never disagree. */
    needInvoice: deals.filter((d) => d.in && d.in.state === "paid" && d.in.invoice !== "issued").length,
    needBill: deals.filter((d) => d.out && d.out.state === "paid" && !d.out.billed).length,
  };
}

/** What the supplier's row should be written for, given what came in.
 *
 *  Rounded to the currency's own smallest unit and no further — the margin is
 *  whatever is actually left after that, never the percentage, which is why
 *  books() subtracts instead of multiplying. */
export function supplierMinor(inMinor, feePct = 5) {
  if (!Number.isFinite(inMinor) || inMinor <= 0) return 0;
  return Math.round(inMinor * (100 - feePct) / 100);
}

/** The books as a spreadsheet. One row per deal, in the order the screen
 *  shows them, with both invoices on the same line — which is the whole point
 *  and the thing an accountant cannot do from two separate exports. */
export function booksCsv(b) {
  const q = (v) => {
    const t = String(v ?? "");
    return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  };
  const head = ["No", "Date", "Payer", "What", "In", "In currency",
    "CNY collected", "Payer invoice", "Payer company", "Payer tax no",
    "Supplier", "Out", "Out currency", "Supplier invoice",
    "Margin", "Margin %", "Settled"];
  const lines = [head.join(",")];
  for (const d of b.deals) {
    lines.push([
      d.no || "", (d.at || "").slice(0, 10),
      d.in?.who || "", d.in?.what || "",
      d.in ? minorText(d.in) : "", d.in?.cur?.toUpperCase() || "",
      d.in?.cny ? (d.in.cny / 100).toFixed(2) : "",
      d.in ? d.in.invoice : "",
      d.in?.inv?.title || "", d.in?.inv?.taxId || "",
      d.out?.who || "", d.out ? minorText(d.out) : "", d.out?.cur?.toUpperCase() || "",
      d.out ? (d.out.billed ? "received" : "waiting") : "",
      d.gap ? minorText({ cur: d.gap.cur, minor: d.gap.minor }) : "",
      d.gap ? d.gap.pct : "",
      d.done ? "yes" : "no",
    ].map(q).join(","));
  }
  return lines.join("\n") + "\n";
}

/* A plain number for a spreadsheet — no sign, no grouping. A cell reading
   "A$2,000.00" is text, and an accountant who sums the column gets zero. */
function minorText(s) {
  return s.cur === "jpy" ? String(s.minor) : (s.minor / 100).toFixed(2);
}
