/* THE 微店 ORDER HISTORY, IN THE SHAPE A PAYMENTS RISK TEAM ASKS FOR.
 *
 * WHY THIS IS NOT A SCRAPER. `make weidian-pull` reads the shopfront and is
 * deliberately not logged in — see the note on that target. Orders are seller
 * side, and a headless browser signing into a Chinese seller account from a
 * Tokyo box is the thing that gets an account looked at. It is also the wrong
 * artefact: Stripe wants the platform's own export, not a file this repo
 * produced. So the export is the evidence and this is the summary that goes
 * beside it.
 *
 *   make weidian-orders FILE=~/Downloads/orders.csv
 *
 * WHAT IT PRINTS, and every line of it is a question underwriting actually
 * asks: how long, how steadily, how large, and how often it went wrong.
 * Refund rate is the one that decides a high-risk category, so it is a column
 * and not a footnote.
 *
 * IT NAMES THE COLUMNS IT FOUND. Weidian has changed its export more than
 * once and a script that silently reads the wrong column produces a confident
 * wrong number, which is worse than no number when the number is going to a
 * risk team. If a heading is not recognised it says so and stops.
 *
 * CSV, TSV, or the HTML table that 微店 sometimes hands over with an .xls name
 * — all three, because "save as CSV first" is a step, and a step done by hand
 * once a month is a step that will be wrong one month.
 */

import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error('make weidian-orders FILE=~/Downloads/orders.csv');
  process.exit(2);
}

let raw;
try { raw = readFileSync(file.replace(/^~/, process.env.HOME || "~"), "utf8"); }
catch (e) { console.error("cannot read " + file + ": " + e.message); process.exit(1); }

/* AN .xls FROM 微店 IS OFTEN AN HTML TABLE. Excel opens it happily and
   everybody assumes it is a spreadsheet; it is markup, and the rows are in
   there in order. */
function fromHtml(text) {
  const rows = [];
  for (const tr of text.split(/<tr[^>]*>/i).slice(1)) {
    const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((m) => m[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&").trim());
    if (cells.length) rows.push(cells);
  }
  return rows;
}

/* A CSV WITH QUOTED FIELDS, which every export has, because an address has a
   comma in it. Written out rather than split(",") for exactly that reason. */
function fromSep(text, sep) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell.trim()); cell = ""; }
    else if (c === "\n") { row.push(cell.trim()); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows.filter((r) => r.some((x) => x !== ""));
}

const rows = /<tr[\s>]/i.test(raw)
  ? fromHtml(raw)
  : fromSep(raw, raw.split("\n")[0].includes("\t") ? "\t" : ",");

if (rows.length < 2) { console.error("nothing in that file but a heading."); process.exit(1); }

/* THE HEADINGS 微店 HAS USED, and the English an exported-then-translated file
   carries. Matched loosely because the export sometimes pads them. */
const WANT = {
  at:     ["下单时间", "成交时间", "支付时间", "订单创建时间", "创建时间", "order time", "created"],
  money:  ["实付金额", "订单金额", "买家实付", "实收金额", "支付金额", "amount", "paid"],
  state:  ["订单状态", "状态", "status"],
  refund: ["退款金额", "退款状态", "是否退款", "refund"],
};
const head = rows[0].map((h) => String(h).replace(/\s+/g, "").toLowerCase());
const findCol = (names) => head.findIndex((h) => names.some((n) => h.includes(n.toLowerCase())));

const col = { at: findCol(WANT.at), money: findCol(WANT.money),
              state: findCol(WANT.state), refund: findCol(WANT.refund) };

console.log("\n  columns found");
console.log("  " + "-".repeat(58));
for (const [k, i] of Object.entries(col)) {
  console.log("  " + k.padEnd(8) + (i >= 0 ? rows[0][i] : "— not found —"));
}
if (col.at < 0 || col.money < 0) {
  console.error("\n  The date and the amount are the two it cannot do without.");
  console.error("  Headings in this file: " + rows[0].join(" | "));
  console.error("  Tell me which two they are and I will add them.\n");
  process.exit(1);
}

/* A DATE OUT OF AN EXPORT IS FIVE SHAPES. Only the year and month are read,
   because that is the whole of what is printed. */
const monthOf = (s) => {
  const m = String(s).match(/(\d{4})\D(\d{1,2})/);
  return m ? m[1] + "-" + String(m[2]).padStart(2, "0") : "";
};
const moneyOf = (s) => {
  const n = Number(String(s).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
/* REFUNDED IS TWO DIFFERENT COLUMNS DEPENDING ON THE EXPORT: an amount, or a
   word in the status. Both are read, and either counts. */
const REFUND_WORDS = ["退款", "已退", "refund", "退货"];
const refunded = (r) => {
  if (col.refund >= 0) {
    const v = String(r[col.refund] || "");
    if (moneyOf(v) > 0) return true;
    if (REFUND_WORDS.some((w) => v.includes(w))) return true;
  }
  if (col.state >= 0) {
    const v = String(r[col.state] || "");
    if (REFUND_WORDS.some((w) => v.includes(w))) return true;
  }
  return false;
};

const months = new Map();
let bad = 0;
for (const r of rows.slice(1)) {
  const key = monthOf(r[col.at]);
  if (!key) { bad += 1; continue; }
  const m = months.get(key) || { n: 0, sum: 0, ref: 0, refSum: 0 };
  m.n += 1;
  m.sum += moneyOf(r[col.money]);
  if (refunded(r)) { m.ref += 1; m.refSum += moneyOf(r[col.money]); }
  months.set(key, m);
}
if (!months.size) { console.error("\n  no dates read. Is the date column right?\n"); process.exit(1); }

const keys = [...months.keys()].sort();
const yuan = (n) => "¥" + Math.round(n).toLocaleString("en-US");
const pad = (s, n) => String(s).padEnd(n);
const num = (s, n) => String(s).padStart(n);

console.log("\n  " + pad("month", 10) + num("orders", 8) + num("value", 12)
  + num("average", 10) + num("refunds", 9) + num("rate", 7));
console.log("  " + "-".repeat(58));
let N = 0, SUM = 0, REF = 0, REFSUM = 0;
for (const k of keys) {
  const m = months.get(k);
  N += m.n; SUM += m.sum; REF += m.ref; REFSUM += m.refSum;
  console.log("  " + pad(k, 10) + num(m.n, 8) + num(yuan(m.sum), 12)
    + num(yuan(m.sum / m.n), 10) + num(m.ref, 9)
    + num((m.ref / m.n * 100).toFixed(1) + "%", 7));
}
console.log("  " + "-".repeat(58));
console.log("  " + pad("all", 10) + num(N, 8) + num(yuan(SUM), 12)
  + num(yuan(SUM / N), 10) + num(REF, 9)
  + num((REF / N * 100).toFixed(1) + "%", 7));

/* THE PARAGRAPH THAT GOES IN THE REPLY. Underwriting reads a sentence before
   it opens a spreadsheet, and this is the sentence — the same four numbers,
   said rather than tabulated. */
const months_n = keys.length;
const first = keys[0], last = keys[keys.length - 1];
console.log("\n  " + "-".repeat(58));
console.log("  For the reply, and check every word of it yourself:\n");
console.log("    " + N.toLocaleString("en-US") + " orders between " + first + " and " + last
  + ", across " + months_n + " months");
console.log("    of trading. " + yuan(SUM) + " in total, averaging " + yuan(SUM / N)
  + " an order. " + REF.toLocaleString("en-US") + " were refunded,");
console.log("    " + (REF / N * 100).toFixed(1) + "% of orders and " + yuan(REFSUM) + " in value.");
console.log("\n  " + "-".repeat(58));
if (bad) console.log("  " + bad + " rows had no readable date and are not counted above.");
console.log("  Send the export itself as well. This is the summary, not the evidence.\n");
