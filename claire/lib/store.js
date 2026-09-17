/* What ClaireTv knows: the series, the episodes, and who has unlocked what.
 *
 * ---------------------------------------------------------------------------
 * Why files rather than a database — the same call board/lib/store.js makes,
 * for the same reason. A JSON file in a Docker volume is legible with `cat`,
 * copied with `cp`, and backed up by anything that can copy a directory. A
 * catalogue of eighty series is four hundred kilobytes.
 *
 * WHAT IS NOT IN HERE, and it matters: the video. Episodes carry a URL and
 * nothing else. Transcoding, storage and a CDN are a bill and a service, not a
 * data model, and pretending otherwise by writing an `upload` field with
 * nowhere to put bytes is how a skeleton gets mistaken for a product.
 * ---------------------------------------------------------------------------
 */
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import path from "node:path";
import { statSync, readFileSync } from "node:fs";

export const newId = () => randomUUID().replace(/-/g, "").slice(0, 16);

/** A viewer IS a browser, exactly as on the board — no account, no password.
 *  The device id lives in localStorage and is hashed with a salt before it is
 *  written down, so the file never holds the value the browser sent. */
export const hashDevice = (device, salt) => {
  const d = String(device || "").trim();
  if (!/^[A-Za-z0-9._-]{8,128}$/.test(d)) return "";
  return createHash("sha256").update(salt + ":" + d).digest("hex").slice(0, 32);
};

const EMPTY = { series: [], episodes: [], viewers: [], unlocks: [], plays: [] };

let FILE = "";
let cache = null;
let seen = 0;

/* THE FILE WINS WHEN SOMETHING ELSE WROTE IT. `make claire-video` and `make
   claire-seed` write this file from another container while the server is
   running. The server used to keep its own copy for good, and the next
   write — a viewer's place, every five seconds while they watch — put that
   stale copy back over the top: episode 1's ninety-second cut was joined,
   saved, and gone again before the restart that was meant to show it. So
   every read checks the file's time first and takes the newer one. A stat is
   microseconds; the catalogue is small. */
function fresh() {
  if (!FILE) return;
  try {
    const m = statSync(FILE).mtimeMs;
    if (m <= seen) return;
    const next = JSON.parse(readFileSync(FILE, "utf8"));
    for (const k of Object.keys(EMPTY)) if (!Array.isArray(next[k])) next[k] = [];
    cache = next;
    seen = m;
  } catch { /* mid-rename or unreadable: keep what we have */ }
}
let writing = Promise.resolve();

export async function open(dir) {
  FILE = path.join(dir, "claire.json");
  await mkdir(dir, { recursive: true });
  try { cache = JSON.parse(await readFile(FILE, "utf8")); }
  catch { cache = structuredClone(EMPTY); }
  for (const k of Object.keys(EMPTY)) if (!Array.isArray(cache[k])) cache[k] = [];
  try { seen = statSync(FILE).mtimeMs; } catch { /* no file yet */ }
  return cache;
}

export const read = () => { fresh(); return cache; };

/** Every write goes through here, serialised, and lands by rename.
 *  A half-written catalogue is the one failure that loses everything at once. */
export function change(fn) {
  const next = writing.then(async () => {
    fresh();
    const out = fn(cache);
    const tmp = FILE + ".tmp";
    await writeFile(tmp, JSON.stringify(cache, null, 2));
    await rename(tmp, FILE);
    try { seen = statSync(FILE).mtimeMs; } catch { /* just written */ }
    return out;
  });
  writing = next.catch(() => {});
  return next;
}

const clean = (v, max = 200) =>
  String(v ?? "").replace(/[^\P{C}\n]/gu, "").trim().slice(0, max);

/** A series, as the partner console writes it.
 *
 *  `freeThrough` is the whole business and it lives on the series rather than
 *  on an episode, because it is a decision about a title: move it from 7 to 5
 *  and every viewer's wall moves at once. An episode does not get to disagree
 *  with it. */
export function cleanSeries(raw, was = null) {
  const total = Number(raw.totalPlanned);
  return {
    id: was?.id || newId(),
    title: clean(raw.title, 90),
    blurb: clean(raw.blurb, 240),
    genre: ["billionaire", "alpha", "revenge", "other"].includes(raw.genre) ? raw.genre : "other",
    freeThrough: Math.max(0, Math.min(99, Number(raw.freeThrough) || 0)),
    coinsPerEpisode: Math.max(0, Math.min(9999, Number(raw.coinsPerEpisode) || 60)),
    bundleCents: Math.max(0, Math.min(99999, Number(raw.bundleCents) || 1999)),
    totalPlanned: Number.isFinite(total) ? Math.max(0, Math.min(999, total)) : 0,
    art: /^[1-6]$/.test(String(raw.art)) ? String(raw.art) : "1",
    live: Boolean(raw.live),
    /* COMING SOON IS NOT THE SAME AS NOT LIVE. A draft is something the
       partner is still writing and nobody should see; a coming-soon title is
       a promise on the shelf, and the shelf is most of what makes a catalogue
       look like a catalogue rather than a prototype with one thing in it. */
    soon: Boolean(raw.soon),
    /* The cast and the arc come from the seed, not the console: the cast line
       is put in front of every shot so the faces hold, and the arc is what the
       shots were written against. Kept from the row, so saving a price in
       the console does not lose either. */
    cast: was?.cast || "",
    videoModel: was?.videoModel || "",
    arc: was?.arc || null,
    at: was?.at || new Date().toISOString(),
  };
}

/** An episode. `hook` is the line it ends on — the partner writes it down
 *  because the one at `freeThrough + 1` is the sentence the business runs on,
 *  and a field nobody fills in is a decision nobody made. */
export const FUNCTIONS = [
  "ordinary world", "inciting incident", "debate", "act one turn", "rising",
  "pinch", "midpoint", "false victory", "complication", "all is lost",
  "dark night", "climax", "resolution",
];

export function cleanEpisode(raw, seriesId, was = null) {
  const fn = String(raw.function || "");
  return {
    id: was?.id || newId(),
    series: seriesId,
    n: Math.max(1, Math.min(999, Number(raw.n) || 1)),
    /* act and function are the writer's, not the viewer's: they never leave
       the console, and they are the only reason the shape can be checked at
       all rather than felt. Kept on the row so the check is over the real
       catalogue and not over a document beside it. */
    act: [1, 2, 3].includes(Number(raw.act)) ? Number(raw.act) : 0,
    function: FUNCTIONS.includes(fn) ? fn : "",
    beat: clean(raw.beat, 600),
    /* WHAT THE CAMERA SEES, WHEN THAT HAS TO DIFFER FROM WHAT HAPPENS.
       Seedance refused three of ten beats as "possibly related to copyright
       restrictions" — no reason given and no way to appeal, and the beats in
       question were ordinary. A beat is the writer's record and should not be
       rewritten to please a filter; `shot` is the sentence handed to the
       generator instead, and it is empty for the nine episodes in ten where
       the beat is fine on its own. */
    shot: clean(raw.shot, 600),
    title: clean(raw.title, 90),
    hook: clean(raw.hook, 400),
    /* /v/ as well as https: the film `make claire-video` makes is served from
       this box, and a url check that knew only https wiped it from any
       episode the partner saved — the edit that changed a title took the
       video with it. */
    url: /^(https?:\/\/\S{3,500}|\/v\/[\w.-]{1,200})$/.test(String(raw.url || "")) ? String(raw.url).trim() : "",
    /* Made from the film, never typed, so the console cannot set them: kept
       from the row being edited. */
    poster: was?.poster || "",
    shots: Array.isArray(was?.shots) ? was.shots : [],
    wear: was?.wear || null,
    seconds: Math.max(0, Math.min(3600, Number(raw.seconds) || 0)),
    at: was?.at || new Date().toISOString(),
  };
}

export const episodesOf = (id) =>
  read().episodes.filter((e) => e.series === id).sort((a, b) => a.n - b.n);

export const seriesById = (id) => read().series.find((s) => s.id === id) || null;

/** Is this episode open to this viewer?
 *
 *  Three ways in, checked in this order on purpose: free by the series' own
 *  rule, bought outright, or unlocked one at a time. The first is free to
 *  everybody and costs no lookup; the last is the row that took money. */
export function canWatch(viewerId, series, ep) {
  if (!series.live) return false;
  if (ep.n <= series.freeThrough) return true;
  return read().unlocks.some((u) =>
    u.by === viewerId && u.series === series.id && (u.whole || u.ep === ep.id));
}

export function viewer(id) {
  return read().viewers.find((v) => v.by === id) || null;
}

/** First arrival mints a row and a small pile of coins.
 *
 *  Deliberately fewer coins than one episode costs. A welcome balance that
 *  buys the first locked episode moves the wall by one and teaches the viewer
 *  that walls open by themselves. */
export function ensureViewer(board, id, welcomeCoins) {
  let v = board.viewers.find((x) => x.by === id);
  if (!v) {
    v = { by: id, coins: welcomeCoins, at: new Date().toISOString() };
    board.viewers.push(v);
  }
  return v;
}
