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
import { translate, configured as translateReady } from "./lib/translate.js";

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

/* How many separate people have to report a post before it comes down on its
 * own, pending somebody reading it.
 *
 * Two is a compromise and worth naming as one. Higher, and something genuinely
 * harmful sits up until a person happens to look, which on a board read in
 * another timezone can be all night. Lower — one — and any single reader can
 * hide anybody's post, which is a weapon rather than a safeguard.
 *
 * Nothing is deleted either way. An auto-hidden post goes to the top of the
 * queue with its reasons attached and one press puts it back, so a false
 * report costs a post a few hours and never costs it its existence. */
const REPORTS_TO_HIDE = Math.max(1, Number(process.env.BOARD_REPORTS_TO_HIDE || 2));

/* A person a reader can reach who is not this software. Apple asks for one
 * wherever people's words appear in front of each other, and it is the right
 * thing on a board regardless. Unset, the page says nothing rather than
 * printing an address that bounces. */
const CONTACT = (process.env.BOARD_CONTACT || "").trim();

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

// Who to write to when something is wrong that a report does not cover. Read
// by the page, which prints nothing at all when there is no answer here.
app.get("/api/contact", (_req, res) =>
  res.json({ contact: CONTACT, translate: translateReady() }));

/* The page itself, with its own address written into it.
 *
 * A share card is built by a crawler that fetches the URL once and runs no
 * JavaScript, so og:image has to be absolute and already in the HTML. The
 * board does not know its own hostname until somebody asks for it — it could
 * be behind any proxy, under any name — so the placeholder is filled per
 * request from what the request itself says.
 *
 * The Host header is the client's to set, so this is never trusted for
 * anything: it decides one string in a meta tag and nothing else. A forged
 * host makes a bad share card for the forger and changes nothing here.
 */
const PAGES = new Map();
async function page(file, req, res, next) {
  try {
    if (!PAGES.has(file)) PAGES.set(file, await readFile("public/" + file, "utf8"));
    const proto = String(req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0];
    const host = String(req.get("host") || "").replace(/[^A-Za-z0-9.:-]/g, "").slice(0, 253);
    const origin = host ? proto + "://" + host : "";
    res.set("Content-Type", "text/html; charset=utf-8");
    // A board is the one thing that must never be a day old, and WeChat on iOS
    // caches hard against the URL.
    res.set("Cache-Control", "no-cache");
    res.send(PAGES.get(file).split("{{ORIGIN}}").join(origin));
  } catch (e) { next(e); }
}

/* Two doors, and which is which matters.
 *
 * "/" is the landing page: what this is, who it is for, and how it is run —
 * for somebody sent the address cold, who needs a reason before a feed. It
 * carries the newest few posts live, so it is evidence rather than a
 * description, and it is honest when there are none yet.
 *
 * "/board" is the board itself, and it is what every share link points at. A
 * link forwarded into a chat was sent because of something ON the board, so it
 * must open there rather than on a page explaining what a board is.
 *
 * BOARD_AT_ROOT=1 swaps them, for the day the board is busy enough that the
 * feed is the better front door.
 */
const ROOT_IS_BOARD = process.env.BOARD_AT_ROOT === "1";
app.get("/", (req, res, next) => page(ROOT_IS_BOARD ? "index.html" : "landing.html", req, res, next));
app.get(["/feed", "/feed/", "/index.html"], (req, res, next) => page("index.html", req, res, next));
/* /board was the address before this was called the Feed. Kept as a permanent
 * redirect rather than deleted: links already sent into a WeChat chat cannot be
 * edited, and a dead link is the one failure a shared board cannot recover
 * from. It costs one line and never needs revisiting. */
app.get(["/board", "/board/"], (req, res) => res.redirect(301, "/feed" + (req.url.split("?")[1] ? "?" + req.url.split("?")[1] : "")));
app.get(["/about", "/landing.html"], (req, res, next) => page("landing.html", req, res, next));

/* The second front door.
 *
 * Same board, same people, same queue — a different entrance, for students
 * deciding whether to study abroad at all rather than students already here.
 *
 * Deliberately NOT a second deployment. Splitting the data would have opened
 * this one empty, and an empty board is what kills a community before it
 * starts. The people already here are the reason to come: foreigners who moved
 * to another country to study are the one group who can say what that is
 * actually like without being paid to say it is worth it. */
app.get(["/abroad", "/abroad/"], (req, res, next) => page("abroad.html", req, res, next));
app.get(["/buddies", "/buddies/"], (req, res, next) => page("buddies.html", req, res, next));

/* One person, at an address that can be sent to somebody.
 *
 * /p/<name>. A profile you cannot share is not a profile, and until this
 * existed sharing yours sent people to /feed, where they saw their OWN empty
 * profile and wondered what you meant.
 *
 * The card matters as much as the page. WeChat's crawler fetches this once and
 * runs no JavaScript, so the name and the face have to be in the served HTML —
 * which means this route reads the person before it answers, rather than
 * serving a shell the browser fills in.
 */
app.get("/p/:handle", async (req, res, next) => {
  try {
    const want = String(req.params.handle || "").toLowerCase().slice(0, 40);
    const board = await store.load(FILE);
    const q = board.people.find((x) =>
      x.state === "published" && x.handle.toLowerCase() === want);

    if (!PAGES.has("person.html")) PAGES.set("person.html", await readFile("public/person.html", "utf8"));
    const proto = String(req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0];
    const host = String(req.get("host") || "").replace(/[^A-Za-z0-9.:-]/g, "").slice(0, 253);
    const origin = host ? proto + "://" + host : "";

    // Escaped, because these go into an HTML attribute and a handle is written
    // by whoever signed up. A name is not markup.
    const esc = (v) => String(v || "").replace(/[&<>"']/g,
      (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

    const name = q ? q.handle : want;
    const about = q
      ? [q.campus, q.level, q.goal].filter(Boolean).join(" · ").slice(0, 160)
      : "";
    // Their own face on the card where there is one, so a shared profile looks
    // like the person rather than like the site.
    const card = (q && q.photo && q.photoState === "published")
      ? origin + "/api/public-media?id=" + encodeURIComponent(q.photo)
      : origin + "/share.png";

    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "no-cache");
    res.send(PAGES.get("person.html")
      .split("{{ORIGIN}}").join(origin)
      .split("{{HANDLE}}").join(esc(want))
      .split("{{NAME}}").join(esc(name))
      .split("{{ABOUT}}").join(esc(about))
      .split("{{CARD}}").join(esc(card)));
  } catch (e) { next(e); }
});

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

  /* The handles of everybody this reader follows, so the page can offer a feed
   * that is only them. Resolved here rather than in the browser because the
   * follow points at a person and a post carries a handle, and the join needs
   * both lists — which the browser has no business holding. */
  const mineFollows = me
    ? new Set(board.follows.filter((f) => f.by === me)
        .map((f) => (board.people.find((q) => q.id === f.who) || {}).handle)
        .filter(Boolean).map((h) => h.toLowerCase()))
    : new Set();

  res.json({
    following: [...mineFollows],
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
/* Tap anything and find out what it says.
 *
 * Public, because the board is public and a reader who has to sign in to read
 * a sign is a reader who gives up. Rate limited by browser and capped for the
 * day in lib/translate.js — a public endpoint that calls a model is a bill
 * anybody can run up.
 *
 * The reader's own language comes from the page rather than a header, because
 * somebody reading in Chinese on a phone set to English is the ordinary case
 * here, not the exception.
 */
app.post("/api/translate", express.json({ limit: "16kb" }), async (req, res) => {
  if (!translateReady()) return res.status(503).json({ error: "unconfigured" });
  const out = await translate(String(req.body?.text || ""), {
    lang: req.body?.lang === "zh" ? "zh" : "en",
    by: store.hashDevice(String(req.body?.device || ""), SALT) || req.ip || "anon",
  });
  // A refusal is not a server fault: the caller is told which kind so the page
  // can say "wait a moment" rather than "something went wrong".
  if (out.error) {
    const code = out.error === "slow-down" ? 429 : out.error === "unconfigured" ? 503 : 400;
    return res.status(code).json(out);
  }
  res.json(out);
});

// ---------------------------------------------------------------------------
// People
//
// Your own profile, keyed to the browser rather than to an account. Opening
// the board shows it at the top: a face you can add in one tap, a name, and
// what you are working on. It is the difference between a noticeboard and a
// place with people on it.
//
// There is no sign-in, so "yours" means posted from this browser — the same
// salted hash that lets you take your own post back. One profile per browser.
// ---------------------------------------------------------------------------

const shownPerson = (q, mine) => ({
  ...q,
  // A photograph nobody has looked at yet is shown to its owner and to no one
  // else. Words can be taken back; a face somebody has already saved cannot.
  photo: (q.photoState === "published" || mine) ? q.photo : "",
  cover: (q.photoState === "published" || mine) ? q.cover : "",
  photoPending: mine && q.photoState !== "published" && Boolean(q.photo || q.cover),
  by: undefined,
});

/* Everybody looking for a study buddy.
 *
 * Public, and only what has been through a person: a directory of foreign
 * students is the thing on this board most worth being careful with, so an
 * unreviewed profile is not in it at all.
 *
 * Only people who have said they are looking. Posting on the board does not
 * put you in here — being findable is a thing you choose, and one tap takes
 * you back out.
 */
app.get("/api/people", async (req, res) => {
  const board = await store.load(FILE);
  const me = store.hashDevice(String(req.get("x-board-device") || ""), SALT);
  res.set("Cache-Control", "no-store");
  const live = board.people.filter((q) => q.state === "published" && q.looking && q.handle);
  res.json({
    people: live.map((q) => ({ ...shownPerson(q, q.by === me), mine: q.by === me })),
  });
});

/* Follow, and unfollow, which is the same button. */
app.post("/api/follow", express.json({ limit: "8kb" }), async (req, res) => {
  const me = store.hashDevice(String(req.body?.device || ""), SALT);
  const who = String(req.body?.who || "");
  if (!me || !/^[a-f0-9]{20}$/.test(who)) return res.status(400).json({ error: "no" });
  const on = req.body?.on !== false;

  const out = await change((board) => {
    const target = board.people.find((x) => x.id === who && x.state === "published");
    if (!target) return null;
    // Following yourself is not a thing anybody means to do.
    if (target.by === me) return { count: store.followersOf(board.follows, who), following: false };
    const had = board.follows.findIndex((f) => f.by === me && f.who === who);
    if (on && had < 0) board.follows.push(store.cleanFollow({ by: me, who }));
    if (!on && had >= 0) board.follows.splice(had, 1);
    return { count: store.followersOf(board.follows, who), following: on };
  });
  if (!out) return res.status(404).json({ error: "no such person" });
  res.json({ ok: true, ...out });
});

app.get("/api/person", async (req, res) => {
  const want = String(req.query.handle || "").toLowerCase();
  if (!want) return res.status(400).json({ error: "no" });
  const board = await store.load(FILE);
  const me = store.hashDevice(String(req.get("x-board-device") || ""), SALT);
  const q = board.people.find((x) =>
    x.state === "published" && x.handle.toLowerCase() === want);
  if (!q) return res.json({ person: null });
  const live = board.posts.filter((p) => p.state === "published");
  res.set("Cache-Control", "no-store");
  res.json({
    person: {
      ...shownPerson(q, q.by === me),
      mine: q.by === me,
      followers: store.followersOf(board.follows, q.id),
      // Whether YOU follow them. Never who else does — a count is a fact about
      // a person, a list is a social graph.
      following: Boolean(me) && board.follows.some((f) => f.by === me && f.who === q.id),
    },
    // What they have actually put on the board, which is the only evidence a
    // stranger has that a profile is a person.
    posts: live.filter((p) => store.isOwnPost(p)
      && (p.handle || "").toLowerCase() === want).slice(0, 5),
  });
});

app.get("/api/me", async (req, res) => {
  const me = store.hashDevice(String(req.get("x-board-device") || ""), SALT);
  const board = await store.load(FILE);
  res.set("Cache-Control", "no-store");
  const mine = me && board.people.find((q) => q.by === me);
  if (!mine) return res.json({ person: null });
  // How much they have put in, which is the only figure here worth showing.
  // Not followers: there is nothing to follow, and a count of nothing is worse
  // than no count.
  const posts = board.posts.filter((p) => p.by === me && p.state === "published");
  res.json({
    person: shownPerson(mine, true),
    posts: posts.filter(store.isOwnPost).length,
    replies: posts.filter((p) => p.re).length,
  });
});

app.put("/api/me", express.json({ limit: "36mb" }), async (req, res) => {
  const me = store.hashDevice(String(req.body?.device || ""), SALT);
  if (!me) return res.status(400).json({ error: "no" });

  const words = [req.body?.goal, req.body?.trade, req.body?.campus, req.body?.handle]
    .filter(Boolean).join(" ");
  // The one rule a profile here has, checked before anything is written.
  const shaped = store.contactShaped(words);
  if (shaped) return res.status(400).json({ error: "contact", what: shaped });

  const shot = async (data, type) => {
    if (!data) return null;
    const buf = Buffer.from(String(data), "base64");
    if (buf.length > 25 * 1024 * 1024) return { tooBig: true };
    const id = await putMedia(buf, String(type || ""));
    return id ? { id } : { badType: true };
  };
  const face = await shot(req.body?.photo, req.body?.photoType);
  const back = await shot(req.body?.cover, req.body?.coverType);
  if (face?.tooBig || back?.tooBig) return res.status(413).json({ error: "tooBig" });
  if (face?.badType || back?.badType) return res.status(415).json({ error: "badType" });

  const out = await change((board) => {
    let q = board.people.find((x) => x.by === me);
    if (!q) {
      q = store.cleanPerson({ id: store.newId(), at: new Date().toISOString(), by: me });
      board.people.push(q);
    }
    if (typeof req.body.looking === "boolean") q.looking = req.body.looking;
    for (const k of ["handle", "level", "campus", "goal", "trade", "here"]) {
      if (req.body[k] !== undefined) q[k] = String(req.body[k]).slice(0, k === "goal" ? 600 : 120);
    }
    if (Array.isArray(req.body.free)) q.free = req.body.free;
    if (Array.isArray(req.body.speaks)) q.speaks = req.body.speaks;
    // A new picture goes back into the queue. Changing your face is the same
    // act as adding one, and a profile that could be edited past review would
    // make the review pointless.
    if (face?.id) { q.photo = face.id; q.photoState = "held"; }
    if (back?.id) { q.cover = back.id; q.photoState = "held"; }

    /* THE WORDS GO UP; THE PICTURE WAITS.
     *
     * These were one state, and only the photo had a way through the queue —
     * so a profile made of words alone was held for ever, with nothing in any
     * queue to release. Its own page was blank, it was absent from the
     * directory, and there was no action anybody could take to change that.
     *
     * Splitting them is the honest version of the rule already written here:
     * words can be taken back and a face somebody has saved cannot. The words
     * have already been through the one check that matters — no phone, no
     * WeChat, no email — and a profile nobody can see is not a profile. */
    q.state = "published";
    const clean = store.cleanPerson(q);
    Object.assign(q, clean);
    return q;
  });

  if (face?.id || back?.id) tell("held", { ...out, note: "New profile photo" });
  res.json({ person: shownPerson(out, true) });
});

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/* Somebody says this should not be up.
 *
 * A report is stored as an ordinary row pointing at the post, the same shape as
 * a reply or a like, so there is no second store to keep in step and the admin
 * queue reads it with the code it already has.
 *
 * It is deliberately cheap to file and impossible to file twice: pressing the
 * button again from the same browser replaces the reason rather than adding to
 * the count. The count is what decides whether something comes down, so it
 * counts people, not presses.
 */
app.post("/api/report", express.json({ limit: "64kb" }), async (req, res) => {
  const id = String(req.body?.id || "");
  const why = String(req.body?.why || "").trim().slice(0, 400);
  const me = store.hashDevice(String(req.body?.device || ""), SALT);
  if (!/^[a-f0-9]{20}$/.test(id)) return res.status(400).json({ error: "no such post" });
  if (!me) return res.status(400).json({ error: "no" });

  const out = await change((board) => {
    const post = board.posts.find((x) => x.id === id);
    // The same answer whether the post is missing or already gone, so this
    // cannot be used to ask which ids exist.
    if (!post || post.state === "removed") return null;

    // One report per person per post. A second press is a correction, not a
    // second voice.
    const mine = board.posts.find((x) => x.report === id && x.by === me);
    if (mine) { mine.why = why; mine.at = new Date().toISOString(); }
    else {
      board.posts.push(store.cleanPost({
        id: store.newId(), at: new Date().toISOString(),
        state: "held", report: id, why, by: me,
      }));
    }

    const { count } = store.reportsFor(board.posts, id);
    // Enough separate people have said so. Down it comes, pending a person —
    // and it keeps its reasons, because the person about to look needs them.
    if (count >= REPORTS_TO_HIDE && post.state === "published") {
      post.state = "held";
      post.why = "Taken down by " + count + " reports, waiting for somebody to read it.";
      return { post, count, hidden: true };
    }
    return { post, count, hidden: false };
  });

  if (!out) return res.status(404).json({ error: "no such post" });
  // The admin hears about it either way. A single report on a board this size
  // is worth a person's attention, whether or not it crossed the line.
  tell(out.hidden ? "held" : "reported", { ...out.post, why: why || out.post.why });
  res.json({ ok: true, hidden: out.hidden });
});

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
// ---------------------------------------------------------------------------
// What this board knows about itself
//
// Read by the counter on the numbers page, beside its own figures and never
// merged into them. The two measure different things and the difference is the
// point: the counter counts arrivals, from a snippet in the page; this counts
// participation, from the record. A board can be busy and silent, or quiet and
// full of people talking, and one number cannot say which.
//
// So the unit is stated in the response rather than assumed by the reader. It
// is people who have put something up — not visitors, which this server has no
// way to know, because it logs no page views and is not going to start.
//
// Public, like the counter's own collection endpoint, and safe to be: every
// figure is a count. No handle, no id, no device hash and no post leaves here.
// ---------------------------------------------------------------------------
const TZ = process.env.TZ || "Asia/Shanghai";

/** The owner's day, not UTC. A UTC boundary in Asia cuts the evening in half,
 *  which is the busiest part of it. Same format and same reasoning as the
 *  counter's own dayKey, so a figure here and a figure there mean one day. */
const dayKey = (ts) => new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(ts));

app.get("/api/count", async (_req, res) => {
  const board = await store.load(FILE);
  const today = dayKey(Date.now());
  const weekAgo = dayKey(Date.now() - 6 * 86400_000);

  /* Everything a person did, whichever kind of row it was. A reply and a like
   * are participation as much as a post is, and a profile is somebody arriving
   * — counting only top-level posts would call a board dead on the day it was
   * busiest with answers. */
  const acts = [
    ...board.posts.map((p) => ({ by: p.by, at: p.at })),
    ...board.people.map((q) => ({ by: q.by, at: q.at })),
  ].filter((a) => a.by);

  // First seen and last seen per person, in one pass.
  const first = new Map(), last = new Map();
  for (const a of acts) {
    const d = dayKey(a.at);
    if (!first.has(a.by) || d < first.get(a.by)) first.set(a.by, d);
    if (!last.has(a.by) || d > last.get(a.by)) last.set(a.by, d);
  }

  const activeToday = [...last].filter(([, d]) => d === today).map(([by]) => by);
  const real = board.posts.filter((p) => p.state === "published");

  res.set("Cache-Control", "no-store");
  res.json({
    // Quoted by the panel rather than relabelled, so if this sentence changes
    // the page repeats the new one instead of captioning it wrongly.
    unit: "people who have posted, replied or made a profile — not visitors",
    count: first.size,
    today: activeToday.length,
    week: [...last].filter(([, d]) => d >= weekAgo).length,
    activeToday: activeToday.length,
    // Somebody who was already here before today and came back. The figure
    // that separates a board with readers from a board with one good week.
    returningToday: activeToday.filter((by) => (first.get(by) || today) < today).length,
    // What is actually on it, which is the other half of the same question.
    posts: real.filter(store.isOwnPost).length,
    replies: real.filter((p) => p.re).length,
    profiles: board.people.filter((q) => q.state === "published").length,
    // Waiting for somebody to read it. Not a vanity figure — it is the one
    // number on this page that is a task rather than a result.
    held: board.posts.filter((p) => p.state === "held" && store.isOwnPost(p)).length,
    facesHeld: board.people.filter((q) => q.photoState !== "published" && (q.photo || q.cover)).length,
  });
});

app.get("/api/public", admin, async (req, res) => {
  const board = await store.load(FILE);
  if (req.query.queue !== "1") {
    return res.json({ posts: board.posts.filter((p) => p.state === "published") });
  }
  res.set("Cache-Control", "no-store");

  // Reports are rows pointing at posts, so they are filtered out of every list
  // here — a queue full of one-line pointers is a queue nobody reads — and
  // folded back on as counts and reasons against the post they concern.
  const real = board.posts.filter(store.isOwnPost);
  const withReports = (p) => {
    const { count, why } = store.reportsFor(board.posts, p.id);
    return count ? { ...p, reports: count, reportedFor: why } : p;
  };

  res.json({
    // Held, most-reported first. A post that was up and got objected to needs
    // reading before one that has never been seen: somebody is already looking
    // at the first kind.
    posts: real.filter((p) => p.state === "held").map(withReports)
      .sort((a, b) => (b.reports || 0) - (a.reports || 0)),
    live: real.filter((p) => p.state === "published").map(withReports),
    refused: real.filter((p) => p.state === "refused"),
    removed: real.filter((p) => p.state === "removed"),
    // Profile photographs waiting to be looked at. Their own list rather than
    // mixed in with the posts: releasing a face is a different decision from
    // releasing a sentence, and the panel should not have to tell them apart.
    faces: board.people.filter((q) => q.photoState !== "published" && (q.photo || q.cover)),
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
    // Putting a reported post back clears what was said about it. Without this
    // the old reports still count, and the next single report hides it again —
    // so a decision already made would be overturned by one person.
    board.posts = board.posts.filter((x) => x.report !== id);
    return p;
  });
  if (!post) return res.status(404).json({ error: "no such post" });
  tell("published", post);
  res.json({ ok: true, id });
});

// Taking one down. Marked rather than deleted: "was taken down" is a different
// fact from "never existed", and the second is what deleting the row would say.
app.post("/api/face/release", admin, async (req, res) => {
  const id = String(req.query.id || "");
  const out = await change((board) => {
    const q = board.people.find((x) => x.id === id);
    if (!q) return null;
    q.photoState = "published";
    if (q.state !== "published") q.state = "published";
    return q;
  });
  if (!out) return res.status(404).json({ error: "no such person" });
  res.json({ ok: true, id });
});

app.delete("/api/face", admin, async (req, res) => {
  const id = String(req.query.id || "");
  const out = await change((board) => {
    const q = board.people.find((x) => x.id === id);
    if (!q) return null;
    // Cleared rather than refused: the person is still here, the picture is
    // simply gone, and they can put up a different one.
    q.photo = ""; q.cover = ""; q.photoState = "refused";
    q.why = String(req.query.why || "That photo was not put up.").slice(0, 400);
    return q;
  });
  if (!out) return res.status(404).json({ error: "no such person" });
  res.json({ ok: true, id });
});

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

/* ---------------------------------------------------------------------------
 * Profiles made before the words and the picture were separate states
 *
 * `state` on a person defaults to "held", and until the split there was
 * nothing in this file that ever set it to anything else — only the photo had
 * a way through the queue. So every profile made before that change is held
 * for ever: its own page says "No profile yet", it is absent from the
 * directory, and no action anybody can take will move it, because there is no
 * route that publishes a person's words on their own.
 *
 * That makes the migration safe to state plainly: a held person is a legacy
 * row, never a moderator's decision, because no moderator was ever given the
 * button. Nothing here promotes a photograph — `photoState` is untouched, so a
 * face still waits for somebody to look at it.
 *
 * Runs once. After the first pass every row is published and the loop finds
 * nothing, so it costs one read of a file already being read.
 * ------------------------------------------------------------------------- */
{
  const board = await store.load(FILE);
  const stuck = board.people.filter((q) => q.state !== "published" && q.handle);
  if (stuck.length) {
    const ids = new Set(stuck.map((q) => q.id));
    await change((b) => {
      for (const q of b.people) if (ids.has(q.id)) q.state = "published";
      return true;
    });
    console.log(`published ${stuck.length} profile(s) held only because they predate the split`);
  }
}

app.listen(PORT, () => {
  console.log(`board on :${PORT}, data in ${DIR}`);
  if (!KEY) console.error("BOARD_ADMIN_KEY is not set — the admin routes will refuse everything.");
  if (!SALT) console.error("BOARD_SALT is not set — device hashes are unsalted.");
});
