/* The same person on the waiting list twice.
 *
 * WHAT MAKES THIS HAPPEN, and it is not somebody being careless. A waiting
 * person's place is held by two things: `board:device` in localStorage and the
 * board_wait cookie. Both are per-origin. Anything that moves a browser to a
 * different hostname — Safari clearing storage after seven days, opening a
 * WeChat link in Safari having joined in WeChat, or the board's own move from
 * liuxuesheng.io to thexchange.app, which was made with a 301 — hands them a
 * form that looks empty. They fill it in again, and the list grows a second
 * row with the same person on it and no card.
 *
 * That is worth nothing to them and less than nothing to whoever reads the
 * queue: two rows, one of which has what they wrote and one of which is a
 * name. The long note above waitCookie in server.js is about the same failure.
 *
 * WHAT IT PRINTS, AND WHAT IT DELIBERATELY DOES NOT. Names, dates, ids, and
 * whether a row has a card on it. Never `reach` and never the card's text —
 * this is run to decide which row to delete, and neither is needed for that.
 * A queue read over somebody's shoulder should not be a list of WeChat ids.
 *
 * Names are matched loosely, because the second row is typed from memory: case
 * and spacing are ignored, and a first name that is the whole of one row and
 * the start of another counts — "Ray" and "Ray Chen" are one person far more
 * often than they are two.
 *
 *   make twice
 */
import { readFile } from "node:fs/promises";

const file = process.argv[2] || "/data/board.json";
const key = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
const day = (s) => String(s || "").slice(0, 10) || "—";
const pad = (s, n) => String(s || "").padEnd(n).slice(0, n);

const b = JSON.parse(await readFile(file, "utf8"));
const waits = (Array.isArray(b.waits) ? b.waits : []).filter((w) => w && w.name);

/* Longest name first, so "Ray Chen" is the group and "Ray" joins it rather
   than the other way round — the row with more of a name in it is the one
   worth keeping, and it should be the one the group is called by. */
const groups = [];
for (const w of [...waits].sort((a, c) => key(c.name).length - key(a.name).length)) {
  const k = key(w.name);
  const into = groups.find((g) => g.k === k || g.k.startsWith(k + " "));
  if (into) into.rows.push(w);
  else groups.push({ k, name: w.name, rows: [w] });
}

const twice = groups.filter((g) => g.rows.length > 1);
console.log("");
if (!twice.length) {
  console.log("  " + waits.length + " on the list, nobody on it twice.");
  console.log("");
} else {
  console.log("  " + twice.length + " name" + (twice.length === 1 ? "" : "s")
    + " on the list more than once, out of " + waits.length + " rows.");
  console.log("");
  for (const g of twice) {
    console.log("  " + g.name);
    // Oldest first: the first row is nearly always the one with the card on it.
    for (const w of g.rows.sort((a, c) => String(a.at).localeCompare(String(c.at)))) {
      console.log("      " + pad(day(w.at), 12) + pad(w.why ? "has a card" : "no card", 12)
        + pad(w.done === "in" ? "let in" : w.done === "no" ? "turned down" : "waiting", 13)
        + w.id);
    }
    console.log("");
  }
  console.log("  Delete the empty one and keep what they wrote:");
  console.log("      make waiting-rm ID=...");
  console.log("");
}
