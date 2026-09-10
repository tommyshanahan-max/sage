/* What is in a board file, in one line.
 *
 * Used by `make save` and `make restore` and nowhere else. A backup nobody has
 * ever looked inside is a file, not a backup — and the number of people on the
 * waiting list is the one figure that says whether a copy ran against the real
 * volume or an empty one. Restoring the wrong file is a mistake somebody makes
 * once, so the line is printed BEFORE the question, not after it.
 *
 *   node data-count.mjs                     the live board, /data/board.json
 *   node data-count.mjs /peek/board.json    one that has been unpacked
 *
 * Deliberately reads the raw JSON rather than going through the store: this
 * has to work on a file the store might refuse, which is exactly the file
 * somebody is standing over when they run it.
 */
import { readFile } from "node:fs/promises";

const file = process.argv[2] || "/data/board.json";
const n = (v) => (Array.isArray(v) ? v.length : 0);

try {
  const b = JSON.parse(await readFile(file, "utf8"));
  const waits = Array.isArray(b.waits) ? b.waits : [];
  // Still waiting, rather than every row ever written: a row stays after
  // somebody is let in, and "35 waiting" that counts them is not the number
  // anybody means.
  const out = waits.filter((w) => !w.done).length;
  const reach = waits.filter((w) => w.reach).length;
  console.log("  " + out + " waiting to get in (" + n(b.waits) + " rows, "
    + reach + " with a way to reach them)");
  console.log("  " + n(b.people) + " people, " + n(b.posts) + " posts, "
    + n(b.invites) + " invites");
} catch (err) {
  console.log("  could not read " + file + ": " + err.message);
  console.log("  LOOK INSIDE IT BEFORE YOU TRUST IT.");
  process.exit(1);
}
