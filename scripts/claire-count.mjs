/* What ClaireTv has, and the one ratio that matters.
 *
 * WRITTEN FOR ONE QUESTION: is the wall in the right place? Everything else
 * about this platform is visible in the console, but "of the people who got to
 * the last free episode, how many paid" is an arithmetic between two tables
 * and there was nowhere to look at it.
 *
 * NOTHING THAT IDENTIFIES ANYBODY. A viewer is a salted hash and it does not
 * appear here — this is a diagnostic that gets read over somebody's shoulder.
 *
 *   make claire-count
 */
import { readFile } from "node:fs/promises";

const file = process.argv[2] || "/data/claire.json";
const pct = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "—");

try {
  const b = JSON.parse(await readFile(file, "utf8"));
  const live = b.series.filter((s) => s.live);
  console.log("");
  console.log("  " + b.series.length + " series (" + live.length + " live) · "
    + b.episodes.length + " episodes · " + b.viewers.length + " viewers");
  console.log("");
  if (!b.series.length) {
    console.log("  Nothing in the catalogue yet. /partner is where it goes in.");
    console.log("");
  }
  for (const s of b.series) {
    const eps = b.episodes.filter((e) => e.series === s.id);
    const lastFree = eps.find((e) => e.n === s.freeThrough);
    const reached = lastFree ? b.plays.filter((p) => p.ep === lastFree.id).length : 0;
    const unlocks = b.unlocks.filter((u) => u.series === s.id);
    const paid = new Set(unlocks.map((u) => u.by)).size;
    const coins = unlocks.reduce((n, u) => n + (u.coins || 0), 0);
    console.log("  " + (s.live ? "●" : "○") + " " + s.title);
    console.log("      wall at " + (s.freeThrough + 1) + " of " + (s.totalPlanned || eps.length)
      + " · " + eps.length + " made");
    console.log("      " + reached + " reached it · " + paid + " paid (" + pct(paid, reached) + ") · "
      + coins + " coins");
    console.log("");
  }
} catch (e) {
  console.log("  no catalogue at " + file + " (" + e.code + ")");
}
