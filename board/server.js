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

/* What is kept. Required by every app store and by law in most of the places
 * this is read from — and worth having on its own terms, since the honest
 * answer here is unusually short. */
app.get(["/privacy", "/privacy/"], (req, res, next) => page("privacy.html", req, res, next));
app.get(["/buddies", "/buddies/"], (req, res, next) => page("buddies.html", req, res, next));
// Your own messages. noindex in the page, and it holds nothing without the
// device id the browser sends — but a private page should not be in a sitemap
// either way.
app.get(["/notes", "/notes/"], (req, res, next) => page("notes.html", req, res, next));

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

  /* The face to draw beside each post.
   *
   * A post carries a handle and the photograph belongs to the profile, so the
   * feed drew a letter in a circle for everybody — including people who had
   * put a picture up, which made the board look like nobody had bothered.
   * Joined here for the same reason the follow list is: the two halves are on
   * this side, and shipping the whole people list to the browser to do it
   * there would hand out a directory nobody asked for.
   *
   * Matched on the device hash where there is one, because that is who
   * actually wrote it, and only falling back to the name for older posts made
   * before the hash was stored. Nothing published is exposed by this that the
   * profile page does not already show.
   */
  const byHash = new Map(), byName = new Map();
  for (const q of board.people) {
    if (q.state !== "published" || q.photoState !== "published" || !q.photo) continue;
    if (q.by) byHash.set(q.by, q.photo);
    if (q.handle) byName.set(q.handle.toLowerCase(), q.photo);
  }
  const faceFor = (p) =>
    (p.by && byHash.get(p.by)) || byName.get(String(p.handle || "").toLowerCase()) || "";

  res.json({
    following: [...mineFollows],
    posts: live.filter(store.isOwnPost).map((p) => ({
      ...p,
      ...store.threadFor(live, p.id),
      face: faceFor(p),
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

/* ---------------------------------------------------------------------------
 * Notes: one private message, answered once, and then it is over
 *
 * The list gives you somebody's campus and their free days and no way to say
 * anything to them, which makes it a directory rather than an introduction.
 * What it needed was the smallest thing that closes that gap without becoming
 * a chat app on a board with no accounts.
 *
 * So: a mutual swap, shaped as a private reply. You write once. They may
 * answer once. Whatever either of you put in those two messages — a WeChat id,
 * usually — is how you carry on somewhere else. Then this thread is closed and
 * neither of you can write again.
 *
 * Why closed rather than open:
 *   - Two messages is exactly enough to trade contact details, which is the
 *     whole job. A third is a conversation, and a conversation here would need
 *     blocking, muting, deletion and everything else that follows.
 *   - Nobody can be worn down. The person who did not answer is not written to
 *     again, and "no answer" needs no button and costs nothing to say.
 *   - There is no inbox to fill. The worst case for a person on the list is a
 *     handful of unanswered introductions, not a stream.
 *
 * What is not here, deliberately: nothing is held for review, because a
 * private message read by a moderator before delivery is not private; and
 * contact details are not filtered out, because carrying one is the point.
 * What holds instead is that the person who received a note can report it, and
 * reporting is the only way anybody else ever reads it.
 * ------------------------------------------------------------------------- */

/* How many introductions one browser may send in a day. Low, because the
 * failure this prevents is somebody writing to every woman on the list in one
 * evening, and nobody with an honest reason to write needs more. */
const NOTES_A_DAY = Math.max(1, Number(process.env.BOARD_NOTES_A_DAY || 5));

/** Where a thread between two people has got to. The whole rule, in one place,
 *  so the route and the page cannot disagree about it. */
function threadState(notes, me, them) {
  const between = notes.filter(
    (n) => (n.by === me && n.to === them) || (n.by === them && n.to === me));
  if (!between.length) return { can: true, why: "" };
  if (between.length >= 2) return { can: false, why: "closed" };
  // Exactly one. Only the person who received it may answer, and only now.
  const one = between[0];
  return one.to === me
    ? { can: true, why: "answering", answering: one.id }
    : { can: false, why: "waiting" };
}

/* Writing to somebody. */
app.post("/api/note", express.json({ limit: "16kb" }), async (req, res) => {
  const me = store.hashDevice(String(req.body?.device || ""), SALT);
  const who = String(req.body?.who || "");
  const text = String(req.body?.text || "").trim().slice(0, 600);
  const re = String(req.body?.re || "");
  if (!me) return res.status(400).json({ error: "no" });
  if (!text) return res.status(400).json({ error: "empty" });
  if (!/^[a-f0-9]{20}$/.test(who)) return res.status(400).json({ error: "gone" });

  const out = await change((board) => {
    const target = board.people.find((x) => x.id === who && x.state === "published");
    // The same answer for a person who does not exist and one who has taken
    // themselves down, so this cannot be used to ask which ids are real.
    if (!target) return { error: "gone" };
    if (target.by === me) return { error: "self" };

    // You need a profile to write to somebody. Not a rule for its own sake:
    // an introduction from a name that does not exist is not one, and the
    // person receiving it has nothing to decide about.
    const mine = board.people.find((q) => q.by === me);
    if (!mine || !mine.handle) return { error: "profile" };

    const state = threadState(board.notes, me, target.by);
    if (!state.can) return { error: state.why };
    if (!state.answering && store.sentToday(board.notes, me) >= NOTES_A_DAY) {
      return { error: "enough" };
    }

    const note = store.cleanNote({
      id: store.newId(), at: new Date().toISOString(),
      by: me, to: target.by, re, text,
    });
    if (!note) return { error: "no" };
    board.notes.push(note);
    return { note, answering: Boolean(state.answering) };
  });

  if (out.error) {
    const code = out.error === "gone" ? 404 : (out.error === "enough" ? 429 : 400);
    return res.status(code).json({ error: out.error });
  }
  // Nothing is told to the panel. A note nobody reported is not the admin's to
  // know about, and a webhook carrying one would make that untrue.
  res.status(201).json({ ok: true, id: out.note.id, answering: out.answering });
});

/* Mine, both directions.
 *
 * The device id travels in a header rather than the query, because a query
 * string is the part of a request that ends up in logs and referrers. */
app.get("/api/notes", async (req, res) => {
  const board = await store.load(FILE);
  const me = store.hashDevice(String(req.get("x-board-device") || ""), SALT);
  res.set("Cache-Control", "no-store");
  if (!me) return res.json({ notes: [], unread: 0 });

  // Whose it is, in the only terms a reader can use: a name and a face. The
  // device hash on either end never leaves this function.
  const name = (hash) => {
    const q = board.people.find((x) => x.by === hash);
    return q ? { who: q.id, handle: q.handle, photo: q.photoState === "published" ? q.photo : "" }
             : { who: "", handle: "", photo: "" };
  };

  const notes = store.notesFor(board.notes, me).map((n) => {
    const mine = n.by === me;
    const them = name(mine ? n.to : n.by);
    return {
      id: n.id, at: n.at, text: n.text, re: n.re, mine,
      ...them,
      // Only ever shown to the person who received it: "they have read it" is
      // a fact about the reader, and the sender is not owed it.
      seen: mine ? undefined : n.seen,
      reported: Boolean(n.report),
      // Whether this can still be answered, so the page does not offer a box
      // that the server will refuse.
      canAnswer: !mine && threadState(board.notes, me, n.by).can,
    };
  });

  res.json({ notes, unread: notes.filter((n) => !n.mine && !n.seen).length });
});

/* Read. Set by the person who received it and by nobody else. */
app.post("/api/note/seen", express.json({ limit: "8kb" }), async (req, res) => {
  const me = store.hashDevice(String(req.body?.device || ""), SALT);
  if (!me) return res.status(400).json({ error: "no" });
  await change((board) => {
    for (const n of board.notes) if (n.to === me) n.seen = true;
  });
  res.json({ ok: true });
});

/* Somebody says a note should not have been sent.
 *
 * This is the only route that puts a private message in front of the panel,
 * and only the person who received it can press it. */
app.post("/api/note/report", express.json({ limit: "16kb" }), async (req, res) => {
  const me = store.hashDevice(String(req.body?.device || ""), SALT);
  const id = String(req.body?.id || "");
  const why = String(req.body?.why || "").trim().slice(0, 400);
  if (!me || !/^[a-f0-9]{20}$/.test(id)) return res.status(400).json({ error: "no" });

  const out = await change((board) => {
    const note = board.notes.find((n) => n.id === id && n.to === me);
    if (!note) return null;
    note.report = why || "Reported by the person who received it.";
    // Written into the queue as a held post, so it lands in the same list the
    // panel already reads and needs no second surface to be seen in. The text
    // is carried, because a report nobody can read is not a report.
    board.posts.push(store.cleanPost({
      id: store.newId(), at: new Date().toISOString(), state: "held",
      handle: "a private message", note: note.text, by: note.by,
      why: "Reported by the person it was sent to: " + note.report,
    }));
    return note;
  });
  if (!out) return res.status(404).json({ error: "no such note" });
  tell("reported", { id: out.id, note: out.text, why: out.report });
  res.json({ ok: true });
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
      // Whether you may write to them, and whether this would be an answer.
      // Decided here rather than on the page, so the button and the route
      // cannot come to different conclusions about the same two people.
      thread: (me && q.by !== me) ? threadState(board.notes, me, q.by) : { can: false, why: "" },
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
    // Whether this save is somebody joining the list, rather than editing a
    // profile they were already on it with. Read before the change, because
    // after it there is no way to tell the two apart.
    const joining = typeof req.body.looking === "boolean" && req.body.looking && !q.looking;
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

    /* Joining the list says so on the board.
     *
     * It was silent: you ticked a box and the only place anything changed was
     * a directory nobody had a reason to open. The board is where people
     * already are, and somebody looking for a study partner is exactly what it
     * is for.
     *
     * Held like everything else, and carrying their own picture so it is
     * something to look at rather than a line of text. The sentence is NOT
     * written here — the post carries the facts and the page writes the
     * sentence in whichever language it is being read in. Their own words, if
     * they wrote any, stay their own.
     *
     * Once. Editing your days later does not announce you again, because the
     * board is not a log of somebody's settings. */
    if (joining && q.handle) {
      board.posts.push(store.cleanPost({
        id: store.newId(),
        at: new Date().toISOString(),
        state: "held",
        by: me,
        handle: q.handle,
        note: q.goal || "",
        photo: q.photo || "",
        looking: true,
        campus: q.campus || "",
        free: q.free || [],
      }));
    }
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

    // When it was written, if that is not now.
    //
    // The operator's route is the one place backdating belongs: transcribing
    // something said elsewhere, or standing a demo board up with a history
    // instead of twelve posts sharing one second. Bounded so a typo cannot
    // park a post in 1970 or in next year, where it would sort above
    // everything forever.
    let at = new Date().toISOString();
    if (parsed.fields.at) {
      const asked = when(parsed.fields.at);
      if (asked.error) return res.status(400).json({ error: asked.error });
      at = asked.at;
    }

    // Whose it is. The device id is hashed here with this server's salt, the
    // same as on the readers' route — the caller never learns the hash and
    // never supplies one, so a post made this way counts toward the same
    // person and nothing else can be claimed by asserting a `by`.
    const by = parsed.fields.device
      ? store.hashDevice(String(parsed.fields.device), SALT) : "";

    // Made by the operator rather than by a reader, so it goes straight up.
    // The admin is the review.
    const post = store.cleanPost({
      id: store.newId(), at, state: "published",
      handle: account, note, photo, by,
      re: String(parsed.fields.re || ""),
      topic: String(parsed.fields.topic || "").slice(0, 40),
    });
    await change((board) => { board.posts.unshift(post); });
    tell("published", post);
    res.status(201).json({ id: post.id });
  });

/* A time somebody supplied for a post, checked.
 *
 * Bounded at both ends: a post dated in the future sorts above everything for
 * as long as it exists, and one dated in 1970 is almost always a typo rather
 * than a memory. Neither is a thing an operator means to do. */
function when(value) {
  const t = new Date(String(value));
  const ms = t.getTime();
  if (!Number.isFinite(ms)) return { error: "at is not a date" };
  if (ms > Date.now() + 60_000) return { error: "at is in the future" };
  if (ms < Date.now() - 5 * 365 * 24 * 3600 * 1000) {
    return { error: "at is more than five years ago" };
  }
  return { at: t.toISOString() };
}

// When a post says it was written.
//
// Correcting the clock, not the words — for something transcribed from
// elsewhere, or a board being stood up with a history rather than with every
// row sharing one second. Nothing else about the post is touched.
app.post("/api/feed/when", admin, async (req, res) => {
  const id = String(req.query.id || "");
  const asked = when(req.query.at);
  if (asked.error) return res.status(400).json({ error: asked.error });
  const post = await change((board) => {
    const p = board.posts.find((x) => x.id === id);
    if (!p) return null;
    p.at = asked.at;
    return p;
  });
  if (!post) return res.status(404).json({ error: "no such post" });
  res.json({ ok: true, id, at: post.at });
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

// Everybody with a name, so the panel can show a person and the picture they
// have. Held profiles included: somebody whose words are still in the queue is
// exactly who an operator might be about to put a face to.
app.get("/api/faces", admin, async (_req, res) => {
  const board = await store.load(FILE);
  res.set("Cache-Control", "no-store");
  res.json({
    people: board.people
      .filter((q) => q.handle)
      .map((q) => ({
        id: q.id, handle: q.handle, campus: q.campus || "",
        looking: Boolean(q.looking), state: q.state || "",
        photoState: q.photoState || "", photo: q.photo || "",
      }))
      .sort((a, b) => a.handle.localeCompare(b.handle)),
  });
});

// Putting a picture on somebody from the panel.
//
// It goes straight up. The queue exists to catch what a stranger uploads
// before anyone has looked at it, and this is the opposite case: the operator
// chose the file and chose the person, so there is nobody left to review it.
// Their words are published with it, because a face on a profile the board
// will not show anybody is a picture stored for nothing.
app.post("/api/face", admin, express.raw({ type: "multipart/form-data", limit: "36mb" }),
  async (req, res) => {
    const parsed = multipart(req);
    if (!parsed) return res.status(400).json({ error: "expected multipart/form-data" });
    const id = String(parsed.fields.id || "").trim();
    if (!parsed.file) return res.status(400).json({ error: "no picture in that form" });

    const photo = await putMedia(parsed.file.buf, parsed.file.type);
    if (!photo) return res.status(415).json({ error: "that kind of file is not accepted here" });

    const out = await change((board) => {
      const q = board.people.find((x) => x.id === id);
      if (!q) return null;
      q.photo = photo;
      q.photoState = "published";
      if (q.state !== "published") q.state = "published";
      q.why = "";
      return q;
    });
    if (!out) return res.status(404).json({ error: "no such person" });
    res.json({ ok: true, id, photo, handle: out.handle });
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
