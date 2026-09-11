/* Ferry — two people, two languages, one room.
 *
 * WHAT IT IS. A private room with a link. You send the link; the other person
 * opens it and says which language they read. After that each of you types in
 * your own and reads your own, and neither of you does anything about it.
 *
 * WHAT THIS PROCESS KNOWS. Almost nothing, and that is the point — see
 * lib/crypt.mjs for the whole of it. A room is an id, a timestamp, and a list
 * of base64 blobs it has no key for. Names, languages and text are inside
 * those blobs. The one time readable text passes through here is /api/translate,
 * which holds it for one request and writes it nowhere.
 *
 * NO FRAMEWORK. node:http and the filesystem. The board earns express by
 * having ninety routes; this has five, and a dependency is a thing to keep
 * patched on a box that also runs the thing people actually use.
 *
 * NO ACCOUNTS, deliberately, and not for the board's reason. The board has no
 * accounts because a hash of a random number is all the identity a noticeboard
 * needs. Ferry has none because the room link IS the credential: anything the
 * server could check a person against would be a thing the server knows about
 * them, and the whole argument for this over WeChat is that it knows nothing.
 */

import { createServer } from "node:http";
import { readFile, writeFile, mkdir, readdir, stat, unlink } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ROOM, cleanLine, cleanRoom } from "./lib/crypt.mjs";
import { translate, configured as translateReady } from "./lib/translate.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, "public");
const DIR = process.env.FERRY_DIR || "/data";
const PORT = Number(process.env.PORT || 8080);

/* HOW LONG A QUIET ROOM LASTS. Rooms delete themselves, because a chat that
 * keeps everything forever is a liability pretending to be a feature — and
 * because the honest version of "we cannot read it" includes not keeping it.
 * Counted from the last time anybody looked, not the last time anybody wrote:
 * a room being re-read is a room somebody still wants. */
const KEEP_DAYS = Number(process.env.FERRY_KEEP_DAYS || 90);

/* ---- rooms on disk --------------------------------------------------------
 * One file per room, read and written whole. A room is two people and a few
 * hundred lines; anything cleverer than this would be a database nobody needs
 * and one more thing holding text it cannot read.
 *
 * Writes are serialised per room by a promise chain rather than a lock file:
 * two people typing at once is the ordinary case here, and a lost line is not
 * recoverable from anywhere. */
const writing = new Map();
const roomPath = (id) => path.join(DIR, id + ".json");

async function load(id) {
  try {
    return cleanRoom(JSON.parse(await readFile(roomPath(id), "utf8")));
  } catch {
    return null;
  }
}

async function change(id, fn) {
  const last = writing.get(id) || Promise.resolve();
  const next = last.then(async () => {
    const room = (await load(id)) || cleanRoom({});
    const out = await fn(room);
    if (out !== false) {
      await mkdir(DIR, { recursive: true });
      await writeFile(roomPath(id), JSON.stringify(room), "utf8");
    }
    return out;
  }).catch((e) => { console.error("room write failed:", e && e.message); return null; });
  writing.set(id, next.catch(() => {}));
  return next;
}

/* Rooms nobody has opened in KEEP_DAYS, swept once an hour. Cheap: a directory
 * listing and a stat each, on a box that will hold tens of rooms. */
async function sweep() {
  try {
    const cut = Date.now() - KEEP_DAYS * 86400_000;
    for (const f of await readdir(DIR)) {
      if (!f.endsWith(".json")) continue;
      const p = path.join(DIR, f);
      const s = await stat(p);
      if (s.mtimeMs < cut) await unlink(p);
    }
  } catch { /* nothing to sweep on a box with no rooms yet */ }
}

/* ---- the pages ---------------------------------------------------------- */
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};

async function file(res, name) {
  /* The path is built here from a fixed list, never from the request, so there
     is no traversal to defend against — but the resolve check stays anyway,
     because the day somebody adds a route that passes a name through is the
     day it matters and nobody will re-read this function then. */
  const p = path.resolve(PUBLIC, name);
  if (!p.startsWith(PUBLIC)) return send(res, 403, "text/plain", "no");
  try {
    const body = await readFile(p);
    send(res, 200, TYPES[path.extname(p)] || "application/octet-stream", body);
  } catch {
    send(res, 404, "text/plain", "not here");
  }
}

function send(res, code, type, body) {
  res.writeHead(code, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    /* The link carries the key in its fragment. A referrer would send the path
       to whatever a person taps through to; the fragment never travels, but
       the room id does, and a room id in somebody else's logs is a thing we
       can decline to hand out for free. */
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

const json = (res, code, o) => send(res, code, "application/json; charset=utf-8", JSON.stringify(o));

async function body(req, cap = 64_000) {
  return new Promise((ok, no) => {
    let n = 0; const bits = [];
    req.on("data", (c) => {
      n += c.length;
      if (n > cap) { no(new Error("too big")); req.destroy(); return; }
      bits.push(c);
    });
    req.on("end", () => { try { ok(JSON.parse(Buffer.concat(bits).toString("utf8"))); } catch { ok({}); } });
    req.on("error", no);
  });
}

/* ---- the five routes ----------------------------------------------------- */
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://ferry");
  const p = url.pathname;

  try {
    /* A NEW ROOM. The id is made here and the key is not: the page makes its
       own key and never sends it, so this route hands back ten characters and
       has no idea what room it just made possible. */
    if (req.method === "POST" && p === "/api/room") {
      const id = randomBytes(8).toString("hex").slice(0, 10);
      await change(id, (room) => { room.at = new Date().toISOString(); });
      return json(res, 201, { room: id });
    }

    /* EVERYTHING SINCE. Polled rather than streamed: this is opened inside
       WeChat's browser as often as not, where a long-lived connection is the
       thing that quietly stops working on a train. Two seconds is fast enough
       to feel live and slow enough to cost nothing. */
    if (req.method === "GET" && p === "/api/since") {
      const id = url.searchParams.get("room") || "";
      if (!ROOM.test(id)) return json(res, 400, { error: "room" });
      const room = await load(id);
      if (!room) return json(res, 404, { error: "gone" });
      const after = String(url.searchParams.get("after") || "");
      // Touched on read: a room being watched is not idle. See KEEP_DAYS.
      change(id, (r) => { r.seen = new Date().toISOString(); });
      const lines = after ? room.lines.filter((l) => l.at > after) : room.lines;
      return json(res, 200, { lines, keepDays: KEEP_DAYS });
    }

    /* ONE LINE, ALREADY SEALED. What arrives is base64 and a side; anything
       readable is refused by cleanLine rather than stored, because a page with
       a bug that posts plaintext would turn the promise off for that room and
       nobody would ever know. */
    if (req.method === "POST" && p === "/api/say") {
      const b = await body(req);
      const id = String(b.room || "");
      if (!ROOM.test(id)) return json(res, 400, { error: "room" });
      const line = cleanLine(b);
      if (!line) return json(res, 400, { error: "shape" });
      const out = await change(id, (room) => {
        /* A cap per room, so one page in a loop cannot fill the disk. Old
           lines are dropped from the front — a room is a conversation, not an
           archive, and the alternative is refusing to accept new ones, which
           breaks the room for both people instead of trimming it. */
        room.lines.push(line);
        if (room.lines.length > 2000) room.lines = room.lines.slice(-2000);
        room.seen = new Date().toISOString();
        return line.at;
      });
      return json(res, 201, { at: out });
    }

    /* THE ONE TIME TEXT IS READABLE HERE. Sent by the page on purpose, for one
       line, and held for one request. Never written, never logged. */
    if (req.method === "POST" && p === "/api/translate") {
      if (!translateReady()) return json(res, 503, { error: "unconfigured" });
      const b = await body(req, 8_000);
      const id = String(b.room || "");
      const out = await translate(b.text, { to: b.to, room: ROOM.test(id) ? id : "anon" });
      if (out.error) {
        const code = out.error === "slow-down" || out.error === "busy" ? 429
          : out.error === "unconfigured" ? 503 : 400;
        return json(res, code, out);
      }
      return json(res, 200, { text: out.text });
    }

    /* WHAT THIS BOX CAN DO, so the page can say "translation is off" rather
       than offering it and failing. */
    if (req.method === "GET" && p === "/api/hello") {
      return json(res, 200, { translate: translateReady(), keepDays: KEEP_DAYS });
    }

    // A room's address. The page is the same for every room; the id is in the
    // path so the link can be sent, and the key is in the fragment so it
    // cannot be.
    if (req.method === "GET" && (p === "/" || /^\/r\/[a-z0-9]{10}$/.test(p))) {
      return file(res, "index.html");
    }
    if (req.method === "GET" && /^\/[a-z0-9.-]+\.(js|css|svg|png|webmanifest)$/.test(p)) {
      return file(res, p.slice(1));
    }
    return send(res, 404, "text/plain", "not here");
  } catch (e) {
    console.error("ferry:", e && e.message);
    return json(res, 500, { error: "failed" });
  }
});

await mkdir(DIR, { recursive: true });
sweep();
setInterval(sweep, 3600_000).unref();
server.listen(PORT, () => {
  console.log("ferry on " + PORT + (translateReady() ? "" : " — translation off, no key"));
});
