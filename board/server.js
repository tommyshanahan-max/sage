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
import { timingSafeEqual, randomUUID, createHmac } from "node:crypto";
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

/* TEST MODE, AND IT ENDS BY ITSELF.
 *
 * While there are fewer than this many people on the board, a new post goes
 * straight up rather than into the queue. (Photographs are a separate decision
 * — see below — and do not wait at any size.)
 *
 * The reason is not that review stopped mattering. It is that a board with
 * four people on it is being tested, not read, and every one of those four is
 * somebody who was asked to come and try it — a tester who uploads a face,
 * sends the link to a friend and gets back a page with a letter on it
 * concludes the app is broken, which is the wrong thing to learn from a test.
 *
 * TWENTY-FIVE, RAISED FROM TEN, because the door changed underneath this
 * number. Ten was the right figure when anybody with the address could walk
 * in: the test had to end before the first stranger arrived. Nobody arrives
 * without a code now, and every code was handed over by somebody already here,
 * so the population at twenty is the same kind of population as at eight —
 * people who were asked. What the door does not do is make them all careful,
 * so this still expires, and twenty-five is where it stops being a test.
 *
 * It expires on its own, which is the point: nobody has to remember to turn
 * moderation back on. Once this many people have a name up, every new post
 * waits for a person again. Reporting works throughout, two reports hide a
 * post on their own, and anything already up can still be taken down.
 */
const OPEN_UNTIL = Number(process.env.BOARD_OPEN_UNTIL || 25);
const openStill = (board) =>
  board.people.filter((q) => q.handle && q.state === "published").length < OPEN_UNTIL;

/* PHOTOGRAPHS DO NOT WAIT AT ALL, and that is a separate decision from the one
 * above rather than a special case of it.
 *
 * A held photograph is invisible to everybody but its owner, so the person who
 * uploaded it sees their own face and everybody else sees a letter — including
 * whoever they just sent their link to. There is no way to tell that apart
 * from a failed upload, and the conclusion somebody draws is that the app is
 * broken. That cost lands on every single person who joins, immediately, and
 * it does not get smaller as the board grows.
 *
 * What the queue was protecting against is still handled: a photograph can be
 * reported by anybody who sees it, the panel lists every face and can take one
 * down, and the profile it belongs to can be removed with it. The difference
 * is that a face is now presumed fine until somebody says otherwise, which is
 * what the words on this board have always been for a reader — the queue only
 * ever stood in front of the picture.
 *
 * Set BOARD_REVIEW_PHOTOS=1 to put it back. */
const REVIEW_PHOTOS = process.env.BOARD_REVIEW_PHOTOS === "1";

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
/* THE DOOR, IN FRONT OF EVERYTHING. Only in "read" mode.
 *
 * A page request gets the door itself rather than a redirect, so the address
 * somebody was sent survives being turned away: they type the code and the
 * link they followed is still in the bar. An API request gets 403 and a word,
 * because nothing behind here is for a stranger to read.
 *
 * What stays open: the door, spending a code, asking whether you are in, and
 * the files the door itself is made of. Everything in /public is code — no
 * post, no profile and no photograph is served from there.
 */
/* WHAT IS OUTSIDE THE DOOR, and it is a short list on purpose.
 *
 *   /about  what this is, one featured post, and the waiting list
 *   /rules  how people behave in here, which names no member
 *   /level  THE FOUR QUESTIONS, and this one is the whole growth mechanic:
 *           a member shares their result into a group chat, somebody who is
 *           not a member taps it, takes the test themselves, and lands on the
 *           waiting list under their own number. A teaser that asks nothing
 *           and gives something is worth more than a page describing a board.
 *
 * The test needs no route of its own — it is four questions and a canvas — so
 * nothing but the page is opened, and a stranger who finishes it is offered
 * the list instead of the buttons that post to a feed they cannot read. */
const OPEN_PATHS = /^\/(enter|i\/|r\/|about|rules|level|api\/enter|api\/admitted|api\/hello|api\/wait|favicon|apple-touch-icon|manifest|share\.png|robots\.txt)/;

app.use(async (req, res, next) => {
  if (INVITE !== "read") return next();
  // The operator's own routes carry the admin secret and are checked by their
  // own middleware. Without this, the door shut on the hand that opens it:
  // minting an invite was refused before the admin check ever ran.
  if (KEY && safeEqual(String(req.get("x-admin-secret") || req.query.secret || ""), KEY)) return next();
  if (OPEN_PATHS.test(req.path)) return next();
  // Anything with a dot in the last segment is a file: the stylesheet and the
  // modules the door is built from have to load for the door to work at all.
  if (/\.[a-z0-9]{2,5}$/i.test(req.path)) return next();
  if (await admittedReq(req)) return next();
  if (req.path.startsWith("/api/")) {
    return res.status(403).json({ error: "invite", where: "/enter" });
  }
  res.status(200);
  return page("enter.html", req, res, next);
});

app.get("/", (req, res, next) => page(ROOT_IS_BOARD ? "index.html" : "landing.html", req, res, next));
app.get(["/feed", "/feed/", "/index.html"], (req, res, next) => page("index.html", req, res, next));
/* /board was the address before this was called the Feed. Kept as a permanent
 * redirect rather than deleted: links already sent into a WeChat chat cannot be
 * edited, and a dead link is the one failure a shared board cannot recover
 * from. It costs one line and never needs revisiting. */
app.get(["/board", "/board/"], (req, res) => res.redirect(301, "/feed" + (req.url.split("?")[1] ? "?" + req.url.split("?")[1] : "")));
app.get(["/about", "/landing.html"], (req, res, next) => page("landing.html", req, res, next));

/* ONE DOOR, DIFFERENT SIGNS.
 *
 * /r/film is the same page as /about with the room written into it: the same
 * board, the same members, the same graph behind it — and a heading somebody
 * in that world recognises as being for them.
 *
 * This is the whole of "separate it upstream" and the reason not to build two
 * products. A filmmaker who opens /about sees a board that could be for
 * anybody; one who opens /r/film sees a film board, joins it, and is then
 * introduced to the lawyer, the fixer and the person with a factory — which
 * is exactly what a second platform would have walled off.
 *
 * The room is read from the path by the page, so nothing here needs to know
 * the four names. An unknown one falls through to the ordinary front door
 * rather than a 404: a link somebody typed wrong should still open the board.
 */
app.get("/r/:room", (req, res, next) => page("landing.html", req, res, next));

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
/* The house rules. Behind the door like everything else — they describe how
   people behave in here, and out there they would be a leaflet. */
app.get(["/rules", "/rules/"], (req, res, next) => page("rules.html", req, res, next));
/* THE STUDY-BUDDY LIST IS OFF FOR V1, for the same reason as the inbox and by
 * the same mechanism: not broken, just not this version. Browse is the same
 * people with their faces on, and two ways into one list is a choice between a
 * thing and itself.
 *
 * /api/people stays on — it is what the deck reads. */
const BUDDIES_ON = false;
app.get(["/buddies", "/buddies/"], (req, res, next) =>
  (BUDDIES_ON ? page("buddies.html", req, res, next)
              : res.status(404).send("Not found")));
// Your own messages. noindex in the page, and it holds nothing without the
// device id the browser sends — but a private page should not be in a sitemap
// either way.
/* PRIVATE MESSAGES ARE OFF FOR V1.
 *
 * One flag rather than five commented-out routes, because the feature is
 * finished and the reason it is off is not a code problem: a private inbox is
 * worth having when there are enough people for somebody to write to, and
 * until then it is a tab that opens an empty room.
 *
 * Off means off at the door as well as in the app — the page and every route
 * behind it answer 404, so a link somebody kept, or a request somebody writes
 * by hand, gets the same answer as the tab that is no longer in the bar.
 *
 * Set this true and the whole thing is back: nothing else was removed. */
/* ---------------------------------------------------------------------------
 * INVITE ONLY
 *
 * Three settings, and the default is the one that changes nothing:
 *
 *   ""      off. Anybody can read and anybody can post. What it does today.
 *   "post"  anybody can read; a code is needed to post or make a page.
 *   "read"  a code is needed to see anything but the landing page.
 *
 * "post" is the one to want. A board nobody can read cannot be recommended by
 * the people already in it — every shared test result, every profile link sent
 * into a group chat, is a stranger arriving at a door. Letting them read and
 * asking for a code before they write keeps the invitation meaningful and
 * keeps the front door open.
 *
 * "read" is there because it is the thing people mean by invite-only, and
 * because it is one word to change if the board ever needs to be private.
 *
 * ADMISSION IS A FACT ABOUT A BROWSER, like everything else here. It is the
 * same salted hash the rest of the app keys on — which means the recovery key
 * carries admission with it for free: paste the key on a second browser and
 * that browser hashes to the same person, and is already in. Nothing extra
 * had to be built for that, and it is the reason the door tells people to get
 * out of WeChat before they spend the code rather than afterwards.
 * ------------------------------------------------------------------------- */
const INVITE = ["post", "read"].includes(process.env.BOARD_INVITE || "")
  ? process.env.BOARD_INVITE : "";

/** Has this browser spent a code? */
async function admitted(device) {
  const me = store.hashDevice(String(device || ""), SALT);
  if (!me) return false;
  const board = await store.load(FILE);
  return board.invites.some((v) => v.usedBy === me && !v.off);
}

/* The gate on writing. Reading is never gated by this — see the note above on
 * why "post" is the setting to want. */
const gate = async (req, res, next) => {
  if (INVITE !== "post" && INVITE !== "read") return next();
  const device = req.body?.device || req.get("x-board-device");
  if (await admitted(device)) return next();
  // 403 and a word the page can act on, rather than a sentence to display: the
  // board sends people to the door rather than printing an error at them.
  res.status(403).json({ error: "invite", where: "/enter" });
};

/* PRIVATE MESSAGES, AND THE SWITCH THAT KILLS THEM.
 *
 * This was a hard `false` while there was nowhere for a message to lead: two
 * strangers, two messages, and then a dead end. It is on now because a match
 * has somewhere to lead — a room only the two of them can see, which is the
 * safer thing to offer a matched pair than "hand over your WeChat id".
 *
 * It stays an environment switch rather than becoming plain code, and the
 * default is on. BOARD_NOTES=off in .env turns every message route in this
 * file into a 404 without a deploy, which is the thing you want within reach
 * on the one surface here that two people can use to reach each other.
 */
const NOTES_ON = String(process.env.BOARD_NOTES || "on").toLowerCase() !== "off";
const notesOff = (req, res, next) =>
  (NOTES_ON ? next() : res.status(404).json({ error: "not in this version" }));

app.get(["/notes", "/notes/"], notesOff,
  (req, res, next) => page("notes.html", req, res, next));

app.get(["/groups", "/groups/"], notesOff,
  (req, res, next) => page("groups.html", req, res, next));

/* ADMISSION THE SERVER CAN SEE BEFORE ANY SCRIPT RUNS.
 *
 * The rest of this app identifies a browser from localStorage, which only
 * exists once the page is running. That is fine for gating what somebody
 * writes and useless for gating what they are served: an HTML request carries
 * no localStorage, so "read" mode needs one thing the browser sends on its
 * own. A cookie is that thing.
 *
 * It holds the same salted hash as everything else, signed with the same salt
 * so it cannot be written by hand — a hash in a cookie with no signature would
 * be a door anybody could open by pasting somebody else's hash into it. The
 * hash is not a secret, the signature is.
 *
 * httpOnly so no script can read it, Lax so a link from WeChat still carries
 * it, and a year long because being invited does not expire.
 */
const sign = (v) => createHmac("sha256", SALT || "unsalted").update(v).digest("hex").slice(0, 32);
const inCookie = (req) => {
  const raw = String(req.headers.cookie || "");
  const m = /(?:^|;\s*)board_in=([a-f0-9]{32})\.([a-f0-9]{32})/.exec(raw);
  return m && sign(m[1]) === m[2] ? m[1] : "";
};
const setCookie = (res, hash) => {
  res.append("Set-Cookie", "board_in=" + hash + "." + sign(hash)
    + "; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure");
};

/** Is this request from a browser that has spent a code? Cookie or header. */
async function admittedReq(req) {
  const fromCookie = inCookie(req);
  const fromHeader = store.hashDevice(String(req.get("x-board-device") || ""), SALT);
  if (!fromCookie && !fromHeader) return false;
  const board = await store.load(FILE);
  return board.invites.some((v) => !v.off && v.usedBy
    && (v.usedBy === fromCookie || v.usedBy === fromHeader));
}

/* ---------------------------------------------------------------------------
 * The door
 * ------------------------------------------------------------------------- */

/* /i/K7M2QP is the shape that goes in a message: the code is in the address,
 * so tapping the link is the whole of it. The page reads the code out of the
 * path, which is why this serves the same file as /enter. */
app.get(["/enter", "/enter/", "/i/:code"], (req, res, next) =>
  page("enter.html", req, res, next));

/* SPENDING A CODE.
 *
 * Rate limited hard, by browser: five wrong answers an hour. Thirty
 * characters to the power of six is about seven hundred million, and five
 * tries an hour makes walking that hopeless — which is the whole security
 * model, and enough for a board whose contents are public to read anyway.
 */
const tries = new Map();
setInterval(() => {
  const hour = Date.now() - 3600_000;
  for (const [k, v] of tries) if (v.at < hour) tries.delete(k);
}, 600_000).unref?.();

app.post("/api/enter", express.json({ limit: "8kb" }), async (req, res) => {
  const me = store.hashDevice(String(req.body?.device || ""), SALT);
  if (!me) return res.status(400).json({ error: "no device" });

  // Already in — including somebody who pasted their key on a second browser,
  // which is the commonest reason to arrive here a second time.
  if (await admitted(req.body?.device)) {
    // Already in, but possibly on a browser that has never had the cookie —
    // somebody who pasted their key. Give it to them now, or "read" mode
    // would keep turning away a person it has already let in.
    setCookie(res, me);
    return res.json({ ok: true, already: true });
  }

  const now = Date.now();
  const t = tries.get(me) || { n: 0, at: now };
  if (t.at < now - 3600_000) { t.n = 0; t.at = now; }
  if (t.n >= 5) return res.status(429).json({ error: "slow-down", left: 0 });

  const code = store.cleanCode(req.body?.code);
  if (!code) {
    t.n += 1; t.at = now; tries.set(me, t);
    return res.status(400).json({ error: "bad", left: Math.max(0, 5 - t.n) });
  }

  let outcome = "";
  const got = await change((board) => {
    const v = board.invites.find((x) => x.code === code);
    if (!v || v.off) { outcome = "bad"; return null; }
    if (v.usedBy) { outcome = v.usedBy === me ? "mine" : "used"; return null; }
    v.usedBy = me;
    v.usedAt = new Date().toISOString();
    outcome = "in";
    return v;
  });

  if (outcome === "in" || outcome === "mine") {
    tries.delete(me);
    setCookie(res, me);
    // The label is for whoever handed the code out, not for the person
    // spending it — what crosses the door is that somebody vouched.
    return res.json({ ok: true, by: got ? got.who : "" });
  }
  t.n += 1; t.at = now; tries.set(me, t);
  const left = Math.max(0, 5 - t.n);
  if (outcome === "used") return res.status(409).json({ error: "used", left });
  return res.status(404).json({ error: "bad", left });
});

/** Whether this browser is in, and whether being in is required at all. */
app.get("/api/admitted", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const me = store.hashDevice(String(req.get("x-board-device") || ""), SALT);
  const yes = INVITE ? await admittedReq(req) : true;
  // Pasting a key on a second browser admits it, and that browser needs the
  // cookie too or "read" mode will turn it away on the next page load.
  if (yes && me && INVITE) setCookie(res, me);
  res.json({ mode: INVITE, in: yes });
});

/* THE CODE IN SOMEBODY'S OWN HEADER.
 *
 * Every member carries one live invite. Asking for it mints it if they have
 * none, and returns the same one until it is spent — one live code each is
 * what makes "one code, one person" true from the member's side as well as
 * the operator's, and it is what keeps the record of who brought whom.
 *
 * Labelled with their own name, so the invite list reads as a family tree
 * rather than a pile of six-character strings.
 */
app.get("/api/my-invite", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const me = store.hashDevice(String(req.get("x-board-device") || ""), SALT);
  if (!me) return res.status(400).json({ error: "no device" });
  if (INVITE && !(await admittedReq(req))) {
    return res.status(403).json({ error: "invite", where: "/enter" });
  }

  const board = await store.load(FILE);
  const mine = board.people.find((q) => q.by === me);
  const who = (mine && mine.handle) || "";

  /* STANDING, BEFORE A CODE EXISTS. Not a 403: being unable to bring somebody
     in today is an ordinary state of an ordinary member, not an error, and the
     header has something to say about it. The reasons go back with it so the
     screen can say all of them at once — see standing(). */
  const rank = standing(board, me);
  if (!rank.can) return res.json({ code: "", need: rank.need, guests: rank.guests });

  /* TODAY'S, NOT A STANDING ONE.
   *
   * The code in somebody's header changes every day: yesterday's, if nobody
   * spent it, stops working when the new one is minted. That is what makes the
   * line "it changes every day" true rather than decorative — and it means a
   * code that leaks out of a group chat is worth something for one day.
   *
   * The owner's day, not UTC, for the same reason the counter uses it: a UTC
   * boundary in Asia cuts the evening in half.
   */
  const today = dayKey(Date.now());
  const spare = board.invites.find((v) =>
    v.by === me && !v.usedBy && !v.off && dayKey(v.at) === today);
  if (spare) return res.json({ code: spare.code, day: today });

  const made = await change((b) => {
    // Checked again inside the queue: two taps on a slow connection would
    // otherwise mint two codes and give away one of them for nothing.
    const already = b.invites.find((v) =>
      v.by === me && !v.usedBy && !v.off && dayKey(v.at) === today);
    if (already) return already;
    // Yesterday's, unspent, stops working now. Spent ones are untouched —
    // being let in does not expire, only the invitation does.
    for (const v of b.invites) {
      if (v.by === me && !v.usedBy && !v.off) v.off = true;
    }
    const have = new Set(b.invites.map((v) => v.code));
    let code = store.newCode();
    while (have.has(code)) code = store.newCode();
    const v = store.cleanInvite({ code, who, at: new Date().toISOString(), by: me });
    b.invites.push(v);
    return v;
  });
  res.json({ code: made.code, day: today });
});

/* Minting, from the box. The label is a note to self — how you know who did
 * not turn up, and how one code is taken back without touching the others. */
app.post("/api/invite", admin, express.json({ limit: "8kb" }), async (req, res) => {
  const who = String(req.body?.who || "").slice(0, 40);
  const n = Math.max(1, Math.min(50, Number(req.body?.n) || 1));
  const made = [];
  await change((board) => {
    const have = new Set(board.invites.map((v) => v.code));
    for (let i = 0; i < n; i++) {
      let code = store.newCode();
      while (have.has(code)) code = store.newCode();
      have.add(code);
      const v = store.cleanInvite({ code, who, at: new Date().toISOString() });
      board.invites.push(v);
      made.push(v);
    }
    return true;
  });
  res.status(201).json({ made });
});

/* LETTING IN THE PEOPLE WHO ARE ALREADY HERE.
 *
 * The door admits a browser that has spent a code. Everybody who joined before
 * there was a door has spent nothing — so switching to "read" would shut out
 * every person already using the board, and they would not come back to find
 * out why.
 *
 * This mints one invite per existing person and marks it spent by them. They
 * are admitted with a row saying how, which is the same record everybody else
 * has, so one of them can be taken back like any other. Run it before turning
 * the door on, or immediately after.
 *
 * WHO COUNTS AS ALREADY HERE: anybody with a profile or a post on the board.
 * Not a reader — this app has no way to know about those, and would not want
 * one.
 */
app.post("/api/admit-existing", admin, async (_req, res) => {
  const now = new Date().toISOString();
  let added = 0, already = 0;
  const board = await store.load(FILE);

  const here = new Set();
  for (const q of board.people) if (q.by) here.add(q.by);
  for (const p of board.posts) if (p.by && store.isOwnPost(p)) here.add(p.by);

  await change((b) => {
    const admittedAlready = new Set(b.invites.filter((v) => v.usedBy && !v.off)
      .map((v) => v.usedBy));
    const have = new Set(b.invites.map((v) => v.code));
    for (const by of here) {
      if (admittedAlready.has(by)) { already++; continue; }
      let code = store.newCode();
      while (have.has(code)) code = store.newCode();
      have.add(code);
      const q = b.people.find((x) => x.by === by);
      b.invites.push(store.cleanInvite({
        code, at: now, usedBy: by, usedAt: now,
        who: (q && q.handle) || "here before the door",
      }));
      added++;
    }
    return true;
  });
  res.json({ added, already, people: here.size });
});

/** What has been handed out, and what became of it. */
app.get("/api/invite", admin, async (_req, res) => {
  const board = await store.load(FILE);
  res.set("Cache-Control", "no-store");
  res.json({
    invites: board.invites.map((v) => ({
      code: v.code, who: v.who, at: v.at, off: v.off,
      // Never the hash: it identifies a browser, and this list is read by a
      // person deciding who to chase, not by anything that needs an id.
      used: Boolean(v.usedBy), usedAt: v.usedAt,
    })),
  });
});

/** Taking one back. The row stays, so the record of who had it stays. */
app.delete("/api/invite", admin, express.json({ limit: "8kb" }), async (req, res) => {
  const code = store.cleanCode(req.query.code || req.body?.code);
  if (!code) return res.status(400).json({ error: "no such code" });
  const got = await change((board) => {
    const v = board.invites.find((x) => x.code === code);
    if (!v) return null;
    v.off = true;
    return v;
  });
  if (!got) return res.status(404).json({ error: "no such code" });
  res.json({ ok: true, code });
});

// The type sort. Twenty forced choices and where they put you, ported from
// Fern — the scoring and the items are in /type-items.js, which the page and
// nothing else reads.
app.get(["/type", "/type/"], (req, res, next) => page("type.html", req, res, next));

// Ten levels, found in four questions. The cards and the search are in
// /level-cards.js, which the page and nothing else reads.
app.get(["/level", "/level/"], (req, res, next) => page("level.html", req, res, next));

// Everyone on the study-buddy list, one at a time, photograph first. Only
// people who put themselves on that list are in it — the same opt-in the list
// itself uses, so nobody is browsable who did not choose to be findable.
//
// The same document as the feed. Browsing is now the top of that page and the
// posts are underneath it, so this address is a scroll position rather than a
// page — and one copy of the feed rather than two.
app.get(["/browse", "/browse/"], (req, res, next) => page("index.html", req, res, next));

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
  /* NOBODY ELSE'S BUSINESS. How many people opened somebody's page is a fact
     about them and their readers, and a directory that published it would let
     anybody rank the students on it. Kept for the owner, dropped for everyone
     else, and dropped HERE so that a route added later cannot publish it by
     forgetting to. */
  views: mine ? q.views : undefined,
  regs: mine ? q.regs : undefined,
  // A photograph nobody has looked at yet is shown to its owner and to no one
  // else. Words can be taken back; a face somebody has already saved cannot.
  photo: (q.photoState === "published" || mine) ? q.photo : "",
  cover: (q.photoState === "published" || mine) ? q.cover : "",
  photoPending: mine && q.photoState !== "published" && Boolean(q.photo || q.cover),
  by: undefined,
});

/* WHO BROUGHT THEM.
 *
 * The invite row already holds both ends of this — `by` is the member who made
 * the code, `usedBy` is the browser that spent it — so nothing new is stored to
 * answer it. What is new is showing it.
 *
 * WHY IT IS WORTH SHOWING. A password on its own is a lock. A password with a
 * name attached is a vouch: people are careful about who they bring when their
 * own judgement stays on the record, which is most of what makes a members'
 * club work and none of what makes it feel like one.
 *
 * Only when a MEMBER made the code. Codes minted from the box have no `by`, so
 * the seven people who were here before the door existed show nothing rather
 * than being credited to nobody.
 */
function broughtBy(board, q) {
  if (!q || !q.by) return "";
  const invite = board.invites.find((v) => v.usedBy === q.by && v.by);
  if (!invite) return "";
  const host = board.people.find((x) => x.by === invite.by
    && x.state === "published" && x.handle);
  return host ? host.handle : "";
}

/* ---------------------------------------------------------------------------
 * COLLABORATION RANK
 *
 * The figure on a profile used to be a Chinese level, which made this look
 * like a language app on a board that is not one. This is what replaces it:
 * not what somebody knows, but what they have actually done WITH other people
 * here.
 *
 * WHY THESE FIVE AND IN THIS ORDER. Each rung is a thing that cannot happen
 * on your own — every one of them needs somebody else to have acted. That is
 * the whole point: effort alone does not move you, and neither does
 * popularity. Being answered is the first rung because being answered once is
 * the difference between having joined and having arrived.
 *
 *   guest      Nobody has answered you yet. Where everybody starts.
 *   contact    Somebody answered you — a reply on the board, or a note.
 *   regular    You have put something up in three separate weeks. Not volume:
 *              the one thing a board cannot fake is somebody who keeps
 *              coming back.
 *   connector  Two people you brought are still here and have spoken. The
 *              rung that is about other people's presence rather than yours,
 *              and the one worth having.
 *   principal  Three who stayed and spoke, and five different people have
 *              answered you. The board is different for them being on it.
 *
 * IT IS A TITLE, NOT A SCORE. No number, no position in a list, nothing to
 * be bottom of — a board this size where everybody knows each other cannot
 * carry a ranking of its members without becoming a worse place. Five words,
 * each of which describes a thing that happened.
 *
 * Worked out here from what the server already holds, and never from anything
 * a page sends.
 */
const RANKS = ["guest", "contact", "regular", "connector", "principal"];

function rankOf(board, who) {
  if (!who) return "guest";
  const mine = board.people.find((q) => q.by === who);
  if (!mine) return "guest";

  const live = (p) => p.state === "published" && !p.like && !p.report;
  const myPosts = board.posts.filter((p) => p.by === who && live(p) && !p.re);
  const myIds = new Set(myPosts.map((p) => p.id));

  /* WHO HAS ANSWERED THEM. Distinct people, so one enthusiastic friend is one
     answer however many times they write. Replies on the board and answers to
     a note both count — they are the same act on two surfaces. */
  const answerers = new Set();
  for (const p of board.posts) {
    if (p.re && myIds.has(p.re) && live(p) && p.by && p.by !== who) answerers.add(p.by);
  }
  for (const n of board.notes) {
    if (n.to === who && n.by && n.by !== who) answerers.add(n.by);
  }

  // Three separate weeks with something in them. Weeks and not days: a board
  // is a habit, and a habit shows up across weeks.
  const weeks = new Set(board.posts
    .filter((p) => p.by === who && live(p))
    // weekKey takes a Date, not a number of milliseconds.
    .map((p) => weekKey(new Date(Date.parse(p.at || "") || Date.now()))));

  /* Guests who stayed AND spoke. Both, because somebody brought in who never
     said anything is a name on a list — and it is the same test standing()
     uses to decide whether they may bring anybody else. */
  const guests = board.invites
    .filter((v) => v.by === who && v.usedBy)
    .map((v) => board.people.find((x) => x.by === v.usedBy))
    .filter((g) => g && g.state === "published"
      && board.posts.some((p) => p.by === g.by && live(p)));

  if (guests.length >= 3 && answerers.size >= 5) return "principal";
  if (guests.length >= 2) return "connector";
  if (weeks.size >= 3) return "regular";
  if (answerers.size >= 1) return "contact";
  return "guest";
}

/* ---------------------------------------------------------------------------
 * WHO MAY BRING SOMEBODY IN
 *
 * Every member used to carry a code. That made an invitation a property of
 * having an account, which is another way of saying it was worth nothing —
 * and it put the whole quality of the room in the hands of whoever joined
 * most recently and understood it least.
 *
 * An invitation is a vouch. It is the one thing a member does that changes
 * the room for everybody else, so it is the one thing here you have to be
 * standing to do.
 *
 * WHAT THIS IS NOT. It is not the daily grade. The grade is worked out on the
 * member's own phone from things only that phone knows — a card answered, a
 * streak, which matches are new — and a number a client computes is a number
 * a client can claim. Nothing that decides who gets through the door may rest
 * on a claim. Every test below is a fact this server already holds and did
 * not have to be told.
 *
 * THE FOUR TESTS, in the order they are read to somebody who fails them:
 *
 *   face    You are in Browse: published, named, with a face on the page and
 *           the switch on. You cannot vouch from behind a curtain — the person
 *           you bring can be asked who brought them, and the answer has to be
 *           somebody the room can see. Whether the photograph has cleared the
 *           queue is not part of it: that is the operator's backlog, not the
 *           member's conduct.
 *   days    You have been here a day. Long enough to have read the place you
 *           are recommending, and short enough that it does not refuse a
 *           board where every profile was made yesterday.
 *   said    You have put two things on the board this week. Not a volume test:
 *           two is the difference between a member and a registration — and
 *           it is a week rather than "two, ever, plus one recently" because
 *           the screen has to be able to say the rule in one short sentence
 *           somebody reads once. A rule that needs a paragraph is a rule
 *           people work around instead of following.
 *   guests  The people you already brought are still here, and if you have
 *           brought two or more, at least half of them said something. This is
 *           the only test that is about somebody else, and it is the one that
 *           does the real work: it costs you nothing to invite a stranger
 *           until the stranger's silence is on your record.
 *
 * And a ceiling: GUEST_ROOM live guests at a time. A room this size cannot
 * absorb one person's address book, however good their standing.
 */
/* THE FOUR NUMBERS, OVERRIDABLE FROM .env.
 *
 * BRING_DAYS is one and not three. Three was chosen for a board with history
 * in it; the live one has none — every profile on it was made yesterday, so a
 * three-day rule locked out every member at once, including the people who
 * had already brought somebody in. A rule that refuses everybody is not
 * strict, it is broken.
 *
 * They are read from the environment so the answer to "this is too tight" is
 * a line in .env and a restart, not a commit. */
const num = (name, fallback) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
};
const BRING_DAYS = num("BOARD_BRING_DAYS", 1);
const BRING_SAID = num("BOARD_BRING_SAID", 2);
const BRING_WEEK = num("BOARD_BRING_WEEK", 7);
const GUEST_ROOM = num("BOARD_GUEST_ROOM", 3);

/** Everything about whether one member may mint a code, worked out in one
 *  place so the route that refuses and the screen that explains cannot come to
 *  different conclusions about the same person.
 *
 *  Returns { can, need } where `need` is every unmet test, in reading order —
 *  all of them, not the first: a door that tells you one thing at a time is a
 *  door you knock on four times. */
function standing(board, me) {
  const need = [];
  /* NO PROFILE AT ALL is not a special case. Somebody who came through the
     door and has not made a page yet fails the same three tests everybody
     else fails on their first day, and reading all three is how they find out
     what this place expects — telling them only "be in Browse" would hide the
     other two until they had done it. */
  const q = (me && board.people.find((x) => x.by === me)) || {};

  /* A PHOTO STILL IN THE QUEUE DOES NOT COUNT AGAINST THEM. They uploaded it;
     whether it has been looked at yet is this operator's backlog, and standing
     is a description of what a member does, never of how quickly somebody else
     got round to them. They are in Browse either way — as a letter with their
     name on it until the picture clears — and that is what the test means by
     being visible. `photo` is still required: a page with no face at all is
     not somebody the room can see. */
  const listed = q.state === "published" && q.handle && q.photo && q.looking;
  if (!listed) need.push("face");

  const age = Date.now() - Date.parse(q.at || "");
  if (!(age >= BRING_DAYS * 86400000)) need.push("days");

  /* THIS WEEK, not ever. An invitation earned once and held for good is a
     property of having joined early; earned this week it is a description of
     somebody who is actually here. */
  const said = board.posts.filter((p) => p.by === me && p.state === "published"
    && !p.like && !p.report
    && Date.now() - Date.parse(p.at || "") < BRING_WEEK * 86400000).length;
  if (said < BRING_SAID) need.push("said");

  /* THE GUESTS. Found the same way the "brought in by" line on a profile is
     found — through the invite rows — so there is no second record of who
     brought whom to fall out of step with the first. */
  const codes = board.invites.filter((v) => v.by === me && v.usedBy);
  const guests = codes
    .map((v) => board.people.find((x) => x.by === v.usedBy))
    .filter(Boolean);
  const live = guests.filter((g) => g.state === "published");
  const gone = guests.some((g) => g.state === "removed");
  const spoke = live.filter((g) =>
    board.posts.some((p) => p.by === g.by && p.state === "published"
      && !p.like && !p.report)).length;
  if (gone || (live.length >= 2 && spoke * 2 < live.length)) need.push("guests");
  if (live.length >= GUEST_ROOM) need.push("room");

  return { can: need.length === 0, need, guests: live.length };
}

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
    // Whether this reader already follows them, so the deck's one button can
    // say which of the two things it is about to do. A fact about the reader,
    // which is why this response is never cached.
    people: live.map((q) => ({
      ...shownPerson(q, q.by === me),
      mine: q.by === me,
      following: Boolean(me) && board.follows.some((f) => f.by === me && f.who === q.id),
      // What the two of you have in common, so the deck can say it before
      // anybody presses anything. Both sides of this are already on both
      // pages: it tells the reader nothing they could not work out.
      shared: pairState(board, me, q).shared,
    })),
  });
});

/* ---------------------------------------------------------------------------
 * The public side of the door
 *
 * A door with nothing outside it is a door nobody knocks on. Everything else
 * on this board is behind the password; these three things are not, and each
 * one is a deliberate hole rather than a page that happened to be reachable:
 *
 *   /about   what this is, one featured post, and the waiting list
 *   /rules   how people behave in here, which says nothing about any member
 *   /api/hello, /api/wait  what those two pages need
 *
 * WHAT LEAKS, EXACTLY. One post, chosen from the box, and two numbers. No
 * names of members, no profiles, no photographs of anybody, no feed. A
 * featured post carries the words and the account it went out under and
 * nothing else — see the note in post-feature.mjs about which posts may be
 * chosen and which have to be asked about first.
 */

/** The number of people waiting, but only once it is a crowd.
 *
 *  Below this it is not a queue, it is a list of individuals — and "1 person
 *  is waiting" on a page that anybody can read is a worse advertisement than
 *  no number at all, as well as being nearly a name. */
const WAITING_FLOOR = 5;

app.get("/api/hello", async (req, res) => {
  const board = await store.load(FILE);
  res.set("Cache-Control", "no-store");
  /* A ROOM-FLAVOURED DOOR ASKS FOR A ROOM-FLAVOURED NUMBER. /r/film wants how
     many film people are waiting, not how many people. Unknown or absent means
     the whole board, which is what /about asks for. */
  const only = store.WAITROOMS.includes(String(req.query.room || "")) ? String(req.query.room) : "";
  const featured = board.posts.filter((p) => p.featured && p.state === "published")
    .slice(0, 1)
    .map((p) => ({
      // The words and who said them. Nothing else — no id, no photograph, no
      // way back to a profile.
      note: p.note, zh: p.zh, handle: p.handle, at: p.at,
    }));
  /* A LOOK AT THE FEED WITH NO WORDS IN IT.
   *
   * Blur is not privacy. A page that ships the real text and blurs it in CSS
   * has published the feed to anybody who opens the developer tools, and the
   * whole point of the door is that the feed is behind it.
   *
   * So this sends the SHAPE and not the words: how many posts, how long each
   * one is, and how long each word in it is. The page draws grey blocks at
   * those widths and blurs them, which looks like exactly what it is — a real
   * board with real posts on it — while the sentences never leave this
   * server. Nothing here can be un-blurred, because there is nothing under it.
   *
   * Word lengths and nothing else: no handles, no dates, no ids. A first
   * letter or a timestamp would be the beginning of a way to work out who.
   */
  const peek = board.posts
    .filter((p) => p.state === "published" && !p.re && !p.like && !p.report && p.note)
    .slice(0, 6)
    .map((p) => String(p.note).trim().split(/\s+/).slice(0, 34)
      .map((w) => Math.min(14, [...w].length)));

  /* THE NUMBER FALLS BACK TO THE WHOLE BOARD RATHER THAN TO NOTHING.
   *
   * The floor is there because a small number of people is nearly a list of
   * names, and that is MORE true of a room than of the board. But a
   * room-flavoured door with no queue on it is a door with nothing behind it,
   * which is the one thing this page exists to disprove.
   *
   * So a room below the floor reports the whole board figure and drops the
   * room from the answer. The page then says "6 waiting to get in" instead of
   * "3 in Film & TV" — true, not a name, and still a queue. */
  const all = board.waits.filter((w) => !w.done).length;
  const mine = only ? board.waits.filter((w) => !w.done && w.room === only).length : 0;
  const enough = Boolean(only) && mine >= WAITING_FLOOR;
  const waiting = enough ? mine : all;
  res.json({
    featured,
    peek,
    // The room this number is about, or "" when it is about the whole board.
    // Echoed so the page never holds its own copy of the four names.
    room: enough ? only : "",
    people: board.people.filter((q) => q.state === "published" && q.handle).length,
    // Absent rather than zero below the floor: a page can then say nothing at
    // all instead of saying something small.
    waiting: waiting >= WAITING_FLOOR ? waiting : null,
  });
});

/** Ask to be let in. Public, obviously — it is the only thing here that is. */
app.post("/api/wait", express.json({ limit: "4kb" }), async (req, res) => {
  const me = store.hashDevice(String(req.body?.device || ""), SALT);
  const name = String(req.body?.name || "").trim();
  const reach = String(req.body?.reach || "").trim();
  if (!name || !reach) return res.status(400).json({ error: "both" });

  const out = await change((board) => {
    /* Already in, and asking anyway. Somebody who cleared their browser can
       land on the public page while still being a member in the file; telling
       them to wait for something they already have would be absurd. */
    if (me && board.people.some((q) => q.by === me)) return { already: true };
    const row = store.cleanWait({ name, reach, why: req.body?.why,
      room: req.body?.room, by: me });
    if (!row) return { error: "both" };
    const at = me ? board.waits.findIndex((w) => w.by === me) : -1;
    if (at >= 0) board.waits[at] = { ...row, id: board.waits[at].id, at: board.waits[at].at };
    else board.waits.push(row);
    return { ok: true, again: at >= 0 };
  });
  if (out?.error) return res.status(400).json(out);
  res.json(out);
});

/* WHO CAN BRING SOMEBODY IN, for whoever runs the box.
 *
 * The companion to /api/public?queue=1 and for the same reason: a rule nobody
 * can see the effect of is a rule that gets argued about instead of read. This
 * runs standing() over everybody and says, per member, whether they have a
 * code today and which of the four tests they are failing — so the answer to
 * "who did this just take invitations away from" is a table rather than a
 * guess.
 *
 * Nothing here reaches a member. Standing is between one person and the door,
 * not a ranking to be published on a board where everybody knows each other.
 */
app.get("/api/standing", admin, async (_req, res) => {
  const board = await store.load(FILE);
  res.set("Cache-Control", "no-store");
  const rows = board.people
    .filter((q) => q.handle)
    .map((q) => {
      const rank = standing(board, q.by);
      const said = board.posts.filter((p) => p.by === q.by && p.state === "published"
        && !p.like && !p.report).length;
      return {
        handle: q.handle, at: q.at, state: q.state,
        can: rank.can, need: rank.need, guests: rank.guests, said,
      };
    });
  res.json({ rows });
});

/* LET A WHOLE ROOM IN AT ONCE.
 *
 * Cold start is the only real risk in a room-based board. Admitting one name
 * at a time means each of them arrives to a feed with nothing in it for them,
 * decides the place is empty, and does not come back — and each one of those
 * is a person you had already persuaded.
 *
 * This marks every waiting row in one room as let in and mints a code for
 * each, labelled with their name so the invite list still reads as who
 * brought whom. What comes back is a list of "message this person, this
 * code", which is the actual work.
 *
 * The rows are NOT deleted. A code has to be handed over before it is worth
 * anything, and deleting the way of reaching somebody at the moment you need
 * to reach them is the wrong order. `make waiting-rm` is still how a row goes.
 */
app.post("/api/waiting/admit", express.json({ limit: "2kb" }), admin, async (req, res) => {
  const room = String(req.body?.room || "");
  if (!store.WAITROOMS.includes(room)) return res.status(400).json({ error: "room" });
  const cap = Math.max(1, Math.min(25, Number(req.body?.max) || 25));

  const out = await change((board) => {
    const some = board.waits
      .filter((w) => !w.done && w.room === room)
      .sort((a, b) => String(a.at).localeCompare(String(b.at)))
      .slice(0, cap);
    if (!some.length) return { ok: true, admitted: [] };

    const have = new Set(board.invites.map((v) => v.code));
    const admitted = [];
    for (const w of some) {
      let code = store.newCode();
      while (have.has(code)) code = store.newCode();
      have.add(code);
      board.invites.push(store.cleanInvite({
        code, who: w.name, at: new Date().toISOString(),
      }));
      w.done = "in";
      admitted.push({ name: w.name, reach: w.reach, code });
    }
    return { ok: true, admitted };
  });
  res.json(out);
});

/** The list itself, for whoever runs the box. Never for a member. */
app.get("/api/waiting", admin, async (_req, res) => {
  const board = await store.load(FILE);
  res.set("Cache-Control", "no-store");
  res.json({ waits: board.waits });
});

/** Cross somebody off, once they are in or once they are not. */
/* PUTTING SOMEBODY ON THE LIST FROM THE BOX.
 *
 * The list could only be joined through the public form, which meant the
 * people most likely to be waiting — the ones who asked in a WeChat thread,
 * or in person — were the ones who could not be on it. Every row here is
 * still somebody who actually asked; this is a way of writing down an ask
 * that arrived somewhere else, not a way of inventing a queue. The number on
 * the public page says "N people are waiting" and it has to be true.
 */
app.post("/api/waiting/add", express.json({ limit: "4kb" }), admin, async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const reach = String(req.body?.reach || "").trim();
  if (!name || !reach) return res.status(400).json({ error: "both" });
  const out = await change((board) => {
    const row = store.cleanWait({ name, reach, why: req.body?.why,
      room: req.body?.room });
    if (!row) return { error: "both" };
    /* Deduplicated on the way somebody is reached, newest winning. Adding the
       same WeChat id twice is one person asking twice, not two people. */
    const at = board.waits.findIndex((w) =>
      w.reach.toLowerCase() === row.reach.toLowerCase());
    if (at >= 0) {
      board.waits[at] = { ...row, id: board.waits[at].id, at: board.waits[at].at };
      return { ok: true, again: true, id: board.waits[at].id };
    }
    board.waits.push(row);
    return { ok: true, id: row.id };
  });
  if (out?.error) return res.status(400).json(out);
  res.json(out);
});

app.post("/api/waiting", express.json({ limit: "2kb" }), admin, async (req, res) => {
  const id = String(req.body?.id || "");
  const done = ["", "in", "no"].includes(req.body?.done) ? req.body.done : "";
  const out = await change((board) => {
    const w = board.waits.find((x) => x.id === id);
    if (!w) return { error: "gone" };
    // Deleted outright when asked: a way of reaching a stranger is not
    // something to keep for the record.
    if (req.body?.remove === true) {
      board.waits = board.waits.filter((x) => x.id !== id);
      return { ok: true, removed: true };
    }
    w.done = done;
    return { ok: true, done };
  });
  if (out?.error) return res.status(404).json(out);
  res.json(out);
});

/** Choose the one post that shows outside. Admin only, and one at a time. */
app.post("/api/feature", express.json({ limit: "2kb" }), admin, async (req, res) => {
  const id = String(req.body?.id || "");
  const on = req.body?.on !== false;
  const out = await change((board) => {
    // Only ever one. Two featured posts is a feed, and a feed outside the door
    // is the thing this whole design is avoiding.
    for (const p of board.posts) p.featured = false;
    if (!on) return { ok: true, featured: "" };
    const p = board.posts.find((x) => x.id === id && x.state === "published");
    if (!p) return { error: "gone" };
    p.featured = true;
    return { ok: true, featured: p.id };
  });
  if (out?.error) return res.status(404).json(out);
  res.json(out);
});

/* ---------------------------------------------------------------------------
 * Counting readers without recording them
 *
 * THE WHOLE DESIGN IN ONE SENTENCE: the reader's browser decides whether this
 * visit is worth counting, and the server only ever adds one to a number.
 *
 * The browser knows which pages it has opened and on which days — it already
 * keeps a block list the same way, on the phone and nowhere else. So it sends
 * at most one visit per page per day, and at most one "I have become a regular
 * here" per page per week. A bucket therefore counts PEOPLE, not page loads,
 * and no identity was written down to get there.
 *
 * WHAT THIS BUYS, said plainly: nothing on this server can answer "who looked
 * at whose page". That question is worth far more to somebody else than the
 * answer is to the person whose page it was.
 *
 * WHAT IT COSTS: the bit is self-reported, so a determined person can inflate
 * their own numbers. They can also refresh a page a hundred times, which is
 * true of every counter ever built. The rate limit below is memory only — a
 * Map that dies with the process and is never written to disk — so a restart
 * forgets it, which is the right trade for something that must not become a
 * log by accident.
 */

/** device+page+day, in memory only, so a loop cannot run the number up while
 *  the process is alive. Never persisted: this Map IS the reading history the
 *  file must not contain, which is why it only exists in RAM and dies there. */
const SEEN_ONCE = new Map();
const seenGate = (key) => {
  if (SEEN_ONCE.has(key)) return false;
  // Bounded, so a busy week cannot grow this without limit. Oldest out first.
  if (SEEN_ONCE.size > 20000) {
    for (const k of SEEN_ONCE.keys()) { SEEN_ONCE.delete(k); if (SEEN_ONCE.size < 15000) break; }
  }
  SEEN_ONCE.set(key, 1);
  return true;
};

/** ISO-ish week key. Monday-based, which is what a week is here. */
function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const jan1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const n = Math.ceil(((t - jan1) / 86400000 + 1) / 7);
  return t.getUTCFullYear() + "-W" + String(n).padStart(2, "0");
}

app.post("/api/seen", express.json({ limit: "2kb" }), async (req, res) => {
  const me = store.hashDevice(String(req.body?.device || ""), SALT);
  const who = String(req.body?.who || "");
  if (!/^[a-f0-9]{20}$/.test(who)) return res.status(400).json({ error: "no" });
  const first = req.body?.first === true;
  const regular = req.body?.regular === true;
  if (!first && !regular) return res.json({ ok: true });

  // dayKey wants a timestamp — called bare it formats an Invalid Date and throws.
  const day = dayKey(Date.now());
  const week = weekKey();
  // Answered before the write either way: a reader is never told whether their
  // visit counted, because that is a question only somebody probing would ask.
  res.json({ ok: true });

  await change((board) => {
    const q = board.people.find((x) => x.id === who && x.state === "published");
    // Your own page is not a reader. Without this the number is mostly you.
    if (!q || (me && q.by === me)) return null;
    if (first && seenGate(me + ":" + who + ":" + day)) {
      q.views = { ...(q.views || {}), [day]: (q.views?.[day] || 0) + 1 };
    }
    if (regular && seenGate(me + ":" + who + ":r:" + week)) {
      q.regs = { ...(q.regs || {}), [week]: (q.regs?.[week] || 0) + 1 };
    }
    Object.assign(q, store.cleanPerson(q));
    return null;
  }).catch(() => { /* a counter is never worth failing a page load over */ });
});

/* ---------------------------------------------------------------------------
 * Matches, and the cards two people may hand each other
 *
 * WHAT A MATCH IS: two people who follow each other AND who ticked boxes that
 * answer one another. Following is the consent half and it is the half that
 * cannot be faked by a form — you had to go and press it on their page, and it
 * shows there. The rooms are the discovery half: they decide whether the board
 * says anything about it, and what it says.
 *
 * THE WALL. No shared room, no card. It costs almost nothing — with three
 * picks out of seven pairings two people overlap about nine times in ten — and
 * it buys one real thing: somebody who never ticked a money box cannot be
 * handed an investor's card, whoever follows whom.
 *
 * FOUR DECISIONS BEFORE A WECHAT ID MOVES: I follow you, you follow me, I
 * press give, you press give. Neither of us sees anything from one press. A
 * match is not an introduction and it is not a message.
 *
 * YOU NEED A PAGE. All of this hangs off a person row, so somebody who never
 * made one cannot be followed, cannot match and cannot hold a card. That is
 * the same rule the rest of the board runs on rather than a new one.
 * ------------------------------------------------------------------------- */

const myRow = (board, me) => (me ? board.people.find((x) => x.by === me) : null) || null;

/** Everything true about me and one other person, in one object, computed in
 *  one place — so a button and the route behind it can never disagree about
 *  whether two people may swap anything. */
function pairState(board, me, q) {
  const out = { mutual: false, shared: [], can: false, gave: false, given: false, card: null };
  const mine = myRow(board, me);
  if (!mine || !q || !q.id || q.by === me) return out;

  out.mutual = board.follows.some((f) => f.by === me && f.who === q.id)
    && board.follows.some((f) => f.by === q.by && f.who === mine.id);
  // Public either way: both people's rooms are on both people's pages, so
  // saying what two of them have in common tells nobody anything new. It is
  // what lets a page say "you both want a language exchange" before anybody
  // has followed anybody.
  out.shared = store.scopeFits(mine, q) ? store.sharedRooms(mine, q) : [];
  out.can = out.mutual && out.shared.length > 0;

  const live = (by, who) => board.grants.some((g) => g.by === by && g.who === who && !g.off);
  out.gave = live(me, q.id);
  out.given = live(q.by, mine.id);
  // The card itself only ever comes out here, and only on the last line of the
  // check. A card is read when they gave it, they may still give it, and I am
  // the person they gave it to.
  if (out.can && out.given) {
    /* NARROWED HERE, NOT AT THE ROUTE. The stored row carries the owner's
       device hash, which is the nearest thing this board has to an identity
       and is stripped from everything else that goes out (see shownPerson).
       Copying the two fields rather than the row means a route added later
       cannot leak it by forgetting to. */
    const row = board.cards.find((c) => c.by === q.by);
    if (row) out.card = { wechat: row.wechat, line: row.line };
  }
  return out;
}

/** My own card, which is mine to read whether or not anybody else may. */
app.get("/api/card", async (req, res) => {
  const me = store.hashDevice(String(req.get("x-board-device") || ""), SALT);
  const board = await store.load(FILE);
  res.set("Cache-Control", "no-store");
  if (!me) return res.json({ card: null });
  const card = board.cards.find((c) => c.by === me) || null;
  // Who is holding it, as a count and never as a list — the same rule the
  // follower count runs on. A person is owed the number; nobody is owed the
  // names of everybody who has their WeChat id, least of all as an API.
  const out = board.grants.filter((g) => g.by === me && !g.off).length;
  res.json({ card, out });
});

/** Write it, or clear it. Never validated into a shape: a WeChat id is
 *  whatever WeChat let somebody call themselves. */
app.put("/api/card", express.json({ limit: "8kb" }), gate, async (req, res) => {
  const me = store.hashDevice(String(req.body?.device || ""), SALT);
  if (!me) return res.status(400).json({ error: "no" });
  const out = await change((board) => {
    const row = store.cleanCard({ by: me, wechat: req.body?.wechat, line: req.body?.line });
    const i = board.cards.findIndex((c) => c.by === me);
    // An empty card is a deleted card. Anybody it was given to stops being
    // able to read anything, which is the same as taking it back from all of
    // them at once and is the only bulk revoke there is.
    if (!row.wechat && !row.line) {
      if (i >= 0) board.cards.splice(i, 1);
      return null;
    }
    if (i >= 0) board.cards[i] = row; else board.cards.push(row);
    return row;
  });
  res.json({ card: out });
});

/** Hand it to one person, or take it back from them. */
app.post("/api/card/give", express.json({ limit: "4kb" }), gate, async (req, res) => {
  const me = store.hashDevice(String(req.body?.device || ""), SALT);
  const who = String(req.body?.who || "");
  const on = req.body?.on !== false;
  if (!me || !/^[a-f0-9]{20}$/.test(who)) return res.status(400).json({ error: "no" });

  const out = await change((board) => {
    const q = board.people.find((x) => x.id === who && x.state === "published");
    if (!q) return { error: "gone" };
    const st = pairState(board, me, q);
    // Checked on the way in as well as on the way out. The screen will not
    // offer this button without a match, but a screen is not a check.
    if (!st.can) return { error: "nomatch" };
    if (on && !board.cards.some((c) => c.by === me)) return { error: "nocard" };

    const i = board.grants.findIndex((g) => g.by === me && g.who === who);
    if (i >= 0) board.grants[i] = store.cleanGrant({ ...board.grants[i], off: !on });
    else if (on) board.grants.push(store.cleanGrant({ by: me, who }));
    return { ok: true, gave: on };
  });
  if (out?.error) {
    return res.status(out.error === "gone" ? 404 : 403).json({ error: out.error });
  }
  res.json(out);
});

/** Everybody I match with, and their card where they have given me one. One
 *  request for the whole screen, because the alternative is a page that asks
 *  for a card per person and an access log that reads as a list of who holds
 *  whose. */
app.get("/api/matches", async (req, res) => {
  const me = store.hashDevice(String(req.get("x-board-device") || ""), SALT);
  const board = await store.load(FILE);
  res.set("Cache-Control", "no-store");
  const mine = myRow(board, me);
  if (!mine) return res.json({ matches: [], card: null });

  const rows = [];
  for (const q of board.people) {
    if (q.state !== "published" || !q.handle || q.by === me) continue;
    const st = pairState(board, me, q);
    if (!st.can) continue;
    rows.push({
      id: q.id,
      handle: q.handle,
      photo: q.photoState === "published" ? q.photo : "",
      campus: q.campus,
      here: q.here,
      shared: st.shared,
      gave: st.gave,
      given: st.given,
      card: st.card,
    });
  }
  res.json({ matches: rows, card: board.cards.some((c) => c.by === me) });
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
 * Why closed rather than open, FOR TWO PEOPLE WHO HAVE NOT MATCHED:
 *   - Two messages is exactly enough to trade contact details, which is the
 *     whole job. A third is a conversation with somebody who has not agreed to
 *     have one.
 *   - Nobody can be worn down. The person who did not answer is not written to
 *     again, and "no answer" needs no button and costs nothing to say.
 *   - There is no inbox to fill. The worst case for a person on the list is a
 *     handful of unanswered introductions, not a stream.
 *
 * AND WHY IT OPENS ONCE THEY MATCH.
 *
 * A match is not a like. It is four separate decisions: she followed him, he
 * followed her, and their rooms line up in both directions. Two people who
 * have each done that have asked for a conversation, and the two-message cap
 * then stops being a protection and becomes an obstacle — it pushes them onto
 * WeChat before either of them has decided the other is worth a WeChat id.
 *
 * So a matched pair gets an open thread. Everything that makes it safe is a
 * consequence of how it was opened rather than a lock added afterwards:
 *
 *   - It cannot be started by one person. No amount of writing gets a stranger
 *     into somebody's thread; only that person following back does.
 *   - Either side leaves with one press, permanently, for both, and is never
 *     asked why. The person left sees a closed thread and is not told who
 *     closed it — see cleanShut.
 *   - Every message is still reportable, and a report is still the only way
 *     anybody else ever reads one. That is the whole reason these are held on
 *     a server that can read them: a room nobody can read is a room nobody can
 *     be removed from.
 *   - Nothing is broadcast. No typing, no online, no read receipt to the
 *     sender. Being in here does not tell anybody you are here.
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

/** Whether two people have matched: each follows the other, and their rooms
 *  line up. The same four decisions pairState reports to a profile — read from
 *  the board rather than passed in, so nothing can claim a match by asserting
 *  one. */
function matched(board, me, them) {
  const mine = board.people.find((q) => q.by === me);
  const theirs = board.people.find((q) => q.by === them);
  if (!mine || !theirs) return false;
  return board.follows.some((f) => f.by === me && f.who === theirs.id)
    && board.follows.some((f) => f.by === them && f.who === mine.id)
    && store.scopeFits(mine, theirs)
    && store.sharedRooms(mine, theirs).length > 0;
}

/** Where a thread between two people has got to. The whole rule, in one place,
 *  so the route and the page cannot disagree about it.
 *
 *  Order matters: leaving beats everything, including a match. Somebody who
 *  walked out does not get walked back in by a follow. */
function threadState(board, me, them) {
  if (board.shuts.some((x) => (x.by === me && x.who === them)
    || (x.by === them && x.who === me))) {
    return { can: false, why: "shut", open: false };
  }
  const notes = board.notes;
  const between = notes.filter(
    (n) => (n.by === me && n.to === them) || (n.by === them && n.to === me));

  /* MATCHED: an open thread. Still not a free channel — the same daily count
     applies, so a matched pair is a conversation and not a firehose, and the
     other person can leave at any point in it. */
  if (matched(board, me, them)) {
    const last = between[between.length - 1];
    return {
      can: true, open: true, why: "open",
      // An answer rather than a new introduction when they spoke last: it is
      // what keeps the daily count off a running conversation.
      answering: last && last.to === me ? last.id : "",
    };
  }

  if (!between.length) return { can: true, why: "", open: false };
  if (between.length >= 2) return { can: false, why: "closed", open: false };
  // Exactly one. Only the person who received it may answer, and only now.
  const one = between[0];
  return one.to === me
    ? { can: true, why: "answering", answering: one.id, open: false }
    : { can: false, why: "waiting", open: false };
}

/* Writing to somebody. */
app.post("/api/note", notesOff, express.json({ limit: "16kb" }), async (req, res) => {
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

    const state = threadState(board, me, target.by);
    if (!state.can) return { error: state.why };
    /* THE DAILY COUNT IS ABOUT INTRODUCTIONS, NOT CONVERSATIONS.
       It exists to stop somebody writing to every woman on the list in one
       evening. Neither half of that applies inside an open thread: the other
       person chose to be in it and can leave with one press, and counting a
       conversation against it would mean the fifth message of the day to
       somebody you matched with is refused. */
    if (!state.answering && !state.open
      && store.sentToday(board.notes, me, new Date(),
        (to) => threadState(board, me, to).open) >= NOTES_A_DAY) {
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
app.get("/api/notes", notesOff, async (req, res) => {
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

  /* THE STATE OF EACH THREAD, WORKED OUT ONCE PER PERSON rather than once per
     message: it is a fact about the two of you, and asking it again for every
     line of a conversation is both wasteful and a way for two lines of the
     same thread to disagree. */
  const rows = store.notesFor(board.notes, me);
  const other = (n) => (n.by === me ? n.to : n.by);
  const state = new Map();
  for (const n of rows) {
    if (!state.has(other(n))) state.set(other(n), threadState(board, me, other(n)));
  }
  /* WHICH MESSAGE IS THE LATEST IN ITS THREAD. Only that one carries the box
     to write in — a reply box under every line of a conversation is five boxes
     that all do the same thing. */
  const newest = new Map();
  for (const n of rows) {
    const k = other(n);
    if (!newest.has(k) || String(n.at) > String(newest.get(k))) newest.set(k, String(n.at));
  }

  const notes = rows.map((n) => {
    const mine = n.by === me;
    const them = name(mine ? n.to : n.by);
    const st = state.get(other(n)) || { can: false, open: false };
    return {
      id: n.id, at: n.at, text: n.text, re: n.re, mine,
      ...them,
      // Only ever shown to the person who received it: "they have read it" is
      // a fact about the reader, and the sender is not owed it.
      seen: mine ? undefined : n.seen,
      reported: Boolean(n.report),
      // Whether this can still be answered, so the page does not offer a box
      // that the server will refuse. In an open thread either side may write
      // next, so it no longer depends on whose message this is.
      canAnswer: st.open ? true : (!mine && st.can),
      // An open thread is a conversation rather than an introduction, and the
      // page says so and offers the way out of it.
      open: Boolean(st.open),
      last: String(n.at) === newest.get(other(n)),
    };
  });

  res.json({ notes, unread: notes.filter((n) => !n.mine && !n.seen).length });
});

/* LEAVING A CONVERSATION.
 *
 * One press, permanent, both sides, no reason asked and none recorded. The
 * other person is never told who did it — they see a thread that has closed,
 * which is exactly what they would see if you had simply stopped answering.
 * "She left this chat" is a sentence that starts arguments and protects
 * nobody; the same reason blocking is never sent to this server at all.
 *
 * What was already said stays said. Leaving ends a conversation, it does not
 * erase it — both people keep what they have read, and a report about any of
 * it still works afterwards.
 */
app.post("/api/note/shut", notesOff, express.json({ limit: "2kb" }), async (req, res) => {
  const me = store.hashDevice(String(req.body?.device || ""), SALT);
  const who = String(req.body?.who || "");
  if (!me) return res.status(400).json({ error: "no" });
  if (!/^[a-f0-9]{20}$/.test(who)) return res.status(400).json({ error: "gone" });
  const out = await change((board) => {
    const target = board.people.find((x) => x.id === who);
    // The same answer for somebody who never existed and somebody who has
    // taken themselves down: this must not become a way to ask which is which.
    if (!target || target.by === me) return { error: "gone" };
    if (board.shuts.some((x) => x.by === me && x.who === target.by)) return { ok: true };
    board.shuts.push(store.cleanShut({ by: me, who: target.by }));
    return { ok: true };
  });
  if (out?.error) return res.status(400).json(out);
  res.json(out);
});

/* ---------------------------------------------------------------------------
 * GROUPS
 *
 * A one-to-one thread opens when two people match. A group is that widened,
 * and the widening is the whole risk in it: a message reaching one person who
 * chose you is an introduction; the same message reaching nine who did not is
 * a broadcast into somebody's phone.
 *
 * SO THE ONLY PEOPLE YOU MAY PUT IN A GROUP ARE PEOPLE YOU HAVE MATCHED WITH.
 * Each of them followed you back and shares a room with you. Nobody is added
 * by a stranger, nobody by a friend of a friend, and there is no way to end up
 * in a group with somebody you never agreed to hear from. Checked here from
 * follows and rooms rather than from the list the page sends — a page can send
 * anything.
 *
 * Everybody in a group sees every message in it and everybody who is in it.
 * Nobody can be removed by anybody else. The only exit is your own, and taking
 * it takes you off the list rather than deleting what you said — the same rule
 * as leaving a thread, and for the same reason: a report about it has to keep
 * working afterwards.
 */

/** Everyone this person may put in a group: the matched, and nobody else. */
function groupable(board, me) {
  const mine = board.people.find((q) => q.by === me);
  if (!mine) return [];
  return board.people
    .filter((q) => q.state === "published" && q.handle && q.by !== me
      && matched(board, me, q.by))
    .map((q) => ({ who: q.id, handle: q.handle,
      photo: q.photoState === "published" ? q.photo : "" }));
}

/** The groups this person is in, with who is in them and what was said. */
app.get("/api/groups", notesOff, async (req, res) => {
  const me = store.hashDevice(String(req.get("x-board-device") || ""), SALT);
  res.set("Cache-Control", "no-store");
  if (!me) return res.json({ groups: [], canAdd: [] });
  const board = await store.load(FILE);
  const name = (hash) => {
    const q = board.people.find((x) => x.by === hash);
    return q ? { who: q.id, handle: q.handle,
      photo: q.photoState === "published" ? q.photo : "" } : null;
  };
  const groups = board.groups
    .filter((g) => g.members.includes(me))
    .map((g) => ({
      id: g.id, name: g.name, at: g.at, mine: g.by === me,
      // Names and faces, never the device hashes the group is stored under.
      who: g.members.map(name).filter(Boolean),
      says: board.says.filter((m) => m.group === g.id)
        .sort((a, b) => String(a.at).localeCompare(String(b.at)))
        .map((m) => ({ id: m.id, at: m.at, text: m.text,
          mine: m.by === me, reported: Boolean(m.report),
          ...(name(m.by) || { who: "", handle: "", photo: "" }) })),
    }));
  res.json({ groups, canAdd: groupable(board, me), max: store.GROUP_MAX });
});

/** Making one. */
app.post("/api/group", notesOff, express.json({ limit: "8kb" }), async (req, res) => {
  const me = store.hashDevice(String(req.body?.device || ""), SALT);
  if (!me) return res.status(400).json({ error: "no" });
  const want = (Array.isArray(req.body?.who) ? req.body.who : [])
    .map((x) => String(x || "")).filter((x) => /^[a-f0-9]{20}$/.test(x));
  const label = String(req.body?.name || "").slice(0, 60);

  const out = await change((board) => {
    const mine = board.people.find((q) => q.by === me);
    if (!mine || !mine.handle) return { error: "profile" };
    /* THE GATE, APPLIED HERE AND NOT ON THE PAGE. Every id the page sent is
       checked back against the matches — an unmatched id is dropped rather
       than refused, so a stale page cannot fail the whole group over somebody
       who unfollowed while it was open. */
    const allowed = new Set(groupable(board, me).map((c) => c.who));
    const members = [me];
    for (const id of want) {
      if (!allowed.has(id)) continue;
      const q = board.people.find((x) => x.id === id);
      if (q && !members.includes(q.by)) members.push(q.by);
    }
    if (members.length < 3) return { error: "few" };
    if (members.length > store.GROUP_MAX) return { error: "many" };
    const g = store.cleanGroup({ id: store.newId(), by: me, members, name: label });
    if (!g) return { error: "no" };
    board.groups.push(g);
    return { ok: true, id: g.id };
  });
  if (out?.error) return res.status(400).json(out);
  res.json(out);
});

/** Saying something in one. */
app.post("/api/group/say", notesOff, express.json({ limit: "16kb" }), async (req, res) => {
  const me = store.hashDevice(String(req.body?.device || ""), SALT);
  const id = String(req.body?.group || "");
  const text = String(req.body?.text || "").trim().slice(0, 600);
  if (!me) return res.status(400).json({ error: "no" });
  if (!text) return res.status(400).json({ error: "empty" });

  const out = await change((board) => {
    const g = board.groups.find((x) => x.id === id);
    // The same answer for a group that never existed and one you are not in:
    // this must not become a way to ask which groups are real.
    if (!g || !g.members.includes(me)) return { error: "gone" };
    board.says.push(store.cleanSay({ id: store.newId(), group: id, by: me, text }));
    return { ok: true };
  });
  if (out?.error) return res.status(400).json(out);
  res.json(out);
});

/** Leaving one. Yours to take and nobody else's to take for you. */
app.post("/api/group/leave", notesOff, express.json({ limit: "2kb" }), async (req, res) => {
  const me = store.hashDevice(String(req.body?.device || ""), SALT);
  const id = String(req.body?.group || "");
  if (!me) return res.status(400).json({ error: "no" });
  const out = await change((board) => {
    const g = board.groups.find((x) => x.id === id);
    if (!g || !g.members.includes(me)) return { error: "gone" };
    g.members = g.members.filter((m) => m !== me);
    /* NOBODY LEFT IS NOT AN EMPTY ROOM, it is no room. The messages go with it
       — there is nobody who could read or report them, and a file full of
       conversations nobody is in is a file of other people's words kept for
       no reason. */
    if (g.members.length < 2) {
      board.groups = board.groups.filter((x) => x.id !== id);
      board.says = board.says.filter((m) => m.group !== id);
    }
    return { ok: true };
  });
  if (out?.error) return res.status(400).json(out);
  res.json(out);
});

/** Reporting something said in one. The only way anybody outside it reads a
 *  message, which is the same rule as everywhere else here. */
app.post("/api/group/report", notesOff, express.json({ limit: "16kb" }), async (req, res) => {
  const me = store.hashDevice(String(req.body?.device || ""), SALT);
  const id = String(req.body?.id || "");
  const why = String(req.body?.why || "").slice(0, 400);
  if (!me) return res.status(400).json({ error: "no" });
  const out = await change((board) => {
    const m = board.says.find((x) => x.id === id);
    if (!m) return { error: "gone" };
    const g = board.groups.find((x) => x.id === m.group);
    // Only somebody in the room, and never your own words.
    if (!g || !g.members.includes(me) || m.by === me) return { error: "gone" };
    m.report = why || "Reported";
    return { ok: true };
  });
  if (out?.error) return res.status(400).json(out);
  res.json(out);
});

/* Read. Set by the person who received it and by nobody else. */
app.post("/api/note/seen", notesOff, express.json({ limit: "8kb" }), async (req, res) => {
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
app.post("/api/note/report", notesOff, express.json({ limit: "16kb" }), async (req, res) => {
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

/* Saying you want a thing that does not exist yet.
 *
 * The two Sage offers — the type sort and the card — are not built. Rather
 * than build both and find out afterwards which one anybody wanted, the offer
 * ships first and this counts the answer.
 *
 * Deliberately not a fake door: the page says plainly that it is not built and
 * that pressing puts you on the list to be told. A tap that pretends to lead
 * somewhere and does not is a thing you can only do to a person once, and this
 * board has about forty people who have ever done anything on it.
 *
 * One row per person per thing, enforced in the store — the question is how
 * many people want it, and one enthusiast pressing four times answers a
 * different question badly.
 */
app.post("/api/want", express.json({ limit: "4kb" }), gate, async (req, res) => {
  const me = store.hashDevice(String(req.body?.device || ""), SALT);
  const want = String(req.body?.want || "");
  if (!me) return res.status(400).json({ error: "no" });

  const row = store.cleanWant({ by: me, want, at: new Date().toISOString() });
  if (!row) return res.status(400).json({ error: "no such thing" });

  const counts = await change((board) => {
    board.wants.push(row);
    // Re-cleaned so the dedup rule lives in one place rather than here as well.
    board.wants = store.cleanBoard({ wants: board.wants }).wants;
    return store.wantCounts(board.wants);
  });
  res.json({ ok: true, want: row.want, counts });
});

/** What this browser has already asked for, so the page does not offer a thing
 *  twice and can say "you are on the list" instead. */
app.get("/api/want", async (req, res) => {
  const board = await store.load(FILE);
  const me = store.hashDevice(String(req.get("x-board-device") || ""), SALT);
  res.set("Cache-Control", "no-store");
  res.json({
    mine: me ? board.wants.filter((w) => w.by === me).map((w) => w.want) : [],
    counts: store.wantCounts(board.wants),
  });
});

/* WHO FOLLOWS YOU, so you can follow them back.
 *
 * This is the one place the follow graph is handed to anybody, and it is
 * handed only to the person it is about: your followers, to you. Nobody can
 * ask who follows somebody else, and a count is still all a profile shows.
 *
 * That is a narrower rule than it sounds. Following somebody here is not a
 * private act — it is a thing you do TO them, and a person is entitled to know
 * who has done it. What stays closed is the other direction: nobody learns who
 * you follow, and nobody learns anything about a stranger's list at all.
 *
 * Seen-ness lives in the browser, not here. The board would have to keep a
 * per-person "last looked" to do it on this side, which is a timestamp about a
 * reader that nothing else needs — and the count that matters is "new since I
 * last looked", which is a fact about the phone.
 */
app.get("/api/followers", async (req, res) => {
  const board = await store.load(FILE);
  const me = store.hashDevice(String(req.get("x-board-device") || ""), SALT);
  res.set("Cache-Control", "no-store");
  if (!me) return res.json({ followers: [] });

  const mine = board.people.find((q) => q.by === me);
  if (!mine) return res.json({ followers: [] });

  const iFollow = new Set(board.follows.filter((f) => f.by === me).map((f) => f.who));
  const followers = board.follows
    .filter((f) => f.who === mine.id)
    .sort((a, b) => (b.at || "").localeCompare(a.at || ""))
    .map((f) => {
      // The follower's own row, by their device hash. Somebody who followed and
      // then took their profile down is a follow with nobody behind it.
      const who = board.people.find((q) => q.by === f.by && q.state === "published" && q.handle);
      if (!who) return null;
      return {
        id: who.id,
        handle: who.handle,
        campus: who.campus || "",
        photo: who.photoState === "published" ? who.photo : "",
        type: who.type || "",
        at: f.at,
        // So the button can say which of the two things it does.
        following: iFollow.has(who.id),
      };
    })
    .filter(Boolean);

  res.json({ followers });
});

/* Follow, and unfollow, which is the same button. */
app.post("/api/follow", express.json({ limit: "8kb" }), gate, async (req, res) => {
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
      thread: (me && q.by !== me) ? threadState(board, me, q.by) : { can: false, why: "" },
      // Everything about the two of you, from one place. See pairState.
      pair: pairState(board, me, q),
      // The member who vouched for them. See broughtBy.
      brought: broughtBy(board, q),
      // What they have done with people here. A title, never a number — see
      // rankOf. Public, because it describes acts rather than popularity.
      rank: rankOf(board, q.by),
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
  /* HOW MANY ARE AT THE DOOR. The same number the public page shows, under
     the same floor, and for the same reason it is a number and not a list:
     below WAITING_FLOOR it stops describing a queue and starts describing
     individuals. A member sees it because being inside something people are
     waiting to get into is most of what being inside it is worth — and
     because a member who can see the queue growing is a member who invites. */
  const waiting = board.waits.filter((w) => !w.done).length;
  res.json({
    person: shownPerson(mine, true),
    posts: posts.filter(store.isOwnPost).length,
    replies: posts.filter((p) => p.re).length,
    /* HOW MANY ARE IN, counted the same way the public page counts them —
       everybody with a page, not everybody in the deck. The line that carries
       it sits under Browse, and Browse is missing anybody who switched
       themselves out of it; a number that says "in" has to mean in. */
    people: board.people.filter((q) => q.state === "published" && q.handle).length,
    waiting: waiting >= WAITING_FLOOR ? waiting : null,
    rank: rankOf(board, me),
  });
});

app.put("/api/me", express.json({ limit: "36mb" }), gate, async (req, res) => {
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
    /* "li" takes 200 rather than 120: a LinkedIn share URL is long, and a save
       that truncated the link before cleanPerson could read the slug out of it
       would silently drop the field. */
    for (const k of ["handle", "level", "campus", "goal", "trade", "here", "age", "type", "levelBand", "ig", "li"]) {
      if (req.body[k] !== undefined) {
        q[k] = String(req.body[k]).slice(0, k === "goal" ? 600 : k === "li" ? 200 : 120);
      }
    }
    if (Array.isArray(req.body.free)) q.free = req.body.free;
    if (Array.isArray(req.body.speaks)) q.speaks = req.body.speaks;
    // What they are looking for, and which half of the world they want it in.
    // Validated in cleanPerson, not here: an unknown room key is dropped
    // rather than refused, so an old page saving against a new server loses
    // the box it did not know about instead of losing the save.
    /* A LEVEL THAT MOVED, WRITTEN DOWN ONCE. Read before the loop below sets
       it: afterwards there is no way to tell a new number from the same one
       saved again, and a log with a row per save is not a log of anything. */
    const wasBand = q.levelBand;
    if (Array.isArray(req.body.rooms)) q.rooms = req.body.rooms;
    if (req.body.where !== undefined) q.where = String(req.body.where);
    if (req.body.wants !== undefined) q.wants = String(req.body.wants);
    // A new picture goes back into the queue. Changing your face is the same
    // act as adding one, and a profile that could be edited past review would
    // make the review pointless.
    // Straight up. See REVIEW_PHOTOS above for why this one does not wait.
    const asRead = REVIEW_PHOTOS && !openStill(board) ? "held" : "published";
    if (face?.id) { q.photo = face.id; q.photoState = asRead; }
    if (back?.id) { q.cover = back.id; q.photoState = asRead; }

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
    if (q.levelBand && q.levelBand !== wasBand) {
      q.bands = [...(q.bands || []), { band: q.levelBand, at: new Date().toISOString() }];
    }
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
        state: openStill(board) ? "published" : "held",
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

  // Told either way, and told which: a photograph that went straight up is
  // still worth knowing about, and calling it held when it is not would put a
  // job on the panel that nobody can do.
  if (face?.id || back?.id) {
    tell(out.photoState === "published" ? "published" : "held",
      { ...out, note: "New profile photo" });
  }
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

app.post("/api/post", express.json({ limit: "36mb" }), gate, async (req, res) => {
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
    // Filled in below, once the board has been read: whether this waits for a
    // person depends on how many people are on it.
    state: "held",
    handle, note, topic, photo, re, like,
    go: String(req.body?.go || ""),
    why: "Waiting for somebody to read it.",
    by: store.hashDevice(req.body?.device, SALT),
  });

  await change((board) => {
    // A like is never held: it is a tally, not a statement, and holding one
    // would put a queue in front of the cheapest thing anybody does here.
    const up = like || AUTO || openStill(board);
    post.state = up ? "published" : "held";
    post.why = up ? "" : "Waiting for somebody to read it.";
    board.posts.unshift(post);
  });
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
    // How many separate people have asked for each unbuilt thing. On the
    // public counter because it is a fact about the board, and because the
    // panel reads this endpoint already.
    wants: store.wantCounts(board.wants),
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
    /* EVERYBODY, not only the ones with something waiting.
     *
     * There was no route that could answer "why can I not see her in Browse".
     * The public list only holds people who are IN Browse, which is the one
     * group the question is never about — so the answer had to be guessed from
     * the outside, and the guesses were wrong twice before this existed.
     * Stripped to what the question needs and nothing that reads as a
     * directory: no goal, no campus, no photograph. */
    people: board.people.map((q) => ({
      handle: q.handle, at: q.at, state: q.state,
      looking: q.looking, photoState: q.photoState,
      hasPhoto: Boolean(q.photo), rooms: q.rooms,
      // The level they chose to make public, and when it moved. See `bands`.
      levelBand: q.levelBand, bands: q.bands,
    })),
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
    /* The same post in the other language, when the operator has written it.
     *
     * A reader's post carries one language because that is what they typed;
     * something written BY this board for everybody on it has to carry both,
     * or half the people it is for cannot read it. The card already knows how
     * to show a `zh` under a `note` — it was built for translations — and this
     * is the route that was missing the field. */
    const post = store.cleanPost({
      id: store.newId(), at, state: "published",
      handle: account, note, photo, by,
      zh: String(parsed.fields.zh || "").slice(0, 2000),
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

/* THE SCRIPTS REVALIDATE TOO, NOT JUST THE PAGES.
 *
 * The pages were already no-cache because WeChat on iOS caches hard against
 * the URL. The modules beside them were not — and half this app is in them:
 * the strings, the cards, the mark, the card of the day. So a phone could hold
 * a week-old i18n.js against a page that had just been redeployed, and show
 * old wording on new markup. That is exactly what it looks like when a deploy
 * "did not work", and it costs an evening to tell apart from one that did not.
 *
 * They are a few kilobytes each and no-cache still revalidates rather than
 * refetching, so the cost is one conditional request per file per load.
 * Photographs are not served from here — they go through their own route,
 * addressed by a hash of their content, and are safe to keep for ever.
 */
app.use(express.static("public", {
  setHeaders: (res, f) => {
    if (f.endsWith(".html") || f.endsWith(".js")) res.set("Cache-Control", "no-cache");
  },
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
