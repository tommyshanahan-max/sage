/* Put a series into ClaireTv's catalogue from a file.
 *
 * WHY A SEED AND NOT TEN TRIPS THROUGH THE CONSOLE. A demo needs a catalogue
 * that already looks like a catalogue, and typing ten episodes into a form to
 * show somebody a product is the part of the demo where they stop watching.
 * The console is for the partner; this is for the day before the meeting.
 *
 * IDEMPOTENT ON THE TITLE. Run it twice and the second run updates the series
 * it made the first time rather than leaving two of them — because it will be
 * run twice, usually at the worst moment.
 *
 *   make claire-seed
 *   make claire-seed SEED=claire/seed/other-thing.json
 */
import { readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const file = process.argv[2] || "/seed/wife-he-hired.json";
const store = process.argv[3] || "/data/claire.json";
const newId = () => randomUUID().replace(/-/g, "").slice(0, 16);

const seed = JSON.parse(await readFile(file, "utf8"));

let b;
try { b = JSON.parse(await readFile(store, "utf8")); }
catch { b = { series: [], episodes: [], viewers: [], unlocks: [], plays: [] }; }
for (const k of ["series", "episodes", "viewers", "unlocks", "plays"]) {
  if (!Array.isArray(b[k])) b[k] = [];
}

/* A SHELF FILE HAS NO EPISODES. Six coming-soon titles are six series rows and
   nothing else, and making that a second script would mean two things to keep
   in step. Same file format, `series` as a list instead of one. */
if (Array.isArray(seed.series)) {
  for (const row of seed.series) {
    let x = b.series.find((y) => y.title === row.title);
    if (!x) { x = { id: newId(), at: new Date().toISOString() }; b.series.push(x); }
    Object.assign(x, row, { id: x.id, at: x.at });
  }
  const tmp0 = store + ".tmp";
  await writeFile(tmp0, JSON.stringify(b, null, 2));
  await rename(tmp0, store);
  console.log("");
  console.log("  " + seed.series.length + " on the shelf:");
  for (const row of seed.series) console.log("    " + row.title);
  console.log("");
  process.exit(0);
}

let s = b.series.find((x) => x.title === seed.series.title);
if (!s) {
  s = { id: newId(), at: new Date().toISOString() };
  b.series.push(s);
}
Object.assign(s, seed.series, { id: s.id, at: s.at });

/* The episodes are replaced rather than merged. A seed file is the record of
   what the series is; a half-updated one where episode 6 is from last week is
   worse than either version on its own. Unlocks and play positions are left
   alone, because they belong to people rather than to the file. */
b.episodes = b.episodes.filter((e) => e.series !== s.id);
for (const e of seed.episodes) {
  b.episodes.push({
    id: newId(), series: s.id,
    n: e.n, title: e.title, hook: e.hook || "",
    act: e.act || 0, function: e.function || "", beat: e.beat || "",
    url: e.url || "", seconds: e.seconds || 90,
    at: new Date().toISOString(),
  });
}

b.featured = s.id;

const tmp = store + ".tmp";
await writeFile(tmp, JSON.stringify(b, null, 2));
await rename(tmp, store);

console.log("");
console.log("  " + s.title);
console.log("    " + seed.episodes.length + " episodes · free through " + s.freeThrough
  + " · " + s.coinsPerEpisode + " coins each · featured");
console.log("");
const wall = seed.episodes.find((e) => e.n === s.freeThrough + 1);
if (wall) {
  console.log("  The wall is episode " + wall.n + ", \"" + wall.title + "\".");
  const last = seed.episodes.find((e) => e.n === s.freeThrough);
  if (last) console.log("  They hit it on: \"" + last.hook + "\"");
  console.log("");
}
