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
import { mkdir, readFile, writeFile, rename, stat, rm } from "node:fs/promises";
import { timingSafeEqual, randomUUID, createHmac } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import path from "node:path";
import * as store from "./lib/store.js";
import { translate, configured as translateReady } from "./lib/translate.js";
import { ask as askHostess, configured as hostessReady } from "./lib/hostess.js";
import { send as sendMail, configured as mailReady } from "./lib/mail.js";
import * as intake from "./lib/intake.js";
import * as push from "./lib/push.js";
/* THE SWITCH FILE, READ BY THE SERVER TOO.
 *
 * public/off.js is a client module and this is the one thing on the server
 * that has to agree with it. Its own comment warned about exactly this case —
 * "standing() counts posts made this week as part of earning an invite code.
 * Take the posts away and the invite economy loses a leg" — and then the feed
 * was hidden and nobody checked what the box had BRING_SAID set to. It was 2.
 * Every member has been unable to earn an invite code since, with no error and
 * nothing on any screen to say why, on the one mechanism the whole thing grows
 * by.
 *
 * Importing it rather than adding a second env var, because a second switch is
 * the thing off.js exists to prevent: one file says what is off, and now it
 * says it to both halves. */
import { OFF } from "./public/off.js";

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
/* ---- THE DEMO BOARD -------------------------------------------------------
 *
 * EVERY BROWSER THAT ARRIVES HERE IS THE SAME PERSON. Set BOARD_DEMO_DEVICE
 * and this deployment stops being a board with members and becomes one room
 * with one seat in it that anybody may sit in.
 *
 * WHY IT HAS TO EXIST. App Review will not approve an app a reviewer cannot
 * get into, and the door here is the product: six characters, named, spent on
 * arrival, dead in a day. A reviewer needs credentials that work every time,
 * months apart, on every update — which is a permanent hole in the exact
 * mechanism the board is built on. So they are not let into this board at all.
 * They are sent to a second one, with nobody real in it, and handed a seat
 * that already has matches, cards and two conversations in it. An empty
 * account is not a demonstration of a messenger.
 *
 * WHY IT IS A PINNED DEVICE AND NOT A LOGIN. The identity here is a random
 * number the browser made up and keeps in localStorage. Pinning that number is
 * therefore the whole of "be this person" — no new concept, no new table, no
 * session, and nothing downstream that has to learn about demo mode. Every
 * route below still answers about whoever the device says they are; it is only
 * that on this one deployment the device always says the same thing.
 *
 * WHY IT IS SAFE ON THE REAL BOARD. It is a string of HTML, empty unless the
 * variable is set, and the variable is set on one container whose entire
 * purpose is this. Set it on the real board and every arrival would become one
 * member — which is why it is named for what it does and lives here rather
 * than being inferred from a hostname or a NODE_ENV.
 *
 * The script runs before the app's own modules: it is written into the page
 * rather than fetched, and localStorage is synchronous, so the device is
 * already pinned by the time anything reads it.
 */
/* THE OTHER HALF, AND IT LIVES ON THE REAL BOARD. These two are set on the
 * board with the real members on it; the two above are set on the demo one.
 * A code typed at the real door that matches this is not admitted to anything
 * — it is answered with the demo board's address, and that browser goes there.
 *
 * WHY THE CODE IS ON THE REAL DOOR AT ALL, rather than the app shipping the
 * demo address for review and the real one after. That is Guideline 2.3.1,
 * behaviour altered after review, and every update is re-reviewed, so it is
 * caught the first time a fix ships. This way the app points at the real board
 * from the first build to the last and never changes: the reviewer simply has
 * a key that opens a different room, the same as it did before approval and
 * the same as it will next year.
 *
 * IT NEVER SPENDS AND NEVER EXPIRES, which is exactly what makes it unsafe as
 * an invite and exactly what App Review needs. It is safe here because it
 * admits nobody to this board: it cannot be redeemed, it writes nothing, it
 * touches no row, and the worst a leaked copy does is send a stranger to a
 * room full of people who do not exist.
 *
 * Unset, none of this is reachable and the door behaves as it always has. */
const DEMO_CODE = store.cleanCode(process.env.BOARD_DEMO_CODE || "");
/* An origin and nothing else — no path, no query. It is handed straight to
   location.assign() on the door page, so anything that is not a bare host is a
   redirect somebody could have chosen. http and a port are allowed so the pair
   can be run on a laptop; in front of a reviewer it is https, because the app
   navigates to it and App Transport Security will not follow plain http. */
const DEMO_URL = (() => {
  const want = String(process.env.BOARD_DEMO_URL || "").replace(/\/+$/, "");
  return /^https?:\/\/[a-z0-9.-]+(?::\d{2,5})?$/i.test(want) ? want : "";
})();

const DEMO_DEVICE = String(process.env.BOARD_DEMO_DEVICE || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
const DEMO_TAG = DEMO_DEVICE
  ? '<script>try{localStorage.setItem("board:device",'
    + JSON.stringify(DEMO_DEVICE) + ')}catch(e){}</script>'
  : "";

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
    /* {{HERE}} is this exact URL, path and query kept.
     *
     * og:url on the landing page was {{ORIGIN}}/ — the bare homepage — on a
     * page that is also served at /r/:room?w=<id>, where the query string is
     * the entire referral. A chat client that canonicalises a shared card to
     * og:url therefore forwarded the homepage, and whoever sent it got no
     * credit for anybody who joined through it. The preview has to name the
     * link it is previewing. */
    const here = origin + String(req.originalUrl || req.url || "/")
      .replace(/[^A-Za-z0-9/?=&._~:@+-]/g, "").slice(0, 512);
    res.send(PAGES.get(file)
      .split("{{HERE}}").join(here)
      .split("{{ORIGIN}}").join(origin)
      .split("{{DEMO}}").join(DEMO_TAG));
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
 *   /privacy WHAT IS KEPT, and it has to be out here.
 *           The join form asks a stranger for a name and a way to reach them,
 *           makes four promises about what happens to both, and the footer
 *           link to the page those promises are written out on landed them on
 *           this door. A promise whose small print is behind a password is
 *           not a promise; it is a claim. The page names no member, holds no
 *           figures and describes only what this server does with what it is
 *           given, so there was never anything on it to protect.
 *   /level  THE FOUR QUESTIONS, and this one is the whole growth mechanic:
 *           a member shares their result into a group chat, somebody who is
 *           not a member taps it, takes the test themselves, and lands on the
 *           waiting list under their own number. A teaser that asks nothing
 *           and gives something is worth more than a page describing a board.
 *
 * The test needs no route of its own — it is four questions and a canvas — so
 * nothing but the page is opened, and a stranger who finishes it is offered
 * the list instead of the buttons that post to a feed they cannot read. */
/* WHAT IS OUTSIDE THE DOOR.
 *
 * NOT api/public-media, and it was nearly added here — a member forwarded
 * their own profile into a chat and the card came back a grey box, which
 * looked like the face failing to load. It is not. /p/:handle is behind the
 * door too, so a crawler with no cookie never reaches the person page at all;
 * it gets the door, and the card it builds is the door's own — share.png and
 * "Invite only". Opening the media route would not have changed that picture
 * by a pixel, and would have made every published photograph fetchable by
 * anybody holding its id.
 *
 * Which leaves the og:profile tags in person.html unread by any crawler, and
 * that is the right way round: a page carrying a member's name, face and bio
 * should not be legible to a link-preview robot on a board whose whole claim
 * is that it is not a directory. If a shared profile ever should look like
 * the person, that is a decision to make on purpose here, not a side effect
 * of a route somebody opened to fix an image.
 */
/* AN OFFER IS OUTSIDE THE DOOR, and it has to be.
 *
 * `o` and `api/offer` are here for the same reason "/" is: the whole purpose
 * of an offer is that it opens for somebody who has never heard of this place.
 * Requiring a code to read one would mean asking a person to join a room
 * before they may see the work being offered to them, which is the wrong way
 * round and is the thing this was built to fix.
 *
 * It opens the door to reading and taking, and to nothing else. Writing one is
 * still members-only — POST /api/offer carries `gate`, which runs after this
 * and is unaffected by it. And `o(?:\/|$)` rather than a bare `o`, because
 * OPEN_PATHS is a prefix match and one loose letter would open every path on
 * this board beginning with it.
 */
const OPEN_PATHS = /^\/(enter|i\/|w\/|r\/|o(?:\/|$)|join|agents|a-browse(?:-zh)?\.png|a-say(?:-zh)?\.png|d-[a-z0-9]+\.html|g\/|share-exchange\.png|about|rules|privacy|level|type|room|api\/enter|api\/signin|api\/admitted|api\/hello|api\/offer|api\/wait|api\/write\/|api\/ask|api\/tally|api\/counts|doors|waiting|favicon|apple-touch-icon|manifest|share\.png|robots\.txt)/;

/* ---- BEING SOMEBODY YOU SPEAK FOR ----------------------------------------
 *
 * THE PROBLEM. An agent runs nine performers. Every one of them needs a real
 * row — a page, a sentence, matches, a conversation — and there is one browser
 * between the lot of them. This server was written on the flat assumption that
 * one browser is one person: `q.by === me` appears in it seventy-six times.
 * Rewriting all seventy-six is a night's work and a month of finding the two
 * that were missed, on the board people are actually using.
 *
 * WHAT IS DONE INSTEAD. Nothing downstream changes at all. A represented
 * person keeps an ordinary identity of their own, and the agent's browser is
 * allowed to BE that identity for the length of one request: the page sends
 * `x-board-as: <person id>` beside its usual device header, this middleware
 * checks that the row really is one the agent runs, and from then on every
 * `hashDevice(...)` in the file answers with the represented person's hash.
 * Posting, following, matching, messages, photographs — all of it is already
 * written, and it is already right.
 *
 * WHY A HEADER AND NOT A COOKIE. A cookie is a mode you are in until something
 * takes you out of it, which is the exact shape of the accident this feature
 * risks — writing as the wrong person. A header is sent per request by a page
 * that is currently showing an orange bar with a name in it. Close the tab and
 * you are yourself again.
 *
 * WHAT IT CANNOT DO. It resolves from `x-board-device` only, never from a body
 * field, because this runs before any body parser; a page that wants to act
 * has to send the header, which is one line in the fetch helper. It refuses
 * chains — a row that is run may not run anybody — and it refuses silently,
 * by leaving you as yourself, because the alternative is a 403 on every route
 * the moment a stale id is left in localStorage.
 *
 * ADMISSION IS NOT AFFECTED, deliberately. `admitted`, `admittedReq` and the
 * door go on asking about the real browser: the agent was let in, the people
 * they speak for were not, and an unpublished row must not be a way through a
 * door. Those two call sites still say `store.hashDevice`, and that is the
 * whole reason they do.
 */
const acting = new AsyncLocalStorage();

/** The device hash this request should be treated as — theirs, or somebody's
 *  they are allowed to speak for. Every route in this file uses this; only the
 *  door uses store.hashDevice directly. */
function hashDevice(said, salt) {
  const real = store.hashDevice(String(said ?? ""), salt);
  const act = acting.getStore();
  return (act && real && act.real === real && act.by) ? act.by : real;
}

app.use(async (req, res, next) => {
  const as = String(req.get("x-board-as") || "");
  if (!/^[a-f0-9]{20}$/.test(as)) return next();
  const real = hashDevice(String(req.get("x-board-device") || ""), SALT);
  if (!real) return next();
  let by = "";
  try {
    const board = await store.load(FILE);
    const q = board.people.find((x) => x.id === as);
    // Their own row is not "acting", and a row somebody else runs is not
    // theirs to be. Both fall through as themselves rather than erroring.
    if (q && q.by && q.by !== real && q.runBy === real) by = q.by;
  } catch { /* unreadable board is the next handler's problem, not this one's */ }
  if (!by) return next();
  acting.run({ real, by, as }, next);
});

app.use(async (req, res, next) => {
  if (INVITE !== "read") return next();
  // The operator's own routes carry the admin secret and are checked by their
  // own middleware. Without this, the door shut on the hand that opens it:
  // minting an invite was refused before the admin check ever ran.
  if (KEY && safeEqual(String(req.get("x-admin-secret") || req.query.secret || ""), KEY)) return next();
  /* THE FRONT PAGE IS OUTSIDE THE DOOR, and leaving it off this list was the
     one mistake that undid the rest of it. "/" serves the same page as
     /about — the thing that exists to persuade somebody who has never heard
     of this — and the moment the door went on, the only address anybody
     actually types stopped showing it and showed a password box instead. A
     stranger arriving at liuxuesheng.io met a lock and nothing to read.

     Exactly "/", not a prefix: OPEN_PATHS is a prefix match and /^\// would
     open the entire board.

     Unless the feed has been moved to the root, in which case "/" is the board
     itself and belongs behind the door like the rest of it. */
  if (req.path === "/" && !ROOT_IS_BOARD) return next();
  if (OPEN_PATHS.test(req.path)) return next();
  /* SOMEBODY A MEMBER WROTE TO, ON THEIR WAY TO THAT CONVERSATION.
   *
   * They are not admitted — they are on the list, which is the whole point —
   * so the door would send them to a password box for a code nobody gave
   * them. But the note they answered put them in a messenger with the person
   * who wrote it, and that conversation is the only thing they can see: every
   * route below works out who is asking and answers about them alone, and
   * threadState refuses any pair but this one.
   *
   * Just these paths. Browse, Cards and the rest stay behind the door. */
  if (/^\/(notes\/?$|api\/notes$|api\/note$|api\/note\/)/.test(req.path)
      && await wroteTo(req)) return next();
  // Anything with a dot in the last segment is a file: the stylesheet and the
  // modules the door is built from have to load for the door to work at all.
  if (/\.[a-z0-9]{2,5}$/i.test(req.path)) return next();
  if (await admittedReq(req)) return next();
  if (req.path.startsWith("/api/")) {
    return res.status(403).json({ error: "invite", where: "/enter" });
  }

  /* A MEMBER'S PAGE, SHARED WITH SOMEBODY WHO IS NOT IN.
   *
   * Sharing your own profile is what a person actually does — it is the link
   * they have, it has their name on it, and every other product on earth has
   * trained them that it works. Here it landed a stranger on a password box
   * asking for a code they were never given, which is a dead end for every
   * one of them and for the member who sent it.
   *
   * So it becomes the thing they meant to send: the door for that member's
   * room, carrying their id, which is the same link the Share button makes.
   * The page then greets the visitor with the member's name on it and offers
   * the waiting list. Nobody gets in — a queue is not admission — and the
   * member gets the credit for whoever joins.
   *
   * The profile itself stays behind the door. This looks up who they were
   * sharing and sends the visitor onwards; it never renders a page.
   */
  const shared = /^\/p\/([A-Za-z0-9_-]{1,40})\/?$/.exec(req.path);
  if (shared) {
    const board = await store.load(FILE);
    const want = shared[1].toLowerCase();
    const q = board.people.find((x) =>
      x.state === "published" && String(x.handle || "").toLowerCase() === want);
    if (q && q.id) {
      /* Their own room, chosen the way the Share button chooses it, so a
         visitor lands among the people the member is actually among. */
      const rooms = Array.isArray(q.rooms) ? q.rooms : [];
      const door = rooms.includes("talent") || rooms.includes("agent") ? "/r/film"
        : rooms.includes("invest") ? "/r/invest"
        : rooms.includes("raise") ? "/r/raise"
        : rooms.includes("buy") || rooms.includes("sell") ? "/r/trade"
        : "/about";
      return res.redirect(302, door + "?via=" + encodeURIComponent(q.id));
    }
    /* No such member. The waiting list rather than the door: somebody who
       followed a link to a person who is not here still came from somewhere,
       and the queue is the only thing there is to offer them. */
    return res.redirect(302, "/about");
  }

  res.status(200);
  return page("enter.html", req, res, next);
});

app.get("/", (req, res, next) => page(ROOT_IS_BOARD ? "index.html" : "landing.html", req, res, next));
/* THE NUMBERS, ON A PHONE.
 *
 * make doors is the same figures and needs a terminal, which means they get
 * looked at on the days somebody is at a desk — and the question they answer
 * ("did that post work") is asked ten minutes after posting, from a phone, in
 * a taxi.
 *
 * IN FRONT OF THE DOOR, not behind it, and the key alone is what opens it.
 * This sat behind the invitation first, on the reasoning that two locks beat
 * one. They do not: a member without the key sees nothing anyway, so the
 * invitation added no protection at all — while locking the one person who
 * needs this out of every browser they had not spent a code in. Whoever runs
 * the board opens it on a laptop, on a second phone, in somebody else's
 * Chrome, and the answer cannot be "spend an invitation on yourself first".
 *
 * So: the page is a key box and nothing else until a key is typed, and every
 * figure on it comes from /api/counts, which checks the key on every request.
 * A stranger who finds this address learns that it exists and no more.
 */
app.get(["/doors", "/doors/"], (req, res, next) => page("doors.html", req, res, next));
/* The queue, on a phone, for the one person the form says reads it. In front
   of the invitation door for the same reason /doors is: the key is the
   credential, and whoever runs this opens it on whatever is in their hand. */
app.get(["/waiting", "/waiting/"], (req, res, next) => page("waiting.html", req, res, next));
/* THE ROOM FOR SOMEBODY ON THE LIST.
 *
 * In front of the door, because everybody it is for is outside it. The page
 * itself knows nothing: it asks /api/wait/me, which answers about the device
 * asking and nobody else, and draws whichever of the three answers comes back
 * — a member (go inside), somebody on the list (their room), or a browser
 * that is neither (the way to join).
 *
 * /waiting next door is the admin queue and is a different thing entirely.
 * The names are close enough to be worth saying so here.
 */
app.get(["/room", "/room/"], (req, res, next) => page("room.html", req, res, next));
app.get(["/feed", "/feed/", "/index.html"], (req, res, next) => page("index.html", req, res, next));
/* /board was the address before this was called the Feed. Kept as a permanent
 * redirect rather than deleted: links already sent into a WeChat chat cannot be
 * edited, and a dead link is the one failure a shared board cannot recover
 * from. It costs one line and never needs revisiting. */
/* THE FRONT OF THIS PLACE IS THE PEOPLE, NOT THE POSTS. /board is an old
   address somebody may still have; it used to land on the feed, which is the
   quiet half. */
app.get(["/board", "/board/"], (req, res) => res.redirect(301, "/browse" + (req.url.split("?")[1] ? "?" + req.url.split("?")[1] : "")));
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
/* "open" is spelled out so that meaning to have no door and forgetting to
   configure one are different strings. `make check` refuses a deploy where
   this is empty; it accepts "open", which is somebody saying so. */
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
/** Whether this browser is somebody a member wrote a note to and who
 *  answered it. Read off the same wait cookie the waiting room uses, or the
 *  device header — a browser that cleared itself still holds the cookie, and
 *  the conversation is the one thing they came back for. */
async function wroteTo(req) {
  const said = String(req.get("x-board-device") || req.body?.device || "");
  const me = store.hashDevice(said, SALT) || waitCookie(req);
  if (!me) return false;
  try {
    const board = await store.load(FILE);
    return board.waits.some((w) => w.by === me && !w.done && w.fromWrite
      && board.writes.some((x) => x.id === w.fromWrite));
  } catch { return false; }
}

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

/* The switcher, the roster and the folder drop. Behind the door like the rest
   of the board — it is nothing but somebody's own roster — and not in
   OPEN_PATHS. */
app.get(["/run", "/run/"], (req, res, next) => page("run.html", req, res, next));

/* The laptop half of the same thing: a heap of files, sorted, shown, and
   corrected before anything is written. Same door, same roster. */
app.get(["/onboard", "/onboard/"], (req, res, next) => page("onboard.html", req, res, next));

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

/* THE SAME THING FOR SOMEBODY WHO IS ONLY ON THE LIST.
 *
 * A waiting person's whole identity was a random id in localStorage. Same
 * browser, same phone, and /room finds their card; clear the browser, open
 * the link in Safari having joined in WeChat, or pick up a different phone,
 * and they are a stranger — and joining again makes a SECOND row with an
 * empty card, which is worse than nothing for them and worse than nothing
 * for whoever reads the queue.
 *
 * Safari deletes localStorage after seven days without a visit. So the list
 * as it stands loses most of its cards next week, quietly, and the first
 * anybody would know is a queue full of duplicate names.
 *
 * Members were given a signed cookie for exactly this and it is how a profile
 * survives that purge. This is the same cookie under a different name, doing
 * the same job one door further out. Nothing in it is a secret — it holds the
 * salted hash, which is not one — and the signature is what stops somebody
 * pasting another person's hash in and being handed their card.
 *
 * A DIFFERENT NAME, so the two cannot be confused: a browser holding
 * board_wait has not been admitted to anything, and no route that guards the
 * door reads it.
 */
const waitCookie = (req) => {
  const raw = String(req.headers.cookie || "");
  const m = /(?:^|;\s*)board_wait=([a-f0-9]{32})\.([a-f0-9]{32})/.exec(raw);
  return m && sign(m[1]) === m[2] ? m[1] : "";
};
const setWaitCookie = (res, hash) => {
  res.append("Set-Cookie", "board_wait=" + hash + "." + sign(hash)
    + "; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure");
};

/** Which waiting row belongs to the browser asking, by either key.
 *
 *  THE BROWSER'S NEW ID WINS AND THE ROW MOVES TO IT. A cleared browser makes
 *  a fresh localStorage id and still sends the old cookie, so the row is
 *  found by the cookie and then rebound to the new id — after which both keys
 *  agree again and nothing has to be worked out twice. That is the same move
 *  /api/me makes for a member who forgot themselves, and it is what keeps one
 *  person to one row.
 *
 *  Rebinding is a write and this is called from reads. That is deliberate:
 *  the alternative is a row that is found through the cookie for ever while
 *  every write keyed on the browser's id silently misses it.
 *
 *  Pass `res` to have the cookie set or refreshed; omit it for a route that
 *  only wants to know.
 */
async function waitingRow(req, res) {
  const said = String(req.get("x-board-device") || req.body?.device || "");
  const me = store.hashDevice(said, SALT);
  const was = waitCookie(req);
  let board = await store.load(FILE);
  const live = (by) => (by ? board.waits.find((w) => w.by === by && !w.done) : null);

  let row = live(me);
  if (!row && was && was !== me) {
    const old = live(was);
    if (old && me) {
      await change((b) => {
        const r = b.waits.find((w) => w.by === was && !w.done);
        if (r) r.by = me;
        return { ok: true };
      });
      board = await store.load(FILE);
      row = live(me);
    } else if (old) {
      /* No localStorage at all — a private window. The cookie is the only key
         they have and it still names their row, so it is used as it is and
         nothing is rebound to an id that does not exist. */
      row = old;
    }
  }
  if (res && row) setWaitCookie(res, row.by);
  return { board, row, who: row ? row.by : me };
}

/** Is this request from a browser that has spent a code? Cookie or header. */
async function admittedReq(req) {
  const fromCookie = inCookie(req);
  const fromHeader = store.hashDevice(String(req.get("x-board-device") || ""), SALT);
  if (!fromCookie && !fromHeader) return false;
  const board = await store.load(FILE);
  if (board.invites.some((v) => !v.off && v.usedBy
    && (v.usedBy === fromCookie || v.usedBy === fromHeader))) return true;
  /* A PAGE ON THIS BOARD IS ALSO PROOF, and it is the better proof of the two.
   *
   * Admission was read off one row: the invite somebody spent. That works for
   * anybody who came through the door and it is wrong for everybody else, and
   * "everybody else" turned out to include three real cases —
   *
   *   the members who were here before the door was (admit-existing let them
   *   through without any of them spending a code),
   *   anybody whose invite was later taken back, which was only ever meant to
   *   stop the code working and instead silently locked out the person who had
   *   already used it,
   *   and a member handed a way back in on a new phone, if their row happened
   *   to be one of the first two.
   *
   * All three end the same way: rebound correctly onto the browser in front of
   * them, holding a valid signed cookie, and turned away at the door anyway —
   * with nothing on screen to say why, because as far as this function knew
   * they had never been let in.
   *
   * A published person row cannot be made from outside this gate. Having one
   * IS being a member; the invite is how most people got one, not what makes
   * it true. Deleting yourself takes the row with it, so the door shuts on the
   * same press it always did. */
  return board.people.some((q) => q.state === "published"
    && (q.by === fromCookie || q.by === fromHeader));
}

/* EVERY SIX-CHARACTER CODE ALREADY IN USE, whatever it opens.
 *
 * There are three kinds and they share one alphabet: an invite, an offer, and
 * the code that takes somebody back to their own place in the queue. They were
 * minted against three separate lists, so a new invite could be handed out
 * with the same six characters as a live offer — and then /i/K7M2QP and
 * /o/K7M2QP are two different things one letter apart, one code spends the
 * other's meaning, and whichever of the two the person was sent is the one
 * that appears to be broken.
 *
 * One set, checked by all of them. Cheap: this runs inside a change() that is
 * already holding the whole board in memory. */
const codesTaken = (board) => new Set([
  ...board.invites.map((v) => v.code),
  ...board.offers.map((o) => o.code),
  ...board.waits.map((w) => w.back),
  // A member's own way back. In here for the same reason as the other three:
  // one box at the door reads all of them, so two of them colliding would
  // send somebody to the wrong place with the right code.
  ...board.people.map((q) => q.back),
  // And the code an agent reads down the phone to somebody who is already
  // here — see /api/run/rep. Same door, same six characters, same set.
  ...board.people.map((q) => q.rep),
  // And a note written to somebody who is not here yet — see /api/write.
  ...board.writes.map((w) => w.code),
].filter(Boolean));

/* ---------------------------------------------------------------------------
 * The door
 * ------------------------------------------------------------------------- */

/* /i/K7M2QP is the shape that goes in a message: the code is in the address,
 * so tapping the link is the whole of it. The page reads the code out of the
 * path, which is why this serves the same file as /enter. */
/* The offer page. /o/CODE is what gets pasted into WeChat; /o?c=CODE is what
 * comes back when a client mangles it. Both land here, and the page reads
 * the code out of whichever one it got. */
/* THE LINK FOR A GROUP.
 *
 * Every other way in has something ahead of the form — the public page opens
 * with what the board is, the door asks for a code, and inside WeChat the door
 * puts a wall about browsers in front of both. Each is right for the reader it
 * was written for. None of them is right for a link pasted into a group of
 * forty strangers, which is how people actually spread this, and where the
 * only question is whether to put your name down.
 *
 * /join is that link and does nothing else. ?w=<id> still travels, so whoever
 * shared it keeps the credit for anybody who joins on it. */
app.get(["/join", "/join/"], (req, res, next) => page("join.html", req, res, next));

/* ONE PAGE FOR ONE GROUP. See the note at the top of agents.html: a link
   pasted into a WeChat group of film agents, written for somebody who was in
   that group for something else. Public, like the other doors. */
app.get(["/agents", "/agents/"], (req, res, next) => page("agents.html", req, res, next));

app.get(["/o", "/o/", "/o/:code"], (req, res, next) => page("offer.html", req, res, next));
/* A NOTE SOMEBODY WAS WRITTEN, AND IT IS THE MESSENGER.
 *
 * This served a page of its own: an explanation of the board with a form
 * under it. That is a page ABOUT an app, and what somebody should get when a
 * friend sends them a message is the app, with the message in it — their
 * friend at the top, the line as the first bubble, a box at the bottom, and
 * the same four tabs everybody else has.
 *
 * Outside the door, like /enter and /i/<code>: the whole point is that it
 * opens for a person the board has never heard of. It gives nothing away —
 * notes.html asks /api/write/:code, which answers with the line they were
 * sent and the name of whoever sent it and nothing else, and it does not ask
 * for an inbox until they have answered and have one. */
app.get(["/w/:code"], (req, res, next) => page("notes.html", req, res, next));

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
  const me = hashDevice(String(req.body?.device || ""), SALT);
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

  /* THE REVIEWER, SENT NEXT DOOR — checked before anything that reads the
     board file, because this answer involves no row and no member.
     safeEqual rather than ===: the codes are short, the door is public, and a
     timing answer about the first character is a free character. */
  if (DEMO_CODE && DEMO_URL && safeEqual(code, DEMO_CODE)) {
    tries.delete(me);
    return res.json({ ok: true, elsewhere: DEMO_URL });
  }

  /* A WAITING PERSON'S WAY BACK, checked before the invites.
   *
   * The same box, because asking somebody who has lost their place to find a
   * different page is asking them to give up. The three kinds of code cannot
   * collide — every one of them is minted against codesTaken, which holds all
   * three — and this one never opens the door: it rebinds their row to the
   * browser in front of it, gives them the waiting cookie, and the page sends
   * them to their card.
   *
   * SPENT ON USE. It names one person's own row and nothing else, but a code
   * that keeps working is a code that ends up in a group chat. */
  const backTo = await change((board) => {
    const row = board.waits.find((w) => w.back && w.back === code && !w.done);
    if (!row) return null;
    row.by = me;
    row.back = "";
    return { id: row.id, room: row.room };
  });
  if (backTo) {
    setWaitCookie(res, me);
    tries.delete(me);
    return res.json({ ok: true, waiting: true, room: backTo.room });
  }

  /* A MEMBER'S WAY BACK, on the same box and for the same reason.
   *
   * The block above puts somebody back on the waiting list. This one puts a
   * member back on their own page — every row they have moves onto the browser
   * in front of it, which is what rebind is for and what the cookie already
   * does automatically on a browser that merely forgot. It does not open the
   * door to anybody new: there is no new person at the end of it, only an
   * existing one somewhere else.
   *
   * REFUSED IF THIS BROWSER IS ALREADY SOMEBODY. Two people's rows on one
   * device hash is not a state this board has, and the shared-phone case is
   * exactly how it would happen. The person typing gets told, rather than
   * quietly swallowing whoever was here first.
   *
   * Spent on use, like the waiting one. */
  let backWhy = "";
  const backMe = await change((board) => {
    const q = board.people.find((p) => p.back && p.back === code);
    if (!q) return null;
    if (q.by === me) { q.back = ""; return { handle: q.handle || "" }; }
    if (board.people.some((p) => p.by === me)) { backWhy = "taken"; return null; }
    const was = q.by;
    q.back = "";
    store.rebind(board, was, me);
    return { handle: q.handle || "" };
  });
  if (backWhy === "taken") return res.status(409).json({ error: "taken" });
  if (backMe) {
    setCookie(res, me);
    tries.delete(me);
    return res.json({ ok: true, back: true, handle: backMe.handle });
  }

  /* AN OFFER'S CODE, TYPED AT THE DOOR.
   *
   * Two links go out from here and they are one letter apart — /i/K7M2QP is a
   * way in, /o/K7M2QP is a piece of work — so somebody who was sent the second
   * and lands on the first types the only code they have. That is not a wrong
   * answer: it is the right code at the wrong door, and counting it against
   * five-an-hour would eventually lock out a person who has done nothing but
   * follow the link they were sent.
   *
   * Read-only, before the tries are spent. The offer itself is not opened
   * here — the page is sent to it, and accepting is still its own deliberate
   * press on its own screen. */
  const board = await store.load(FILE);
  if (board.offers.some((o) => o.code === code && !o.off && !o.tookAt)) {
    return res.status(409).json({ error: "offer", code });
  }

  let outcome = "";
  const got = await change((board) => {
    const v = board.invites.find((x) => x.code === code);
    if (!v || v.off) { outcome = "bad"; return null; }
    /* RUN OUT IS NOT WRONG, and the door says which. Somebody holding a code
       that expired typed the right thing; being told it was wrong sends them
       looking for a typo that is not there, when what they need is to ask for
       another one. */
    if (store.inviteOver(v)) { outcome = "over"; return null; }
    if (v.usedBy) { outcome = v.usedBy === me ? "mine" : "used"; return null; }
    v.usedBy = me;
    v.usedAt = new Date().toISOString();
    outcome = "in";
    return v;
  });

  if (outcome === "in" || outcome === "mine") {
    tries.delete(me);
    setCookie(res, me);
    /* AN AGENT ARRIVES WITH NINE PEOPLE AND A FOLDER FOR EACH.
     *
     * Everybody else who comes through this door turns up as themselves, and
     * Browse is the right first screen. An agent's first job is not to look at
     * anybody — it is to get the people they represent onto the board, which
     * is forty minutes of typing or one drag, and the difference between those
     * two is whether they bother at all.
     *
     * So the row is made here rather than on their first save: /onboard needs
     * a page to hang a roster off, and asking somebody to fill in a profile
     * before they can use the thing they were invited for is the form that
     * loses them. It is held and nameless — no handle, so nothing is in Browse
     * and nothing was put on a page that they did not type.
     *
     * The sentence IS written, because it is the one thing the invite already
     * knows and because their people inherit the right half of it. */
    if (got && got.kind === "agent") {
      await change((board) => {
        if (board.people.some((q) => q.by === me)) return false;
        board.people.push(store.cleanPerson({
          id: store.newId(),
          at: new Date().toISOString(),
          state: "held",
          by: me,
          say: [{ me: "agent", want: "producer" }],
        }));
        return true;
      });
      return res.json({ ok: true, by: got.who || "", agent: true, where: "/onboard" });
    }
    // The label is for whoever handed the code out, not for the person
    // spending it — what crosses the door is that somebody vouched.
    return res.json({ ok: true, by: got ? got.who : "" });
  }
  t.n += 1; t.at = now; tries.set(me, t);
  const left = Math.max(0, 5 - t.n);
  if (outcome === "used") return res.status(409).json({ error: "used", left });
  if (outcome === "over") return res.status(410).json({ error: "over", left });
  return res.status(404).json({ error: "bad", left });
});

/** Whether this browser is in, and whether being in is required at all. */
app.get("/api/admitted", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
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
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
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
  /* HOW MANY ARE LIVE, not just whether one is.
   *
   * An ordinary member holds one at a time and gets another the moment it is
   * spent. Somebody on an allowance (see BOARD_CODES) can hold several, and
   * needs to: three codes handed out one at a time is three codes only if the
   * first person joins promptly, and the whole point of an allowance is
   * somebody messaging three people in one sitting.
   *
   * They are asked for one at a time all the same — see the POST below. A
   * member who needs one gets one; nobody is handed their whole day's worth
   * on the off chance. */
  const mine2 = (b) => b.invites.filter((v) => v.by === me && dayKey(v.at) === today);
  const liveCodes = mine2(board).filter((v) => !v.usedBy && !v.off).map((v) => v.code);
  const left = rank.perDay ? Math.max(0, rank.perDay - mine2(board).length) : 0;
  if (liveCodes.length) {
    return res.json({ code: liveCodes[0], codes: liveCodes, left, day: today });
  }

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
    const have = codesTaken(b);
    let code = store.newCode();
    while (have.has(code)) code = store.newCode();
    const v = store.cleanInvite({ code, who, at: new Date().toISOString(), by: me });
    b.invites.push(v);
    return v;
  });
  res.json({ code: made.code, codes: [made.code],
             left: rank.perDay ? Math.max(0, rank.perDay - 1) : 0, day: today });
});

/* ONE MORE, FOR SOMEBODY WITH AN ALLOWANCE.
 *
 * Ordinary members have nothing to ask for: their one code is replaced the
 * moment it is spent, and a second live code would be a second person let in
 * on the same day, which is the thing the ceiling is. Everybody named in
 * BOARD_CODES may hold more, up to their number, and asks for each one — so
 * the day's allowance is spent on people they actually have in mind rather
 * than issued in a batch to be forwarded around.
 *
 * standing() is the authority, as everywhere else: it already refuses once
 * today's codes reach the allowance, and refuses for every other reason too.
 * This route adds no rule of its own. */
app.post("/api/my-invite", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
  if (!me) return res.status(400).json({ error: "no device" });
  if (INVITE && !(await admittedReq(req))) {
    return res.status(403).json({ error: "invite", where: "/enter" });
  }
  const board = await store.load(FILE);
  const rank = standing(board, me);
  if (!rank.can || !rank.perDay) {
    return res.status(409).json({ error: "no", need: rank.need, guests: rank.guests });
  }
  const mine = board.people.find((q) => q.by === me);
  const who = (mine && mine.handle) || "";
  const today = dayKey(Date.now());

  const made = await change((b) => {
    const todays = b.invites.filter((v) => v.by === me && dayKey(v.at) === today);
    // Checked inside the queue, the same way the daily code is: two taps on a
    // slow connection would otherwise spend two of the allowance for one ask.
    if (todays.length >= rank.perDay) return null;
    const have = codesTaken(b);
    let code = store.newCode();
    while (have.has(code)) code = store.newCode();
    const v = store.cleanInvite({ code, who, at: new Date().toISOString(), by: me });
    b.invites.push(v);
    return v;
  });
  if (!made) return res.status(409).json({ error: "spent" });

  const after = await store.load(FILE);
  const todays = after.invites.filter((v) => v.by === me && dayKey(v.at) === today);
  res.json({
    code: made.code,
    codes: todays.filter((v) => !v.usedBy && !v.off).map((v) => v.code),
    left: Math.max(0, rank.perDay - todays.length),
    day: today,
  });
});

/* Minting, from the box. The label is a note to self — how you know who did
 * not turn up, and how one code is taken back without touching the others. */
app.post("/api/invite", admin, express.json({ limit: "8kb" }), async (req, res) => {
  const who = String(req.body?.who || "").slice(0, 40);
  const n = Math.max(1, Math.min(50, Number(req.body?.n) || 1));
  /* HOW LONG IT LASTS, IN HOURS, AND NOTHING IS THE DEFAULT.
   *
   * A code with no expiry is the old behaviour and the right one for the code
   * a member carries around. Hours are for the other case: one code, one named
   * person, sent tonight — where "this is good for 24 hours" is a thing people
   * actually say and should therefore be a thing the row actually does.
   *
   * Capped at a year. Not a rule about anything, just the difference between a
   * long-lived code and a typo with four extra zeros on it. */
  const hours = Math.max(0, Math.min(8760, Number(req.body?.hours) || 0));
  const until = hours ? new Date(Date.now() + hours * 3600_000).toISOString() : "";
  const made = [];
  await change((board) => {
    const have = codesTaken(board);
    for (let i = 0; i < n; i++) {
      let code = store.newCode();
      while (have.has(code)) code = store.newCode();
      have.add(code);
      const v = store.cleanInvite({
        code, who, until, at: new Date().toISOString(),
        // See `kind` on cleanInvite: what the door does on the way in, not a
        // permission of any sort.
        kind: req.body?.kind === "agent" ? "agent" : "",
      });
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
    const have = codesTaken(b);
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
  /* WHO WALKED IN ON IT.
   *
   * The row has carried `usedBy` since it was written — the browser that
   * spent the code, and the same hash a profile is keyed by — so this was
   * always answerable and was never answered. The list said "used" against
   * four codes and nothing about which of them was the person being asked
   * about, and the only way to tell was to line the dates up by hand.
   *
   * A HANDLE AND NEVER THE HASH, for the reason that was already here: this
   * is read by somebody deciding who to chase. Empty when they spent the code
   * and have not made a profile yet, which is its own answer and a useful one.
   */
  const nameOf = (hash) => (hash && board.people.find((q) => q.by === hash) || {}).handle || "";
  res.json({
    invites: board.invites.map((v) => ({
      code: v.code, who: v.who, at: v.at, off: v.off,
      // Never the hash: it identifies a browser, and this list is read by a
      // person deciding who to chase, not by anything that needs an id.
      used: Boolean(v.usedBy), usedAt: v.usedAt,
      usedName: nameOf(v.usedBy),
      // When it runs out, and whether it already has. Both, because "expired"
      // and "expires tomorrow" are the two things worth reading off this list.
      until: v.until, over: store.inviteOver(v),
      /* Who made it, when a member made it out of their own header rather
         than the box making it: `who` is blank on those rows, so the list
         read as if nobody had given it out. */
      fromName: nameOf(v.by),
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
/* The card shelf. Same page as everything else — the view is chosen in the
 * browser — but a real address, so it can be reloaded, bookmarked and put in
 * the service worker's shell like the other two. */
app.get(["/cards", "/cards/"], (req, res, next) => page("index.html", req, res, next));

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

/* A WAITING PERSON'S PHOTOGRAPH, AND ONLY THEIRS.
 *
 * /api/public-media is behind the door on purpose — see the long note above
 * OPEN_PATHS — so that a member's face is not fetchable by anybody holding
 * its id. Everybody this route is for is outside that door, including for
 * their own picture, so they need a way to see one.
 *
 * IT SERVES WAIT ROWS AND NOTHING ELSE. The id is looked up in board.waits
 * before a byte is read, so a member's photograph cannot be fetched here
 * whatever id is presented, and the rule this board already made stands
 * exactly as it was.
 *
 * A HELD ONE IS SERVED TOO, and this is the part worth being honest about.
 * An <img> cannot carry the device header, so there is no way to check that
 * the browser asking is the one that uploaded it. What protects a held
 * photograph is that its id is a twenty-character random string which the
 * server sends to nobody but its owner: /api/wait/me returns other people's
 * ids only once they are released, and the queue in the panel is behind the
 * admin key. Somebody who has the id can fetch the picture. Nobody is given
 * the id.
 */
app.get("/api/wait-media", async (req, res) => {
  const id = String(req.query.id || "");
  const board = await store.load(FILE);
  if (!board.waits.some((w) => w.photo && w.photo === id)) {
    return res.status(404).json({ error: "no such file" });
  }
  const found = await findMedia(id);
  if (!found) return res.status(404).json({ error: "no such file" });
  res.set("Content-Type", found.type);
  res.set("X-Content-Type-Options", "nosniff");
  /* Not immutable, and not for long. A released photograph can be refused an
     hour later, and a day of caching would leave it on screens after it was
     taken down. */
  res.set("Cache-Control", "private, max-age=300");
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
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
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

  /* HOW MANY OF THESE A MEMBER ACTUALLY WROTE.
   *
   * The feed is full and none of it is the room talking: seeded posts, the
   * board announcing that somebody joined, the operator putting a card up.
   * All real rows, none of them a member with something to say — and a feed
   * that looks busy while the room is silent is the one thing a member reads
   * as "nobody is here".
   *
   * A post counts when its author is somebody with a live page. Counted here
   * rather than in the browser because it needs the roll, and the browser has
   * no business holding a table of device hashes.
   */
  const roll = new Set(board.people.filter((q) => q.state === "published" && q.handle)
    .map((q) => q.by).filter(Boolean));
  const fromMembers = live.filter((p) => store.isOwnPost(p) && p.by && roll.has(p.by)
    /* AND NOT THE BOARD ANNOUNCING THEM. "X put a page up" is posted with the
       member's own device hash, because it is about them — so by every other
       measure it is their post. It is not: nobody wrote it, nobody chose to
       say it, and a feed of nothing but join notices is exactly the busy
       silence this count exists to detect. `looking` is what marks one. */
    && !p.looking).length;

  res.json({
    following: [...mineFollows],
    fromMembers,
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
  const me = hashDevice(String(req.body?.device || ""), SALT);
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
    by: hashDevice(String(req.body?.device || ""), SALT) || req.ip || "anon",
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

/* WHO SPEAKS FOR THEM, SAID OUT LOUD.
 *
 * On the card and on the page, before anybody presses Follow — not a thing
 * discovered after a match, when somebody has already decided they are talking
 * to a performer and finds they are talking to an agency. The arrangement is
 * fine; being surprised by it is not.
 *
 * A name rather than the id, because the id is a fact about the database and
 * the name is the fact the reader needs. */
const speaksFor = (board, q) => {
  if (!q.agent) return "";
  const a = board.people.find((x) => x.id === q.agent && x.state === "published");
  return a ? a.handle : "";
};

/* And the other direction: everybody one agent speaks for, for their own page.
 * Browse shows a few of them (see RUN_SHOW); this shows all of them, because
 * somebody who has got as far as opening an agent's page has chosen to look.
 * One match with the agent is how a producer meets the whole roster, which is
 * also the best reason an agent has to want a good page. */
const rosterOf = (board, q) => board.people
  .filter((x) => x.agent === q.id && x.state === "published" && x.handle)
  .map((x) => ({
    id: x.id, handle: x.handle, campus: x.campus,
    photo: x.photoState === "published" ? x.photo : "",
  }));

const shownPerson = (q, mine) => ({
  ...q,
  /* NOBODY ELSE'S BUSINESS. How many people opened somebody's page is a fact
     about them and their readers, and a directory that published it would let
     anybody rank the students on it. Kept for the owner, dropped for everyone
     else, and dropped HERE so that a route added later cannot publish it by
     forgetting to. */
  views: mine ? q.views : undefined,
  regs: mine ? q.regs : undefined,
  /* THE ADDRESS, AND IT GOES TO NOBODY. It is on the row so somebody who never
     saved their key can get back in, and it is on nobody's screen but their
     own. Dropped here for the reason given above: a route added later must not
     be able to publish it by forgetting to. */
  mail: mine ? q.mail : undefined,
  // A photograph nobody has looked at yet is shown to its owner and to no one
  // else. Words can be taken back; a face somebody has already saved cannot.
  photo: (q.photoState === "published" || mine) ? q.photo : "",
  cover: (q.photoState === "published" || mine) ? q.cover : "",
  photoPending: mine && q.photoState !== "published" && Boolean(q.photo || q.cover),
  /* THE GALLERY, FILTERED HERE AND NOWHERE ELSE, for the same reason the
     address is: a route written next month must not be able to publish a
     picture nobody has looked at by forgetting to think about it.
     The owner sees all of theirs with the state on each, so a held one reads
     as waiting rather than as an upload that failed. Everybody else sees only
     what has been through the queue. */
  shots: mine
    ? (q.shots || [])
    : (q.shots || []).filter((x) => x.state === "published").map((x) => ({ id: x.id })),
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

/* WHAT THEY SAID THEY WERE, ON THE WAY IN.
 *
 * Somebody filling in a card while they wait already answers the first half
 * of the sentence this board is built on — "I am a producer". Asking it again
 * the moment they get through the door is asking the same question twice, and
 * worse: the answer a member gives themselves inside can quietly stop
 * matching the answer somebody vouched for.
 *
 * So it carries over, and it is FIXED. What they are looking for stays theirs
 * to change — that is the half that moves from week to week — but what they
 * are is the thing the room already agreed to let in.
 *
 * Two ways to find the row, in order. The device number is the same hash on
 * both tables, so a person who joined the list and redeemed their code on the
 * same browser matches directly. Somebody who cleared their browser in
 * between is found through the invitation: the operator writes the waiting
 * person's name onto the code when they admit them, so the code names the
 * row. Nothing here leaves the box — the caller gets a role key, never a row.
 *
 * "" when they never said, which is most of the seven who were here before
 * the list existed. Then the pill is theirs to pick, once.
 */
function roleFromWait(board, q) {
  if (!q || !q.by) return "";
  const own = board.waits.find((w) => w.me && w.by && w.by === q.by);
  if (own) return own.me;
  const invite = board.invites.find((v) => v.usedBy === q.by && v.who);
  if (!invite) return "";
  /* ONLY WHEN THE NAME NAMES ONE PERSON. Two people called Wei on the list
     and this would hand one of them the other's answer, which is worse than
     handing them a dropdown. An ambiguous name carries nothing. */
  const rows = board.waits.filter((w) => w.me && w.done === "in" && w.name === invite.who);
  return rows.length === 1 ? rows[0].me : "";
}

/* The sentence on the way in, with the fixed half put back.
 *
 * The browser is not trusted with it. A page that has been open since before
 * somebody was admitted still has a dropdown in it, and an old page saving
 * against a new server must not be able to rewrite what the room agreed to.
 * So the carried role is stamped onto every line here, and what the request
 * asked for is only read for the half that is theirs.
 *
 * When nothing carried over, it is theirs to pick and this does nothing.
 */
function fixSay(board, q, rows) {
  const fixed = roleFromWait(board, q);
  if (!fixed) return rows;
  return rows.map((r) => ({ ...r, me: fixed }));
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
 * THE LEDGER
 *
 * WHAT THIS IS, AND WHAT IT IS NOT. A count of what somebody put into this
 * board, kept per member, and a share of the board expressed as a percentage
 * of everybody's counts added together. It is NOT tradeable, it cannot be sent
 * to anybody, and it is not money. The moment a thing like this can be passed
 * from one person to another it is a security, which is a different product
 * with lawyers in it — and, for the half of this board sitting in China, an
 * illegal one. So it moves in one direction only: it is earned and it is held.
 *
 * WHETHER IT EVER CONVERTS TO ANYTHING is a promise made on paper by whoever
 * runs the board, not a property of this file. Nothing here should be written
 * as though a payout exists — see the strings, which say points and share and
 * never money — until there is a signed document saying what a point is worth.
 *
 * WHY IT MOVES ON ITS OWN. A share is a slice of a total that grows every time
 * anybody does anything, so sitting still costs you: the number falls as other
 * people work and rises when you do. That is the whole mechanic, and it is the
 * honest version of "early members have a stake" — early counts for a lot, and
 * it stops counting for everything.
 *
 * EVERY WEIGHT BELOW IS SOMETHING THE BOARD ALREADY KNOWS. Nothing here asks
 * a member to do anything they were not already being asked to do, and nothing
 * counts an act nobody else benefited from: a post nobody answered is worth
 * nothing here, and so is a guest who never spoke.
 * ------------------------------------------------------------------------- */

/* HOW MANY SEATS THERE ARE, AND HOW LONG THEY MOVE FOR.
 *
 * A hundred, and a date. Both are the point: a share of a thing that anybody
 * can still join is not a share of anything, and a number that keeps moving
 * for ever is never allocated. Seats fill in the order people arrived; the
 * hundred-and-first member is a member like any other and is not in the
 * ledger, and the app says so rather than showing them a nought.
 *
 * The date is when the counting stops and the split is whatever it is on that
 * morning. Until then every point anybody earns moves everybody else's share,
 * which is what makes it worth watching — and what makes sitting on an early
 * seat worth less than working from a late one.
 *
 * Both are read from the environment because both are promises, and a promise
 * that lives in a source file gets changed by whoever is editing that file.
 * Unset, the ledger is off entirely: no seats, no share, nothing shown. */
const SEATS = Math.max(0, Number(process.env.BOARD_STAKE_SEATS || 0));
const UNTIL = /^\d{4}-\d{2}-\d{2}$/.test(process.env.BOARD_STAKE_UNTIL || "")
  ? process.env.BOARD_STAKE_UNTIL : "";
const ledgerOn = () => SEATS > 0 && Boolean(UNTIL);

/* WHETHER ANY OF THAT IS SHOWN OUTSIDE THE DOOR.
 *
 * Off unless BOARD_SEAT_OUTSIDE=1, and off is the default on purpose. What a
 * waiting person would be shown carries no figure in money and no percentage
 * — a seat number out of the hundred, and the three things that move a seat —
 * but it still changes what the front of this product is about. Today
 * somebody joins to find a producer. With this on, some of them join because
 * a seat is running out, and those are different people arriving at a board
 * whose only asset is that members vouch for each other.
 *
 * So it is a switch rather than a decision written into the code: turn it on,
 * watch who joins for a week, turn it off if they are the wrong people. The
 * environment is also where the two promises live (see SEATS and UNTIL), and
 * this belongs with them.
 */
const SEAT_OUTSIDE = process.env.BOARD_SEAT_OUTSIDE === "1";

/* AND WHETHER THE IDEA IS SAID AT ALL, WHICH IS NOT THE SAME QUESTION.
 *
 * There was one sentence here for the case where the arithmetic is hidden —
 * "the first hundred people in will be offered a share of this board" — and
 * it was shown whenever the block above was OFF, on the reasoning that
 * somebody deciding whether to bother should know there is something here.
 *
 * That made a promise to forty-six strangers the default state of the
 * product, and the default came from the absence of a different switch. It is
 * also not true: nobody has decided that the first hundred are offered
 * anything. The sentence is honest about being unsettled and that does not
 * help — an intention read by somebody outside the door is a promise, and
 * this one was never made.
 *
 * So it has a switch of its own and the switch is off. Saying it has to be
 * somebody deciding to say it. */
const SAY_STAKE = process.env.BOARD_STAKE_SAY === "1";

/* THE TWO TESTS, WHICH NOBODY WAS TAKING.
 *
 * Twenty-two people on the list and not one had a level or a type, so two
 * thirds of "something to do while you wait" was a section asking for work
 * nobody wanted to do, above the one thing this room actually asks for. Off
 * unless BOARD_TESTS=1.
 *
 * NOT THE PICKER. "I am a / looking for" sits in the same section and is not
 * a test — it is two dropdowns answered in place, it fills the chip a member
 * reads when deciding, and people do use it. It stays whatever this says. */
const TESTS_ON = process.env.BOARD_TESTS === "1";

/* Counting stops on the date. After it the numbers are what they were, which
   is the difference between an allocation and a leaderboard. */
const ledgerShut = () => Boolean(UNTIL) && new Date().toISOString().slice(0, 10) > UNTIL;

/* Being early is worth a lot and then less, on a curve rather than a cliff.
   Seat 1 is worth ten of seat 100 and seat 100 is not worth nothing — a
   cohort where the hundredth person can never catch the fifth is a cohort the
   hundredth person does not bother working for. */
const FOUND = (n) => Math.round(200 / Math.sqrt(Math.max(1, n)));

/* WHAT EACH ACT IS WORTH, in one place because two places is how a screen ends
   up promising a number the ledger does not pay. The waiting room reads these
   to show somebody what an act is worth before they are inside to do it; the
   ledger below spends them. Nobody retypes a weight.

   The ordering is the argument. Bringing somebody in who stays is worth more
   than any seat in the hundred — seat 1 is 200 and seat 24 is 41 — because the
   board is the people in it and being early is only a claim on having been
   early. A screen that leads with the seat number leads with the smallest
   number on it. */
const WORTH = { guest: 100, card: 40, heard: 20, week: 10 };

/* THE WHOLE HUNDRED'S FOUNDING POINTS, which is what a share is divided by.
   Against today's members instead, an early seat reads as some enormous
   fraction and then falls fivefold as the hundred fill — a number that only
   ever goes down is a grievance waiting to happen. Against the full hundred
   it starts small and climbs as they earn, which is both truer to what they
   end up holding and the only version nobody feels robbed by. */
const POOL = (() => { let t = 0; for (let n = 1; n <= SEATS; n++) t += FOUND(n); return t; })();

/* MONEY, AND ONLY IF SOMEBODY DECIDED THE TWO NUMBERS.
 *
 * A sale figure and what share of it members hold. Neither has a default and
 * neither is guessed: unset, the block shows points and a percentage and no
 * money appears anywhere on it. An invented figure on this screen is the one
 * thing here that could fairly be called a promise, so it takes a deliberate
 * act to put one there.
 *
 * SALE is an illustration, not a valuation, and the screen says so. */
const SALE = Math.max(0, Number(process.env.BOARD_STAKE_SALE || 0));
const CUT = Math.min(100, Math.max(0, Number(process.env.BOARD_STAKE_CUT || 0)));
const moneyOn = () => SALE > 0 && CUT > 0;
/** What n points come to, at the two configured numbers. Null if they are not set. */
const inMoney = (pts) => moneyOn() ? Math.round((SALE * (CUT / 100)) * pts / POOL) : null;

/** What one member has put in, and what each part of it came from. */
function stakeOf(board, who) {
  const zero = { points: 0, parts: [], seat: 0 };
  if (!who || !ledgerOn()) return zero;
  const mine = board.people.find((q) => q.by === who);
  if (!mine) return zero;

  const live = (p) => p.state === "published" && !p.like && !p.report;

  /* Seat, oldest first. Read off the roll rather than stored, so a page taken
     down and put back does not mint a founder — and so the seats stay in the
     order people actually arrived however the file is edited. */
  const order = board.people
    .filter((q) => q.state === "published" && q.handle)
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const seat = order.findIndex((q) => q.by === who) + 1;
  /* Past the hundredth, nothing. Not a small number — nothing, and the screen
     says the seats are gone rather than showing somebody a nought and letting
     them work out why it never moves. */
  if (!seat || seat > SEATS) return { ...zero, seat };

  const myPosts = board.posts.filter((p) => p.by === who && live(p) && !p.re);
  const myIds = new Set(myPosts.map((p) => p.id));

  /* DISTINCT PEOPLE WHO ANSWERED, not answers. One enthusiastic friend
     replying nine times is one person finding you worth answering. */
  const answerers = new Set();
  for (const p of board.posts) {
    if (p.re && myIds.has(p.re) && live(p) && p.by && p.by !== who) answerers.add(p.by);
  }
  for (const n of board.notes) {
    if (n.to === who && n.by && n.by !== who) answerers.add(n.by);
  }

  /* GUESTS WHO STAYED AND SPOKE. The strongest thing anybody does here: it is
     the entire growth of the board, and it is the one act whose value lands in
     somebody else's column rather than your own. Weighted accordingly. */
  const guests = board.invites
    .filter((v) => v.by === who && v.usedBy)
    .map((v) => board.people.find((x) => x.by === v.usedBy))
    .filter((g) => g && g.state === "published"
      && board.posts.some((p) => p.by === g.by && live(p)));

  /* AN INTRODUCTION THAT LANDED. A card is handed over only when two people
     have chosen each other and one of them acted on it — the nearest thing
     this board has to a transaction, and the thing it exists to produce. */
  const cards = board.cards.filter((c) => c.by === who).length;

  /* WEEKS, not days. A board is a habit and a habit shows up across weeks. */
  const weeks = new Set(board.posts
    .filter((p) => p.by === who && live(p))
    .map((p) => weekKey(new Date(Date.parse(p.at || "") || Date.now())))).size;

  const parts = [
    { key: "found",  n: seat,           points: FOUND(seat) },
    { key: "guests", n: guests.length,  points: guests.length * WORTH.guest },
    { key: "heard",  n: answerers.size, points: answerers.size * WORTH.heard },
    { key: "cards",  n: cards,          points: cards * WORTH.card },
    { key: "weeks",  n: weeks,          points: weeks * WORTH.week },
  ].filter((r) => r.points > 0);

  return { points: parts.reduce((a, r) => a + r.points, 0), parts, seat };
}

/** One member's share of the cohort, as a percentage of everybody's points. */
function shareOf(board, who) {
  if (!ledgerOn()) return null;
  const mine = stakeOf(board, who);
  /* HOW MANY SEATS ARE LEFT, which is the number that makes anybody move.
     Counted off the roll, so it falls the moment somebody publishes a page. */
  const taken = board.people.filter((q) => q.state === "published" && q.handle).length;
  const head = { seats: SEATS, left: Math.max(0, SEATS - taken), until: UNTIL, shut: ledgerShut() };
  if (!mine.points) return { ...head, ...mine, share: 0 };
  let total = 0;
  for (const q of board.people) {
    if (q.state === "published" && q.handle) total += stakeOf(board, q.by).points;
  }
  return {
    ...head, ...mine,
    /* One decimal. Two is a precision this does not have, and a whole number
       makes everybody under one percent read as nothing. */
    share: total ? Math.round((mine.points / total) * 1000) / 10 : 0,
  };
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
/* POSTING TWICE A WEEK WAS THE PRICE OF AN INVITE, and it stopped being the
 * right one. It was written when the board was a feed and what a member did
 * here was write on it; what a member does here now is say what they are
 * looking for and answer the people it matches them with. "Post 2 things this
 * week" sat in the invite panel telling somebody to feed a feed in order to
 * bring in the person they actually came here to bring in.
 *
 * Zero by default, and still a number: BOARD_BRING_SAID in .env puts it back
 * the moment the feed is worth feeding again. BRING_DAYS does the work that
 * matters — a browser that arrived an hour ago cannot hand out codes. */
const BRING_SAID = num("BOARD_BRING_SAID", 0);
const BRING_WEEK = num("BOARD_BRING_WEEK", 7);
const GUEST_ROOM = num("BOARD_GUEST_ROOM", 3);

/** Everything about whether one member may mint a code, worked out in one
 *  place so the route that refuses and the screen that explains cannot come to
 *  different conclusions about the same person.
 *
 *  Returns { can, need } where `need` is every unmet test, in reading order —
 *  all of them, not the first: a door that tells you one thing at a time is a
 *  door you knock on four times. */
/* WHOEVER RUNS THE BOARD IS NOT SUBJECT TO THE DOOR THEY BUILT.
 *
 * Standing is a rule for members, and the operator is not one in the sense
 * the rule means: they are the person handing out codes when somebody asks in
 * a WeChat thread, and a morning when they cannot is a morning the board
 * stops growing for a reason nobody outside can see. It caught them on the
 * first day it shipped.
 *
 * Named handles rather than a device hash, because the operator changes phones
 * and a hash in a config file is a thing nobody can read. Matched without case,
 * since it is typed by hand into .env.
 */
const STAFF = new Set(String(process.env.BOARD_STAFF || "")
  .split(",").map((x) => x.trim().toLowerCase()).filter(Boolean));

/* MEMBERS WHO MAY BRING MORE THAN ONE PERSON A DAY.
 *
 * BOARD_CODES="keith:3,peter:5" — a handle and how many people they may bring
 * in on any one day. Everybody else has the ordinary ceiling, which is a
 * LIFETIME one: three guests on the board and no more codes, ever. That is
 * right for an ordinary member and wrong for the two or three people who are
 * how a board this size actually fills, and turning the ceiling off for them
 * (which is what putting them in BOARD_STAFF would do) is not the answer
 * either — "as many as you like" is how a private room stops being one.
 *
 * So: the same ceiling, counted per day and reset by the calendar. Every other
 * test still applies to them, including the one that says the people you
 * already brought have to have turned up and said something. An allowance is
 * not an exemption from bringing people who stay.
 *
 * Named handles rather than device hashes, for the same reason STAFF is:
 * somebody has to be able to read this file and know who is on it.
 */
const CODES = new Map(String(process.env.BOARD_CODES || "")
  .split(",").map((x) => x.trim()).filter(Boolean)
  .map((row) => {
    const at = row.lastIndexOf(":");
    const name = (at > 0 ? row.slice(0, at) : row).trim().toLowerCase();
    const n = at > 0 ? Number(row.slice(at + 1)) : 0;
    return [name, Math.max(1, Math.min(20, Number.isFinite(n) ? n : 1))];
  })
  .filter(([name]) => name));

/** How many people this member may bring in on one day, and whether their
 *  ceiling is counted per day at all. 0 means the ordinary lifetime one. */
const allowance = (handle) => CODES.get(String(handle || "").toLowerCase()) || 0;

function standing(board, me) {
  const need = [];
  const who = me && board.people.find((x) => x.by === me);
  if (who && who.handle && STAFF.has(who.handle.toLowerCase())) {
    return { can: true, need: [], guests: 0, staff: true };
  }
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
  /* NOT ASKED FOR WHEN THERE IS NOWHERE TO SAY IT. A requirement to post,
     on a board with the feed switched off and no composer in the ＋ menu, is
     a condition no member can ever satisfy — so it is not a bar, it is a
     closed door with no handle. See OFF above. */
  if (!OFF.feed && said < BRING_SAID) need.push("said");

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

  /* THE CEILING, LIFETIME OR DAILY.
   *
   * Ordinarily it is lifetime: three guests on the board and that is the end
   * of it. For the handful named in BOARD_CODES it is the same number counted
   * against today only — so they can keep bringing people, at a rate, rather
   * than emptying their allowance in one afternoon and never having another.
   * Counted on the codes rather than on the people, because a code carries the
   * day it was made and a person carries the day they joined, and the thing
   * being rationed is the invitation. */
  const perDay = allowance(q.handle);
  if (perDay) {
    const today = dayKey(Date.now());
    const brought = codes.filter((v) => dayKey(v.at) === today).length;
    if (brought >= perDay) need.push("room");
  } else if (live.length >= GUEST_ROOM) {
    need.push("room");
  }

  return { can: need.length === 0, need, guests: live.length, perDay };
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
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
  res.set("Cache-Control", "no-store");
  /* PEOPLE THIS READER HAS BLOCKED DO NOT APPEAR. One way: they leave this
     reader's Browse and this reader does not leave theirs. Done here rather
     than in the page because the old version was done in the page, in
     localStorage, and had quietly stopped being applied at all — see
     cleanBlock in store.js. */
  const iBlocked = new Set(board.blocks.filter((x) => x.by === me).map((x) => x.who));
  const live = board.people.filter((q) => (
    q.state === "published" && q.looking && q.handle && !iBlocked.has(q.id)));
  res.json({
    // Whether this reader already follows them, so the deck's one button can
    // say which of the two things it is about to do. A fact about the reader,
    // which is why this response is never cached.
    people: live.map((q) => ({
      ...shownPerson(q, q.by === me),
      mine: q.by === me,
      speaksFor: speaksFor(board, q),
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

/* COUNTING WHO CAME WITHOUT WRITING DOWN WHO CAME.
 *
 * The board could not answer the only question worth asking after somebody
 * posts a link: did anybody come, and did they stop at the form. There was no
 * counter of any kind, and the numbers page next door belongs to a different
 * product entirely.
 *
 * Three integers a day per room — opened the door, began typing, joined the
 * list — and nothing else. No address, no device id, no user agent, no row per
 * visit. There is deliberately nothing here capable of holding a person, which
 * is why it needs no consent banner and no retention policy: the record cannot
 * identify anybody because the record is a number.
 *
 * WHY THE PAGE REPORTS ITSELF rather than the server counting requests. The
 * server sees every crawler, every preview fetch by WeChat, every uptime
 * check; counting those makes a number that goes up when nobody came. This
 * fires from a browser that ran the page's script, which is the nearest thing
 * to a person that can be measured without measuring people.
 *
 * IT CAN BE INFLATED, by anybody who wants to sit and press. That is accepted:
 * the alternative is a fingerprint, and a number this is used to decide
 * whether to post again does not need to survive an adversary. The rate cap
 * below is against an accident — a page in a reload loop — not an attacker.
 */
const TALLY = new Map();
const TALLY_BURST = 240;
setInterval(() => TALLY.clear(), 60_000).unref?.();

app.post("/api/tally", express.json({ limit: "1kb" }), async (req, res) => {
  const what = String(req.body?.what || "");
  if (!["door", "form", "joined"].includes(what)) return res.json({ ok: true });
  const room = store.WAITROOMS.includes(String(req.body?.room || ""))
    ? String(req.body.room) : "other";

  /* One bucket for everybody, not one per address: keeping a count per IP
     would mean keeping the addresses, which is the thing this route exists to
     avoid. A shared cap is cruder and holds nothing. */
  const n = (TALLY.get("all") || 0) + 1;
  TALLY.set("all", n);
  if (n > TALLY_BURST) return res.json({ ok: true });

  const day = new Date().toISOString().slice(0, 10);
  await change((board) => {
    const key = day + "|" + room + "|" + what;
    board.counts[key] = (board.counts[key] || 0) + 1;
    return { ok: true };
  });
  res.json({ ok: true });
});

/** The tally, for whoever runs the board. Never for a member. */
app.get("/api/counts", admin, async (_req, res) => {
  const board = await store.load(FILE);
  res.set("Cache-Control", "no-store");
  res.json({ counts: board.counts || {} });
});

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
  /* THE NAME ON THE LINK THEY FOLLOWED, if it names anybody.
   *
   * A stranger who followed a member's share link should be told whose it
   * was: "somebody sent me this" is a different proposition from a page that
   * arrived out of nowhere, and it is the only thing about it that is worth
   * a line. A handle and nothing else — no id back, no photograph, nothing
   * that says anything about that member beyond the name they already show
   * on every post they have ever made. An id that names nobody returns "",
   * so a made-up address simply loses its line. */
  const sent = String(req.query.via || "");
  const from = /^[a-f0-9]{20}$/.test(sent)
    ? board.people.find((q) => q.id === sent && q.state === "published" && q.handle)
    : null;

  /* WHETHER THE BROWSER ASKING IS ALREADY ON THE LIST.
   *
   * Somebody who joined last week and opens the same link again was being
   * shown the form a second time, which is how you get two rows for one
   * person and a stranger who thinks nothing happened the first time. One
   * boolean, about the device asking and nobody else, so the box can offer
   * the room instead of the form. It says nothing about who they are — the
   * page already knows that, because it is them.
   *
   * Sent to the browser that already sends this header everywhere else; a
   * request without it simply gets false, which is the form, which is right.
   */
  const asking = hashDevice(String(req.get("x-board-device") || ""), SALT);
  /* The cookie counts here too. A browser that has forgotten itself sends a
     new id and the old cookie, and showing it the form again is how one
     person becomes two rows — the whole thing the cookie exists to stop.
     Read only: the rebinding belongs on a route about one person, not on the
     one every visitor to the front page hits. */
  const kept = waitCookie(req);
  const already = board.waits.some((w) => !w.done
    && ((asking && w.by === asking) || (kept && w.by === kept)));

  res.json({
    featured,
    peek,
    already,
    via: from ? from.handle : "",
    // Whether there is anybody on the door. The page draws nothing at all
    // when there is not, rather than a box that answers every question with
    // an error — see lib/hostess.js, which is off unless switched on.
    hostess: hostessReady(),
    // The room this number is about, or "" when it is about the whole board.
    // Echoed so the page never holds its own copy of the four names.
    room: enough ? only : "",
    people: board.people.filter((q) => q.state === "published" && q.handle).length,
    // Absent rather than zero below the floor: a page can then say nothing at
    // all instead of saying something small.
    waiting: waiting >= WAITING_FLOOR ? waiting : null,
  });
});

/* A QUESTION FROM SOMEBODY OUTSIDE THE DOOR.
 *
 * Public, and it has to be: the reader has no code, that is the whole reason
 * they are asking. See lib/hostess.js for what it may say and the three
 * limits on what it may cost.
 *
 * Nothing is written down. The question is not logged, the answer is not
 * stored beyond an in-memory cache of identical questions, and the only thing
 * about the asker that reaches this route is the device number their own
 * browser made up — used to rate-limit them and for nothing else.
 */
app.post("/api/ask", express.json({ limit: "2kb" }), async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!hostessReady()) return res.status(404).json({ error: "off" });
  /* Not the salted hash. This never touches the board file and never meets a
     member, so the plain browser number is enough to tell two visitors apart,
     and hashing it here would only make the counter harder to reason about. */
  const by = String(req.body?.device || "").slice(0, 64) || String(req.ip || "anon");
  const out = await askHostess(req.body?.q, { by });
  if (out.error) {
    const code = out.error === "slow-down" || out.error === "busy" ? 429 : 400;
    return res.status(code).json({ error: out.error });
  }
  res.json({ text: out.text });
});

/** Ask to be let in. Public, obviously — it is the only thing here that is. */
app.post("/api/wait", express.json({ limit: "4kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const name = String(req.body?.name || "").trim();
  const reach = String(req.body?.reach || "").trim();
  if (!name || !reach) return res.status(400).json({ error: "both" });

  const out = await change((board) => {
    /* Already in, and asking anyway. Somebody who cleared their browser can
       land on the public page while still being a member in the file; telling
       them to wait for something they already have would be absurd. */
    if (me && board.people.some((q) => q.by === me)) return { already: true };
    /* THE LINK THEY CAME IN ON, checked rather than believed. An address is
       typed by anybody, so a `via` that does not name a published member is
       dropped and the row simply has nobody behind it. */
    const sent = String(req.body?.via || "");
    const from = board.people.find((q) => q.id === sent && q.state === "published" && q.handle);
    /* THE OTHER KIND OF LINK: one sent by somebody who is also waiting. Checked
       the same way and against the other table — a `w` that does not name a
       live row is dropped, so a made-up address credits nobody rather than
       inventing a person. And never themselves: a link followed back to your
       own row is a reload, not somebody brought in. */
    const wsent = String(req.body?.w || "");
    const wfrom = board.waits.find((w) => w.id === wsent && !w.done && w.by !== me);
    /* shown: true, ALWAYS, and never taken from the request.
       The form that posts here is the one that says so — see wait.note — so
       agreeing to it and sending it are the same act, and a browser cannot
       opt out of a promise the page already made on its behalf by leaving a
       field off. Rows written before that wording changed have no flag and
       stay invisible; see the note on `shown` in cleanWait. */
    /* quiet IS taken from the request, and shown is not. See the note on
       `quiet` in cleanWait: it can only ever hide the sender from other people
       waiting, so a browser sending it is asking for less and not more. */
    const row = store.cleanWait({ name, reach, why: req.body?.why,
      room: req.body?.room, by: me, via: from ? from.id : "",
      fromWait: wfrom ? wfrom.id : "", shown: true,
      quiet: req.body?.quiet === true });
    if (!row) return { error: "both" };
    /* CHANGING THE ANSWER MUST NOT EMPTY THE CARD. This replaces the row
       rather than merging into it, which is right for the three things the
       form owns and wrong for everything they filled in afterwards — a
       correction to a typo in a name would otherwise silently throw away a
       level, a type and a sentence. Carried over by name, so a field added
       here later has to be thought about rather than lost quietly. */
    const at = me ? board.waits.findIndex((w) => w.by === me) : -1;
    if (at >= 0) {
      const was = board.waits[at];
      board.waits[at] = { ...row, id: was.id, at: was.at,
        levelBand: was.levelBand, type: was.type, me: was.me, want: was.want,
        photo: was.photo, photoState: was.photoState,
        // Who brought them is a fact about how they arrived, not something a
        // second visit to the form should be able to rewrite.
        via: was.via || row.via, fromWait: was.fromWait || row.fromWait };
    } else board.waits.push(row);
    return { ok: true, again: at >= 0 };
  });
  if (out?.error) return res.status(400).json(out);
  /* THE COOKIE IS SET HERE, on the way out of joining, and not on the first
     edit afterwards — most people fill in the form and close the tab, and
     those are exactly the ones who would otherwise lose the row when their
     browser forgets itself. See waitingRow. */
  if (me && (out?.ok || out?.again)) setWaitCookie(res, me);
  res.json(out);
});

/* ---------------------------------------------------------------------------
 * WRITING TO SOMEBODY WHO IS NOT HERE YET
 *
 * This replaces the link a member could post anywhere. That link put whoever
 * followed it in the queue with nothing attached — a name and a reason typed
 * into a form by a stranger — so the member deciding whether to vouch had
 * nothing to read, and in practice nobody was ever brought in without a
 * private message from somebody who already knew them. The message was doing
 * the work and the board could not see it.
 *
 * So the message is the way in. A member writes one line to one person by
 * name; this mints a code; the member pastes the block into WeChat; the person
 * opens it, reads what was written TO THEM, and answers. The answer is their
 * place in the queue.
 *
 * IT IS NOT THE INVITE AND MUST NOT BECOME IT. An invite code lets somebody
 * straight in on a member's word. This puts them in the queue and they wait
 * there until a member vouches — which is the existing machinery, untouched.
 * Same alphabet and the same one-day clock as an invite, because both are read
 * down a phone and neither should still work six months later out of a chat.
 * ------------------------------------------------------------------------- */

/** Minting one. Behind the same standing test as an invite: bringing people
 *  to the door is the thing a board like this has to ration, and rationing it
 *  in two different ways would be two things to explain and one to get wrong. */
app.post("/api/write", express.json({ limit: "4kb" }), gate, async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  if (!me) return res.status(400).json({ error: "no" });
  const to = String(req.body?.to || "").trim().slice(0, 40);
  const line = String(req.body?.line || "").trim().slice(0, 600);
  if (!to) return res.status(400).json({ error: "name" });
  if (!line) return res.status(400).json({ error: "line" });
  /* THE PROFILE RULE APPLIES TO A LINE WRITTEN TO A STRANGER exactly as it
     applies to one written on a profile: no contact details in it. The link
     itself is the way to answer, and a WeChat id in the text is a way to take
     the conversation off the board before it has started. */
  const shaped = store.contactShaped(line);
  if (shaped) return res.status(400).json({ error: "contact", what: shaped });

  let why = "";
  const out = await change((board) => {
    const mine = board.people.find((q) => q.by === me);
    if (!mine || !mine.handle) { why = "nopage"; return null; }
    const rank = standing(board, me);
    if (!rank.can) { why = "standing"; return null; }
    const taken = codesTaken(board);
    let code = store.newCode();
    for (let i = 0; i < 50 && taken.has(code); i++) code = store.newCode();
    if (taken.has(code)) { why = "again"; return null; }
    const row = store.cleanWrite({
      id: store.newId(), code, by: me, to, line,
      till: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    if (!row) { why = "bad"; return null; }
    board.writes.push(row);
    return { code: row.code, till: row.till, to: row.to, from: mine.handle };
  });
  if (!out) return res.status(400).json({ error: why || "no" });
  res.json({ ok: true, ...out });
});

/** What the person who opened the link is looking at. No device needed and
 *  nothing about the board given away: the name they were called, who wrote
 *  it, their face, and the line. */
app.get("/api/write/:code", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const code = String(req.params.code || "").trim().toUpperCase();
  if (!store.cleanCode(code)) return res.status(404).json({ error: "no" });
  const board = await store.load(FILE);
  const w = board.writes.find((x) => x.code === code);
  if (!w) return res.status(404).json({ error: "no" });
  // Spent, or out of time. Two different sentences on the page, so somebody
  // holding a dead link knows which kind of dead it is.
  if (w.wait) return res.json({ gone: "spent" });
  if (w.till && new Date(w.till) < new Date()) return res.json({ gone: "old" });
  const from = board.people.find((q) => q.by === w.by);
  res.json({
    to: w.to,
    line: w.line,
    from: from ? from.handle : "",
    photo: from && from.photoState === "published" ? from.photo : "",
  });
});

/** THE ANSWER, WHICH IS THE THING THAT PUTS THEM IN THE QUEUE.
 *
 * Not admission. They land on the waiting list with their reply as the reason
 * — which is the point of the whole path: a member deciding whether to vouch
 * reads a real answer to a real question rather than a form.
 *
 * Spent here, in the same change() that writes the row, so two taps on a slow
 * phone cannot make two strangers.
 */
app.post("/api/write/reply", express.json({ limit: "8kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const code = String(req.body?.code || "").trim().toUpperCase();
  const name = String(req.body?.name || "").trim().slice(0, 40);
  const reply = String(req.body?.reply || "").trim().slice(0, 600);
  if (!me) return res.status(400).json({ error: "no" });
  if (!store.cleanCode(code)) return res.status(400).json({ error: "bad" });
  if (!name) return res.status(400).json({ error: "name" });
  if (!reply) return res.status(400).json({ error: "reply" });

  let why = "";
  const out = await change((board) => {
    const w = board.writes.find((x) => x.code === code);
    if (!w) { why = "bad"; return null; }
    if (w.wait) { why = "spent"; return null; }
    if (w.till && new Date(w.till) < new Date()) { why = "old"; return null; }
    // Already a member, opening a note out of curiosity. Nothing to do and
    // nothing to spend: they are through the door, which is further than this
    // goes.
    if (board.people.some((q) => q.by === me)) return { already: true };
    const from = board.people.find((q) => q.by === w.by && q.state === "published");

    const row = store.cleanWait({
      name,
      // No email asked for: the member who wrote to them is already talking to
      // them. See the note on fromWrite in cleanWait.
      reach: "",
      fromWrite: w.id,
      why: reply,
      by: me,
      via: from ? from.id : "",
      shown: true,
    });
    if (!row) { why = "bad"; return null; }
    /* ONE ROW PER BROWSER, like the form. Somebody who was already waiting and
       then gets written to keeps their row and gains the answer — losing a
       card they had filled in because a friend sent them a note would be the
       worst possible reward for answering it. */
    const at = board.waits.findIndex((x) => x.by === me);
    if (at >= 0) {
      const was = board.waits[at];
      board.waits[at] = { ...was, name: was.name || row.name,
        why: reply, fromWrite: w.id, via: was.via || row.via };
    } else {
      board.waits.push(row);
    }
    w.wait = (at >= 0 ? board.waits[at].id : row.id);

    /* AND THE NOTE BECOMES A CONVERSATION.
     *
     * It ended on a "Sent" screen with a link to the waiting room, which is a
     * receipt — and the thing this whole path is for is that somebody is now
     * IN the app, talking to the person who brought them. So the line that was
     * written to them and the answer they gave are written as the first two
     * messages of a thread, and the reply lands them in Messages with it open.
     *
     * Written here rather than at minting time because a note has no reader
     * until somebody opens it: before this moment there is no browser to
     * address the first message to.
     */
    if (w.by) {
      board.notes.push(store.cleanNote({
        id: store.newId(), at: w.at || new Date().toISOString(),
        by: w.by, to: me, text: w.line,
      }));
      board.notes.push(store.cleanNote({
        id: store.newId(), at: new Date().toISOString(),
        by: me, to: w.by, text: reply,
      }));
    }
    return { ok: true, from: from ? from.handle : "", who: from ? from.id : "" };
  });
  if (!out) return res.status(400).json({ error: why || "no" });
  // The same cookie the form sets, for the same reason: most people answer
  // once and close the tab, and those are the ones whose browser forgets.
  if (out.ok) setWaitCookie(res, me);
  res.json(out);
});

/* ---------------------------------------------------------------------------
 * The waiting room
 *
 * Everything below here is for somebody who is on the list and not through
 * the door. It is public in the sense that the door does not guard it, and
 * private in the only sense that matters here: every route works out who is
 * asking from their own device number, and answers about that person alone.
 *
 * WHY THE QUEUE STOPPED BEING ONLY A QUEUE. A member deciding whether to
 * vouch for a stranger had a name and one line to go on, which is not enough
 * to decide anything — so in practice nobody was ever brought in without a
 * private message from somebody who already knew them, and the list simply
 * grew. The room is the other half: somebody waiting can fill in a card, and
 * a card is a basis for a decision.
 *
 * NOTHING IN HERE ADMITS ANYBODY. There is no score, no pass mark, and no
 * amount of filling in that opens the door — a member still decides, in the
 * same way, for the same reasons. What changes is that they have something to
 * decide with, and that the waiting stopped being dead time.
 * ------------------------------------------------------------------------- */

/* THE QUEUE, IN THE ORDER IT IS ACTUALLY READ.
 *
 * First come, first served, and then one thing moves it: every person you
 * brought in who was not turned down moves you up one place.
 *
 * WHY THAT AND NOT POINTS. The seat block asks somebody to send their link,
 * and until now the whole of what it paid them was a counter going up. A
 * reward that is only a number is the kind of thing people notice, and
 * noticing it costs more trust than the extra sign-ups are worth. This is a
 * benefit that can be delivered today, is true the moment it ships, and is
 * not a promise about money.
 *
 * It is also the right incentive rather than a bribe: somebody who brings
 * good people in is a better bet for this board than somebody who filled in a
 * personality test, and the order should say so.
 *
 * ONE PLACE PER PERSON, not a multiplier and not a jump to the front. The
 * oldest rows can still be overtaken, but only by somebody who did the one
 * thing this place runs on, and only one step at a time.
 *
 * The same order everywhere: the number somebody is shown, the list of
 * others in their room, and the queue in the panel — because an order that
 * is only true on one screen is not an order, it is a decoration.
 */
function queueOrder(board) {
  const brought = (id) => board.waits.filter((x) => x.fromWait === id && x.done !== "no").length;
  /* AND A VOUCH MOVES THEM THE SAME ONE PLACE.
     A member saying somebody is worth letting in is worth exactly what
     bringing somebody in is worth: one step, not a jump to the front. Two
     members vouching is two steps. The rule stays "one place per thing you
     did", so the order is still readable by anybody standing in it. */
  const vouched = (id) => (board.vouches || []).filter((v) => v.wait === id).length;
  const up = (id) => brought(id) + vouched(id);
  return board.waits
    .filter((w) => !w.done)
    .sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")))
    /* The shift is measured against where they stood by date, so bringing
       somebody in cannot move you past somebody who brought in more. */
    .map((w, i) => ({ w, i, pos: Math.max(0, i - up(w.id)), n: brought(w.id),
      v: vouched(w.id), u: up(w.id) }))
    /* THE TIE GOES TO WHOEVER DID SOMETHING, and without that line the promise
       is off by one: moving up one place from behind somebody only draws level
       with them, and drawing level then loses to the older row. Somebody who
       was vouched for once would have to be vouched for twice before anything
       visibly moved, which is not what the screen says.
       Measured on everything that moves a row — people brought in and vouches
       both — because it used to count only the first, and a vouch that showed
       on the row while changing nothing about the order is worse than no
       vouch at all. */
    .sort((a, b) => (a.pos - b.pos) || (b.u - a.u) || (a.i - b.i));
}

/** Their own row, the queue around it, and the others waiting.
 *
 *  Public, and identified the way everything else outside the door is: by the
 *  hash of the number their browser made up. Nobody can ask this about
 *  anybody else, because the only thing it will answer about is the asker.
 */
app.get("/api/wait/me", async (req, res) => {
  res.set("Cache-Control", "no-store");
  /* Either key — the browser's own id, or the cookie it was given when it
     joined. See waitingRow: a browser that has forgotten itself is found by
     the cookie and the row moves to its new id. */
  const { board, row: mine, who: me } = await waitingRow(req, res);

  /* Already a member, asking anyway — a browser that was let in and then
     opened the address it used to use. Said plainly rather than as an empty
     room, so the page can send them somewhere better. */
  if (me && board.people.some((q) => q.by === me)) return res.json({ inside: true });

  if (!mine) return res.json({ on: false });

  /* HOW MANY ARE AHEAD, and it is a queue position rather than a ranking.
     Everybody still waiting who is in front of them — by when they asked,
     less one place for each person they brought in. See queueOrder. */
  const order = queueOrder(board);
  const open = order.map((x) => x.w);
  const ahead = Math.max(0, order.findIndex((x) => x.w.id === mine.id));
  const broughtIn = (order.find((x) => x.w.id === mine.id) || {}).n || 0;

  /* THE OTHERS, AND ONLY THE ONES WHO SAID SO.
   *
   * `shown` and nothing else decides this. Everybody who answered the older
   * form — which promised them that no member would ever see their name — is
   * absent from this list for ever, and absent from it here as well as from
   * the members' side, because "the others waiting" are not members either
   * and were never covered by anything they agreed to.
   *
   * What travels is what the card shows: a name, their room, the line they
   * wrote, and the three things they filled in. NOT the contact, which is
   * the one promise the new wording still makes in full, and not the id or
   * the device.
   */
  /* IN QUEUE ORDER, which `open` already is. It was sorted by how full a card
     was, which read as a ranking of people and was a second order competing
     with the one that decides anything. There is one order now and this is
     the one place somebody waiting can watch it work. */
  /* NAMES, NOT REASONS.
     This used to carry `why` — the line somebody writes about themselves — to
     everybody else in the queue. It is the most personal thing on the row and
     it was written to persuade whoever decides, not to be read by the other
     thirty-four people standing outside. A name and which room is enough to
     feel that the queue is real; the rest goes to the members, who are the
     ones it was written for. */
  const others = open
    // `quiet` goes out here and stays in /api/queue — see cleanWait. The
    // people inside can vouch for a name; the people beside you in the queue
    // can only read it, and on some doors they are your competition.
    .filter((w) => w.shown && !w.quiet && w.by !== me)
    .slice(0, 60)
    .map((w) => ({ name: w.name, room: w.room,
      // Released only. An id nobody can guess is not a reason to hand out one
      // that has not been looked at.
      photo: w.photoState === "published" ? w.photo : "" }));

  /* THEIR SEAT, IF THE SWITCH IS ON. See SEAT_OUTSIDE.
   *
   * WHAT THE NUMBER MEANS, because it is the one thing on this block that
   * could be read as a promise. It is the seat they would take if everybody
   * ahead of them in the queue went in first: the members already in, plus
   * the people who asked before they did, plus one. It moves — down when
   * somebody ahead is turned down, up when somebody is let in before them —
   * and the page says so. It is not a seat they hold.
   *
   * `brought` is rows that named their row as the one they followed, still
   * waiting or already let in. Turned-down rows do not count: the line says
   * "who stays", and this is the honest reading of it.
   *
   * NO FIGURE IN MONEY AND NO PERCENTAGE. Those are on the seat page behind
   * the door, where the reader is a member and the arithmetic is theirs to
   * see. Out here it is a count and three rows.
   */
  let seat = null;
  if (SEAT_OUTSIDE && ledgerOn()) {
    const inAlready = board.people.filter((q) => q.state === "published" && q.handle).length;
    const brought = broughtIn;
    const began = Date.parse(mine.at || "") || Date.now();
    seat = {
      n: Math.min(SEATS, inAlready + ahead + 1),
      seats: SEATS,
      taken: inAlready,
      brought,
      weeks: Math.max(1, Math.ceil((Date.now() - began) / (7 * 86400000))),
      /* PLACES LEFT, not seats taken. The same subtraction either way, but
         "20 of 100 are in" reads as an empty room to somebody deciding
         whether this is worth their time, and "80 places left" reads as a
         thing running out. Both are true; one of them is also useful. */
      left: Math.max(0, SEATS - inAlready),
      /* WHAT EACH THING IS WORTH, so the screen can end every row in a
         number instead of asking somebody to hold a four-step chain in their
         head. Being early is worth 200/sqrt(seat) — 41 at seat 24 — and one
         person who gets in and stays is worth 100. That ordering is the whole
         argument for the block, and it only lands if both numbers are on it. */
      pts: FOUND(Math.min(SEATS, inAlready + ahead + 1)),
      worth: WORTH,
      pool: POOL,
      /* Money only if somebody set the two numbers. See moneyOn(). */
      money: moneyOn() ? {
        sale: SALE, cut: CUT,
        /* The ladder, at guests who got in AND posted — the only ones that
           pay. Sent links are not on it, because sent links pay nothing. */
        at: [0, 1, 3, 10].map((g) => ({
          g, money: inMoney(FOUND(Math.min(SEATS, inAlready + ahead + 1)) + g * WORTH.guest),
        })),
      } : null,
      // The link they send. Their row's id, not their device — an id that
      // survives them clearing the browser, which the device hash does not.
      link: "/r/" + (mine.room === "other" ? "other" : mine.room) + "?w=" + mine.id,
    };
  }

  /* ONE POST, NOT A FEED. The feed is behind the door and stays there. This
     is the same single post the public page carries, for the same reason:
     it says the place is real without pretending the door is open. */
  const featured = board.posts.filter((p) => p.featured && p.state === "published")
    .slice(0, 1)
    .map((p) => ({ note: p.note, zh: p.zh, handle: p.handle, at: p.at }));

  res.json({
    on: true,
    /* Their own photograph, whatever state it is in — it is theirs, they are
       looking at their own card, and a card that hid it from them would read
       as an upload that failed. photoState travels with it so the page can
       say plainly that nobody else can see it yet. */
    /* WHETHER THEY HAVE A WAY BACK, AND NEVER WHAT IT IS.
     *
     * The contact is the one field on this row shown to nobody, and the room
     * page says so about itself — see the note above putCard. Sending it here
     * so somebody can read their own address would put it in a page, and a
     * page that holds it is a page one bug away from showing it.
     *
     * A boolean is the whole of what the screen needs: an address means six
     * digits can bring them back, a WeChat id means they are one lost phone
     * away from losing their place and nothing had told them. They can write
     * a new one without this ever having read the old one. */
    you: { name: mine.name, room: mine.room, why: mine.why, at: mine.at,
      levelBand: mine.levelBand, type: mine.type, me: mine.me, want: mine.want,
      photo: mine.photo, photoState: mine.photoState,
      canSignIn: /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/
        .test(String(mine.reach || "").trim().toLowerCase()) },
    ahead, waiting: open.length, others, featured, seat,
    /* THE ONE LINE, WHEN THE BLOCK ITSELF IS OFF.
     *
     * Turning the seat block off took the whole idea off the screen with it,
     * and the idea is worth saying even while the arithmetic is not being
     * shown: somebody deciding whether to bother should know there is
     * something here. It is a sentence, not a block — no seat, no points, no
     * percentage, no money, and nothing to click. One switch does both: the
     * block is on, or the sentence is. */
    // Its own switch now, and never the absence of another. See SAY_STAKE.
    soon: !SEAT_OUTSIDE && SAY_STAKE,
    tests: TESTS_ON,
    /* THEIR LINK, ALWAYS — not only when the seat block is on.
     *
     * It used to live inside seat.link, so turning the block off took the
     * only way to share with it, and sharing is the one thing this room asks
     * anybody to do. It is their row's id, not their device: an id that
     * survives them clearing the browser, which the device hash does not. */
    link: "/r/" + (mine.room === "other" ? "other" : mine.room) + "?w=" + mine.id,
  });
});

/** What they filled in, onto their own row and nobody else's.
 *
 *  One field at a time or all of them; anything absent is left alone, so the
 *  level test can write a band without knowing whether a type is there yet.
 *  Every value goes through cleanWait, which is where the checking lives.
 *
 *  IT TAKES THE THREE FORM FIELDS TOO, and this is the reason it exists
 *  rather than the room simply posting the join form again. /api/wait
 *  replaces the row, so a screen that lets somebody fix a typo in their name
 *  would have to send their contact back with it — which means the server
 *  would have to hand the contact to the browser first. The one promise the
 *  new wording still makes in full is that the contact is shown to nobody, and
 *  a page that holds it in a variable is a page one bug away from breaking
 *  that. So it never leaves this process: `reach` is not readable here, not
 *  writable here, and not in anything /api/wait/me returns.
 */
app.post("/api/wait/card", express.json({ limit: "2kb" }), async (req, res) => {
  const { row, who: me } = await waitingRow(req, res);
  if (!me && !row) return res.status(400).json({ error: "who" });
  const out = await change((board) => {
    const at = board.waits.findIndex((w) => w.by === me && !w.done);
    /* No row is not an error worth a red screen: a member takes the same
       tests from inside and their results belong on their profile, which is
       a different route. The page asks this one only when it is in the
       waiting room, so this is the "you were let in while the tab was open"
       case. */
    if (at < 0) return { on: false };
    const was = board.waits[at];

    /* A VALUE THAT DOES NOT SURVIVE CHECKING LEAVES THE OLD ONE ALONE.
     *
     * cleanWait blanks a field it does not recognise, which is right when a
     * whole row arrives and wrong here: posting a level of "ZH 99" would then
     * quietly delete a good level, and a page that sends one bad field would
     * take the rest of the card down with it. Nothing on this screen is ever
     * un-taken, so an unreadable value means keep what is there — a write is
     * only allowed to replace a field with another real value.
     *
     * Cleaned one field at a time, against a row that is otherwise theirs, so
     * every rule stays in cleanWait rather than being restated here.
     */
    /* AN ADDRESS SOMEBODY ELSE IS WAITING WITH. Two open rows behind one
       address means six digits find the first of them and the other person
       is quietly locked out of their own place — so it is refused rather than
       written. Only against addresses: two people can and do give the same
       office WeChat. */
    const want = String(req.body?.reach ?? "").trim().toLowerCase();
    if (want && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(want)
        && board.waits.some((w) => !w.done && w.by !== me
          && String(w.reach || "").trim().toLowerCase() === want)) {
      return { error: "reachTaken" };
    }

    const put = { ...was };
    for (const k of ["levelBand", "type", "me", "want", "name", "room", "why", "reach"]) {
      if (req.body?.[k] === undefined) continue;
      const tried = store.cleanWait({ ...was, [k]: req.body[k] });
      /* `why` is the one field that is allowed to become nothing: it is
         optional on the form that made the row, so somebody who wants their
         line gone has to be able to delete it. Everything else keeps its old
         value when the new one does not survive checking. */
      if (!tried) continue;
      if (tried[k] || k === "why") put[k] = tried[k];
    }
    const row = store.cleanWait(put);
    if (!row) return { error: "row" };
    board.waits[at] = row;
    return { on: true, you: { levelBand: row.levelBand, type: row.type,
      me: row.me, want: row.want, name: row.name, room: row.room, why: row.why,
      // Whether it works as a way back, never the thing itself. See above.
      canSignIn: /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/
        .test(String(row.reach || "").trim().toLowerCase()) } };
  });
  if (out?.error === "reachTaken") return res.status(409).json(out);
  if (out?.error) return res.status(400).json(out);
  res.json(out);
});

/** A photograph, onto their own row.
 *
 *  Its own route rather than a field on /api/wait/card, because it is the one
 *  thing here that arrives as a megabyte rather than a word — a 2kb body limit
 *  is right for the card and would silently refuse this.
 *
 *  HELD, ALWAYS. See the note on `photo` in cleanWait: a member was vouched
 *  for and somebody on the list was not, so this one waits for a person to
 *  look at it. They see it on their own card immediately; what waits is
 *  everybody else seeing it.
 *
 *  A NEW ONE GOES BACK INTO THE QUEUE, the same way a member's does. Changing
 *  a face is the same act as adding one, and a picture that could be swapped
 *  after release would make releasing it mean nothing.
 */
app.post("/api/wait/photo", express.json({ limit: "36mb" }), async (req, res) => {
  const { row, who: me } = await waitingRow(req, res);
  if (!me && !row) return res.status(400).json({ error: "who" });
  const data = String(req.body?.photo || "");
  if (!data) return res.status(400).json({ error: "none" });
  const buf = Buffer.from(data, "base64");
  if (buf.length > MEDIA_MAX) return res.status(413).json({ error: "tooBig" });
  const id = await putMedia(buf, String(req.body?.photoType || ""));
  if (!id) return res.status(415).json({ error: "badType" });

  const out = await change((board) => {
    const at = board.waits.findIndex((w) => w.by === me && !w.done);
    if (at < 0) return { on: false };
    board.waits[at] = store.cleanWait({ ...board.waits[at], photo: id, photoState: "held" });
    return { on: true, photo: id, photoState: "held" };
  });
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
        staff: Boolean(rank.staff),
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

    const have = codesTaken(board);
    /* WHO SENT THEM, by name. The row stores an id because a member who
       changes what they are called should not leave a trail of rows crediting
       who they used to be — so it is resolved here, at the moment the message
       is written, and never written down. It goes in the link: somebody who
       joined the list off Peter's post is let in by Peter, not by nobody. */
    const who = new Map(board.people.map((q) => [q.id, q.handle]));
    const admitted = [];
    for (const w of some) {
      let code = store.newCode();
      while (have.has(code)) code = store.newCode();
      have.add(code);
      board.invites.push(store.cleanInvite({
        code, who: w.name, at: new Date().toISOString(),
      }));
      w.done = "in";
      admitted.push({ name: w.name, reach: w.reach, code, via: who.get(w.via) || "" });
    }
    return { ok: true, admitted };
  });
  res.json(out);
});

/** The list itself, for whoever runs the box. Never for a member. */
/** THE QUEUE, TO SOMEBODY ALREADY IN.
 *
 * The rule here was that the queue is a number and never a list, so nothing
 * inside could say who was outside. That is relaxed on purpose: the people in
 * the room are the ones who would vouch for somebody waiting, and nobody
 * vouches for a number.
 *
 * What it shows is exactly what a waiting person already shows every other
 * waiting person — name, which room, why, and a released photograph. What it
 * never shows is `reach`. That is the one field somebody typed so that we
 * could contact them, not so a roomful of people could.
 *
 * Members only, checked the way the door checks everything: the browser has to
 * belong to somebody with a profile here.
 */
app.get("/api/queue", async (req, res) => {
  const me = inCookie(req);
  if (!me) return res.status(401).json({ error: "who" });
  const board = await store.load(FILE);
  if (!board.people.some((q) => q.by === me)) return res.status(403).json({ error: "no" });
  res.set("Cache-Control", "no-store");
  /* The same order the waiting room shows and the same order admission uses —
     first come, one place up per person brought in. One rule, one place. */
  const order = queueOrder(board);

  /* WHO IS WAITING FOR *YOU* — the queue read through the reader's own
   * sentence rather than through the door the waiting person came in by.
   *
   * The list below is in queue order and that order is right: it is the one
   * admission uses. But a member scrolling thirty names has no way to tell
   * which of them they would actually match with, and the answer is already
   * on their own profile — I am a ___ looking for a ___. So each sentence
   * they have written comes back with three numbers against it.
   *
   * COUNTED OVER `shown` ROWS ONLY, which is exactly the rows the list below
   * carries, so the block and the list can never quietly disagree on screen.
   * `quiet` stays in: it hides somebody from the other people waiting, never
   * from the people who could let them in.
   *
   * `inside` is other MEMBERS who say they are that thing, and it is here
   * knowing it will be small. A member who wants an agent and reads that one
   * agent is in is the member who spends a vouch — the number that makes them
   * act is the same number that says the room is thin, and there is no honest
   * way to show the first without the second.
   *
   * WHAT THEY ARE COMES FROM `say`, not from `type` (the MBTI four letters,
   * which shares nothing with roles but a field name) and not from `rooms` (a
   * member belongs to a matching room, a waiting person to a door — two
   * namespaces with some of the same words in them). Both wrong readings show
   * as nobody waiting, every time. Same trap as /api/faces; same note there.
   */
  /* WHO SPOKE FOR THEM, BY NAME, and it is the whole weight of a vouch.
   *
   * "2 vouched" is a number. "Ivy vouched" is somebody this member already
   * knows putting their name to a stranger, and it is the only thing on this
   * list that can move anybody. The count was here from the start and the
   * names were nowhere, which left the row saying that something happened
   * without saying the one part of it that carries.
   *
   * MEMBERS ONLY, like everything else on this route. It never reaches the
   * person waiting: /api/wait/me carries names out of the queue and nothing
   * from inside. Resolved from the profile at read time rather than stored,
   * the same as the panel — somebody who changes what they are called should
   * not leave a trail of rows crediting who they used to be. Blank where the
   * profile has gone, and the page says "someone" rather than a gap: the
   * vouch still happened. */
  const nameOf = new Map(board.people.map((q) => [q.by, q.handle]));
  const spoke = new Map();
  for (const v of board.vouches || []) {
    if (!spoke.has(v.wait)) spoke.set(v.wait, []);
    spoke.get(v.wait).push(nameOf.get(v.by) || "");
  }

  const shown = order.map((x) => x.w).filter((w) => w.shown);
  const says = [];
  for (const q of board.people) {
    if (q.by !== me) continue;
    for (const r of Array.isArray(q.say) ? q.say : []) {
      if (r && r.me && r.want && !says.some((y) => y.me === r.me && y.want === r.want)) {
        says.push({ me: r.me, want: r.want });
      }
    }
  }
  const saysIt = (q, role, any) => (Array.isArray(q.say) ? q.say : [])
    .some((r) => r && r.me && (any || r.me === role));
  const pairs = [];
  for (const r of says) {
    const any = r.want === store.ANYONE;
    const here = shown.filter((w) => w.me && (any || w.me === r.want));
    // Nothing to say is better said by saying nothing — see the page.
    if (!here.length) continue;
    pairs.push({
      me: r.me, want: r.want,
      waiting: here.length,
      /* Both halves of the sentence: these are a match rather than a hope. */
      mutual: here.filter((w) => w.want === r.me || w.want === store.ANYONE).length,
      inside: board.people.filter((q) => q.by !== me && q.state === "published"
        && saysIt(q, r.want, any)).length,
    });
  }

  res.json({
    waiting: order.length,
    pairs,
    rows: order.filter((x) => x.w.shown).slice(0, 120).map((x, i) => ({
      place: i + 1, id: x.w.id,
      name: x.w.name, room: x.w.room, why: x.w.why,
      levelBand: x.w.levelBand, type: x.w.type, want: x.w.want,
      brought: x.n || 0, vouches: x.v || 0,
      // Six is more names than the row can draw; the count carries the rest.
      vouchedBy: (spoke.get(x.w.id) || []).slice(0, 6),
      /* Whether this reader has already vouched, so the button can say so
         rather than offering a thing that would do nothing. */
      mine: (board.vouches || []).some((v) => v.wait === x.w.id && v.by === me),
      photo: x.w.photoState === "published" ? x.w.photo : "",
    })),
  });
});

/** Vouch for somebody waiting, or take it back. Members only, one per person.
 *
 *  It moves them one place, the same as bringing somebody in does — see
 *  queueOrder. Not a jump to the front, because an order that can be skipped
 *  is not an order, and the people standing in it can read this one.
 */
app.post("/api/vouch", express.json({ limit: "1kb" }), async (req, res) => {
  const me = inCookie(req);
  if (!me) return res.status(401).json({ error: "who" });
  const wait = String(req.body?.wait || "");
  const on = req.body?.on !== false;
  const out = await change((board) => {
    if (!board.people.some((q) => q.by === me)) return { error: "no" };
    const row = board.waits.find((w) => w.id === wait && !w.done);
    if (!row) return { error: "gone" };
    board.vouches = board.vouches || [];
    const at = board.vouches.findIndex((v) => v.wait === wait && v.by === me);
    if (on && at < 0) board.vouches.push(store.cleanVouch({ by: me, wait }));
    if (!on && at >= 0) board.vouches.splice(at, 1);
    return { ok: true, on, n: board.vouches.filter((v) => v.wait === wait).length };
  });
  if (out?.error === "no") return res.status(403).json(out);
  if (out?.error) return res.status(404).json(out);
  res.json(out);
});

app.get("/api/waiting", admin, async (_req, res) => {
  const board = await store.load(FILE);
  res.set("Cache-Control", "no-store");
  /* The sender resolved to a name, because an id is not something anybody can
     read. Resolved here rather than stored as a name: a member who changes
     what they are called should not leave a trail of rows crediting who they
     used to be. */
  const who = new Map(board.people.map((q) => [q.id, q.handle]));
  /* AND WHERE EACH OPEN ROW STANDS IN THE QUEUE, worked out here rather than
     in the panel. The order is a rule about this board — first come, one
     place up per person brought in — and a rule reimplemented in a browser is
     a rule that will one day disagree with itself. See queueOrder.
     `brought` travels too, so the panel can show why somebody moved. */
  const place = new Map();
  const bring = new Map();
  queueOrder(board).forEach((x, i) => { place.set(x.w.id, i); bring.set(x.w.id, x.n); });
  /* Also the name of whoever's link they came in on, when it was somebody
     waiting rather than a member — the same courtesy `viaName` does. */
  const byWait = new Map(board.waits.map((w) => [w.id, w.name]));
  /* WHO VOUCHED FOR THEM, BY NAME.
   *
   * The count has been on the members' side of this since vouching existed
   * and the names were nowhere: a row read "3 vouched" and the one question
   * worth asking of it — which three — could only be answered by opening the
   * board file. It is also the question asked about somebody already let in,
   * long after the row has stopped mattering for anything else.
   *
   * Resolved from the profile here and not stored as a name, the same as
   * `via` above and for the same reason: somebody who changes what they are
   * called should not leave a trail of rows crediting who they used to be.
   * Keyed on `by`, the browser hash, which is what a vouch carries. */
  const byHash = new Map(board.people.map((q) => [q.by, q.handle]));
  const vouched = new Map();
  for (const v of board.vouches || []) {
    if (!vouched.has(v.wait)) vouched.set(v.wait, []);
    // A vouch from somebody whose profile has since gone still happened.
    vouched.get(v.wait).push(byHash.get(v.by) || "somebody");
  }
  res.json({ waits: board.waits.map((w) => ({
    ...w,
    viaName: who.get(w.via) || "",
    fromWaitName: byWait.get(w.fromWait) || "",
    place: place.has(w.id) ? place.get(w.id) : null,
    brought: bring.get(w.id) || 0,
    vouchedBy: vouched.get(w.id) || [],
  })) });
});

/* LETTING A WAITING PERSON'S PHOTOGRAPH THROUGH, OR NOT.
 *
 * The companion to /api/face/release and DELETE /api/face, which do the same
 * two things for a member. Separate routes rather than a flag on those,
 * because they address a different row by a different id: a member is found
 * by their person id, somebody waiting by their wait-row id, and one route
 * that guessed which would be one route that could act on the wrong person.
 *
 * REFUSED CLEARS THE PICTURE AND KEEPS THE ROW. They are still waiting, they
 * simply have no photograph, and they can put up a different one — the same
 * rule as a member's. Deleting the row would throw away somebody who asked to
 * join because of a picture they chose badly.
 */
/** A WAY BACK FOR SOMEBODY WHOSE BROWSER FORGOT THEM.
 *
 *  Rows are found by device hash and nothing else, so a cleared browser, a new
 *  phone or a private window left a person permanently separated from their
 *  own card — and filling the form again wrote a second row rather than
 *  finding the first. There was no way to reunite them, by hand or otherwise.
 *
 *  So: one code against one row, minted here, read down a phone or sent in a
 *  message, and spent at the same box a member uses. Same alphabet as an
 *  invite code — no O, no zero, no I, no one — because it is going to be typed
 *  by somebody who is already annoyed.
 *
 *  IT DOES NOT LET ANYBODY IN. It hands back a place on the list and the card
 *  they filled in. A code that could be either would be one typo away from
 *  admitting a stranger.
 */
app.post("/api/waiting/key", express.json({ limit: "1kb" }), admin, async (req, res) => {
  const id = String(req.query.id || req.body?.id || "");
  const out = await change((board) => {
    const row = board.waits.find((w) => w.id === id);
    if (!row) return null;
    /* Fresh every time it is asked for. An old code stops working the moment a
       new one is made, so "send her another" cannot leave two in the wild. */
    const taken = codesTaken(board);
    let code = store.newCode();
    while (taken.has(code)) code = store.newCode();
    row.back = code;
    return { code, name: row.name, room: row.room };
  });
  if (!out) return res.status(404).json({ error: "no" });
  res.json({ ok: true, ...out });
});

app.post("/api/waiting/face", express.json({ limit: "1kb" }), admin, async (req, res) => {
  const id = String(req.query.id || req.body?.id || "");
  const yes = req.query.ok === "1" || req.body?.ok === true;
  const out = await change((board) => {
    const at = board.waits.findIndex((w) => w.id === id);
    if (at < 0) return null;
    const w = board.waits[at];
    board.waits[at] = store.cleanWait(yes
      ? { ...w, photoState: "published" }
      : { ...w, photo: "", photoState: "refused" });
    return { name: w.name, photoState: board.waits[at].photoState };
  });
  if (!out) return res.status(404).json({ error: "no such row" });
  res.json({ ok: true, ...out });
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
  const me = hashDevice(String(req.body?.device || ""), SALT);
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
  const out = { mutual: false, shared: [], can: false, gave: false, given: false,
                card: null, note: "" };
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
    if (row) out.card = { wechat: row.wechat, line: row.line, qr: row.qr };
    // What they wrote when they handed it over, read by the one person it was
    // written for and by nobody else — same gate as the card, one line later.
    const g = board.grants.find((x) => x.by === q.by && x.who === mine.id && !x.off);
    out.note = (g && g.note) || "";
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * Leaving for good
 *
 * The counterpart of the door. Everything else here is written so that a
 * person can decide what other people see; this is the one that lets them
 * decide the board sees nothing, and it is not a settings toggle — it is a
 * separate press behind its own screen that names, in advance, exactly what
 * goes. See forget() in store.js for the list and for the two rows that are
 * unlinked rather than removed.
 *
 * ONE CONFIRMATION AND NO PASSWORD, because there is no password: a person IS
 * a browser here, so the device id in the body is the whole of the proof, and
 * it is the same proof every other write on this board runs on. Asking for a
 * second secret would mean inventing one for this route alone.
 *
 * THE COOKIE GOES TOO. It is what admission is read from and it outlives
 * localStorage by design — leaving it behind would mean somebody who deleted
 * everything still walks through the door as a member who no longer exists.
 * ------------------------------------------------------------------------- */
app.post("/api/me/forget", express.json({ limit: "1kb" }), gate, async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  if (!me) return res.status(400).json({ error: "no" });
  // A word the page has to send, so a stray POST cannot do this and neither
  // can a link somebody is sent. Not a secret — a second act.
  if (req.body?.sure !== "forget") return res.status(400).json({ error: "sure" });

  const out = await change((board) => store.forget(board, me));

  /* The files last, and failures are swallowed on purpose: the rows are the
     record, and a photograph whose row is gone is unreachable by every route
     on this server — findMedia is only ever called with an id read out of the
     board. A file left on disk is a cleanup job, not a leak of a profile. */
  for (const id of out.media) {
    const found = await findMedia(id);
    if (found) await rm(found.file).catch(() => {});
  }

  res.append("Set-Cookie",
    "board_in=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure");
  res.json({ ok: true, rows: out.rows, files: out.media.length });
});

/* ---------------------------------------------------------------------------
 * SIGNING IN, ON A BOARD THAT HAS NO ACCOUNTS
 *
 * The identity here is a random number the browser made up, and the key is
 * that number shown. It is the whole design and it works. What it does not do
 * is survive people: most of them do not know what a key is, do not save it,
 * and find out what it was for on the day they change phone and everything
 * they wrote is under a hash nobody can produce any more.
 *
 * So: an address, optional, and six digits to it. What the code does is not
 * "log you in" — there is still no session and nothing to be logged into. It
 * REBINDS: their rows move onto a fresh key this browser is handed and stores,
 * which is exactly what the key does when pasted, and exactly what the cookie
 * already does for a browser that forgot itself. One mechanism, three doors.
 *
 * WHAT IS NOT BUILT HERE, on purpose:
 *
 *   No password. There is nothing to remember and nothing to reuse from
 *   somewhere it has already leaked.
 *
 *   No session. The code is spent once and the row is deleted; what the
 *   browser keeps afterwards is the same key it would have kept anyway.
 *
 *   No enumeration. /api/signin answers the same whether or not anybody here
 *   uses that address. An endpoint that says "no such member" is a tool for
 *   finding out who is a member, and this is a board whose whole value is
 *   that being in it is not public.
 * ------------------------------------------------------------------------- */

/* How long a code is worth anything, and how many guesses it survives. Ten
   minutes is long enough to walk to a laptop and short enough that a code read
   off an old mail is dead. Five guesses against a million is generous. */
const CODE_MINUTES = 10;
const CODE_TRIES = 5;

/* WHAT THIS COSTS AND WHO CAN SPEND IT — the same shape as the translate cap
   above. Mail is a bill and an address is somebody's inbox, so a public route
   that sends one on request is both a bill anybody can run up and a way to
   post six digits at a stranger all afternoon. Two buckets, neither of which
   holds an address: one per address hashed, one for the whole board. */
const MAIL_SENT = new Map();
const MAIL_PER_ADDRESS = 3;
const MAIL_PER_HOUR = 60;
setInterval(() => MAIL_SENT.clear(), 3_600_000).unref?.();
const mailBudget = (mail) => {
  const key = store.hashDevice(mail, SALT);
  const all = (MAIL_SENT.get("all") || 0) + 1;
  const one = (MAIL_SENT.get(key) || 0) + 1;
  MAIL_SENT.set("all", all);
  MAIL_SENT.set(key, one);
  return all <= MAIL_PER_HOUR && one <= MAIL_PER_ADDRESS;
};

/** Six digits. Leading zeros kept — a code that is sometimes five long is a
 *  box people mistype. */
const sixDigits = () => String(randomUUID().replace(/\D/g, "").slice(0, 6) || "0")
  .padStart(6, "0").slice(0, 6);

/** The stored form of a code. Hashed with the board's salt, like everything
 *  else here, so board.json never holds a live one in the clear. */
const codeHash = (mail, code) => store.hashDevice(mail + ":" + code, SALT);

/** Ask for a code.
 *
 *  ALWAYS THE SAME ANSWER. Known address or not, sent or not sent, the reply
 *  is `{ ok: true }` — see the note above on enumeration. The only thing that
 *  changes the answer is mail not being configured on this box at all, which
 *  is a fact about the board and not about any person.
 */
app.post("/api/signin", express.json({ limit: "1kb" }), async (req, res) => {
  if (!mailReady()) return res.status(503).json({ error: "unconfigured" });
  const mail = String(req.body?.mail || "").trim().toLowerCase().slice(0, 120);
  const same = { ok: true };
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(mail)) return res.json(same);
  if (!mailBudget(mail)) return res.json(same);

  const board = await store.load(FILE);
  /* MEMBERS FIRST, THEN THE QUEUE.
   *
   * Somebody waiting loses their place the same way a member loses their
   * page, and worse: they join again, and the list grows a second row with
   * the same person on it — which is worth nothing to them and worth less
   * than nothing to whoever reads the queue.
   *
   * NO NEW BOX ON THE FORM. A waiting row already carries `reach`, which is
   * required and is how they asked to be contacted; when what they typed is
   * an address, it is the address. Forty-six people have already filled that
   * form in and asking them for a second contact is churn. Whoever typed a
   * WeChat id there has no door here and still has the code the panel can
   * mint — see make waiting-key.
   *
   * A member wins a tie. They are in; the row is history. */
  const mine = board.people.find((q) => q.mail === mail)
    || board.waits.find((w) => !w.done && String(w.reach || "").trim().toLowerCase() === mail);
  // Nothing here uses that address. Answered like every other case, and the
  // work stops: no row written, no mail sent, nothing to time.
  if (!mine) return res.json(same);

  const code = sixDigits();
  await change((b) => {
    b.signins = (b.signins || []).filter((v) => v.mail !== mail);
    b.signins.push(store.cleanSignin({ mail, code: codeHash(mail, code) }));
    return true;
  });

  /* SENT AFTER THE ROW IS WRITTEN, and a failure to send is not reported. A
     mail that bounced and a mail that was never asked for have to look the
     same from outside, or the difference is the enumeration this route was
     built to refuse. The page says to check the spam folder. */
  await sendMail({
    to: mail,
    subject: code + " — " + (process.env.TOMSCODING_BOARD_DOMAIN || "The Exchange"),
    text: "Your code is " + code + ".\n\n"
      + "It works for " + CODE_MINUTES + " minutes, on the phone or computer you "
      + "asked from.\n\nIf you did not ask for it, somebody typed your address "
      + "by mistake. Nothing has happened and you can ignore this.\n",
  });
  res.json(same);
});

/** Spend it.
 *
 *  On the way through: the row is deleted, a fresh key is minted, their rows
 *  are rebound onto it, and the cookie is set to match. The key goes back to
 *  the browser, which stores it exactly as if somebody had pasted one — so a
 *  member who signs in on a new phone ends up holding a key again, whether or
 *  not they ever knew they had one.
 *
 *  THE OLD PHONE STOPS BEING THEM. Rebinding moves; it does not copy. Said out
 *  loud on the screen rather than discovered, because the alternative is many
 *  keys for one person, and every row on this board is keyed by exactly one
 *  hash. One person, one key, and the last device to sign in holds it.
 */
app.post("/api/signin/code", express.json({ limit: "1kb" }), async (req, res) => {
  const mail = String(req.body?.mail || "").trim().toLowerCase().slice(0, 120);
  const code = String(req.body?.code || "").replace(/\D/g, "").slice(0, 6);
  if (!mail || code.length !== 6) return res.status(400).json({ error: "bad" });

  /* A BROWSER THAT IS ALREADY SOMEBODY. Signing in here would leave that
     person with no key and no way back — so it is refused, and the page says
     which person it is about to strand. `over` is the second act, the same
     shape as `sure` on forget: a word the page sends once somebody has read
     the warning. */
  const here = hashDevice(String(req.body?.device || ""), SALT);
  const now = await store.load(FILE);
  if (here && now.people.some((q) => q.by === here) && req.body?.over !== "yes") {
    return res.status(409).json({ error: "here" });
  }

  /* THE KEY IS MADE HERE AND THE SERVER NEVER KEEPS IT. What is stored is the
     salted hash, like every other identity on this board; the line itself
     exists in this response and in the browser that receives it, and nowhere
     else. Two UUIDs so it is as long as the ones browsers make for themselves. */
  const key = randomUUID() + randomUUID().slice(0, 8);
  const to = store.hashDevice(key, SALT);

  const out = await change((board) => {
    board.signins = board.signins || [];
    const row = board.signins.find((v) => v.mail === mail);
    if (!row) return { error: "bad" };
    const old = Date.now() - Date.parse(row.at || "") > CODE_MINUTES * 60_000;
    if (old) {
      board.signins = board.signins.filter((v) => v.mail !== mail);
      return { error: "old" };
    }
    if (row.code !== codeHash(mail, code)) {
      row.tries += 1;
      // Out of guesses: the row goes rather than sitting there being guessed
      // at. Asking again sends a new code, which is the cheap part.
      if (row.tries >= CODE_TRIES) {
        board.signins = board.signins.filter((v) => v.mail !== mail);
        return { error: "spent" };
      }
      return { error: "bad", left: CODE_TRIES - row.tries };
    }
    const mine = board.people.find((q) => q.mail === mail);
    /* THE QUEUE, IF NO MEMBER HAS IT — see the note on /api/signin. Their
       whole identity is `by` on one row, so putting them back is that one
       field and the waiting cookie, which the caller sets. */
    const waiting = mine ? null
      : board.waits.find((w) => !w.done && String(w.reach || "").trim().toLowerCase() === mail);
    // The address left the row while the code was in the air.
    if (!mine && !waiting) {
      board.signins = board.signins.filter((v) => v.mail !== mail);
      return { error: "bad" };
    }
    board.signins = board.signins.filter((v) => v.mail !== mail);
    if (waiting) {
      waiting.by = to;
      return { ok: true, handle: waiting.name || "", waiting: true };
    }
    store.rebind(board, mine.by, to);
    return { ok: true, handle: mine.handle || "" };
  });

  if (out?.error === "old") return res.status(410).json(out);
  if (out?.error === "spent") return res.status(429).json(out);
  if (out?.error) return res.status(401).json(out);

  /* THE COOKIE THAT MATCHES WHAT THEY ARE.
   *
   * A member gets board_in — the same one the door sets, and the reason a
   * signed-in browser is also an admitted one; see the note above OPEN_PATHS.
   * Somebody waiting gets board_wait, which is admission to nothing and is
   * only how /room finds their card again. Setting the member's cookie for
   * somebody on the list would let the queue in through the door. */
  if (out.waiting) setWaitCookie(res, to);
  else setCookie(res, to);
  res.json({ ok: true, key, handle: out.handle,
    // Where the page should take them: their card, or the board.
    where: out.waiting ? "/room" : "" });
});

/** My own card, which is mine to read whether or not anybody else may. */
app.get("/api/card", async (req, res) => {
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
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
  const me = hashDevice(String(req.body?.device || ""), SALT);
  if (!me) return res.status(400).json({ error: "no" });
  const out = await change((board) => {
    const was = board.cards.find((c) => c.by === me);
    /* THE CODE IS CARRIED, NOT RESENT. It is uploaded by its own route and is
       not in this form, so building the row from the request alone would have
       every save of the two text fields quietly delete the picture. */
    const row = store.cleanCard({
      by: me, wechat: req.body?.wechat, line: req.body?.line, qr: was?.qr,
    });
    const i = board.cards.findIndex((c) => c.by === me);
    // An empty card is a deleted card. Anybody it was given to stops being
    // able to read anything, which is the same as taking it back from all of
    // them at once and is the only bulk revoke there is.
    if (!row.wechat && !row.line && !row.qr) {
      if (i >= 0) board.cards.splice(i, 1);
      return null;
    }
    if (i >= 0) board.cards[i] = row; else board.cards.push(row);
    return row;
  });
  res.json({ card: out });
});

/* THE CODE ITSELF, uploaded by its owner.
 *
 * Its own route rather than a field on the card, because it arrives as a
 * picture and pictures do not travel in the same request as a WeChat id
 * without the id form growing a 36MB body limit.
 *
 * NOT HELD FOR REVIEW, unlike a face. A face is held because it goes on a
 * public browser and cannot be taken back once somebody has saved it; a code
 * is shown to nobody except the person its owner handed a card to, and holding
 * it would mean a deal is agreed and the way to carry it on is in a queue. */
app.post("/api/card/qr", express.json({ limit: "36mb" }), gate, async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  if (!me) return res.status(400).json({ error: "no" });
  const data = String(req.body?.qr || "");

  // An empty body clears it, which is how somebody takes their code back
  // without deleting the whole card.
  if (!data) {
    const out = await change((board) => {
      const i = board.cards.findIndex((c) => c.by === me);
      if (i < 0) return { qr: "" };
      board.cards[i] = store.cleanCard({ ...board.cards[i], qr: "" });
      return { qr: "" };
    });
    return res.json(out);
  }

  const buf = Buffer.from(data, "base64");
  if (buf.length > MEDIA_MAX) return res.status(413).json({ error: "tooBig" });
  const id = await putMedia(buf, String(req.body?.qrType || ""));
  if (!id) return res.status(415).json({ error: "badType" });

  const out = await change((board) => {
    const i = board.cards.findIndex((c) => c.by === me);
    if (i >= 0) board.cards[i] = store.cleanCard({ ...board.cards[i], qr: id });
    // A code with nothing else on the card is still a card — it is the one
    // half of a handover that works on its own.
    else board.cards.push(store.cleanCard({ by: me, qr: id }));
    return { qr: id };
  });
  res.json(out);
});

/** Hand it to one person, or take it back from them. */
app.post("/api/card/give", express.json({ limit: "4kb" }), gate, async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const who = String(req.body?.who || "");
  const on = req.body?.on !== false;
  const note = String(req.body?.note || "").slice(0, 200);
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
    /* A line given back with the card, and never quietly dropped. Giving again
       after taking it back may carry a new one; giving again with the box left
       empty keeps whatever was said the first time, because the alternative is
       a press that silently erases something the other side has already read. */
    if (i >= 0) {
      board.grants[i] = store.cleanGrant({
        ...board.grants[i], off: !on, note: note || board.grants[i].note,
      });
    } else if (on) board.grants.push(store.cleanGrant({ by: me, who, note }));
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
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
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
      /* THEIR SENTENCE, so the shelf can print the same two pills Browse
         prints instead of a paragraph describing them — see drawCards. Only
         the pair, never anything else off the row. */
      say: Array.isArray(q.say) ? q.say.map((r) => ({ me: r.me, want: r.want })) : [],
      shared: st.shared,
      gave: st.gave,
      given: st.given,
      card: st.card,
      note: st.note,
    });
  }
  /* MY OWN CARD, not just whether I have one. The screen that offers to hand
     it over has to be able to show what it is about to send: a button that
     sends your contact details without naming them is a button people press
     once and then go looking for a way to undo. */
  const own = board.cards.find((c) => c.by === me) || null;
  res.json({
    matches: rows,
    card: Boolean(own),
    mine: own ? { wechat: own.wechat, line: own.line, qr: own.qr } : null,
  });
});

/* ---------------------------------------------------------------------------
 * Offers: the one thing here that works on somebody who is not a member
 *
 * See cleanOffer in store.js for what an offer is and is not. This is how it
 * travels: a member writes one, gets an address back, and pastes that address
 * into WeChat. Whoever taps it can read it without a code, because requiring
 * a code to read an offer would mean requiring somebody to join a room before
 * they can see the work you are offering them, which is the wrong way round.
 *
 * ACCEPTING WRITES AN INVITE. Not a second way in — the same one. admitted()
 * reads board.invites and knows nothing about offers, and it stays that way:
 * an accepted offer mints a row there marked used by the person who took it,
 * carrying the name of whoever sent it. So `make invites` reads as who brought
 * whom whether they came in on a bare code or on a piece of work, and there is
 * exactly one place in this server that decides whether somebody is inside.
 * ------------------------------------------------------------------------- */

/** What an offer looks like to whoever opens the link. Never the device hash
 *  of either party, and never the note-to-self name the sender typed. */
const shownOffer = (o, board) => {
  const from = board.people.find((q) => q.by === o.by && q.state === "published");
  return {
    code: o.code, kind: o.kind || "job",
    give: o.give, money: o.money, want: o.want, at: o.at,
    // Who is offering, as a person rather than as a hash — a name and their
    // sentence, so somebody deciding has the same context a member would.
    from: from ? { handle: from.handle, say: from.say || [], campus: from.campus || "" } : null,
    taken: Boolean(o.tookAt), takenAt: o.tookAt, takenName: o.name,
    off: Boolean(o.off),
  };
};

/** Write one. Members only — an offer is somebody in the room reaching out of
 *  it, and both halves of that matter. */
app.post("/api/offer", express.json({ limit: "8kb" }), gate, async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  if (!me) return res.status(400).json({ error: "no" });
  const out = await change((board) => {
    if (!board.people.some((q) => q.by === me && q.state === "published")) {
      // The same rule the rest of the board runs on: everything hangs off a
      // person row, so somebody with no page cannot offer anybody anything.
      return { error: "nopage" };
    }
    const have = codesTaken(board);
    let code = store.newCode();
    while (have.has(code)) code = store.newCode();
    const row = store.cleanOffer({ ...req.body, code, by: me, at: new Date().toISOString() });
    if (!row) return { error: "empty" };
    board.offers.push(row);
    return { code: row.code };
  });
  if (out?.error) return res.status(out.error === "nopage" ? 403 : 400).json(out);
  res.json(out);
});

/* AN ADDRESS PUT ON A MEMBER'S ROW FROM THE BOX.
 *
 * Signing in by email matches an address on a person's row, and the only way
 * to get one there was to be signed in already — which is fine for everybody
 * except the person who is locked out, who is the only person who needs it.
 * The way back code solves that in one direction and leaves a second errand
 * behind it: get in, find the settings, type the address, and only then is
 * next time easy.
 *
 * This removes the errand. The operator writes the address, the person opens
 * the door and asks for six digits, and no key is ever handed round. It is the
 * same authority as minting a way back — somebody who can see the board saying
 * this row is that person — and it is less power than that one, because an
 * address on a row opens nothing on its own.
 *
 * An empty ADDR clears it, which is how somebody asks to be forgotten by mail
 * without deleting themselves.
 */
app.post("/api/admin/mail", admin, express.json({ limit: "2kb" }), async (req, res) => {
  const who = String(req.body?.who || "").trim().toLowerCase();
  const mail = String(req.body?.mail || "").trim().toLowerCase();
  if (!who) return res.status(400).json({ error: "who" });
  if (mail && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(mail)) {
    return res.status(400).json({ error: "bad" });
  }
  const out = await change((board) => {
    const q = board.people.find((x) => String(x.handle || "").toLowerCase() === who);
    if (!q) return { error: "nobody" };
    /* ONE ADDRESS, ONE PERSON. Two rows carrying the same address would make
       the sign-in ambiguous, and it resolves ambiguity by picking one — which
       is the wrong thing to do with somebody's way back in. */
    if (mail && board.people.some((x) => x !== q && x.mail === mail)) {
      return { error: "taken" };
    }
    q.mail = mail;
    return { handle: q.handle || "", mail };
  });
  if (out?.error === "nobody") return res.status(404).json(out);
  if (out?.error) return res.status(409).json(out);
  res.json(out);
});

/* A MEMBER'S WAY BACK IN, MINTED FROM THE BOX.
 *
 * `admin`, because it is the operator's job: the person who needs it cannot
 * prove who they are — that is the whole problem — so somebody who can see the
 * board has to say "this row is yours" out loud. Exactly what a door code is,
 * pointed at a person who is already inside rather than at an empty seat.
 *
 * It takes a handle, like every other operator route here, because a handle is
 * what the operator can read and type. One live code per row: minting a second
 * replaces the first, so a code sent last week stops working the moment a new
 * one is sent, and there is never a drawer of old ones behind a person.
 *
 * No expiry field. It is spent on first use and it is sent to one person
 * directly; a deadline on top would mean the operator explaining to somebody
 * locked out that the thing that unlocks them has also expired.
 */
app.post("/api/admin/back", admin, express.json({ limit: "2kb" }), async (req, res) => {
  const who = String(req.body?.who || "").trim().toLowerCase();
  if (!who) return res.status(400).json({ error: "who" });
  const out = await change((board) => {
    const q = board.people.find((x) => String(x.handle || "").toLowerCase() === who);
    if (!q) return { error: "nobody" };
    const have = codesTaken(board);
    let code = store.newCode();
    while (have.has(code)) code = store.newCode();
    q.back = code;
    return { code, handle: q.handle || "" };
  });
  if (out?.error) return res.status(404).json(out);
  res.status(201).json(out);
});

/* THE SAME THING FROM THE BOX.
 *
 * The route above needs the sender's device hash, which lives in one browser's
 * localStorage and which the person running this server has no way to type. So
 * the operator's version takes a handle instead and looks the member up — the
 * offer is still from a named person with a page, because an offer from nobody
 * is not something anybody should be able to make.
 *
 * `admin` rather than `gate`: this is the key the box already holds, and it is
 * how every other operator route on this server is authenticated. */
app.post("/api/admin/offer", admin, express.json({ limit: "8kb" }), async (req, res) => {
  const from = String(req.body?.from || "").trim().toLowerCase();
  if (!from) return res.status(400).json({ error: "from" });
  const out = await change((board) => {
    const q = board.people.find((x) => x.state === "published"
      && String(x.handle || "").toLowerCase() === from);
    if (!q) return { error: "nobody" };
    const have = codesTaken(board);
    let code = store.newCode();
    while (have.has(code)) code = store.newCode();
    const row = store.cleanOffer({ ...req.body, code, by: q.by, at: new Date().toISOString() });
    if (!row) return { error: "empty" };
    board.offers.push(row);
    return { code: row.code, from: q.handle };
  });
  if (out?.error) return res.status(out.error === "nobody" ? 404 : 400).json(out);
  res.status(201).json(out);
});

/** Who may make one. Operator only, one person at a time, on purpose — see
 *  canOffer in store.js for why this is not derived from somebody's role. */
app.post("/api/admin/can-offer", admin, express.json({ limit: "2kb" }), async (req, res) => {
  const who = String(req.body?.who || "").trim().toLowerCase();
  const on = req.body?.on !== false;
  if (!who) return res.status(400).json({ error: "who" });
  const out = await change((board) => {
    /* A HANDLE IS NOT UNIQUE ON THIS BOARD, and this refuses rather than
       guesses. The first version matched the first row with the name, set the
       flag on one nobody was using, and reported success — the member then
       looked for a button that was never going to be drawn, and the only
       thing wrong was invisible from both ends.
       Preferring the published row was not enough either: two published rows
       can share a name, and then a preference is still a guess. So an
       ambiguous name is an error that names the candidates, and --id settles
       it. Nothing here is urgent enough to be worth being wrong quietly. */
    const all = board.people.filter((x) => String(x.handle || "").toLowerCase() === who);
    const id = String(req.body?.id || "");
    const q = id ? all.find((x) => x.id === id)
      : all.length === 1 ? all[0] : null;
    if (!q && all.length > 1) {
      return { error: "which", rows: all.map((x) => ({ id: x.id, state: x.state, canOffer: Boolean(x.canOffer) })) };
    }
    if (!q) return { error: "nobody" };
    q.canOffer = on;
    Object.assign(q, store.cleanPerson(q));
    return { handle: q.handle, canOffer: q.canOffer, state: q.state, rows: all.length };
  });
  if (out?.error) return res.status(out.error === "which" ? 409 : 404).json(out);
  res.json(out);
});

/** Who currently may make one. So "it is not showing" has an answer that is
 *  not a guess about caches. */
app.get("/api/admin/can-offer", admin, async (_req, res) => {
  const board = await store.load(FILE);
  res.json({
    people: board.people
      .filter((q) => q.handle)
      .map((q) => ({ handle: q.handle, state: q.state, canOffer: Boolean(q.canOffer) })),
  });
});

/** Every offer and what became of it. For the person who sent them. */
app.get("/api/admin/offer", admin, async (_req, res) => {
  const board = await store.load(FILE);
  const name = (by) => (board.people.find((q) => q.by === by) || {}).handle || "";
  res.json({
    offers: board.offers.map((o) => ({
      code: o.code, kind: o.kind || "job", who: o.who, from: name(o.by),
      give: o.give, money: o.money,
      at: o.at, takenBy: o.name, takenAt: o.tookAt, off: o.off,
    })),
  });
});

/** Read one. No gate, on purpose — this is the whole point of the thing. */
app.get("/api/offer", async (req, res) => {
  const code = store.cleanCode(req.query?.code);
  res.set("Cache-Control", "no-store");
  if (!code) return res.status(400).json({ error: "no" });
  const board = await store.load(FILE);
  const o = board.offers.find((x) => x.code === code);
  if (!o) return res.status(404).json({ error: "gone" });
  res.json({ offer: shownOffer(o, board) });
});

/** Take it. Records the deal, and puts them on the list — not through the
 *  door.
 *
 *  IT USED TO LET THEM STRAIGHT IN, and that was wrong twice over.
 *
 *  A link is a bearer token. This one is built to be pasted into a chat, which
 *  is exactly where things get forwarded — so an offer addressed to one person
 *  admitted whoever opened it first. The invite code has the same shape and
 *  gets away with it because nobody designed it to travel.
 *
 *  And the claims are not the same size. A member making an offer is saying "I
 *  want this done"; a member vouching is saying "I know this person". An agent
 *  offering work to a performer she found on Instagram has said the first and
 *  nothing like the second, and this room is worth being in precisely because
 *  nobody walks in.
 *
 *  So accepting does the thing that has to be immediate — the deal is on the
 *  record, with their name and the date — and puts them in the queue with the
 *  offer attached and the sender named. That is the strongest position anybody
 *  can be in on that list, and letting them through stays one deliberate press
 *  by a member, which is the whole design. */
app.post("/api/offer/take", express.json({ limit: "4kb" }), async (req, res) => {
  const code = store.cleanCode(req.body?.code);
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const name = String(req.body?.name || "").trim().slice(0, 60);
  /* A WAY TO REACH THEM, and it is not an extra hurdle bolted on. They are
     going onto a list rather than into the room, so the person who offered
     them work needs to be able to answer them — and somebody who has just
     accepted a job is the one person who will hand over a WeChat id without
     being persuaded. */
  const reach = String(req.body?.reach || "").trim().slice(0, 80);
  if (!code || !me || !name || !reach) return res.status(400).json({ error: "no" });

  const out = await change((board) => {
    const o = board.offers.find((x) => x.code === code);
    if (!o) return { error: "gone" };
    if (o.off) return { error: "off" };
    if (o.tookAt) return o.tookBy === me ? { ok: true, mine: true } : { error: "taken" };
    if (o.by === me) return { error: "yours" };

    o.tookBy = me;
    o.tookAt = new Date().toISOString();
    o.name = name;

    // Already a member: nothing to queue for. The deal is recorded and that is
    // the whole of it.
    if (board.people.some((q) => q.by === me && q.state === "published")) {
      return { ok: true, member: true };
    }

    const from = board.people.find((q) => q.by === o.by);
    const at = board.waits.findIndex((w) => w.by === me && !w.done);
    const row = store.cleanWait({
      name, reach, by: me,
      /* THE REASON WRITES ITSELF, and it is a better one than anybody types
         into that box. "Accepted an offer from Mia" is a fact a member can
         check against their own sent offers. */
      why: (from ? from.handle + " offered: " : "Offered: ") + o.give,
      via: from ? from.id : "",
      // They came through a named member's offer and are waiting to be let in
      // by one. Being invisible would leave nobody able to decide.
      shown: true,
      at: o.tookAt,
    });
    if (!row) return { error: "no" };
    if (at >= 0) board.waits[at] = { ...board.waits[at], ...row, id: board.waits[at].id };
    else board.waits.push(row);
    return { ok: true, waiting: true };
  });

  if (out?.error) {
    return res.status(out.error === "gone" ? 404 : 409).json(out);
  }
  // The waiting cookie, not the admission one — so a browser that forgets
  // itself can still find its own row. Being on the list is not being in.
  if (out?.waiting) setWaitCookie(res, me);
  res.json(out);
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

/* HOW MANY LINES AN ACCEPTED OFFER IS WORTH, per side.
 *
 * Not every offer is a day's work. A job is a date and a number and needs no
 * conversation at all; a project — a film next spring, a band, a company — is
 * a conversation before either of those exists, and two messages is not enough
 * to have it in.
 *
 * Six, because six is enough to settle dates, money and language and is not
 * enough to live in. The number is the whole design: an uncapped thread makes
 * this a messaging service, which in this country is a different kind of
 * business with a different set of duties, and a two-line one pushes people
 * onto WeChat before they have decided the other is worth a WeChat id.
 *
 * WHAT HAPPENS WHEN THEY RUN OUT IS NOT A WALL. The card is already open —
 * accepting is what opened it — so the end of the lines is the moment the
 * handover stops being a button somebody has to think about and becomes the
 * obvious next thing. */
const OFFER_LINES = Math.max(1, Number(process.env.BOARD_OFFER_LINES || 6));

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
/** Whether these two are a member and somebody that member wrote a note to.
 *  Either way round, and only while the person is still waiting: once they are
 *  let in they are an ordinary member and the ordinary rules apply to them,
 *  which is the right moment for this to stop being special. */
function writePair(board, me, them) {
  const pair = (a, b) => board.waits.some((w) => w.by === b && !w.done && w.fromWrite
    && board.writes.some((x) => x.id === w.fromWrite && x.by === a));
  if (!me || !them) return false;
  // Nobody who has a page of their own is "waiting" — see the note above.
  const aMember = board.people.some((q) => q.by === me);
  const bMember = board.people.some((q) => q.by === them);
  if (aMember && !bMember) return pair(me, them);
  if (bMember && !aMember) return pair(them, me);
  return false;
}

function threadState(board, me, them) {
  /* BLOCKED EITHER WAY CLOSES THE THREAD, and the two readings differ.
     Reading this as the blocker, the conversation is gone. Reading it as the
     person blocked, the conversation is ALSO gone — and it has to be, because
     the alternative is a thread that looks open and swallows every message
     sent into it, which is worse for them than being told nothing. Neither is
     told which of the two happened, and "shut" is what both are called: a
     person who can tell a block from somebody leaving has been told they were
     blocked. */
  /* TWO KINDS OF NAME IN ONE TEST, which is what made the first version of
     this do nothing. A block row is (by: device hash, who: PERSON ID) —
     `who` is an id because a handle is something people can change and a block
     they can rename their way out of is not one. threadState works in device
     hashes on both sides. So `x.who === them` was comparing an id to a hash
     and never matched: Browse filtered correctly, messages did not, and the
     half that was broken is the half that matters most.
     Resolved through the rows, both directions, and it covers an agent's
     people too — a represented person is their own row with their own id. */
  const idsOf = (by) => board.people.filter((q) => q.by === by).map((q) => q.id);
  const mineIds = idsOf(me), theirIds = idsOf(them);
  if (board.blocks.some((x) => (x.by === me && theirIds.includes(x.who))
    || (x.by === them && mineIds.includes(x.who)))) {
    return { can: false, why: "shut", open: false };
  }
  if (board.shuts.some((x) => (x.by === me && x.who === them)
    || (x.by === them && x.who === me))) {
    return { can: false, why: "shut", open: false };
  }
  const notes = board.notes;
  const between = notes.filter(
    (n) => (n.by === me && n.to === them) || (n.by === them && n.to === me));

  /* AN ACCEPTED OFFER, IF THERE IS ONE. Found before either branch below,
     because what it supplies to each of them is different: to a matched pair
     it supplies the terms to pin over the conversation, and to two people who
     have not matched it supplies the conversation itself.

     Read from board.offers rather than passed in, for the same reason
     matched() is: nothing can claim a deal by asserting one. Either direction
     counts — whoever sent it and whoever took it are in the same conversation
     — and a withdrawn offer is not one, though an accepted offer can no longer
     be withdrawn. */
  const deal = board.offers.find((o) => o.tookAt && !o.off
    && ((o.by === me && o.tookBy === them) || (o.by === them && o.tookBy === me)));

  /* SOMEBODY WHO WAS WRITTEN TO, AND THE MEMBER WHO WROTE.
   *
   * Checked before the match and before the two-message rule, because neither
   * applies: one of these two is not a member at all, so there is nobody to
   * match with and no profile to follow. What there is, is a member who wrote
   * a note by name and a person who answered it — which is a conversation
   * somebody deliberately started, and the only one this person can have.
   *
   * It stays open while they wait. That is the point: the queue used to be a
   * form and a silence, and it is now the person who invited you, in a
   * messenger, able to ask you something before they vouch.
   *
   * ONE MEMBER AND ONE PERSON, and no other pair. A waiting person asking
   * about anybody else on this board falls through to the rules below and is
   * refused there, which is where it has always been decided.
   */
  const wrote = writePair(board, me, them);
  if (wrote) {
    const last = between[between.length - 1];
    return {
      can: true, open: true, why: "wrote",
      answering: last && last.to === me ? last.id : "",
      deal: deal ? deal.code : "",
    };
  }

  /* MATCHED: an open thread. Still not a free channel — the same daily count
     applies, so a matched pair is a conversation and not a firehose, and the
     other person can leave at any point in it.

     NO COUNT ON IT, even where there is a deal. The cap below exists to keep a
     thread between two people who have agreed to nothing from becoming an
     inbox; a match is the thing that says they have agreed to talk, and taking
     lines off them for having also agreed to a piece of work would be exactly
     backwards. The terms still come with it — those are worth having over any
     conversation about the work they describe. */
  if (matched(board, me, them)) {
    const last = between[between.length - 1];
    return {
      can: true, open: true, why: "open",
      // An answer rather than a new introduction when they spoke last: it is
      // what keeps the daily count off a running conversation.
      answering: last && last.to === me ? last.id : "",
      deal: deal ? deal.code : "",
    };
  }

  /* AN ACCEPTED OFFER OPENS A COUNTED THREAD.
   *
   * Above the two-message rule, because two messages is the cap for people who
   * have agreed to nothing, and these two have agreed to a piece of work with
   * a name and a date on it. Not every offer is a day's work: a project is a
   * conversation before the money exists, and this is where it happens.
   *
   * Six lines each and then it stops — see OFFER_LINES. Running out is not a
   * wall: accepting is what opened the card, so the end of the lines is where
   * the handover stops being a button somebody has to think about. */
  if (deal) {
    // Counted per side, so one person cannot spend the other's lines.
    const sent = between.filter((n) => n.by === me).length;
    const left = Math.max(0, OFFER_LINES - sent);
    return {
      can: left > 0, open: true, why: left > 0 ? "deal" : "spent",
      left, cap: OFFER_LINES, deal: deal.code,
      answering: "",
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
/* ---------------------------------------------------------------------------
 * BEING TOLD SOMETHING ARRIVED
 *
 * The board has never had a way to reach anybody. Somebody writes, the other
 * person is not looking at the tab, and that is the end of it — which is the
 * whole reason a messenger with real people in it can still feel empty.
 *
 * Three routes and no new concept: the browser asks for the key, subscribes
 * itself with its own push service, and hands back a URL to buzz. Nothing is
 * ever sent through it but the buzz; see lib/push.js.
 *
 * DARK WITHOUT A KEYPAIR. /api/push/key answers with nothing, and the switch
 * does not appear. A permission prompt on a board that cannot send is worse
 * than no feature at all: browsers remember a refusal and will not ask again,
 * so one pointless prompt today costs the real one for ever.
 */
/* ---------------------------------------------------------------------------
 * BLOCKING SOMEBODY
 *
 * One way, silent, and undoable by the person who did it. See cleanBlock in
 * store.js for why this stopped being a localStorage set and what the
 * difference is between this and a shut.
 *
 * `who` is a person id and not a handle. The old browser list keyed on
 * handles, which is what somebody can change: block a handle and they rename
 * themselves and they are back. An id is the row.
 */
app.post("/api/block", express.json({ limit: "8kb" }), gate, async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  if (!me) return res.status(400).json({ error: "no" });
  const on = req.body?.on !== false;
  /* An array, because the first thing this has to do on a browser that has
     never sent one is hand over whatever that browser blocked before the list
     moved to the server. One request, not eleven. */
  const want = Array.isArray(req.body?.who) ? req.body.who : [req.body?.who];
  const ids = [...new Set(want.map(String).filter((x) => /^[a-f0-9]{20}$/.test(x)))].slice(0, 200);
  if (!ids.length) return res.status(400).json({ error: "bad" });

  const out = await change((board) => {
    const mine = board.people.filter((q) => q.by === me).map((q) => q.id);
    for (const who of ids) {
      // Blocking yourself is a mistake, not a wish.
      if (mine.includes(who)) continue;
      const had = board.blocks.findIndex((x) => x.by === me && x.who === who);
      if (on && had < 0) board.blocks.push(store.cleanBlock({ by: me, who }));
      if (!on && had >= 0) board.blocks.splice(had, 1);
    }
    return { n: board.blocks.filter((x) => x.by === me).length };
  });
  res.json({ ok: true, blocked: out.n });
});

/** Who this reader has blocked, so the page can draw the list and unblock from
 *  it. Theirs alone — there is no route here that says who blocked anybody. */
app.get("/api/blocks", async (req, res) => {
  const board = await store.load(FILE);
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
  res.set("Cache-Control", "no-store");
  if (!me) return res.json({ blocks: [] });
  const mine = board.blocks.filter((x) => x.by === me);
  res.json({
    blocks: mine.map((x) => {
      const q = board.people.find((p) => p.id === x.who);
      return { who: x.who, handle: (q && q.handle) || "", at: x.at };
    }),
  });
});

app.get("/api/push/key", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ key: push.publicKey() });
});

app.post("/api/push/on", express.json({ limit: "8kb" }), gate, async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  if (!me) return res.status(400).json({ error: "no" });
  if (!push.configured()) return res.status(503).json({ error: "off" });
  const sub = push.cleanSub(req.body?.sub);
  if (!sub) return res.status(400).json({ error: "bad" });
  await change((board) => {
    board.pushes = board.pushes || [];
    /* KEYED ON THE ENDPOINT, NOT THE DEVICE. A browser rotates its endpoint
       and re-subscribes; a member signs in on a second phone. Both are one row
       each, and the same endpoint arriving twice is the same phone. */
    const had = board.pushes.find((x) => x.endpoint === sub.endpoint);
    if (had) { had.by = me; had.keys = sub.keys; return { ok: true }; }
    const row = store.cleanPush({ by: me, ...sub });
    if (row) board.pushes.push(row);
    return { ok: true };
  });
  res.json({ ok: true });
});

app.post("/api/push/off", express.json({ limit: "8kb" }), gate, async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  if (!me) return res.status(400).json({ error: "no" });
  const endpoint = String(req.body?.endpoint || "");
  await change((board) => {
    board.pushes = (board.pushes || []).filter((x) => (
      /* Their own row and no other. An endpoint is not a secret — it arrives
         from the browser — so a request to forget one may only forget a row
         belonging to the device asking. Without the `by` test this is a route
         for turning off somebody else's notifications. */
      !(x.by === me && (!endpoint || x.endpoint === endpoint))));
    return { ok: true };
  });
  res.json({ ok: true });
});

app.post("/api/note", notesOff, express.json({ limit: "16kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const who = String(req.body?.who || "");
  const text = String(req.body?.text || "").trim().slice(0, 600);
  const re = String(req.body?.re || "");
  if (!me) return res.status(400).json({ error: "no" });
  if (!text) return res.status(400).json({ error: "empty" });
  /* TWO SHAPES OF ADDRESS. A person id, which is every member; and "w:<id>",
     which is somebody on the list a member wrote to — they have no profile and
     therefore no person id, and the member still has to be able to answer
     them. Nothing else is accepted. */
  if (!/^(?:[a-f0-9]{20}|w:[a-f0-9]{20})$/.test(who)) {
    return res.status(400).json({ error: "gone" });
  }

  const out = await change((board) => {
    const target = who.startsWith("w:")
      ? (() => {
          const w = board.waits.find((x) => x.id === who.slice(2) && !x.done && x.fromWrite);
          // Shaped like a person for the checks below, and deliberately
          // without an id: there is no page and nothing to open.
          return w && w.by ? { id: "", by: w.by, handle: w.name, state: "published" } : null;
        })()
      : board.people.find((x) => x.id === who && x.state === "published");
    // The same answer for a person who does not exist and one who has taken
    // themselves down, so this cannot be used to ask which ids are real.
    if (!target) return { error: "gone" };
    if (target.by === me) return { error: "self" };

    /* YOU NEED A PROFILE TO WRITE TO SOMEBODY. Not a rule for its own sake:
       an introduction from a name that does not exist is not one, and the
       person receiving it has nothing to decide about.
       EXCEPT THE PERSON A MEMBER WROTE TO. They have no profile by
       definition — they are on the list — and they are not introducing
       themselves to a stranger; they are answering somebody who wrote to them
       by name and knows exactly who they are. Their name is on the waiting
       row, which is what the member reads. Any other pair still needs one,
       and writePair is false for every other pair. */
    const mine = board.people.find((q) => q.by === me);
    if ((!mine || !mine.handle) && !writePair(board, me, target.by)) {
      return { error: "profile" };
    }

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

  /* AND THEN THE PHONE, AFTER THE ANSWER HAS ALREADY GONE BACK.
   *
   * Deliberately not awaited. The sender is watching their own message appear;
   * a push service having a slow afternoon must not be something they wait
   * for, and whether the other person's phone buzzed is not an outcome the
   * sender is entitled to know anyway.
   *
   * Nothing is sent WITH it — see lib/push.js. The buzz says a message
   * arrived; who and what are behind the door, where they belong. */
  tellThem(out.note.to).catch(() => { /* a push that failed is a push that did not arrive */ });
});

/** Buzz every device a member has turned this on for, and drop the ones the
 *  browser has thrown away. Never throws. */
async function tellThem(to) {
  if (!push.configured() || !to) return;
  const board = await store.load(FILE);
  const subs = (board.pushes || []).filter((x) => x.by === to);
  if (!subs.length) return;
  const dead = await push.tell(subs);
  if (!dead.length) return;
  /* A SEPARATE WRITE, AND ONLY WHEN THERE IS SOMETHING TO FORGET. An
     uninstalled app or a cleared site leaves an endpoint that will 410 for
     ever; kept, it is one doomed request per message per dead phone. */
  const gone = new Set(dead);
  await change((b) => {
    b.pushes = (b.pushes || []).filter((x) => !gone.has(x.endpoint));
    return { ok: true };
  });
}

/* Mine, both directions.
 *
 * The device id travels in a header rather than the query, because a query
 * string is the part of a request that ends up in logs and referrers. */
app.get("/api/notes", notesOff, async (req, res) => {
  const board = await store.load(FILE);
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
  res.set("Cache-Control", "no-store");
  if (!me) return res.json({ notes: [], unread: 0 });

  // Whose it is, in the only terms a reader can use: a name and a face. The
  // device hash on either end never leaves this function.
  const name = (hash) => {
    const q = board.people.find((x) => x.by === hash);
    if (q) {
      return { who: q.id, handle: q.handle,
               photo: q.photoState === "published" ? q.photo : "" };
    }
    /* SOMEBODY ON THE LIST WHO WAS WRITTEN TO. They have no profile — that is
       what being on the list means — so this used to answer with an empty
       name, and the member's own inbox showed a conversation with nobody. The
       waiting row carries the name they gave when they answered, which is the
       name the member is deciding about. `who` stays empty: there is no page
       to open, and the thread is addressed by it, so it is filled below. */
    const w = board.waits.find((x) => x.by === hash && !x.done && x.fromWrite);
    if (w) return { who: "w:" + w.id, handle: w.name, photo: "", onList: true };
    return { who: "", handle: "", photo: "" };
  };

  /* THE STATE OF EACH THREAD, WORKED OUT ONCE PER PERSON rather than once per
     message: it is a fact about the two of you, and asking it again for every
     line of a conversation is both wasteful and a way for two lines of the
     same thread to disagree. */
  /* The offer a thread hangs on, in the words both of them already read on the
     page where it was accepted. Never the codes or hashes around it. */
  const terms = (code) => {
    const o = board.offers.find((x) => x.code === code);
    return o ? { kind: o.kind || "job", give: o.give, money: o.money, at: o.tookAt } : undefined;
  };

  const rows0 = store.notesFor(board.notes, me);
  const other = (n) => (n.by === me ? n.to : n.by);
  /* A CONVERSATION YOU LEFT IS OFF YOUR LIST.
   *
   * Leaving has always meant the thread closes for both of you and what was
   * said stays said — it does not erase anything, and it should not. But the
   * row stayed in the list of the person who left it, closed, for ever: a
   * swipe that clears a row and then leaves the row there is a gesture that
   * looks broken.
   *
   * Only for the one who left. If they walked out, you still see it, closed,
   * because that is a thing that happened to you and hiding it would be the
   * app deciding what you are allowed to notice.
   */
  const iLeft = new Set(board.shuts.filter((x) => x.by === me).map((x) => x.who));
  const rows = rows0.filter((n) => !iLeft.has(other(n)));
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
      /* AND WHICH KIND OF SHUT IT IS, when it is shut. The page was choosing
         between two sentences off `open` alone, so a thread that had used up
         its one message each was told to "carry on where you swapped" —
         advice about a swap that had never happened. Four states, four
         answers; threadState already knows which. */
      why: st.why || "",
      /* HOW MANY LINES ARE LEFT, on a thread an offer opened. Shown rather
         than discovered: a box that refuses the seventh message without ever
         having said there were six is a bug the person blames on themselves. */
      left: st.cap ? st.left : undefined,
      cap: st.cap || undefined,
      /* WHAT WAS AGREED, ABOVE THE TALK. The reason to type in here at all
         rather than in WeChat — the terms sit over the conversation and cannot
         scroll away from either of them. */
      deal: st.deal ? terms(st.deal) : undefined,
      last: String(n.at) === newest.get(other(n)),
    };
  });

  /* THE READER'S OWN FACE, for the lines the reader wrote.
     Every row carried the other person's face, including the ones you sent —
     so a thread read as one person talking to themselves, the same initial
     twice down the page. The name on the line was right ("You wrote to Wei")
     and the picture beside it contradicted it, which is the kind of small
     wrongness that makes a screen feel broken without anybody being able to
     say why. Sent once rather than per row: it is the same person on every
     one of them. */
  /* WHO YOU CAN WRITE TO, AND THE REASON THE INBOX IS NOT A DEAD END.
   *
   * Messages could only ever be REPLIED to. Starting one meant remembering a
   * name, finding the profile, and pressing hello there — so the tab, opened
   * by somebody with nothing in it, was a screen that said "no messages" and
   * offered no way to have any. An inbox you cannot write from is a mailbox.
   *
   * This is that list, and it invents no permission: it is exactly the people
   * threadState would already say yes to — matched (mutual follow, scope fits,
   * a room in common) or holding an accepted offer with you.
   *
   * The rule is still enforced where it always was. This list makes it
   * visible; /api/note decides. */
  const mine = board.people.find((q) => q.by === me);
  /* EVERYBODY YOU CAN WRITE TO, INCLUDING THE ONES YOU ALREADY HAVE.
   *
   * This used to subtract anybody with a thread, on the reasoning that their
   * conversation was on the page below. What that actually did was empty the
   * strip out exactly as somebody learned to use it: write to all three of
   * your matches and the row of faces disappears, and the one affordance that
   * says "these are the people you can reach" is gone at the moment it has
   * proved useful. Tom hit it on his own phone with three threads open.
   *
   * So it is the stories row it looks like: your people, always there, in one
   * place. The list underneath is your CONVERSATIONS, which is a different
   * question — the same person appearing in both is how every messenger with
   * a row of faces at the top already works.
   */
  let can = [];
  if (mine && mine.state === "published") {
    /* NARROWED BEFORE threadState IS ASKED. It walks the follows, the shuts
       and the offers for each pair, and asking it about every published row
       on the board to find the handful who can be written to is the same
       answer for a great deal more work. Everybody who qualifies either
       follows this person or has taken an offer with them, and both of those
       are one pass over a list that is already in memory. */
    const near = new Set();
    for (const f of board.follows) if (f.who === mine.id) near.add(f.by);
    for (const o of board.offers) {
      if (!o.tookAt || o.off) continue;
      if (o.by === me) near.add(o.tookBy);
      else if (o.tookBy === me) near.add(o.by);
    }
    for (const q of board.people) {
      if (!q.by || q.by === me || q.state !== "published" || !q.handle) continue;
      if (!near.has(q.by)) continue;
      const st = threadState(board, me, q.by);
      /* THE ROW IS YOUR PEOPLE, NOT YOUR PERMISSIONS.
       *
       * It was `if (!st.can) continue`, which is a different question and made
       * the strip disappear exactly when it had been used. An introduction is
       * one message until they answer — so writing to three people leaves
       * three faces that cannot be written to today, `can` goes false on all
       * of them, and the row of faces empties. Tom watched it happen on his
       * own phone with three threads open.
       *
       * Somebody you are connected to is still somebody you are connected to
       * while you wait for their answer. The one exclusion is a conversation
       * that ended: if either of you walked out, they are not your people any
       * more and the face would be an offer that goes nowhere.
       */
      if (st.why === "shut") continue;
      can.push({
        who: q.id, handle: q.handle, at: q.at,
        photo: q.photoState === "published" ? q.photo : "",
        // WHY they are on this list, because the three are not the same
        // conversation: a match is two people who both said yes, a deal is a
        // piece of work with a date on it, and `wait` is an introduction that
        // has been sent and not yet answered.
        why: st.deal ? "deal" : st.can || st.open ? "match" : "wait",
      });
    }
    /* A deal ahead of a match, and after that the most recent. A wall of faces
       is not a list of people to write to — twenty-four is already more than
       anybody works through, and the ones with a piece of work attached are
       the ones with something to say today. */
    /* Deals first, then people you can write to now, then the ones you are
       waiting on — and inside each, most recent. The order is what a thumb
       reads first, so it is the ones with something to do today. */
    const rank = { deal: 0, match: 1, wait: 2 };
    can.sort((x, y) => (rank[x.why] - rank[y.why])
      || String(y.at).localeCompare(String(x.at)));
    can = can.slice(0, 24).map(({ at, ...rest }) => rest);
  }

  /* SOMEBODY WHO IS NOT A MEMBER, READING THE ONE CONVERSATION THEY HAVE.
   *
   * A person a member wrote to lands here with a thread and nothing else —
   * no page, no Browse, no Cards. The page needs to know that, because the
   * other three tabs would send them to a door, and their own name comes off
   * the waiting row rather than a profile they do not have. */
  const wait = mine ? null
    : board.waits.find((w) => w.by === me && !w.done && w.fromWrite);
  res.json({
    notes,
    can,
    you: mine ? name(me) : { who: "", handle: (wait && wait.name) || "", photo: "" },
    waiting: Boolean(wait),
    unread: notes.filter((n) => !n.mine && !n.seen).length,
  });
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
  const me = hashDevice(String(req.body?.device || ""), SALT);
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
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
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
  const me = hashDevice(String(req.body?.device || ""), SALT);
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
  const me = hashDevice(String(req.body?.device || ""), SALT);
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
  const me = hashDevice(String(req.body?.device || ""), SALT);
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
  const me = hashDevice(String(req.body?.device || ""), SALT);
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
  const me = hashDevice(String(req.body?.device || ""), SALT);
  if (!me) return res.status(400).json({ error: "no" });
  /* ONE CONVERSATION, OR ALL OF THEM.
   *
   * It was all of them, always, because the page WAS the messages: everything
   * unread was on the screen the moment it loaded, so marking the lot was the
   * truth. The page is a list of people now, and a list whose unread marks
   * clear themselves the instant you look at the list is a list that cannot
   * tell you which of five conversations is the new one. So a thread being
   * opened says whose, and only that one is marked.
   * No `who` still means all of them — /p/<handle> and the notification both
   * open this page without one, and both of those really are "I have seen my
   * messages". */
  const who = String(req.body?.who || "");
  await change((board) => {
    /* A PERSON ID, NOT A DEVICE HASH. `who` is what every other route on this
       page takes — the public id on a row — and notes are keyed on the salted
       hash behind it. Resolving here rather than asking the browser for a hash
       it must never be told. */
    const them = who ? (board.people.find((x) => x.id === who) || {}).by : "";
    if (who && !them) return;
    for (const n of board.notes) {
      if (n.to !== me) continue;
      if (them && n.by !== them) continue;
      n.seen = true;
    }
  });
  res.json({ ok: true });
});

/* Somebody says a note should not have been sent.
 *
 * This is the only route that puts a private message in front of the panel,
 * and only the person who received it can press it. */
app.post("/api/note/report", notesOff, express.json({ limit: "16kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
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
  const me = hashDevice(String(req.body?.device || ""), SALT);
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
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
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
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
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
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const who = String(req.body?.who || "");
  if (!me || !/^[a-f0-9]{20}$/.test(who)) return res.status(400).json({ error: "no" });
  const on = req.body?.on !== false;

  let why = "";
  const out = await change((board) => {
    const target = board.people.find((x) => x.id === who && x.state === "published");
    if (!target) return null;
    // Following yourself is not a thing anybody means to do.
    if (target.by === me) return { count: store.followersOf(board.follows, who), following: false };

    /* YOU CANNOT REACH FOR SOMEBODY WHILE YOU ARE A GHOST.
     *
     * Everybody arrives invited, lands on Browse, and can look at everybody
     * forever without ever being in it. On a board where the whole mechanic is
     * two people choosing each other, that is the failure mode: everybody
     * looking, nobody showing, and the people who did show wondering why the
     * room is empty.
     *
     * The rule is not a setup form. Asking somebody to write a bio for a room
     * they have not seen yet is how you lose them at the door, and the bios you
     * get that way are written to get past a screen. This is the board's own
     * logic instead: you can see them because they let themselves be seen.
     *
     * Only on following, never on reading. Looking is what they were invited
     * for; it is reaching that has to be mutual. And only on turning it ON —
     * unfollowing always works, because a rule that traps somebody in a follow
     * is a rule about them rather than about the room.
     *
     * A PERSON AN AGENT SPEAKS FOR PASSES. They are visible — on their agent's
     * page, with a card of their own — they are simply not in the Browse deck,
     * because only five of any agent's roster is (see RUN_SHOW). Without this
     * clause four of Andy's nine could never follow anybody, which is a cap on
     * a shared room turning into a punishment for the people it was protecting.
     */
    const mine = board.people.find((x) => x.by === me);
    const seen = mine && mine.state === "published" && mine.handle
      && (mine.looking || mine.runBy);
    if (on && !seen) { why = mine && mine.handle ? "hidden" : "nopage"; return null; }
    const had = board.follows.findIndex((f) => f.by === me && f.who === who);
    if (on && had < 0) board.follows.push(store.cleanFollow({ by: me, who }));
    if (!on && had >= 0) board.follows.splice(had, 1);
    return { count: store.followersOf(board.follows, who), following: on };
  });
  // Told apart, because they are different things to do next: one is a toggle
  // and the other is a name and a sentence.
  if (why) return res.status(409).json({ error: why });
  if (!out) return res.status(404).json({ error: "no such person" });
  res.json({ ok: true, ...out });
});

app.get("/api/person", async (req, res) => {
  const want = String(req.query.handle || "").toLowerCase();
  if (!want) return res.status(400).json({ error: "no" });
  const board = await store.load(FILE);
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
  const q = board.people.find((x) =>
    x.state === "published" && x.handle.toLowerCase() === want);
  if (!q) return res.json({ person: null });
  const live = board.posts.filter((p) => p.state === "published");
  res.set("Cache-Control", "no-store");
  res.json({
    person: {
      ...shownPerson(q, q.by === me),
      mine: q.by === me,
      speaksFor: speaksFor(board, q),
      roster: rosterOf(board, q),
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

/** A member's seat and share. Theirs only — never anybody else's.
 *
 *  NO LEADERBOARD, and that is a decision rather than an omission. A ranked
 *  list of who owns most of a private board turns every post into a play for
 *  position and every introduction into a trade — which is the behaviour this
 *  whole product exists to avoid. You see your own number and how many seats
 *  are left, which is everything you need to decide whether to work.
 *
 *  404 when the ledger is off, so a board with no promise attached has no
 *  screen for one either. */
app.get("/api/stake", async (req, res) => {
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT)
    || inCookie(req);
  const board = await store.load(FILE);
  res.set("Cache-Control", "no-store");
  const mine = shareOf(board, me);
  if (!mine) return res.status(404).json({ error: "off" });
  res.json(mine);
});

app.get("/api/me", async (req, res) => {
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
  let board = await store.load(FILE);
  res.set("Cache-Control", "no-store");
  let mine = me && board.people.find((q) => q.by === me);

  /* A BROWSER THAT FORGOT WHO IT WAS.
   *
   * Safari deletes a site's stored data after seven days without a visit. The
   * random number this browser identifies itself by lives there, so somebody
   * who made a page and did not come back for a week arrives with a brand new
   * id and no profile — while their profile, posts and matches sit on the
   * server under a hash nobody can produce any more. There is no password to
   * fall back on: that is the whole design.
   *
   * The admission cookie is the exception. The server set it, it is HttpOnly
   * and signed, it lasts a year, and Safari does not clear it the way it
   * clears the rest. It holds the same hash. So a browser presenting a valid
   * cookie for somebody who exists, together with a device id for somebody who
   * does not, is that person on a browser that forgot — and their rows move
   * onto the id they have now.
   *
   * Only in that direction, and only into an empty seat. A device that already
   * has a profile is that profile, cookie or no cookie; that check is what
   * stops a shared phone from swallowing somebody else's page. */
  if (!mine && me) {
    const was = inCookie(req);
    const there = was && was !== me && board.people.some((q) => q.by === was);
    if (there) {
      await change((b) => { store.rebind(b, was, me); return { ok: true }; });
      board = await store.load(FILE);
      mine = board.people.find((q) => q.by === me);
      // The cookie names the old hash and would rebind them again tomorrow.
      if (mine) setCookie(res, me);
    }
  }
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
    /* NO FLOOR IN HERE. The floor exists because "1 person is waiting" on a
       page anybody can read is nearly a name — a stranger reading it can
       match it against whoever just posted the link. Nobody inside is a
       stranger: they are already through the door, they cannot see the list,
       and the one inference available to them is about a person they invited
       themselves. What the floor costs in here is the whole point of the
       number — a queue of three that reads as no queue at all. */
    waiting,
    rank: rankOf(board, me),
    /* The half of the sentence they do not get to pick. Sent whether or not
       they have one: the page needs to know the difference between "fixed to
       producer" and "nobody ever asked", and an absent field says neither. */
    sayMe: roleFromWait(board, mine),
    // Whether the panel shows the offer block. The check that matters is
    // on POST /api/offer; this only decides whether a button is drawn.
    canOffer: Boolean(mine && mine.canOffer),
  });
});

app.put("/api/me", express.json({ limit: "36mb" }), gate, async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
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
  const shotOne = await shot(req.body?.shot, req.body?.shotType);
  if (face?.tooBig || back?.tooBig || shotOne?.tooBig) return res.status(413).json({ error: "tooBig" });
  if (face?.badType || back?.badType || shotOne?.badType) return res.status(415).json({ error: "badType" });

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
    /* THE CAP ON THE ROOM, and it is checked here because this is the one line
       on the whole server that puts somebody into Browse. /api/run/show is the
       button; this is the door it opens, and a cap enforced only at the button
       is a cap you get round by editing the profile instead. */
    if (q.looking && q.runBy && overShow(board, q.runBy, q.id)) q.looking = false;
    /* "li" takes 200 rather than 120: a LinkedIn share URL is long, and a save
       that truncated the link before cleanPerson could read the slug out of it
       would silently drop the field. */
    // Where the face sits in the frame. A number, so it is set apart from the
    // text fields below rather than being sliced to 120 characters.
    if (req.body.photoAt !== undefined) q.photoAt = Number(req.body.photoAt);
    for (const k of ["handle", "level", "campus", "goal", "trade", "here", "age", "type", "levelBand", "ig", "li"]) {
      if (req.body[k] !== undefined) {
        q[k] = String(req.body[k]).slice(0, k === "goal" ? 600 : k === "li" ? 200 : 120);
      }
    }
    /* THE ADDRESS, SAVED WITH THE FORM AND NOT BESIDE IT.
     *
     * It had its own box and its own button under the Save that saves
     * everything else, which is two saves on one screen and the second one
     * easy to walk past — on the one field whose whole job is to be there
     * later. One form, one button.
     *
     * The one thing this cannot do quietly is take an address another member
     * is already using: two rows behind one address is one of them locked
     * out, so it is refused by name rather than dropped. Everything else about
     * the shape is cleanPerson's, like every other field here. */
    if (req.body.mail !== undefined) {
      const want = String(req.body.mail).trim().toLowerCase().slice(0, 120);
      if (want && board.people.some((x) => x.by !== me && x.mail === want)) {
        return { error: "mailTaken" };
      }
      q.mail = want;
      // A code out to an address that has just left a row opens nothing.
      board.signins = (board.signins || []).filter((v) => v.mail !== want);
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
    /* The sentence. Validated in cleanPerson like everything else — an
       unknown role is dropped rather than refused, so an old page saving
       against a new server loses the line it did not understand instead of
       losing the save. The rooms are derived from it there too. */
    if (Array.isArray(req.body.say)) q.say = fixSay(board, q, req.body.say);
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
    /* ONE MORE PICTURE, AND IT QUEUES LIKE THE FACE DID. Same asRead above:
       while the room is still open they go straight up, and once it is not
       they wait. A gallery that skipped the queue would be the way round it.

       ONE PER SAVE rather than a list. The page sends them one at a time as
       they are chosen, so a slow connection loses one picture instead of six,
       and the 36mb ceiling on this route is about one file and not about a
       folder. */
    if (shotOne?.id) {
      q.shots = Array.isArray(q.shots) ? q.shots : [];
      if (q.shots.length >= store.SHOTS_MAX) return { error: "shotsFull" };
      q.shots.push({ id: shotOne.id, state: asRead, at: new Date().toISOString() });
    }
    /* AND TAKING ONE DOWN. The file itself is left on disk: media is shared by
       id and reference-counted nowhere, so deleting it here would be deleting
       whatever else happens to point at it. forget() is where files go. */
    if (req.body.dropShot !== undefined) {
      const want = String(req.body.dropShot || "");
      q.shots = (Array.isArray(q.shots) ? q.shots : []).filter((x) => x.id !== want);
    }

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

  /* An address another member already has. Refused by name so the form can
     say which field, rather than a save that quietly did four of five things.
     Checked here because `change` is where the other rows are visible. */
  /* EVERY ERROR THIS CHANGE CAN RETURN, not just the one that existed when
     the line was written. The route ends by wrapping whatever came back as
     `person`, so an unlisted error went out as {"person":{"error":"..."}} —
     truthy, shaped like a profile, and the page assigned it over ME and drew
     an empty one. Adding an error to the change above and forgetting this line
     is a bug in the screen, not in the save. */
  if (out?.error === "mailTaken") return res.status(409).json(out);
  if (out?.error === "shotsFull") return res.status(409).json(out);

  // Told either way, and told which: a photograph that went straight up is
  // still worth knowing about, and calling it held when it is not would put a
  // job on the panel that nobody can do.
  if (face?.id || back?.id) {
    tell(out.photoState === "published" ? "published" : "held",
      { ...out, note: "New profile photo" });
  }
  res.json({ person: shownPerson(out, true) });
});

/* ---- THE PEOPLE ONE LOGIN SPEAKS FOR -------------------------------------
 *
 * Everything here is asked as the REAL browser — `store.hashDevice`, never the
 * local one — because these are the routes that manage the roster rather than
 * act through it. Being Mia must not let you add somebody to Mia's roster.
 * That is the whole reason the two functions have different names.
 */

/** Would showing this one put the agent over the room's share of Browse? */
const overShow = (board, runBy, exceptId) =>
  board.people.filter((q) => q.runBy === runBy && q.looking && q.id !== exceptId)
    .length >= store.RUN_SHOW;

/** The roster, and who this browser is being on this request. */
app.get("/api/run", gate, async (req, res) => {
  const real = store.hashDevice(String(req.get("x-board-device") || ""), SALT);
  if (!real) return res.status(400).json({ error: "no" });
  const board = await store.load(FILE);
  const me = board.people.find((q) => q.by === real);
  const run = board.people.filter((q) => q.runBy === real && q.by !== real);
  const unread = new Map();
  for (const n of board.notes) {
    // What is waiting, per person, so one list can carry the whole roster —
    // see the merged Cards screen in docs/mockups/agent.html.
    const q = run.find((x) => x.by === n.to);
    if (q && !n.seen) unread.set(q.id, (unread.get(q.id) || 0) + 1);
  }
  res.json({
    max: store.RUN_MAX,
    show: store.RUN_SHOW,
    showing: run.filter((q) => q.looking).length,
    // Empty when they are themselves. The page draws the orange bar off this
    // and nothing else, so a stale id in localStorage shows no bar rather than
    // a bar naming somebody they are not actually being.
    as: acting.getStore()?.as || "",
    me: me ? {
      id: me.id, handle: me.handle,
      photo: me.photoState === "published" ? me.photo : "",
      /* WHETHER THEY SAY THEY ARE ONE, which is not the same as running
         somebody yet. The app showed its link to this page only to people who
         already had a roster, so an agent who came through the door and had
         not added anybody — which is every agent, for their first ten minutes
         — had no way back to the console they were invited for. The sentence
         is the honest test: it is what they told the board they are. */
      agent: me.say.some((x) => x.me === "agent"),
      /* WHETHER SOMEBODY SPEAKS FOR THEM, which is the one thing that rules
         out speaking for anybody else — no chains, per /api/run/add. The app
         offers the "someone else" box off this, so the offer and the rule are
         the same fact rather than two that can drift apart. */
      client: !!me.runBy,
      // And who, so the line can say it. A handle and nothing else: the row
      // that speaks for them is not this page's business beyond its name.
      agentName: me.runBy
        ? (board.people.find((x) => x.by === me.runBy)?.handle || "")
        : "",
    } : null,
    run: run.map((q) => ({
      id: q.id, handle: q.handle, state: q.state, looking: q.looking,
      photo: q.photoState === "published" ? q.photo : "",
      campus: q.campus, say: q.say, waiting: unread.get(q.id) || 0,
    })),
  });
});

/* ONE FIELD, BECAUSE THIS HAPPENS IN A TAXI.
 *
 * A name a line. Everything else is inherited from the agent's own row — the
 * sentence, the rooms, which half of the world, the trade — because an agent
 * for Sydney performers is adding Sydney performers, and a form that asked
 * nine questions about each of nine people is a form nobody finishes. All of
 * it is editable afterwards by being them.
 *
 * Published on arrival, like any other profile made of words: the words have
 * been through the one check this board has, and a profile nobody can see is
 * not a profile. Faces are a separate queue, as they are for everybody.
 *
 * Showing is capped, so the first few land in Browse and the rest wait. That
 * is not a punishment, it is the only reason Browse is worth opening.
 */
app.post("/api/run/add", express.json({ limit: "8kb" }), gate, async (req, res) => {
  const real = store.hashDevice(String(req.body?.device || ""), SALT);
  if (!real) return res.status(400).json({ error: "no" });

  const names = String(req.body?.names || "").split(/[\n\r]+/)
    .map((x) => x.trim()).filter(Boolean).slice(0, store.RUN_MAX);
  if (!names.length) return res.status(400).json({ error: "names" });

  /* WHAT THEY ARE — the one thing the server cannot guess and will not invent.
   *
   * Everything else on these rows is inherited from the agent's, and that is
   * right: an agent for Sydney performers is adding Sydney performers. The
   * sentence is the exception. Andy's own reads "I am an Agent looking for a
   * Producer"; copying it wholesale puts nine agents on the board who are not
   * agents, in the wrong rooms, matched to the wrong people. His performers
   * are PERFORMERS looking for producers — the left half is theirs and the
   * right half is his.
   *
   * Making side only. An agent adding producers is not representing anybody,
   * it is filling Browse with the other half of their own market, and the
   * first person to try it will not be doing it by accident. */
  const role = String(req.body?.role || "");
  if (!store.ROLES[role] || store.ROLES[role].side !== "make") {
    return res.status(400).json({ error: "role" });
  }
  // The profile rule applies to a name typed by an agent exactly as it applies
  // to a name typed by its owner.
  const shaped = store.contactShaped(names.join(" "));
  if (shaped) return res.status(400).json({ error: "contact", what: shaped });

  let why = "";
  const out = await change((board) => {
    const mine = board.people.find((q) => q.by === real);
    if (!mine) { why = "nopage"; return null; }
    // NO CHAINS. Somebody an agent speaks for may not speak for anybody: two
    // links and there is no answering who a conversation is actually with.
    if (mine.runBy) { why = "run"; return null; }
    const had = board.people.filter((q) => q.runBy === real && q.by !== real).length;
    if (had + names.length > store.RUN_MAX) { why = "full"; return null; }

    const made = [];
    for (const handle of names) {
      /* AN IDENTITY FOR A BROWSER THAT DOES NOT EXIST. The same salted hash
         every other row has, over a random number nothing keeps — so the row
         is indistinguishable from a member's downstream, and there is no seed
         stored anywhere that would let this file impersonate them later. The
         agent reaches it through `runBy` and by no other path. */
      const q = store.cleanPerson({
        id: store.newId(),
        at: new Date().toISOString(),
        state: "published",
        by: store.hashDevice(randomUUID(), SALT),
        runBy: real,
        agent: mine.id,
        handle: handle.slice(0, 40),
        // Everything below is the agent's own row, which is the whole point of
        // the one field. Wrong for somebody is one edit away; asked for nine
        // people up front, it is nine forms nobody fills in.
        /* His sentences with the left half replaced by theirs, deduplicated by
           cleanPerson, and capped at three there too. Somebody who says
           nothing on the right — an agent looking for anyone — passes that
           through, which is the correct reading: so is the performer. */
        say: (mine.say.length ? mine.say : [{ me: "", want: store.ANYONE }])
        /* THE RIGHT HALF IS WHAT THE AGENT *IS*, NOT WHAT THEY WANT, and it
           was the other way round in all three of the places that make a
           represented row — which made a nonsense of the one sentence this
           whole board is built on.
           Andy says "I am an Agent looking for a Performer". His performers
           are performers looking for an AGENT. Copying his `want` gave them
           "I am a Performer looking for a Performer", printed on the card of
           every person any agent has ever added.
           IT MATCHED ANYWAY, which is why nobody caught it: roomOfPair works
           the room out from the pair and landed on `talent` either way, so
           the only place it was wrong was the place people read. */
          .map((x) => ({ me: role, want: x.me || store.ANYONE })),
        where: mine.where, wants: mine.wants,
        trade: mine.trade, campus: mine.campus,
        looking: !overShow(board, real, ""),
      });
      board.people.push(q);
      made.push({ id: q.id, handle: q.handle, looking: q.looking });
    }
    return made;
  });

  if (why === "nopage") return res.status(409).json({ error: "nopage" });
  if (why === "run") return res.status(409).json({ error: "run" });
  if (why === "full") return res.status(409).json({ error: "full", max: store.RUN_MAX });
  res.status(201).json({ ok: true, added: out || [] });
});

/* A FOLDER, DROPPED.
 *
 * The typing is the reason an agent does not do this. They have had a folder
 * per performer for years — a headshot, a CV, a bio somebody wrote in 2019 —
 * and retyping nine of them into a form is the competition this feature is
 * actually against. So they drop the folder and the box does the typing.
 *
 * WHAT HAPPENS, IN THIS ORDER, AND THE ORDER IS THE POINT.
 *
 *  1  GROUPED HERE, locally, with no model involved: whose file is this. The
 *     folder each file sits in answers it, because that is how everybody keeps
 *     these files. A wrong answer at this step puts one performer's credits on
 *     another performer's page, and nobody would catch that by reading the
 *     bio — so it is decided by a rule that can be explained, not by a guess.
 *  2  READ HERE. Text, markdown, .docx and most PDFs. A file that cannot be
 *     read honestly is reported as unread rather than fed to anything.
 *  3  SHAPED, and only this step leaves the box: the text of one person's own
 *     files, for one request, written nowhere. With no key on this box the
 *     step is skipped and the rows are still made — names and faces, which is
 *     the boring half of the job and the half nobody does.
 *  4  HELD. Nothing published, nothing in Browse, nothing anybody else can
 *     see. The agent reads all of it and presses a button, or does not.
 *
 * The whole of step 4 is why the rest is allowed to exist. A machine that
 * writes a bio is a machine that will occasionally write a confident sentence
 * about somebody's career that is not true, and the person it happens to is
 * not in the room.
 */
app.post("/api/run/drop", gate,
  express.raw({ type: "multipart/form-data", limit: "64mb" }), async (req, res) => {
  const parsed = multipart(req);
  if (!parsed) return res.status(400).json({ error: "expected multipart/form-data" });
  const real = store.hashDevice(String(parsed.fields.device || ""), SALT);
  if (!real) return res.status(400).json({ error: "no" });
  const role = String(parsed.fields.role || "");
  if (!store.ROLES[role] || store.ROLES[role].side !== "make") {
    return res.status(400).json({ error: "role" });
  }
  if (!parsed.files.length) return res.status(400).json({ error: "empty" });

  const board0 = await store.load(FILE);
  const mine = board0.people.find((q) => q.by === real);
  if (!mine) return res.status(409).json({ error: "nopage" });
  if (mine.runBy) return res.status(409).json({ error: "run" });

  /* FOLDERS FIRST, THEN THE HEAP. A tidy drop — one folder per person — never
     reaches a model at all: a person put those files in those folders and that
     is better evidence than anything a machine can infer. What is left over is
     the pile an agent actually drags in off a laptop, and that is proposed
     rather than decided; see sortLoose. */
  // Tagged before anything groups them, so a file can be named back to the
  // browser that sent it however the grouping shuffles it about.
  parsed.files.forEach((f, i) => { f.i = i; });
  const { piles, loose } = intake.group(parsed.files);
  const guessed = await intake.sortLoose(loose);
  const all = [...piles, ...guessed.filter((g) => g.name)];
  const unplaced = guessed.filter((g) => !g.name).flatMap((g) => g.files);
  /* A PILE IT CANNOT NAME IS STILL A PILE, and refusing it was wrong.
   *
   * The first thing anybody does with this is drag ONE file in to see what
   * happens — a PDF called `resume.pdf`, or a designed one-pager whose text
   * cannot be read at all. There is no name in the filename and none to be
   * had from the contents, so nothing could be grouped, and the console said
   * "put each person's files in a folder with their name on it" — which is
   * software sending somebody away to do filing, to the exact person who was
   * promised they could pile everything in.
   *
   * The console can take it from here: it shows the files and asks for a
   * name, which is one box and the thing a person can answer instantly. So
   * the dry path never refuses. The direct path below still does, because it
   * writes rows immediately and has nobody to ask. */
  if (!all.length && !unplaced.length) {
    return res.status(400).json({ error: "nonames", loose: loose.length });
  }
  if (!all.length && String(parsed.fields.dry || "") !== "1") {
    return res.status(400).json({ error: "nonames", loose: loose.length });
  }
  const room = store.RUN_MAX - board0.people.filter((q) => q.runBy === real && q.by !== real).length;
  if (room <= 0) return res.status(409).json({ error: "full", max: store.RUN_MAX });

  /* ALREADY HERE IS NOT AN ERROR. An agent who drops the same folder again
     after adding one performer to it should get the one new person, not a
     refusal and not nine duplicates. Matched on the name, which is the only
     thing both sides have. */
  const had = new Set(board0.people
    .filter((q) => q.runBy === real).map((q) => q.handle.trim().toLowerCase()));
  const fresh = all.filter((p) => !had.has(p.name.trim().toLowerCase())).slice(0, room);
  if (!fresh.length && !(unplaced.length && String(parsed.fields.dry || "") === "1")) {
    return res.status(200).json({ ok: true, added: [], already: all.length,
      loose: unplaced.length, drafting: intake.configured() });
  }

  const drafts = await intake.draft(fresh);

  /* THE CONSOLE'S HALF: propose, and write nothing at all.
   *
   * The tidy path creates held rows straight away, which is right when the
   * agent's folders already say who is who — there is nothing to correct. The
   * heap is different: the grouping itself is a guess, and a guess is only
   * safe when the person can see it and move a file. So /onboard asks with
   * dry=1, shows WHICH FILES went under WHICH NAME, lets it be fixed, and
   * sends the result back to /api/run/make.
   *
   * Nothing is kept between the two requests — no token, no temp directory, no
   * half-made rows to sweep up if somebody closes the laptop. The browser
   * still has the files; the second request carries only the faces and the
   * fields, which is a fraction of the pile. State on a server is a thing to
   * expire, and this way there is none. */
  if (String(parsed.fields.dry || "") === "1") {
    return res.json({
      ok: true, dry: true, drafting: intake.configured(),
      already: all.length - fresh.length,
      unplaced: unplaced.map((f) => ({ i: f.i, name: String(f.name).split("/").pop() })),
      people: drafts.map((d) => ({
        handle: d.handle, goal: d.goal, trade: d.trade, campus: d.campus,
        speaks: d.speaks, age: d.age,
        // Named so the console can show the grouping, which is the whole
        // reason this request exists.
        // `i` travels: the console has to put a chip under a different person
        // and two people can both have a bio.txt, so the leaf name is not an
        // identity. Dropping it here was a card with no files drawn on it.
        files: d.read.map((f) => ({ i: f.i, name: f.name, read: f.got })),
        guessed: Boolean(fresh.find((p) => p.name === d.handle)?.guessed),
        drafted: d.drafted,
      })),
    });
  }

  // Faces are stored before the board is touched, so a write that fails leaves
  // no rows pointing at media and no media pointing at nothing.
  for (const d of drafts) {
    d.photoId = "";
    if (!d.face) continue;
    try {
      if (d.face.buf.length <= 25 * 1024 * 1024) {
        d.photoId = (await putMedia(d.face.buf, d.face.type)) || "";
      }
    } catch { /* a face that will not store is a face the agent adds later */ }
  }

  const out = await change((board) => {
    const made = [];
    for (const d of drafts) {
      /* THE ONE RULE A PROFILE HERE HAS, applied to words a model wrote
         exactly as it is applied to words a person typed. It is told not to
         put contact details on a page; this is what happens when it does. */
      if (store.contactShaped([d.goal, d.trade, d.campus, d.handle].filter(Boolean).join(" "))) {
        d.goal = ""; d.trade = ""; d.stripped = true;
      }
      const q = store.cleanPerson({
        id: store.newId(),
        at: new Date().toISOString(),
        // HELD, and this is the whole argument for the rest of the route.
        state: "held",
        by: store.hashDevice(randomUUID(), SALT),
        runBy: real,
        agent: mine.id,
        handle: d.handle,
        goal: d.goal, trade: d.trade, campus: d.campus,
        speaks: d.speaks, age: d.age,
        photo: d.photoId,
        say: (mine.say.length ? mine.say : [{ me: "", want: store.ANYONE }])
          .map((x) => ({ me: role, want: x.me || store.ANYONE })),
        where: mine.where, wants: mine.wants,
        // Not in Browse and not anywhere until somebody has read it.
        looking: false,
      });
      board.people.push(q);
      made.push({
        id: q.id, handle: q.handle, goal: q.goal, trade: q.trade, campus: q.campus,
        drafted: d.drafted, stripped: Boolean(d.stripped),
        face: Boolean(q.photo), read: d.read,
      });
    }
    return made;
  });

  res.status(201).json({
    ok: true,
    added: out || [],
    already: all.length - fresh.length,
    // Files that belong to nobody — a bare `cv.pdf` dropped loose. Named back
    // rather than silently ignored: a file that vanished is the one thing that
    // would make somebody distrust the whole import.
    loose: unplaced.length,
    drafting: intake.configured(),
  });
});

/* WHAT THE AGENT CONFIRMED.
 *
 * The second half of the console, and the only half that writes anything. It
 * takes the people as they stand on the screen after the grouping has been
 * corrected — names fixed, files moved, somebody deleted — plus one face each,
 * and makes the rows.
 *
 * The fields arrive as text rather than being re-derived, which is the point:
 * they are what the agent read and edited, not what a model said. If they
 * rewrote a bio in the box, the rewritten one is what lands. Nothing here asks
 * a model anything.
 *
 * Faces come up as files named `face0`, `face1` — matched to the person at
 * that index. Everything else in the pile is left in the browser and never
 * uploaded twice: a CV's job was finished the moment its words were read.
 */
app.post("/api/run/make", gate,
  express.raw({ type: "multipart/form-data", limit: "64mb" }), async (req, res) => {
  const parsed = multipart(req);
  if (!parsed) return res.status(400).json({ error: "expected multipart/form-data" });
  const real = store.hashDevice(String(parsed.fields.device || ""), SALT);
  if (!real) return res.status(400).json({ error: "no" });
  const role = String(parsed.fields.role || "");
  if (!store.ROLES[role] || store.ROLES[role].side !== "make") {
    return res.status(400).json({ error: "role" });
  }

  let want = [];
  try { want = JSON.parse(String(parsed.fields.people || "[]")); } catch { /* refused below */ }
  if (!Array.isArray(want) || !want.length) return res.status(400).json({ error: "people" });
  want = want.slice(0, store.RUN_MAX);

  const board0 = await store.load(FILE);
  const mine = board0.people.find((q) => q.by === real);
  if (!mine) return res.status(409).json({ error: "nopage" });
  if (mine.runBy) return res.status(409).json({ error: "run" });
  const room = store.RUN_MAX - board0.people.filter((q) => q.runBy === real && q.by !== real).length;
  if (room <= 0) return res.status(409).json({ error: "full", max: store.RUN_MAX });

  const had = new Set(board0.people
    .filter((q) => q.runBy === real).map((q) => q.handle.trim().toLowerCase()));
  const s = (v, n) => String(v ?? "").replace(/\r\n?/g, "\n").trim().slice(0, n);

  const rows = [];
  for (let i = 0; i < want.length && rows.length < room; i++) {
    const p = want[i] || {};
    const handle = s(p.handle, 40);
    // A person with no name is a group the agent left unnamed on the screen.
    // Skipped rather than refused: the other eight should still land.
    if (!handle || had.has(handle.toLowerCase())) continue;
    had.add(handle.toLowerCase());
    const face = parsed.files.find((f) => f.name === "face" + i);
    let photo = "";
    if (face && face.buf.length <= 25 * 1024 * 1024) {
      try { photo = (await putMedia(face.buf, face.type)) || ""; } catch { /* added later */ }
    }
    rows.push({
      handle, photo,
      goal: s(p.goal, 600), trade: s(p.trade, 120), campus: s(p.campus, 60),
      age: String(p.age ?? "").replace(/\D/g, "").slice(0, 2),
      speaks: Array.isArray(p.speaks) ? p.speaks.slice(0, 6).map((x) => s(x, 40)).filter(Boolean) : [],
    });
  }
  if (!rows.length) return res.status(200).json({ ok: true, added: [] });

  const out = await change((board) => {
    const made = [];
    for (const r of rows) {
      // The board's one rule, applied to what the agent confirmed exactly as
      // it is applied to what a model wrote and to what a member types.
      let stripped = false;
      if (store.contactShaped([r.goal, r.trade, r.campus, r.handle].filter(Boolean).join(" "))) {
        r.goal = ""; r.trade = ""; stripped = true;
      }
      const q = store.cleanPerson({
        id: store.newId(),
        at: new Date().toISOString(),
        // Held, like everything else that arrives this way. Approving the
        // grouping is not the same decision as putting somebody on a board,
        // and the console asks for both.
        state: "held",
        by: store.hashDevice(randomUUID(), SALT),
        runBy: real, agent: mine.id,
        handle: r.handle, goal: r.goal, trade: r.trade, campus: r.campus,
        speaks: r.speaks, age: r.age, photo: r.photo,
        say: (mine.say.length ? mine.say : [{ me: "", want: store.ANYONE }])
          .map((x) => ({ me: role, want: x.me || store.ANYONE })),
        where: mine.where, wants: mine.wants,
        looking: false,
      });
      board.people.push(q);
      made.push({ id: q.id, handle: q.handle, goal: q.goal, face: Boolean(q.photo), stripped });
    }
    return made;
  });
  res.status(201).json({ ok: true, added: out || [] });
});

/* READ, AND LET THROUGH. The button at the end of the drop.
 *
 * Publishing is a separate request from importing on purpose: the two are
 * different decisions and one of them is somebody else's reputation. Ids are
 * named one at a time, so approving is something done to rows that were
 * actually looked at rather than to whatever happens to be held. */
app.post("/api/run/approve", express.json({ limit: "8kb" }), gate, async (req, res) => {
  const real = store.hashDevice(String(req.body?.device || ""), SALT);
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : [])
    .map(String).filter((x) => /^[a-f0-9]{20}$/.test(x)).slice(0, store.RUN_MAX);
  if (!real || !ids.length) return res.status(400).json({ error: "no" });
  const out = await change((board) => {
    const done = [];
    for (const id of ids) {
      const q = board.people.find((x) => x.id === id && x.runBy === real && x.state === "held");
      if (!q || !q.handle) continue;
      q.state = "published";
      // Into Browse if there is room, and quietly not if there is not — see
      // RUN_SHOW. Their page and their matches work either way.
      if (!overShow(board, real, q.id)) q.looking = true;
      done.push({ id: q.id, handle: q.handle, looking: q.looking });
    }
    return done;
  });
  res.json({ ok: true, live: out || [], show: store.RUN_SHOW });
});

/** In Browse, or not. The cap is the room's, not the agent's — see RUN_SHOW. */
app.post("/api/run/show", express.json({ limit: "2kb" }), gate, async (req, res) => {
  const real = store.hashDevice(String(req.body?.device || ""), SALT);
  const id = String(req.body?.id || "");
  const on = req.body?.show === true;
  if (!real || !/^[a-f0-9]{20}$/.test(id)) return res.status(400).json({ error: "no" });
  let why = "";
  const out = await change((board) => {
    const q = board.people.find((x) => x.id === id && x.runBy === real);
    if (!q) { why = "nope"; return null; }
    if (on && overShow(board, real, id)) { why = "full"; return null; }
    q.looking = on;
    return { id: q.id, looking: q.looking };
  });
  if (why === "full") return res.status(409).json({ error: "full", show: store.RUN_SHOW });
  if (why) return res.status(404).json({ error: "nope" });
  res.json({ ok: true, ...out });
});

/* HANDING SOMEBODY THEIR OWN ROW.
 *
 * The day a performer wants their own account, they get THIS one — the page,
 * the history, the matches, the conversations — and not a copy of it with the
 * good part missing. An arrangement you cannot leave is not an arrangement,
 * and an agent who can say "it is yours whenever you want it" is telling the
 * truth rather than making a promise the software would have to be rewritten
 * to keep.
 *
 * It is the way-back code the board already has (see `back` on a person), so
 * there is nothing new to explain to anybody: they type six characters and the
 * row moves onto their browser. Minted here and shown once; the agent loses
 * their hold on it the moment it is spent.
 */
app.post("/api/run/hand", express.json({ limit: "2kb" }), gate, async (req, res) => {
  const real = store.hashDevice(String(req.body?.device || ""), SALT);
  const id = String(req.body?.id || "");
  if (!real || !/^[a-f0-9]{20}$/.test(id)) return res.status(400).json({ error: "no" });
  const out = await change((board) => {
    const q = board.people.find((x) => x.id === id && x.runBy === real);
    if (!q) return null;
    const taken = codesTaken(board);
    let code = store.newCode();
    for (let i = 0; i < 50 && taken.has(code); i++) code = store.newCode();
    if (taken.has(code)) return null;
    q.back = code;
    /* Cleared BEFORE they spend it, not after. The other order looks tidier
       and means an agent who changes their mind can take it back, which is
       exactly the thing this route exists to make impossible. */
    q.runBy = "";
    q.agent = "";
    return { code, handle: q.handle };
  });
  if (!out) return res.status(404).json({ error: "nope" });
  res.json({ ok: true, ...out });
});

/* SOMEBODY WHO IS ALREADY HERE.
 *
 * /api/run/add makes rows for people who have never opened the app. This is
 * the other half of the question, and it cannot be done the same way round.
 *
 * The obvious shape — the agent types a handle and ticks "this one is mine" —
 * is an account takeover with a button on it. Whoever holds runBy posts as
 * that person, reads their cards, follows and unfollows for them. Handing
 * that over is the single most consequential press on this board, and it is
 * not the agent's to make.
 *
 * So it goes the way /api/run/hand already goes, read backwards: the press
 * belongs to whoever holds the row now. The agent mints six characters here
 * and reads them down a phone; the person types them into their own profile
 * at /api/me/agent, having been told in one sentence what it does.
 *
 * A day, like an invite, and for the same reason: a code with no clock on it
 * is a code somebody finds in a chat six months later.
 */
app.post("/api/run/rep", express.json({ limit: "2kb" }), gate, async (req, res) => {
  const real = store.hashDevice(String(req.body?.device || ""), SALT);
  if (!real) return res.status(400).json({ error: "no" });
  let why = "";
  const out = await change((board) => {
    const mine = board.people.find((q) => q.by === real);
    if (!mine) { why = "nopage"; return null; }
    // The same no-chains rule /api/run/add enforces, checked at the minting
    // end so a code that could never be spent is never read out loud.
    if (mine.runBy) { why = "run"; return null; }
    const had = board.people.filter((q) => q.runBy === real && q.by !== real).length;
    if (had >= store.RUN_MAX) { why = "full"; return null; }
    const taken = codesTaken(board);
    let code = store.newCode();
    for (let i = 0; i < 50 && taken.has(code); i++) code = store.newCode();
    if (taken.has(code)) { why = "again"; return null; }
    /* ONE LIVE CODE PER AGENT. Minting a second replaces the first rather
       than adding to it: two codes in the wild, both of which hand an account
       over, is twice the thing that can go wrong for no gain — an agent
       taking on two people reads the second one out after the first is
       spent. */
    mine.rep = code;
    mine.repTill = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    return { code, till: mine.repTill, handle: mine.handle };
  });
  if (!out) return res.status(400).json({ error: why || "no" });
  res.json({ ok: true, ...out });
});

/* AND THE PRESS ITSELF, on the row being handed over, by the person holding
 * it. Everything this route can refuse, it refuses before anything is written;
 * what it cannot do is undo somebody's mind, which is why the screen that
 * sends it says plainly what the agent will be able to do.
 *
 * There is a way back out: /api/run/hand, which the agent can spend to return
 * the row, and which clears runBy before the person spends the code rather
 * than after — see the note there.
 */
app.post("/api/me/agent", express.json({ limit: "2kb" }), gate, async (req, res) => {
  // store.hashDevice ON PURPOSE, like the door. This is the one row nobody may
  // hand over on somebody else's behalf, so it asks about the real browser and
  // never about whoever it might currently be acting as.
  const me = store.hashDevice(String(req.body?.device || ""), SALT);
  const code = String(req.body?.code || "").trim().toUpperCase();
  if (!me || !code) return res.status(400).json({ error: "no" });
  let why = "";
  const out = await change((board) => {
    const mine = board.people.find((q) => q.by === me);
    if (!mine) { why = "nopage"; return null; }
    const agent = board.people.find((q) => q.rep && q.rep === code);
    if (!agent) { why = "bad"; return null; }
    if (!agent.repTill || new Date(agent.repTill) < new Date()) { why = "old"; return null; }
    // Their own code, typed into their own profile. Not an error worth a
    // scary word — it is somebody testing what the six characters do.
    if (agent.by === me) { why = "self"; return null; }
    if (mine.runBy) { why = "already"; return null; }
    /* NO CHAINS, BOTH WAYS. Somebody who speaks for other people may not
       become somebody else's client, because two links and there is no
       answering who a conversation is actually with. The agent end was
       checked when the code was minted; this is the other end, and it has to
       be checked again here because the roster can have grown since. */
    if (board.people.some((q) => q.runBy === me && q.by !== me)) { why = "runs"; return null; }
    if (agent.runBy) { why = "chain"; return null; }
    const had = board.people.filter((q) => q.runBy === agent.by && q.by !== agent.by).length;
    if (had >= store.RUN_MAX) { why = "full"; return null; }
    mine.runBy = agent.by;
    mine.agent = agent.id;
    // Spent. One person, once — the same rule the invite has, for the same
    // reason: a code that still works after it has been used is a code that
    // hands a second account over to somebody who was only told about one.
    agent.rep = "";
    agent.repTill = "";
    return { ok: true, who: agent.handle };
  });
  if (!out) return res.status(400).json({ error: why || "no" });
  res.json(out);
});

/* THE SENTENCE ON ITS OWN, saved where it is read.
 *
 * The two pills used to live inside the profile sheet, which meant changing
 * what you are looking for cost a trip through a form with a photograph in
 * it. They sit on Browse now, at the top of the deck they decide — and a
 * control that is edited in one tap has to save in one tap, or the next
 * person to close the page loses what they picked without being told.
 *
 * So: this route, and nothing else on it. It takes the sentence and touches
 * no other field, which is the whole reason it exists rather than the page
 * posting a whole profile back with two pills changed and everything else
 * copied out of what it happened to be holding.
 *
 * The fixed half is stamped on here as it is everywhere else — see fixSay —
 * so what the browser sends for it is read and thrown away.
 */
app.put("/api/me/say", express.json({ limit: "4kb" }), gate, async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  if (!me) return res.status(400).json({ error: "no" });
  if (!Array.isArray(req.body?.say)) return res.status(400).json({ error: "say" });
  const out = await change((board) => {
    const q = board.people.find((x) => x.by === me);
    // No profile yet: the pills are part of making one, and making one is the
    // other route's job. Nothing is written for somebody who is not here.
    if (!q) return { error: "who" };
    q.say = fixSay(board, q, req.body.say);
    // The rooms are derived from the sentence, so they are re-derived with it.
    Object.assign(q, store.cleanPerson(q));
    return { ok: true, say: q.say };
  });
  if (out?.error === "who") return res.status(404).json(out);
  res.json(out);
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
  const me = hashDevice(String(req.body?.device || ""), SALT);
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
    by: hashDevice(req.body?.device, SALT),
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

/* WHY THESE TWO CANNOT TALK.
 *
 * "I am following Hugo, why can we not connect?" is the most reasonable
 * question anybody asks about this board, and until now the only way to answer
 * it was to guess. A match is three separate tests and a person can pass two
 * of them and see nothing, with no screen anywhere saying which one they
 * failed — because the honest screen for it would be a screen about somebody
 * else's settings.
 *
 * So the answer lives here, where the operator can ask for it, and it calls
 * the very same matched()/scopeFits()/sharedRooms() the product calls. A
 * diagnostic that reimplements the rule is a diagnostic that will one day be
 * confidently wrong.
 *
 *   make pair A="Tom" B="Hugo"
 *
 * Names, not device hashes: the operator has names. Nothing about either
 * person's device leaves this route.
 */
app.get("/api/pair", admin, async (req, res) => {
  const board = await store.load(FILE);
  res.set("Cache-Control", "no-store");
  const find = (name) => board.people.find(
    (q) => (q.handle || "").toLowerCase() === String(name || "").trim().toLowerCase());
  const a = find(req.query.a), b = find(req.query.b);
  if (!a || !b) {
    return res.status(404).json({ error: "who", missing: [!a && req.query.a, !b && req.query.b].filter(Boolean) });
  }
  const follows = (x, y) => board.follows.some((f) => f.by === x.by && f.who === y.id);
  const shared = store.sharedRooms(a, b);
  res.json({
    a: { name: a.handle, rooms: a.rooms || [], where: a.where || "cn", wants: a.wants || "any",
         looking: Boolean(a.looking), state: a.state },
    b: { name: b.handle, rooms: b.rooms || [], where: b.where || "cn", wants: b.wants || "any",
         looking: Boolean(b.looking), state: b.state },
    aFollowsB: follows(a, b),
    bFollowsA: follows(b, a),
    scopeFits: store.scopeFits(a, b),
    shared: shared.map((x) => x.mine + " \u2194 " + x.theirs),
    matched: matched(board, a.by, b.by),
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
  /* person → the invite their device spent → the wait row it was minted for.
     Built once; `who` on an invite is the wait row's name as it stood the
     moment it was handed over. */
  const spent = new Map(board.invites.filter((v) => v.usedBy).map((v) => [v.usedBy, v]));
  /* HOW TO REACH THEM, resolved the same way and for the same reason.
     A card is keyed by the device that wrote it, which is the same hash the
     person carries — so a person who filled one in has a WeChat id or a line
     of their own here. It is the only contact this board holds, and a waiting
     row cannot be written without one. Admin-only route, same as the waiting
     list it feeds. */
  const cards = new Map((board.cards || []).map((c) => [c.by, c]));
  const reachOf = (q) => {
    const c = q.by ? cards.get(q.by) : null;
    if (!c) return "";
    return c.wechat ? "wechat " + c.wechat : String(c.line || "").trim();
  };
  const byName = new Map(board.waits.map((w) => [String(w.name).toLowerCase(), w]));
  const waitOf = (q) => {
    if (!q.by) return null;
    const v = spent.get(q.by);
    return v && v.who ? (byName.get(String(v.who).toLowerCase()) || null) : null;
  };

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
      /* WHICH ROW THEY CAME IN ON, resolved here rather than guessed outside.
         A person's handle is what they chose to be called and has nothing to
         do with the name they typed on the join form, so matching the two by
         name finds almost nobody — "j j j" was never going to match a row.
         The chain is exact: the person's device spent an invite, and that
         invite was minted carrying the wait row's own name. Resolved on this
         side because the middle of that chain is a device hash, which has no
         business leaving the box. */
      fromWait: waitOf(q) ? waitOf(q).id : "",
      fromWaitName: waitOf(q) ? waitOf(q).name : "",
      reach: reachOf(q),
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
      ? hashDevice(String(parsed.fields.device), SALT) : "";

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

/* TAKING SOMEBODY OUT OF THE ROOM, AND PUTTING THEM BACK.
 *
 * Being IN Browse is the member's own switch and stays that way — nobody can
 * put somebody in front of the room on their behalf. Taking somebody out is
 * the other direction and belongs to whoever runs the board: a room where the
 * only person who can remove you is you is not a room anybody is keeping.
 *
 * NOTHING IS DELETED. The state goes back to held, which is the same state
 * every profile starts in: they vanish from Browse and from their public page,
 * their posts stay where they are, and they still see their own profile
 * exactly as before. They are not told, because there is nothing here that
 * tells anybody anything — and because "you have been hidden" is a
 * conversation to have in a chat, in your own words, or not at all.
 *
 * It reverses with the same call. That matters more than it sounds: a control
 * that only goes one way gets used as a last resort, and the point of this one
 * is to be usable on a hunch.
 */
app.post("/api/person/out", admin, express.json({ limit: "1kb" }), async (req, res) => {
  const want = String(req.body?.handle || "").trim().toLowerCase();
  if (!want) return res.status(400).json({ error: "which handle" });
  const back = req.body?.back === true;
  const out = await change((board) => {
    const q = board.people.find((x) => String(x.handle || "").toLowerCase() === want);
    if (!q) return null;
    q.state = back ? "published" : "held";
    return { handle: q.handle, state: q.state };
  });
  if (!out) return res.status(404).json({ error: "no such person" });
  res.json({ ok: true, ...out });
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
        /* WHAT THEY SAY THEY ARE, which /doors counts against what the queue
           is asking for — see drawQueue.
           The left half of their sentence and not `type`: type is the MBTI
           four-letter code and has nothing to do with roles, so counting the
           queue against it read as nobody inside, every time. Nothing new
           leaks — the sentence is on their own page. */
        says: [...new Set((Array.isArray(q.say) ? q.say : [])
          .map((r) => r && r.me).filter(Boolean))],
        type: q.type || "",
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
// A multipart reader, for a few short fields and the files beside them
//
// Written rather than depended on. The parsing libraries are good and none of
// them is small, and this handles exactly the shape the routes here describe.
//
// It took one file for most of its life, which was every route that existed.
// The folder drop needs the pile — forty files across nine people — so it now
// collects `files`, each with the name the browser sent, and `file` stays as
// the first of them so that nothing already written had to be touched. The
// name matters for the first time here: `Mia Chen/headshot.jpg` is how the
// drop knows whose headshot it is, and a reader that threw the path away threw
// away the only thing grouping the pile.
// ---------------------------------------------------------------------------
function multipart(req) {
  const ct = String(req.get("content-type") || "");
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(ct);
  if (!m || !Buffer.isBuffer(req.body)) return null;
  const boundary = Buffer.from("--" + (m[1] || m[2]).trim());
  const out = { fields: {}, file: null, files: [] };

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
        const f = { buf: body, type: type || "application/octet-stream", name: filename };
        if (!out.file) out.file = f;
        // A folder drop of forty files is the size this is for; a browser
        // posting four hundred is not a request this route was built for.
        if (out.files.length < 200) out.files.push(f);
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
  /* ONCE MEANS ONCE, AND IT DID NOT.
   *
   * This says above that it runs once because after the first pass every row
   * is published and the loop finds nothing. That was true only while nothing
   * else ever held a profile. `make hide` and `room-keep` both do — and every
   * restart after one of them found those rows "stuck" and put them straight
   * back, silently, so a deliberate hold survived exactly until the next
   * deploy. Eleven people were held and republished three times over before
   * anybody worked out why the number would not move.
   *
   * So the fact that it ran is written down, and it never runs again on a
   * board that has already had it. A hold means what it says now. */
  const RAN = "split-publish";
  const board = await store.load(FILE);
  if (!board.ran.includes(RAN)) {
    const stuck = board.people.filter((q) => q.state !== "published" && q.handle);
    await change((b) => {
      for (const q of b.people) if (q.state !== "published" && q.handle) q.state = "published";
      b.ran = [...(b.ran || []), RAN];
      return true;
    });
    if (stuck.length) {
      console.log(`published ${stuck.length} profile(s) held only because they predate the split`);
    }
  }
}

app.listen(PORT, () => {
  console.log(`board on :${PORT}, data in ${DIR}`);
  if (!KEY) console.error("BOARD_ADMIN_KEY is not set — the admin routes will refuse everything.");
  if (!SALT) console.error("BOARD_SALT is not set — device hashes are unsalted.");
});
