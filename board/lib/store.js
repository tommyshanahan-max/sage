// The board's own record: what was posted, what became of it, and the files.
//
// ---------------------------------------------------------------------------
// Why files rather than a database
//
// The same call the rest of this platform makes. A JSON file in a Docker volume
// is legible with `cat`, copied with `cp`, and backed up by anything that can
// copy a directory. At the scale this starts at — a noticeboard for foreigners
// in one city — a database is a dependency to run, back up and migrate in
// exchange for query patterns nobody has yet.
//
// The day it stops being enough is a day with a number attached to it, and the
// shape below is deliberately the shape a row would take.
// ---------------------------------------------------------------------------

import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import path from "node:path";

/** Where a post can be. Four, and each is a different fact:
 *
 *   held      — waiting for a person. The default for anything new, until a
 *               check exists that can judge it.
 *   published — live on the board.
 *   refused   — turned away, with a reason. Kept, because "was refused and
 *               why" is the answer to a question somebody will ask.
 *   removed   — was live, taken down. Different from never having existed. */
export const STATES = ["held", "published", "refused", "removed"];

/** Ids are generated here and never taken from a caller: they become
 *  filenames, and a filename decided by a stranger is a path decided by a
 *  stranger. */
export const newId = () => randomUUID().replace(/-/g, "").slice(0, 20);

/** The shape stored, from whatever arrives. Anything malformed costs its own
 *  row rather than the file. */
export function cleanPost(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "");
  if (!/^[a-f0-9]{20}$/.test(id)) return null;
  const s = (v, n) => String(v ?? "").slice(0, n);
  return {
    id,
    at: s(raw.at, 40) || new Date().toISOString(),
    state: STATES.includes(raw.state) ? raw.state : "held",
    // Who it goes out as. A handle rather than an account id, because there
    // are no accounts yet and a handle is the thing a reader sees either way.
    handle: s(raw.handle, 40).replace(/^@+/, ""),
    // The words. `note` in the app's own vocabulary, kept as `note` so the
    // admin panel and the migration read the same field name everywhere.
    note: s(raw.note, 2000),
    // The same sentence in three scripts, where somebody supplied them.
    zh: s(raw.zh, 2000), py: s(raw.py, 2000), en: s(raw.en, 2000),
    photo: /^[a-f0-9]{20}$/.test(String(raw.photo || "")) ? String(raw.photo) : "",
    clip: /^[a-f0-9]{20}$/.test(String(raw.clip || "")) ? String(raw.clip) : "",
    topic: s(raw.topic, 40),
    // Where it was taken. Rounded to four decimals — about eleven metres —
    // before it is stored, which is enough to say "this restaurant" and not
    // enough to say "this table".
    lat: typeof raw.lat === "number" ? Math.round(raw.lat * 1e4) / 1e4 : null,
    lon: typeof raw.lon === "number" ? Math.round(raw.lon * 1e4) / 1e4 : null,
    // A reply points at a post; a like is a row whose whole content is the
    // pointer. Both are ordinary posts, joined on these.
    re: /^[a-f0-9]{20}$/.test(String(raw.re || "")) ? String(raw.re) : "",
    like: /^[a-f0-9]{20}$/.test(String(raw.like || "")) ? String(raw.like) : "",
    // Why it was held, refused or taken down. Empty on a published post,
    // because a published post has no reason.
    why: raw.state === "published" ? "" : s(raw.why, 400),
    // Which device wrote it. A hash, never the id itself: it answers "is this
    // the same person again" without answering "who".
    by: s(raw.by, 64),
  };
}

/** A device id, hashed before it touches disk. The browser makes up a random
 *  one; this makes sure the file never holds the form that came over the
 *  wire. */
export const hashDevice = (id, salt) =>
  id ? createHash("sha256").update(String(salt) + ":" + String(id)).digest("hex").slice(0, 32) : "";

export function cleanBoard(raw) {
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.posts) ? raw.posts : [];
  const seen = new Set();
  const posts = [];
  for (const r of rows) {
    const p = cleanPost(r);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    posts.push(p);
  }
  posts.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  return { posts };
}

/** Read, change, write — through a temporary file and a rename, so an
 *  interrupted save leaves the previous version rather than half of this one.
 *  Serialised by the caller; two writers racing is how a file becomes the
 *  older of two truths. */
export async function load(file) {
  try {
    return cleanBoard(JSON.parse(await readFile(file, "utf8")));
  } catch (err) {
    if (err.code === "ENOENT") return { posts: [] };
    throw err;
  }
}

export async function save(file, board) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  await writeFile(tmp, JSON.stringify(cleanBoard(board), null, 2) + "\n", "utf8");
  await rename(tmp, file);
}

/** What a post is, for a reader. A reply and a like are rows in the same list
 *  as posts; drawn as their own cards they fill a board with fragments and one
 *  busy post buries everything under its own likes. */
export const isOwnPost = (p) => !p.re && !p.like;

/** A post's thread and its like count, assembled from the same list. */
export function threadFor(posts, id) {
  return {
    replies: posts.filter((p) => p.re === id && p.state === "published"),
    likes: posts.filter((p) => p.like === id).length,
  };
}
