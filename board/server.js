// The board: a noticeboard for foreigners in China.
//
// ---------------------------------------------------------------------------
// What this is, and what it deliberately is not
//
// Study Pal's feed with nothing else attached — no translator, no camera, no
// flashcards. Somewhere to ask "where do I get a phone contract without a
// Chinese bank card" and be answered by somebody who did it last month.
//
// It is not a copy of Study Pal's data. It starts empty. The posts on that
// side were made by people who signed up to that app, and moving their words
// and photographs into a different product is not a migration, it is a
// decision about somebody else's content.
//
// ---------------------------------------------------------------------------
// It answers the admin panel's API, exactly
//
// The panel on tomscoding already governs a board — reading /api/public,
// sending to /api/feed, releasing and deleting. Those routes are implemented
// here to the same contract, so pointing STUDYPAL_BASE at this service makes
// that panel govern this board with no change to a line of it.
//
// That is not a coincidence and it is worth stating: the contract was written
// down before either side was finished, which is why a second implementation
// of it took an evening rather than a week.
// ---------------------------------------------------------------------------

import express from "express";
import { mkdir, readFile, writeFile, rename, stat } from "node:fs/promises";
import { timingSafeEqual, randomUUID } from "node:crypto";
import path from "node:path";
import * as store from "./lib/store.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

const PORT = Number(process.env.PORT || 8080);
const DIR = process.env.BOARD_DIR || "/data";
const FILE = path.join(DIR, "board.json");
const MEDIA = path.join(DIR, "media");

// The admin key. Same header the rest of the platform uses, and the query
// form too, because /api/public takes it that way on the other side and the
// point of this file is to be a drop-in for that.
const KEY = (process.env.BOARD_ADMIN_KEY || "").trim();

// Salts the device hash. Without one the hash is a rainbow table away from the
// id it came from, which would make "anonymous" a claim rather than a fact.
const SALT = (process.env.BOARD_SALT || "").trim();

// Where to tell when something changes. The admin panel's webhook, so a post
// held here appears in the queue over there without anybody refreshing.
const HOOK_URL = (process.env.BOARD_HOOK_URL || "").trim();
const HOOK_SECRET = (process.env.BOARD_HOOK_SECRET || "").trim();

// Everything new waits for a person.
//
// Study Pal has a model that judges a post and says why when it will not pass
// one. That is genuinely good and it is theirs. Until this side has its own,
// the honest default is that a new post is held rather than published — a
// board that publishes everything unread is a board that will publish the
// first thing somebody tests it with.
const AUTO = process.env.BOARD_AUTO_PUBLISH === "1";

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

/** The admin door. Header or query, because the contract this implements uses
 *  both — /api/public takes it in the query, the rest in a header. */
function admin(req, res, next) {
  if (!KEY) return res.status(503).json({ error: "BOARD_ADMIN_KEY is not set" });
  const given = String(req.get("x-admin-secret") || req.query.secret || "");
  if (!safeEqual(given, KEY)) return res.status(401).json({ error: "no" });
  next();
}

// Writes are serialised. Two requests reading, changing and writing the same
// file concurrently leave whichever finished last as the only one stored.
let queue = Promise.resolve();
function change(fn) {
  const run = queue.then(async () => {
    const board = await store.load(FILE);
    const out = await fn(board);
    await store.save(FILE, board);
    return out;
  });
  queue = run.catch(() => {});
  return run;
}

/** Tell the admin panel something happened. Best effort, and deliberately not
 *  awaited by the request that caused it: a slow webhook must not make posting
 *  feel slow, and a panel that is down must not stop a board working. */
function tell(event, post) {
  if (!HOOK_URL || !HOOK_SECRET) return;
  fetch(HOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-studypal-secret": HOOK_SECRET },
    body: JSON.stringify({ event, at: new Date().toISOString(), post }),
    signal: AbortSignal.timeout(6000),
  }).catch(() => { /* the board is the record; the panel re-reads it anyway */ });
}

app.get("/healthz", (_req, res) => res.json({ ok: true }));

// ---------------------------------------------------------------------------
// Media
//
// Files are written under an id this server generated, with an extension taken
// from a short allowlist rather than from the name a browser supplied. Two
// ways a filename could otherwise decide where a file lands, both closed.
// ---------------------------------------------------------------------------
const KINDS = new Map([
  ["image/jpeg", "jpg"], ["image/png", "png"], ["image/gif", "gif"],
  ["image/webp", "webp"], ["video/mp4", "mp4"], ["video/quicktime", "mov"],
  ["video/webm", "webm"],
]);
const MEDIA_MAX = 25 * 1024 * 1024;
const EXT = new Map([...KINDS].map(([type, ext]) => [ext, type]));

async function putMedia(buf, type) {
  const ext = KINDS.get(type);
  if (!ext) return null;
  if (buf.length > MEDIA_MAX) return null;
  const id = store.newId();
  await mkdir(MEDIA, { recursive: true });
  await writeFile(path.join(MEDIA, id + "." + ext), buf);
  return id;
}

async function findMedia(id) {
  if (!/^[a-f0-9]{20}$/.test(String(id || ""))) return null;
  for (const ext of KINDS.values()) {
    const file = path.join(MEDIA, id + "." + ext);
    try { await stat(file); return { file, type: EXT.get(ext) }; } catch { /* next */ }
  }
  return null;
}

// Public, because a photo on a public board is public — but by an id nobody
// can guess, so an unpublished one is not browsable.
app.get("/api/public-media", async (req, res) => {
  const found = await findMedia(req.query.id);
  if (!found) return res.status(404).json({ error: "no such file" });
  res.set("Content-Type", found.type);
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Cache-Control", "public, max-age=86400, immutable");
  res.sendFile(found.file);
});

// ---------------------------------------------------------------------------
// The board, for readers
// ---------------------------------------------------------------------------
app.get("/api/board", async (req, res) => {
  const board = await store.load(FILE);
  const live = board.posts.filter((p) => p.state === "published");
  // Which of these are the reader's own, so the page can offer to take one
  // down. Sent as a header rather than a query string: it is the same secret
  // either way, and a query string is the half that ends up in an access log.
  const me = store.hashDevice(String(req.get("x-board-device") || ""), SALT);
  res.set("Cache-Control", "no-store");
  res.json({
    posts: live.filter(store.isOwnPost).map((p) => ({
      ...p,
      ...store.threadFor(live, p.id),
      // Not whose it is — only whether it is yours. The hash is ours, and
      // handing it back would let anybody who collects two pages of this
      // board work out which posts came from the same person.
      mine: Boolean(me) && p.by === me,
      by: undefined,
    })),
  });
});

// Taking down your own. There are no accounts here, so "yours" means posted
// from this browser: the salted hash of the id it keeps, matched against the
// one stored with the post. That is the whole of what the hash is for.
//
// Removed rather than deleted, the same as from the admin — "was taken down"
// and "never existed" are different facts, and the replies underneath it were
// written by other people.
app.delete("/api/post", express.json(), async (req, res) => {
  const id = String(req.query.id || req.body?.id || "");
  const me = store.hashDevice(String(req.body?.device || ""), SALT);
  if (!me) return res.status(400).json({ error: "no" });
  const post = await change((board) => {
    const p = board.posts.find((x) => x.id === id);
    // The same answer for a post that is not yours and a post that is not
    // there. Telling them apart would make this an oracle for whether a given
    // id exists.
    if (!p || p.by !== me) return null;
    p.state = "removed";
    p.why = "Taken down by the person who posted it.";
    return p;
  });
  if (!post) return res.status(404).json({ error: "no such post of yours" });
  tell("removed", post);
  res.json({ ok: true, id });
});

// ---------------------------------------------------------------------------
// Posting, from the board itself
// ---------------------------------------------------------------------------
app.post("/api/post", express.json({ limit: "36mb" }), async (req, res) => {
  const note = String(req.body?.note || "").trim().slice(0, 2000);
  const handle = String(req.body?.handle || "").trim().replace(/^@+/, "").slice(0, 40);
  const topic = String(req.body?.topic || "").trim().slice(0, 40);
  const re = String(req.body?.re || "");
  const like = String(req.body?.like || "");

  let photo = "";
  if (req.body?.photo && req.body?.photoType) {
    const buf = Buffer.from(String(req.body.photo), "base64");
    photo = (await putMedia(buf, String(req.body.photoType))) || "";
    if (!photo) return res.status(415).json({ error: "that kind of file is not accepted here" });
  }

  // A like carries nothing but its pointer; everything else needs words or a
  // picture. A row with neither is not a post.
  if (!like && !note && !photo) {
    return res.status(400).json({ error: "say something, or add a photo" });
  }
  if (!like && !handle) return res.status(400).json({ error: "pick a name to post under" });

  const post = store.cleanPost({
    id: store.newId(),
    at: new Date().toISOString(),
    // A like is never held: it is a tally, not a statement, and holding one
    // would put a queue in front of the cheapest thing anybody does here.
    state: like ? "published" : (AUTO ? "published" : "held"),
    handle, note, topic, photo, re, like,
    why: like || AUTO ? "" : "Waiting for somebody to read it.",
    by: store.hashDevice(req.body?.device, SALT),
  });

  await change((board) => { board.posts.unshift(post); });
  tell(post.state === "published" ? "published" : "held", post);
  res.status(201).json({ id: post.id, state: post.state });
});

// ---------------------------------------------------------------------------
// The admin's contract
//
// Four routes, to the letter of docs/for-studypal-publish.md and
// docs/for-studypal-hook.md — the same shapes the panel already speaks.
// ---------------------------------------------------------------------------

// Everything, grouped the way the panel reads it.
app.get("/api/public", admin, async (req, res) => {
  const board = await store.load(FILE);
  if (req.query.queue !== "1") {
    return res.json({ posts: board.posts.filter((p) => p.state === "published") });
  }
  res.set("Cache-Control", "no-store");
  res.json({
    posts: board.posts.filter((p) => p.state === "held"),
    live: board.posts.filter((p) => p.state === "published"),
    refused: board.posts.filter((p) => p.state === "refused"),
    removed: board.posts.filter((p) => p.state === "removed"),
  });
});

// Receiving a post from the admin. Multipart, per the spec.
app.post("/api/feed", admin, express.raw({ type: "multipart/form-data", limit: "36mb" }),
  async (req, res) => {
    const parsed = multipart(req);
    if (!parsed) return res.status(400).json({ error: "expected multipart/form-data" });
    const account = String(parsed.fields.account || "").trim();
    const note = String(parsed.fields.body || "").trim().slice(0, 2000);
    if (!account) return res.status(400).json({ error: "account is required" });
    if (!note && !parsed.file) return res.status(400).json({ error: "nothing to post" });

    let photo = "";
    if (parsed.file) {
      photo = (await putMedia(parsed.file.buf, parsed.file.type)) || "";
      if (!photo) return res.status(415).json({ error: "that kind of file is not accepted here" });
    }

    // Made by the operator rather than by a reader, so it goes straight up.
    // The admin is the review.
    const post = store.cleanPost({
      id: store.newId(), at: new Date().toISOString(), state: "published",
      handle: account, note, photo,
    });
    await change((board) => { board.posts.unshift(post); });
    tell("published", post);
    res.status(201).json({ id: post.id });
  });

// Letting a held post through.
app.post("/api/feed/release", admin, async (req, res) => {
  const id = String(req.query.id || "");
  const post = await change((board) => {
    const p = board.posts.find((x) => x.id === id);
    if (!p) return null;
    p.state = "published";
    p.why = "";
    p.at = p.at || new Date().toISOString();
    return p;
  });
  if (!post) return res.status(404).json({ error: "no such post" });
  tell("published", post);
  res.json({ ok: true, id });
});

// Taking one down. Marked rather than deleted: "was taken down" is a different
// fact from "never existed", and the second is what deleting the row would say.
app.delete("/api/feed", admin, async (req, res) => {
  const id = String(req.query.id || "");
  const post = await change((board) => {
    const p = board.posts.find((x) => x.id === id);
    if (!p) return null;
    p.state = "removed";
    p.why = String(req.query.why || "Taken down from the admin.").slice(0, 400);
    return p;
  });
  // 404 on an id nobody has is the state being asked for, and the spec says to
  // treat it as success.
  if (!post) return res.json({ ok: true, id, missing: true });
  tell("removed", post);
  res.json({ ok: true, id });
});

// The accounts this board knows about, which is every handle that has posted.
// Not a user list — there are no users — and it says so.
app.get("/api/users", admin, async (_req, res) => {
  const board = await store.load(FILE);
  const seen = new Map();
  for (const p of board.posts) {
    if (!p.handle) continue;
    const e = seen.get(p.handle) || { id: p.handle, name: p.handle, handle: p.handle, posts: 0 };
    e.posts += 1;
    seen.set(p.handle, e);
  }
  res.json({ users: [...seen.values()] });
});

// ---------------------------------------------------------------------------
// A multipart reader, for one file and a few short fields
//
// Written rather than depended on. The parsing libraries are good and none of
// them is small, and this handles exactly the shape the spec describes: a
// handful of text fields and at most one file. Anything more elaborate arriving
// here is not a request this route was built for.
// ---------------------------------------------------------------------------
function multipart(req) {
  const ct = String(req.get("content-type") || "");
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(ct);
  if (!m || !Buffer.isBuffer(req.body)) return null;
  const boundary = Buffer.from("--" + (m[1] || m[2]).trim());
  const out = { fields: {}, file: null };

  let i = req.body.indexOf(boundary);
  while (i >= 0) {
    const start = i + boundary.length;
    let end = req.body.indexOf(boundary, start);
    if (end < 0) break;
    const part = req.body.subarray(start, end);
    const split = part.indexOf("\r\n\r\n");
    if (split > 0) {
      const head = part.subarray(0, split).toString("utf8");
      // Trailing CRLF belongs to the delimiter, not to the value.
      const body = part.subarray(split + 4, part.length - 2);
      const name = /name="([^"]*)"/i.exec(head)?.[1];
      const filename = /filename="([^"]*)"/i.exec(head)?.[1];
      const type = /content-type:\s*([^\r\n;]+)/i.exec(head)?.[1]?.trim();
      if (name && filename !== undefined) {
        if (!out.file) out.file = { buf: body, type: type || "application/octet-stream" };
      } else if (name) {
        out.fields[name] = body.toString("utf8").slice(0, 4000);
      }
    }
    i = end;
  }
  return out;
}

app.use(express.static("public", {
  setHeaders: (res, f) => { if (f.endsWith(".html")) res.set("Cache-Control", "no-cache"); },
}));

await mkdir(DIR, { recursive: true });
app.listen(PORT, () => {
  console.log(`board on :${PORT}, data in ${DIR}`);
  if (!KEY) console.error("BOARD_ADMIN_KEY is not set — the admin routes will refuse everything.");
  if (!SALT) console.error("BOARD_SALT is not set — device hashes are unsalted.");
});
