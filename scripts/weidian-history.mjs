/* EVERY ORDER 微店 HAS, ASKED FOR RATHER THAN EXPORTED BY HAND.
 *
 * Stripe declined on category and asked for trading history. The shop has
 * 2012 onwards in it, and the export is a button in a seller console that
 * queues a file somebody then has to find, download and move to the right
 * machine — three steps, and the file never arrived.
 *
 * lib/weidian.js already had the call: vdian.order.list.get, with a window
 * and a page number. This walks it and counts.
 *
 * IT ONLY READS, and only things that have already happened — the same line
 * the top of lib/weidian.js draws. Nothing here creates an order or touches
 * money.
 *
 *   make weidian-history                 every year the shop has
 *   make weidian-history FROM=2012 TO=2017
 *
 * ---------------------------------------------------------------------------
 * THIS FILE IS WRITTEN TO REFUSE RATHER THAN TO GUESS, and every rule below
 * is here because the number it produces is going to a payments risk team. A
 * confident wrong number is worse than no number: it is the kind of thing
 * that gets an account closed rather than opened.
 *
 * THE FIELD NAMES ARE LEARNED, NOT GUESSED. wiki.open.weidian.com cannot be
 * reached from this box — see the head of lib/weidian.js — so every name is
 * tried from a list and what answered is printed before any total.
 *
 * ORDERS ARE FILED UNDER THEIR OWN DATE, NOT THE MONTH THAT WAS ASKED FOR.
 * If add_start/add_end turn out to be ignored — which cannot be checked from
 * here without asking — then filing by the requested window would spread one
 * recent page across fourteen years and invent a decade of trading. Filing by
 * the row's own date cannot do that.
 *
 * AND EVERY ORDER IS COUNTED ONCE, by its own id. Same reason: a window that
 * is ignored hands back the same page every time, and a total that counts it
 * 170 times is off by two orders of magnitude in the flattering direction.
 * Two months in a row that return nothing new stops the walk and says the
 * window is not being honoured, rather than running to the end and printing.
 *
 * THE LAST PAGE IS A SHORT PAGE. The API gives no total, so the size of the
 * first page of a month is taken as the page size and anything smaller ends
 * it.
 *
 * REFUNDS ARE PRINTED AS UNKNOWN UNLESS THEY WERE ACTUALLY READ. The status
 * field is words in some responses and a number in others, and a numeric
 * status matched against a list of words yields 0 refunds, 0.0%, which reads
 * as a fact and is not one. If the status cannot be read as words, the column
 * says "?" and the sentence at the end leaves refunds out.
 * ------------------------------------------------------------------------ */

import * as weidian from "../board/lib/weidian.js";

const arg = (name, fallback) => {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

if (!weidian.configured()) {
  console.error("\n  微店 is not configured, so there is nothing to ask.\n");
  console.error("  These two lines are missing from .env on the box:\n");
  console.error("    TOMSCODING_WEIDIAN_KEY=…");
  console.error("    TOMSCODING_WEIDIAN_SECRET=…\n");
  console.error("  They come from open.weidian.com, under 管理 for the app, on");
  console.error("  the account that owns the shop. Add them, then run this again.");
  console.error("  `make weidian-check` says whether they work.\n");
  process.exit(1);
}

const now = new Date();
const FROM = Number(arg("from", 2012));
const TO = Number(arg("to", now.getUTCFullYear()));
if (!Number.isFinite(FROM) || !Number.isFinite(TO) || FROM > TO) {
  console.error("  make weidian-history FROM=2012 TO=2017");
  process.exit(2);
}

/* WHAT A ROW IS CALLED, IN EVERY SHAPE THIS API HAS BEEN SEEN TO USE. The
   first key present wins, and the winner is printed before any number. */
const PICK = {
  id:    ["order_id", "orderId", "oid", "order_sn", "id"],
  at:    ["add_time", "addTime", "create_time", "order_time", "pay_time", "time"],
  money: ["total_price", "price", "order_price", "real_price", "pay_price", "amount"],
  state: ["status", "order_status", "state", "status_desc"],
};
const REFUND = ["退款", "已退", "退货", "refund", "closed"];

const pickKey = (row, names) => names.find((n) => row && row[n] !== undefined) || "";
const money = (v) => {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const monthOf = (v) => {
  const s = String(v ?? "");
  const m = s.match(/(\d{4})\D(\d{1,2})/);
  if (m) return m[1] + "-" + String(m[2]).padStart(2, "0");
  /* A UNIX SECOND IS THE OTHER SHAPE THIS FIELD COMES IN. */
  const n = Number(s);
  if (Number.isFinite(n) && n > 1e9 && n < 2e10) {
    const d = new Date(n * 1000);
    return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
  }
  return "";
};
const rowsOf = (j) => {
  const r = j && j.result;
  for (const k of ["orders", "order_list", "list", "items", "data"]) {
    if (Array.isArray(r?.[k])) return r[k];
  }
  return Array.isArray(r) ? r : [];
};

const two = (n) => String(n).padStart(2, "0");
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

const months = new Map();
const seen = new Set();
const states = new Set();
let keys = null;
let noDate = 0, offWindow = 0, quiet = 0, stopped = "";

console.log("\n  asking 微店 for " + FROM + " to " + TO + ", a month at a time.\n");

walk:
for (let y = FROM; y <= TO; y += 1) {
  for (let m = 1; m <= 12; m += 1) {
    if (y === now.getUTCFullYear() && m > now.getUTCMonth() + 1) break;
    const want = `${y}-${two(m)}`;
    const from = `${y}-${two(m)}-01 00:00:00`;
    const to = `${y}-${two(m)}-${two(lastDay(y, m))} 23:59:59`;
    let page = 1, size = 0, fresh = 0, rowsHere = 0;

    for (;;) {
      let j;
      try {
        j = await weidian.orders({ page, from, to });
      } catch (e) {
        console.error("  " + want + " page " + page + ": " + e.message);
        break;
      }
      const rows = rowsOf(j);
      if (!rows.length) break;
      rowsHere += rows.length;
      if (!size) size = rows.length;

      if (!keys) {
        keys = {};
        console.log("  fields found on the first order");
        console.log("  " + "-".repeat(58));
        for (const [what, names] of Object.entries(PICK)) {
          keys[what] = pickKey(rows[0], names);
          console.log("  " + what.padEnd(7)
            + (keys[what] || "— none of " + names.join(", ") + " —"));
        }
        console.log("");
      }

      for (const r of rows) {
        /* ONCE EACH, BY ITS OWN ID. Without an id field the whole row is the
           id, which is coarser but still cannot double-count a repeat. */
        const id = keys.id ? String(r[keys.id]) : JSON.stringify(r);
        if (seen.has(id)) continue;
        seen.add(id);
        fresh += 1;

        const key = monthOf(r[keys.at]);
        if (!key) { noDate += 1; continue; }
        if (key !== want) offWindow += 1;

        const got = months.get(key) || { n: 0, sum: 0, ref: 0, refSum: 0 };
        got.n += 1;
        const v = money(r[keys.money]);
        got.sum += v;
        const st = String(r[keys.state] ?? "").trim();
        if (st) states.add(st.slice(0, 40));
        if (REFUND.some((w) => st.toLowerCase().includes(w.toLowerCase()))) {
          got.ref += 1; got.refSum += v;
        }
        months.set(key, got);
      }

      if (rows.length < size) break;
      page += 1;
      if (page > 200) { console.error("  " + want + ": stopped at 200 pages"); break; }
    }

    /* THE WINDOW IS NOT BEING HONOURED. Rows came back and every one of them
       had already been counted under an earlier month — which is what an
       ignored add_start/add_end looks like from out here. Two in a row is not
       a coincidence, and carrying on would print a table of repeats. */
    if (rowsHere && !fresh) {
      quiet += 1;
      if (quiet >= 2) {
        stopped = want;
        break walk;
      }
    } else if (fresh) {
      quiet = 0;
    }
  }
}

if (!months.size) {
  console.error("\n  No orders came back for " + FROM + "–" + TO + ".");
  console.error("  `make weidian-check` prints a real response, which is how the");
  console.error("  field names above get corrected.\n");
  process.exit(1);
}

/* COULD THE STATUS BE READ AS WORDS AT ALL? A status that is only ever a
   number cannot say "refunded", so the refund columns are unknown rather
   than zero. */
const wordy = [...states].some((s) => /[^\d.\s-]/.test(s));
const REF_KNOWN = Boolean(keys && keys.state && wordy);

const order = [...months.keys()].sort();
const yuan = (n) => "¥" + Math.round(n).toLocaleString("en-US");
const pad = (s, n) => String(s).padEnd(n);
const num = (s, n) => String(s).padStart(n);

console.log("  " + pad("month", 10) + num("orders", 8) + num("value", 12)
  + num("average", 10) + num("refunds", 9) + num("rate", 7));
console.log("  " + "-".repeat(58));
let N = 0, SUM = 0, REF = 0, REFSUM = 0;
for (const k of order) {
  const v = months.get(k);
  N += v.n; SUM += v.sum; REF += v.ref; REFSUM += v.refSum;
  console.log("  " + pad(k, 10) + num(v.n, 8) + num(yuan(v.sum), 12)
    + num(yuan(v.sum / v.n), 10)
    + num(REF_KNOWN ? v.ref : "?", 9)
    + num(REF_KNOWN ? (v.ref / v.n * 100).toFixed(1) + "%" : "?", 7));
}
console.log("  " + "-".repeat(58));
console.log("  " + pad("all", 10) + num(N, 8) + num(yuan(SUM), 12)
  + num(yuan(SUM / N), 10)
  + num(REF_KNOWN ? REF : "?", 9)
  + num(REF_KNOWN ? (REF / N * 100).toFixed(1) + "%" : "?", 7));

console.log("\n  " + "-".repeat(58));
console.log("  For the reply, and check every word of it yourself:\n");
console.log("    " + N.toLocaleString("en-US") + " orders between " + order[0] + " and "
  + order[order.length - 1] + ", across " + order.length);
console.log("    months of trading. " + yuan(SUM) + " in total, averaging "
  + yuan(SUM / N) + " an order.");
if (REF_KNOWN) {
  console.log("    " + REF.toLocaleString("en-US") + " were refunded, "
    + (REF / N * 100).toFixed(1) + "% of orders and " + yuan(REFSUM) + " in value.");
}

console.log("\n  " + "-".repeat(58));
/* EVERYTHING THAT WOULD MAKE THE TABLE ABOVE WRONG, SAID OUT LOUD RATHER
   THAN LEFT FOR SOMEBODY TO NOTICE. */
if (stopped) {
  console.log("  STOPPED AT " + stopped + ". Two months running came back with only");
  console.log("  orders already counted, which is what it looks like when the date");
  console.log("  window is ignored. Everything above is counted once and is real,");
  console.log("  but it is not the whole shop. Send the export as well.");
}
if (offWindow) {
  console.log("  " + offWindow + " orders were dated outside the month they were asked");
  console.log("  for. They are filed under their own date, which is the honest place.");
}
if (noDate) console.log("  " + noDate + " orders had no readable date and are not counted.");
if (!REF_KNOWN) {
  console.log("  REFUNDS COULD NOT BE READ, so that column is ? and not 0.");
  if (states.size) {
    console.log("  The status values that came back: " + [...states].slice(0, 8).join(", "));
    console.log("  Say which of those mean refunded and the column gets filled in.");
  }
}
console.log("  Send 微店's own export beside this. These are counted from their");
console.log("  API, which is the same data, but the export is the document.\n");
