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
let writing = Promise.resolve();

export async function open(dir) {
  FILE = path.join(dir, "claire.json");
  await mkdir(dir, { recursive: true });
  try { cache = JSON.parse(await readFile(FILE, "utf8")); }
  catch { cache = structuredClone(EMPTY); }
  for (const k of Object.keys(EMPTY)) if (!Array.isArray(cache[k])) cache[k] = [];
  return cache;
}

export const read = () => cache;

/** Every write goes through here, serialised, and lands by rename.
 *  A half-written catalogue is the one failure that loses everything at once. */
export function change(fn) {
  const next = writing.then(async () => {
    const out = fn(cache);
    const tmp = FILE + ".tmp";
    await writeFile(tmp, JSON.stringify(cache, null, 2));
    await rename(tmp, FILE);
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
    at: was?.at || new Date().toISOString(),
  };
}

/** An episode. `hook` is the line it ends on — the partner writes it down
 *  because the one at `freeThrough + 1` is the sentence the business runs on,
 *  and a field nobody fills in is a decision nobody made. */
export function cleanEpisode(raw, seriesId, was = null) {
  return {
    id: was?.id || newId(),
    series: seriesId,
    n: Math.max(1, Math.min(999, Number(raw.n) || 1)),
    title: clean(raw.title, 90),
    hook: clean(raw.hook, 200),
    url: /^https?:\/\/\S{3,500}$/.test(String(raw.url || "")) ? String(raw.url).trim() : "",
    seconds: Math.max(0, Math.min(3600, Number(raw.seconds) || 0)),
    at: was?.at || new Date().toISOString(),
  };
}

export const episodesOf = (id) =>
  cache.episodes.filter((e) => e.series === id).sort((a, b) => a.n - b.n);

export const seriesById = (id) => cache.series.find((s) => s.id === id) || null;

/** Is this episode open to this viewer?
 *
 *  Three ways in, checked in this order on purpose: free by the series' own
 *  rule, bought outright, or unlocked one at a time. The first is free to
 *  everybody and costs no lookup; the last is the row that took money. */
export function canWatch(viewerId, series, ep) {
  if (!series.live) return false;
  if (ep.n <= series.freeThrough) return true;
  return cache.unlocks.some((u) =>
    u.by === viewerId && u.series === series.id && (u.whole || u.ep === ep.id));
}

export function viewer(id) {
  return cache.viewers.find((v) => v.by === id) || null;
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
