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
import * as memo from "./lib/memo.js";
import * as request from "./lib/request.js";
import * as shop from "./lib/shop.js";
import * as sealed from "./lib/sealed.js";
import * as terms from "./lib/terms.js";
import { translate, configured as translateReady } from "./lib/translate.js";
import { ask as askHostess, configured as hostessReady } from "./lib/hostess.js";
import { send as sendMail, configured as mailReady } from "./lib/mail.js";
import * as intake from "./lib/intake.js";
import * as butler from "./lib/butler.js";
import * as say from "./lib/say.js";
import * as hear from "./lib/hear.js";
import * as push from "./lib/push.js";
import * as google from "./lib/google.js";
/* Only for configured() at the subscribe route — the sending is push.tell's,
   which picks the half by the row. See the note at the top of apns.js. */
import * as pushApns from "./lib/apns.js";
import * as stripe from "./lib/stripe.js";
import { openChina } from "./lib/china.js";
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
import { createWallet } from "./lib/wallet/index.js";
import { qrBits, qrPng } from "./lib/qr.js";

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
/* THE OPERATOR'S OWN LINK, and it is not the admin key.
 *
 * One address he can keep on a home screen and open in WeChat: what happened
 * on the board since yesterday, on one screen, read in a queue. The admin key
 * would do it in one line and must not — a URL lives in browser history, in
 * WeChat's webview, and in whatever he pastes it into, and that key opens
 * every route on this box. This one is its own secret, it is read-only, and
 * changing the line in .env revokes it.
 *
 * Off unless set. A board with no BOARD_SNAP has no such address at all,
 * rather than one behind a guessable word. */
const SNAP = (process.env.BOARD_SNAP || "").trim();

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

/* A STANDING WAY BACK IN, FOR THE PERSON WHO RUNS THIS BOARD.
 *
 * `make back` mints six random characters, prints them, and spends them the
 * moment they are used. That is right for a member who lost their phone and
 * wrong for the operator, who signs in on a fresh browser often enough that
 * "run a command, read six random characters off a terminal, type them" is a
 * weekly chore — and on a screen that is hard to read, the reading is the
 * expensive part, not the running.
 *
 * So: one code, chosen rather than minted, that never spends and never
 * expires. Both settings or it does not exist.
 *
 * WHAT IT IS WORTH TO SOMEBODY WHO GUESSES IT. Everything the named person's
 * page can do — their requests, the account their money lands in, and every
 * member they can see. Five wrong answers an hour per browser is the only
 * thing between that and a stranger, and it is the same wall every other code
 * on this door stands behind. The difference is that the others are random,
 * so the wall is the last line; this one is six characters a person chose, so
 * the wall is the whole of it. Six characters somebody would try first — a
 * name, a word, the same letter six times — is not protected by the wall at
 * all, because the first guess is inside the five.
 *
 * It lives in .env for that reason and never in the repo: a standing password
 * committed to a public history is not a password.
 *
 * IT OPENS EXACTLY ONE PERSON. The handle named here and nobody else, so a
 * leaked copy is worth one page rather than the board. */
const BACK_CODE = store.cleanCode(process.env.BOARD_BACK_CODE || "");
const BACK_WHO = String(process.env.BOARD_BACK_WHO || "").trim();

/* THE DOOR WITH THE TYPING TAKEN OUT.
 *
 * Set BOARD_DOOR_IN=1 and the door draws a button that opens it instead of
 * six boxes that have to be typed into. Same landing page, same everything
 * above it — what goes is the part that kept breaking.
 *
 * WHAT IT IS WORTH TO A STRANGER, said plainly because there is no version
 * of this that is worth something only to the person it was meant for: while
 * it is on, ANYBODY who opens the door can tap it and be BACK_WHO. Not guess
 * a code — tap a button. It is a way in with no wall at all.
 *
 * So: off unless switched on, and it needs the standing code configured
 * first so it cannot be turned on by accident on a box that never had one.
 * It is a thing to put on while showing somebody the product and take off
 * afterwards — BOARD_DOOR_IN= and a make up. */
const DOOR_IN = process.env.BOARD_DOOR_IN === "1" && Boolean(BACK_CODE && BACK_WHO);
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

/* `extra` is a map of placeholder -> value, for the one page whose preview
 * card is different every time it is served. Everything else on this board is
 * the same HTML for everybody and takes the three fixed substitutions below;
 * an announcement carries its own title and its own picture into a chat, so
 * those have to be written per request or WeChat draws the board's default
 * card over somebody's news. Values are escaped by the caller. */
/* WHICH PRODUCT THE READER ASKED FOR, BY THE NAME THEY TYPED.
 *
 * One container answers two hostnames. On the board's names, "/" is the
 * board. On Dealio's own name it is the payments product — because a payer
 * opening a link should not meet a private networking board at the moment
 * they are deciding whether to trust a stranger with ten thousand yuan, and
 * a payment provider assessing the application should not type the domain on
 * the form and find a different company.
 *
 * Nothing else changes. Every route below serves both names exactly as it
 * did; this decides one page. www is included because somebody will type it
 * and Caddy's redirect only catches the apex-bound ones. */
const DEALIO_HOSTS = (() => {
  const d = String(process.env.BOARD_DEALIO_DOMAIN || "").trim().toLowerCase();
  return d ? new Set([d, "www." + d]) : new Set();
})();
const isDealioHost = (req) =>
  DEALIO_HOSTS.size > 0
  && DEALIO_HOSTS.has(String(req.get("host") || "").toLowerCase().split(":")[0]);

async function page(file, req, res, next, extra = null) {
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
    let out = PAGES.get(file)
      .split("{{HERE}}").join(here)
      .split("{{ORIGIN}}").join(origin)
      .split("{{DEMO}}").join(DEMO_TAG)
      /* WHICH PRODUCT'S DOOR THIS IS. The page needs it before it can decide
         where somebody is going, which is before any fetch could answer — so
         it is substituted here rather than asked for. */
      .split("{{DEALIO}}").join(isDealioHost(req) ? "1" : "")
      /* WHETHER THIS IS THE APP, for the pages that have to draw a nav bar
         before any fetch could answer. Same reasoning as {{DEALIO}} above,
         and the same detection as inApp() further down — see the long note
         there for why a forgeable user agent is safe for this. */
      .split("{{INAPP}}").join(inApp(req) ? "1" : "");
    for (const [k, v] of Object.entries(extra || {})) out = out.split(k).join(v);
    res.send(out);
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
const OPEN_PATHS = /^\/(enter|auth\/google|i\/|w\/|r\/|s\/|d\/|pay\/|demo(?:\.png)?$|api\/demo\/ask$|sell$|api\/sell$|dealio|api\/pay\/onboard$|api\/dealio\/try\/qr$|shop\/|order\/|orders$|api\/shop\/|api\/shop-media$|api\/order\/|api\/orders$|api\/product\/|api\/memo\/|api\/request(?:s|\/|$)|api\/snap|api\/door$|o(?:\/|$)|a\/|api\/announce\/|api\/announce-media|join|agents|a-browse(?:-zh)?\.png|a-say(?:-zh)?\.png|d-[a-z0-9]+\.(?:html|pdf)|g\/|share-exchange\.png|share-square\.png|about|rules|terms|privacy|rewards|level|type|room|voice\/|api\/enter|api\/signin|api\/admitted|api\/hello|api\/offer|api\/wait|api\/butler$|api\/butler-voice$|api\/butler-hear$|api\/write\/|api\/ask|api\/tally|api\/counts|doors|waiting|favicon|apple-touch-icon|manifest|share\.png|robots\.txt)/;

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

/* THE DOOR HAS TO SEE WHO IS KNOCKING, AND ON A POST THE NAME IS IN THE BODY.
 *
 * The gate below identifies a browser from the x-board-device header or the
 * wait cookie. /api/group/say carries neither: the pages send the device in
 * the JSON body, which at gate time has not been parsed — so every message
 * anybody at the door sent came back "invite", and the door rooms were
 * read-only for the whole queue with nothing on any screen saying why.
 *
 * One path, parsed early. body-parser marks a request it has handled, so the
 * route's own express.json() further down is a no-op rather than a second
 * read of a stream that has already ended.
 */
app.use("/api/group/say", express.json({ limit: "16kb" }));

/* THE WALLET — everything about money is in lib/wallet/, and this is the whole
   of what the board lends it: where to keep its file, and how to tell which
   published member a request comes from. Off unless BOARD_WALLET names a
   provider. The provider's webhooks are mounted here, ahead of the door below,
   because a payment company is not a member; the wallet's own routes are
   mounted after it, with the other pages. */
const WALLET = createWallet({
  dir: DIR,
  loadPeople: async () => (await store.load(FILE)).people,
  hashOf: (req) => hashDevice(String(req.get("x-board-device") || ""), SALT),
});
app.use(WALLET.webhooks);

/* AND WHEN AIRWALLEX SAYS A CODE WAS PAID.
 *
 * Asking works and needed nothing set up, which is why it was built first:
 * the payer's page asks every three seconds while the code is on the screen,
 * and the asker's list asks when they open it. But both of those need
 * somebody to be looking, and the commonest shape of this is nobody looking
 * at all — the payer pays on a phone and closes the tab, the person owed the
 * money is asleep.
 *
 * So the provider tells us too. The signature is checked in the adapter
 * before the body is parsed, and this only ever moves a row the provider
 * itself then confirms — settleIfPaid asks again rather than trusting the
 * event, which costs one call and means a forged webhook settles nothing.
 *
 * Off until the notification endpoint is registered with Airwallex and its
 * secret is in .env: make dealio-webhook. Until then, asking is the whole of
 * it, and nothing here fires. */
if (WALLET.on && typeof WALLET.provider.onEvent === "function") {
  WALLET.provider.onEvent((e) => {
    if (e?.type !== "payment.status" || e.status !== "SUCCEEDED" || !e.intentId) return;
    settleByIntent(String(e.intentId))
      .catch((err) => console.error("dealio webhook:", err.message));
  });
}

/* ---------------------------------------------------------------------------
 * STRIPE SAYS THE FEE CLEARED
 *
 * Mounted here with the wallet's webhooks and for the same reason written
 * above: a payment company is not a member, so this route is ahead of the
 * door and carries no device.
 *
 * WHY IT EXISTS. Without it the board's own fee is marked paid because Tom
 * taps a button, which is not automation — it is a bottleneck with his name on
 * it, and every deal in the world waits on him being awake. Stripe knows the
 * moment the money clears and can say so.
 *
 * THE BOARD STILL NEVER TOUCHES THE MONEY. Stripe pays Tom directly. This is
 * Stripe telling the board a thing happened, which is a sentence, not a
 * settlement. Nothing here holds, routes or forwards anybody's funds, so none
 * of it is the licensed business that docs/cross-border-payments.md is about.
 *
 * WHICH DEAL IT WAS: client_reference_id, put on the payment link by the card
 * that drew it and handed back by Stripe untouched. It is a group id, which is
 * twenty hex characters and names a room and nothing else — no person, no
 * amount, nothing that means anything to Stripe or to anybody reading it.
 *
 * SIGNED, AND VERIFIED BY HAND. Twenty lines of HMAC against a dependency and
 * its transitive tree, on a route that anybody on the internet can post to.
 * The raw bytes matter: Stripe signs what it sent, so this cannot be behind
 * express.json — parsing and re-serialising changes the bytes and every
 * signature fails, which is a confusing afternoon.
 *
 * OFF UNLESS BOARD_DEAL_FEE_SECRET IS SET, like everything else optional here.
 * ------------------------------------------------------------------------ */
const FEE_SECRET = (process.env.BOARD_DEAL_FEE_SECRET || "").trim();

/** Stripe's scheme: t=<unix>,v1=<hex>, HMAC-SHA256 over `${t}.${raw}`. */
function stripeSaidIt(raw, header) {
  if (!FEE_SECRET || !raw || !header) return false;
  const parts = Object.fromEntries(String(header).split(",")
    .map((x) => x.split("=")).filter((x) => x.length === 2));
  const t = Number(parts.t);
  if (!Number.isFinite(t)) return false;
  /* Five minutes, so a signature somebody captured is not one they can post
     again tomorrow. */
  if (Math.abs(Date.now() / 1000 - t) > 300) return false;
  const want = createHmac("sha256", FEE_SECRET).update(t + "." + raw).digest("hex");
  const got = String(parts.v1 || "");
  if (got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

app.post("/api/hook/fee", express.raw({ type: "application/json", limit: "64kb" }),
  async (req, res) => {
    if (!FEE_SECRET) return res.status(404).json({ error: "off" });
    const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
    if (!stripeSaidIt(raw, req.get("stripe-signature"))) {
      return res.status(400).json({ error: "signature" });
    }
    let event = null;
    try { event = JSON.parse(raw); } catch { return res.status(400).json({ error: "body" }); }
    /* One event and no others. A webhook that acts on everything Stripe sends
       is a webhook nobody can reason about later. */
    if (event?.type !== "checkout.session.completed") return res.json({ ok: true });

    const session = event?.data?.object || {};
    const ref = String(session.client_reference_id || "");
    if (session.payment_status && session.payment_status !== "paid") return res.json({ ok: true });

    /* TWO SHAPES OF REFERENCE, AND THEY MEAN DIFFERENT THINGS. A bare group id
       is the board's own fee, paid on its own link. `group:row` is a payment
       between the two of them, made through Connect — the money went to the
       payee's account and the board's cut was taken by Stripe on the way. */
    const [id, rowPart] = ref.split(":");
    if (!/^[a-f0-9]{20}$/.test(id)) return res.json({ ok: true });
    const row = rowPart === undefined ? -1 : Number(rowPart);
    if (rowPart !== undefined && !Number.isInteger(row)) return res.json({ ok: true });

    if (row >= 0) {
      const paid = await change((board) => {
        const g = board.groups.find((x) => x.id === id);
        if (!g || !g.deal) return { ok: true };
        const d = g.deal;
        if (!Array.isArray(d.plan) || row >= d.plan.length) return { ok: true };
        d.paid = Array.isArray(d.paid) ? d.paid : [];
        /* Both halves at once, because Stripe saw the money arrive and that is
           a better witness than either of them. Once only: Stripe retries a
           webhook it believes was not received. */
        if (d.paid.some((r) => r.i === row && r.kind === "confirmed")) return { ok: true };
        const at = new Date().toISOString();
        /* `auto` on both: this is Stripe's word, not theirs, and the wallet
           has to be able to say so rather than counting it as two taps. */
        if (!d.paid.some((r) => r.i === row && r.kind === "claimed")) {
          d.paid.push({ i: row, kind: "claimed", who: d.hires, at, auto: true });
        }
        d.paid.push({ i: row, kind: "confirmed", who: d.provides, at, auto: true });
        Object.assign(g, store.cleanGroup(g));
        return { ok: true, tell: (board.people.find((x) =>
          g.members.includes(x.by) && x.handle === d.provides) || {}).by || "" };
      });
      res.json({ ok: true });
      if (paid?.tell) tellThem(paid.tell).catch(() => {});
      return;
    }

    const out = await change((board) => {
      const g = board.groups.find((x) => x.id === id);
      if (!g || !g.deal) return { ok: true };
      const d = g.deal;
      d.feePaid = Array.isArray(d.feePaid) ? d.feePaid : [];
      /* Stripe's word outranks a tap, so this writes `confirmed` whether or
         not the payer claimed it first — the money has demonstrably arrived,
         and waiting for somebody to press a button about it would be the
         bottleneck this route exists to remove. Once, though: Stripe retries
         a webhook it thinks was not received. */
      if (d.feePaid.some((r) => r.kind === "confirmed")) return { ok: true };
      /* `auto` rather than a reserved name in `who`. A handle here has no
         character restrictions, so any sentinel string is a handle somebody
         could one day choose, and the card would then credit a member with
         confirming Stripe's payments. A flag cannot collide with anything. */
      d.feePaid.push({ kind: "confirmed", who: "", auto: true, at: new Date().toISOString() });
      Object.assign(g, store.cleanGroup(g));
      return { ok: true, tell: (board.people.find((x) =>
        g.members.includes(x.by) && x.handle === d.hires) || {}).by || "" };
    });
    res.json({ ok: true });
    if (out?.tell) tellThem(out.tell).catch(() => {});
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

  /* SOMEBODY IN THE WAITING ROOM, WHO MAY READ EVERYTHING AND CHANGE NOTHING.
   *
   * The stage between the list and the room. They see the app as it really is
   * — the people, the rooms, the sentences — because a board you have been
   * told about and never seen is a board you forget about. And every write
   * answers the same way, in one place rather than in forty buttons: `soon`,
   * which the app turns into one line saying the rest is coming.
   *
   * GET AND NOTHING ELSE, and the method is the whole test. It does not depend
   * on anybody remembering to gate a new route: a route added next month is a
   * POST and is refused by this line without being written down anywhere.
   *
   * Their own page is the exception — /api/wait/card and /api/wait/photo are
   * how they finish it, and finishing it is the entire point of the stage.
   * Whoever runs the board reads what they wrote and decides. */
  const upRow = await inWaitingRoom(req);
  if (upRow) {
    /* THE CLOCK IS STARTED IN /api/wait/me, NOT HERE. This line is several
       lines below `if (OPEN_PATHS.test(req.path)) return next()`, and
       OPEN_PATHS matches both /room and /api/wait — so for the person this
       stamp is about it never ran. It is kept as a backstop for any other
       path they reach; the real one is in /api/wait/me, where seeing the
       clock and starting it are the same event.
       Not awaited: a page load must not wait on a write. */
    if (!upRow.upSeen) {
      change((board) => {
        const w = board.waits.find((x) => x.id === upRow.id);
        if (!w || w.upSeen) return null;
        w.upSeen = new Date().toISOString();
        return { ok: true };
      }).catch(() => { /* the next request stamps it */ });
    }
    if (req.method === "GET") return next();
    if (/^\/api\/wait\//.test(req.path)) return next();
    /* Kept, though OPEN_PATHS now lets /api/butler past before this line ever
       runs. It documents the intent at the place somebody will look, and if
       the path is ever taken back out of OPEN_PATHS the waiting room does not
       silently lose him again. */
    /* THE DOORMAN, WHO IS FOR EXACTLY THESE PEOPLE.
     *
     * Mo lives on the waiting room screen and his whole job is getting a
     * sentence out of somebody standing at the door — and the door was
     * refusing him. /api/butler is a POST and it is not under /api/wait/, so
     * every message anybody in the waiting room sent him came back 403
     * "soon", which the page prints as "He is not answering". It was never
     * the key, the model or the network; it was this line.
     *
     * WHICH IS THE COST OF THE RULE ABOVE, and the rule is still right. "The
     * method is the test" means a route added next month is refused without
     * anybody writing it down — no new write can leak through by being
     * forgotten. The flip side is that a route which SHOULD be open has to be
     * remembered here, and this one was not. Two months of silence and an
     * evening finding it, for a feature that was working the whole time.
     *
     * It is safe: /api/butler writes nothing to the board. It takes a
     * conversation, answers it, and the only thing that can change a row is
     * the proposal — which goes through /api/wait/card like everything else,
     * and through this gate on its own account. */
    if (req.path === "/api/butler") return next();
    /* AND THE ROOM THEY ARE STANDING IN.
     *
     * The second write ever opened in this gate, and it is worth being exact
     * about why it is safe, because the rule above — the method is the test —
     * is the thing that has kept this board from leaking a write for months.
     *
     * This does not grant anything. It lets the request reach a route that
     * then decides, and that route's decision is doorAccess(): a member, or
     * somebody waiting in THAT room and no other. A waiting person who posts
     * the id of a member's private group gets "gone" from the same check that
     * refuses a stranger, because the check is on the room and not on the
     * path. Opening the path without that check would be the hole; the check
     * was written first, and this line is what lets anybody reach it.
     *
     * The two reads beside it carry no write at all. /api/door is the room
     * itself, which they are entitled to read or there is no room; /api/queue
     * is refused to them on its own account, further in.
     *
     * WHAT IT IS FOR. A queue is a form and a silence, and forty-seven people
     * are standing in one. This is the line that lets them talk to each other
     * while they wait, which is the difference between a queue and a room. */
    if (req.path === "/api/group/say" || req.path === "/api/door") return next();
    /* AND BROWSE, WHICH ANSWERS THEM WITH FIVE PEOPLE AND A WALL — see the
       peek branch in /api/people. It is a read, it carries no contact detail
       (a profile never does), and the people on it were put there one at a
       time by whoever runs the board. */
    if (req.path === "/api/people") return next();
    if (req.path.startsWith("/api/")) {
      return res.status(403).json({ error: "soon" });
    }
    return next();   // a page, which is a read
  }
  // Anything with a dot in the last segment is a file: the stylesheet and the
  // modules the door is built from have to load for the door to work at all.
  if (/\.[a-z0-9]{2,5}$/i.test(req.path)) return next();

  /* ON THE LIST, NOT YET LIFTED — AND THE ROOM AT THEIR DOOR IS STILL THEIRS.
   *
   * The rooms were built because a queue is a form and a silence and
   * forty-seven people were standing in one. Then the gate above asked for
   * `up`, so the only people who could talk in a door room were the three a
   * day already through it — and the silence stayed exactly where it was, with
   * the whole of the queue reading a screen they could not answer.
   *
   * So being on the list at all is enough for the room. Nothing else moves:
   * `up` still decides who may fill in a card, and that is what being lifted
   * is for. Every rule inside the room is unchanged — doorAccess still only
   * gives them the one room they joined, the contact rule still refuses a
   * WeChat id, the doorman's tripwire still runs, and anybody in there can
   * report anybody.
   *
   * THE PAGES, TOO, or the room has no screen to be on: /room draws it, and a
   * page they cannot load is a room they cannot reach. Reads only — the method
   * is still the test, and the two writes named here are the two this is for.
   */
  const listRow = await onTheList(req);
  if (listRow) {
    if (req.path === "/api/door" || req.path === "/api/group/say") return next();
    if (req.method === "GET") return next();
    return res.status(403).json({ error: "soon" });
  }
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

app.get("/", (req, res, next) => {
  /* Dealio's own name opens on Dealio. Its front page is the one written for
     somebody who has never heard of it — what it is, what it costs, who runs
     it — and the app itself is a tap away at /dealio. */
  if (isDealioHost(req)) return page("pay.html", req, res, next);
  return page(ROOT_IS_BOARD ? "index.html" : "landing.html", req, res, next);
});
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
/* /about USED TO BE THIS PAGE and is now the plain one — see the note over
   its route below. The landing keeps /, /landing.html and every /r/<room>
   address, which is where every link ever sent actually points. "About" is
   what a stranger types when they want to know what a business is, and they
   should get the facts rather than the pitch. */
app.get(["/landing.html"], (req, res, next) => page("landing.html", req, res, next));

/* ONE DOOR, DIFFERENT SIGNS.
 *
 * /r/film is the same page as the landing with the room written into it: the same
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
/* THE LINK OPENS THE ROOM.
 *
 * This served the landing page — a headline, a pitch and two buttons — which
 * is the right page for somebody who found the address cold and the wrong one
 * for somebody a friend has just put into a conversation. They arrived at a
 * sales page for a thing they had already agreed to.
 *
 * So /r/:room is the room: the last lines said in it, and a box asking for a
 * first name. The landing page is still the landing page and is still at "/"
 * and /about, which is where a cold address belongs.
 */
/* The page itself. The token is in the path so the whole thing is one
   address to save to a home screen — no form, no key to remember. */
app.get("/s/:token", (req, res, next) => {
  const given = String(req.params.token || "");
  if (!SNAP || !safeEqual(given, SNAP)) return res.status(404).send("Not found");
  return page("snap.html", req, res, next, { "{{SNAP}}": given });
});

/* Somebody at the door, as a page. Behind the gate like every other page
   about a person — see /api/queue/:id for what it holds and why. */
app.get("/q/:id", (req, res, next) => page("waiting-person.html", req, res, next));

/* The wallet's pages and API, behind the door like the rest of the board. */
app.use(WALLET.routes);
if (WALLET.on) app.get(["/wallet", "/wallet/"], (req, res, next) => page("wallet.html", req, res, next));

app.get("/r/:room", (req, res, next) => {
  if (!store.WAITROOMS_CHAT.includes(String(req.params.room || ""))) {
    // A campaign name rather than a room — /r/agents and the like. The sales
    // page is the right answer for those and always was.
    return page("landing.html", req, res, next);
  }
  return page("door.html", req, res, next);
});

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

/* THE TERMS, WHICH ARE NOT THE HOUSE RULES.
 *
 * /rules is nine lines about behaviour and is the one people read. This is the
 * one that has to exist: an app store will not carry anything that carries
 * what people write without a terms document, a way to report, a way to block,
 * and a stated commitment to act on reports within a day. The first three
 * already existed; this page is where the fourth is said out loud.
 *
 * THE ADDRESS IS THE ONE THAT ALREADY EXISTS. BOARD_CONTACT was added for
 * this exact reason — see the note over it near the top — so this page reuses
 * it rather than introducing a second way to say the same thing. Unset, the
 * page tells somebody to raise it in a room instead, which is true and is
 * better than printing "write to " with nothing after it. */
/* THE DOORMAN'S OWN PAGE. He is in every room's list of people and was the
   only face there that could not be tapped — see mo-page.html for why it is
   not a profile. Behind the door like the rest of the board: he answers
   questions about a place you are already standing in, and the waiting room
   reaches him through the GET rule in the gate. */
app.get(["/mo", "/mo/"], (req, res, next) => page("mo-page.html", req, res, next));
app.get(["/terms", "/terms/"], (req, res, next) =>
  page("terms.html", req, res, next,
    { "{{CONTACT}}": CONTACT.replace(/["\\<>]/g, "").slice(0, 120) }));

/** WHAT THIS PLACE IS, ON A PAGE ANYBODY CAN OPEN.
 *
 *  OPEN ON PURPOSE, like the terms and the rules. Everything else here is
 *  behind an invite, which is the point of it — and it meant there was no
 *  address in the world that said what the business does. Somebody following
 *  the link from our payments profile met a sign-in door, and a door is not a
 *  business. It cost the application.
 *
 *  It reads nothing from the board and takes nothing from whoever opens it.
 */
app.get(["/about", "/about/"], (req, res, next) =>
  page("about.html", req, res, next,
    { "{{CONTACT}}": CONTACT.replace(/["\\<>]/g, "").slice(0, 120) }));

/** THE REWARDS ROOM, AS A PAGE RATHER THAN A ROOM.
 *
 * A self-contained copy of the Film & TV door with the ledger pinned across
 * it: invented people, invented numbers, no network call of any kind, and its
 * own banner at the top saying so. It is the thing to send somebody who is not
 * on this board and cannot be shown a room they are not in.
 *
 * OPEN ON PURPOSE. Behind the door it could not be sent to anybody, which is
 * the only reason it exists. Nothing on it is real, nothing on it is read from
 * this board, and it takes nothing from whoever opens it.
 *
 * It is a design and not a deploy: it shares no code with the live pin, so a
 * change to one does not change the other, and it says "Demo" before it says
 * anything else. The room under the door is the real one.
 */
app.get(["/rewards", "/rewards/"], (req, res, next) => page("rewards.html", req, res, next));
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
/** The row of somebody in the waiting room, or null. Read off the same wait
 *  cookie the room itself uses, or the device header — a browser that cleared
 *  itself still holds the cookie. */
async function inWaitingRoom(req) {
  const said = String(req.get("x-board-device") || req.body?.device || "");
  const me = store.hashDevice(said, SALT) || waitCookie(req);
  if (!me) return null;
  try {
    const board = await store.load(FILE);
    return board.waits.find((w) => w.by === me && w.up && !w.done) || null;
  } catch { return null; }
}

/** On the waiting list at all, lifted or not. The narrower `up` question is
 *  inWaitingRoom above; this one is only ever asked about the room at their
 *  own door. */
async function onTheList(req) {
  const said = String(req.get("x-board-device") || req.body?.device || "");
  const me = store.hashDevice(said, SALT) || waitCookie(req);
  if (!me) return null;
  try {
    const board = await store.load(FILE);
    return board.waits.find((w) => w.by === me && !w.done) || null;
  } catch { return null; }
}

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

/* AND THE THREE THAT LAST TEN MINUTES, FOR THE GOOGLE ROUND TRIP.
 *
 * A sign-in with Google leaves this box, spends time on accounts.google.com
 * and comes back as a fresh GET carrying nothing of ours but cookies — no
 * x-board-device header, because a full-page redirect is not a fetch. So
 * everything the callback needs has to be left here on the way out.
 *
 * `board_gs` is the state, and it is the only one that is a security control:
 * without it somebody can hand a victim a prepared callback URL and sign their
 * browser into an account the attacker owns, then read what they write.
 *
 * `board_gd` is WHO THIS BROWSER ALREADY IS — the salted hash, never the key
 * itself, which stays in localStorage where it has always been. It is what
 * lets a member connect an account without being signed out, and what the row
 * is moved onto when a known account comes back on a new phone.
 *
 * `board_gn` is where they were standing when they pressed it.
 *
 * All three are signed, short, and cleared on the way back in. A bare value in
 * a cookie would be a login anybody could type.
 */
const shortCookie = (res, name, value) => {
  res.append("Set-Cookie", name + "=" + value + "; Path=/; Max-Age=600"
    + "; HttpOnly; SameSite=Lax; Secure");
};
const dropCookie = (res, name) => {
  res.append("Set-Cookie", name + "=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure");
};
const signedCookie = (req, name, shape) => {
  const m = new RegExp("(?:^|;\\s*)" + name + "=(" + shape + ")\\.([a-f0-9]{32})")
    .exec(String(req.headers.cookie || ""));
  return m && sign(m[1]) === m[2] ? m[1] : "";
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
  // And the standing code, when one is set. It is not on any row — it is a
  // setting — so nothing else would ever know it was spoken for, and an
  // invite minted with the same six characters would be dead on arrival: the
  // door reads the standing code first and would sign that stranger in as the
  // operator instead of admitting them as themselves.
  BACK_CODE,
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

  /* THE STANDING CODE, read before the minted ones.
   *
   * Before, because a code that never spends must not be shadowed by a one-use
   * code that happens to match it — codesTaken stops that being minted, but
   * the order is what makes it true rather than likely.
   *
   * REFUSED IF THIS BROWSER IS ALREADY SOMEBODY, exactly as the block below
   * is: two people's rows on one device hash is not a state this board has.
   *
   * NOT SPENT. That is the whole point of it, and it is why this opens one
   * named person and not whoever typed it. */
  if (BACK_CODE && BACK_WHO && safeEqual(code, BACK_CODE)) {
    let standWhy = "";
    const stand = await change((board) => {
      const q = board.people.find((p) => (p.handle || "") === BACK_WHO);
      /* Named a handle nobody on this board has — a setting typed wrong, not
         a stranger guessing. Fall through and let it be answered as a wrong
         code: a public door that says "right code, no such person" is a door
         that has just confirmed the code. */
      if (!q) { standWhy = "nobody"; return null; }
      if (q.by === me) return { handle: q.handle || "" };
      if (board.people.some((p) => p.by === me)) { standWhy = "taken"; return null; }
      store.rebind(board, q.by, me);
      return { handle: q.handle || "" };
    });
    if (standWhy === "taken") return res.status(409).json({ error: "taken" });
    if (stand) {
      setCookie(res, me);
      tries.delete(me);
      return res.json({ ok: true, back: true, handle: stand.handle });
    }
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
    /* AND SOMEBODY INVITED INTO ONE CONVERSATION.
     *
     * No row is made here, unlike the agent above — there is nothing for one
     * to hang off yet and a nameless person in Browse is the thing this whole
     * path exists to avoid. They go in as a guest of the room: they read it,
     * and the composer asks for a name and a sentence. See `guests` on
     * cleanGroup.
     *
     * THE ROOM MAY HAVE FILLED UP while the code sat in a chat window. The
     * code still worked and they are still in — being turned away at this
     * point over somebody else's timing would be the worst version of this —
     * so they land on Browse like anybody else and the room is simply not
     * mentioned. Minting checks the cap; this is the race, not the rule. */
    if (got && got.grp) {
      const landed = await change((board) => {
        const g = board.groups.find((x) => x.id === got.grp);
        if (!g || g.members.includes(me) || store.groupRoom(g) < 1) return false;
        g.guests = [...(g.guests || []), me];
        Object.assign(g, store.cleanGroup(g));
        return true;
      });
      if (landed) {
        return res.json({ ok: true, by: got.who || "", where: "/groups?g=" + got.grp });
      }
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
  /* A CODE THAT OPENS INTO ONE ROOM. See `grp` on cleanInvite for what it is
     for. Refused rather than dropped when the room is not there or is full:
     minting a code that says "this puts you in the conversation" and quietly
     does not is worse than not minting one. */
  let grp = String(req.body?.grp || "");
  /* MAKING THE ROOM AND THE CODE IN ONE ACT.
   *
   * A room has to exist before anybody can be invited into it, and making one
   * takes three people who are already members. So the case this whole path
   * was built for — I have one person, and the third is the one I am bringing
   * in — could not be reached: you were two short of a room you were only
   * making in order to invite somebody into.
   *
   * The third seat is held by the code. Same cap, same clock, and `make
   * groups` counts it the same way, so the room is three from the moment it
   * exists with one of them still walking in. If the code runs out unspent it
   * is a room of two, which is a thread with extra steps and not a danger —
   * the listing says "1 code out" while that is pending, which is the only
   * thing anybody needs to know about it.
   *
   * THE MAKER IS A REAL NAME ON THE BOARD, not the label. Everywhere else
   * `who` is a note to self about who vouched and is never checked against
   * anything. Here somebody has to OWN the room — it is their matches the
   * membership is drawn from, and leaving is the only exit — so it is looked
   * up, and refused by name when it is not found rather than quietly making a
   * room belonging to nobody. */
  const wantRoom = req.body?.room && typeof req.body.room === "object"
    ? req.body.room : null;
  const made = [];
  let bad = "";
  let badWho = [];
  await change((board) => {
    let g = grp ? board.groups.find((x) => x.id === grp) : null;
    if (grp && !g) { bad = "noroom"; return null; }

    if (!g && wantRoom) {
      const find = (name) => board.people.find((q) => q.state === "published"
        && (q.handle || "").toLowerCase() === String(name || "").trim().toLowerCase());
      const maker = find(wantRoom.by);
      if (!maker) { bad = "nomaker"; badWho = [String(wantRoom.by || "")]; return null; }
      const names = (Array.isArray(wantRoom.with) ? wantRoom.with : [])
        .map((x) => String(x || "").trim()).filter(Boolean);
      if (!names.length) { bad = "alone"; return null; }
      /* THE SAME GATE THE APP'S PICKER USES, and read from the same function:
         only people who have matched with whoever is making it. A room minted
         from the box that skipped the rule the button enforces would be a
         second, quieter way into somebody's messages. */
      const allowed = new Map(groupable(board, maker.by).map((c) => [c.handle, c]));
      const members = [maker.by];
      for (const nm of names) {
        const q = find(nm);
        if (!q || !allowed.has(q.handle)) { badWho.push(nm); continue; }
        if (!members.includes(q.by)) members.push(q.by);
      }
      if (badWho.length) { bad = "notmatched"; return null; }
      if (members.length + n > store.GROUP_MAX) { bad = "full"; return null; }
      if (members.length + n < 3) { bad = "few"; return null; }
      g = store.cleanGroup({ id: store.newId(), by: maker.by, members,
                             name: String(wantRoom.name || "").slice(0, 60) });
      if (!g) { bad = "few"; return null; }
      board.groups.push(g);
      grp = g.id;
    }
    /* COUNTED AGAINST THE SAME CAP THE ROOM HAS, and counted BEFORE anybody
       walks in: somebody holding an unspent code for this room is already
       taking the seat. n codes for one room need n seats.
       THE CODES ARE THE HALF THAT WAS MISSING. groupRoom() counts the people
       in the room and the people reading it — both of which are only true
       AFTER somebody walks through the door. Minting five codes for a room
       with one seat passed every check and then turned four arrivals away at
       the far end, which is the failure this cap exists to prevent, moved
       later and made worse. A code that is spent, taken back or run out holds
       nothing; every other one holds a seat. */
    const held = g ? board.invites.filter((x) => x.grp === g.id && !x.off
      && !x.usedBy && !store.inviteOver(x)).length : 0;
    if (g && store.groupRoom(g) - held < n) { bad = "full"; return null; }
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
        grp,
      });
      board.invites.push(v);
      made.push(v);
    }
    return true;
  });
  if (bad) {
    const code = bad === "full" || bad === "few" || bad === "notmatched"
      || bad === "alone" ? 409 : 404;
    return res.status(code).json({ error: bad, who: badWho });
  }
  /* THE ROOM'S NAME AND WHO IS IN IT, so the message can say what the code
     opens into. "Here is your way in" is the wrong sentence for a code that
     drops somebody into a conversation between three named people; that IS
     the invitation and it should be in the message rather than a surprise. */
  let room = null;
  if (grp) {
    const board = await store.load(FILE);
    const g = board.groups.find((x) => x.id === grp);
    if (g) {
      room = {
        name: g.name,
        who: g.members
          .map((h) => board.people.find((q) => q.by === h))
          .filter(Boolean).map((q) => q.handle).filter(Boolean),
      };
    }
  }
  res.status(201).json({ made, room });
});

/* A MEMBER BRINGING SOMEBODY INTO THEIR OWN ROOM.
 *
 * The same code the box mints, asked for from the app by the person whose room
 * it is. It exists because the picker is where somebody notices the person
 * they want is not on here: one match, a button that will not go, and the
 * third person sitting in their phone rather than on this board.
 *
 * STANDING IS THE AUTHORITY, exactly as it is for the code in their header.
 * A group invite is a person let in, and an invite ceiling with a second door
 * beside it is not a ceiling. Nothing new is decided here — this asks
 * standing(), spends one of the day's allowance, and refuses with the same
 * words the header uses.
 *
 * THE ROOM IS THEIRS OR THIS MAKES IT. An existing room only when they made it
 * — membership is drawn from the maker's matches and leaving is the only exit,
 * so somebody else's room is not theirs to add to. Otherwise it is created
 * here from people they have matched with, with the code holding the last
 * seat: the case the picker is looking at.
 */
app.post("/api/group-invite", notesOff, express.json({ limit: "4kb" }), async (req, res) => {
  res.set("Cache-Control", "no-store");
  const me = hashDevice(String(req.body?.device || req.get("x-board-device") || ""), SALT);
  if (!me) return res.status(400).json({ error: "no" });
  if (INVITE && !(await admittedReq(req))) {
    return res.status(403).json({ error: "invite", where: "/enter" });
  }
  const board0 = await store.load(FILE);
  const rank = standing(board0, me);
  if (!rank.can) return res.status(409).json({ error: "standing", need: rank.need, guests: rank.guests });

  const want = String(req.body?.group || "");
  const withWho = (Array.isArray(req.body?.who) ? req.body.who : [])
    .map((x) => String(x || "")).filter((x) => /^[a-f0-9]{20}$/.test(x));
  const label = String(req.body?.name || "").slice(0, 60);
  const today = dayKey(Date.now());

  let bad = "";
  const out = await change((board) => {
    const mine = board.people.find((q) => q.by === me);
    if (!mine || !mine.handle) { bad = "profile"; return null; }
    /* THE DAY'S ALLOWANCE, COUNTED INSIDE THE QUEUE. Same as the header's
       code: two taps on a slow connection would otherwise spend two. */
    const perDay = rank.staff ? Infinity : Math.max(1, Number(rank.perDay) || 1);
    const todays = board.invites.filter((v) => v.by === me && dayKey(v.at) === today);
    if (todays.length >= perDay) { bad = "spent"; return null; }

    let g = want ? board.groups.find((x) => x.id === want) : null;
    /* AND NEVER A ROOM THE OPERATOR KEEPS. An invite is a seat given away by
       somebody in the room; that room's seats are not theirs to give — being
       in it depends on something this board cannot see. See /api/room/hand.
       Flagged through `bad` like every other refusal here, so it comes back
       as a 409 rather than as a 200 carrying an error a page would read as
       success. */
    if (g && g.hand) { bad = "hand"; return null; }
    if (want && (!g || g.by !== me)) { bad = "notyours"; return null; }
    if (!g) {
      const allowed = new Set(groupable(board, me).map((c) => c.who));
      const members = [me];
      for (const id of withWho) {
        if (!allowed.has(id)) continue;
        const q = board.people.find((x) => x.id === id);
        if (q && !members.includes(q.by)) members.push(q.by);
      }
      if (members.length < 2) { bad = "alone"; return null; }
      if (members.length + 1 > store.GROUP_MAX) { bad = "full"; return null; }
      g = store.cleanGroup({ id: store.newId(), by: me, members, name: label });
      if (!g) { bad = "alone"; return null; }
      board.groups.push(g);
    }
    /* SEATS, COUNTING THE CODES NOBODY HAS SPENT. The same sum the box does —
       see the note over POST /api/invite — because a room that fills from one
       door and not the other is a cap with a hole in it. */
    const held = board.invites.filter((x) => x.grp === g.id && !x.off && !x.usedBy
      && !store.inviteOver(x)).length;
    if (store.groupRoom(g) - held < 1) { bad = "full"; return null; }

    const have = codesTaken(board);
    let code = store.newCode();
    while (have.has(code)) code = store.newCode();
    const v = store.cleanInvite({
      code, who: mine.handle, at: new Date().toISOString(), by: me, grp: g.id,
      /* FORTY-EIGHT HOURS, the same as every code minted for one named person
         — see the note on `make invite`. A dead code is a person who decided
         to come in and was turned away. */
      until: new Date(Date.now() + 48 * 3600_000).toISOString(),
    });
    board.invites.push(v);
    return {
      code: v.code, until: v.until, group: g.id, name: g.name,
      // Their own name, so the link can greet whoever it is for with who let
      // them in. The page has no other way to know it.
      from: mine.handle,
      who: g.members.map((h) => (board.people.find((q) => q.by === h) || {}).handle)
        .filter(Boolean),
    };
  });
  if (bad) {
    return res.status(bad === "profile" || bad === "notyours" ? 403 : 409).json({ error: bad });
  }
  if (!out) return res.status(409).json({ error: "no" });
  res.json(out);
});

/* THE ROOMS, FOR WHOEVER RUNS THE BOARD.
 *
 * Only so a group invite can be minted: the code needs an id and an id is not
 * something anybody has in their head. Names and counts, never a word anybody
 * said in one — the operator reading private conversations is a different
 * product from this and `make group-invite` does not need it. */
/* THE FLAGGED LINES, AND ONLY THOSE.
 *
 * The one sanctioned way anybody reads a word said inside a room. A line
 * arrives here because a person in the room reported it or because the
 * doorman's tripwire marked it — both of which are somebody saying out loud
 * that this particular line should be looked at.
 *
 * There is no route that returns a room's conversation, and there should not
 * be. Everything said on this board is in a file on this box in plain text and
 * the product has never claimed otherwise — but a file somebody could open for
 * a reason is a different thing from a screen that shows them conversations,
 * and the second one would have to be written on the privacy page.
 */
app.get("/api/flags", admin, async (_req, res) => {
  const board = await store.load(FILE);
  res.set("Cache-Control", "no-store");
  const name = (h) => h === store.MO ? MO_NAME
    : ((board.people.find((q) => q.by === h) || {}).handle || "");
  res.json({
    flags: board.says.filter((m) => m.report).map((m) => {
      const g = board.groups.find((x) => x.id === m.group);
      return {
        at: m.at, why: m.report, text: m.text, who: name(m.by),
        room: g ? (g.name || "") : "", roomId: m.group,
        // Who else was in the room to see it, which is the other half of how
        // bad a thing is.
        with: g ? g.members.map(name).filter(Boolean) : [],
      };
    }).sort((a, b) => String(b.at).localeCompare(String(a.at))),
  });
});

/** A ROOM KEPT BY HAND, FOR PEOPLE THE BOARD CANNOT TELL APART BY ITSELF.
 *
 *  Every other room here is made by the app out of things the app knows: who
 *  matched, who is at which door. This one exists for the opposite case — a
 *  room whose list depends on something that happened somewhere else and that
 *  no rule in this file can check. An offer signed on the cfm ledger, for
 *  instance: the board has no idea, and should not be taught to guess.
 *
 *  SO THE GATE IS A PERSON WITH THE LEDGER IN FRONT OF THEM. Nobody joins it,
 *  nobody is invited into it, and there is no link. One command puts somebody
 *  in and one takes them out, and both are run by whoever runs the board.
 *
 *  IT IS AN ORDINARY ROOM IN EVERY OTHER RESPECT, deliberately: the contact
 *  rule, the doorman's tripwire, reporting, the other language, @ and the
 *  buzz all work because it is the same `groups` row everything else reads.
 *  A sixth kind of room would have been a sixth set of those to get wrong.
 */
app.post("/api/room/hand", admin, express.json({ limit: "8kb" }), async (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 60);
  if (!name) return res.status(400).json({ error: "name" });
  const add = (Array.isArray(req.body?.add) ? req.body.add : [])
    .map((x) => String(x || "").trim().toLowerCase()).filter(Boolean);
  const drop = (Array.isArray(req.body?.drop) ? req.body.drop : [])
    .map((x) => String(x || "").trim().toLowerCase()).filter(Boolean);

  let miss = [];
  const out = await change((board) => {
    const byHandle = (h) => board.people.find(
      (q) => String(q.handle || "").toLowerCase() === h && q.handle);
    /* NAMED, NOT GUESSED. A handle this board has never heard of is said back
       rather than skipped: a typo that silently adds nobody is a room the
       operator believes somebody is in. */
    const wanted = [];
    for (const h of add) {
      const q = byHandle(h);
      if (!q) { miss.push(h); continue; }
      wanted.push(q.by);
    }
    const goners = new Set(drop.map((h) => (byHandle(h) || {}).by).filter(Boolean));
    for (const h of drop) if (!byHandle(h)) miss.push(h);
    if (miss.length) return { error: "who", miss };

    let g = board.groups.find((x) => x.hand && x.name === name);
    if (!g) {
      /* THE FIRST PERSON IN IS THE ROOM'S MAKER, because a group row has to
         have one — see cleanGroup. It is whoever the operator named first,
         which on this board is the operator. */
      if (!wanted.length) return { error: "empty" };
      g = store.cleanGroup({ id: store.newId(), by: wanted[0],
        members: wanted, name, hand: true }, store.HAND_MAX);
      if (!g) return { error: "no" };
      board.groups.push(g);
      return { ok: true, made: true, id: g.id, who: g.members.length };
    }
    const members = g.members.filter((h) => !goners.has(h));
    for (const h of wanted) if (!members.includes(h)) members.push(h);
    /* ONE IS ENOUGH HERE, and two was wrong. Every other room on this board
       needs two people because one person in a room of their own is not a
       thing anybody means to make. A hand-kept room is the opposite: it is
       opened by the person who will do the putting, before anybody has been
       put in it, and it stands with only them in it for as long as that takes
       — which is why cleanGroup already allows it.

       The route did not. So `make handroom WHO="Tom"` on a room that already
       existed with Tom alone in it came back "that would leave the room with
       nobody in it", about a room with somebody in it. Two rules for one
       thing, and the one further from the data won. */
    if (members.length < 1) return { error: "few" };
    if (members.length > store.HAND_MAX) return { error: "many" };
    /* The maker stays in it. Taking the row's own `by` out leaves a room whose
       maker is not in it, which cleanGroup puts straight back on the next
       load — so it would look done and undo itself. */
    const fresh = store.cleanGroup({ ...g, members, hand: true }, store.HAND_MAX);
    if (!fresh) return { error: "no" };
    board.groups[board.groups.indexOf(g)] = fresh;
    return { ok: true, id: fresh.id, who: fresh.members.length };
  });
  if (out?.error) return res.status(400).json(out);
  res.json(out);
});

/** WHERE SOMEBODY'S MONEY GOES, set from the terminal.
 *
 *  A payee normally sets this themselves: the room shows them a button, Stripe
 *  collects their bank and identity on its own pages, and the id comes back
 *  here. That is the only way it happens in ordinary use and this route does
 *  not change it.
 *
 *  THIS IS FOR TESTING THE OTHER END. A sandbox payee is onboarded from a
 *  terminal rather than by a person tapping a button, so the id exists with
 *  nobody to put it on. Without this the whole payment path cannot be walked
 *  once: Pay only makes a Stripe session when the payee's account is ready,
 *  and an account nobody's row points at is an account the board cannot see.
 *
 *  IT IS AN ACCOUNT ID AND NOTHING ELSE. Twenty to thirty-odd characters of
 *  Stripe's own identifier, checked by cleanPerson. It is not a bank number,
 *  it is useless to anybody who is not this platform, and the board has never
 *  held anything more than this about where money goes.
 */
app.post("/api/person/payee", admin, express.json({ limit: "1kb" }), async (req, res) => {
  const who = String(req.body?.who || "").trim().toLowerCase();
  const acct = String(req.body?.acct || "").trim();
  const off = Boolean(req.body?.off);
  if (!who) return res.status(400).json({ error: "who" });
  if (!off && !/^acct_[A-Za-z0-9]{6,32}$/.test(acct)) return res.status(400).json({ error: "acct" });

  const out = await change((board) => {
    const q = board.people.find(
      (x) => x.handle && String(x.handle).toLowerCase() === who);
    if (!q) return { error: "who" };
    /* cleanPerson keeps `payee` only when it is shaped like an account id, so
       an empty string is how it is removed rather than a delete. */
    q.payee = off ? "" : acct;
    Object.assign(q, store.cleanPerson(q));
    return { ok: true, handle: q.handle, payee: q.payee || "" };
  });
  if (out?.error) return res.status(400).json(out);
  res.json(out);
});

/** A DEAL SHEET, PUT IN A REAL ROOM, SO IT CAN BE LOOKED AT ON A PHONE.
 *
 *  Every screen this board has can be stood up locally with `make try`, except
 *  the one thing that matters about a deal: what it feels like arriving on
 *  your own phone, in a room with somebody you know, with a number on it. That
 *  cannot be screenshotted and it cannot be described.
 *
 *  So this fills one in — both sides named, terms complete, two instalments
 *  with the first settled and the second due, and somewhere for the money to
 *  go — and Mo says one line above it so it does not arrive out of nowhere.
 *
 *  IT SAYS WHAT IT IS, in its own title. A memo carrying invented numbers in
 *  a room with a real person in it, indistinguishable from one they agreed to,
 *  is the kind of thing somebody acts on a week later. OFF=1 takes it away.
 */
app.post("/api/room/deal", admin, express.json({ limit: "2kb" }), async (req, res) => {
  const a = String(req.body?.who || "").trim().toLowerCase();
  const b = String(req.body?.with || "").trim().toLowerCase();
  const off = Boolean(req.body?.off);
  if (!a || !b) return res.status(400).json({ error: "who" });
  if (a === b) return res.status(400).json({ error: "same" });

  let line = "";
  const out = await change((board) => {
    const find = (h) => board.people.find(
      (q) => q.handle && String(q.handle).toLowerCase() === h);
    const one = find(a), two = find(b);
    const miss = [!one && a, !two && b].filter(Boolean);
    if (miss.length) return { error: "who", miss };

    /* The room the two of them already have, if there is one — the same rule
       /api/note/terms follows, so this lands where they would have made it
       themselves rather than opening a second room about the same thing. */
    let g = board.groups.find((x) => !x.hand && x.members.length === 2
      && x.members.includes(one.by) && x.members.includes(two.by));
    if (!g) {
      if (off) return { error: "none" };
      g = store.cleanGroup({ id: store.newId(), by: one.by,
        members: [one.by, two.by], name: "" });
      if (!g) return { error: "no" };
      board.groups.push(g);
    }

    if (off) {
      delete g.deal;
      Object.assign(g, store.cleanGroup(g));
      return { ok: true, id: g.id, off: true };
    }

    const now = new Date();
    const ago = (mins) => new Date(now.getTime() - mins * 60000).toISOString();
    g.deal = store.cleanDeal({
      title: "Two days filming in Shanghai (example)",
      hires: one.handle, provides: two.handle,
      by: one.by, at: ago(30), agreed: [{ who: two.handle, at: ago(20) }],
      what: "Two shooting days, one camera operator, footage handed over on the second night",
      where: "Shanghai",
      when: "3 and 4 March",
      fee: "¥20,000",
      deposit: "Half on agreeing, half when the footage lands",
      covers: one.handle + " pays flights and two nights' hotel",
      cancel: "Called off inside 7 days, the deposit is kept",
      doneIn: "cn",
      payerIs: "person",
      cur: "cny",
      plan: [
        { label: "Deposit", amount: "¥10,000", due: "on agreeing" },
        { label: "Balance", amount: "¥10,000", due: "when the footage lands" },
      ],
      payTo: "https://wise.com/pay/example",
      payToAt: ago(25),
      paid: [
        { i: 0, kind: "claimed", who: one.handle, at: ago(15) },
        { i: 0, kind: "confirmed", who: two.handle, at: ago(10) },
      ],
    });
    if (!g.deal) return { error: "no" };
    Object.assign(g, store.cleanGroup(g));

    /* Mo, so it does not arrive out of nowhere. His line is written here and
       said word for word — no model runs on him, which is the reason anything
       he says can be trusted. */
    line = "Here is an example deal sheet, to see how one reads. The numbers are made up.";
    const row = store.cleanSay({ id: store.newId(), group: g.id, by: store.MO, text: line });
    board.says.push(row);
    return { ok: true, id: g.id, say: row.id, who: [one.handle, two.handle] };
  });
  if (out?.error) return res.status(400).json(out);
  /* Both languages, started after the write — see renderSay. */
  if (out.say) renderSay(out.say, line);
  res.json(out);
});

/** Who is in one. Names, never a word anybody said — same rule as /api/rooms. */
app.get("/api/room/hand", admin, async (req, res) => {
  res.set("Cache-Control", "no-store");
  const name = String(req.query.name || "").trim().slice(0, 60);
  const board = await store.load(FILE);
  const g = board.groups.find((x) => x.hand && x.name === name);
  if (!g) return res.json({ room: null });
  const who = (h) => (board.people.find((q) => q.by === h) || {}).handle || "";
  res.json({
    room: {
      id: g.id, name: g.name, at: g.at,
      who: g.members.map(who).filter(Boolean),
      said: board.says.filter((m) => m.group === g.id).length,
      flags: board.says.filter((m) => m.group === g.id && m.report).length,
    },
  });
});

/** WHO IS IN WHICH LAYER, AND HOW MANY PLACES ARE LEFT IN THE ONE FILLING.
 *
 * A read, and only a read. The arrival number is stamped once and never
 * recomputed — see cleanBoard — so the useful thing this answers is whether
 * the order it was stamped in is the order people actually arrived. The
 * timestamps on the rows decide that, and a row imported late for somebody who
 * was here from the start carries the wrong date. This is how you find that
 * out while it is still cheap to fix.
 *
 * Names rather than counts for the small layers, because "the first three" is
 * a claim about three specific people and reading it back is the only way to
 * check it. Counts past a hundred, where a list stops being readable.
 */
app.get("/api/layers", admin, async (_req, res) => {
  res.set("Cache-Control", "no-store");
  const board = await store.load(FILE);
  const inside = board.people
    .filter((q) => q.state === "published" && q.handle && q.seq)
    .sort((a, b) => a.seq - b.seq);
  res.json({
    cap: store.LAYER_CAP,
    people: inside.length,
    now: store.layerLeft(inside.length),
    layers: store.LAYERS.map((l, i) => {
      const from = i ? store.LAYERS[i - 1].upto + 1 : 1;
      const some = inside.filter((q) => q.seq >= from && q.seq <= l.upto);
      return {
        key: l.key, n: i + 1, of: store.LAYERS.length,
        from, upto: l.upto, places: l.upto - from + 1,
        in: some.length,
        // Readable while a layer is small enough to read. Past that a list of
        // names is not a thing anybody checks, it is a thing anybody scrolls.
        who: l.upto <= 100 ? some.map((q) => q.handle) : [],
      };
    }),
  });
});

/** DEAL THE SEATS AGAIN FROM THE BEGINNING.
 *
 * A destructive command, and it exists because the first rule shipped wrong:
 * every row was stamped, so two profiles that were never published took seats
 * 2 and 3 of the first three and the real members started at 4. A number that
 * is never recomputed is only worth having if the first deal was right, and
 * this is the one way back.
 *
 * IT REFUSES ONCE THE FIRST HUNDRED IS FULL. Up to there the board is small
 * enough that nobody has been told anything a re-deal would make untrue.
 * Past it, somebody has said "I am in the first hundred" to somebody else, and
 * a command that can quietly make that false is worse than a wrong seat. The
 * guard is the point of the route, not a detail of it.
 *
 * Order comes from the date on each row, the same as the ordinary stamp.
 */
app.post("/api/layers", admin, express.json({ limit: "1kb" }), async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (req.body?.restamp !== true) return res.status(400).json({ error: "no" });
  const board = await store.load(FILE);
  const inside = board.people.filter((q) => q.state === "published" && q.handle);
  if (inside.length > store.LAYERS[1].upto) {
    return res.status(409).json({ error: "told", people: inside.length });
  }
  for (const q of board.people) q.seq = 0;
  // Oldest first. board.people is newest-first, so this walks it backwards —
  // the same direction cleanBoard stamps in, for the same reason.
  let n = 0;
  for (let i = board.people.length - 1; i >= 0; i--) {
    const q = board.people[i];
    if (q.state === "published" && q.handle) q.seq = ++n;
  }
  await store.save(FILE, board);
  res.json({ ok: true, dealt: n });
});

app.get("/api/rooms", admin, async (_req, res) => {
  const board = await store.load(FILE);
  res.set("Cache-Control", "no-store");
  const name = (h) => (board.people.find((q) => q.by === h) || {}).handle || "";
  res.json({
    rooms: board.groups.map((g) => ({
      id: g.id, name: g.name, at: g.at,
      by: name(g.by),
      who: g.members.map(name).filter(Boolean),
      guests: (g.guests || []).length,
      said: board.says.filter((m) => m.group === g.id).length,
      /* WHAT IS HAPPENING IN IT, WITHOUT A WORD OF WHAT WAS SAID.
       * When it last moved, and how many lines are marked — by somebody
       * reporting one or by the doorman's tripwire. A room that has gone
       * quiet and a room with something wrong in it are the two things
       * whoever runs this board needs to know, and neither of them needs the
       * conversation. See `make flags` for the one sanctioned way in. */
      last: board.says.filter((m) => m.group === g.id)
        .reduce((a, m) => (String(m.at) > a ? String(m.at) : a), ""),
      flags: board.says.filter((m) => m.group === g.id && m.report).length,
      /* SEATS HELD BY CODES NOBODY HAS SPENT, counted the same way the door
         counts them. A listing that says "room for 2" while minting refuses
         is a listing nobody trusts again. */
      held: board.invites.filter((x) => x.grp === g.id && !x.off && !x.usedBy
        && !store.inviteOver(x)).length,
      room: Math.max(0, store.groupRoom(g) - board.invites.filter((x) =>
        x.grp === g.id && !x.off && !x.usedBy && !store.inviteOver(x)).length),
    })),

    /* THE FIVE ROOMS AT THE DOOR, on the same listing.
     *
     * They are not groups — no row, no members, an id derived from the name —
     * so they were absent from the one screen called Rooms, which made that
     * screen wrong rather than short: most people on this board are standing
     * in one of these and none of them appeared.
     *
     * WHO IS IN ONE IS TWO LISTS, and they are not the same kind of thing.
     * The people waiting in it, which is the queue read by room. And the
     * members who have said something in it — not a membership, because every
     * member can read every door room, but it is the honest answer to who is
     * in there: a member who has never spoken in one is not in it in any sense
     * somebody reading this screen means.
     *
     * NAMES AND COUNTS, NEVER A WORD ANYBODY SAID — the same rule the groups
     * above follow. `make flags` is still the only way a line said in a room
     * is read from outside it. */
    doors: store.WAITROOMS_CHAT.map((key) => {
      const id = store.doorRoom(key);
      const said = board.says.filter((m) => m.group === id);
      const spoke = new Set(said.map((m) => m.by));
      return {
        key, id,
        waiting: board.waits.filter((w) => !w.done && (w.room || "other") === key)
          .map((w) => ({ name: w.name, said: spoke.has(w.by) })),
        /* Deduplicated on the handle and not on the hash: one person on two
           phones is one person in the room, and printing them twice would be
           a screen quietly disagreeing with the queue beside it. */
        inside: [...new Set(board.people.filter((q) => q.handle && spoke.has(q.by))
          .map((q) => q.handle))],
        /* HIS LINES ARE NOT TRAFFIC. The doorman says something when the
           tripwire goes off; counting that as the room talking would make a
           silent room with one flag in it look busy. */
        said: said.filter((m) => m.by !== store.MO).length,
        last: said.reduce((a, m) => (String(m.at) > a ? String(m.at) : a), ""),
        flags: said.filter((m) => m.report).length,
      };
    }),
    max: store.GROUP_MAX,
  });
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

/* A SHOP'S PICTURES, AND ONLY A SHOP'S.
 *
 * Every photograph on a shopfront came back a broken square for the person
 * it is for. /api/public-media is behind the door on purpose — the long
 * note above OPEN_PATHS says why, and it is right: opening it would make
 * every member's face fetchable by anybody holding its id. But a buyer has
 * no account by design, so she was being refused the tins she is looking
 * at, the banner, and the shopkeeper's contact code, and the seller could
 * not see it because he is signed in.
 *
 * SO THIS SERVES SHOP PICTURES AND NOTHING ELSE. The id is looked up in the
 * catalogue, the shop rows and the reviews before a byte is read, exactly
 * the way the waiting-room route below looks its ids up in board.waits. A
 * member's photograph cannot be fetched here whatever id is presented, and
 * the rule this board already made stands as it was.
 *
 * The rows keep storing /api/public-media addresses; the shop's own
 * responses rewrite the prefix on the way out (see shopPic). One route, one
 * answer, and no migration of anything already written.
 */
const SHOP_PIC = "/api/shop-media?id=";
const shopPic = (u) => String(u || "").replace("/api/public-media?id=", SHOP_PIC);

app.get("/api/shop-media", async (req, res) => {
  const id = String(req.query.id || "");
  if (!/^[a-f0-9]{20}$/.test(id)) return res.status(404).json({ error: "no" });
  const board = await store.load(FILE);
  const mine = (u) => String(u || "").includes(id);
  /* THE SHOPKEEPER'S OWN FACE WAS NOT ON THIS LIST, so it 404'd and the
     <img> removed itself, and the one page whose whole job is "a person is
     behind this" had nobody on it. Published only — the same gate
     /api/shop/:who uses, and the same one /p/:handle uses — so a face
     waiting in the queue stays in the queue. */
  const ours = board.products.some((p) => mine(p.photo))
    || board.people.some((p) => mine(p.shop?.banner) || mine(p.shop?.qr)
      || (p.photoState === "published" && mine(p.photo)))
    || board.reviews.some((r) => mine(r.photo));
  if (!ours) return res.status(404).json({ error: "no" });
  const found = await findMedia(id);
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

/* THE OTHER LANGUAGE OF ONE MESSAGE, RENDERED ONCE AND KEPT.
 *
 * Same shape as renderBio and for a harder reason. The board is half Chinese
 * and half English, and the rooms are where those two halves are supposed to
 * meet — a Chinese agent and an Australian director at the same door is the
 * whole product. A room where each reads the other as characters they cannot
 * parse is not a room, it is two rooms with one scrollbar.
 *
 * NOT ON A TAP. A button is a thing people do not see, and the requirement
 * was that this be obvious. Rendered when the line is said, so the language
 * button swaps text and nobody has to know a feature exists.
 *
 * NOT IN THE REQUEST PATH. The message is already written down and already
 * delivered; this lands a second later and a failure costs it nothing.
 *
 * SKIPPED WHERE IT WOULD SAY NOTHING. A line with no letters in it — a
 * number, an emoji, a link on its own — has no other language, and spending
 * a call to find that out is the definition of a bill for nothing.
 */
const WORDY = /[\p{L}]{2}/u;

/** BOTH LANGUAGES OF ONE LINE, WHATEVER IT WAS WRITTEN IN.
 *
 *  Returns { lang, alt, alt2 } or null.
 *
 *  ORDINARY CASE, ONE CALL. Written in Chinese or English, so one render
 *  covers the other half of the room. `lang` is the source, `alt` is the
 *  other, `alt2` is empty. That is every line on this board until somebody
 *  writes in a third language, and it is the case worth not paying twice for.
 *
 *  THE THIRD LANGUAGE, TWO CALLS. German, Russian, Korean. One render can
 *  only serve half the room — until now a German line came back as Chinese
 *  and was stored as "en", so the Chinese half read it fine and the English
 *  half was shown German. So the second call is made, and only then: `alt` is
 *  the Chinese, `alt2` is the English, and `lang` says it is neither.
 *
 *  The script cannot decide this — German is Latin letters, the same as
 *  English — so the model is asked, and `lang` in its answer is what settles
 *  it. See the JSON shape in lib/translate.js.
 */
async function renderPair(words, by) {
  const one = await translate(words, { by }).catch(() => null);
  if (!one || one.error || !one.text) return null;
  const lang = String(one.from || "").slice(0, 2).toLowerCase();
  if (lang === "zh" || lang === "en" || !lang) {
    return { lang: lang || "en", alt: one.text, alt2: "" };
  }
  /* Neither, so `one` is whichever the first pass produced — Chinese, since
     the script guess reads non-Han as English and renders it to Chinese. The
     second call is the English, asked for explicitly rather than guessed. */
  const two = await translate(words, { by: by + ":en", to: "en" }).catch(() => null);
  return {
    lang,
    alt: one.text,
    alt2: two && !two.error && two.text ? two.text : "",
  };
}

function renderSay(id, text) {
  const words = String(text || "").trim();
  if (!words || !WORDY.test(words) || !translateReady()) return;
  renderPair(words, "say:" + id)
    .then((out) => {
      if (!out) return;
      return change((board) => {
        const m = board.says.find((x) => x.id === id);
        // Gone, or reported and removed while this was in flight.
        if (!m || String(m.text || "").trim() !== words) return null;
        m.alt = out.alt;
        m.alt2 = out.alt2;
        m.lang = out.lang;
        return true;
      });
    })
    .catch(() => { /* the line stands in one language, as it did before */ });
}

/* THE OTHER LANGUAGE OF A WAITING PERSON'S LINE. renderBio for a wait row —
 * see the note there, and the one over whyAlt in cleanWait. The member
 * deciding about somebody at the door is the reader who most needs to
 * understand what they wrote, and half of them read Chinese.
 */
function renderWhy(id, text) {
  const words = String(text || "").trim();
  if (!words || !WORDY.test(words) || !translateReady()) return;
  renderPair(words, "why:" + id)
    .then((out) => {
      if (!out) return;
      return change((board) => {
        const w = board.waits.find((x) => x.id === id);
        if (!w || String(w.why || "").trim() !== words) return null;
        w.whyAlt = out.alt;
        w.whyAlt2 = out.alt2;
        w.whyLang = out.lang;
        return true;
      });
    })
    .catch(() => { /* the line stands in one language */ });
}

/* THE OTHER LANGUAGE OF ONE PERSON'S LINE, RENDERED ONCE AND KEPT.
 *
 * See goalAlt in cleanPerson for why this exists at all. The short of it: the
 * language button switches every string on the board except the one on the
 * card, because that one is theirs — so the card was the only English thing
 * on a Chinese screen, on the screen that IS the product.
 *
 * NOT IN THE REQUEST PATH. Nothing waits on this: the save answers, and the
 * render lands a second later. A model on the far side of a mainland
 * connection must never be the reason somebody's profile takes four seconds
 * to save, and a failure here must cost the save nothing.
 *
 * ONCE PER LINE, NOT ONCE PER READER. Checked against the text it was made
 * from, so re-saving a profile without touching the line spends nothing, and
 * changing one word re-renders. `translate` detects the direction from the
 * text, so a Chinese line gets an English one and nobody has to say which.
 */
function renderBio(id, text) {
  const words = String(text || "").trim();
  if (!words || !translateReady()) return;
  renderPair(words, "bio:" + id)
    .then((out) => {
      if (!out) return;
      return change((board) => {
        const q = board.people.find((x) => x.id === id);
        // Gone, or written again while this was in flight — the newer line
        // wins and has its own render on the way.
        if (!q || String(q.goal || "").trim() !== words) return null;
        q.goalAlt = out.alt;
        q.goalAlt2 = out.alt2;
        q.goalLang = out.lang;
        return true;
      });
    })
    .catch(() => { /* the line stands in one language; nothing is lost */ });
}

/* THE LAYER THE NEXT PERSON THROUGH THE DOOR WOULD LAND IN, and how many
 * places are left in it.
 *
 * Counted on people with a page, which is the same count the public line and
 * the member panel already use — "in" has to mean the same thing everywhere it
 * is said, or the number that closes a layer disagrees with the number beside
 * it on the next screen.
 *
 * WHY THE PLACES LEFT ARE WORTH SHOWING AT ALL. It is the only figure in this
 * whole scheme that is true without anybody maintaining it, and it is the one
 * that makes an edge mean something: a layer nobody can see filling is a layer
 * nobody hurries for. See store.LAYERS for why there is no money beside it.
 */
const layerNow = (board) =>
  store.layerLeft(board.people.filter((q) => q.state === "published" && q.handle).length);

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
  /* THE LAYER, AND NOT THE NUMBER UNDERNEATH IT.
   *
   * `seq` is where somebody stands in arrival order and it stays on the
   * server. "You are the 47th member" is exactly the per-person precision the
   * bands exist to remove: it invites two people who are meant to be identical
   * to work out which of them is ahead, and it gives somebody a number they
   * cannot repeat to anybody without explaining it. The band is the fact worth
   * having, and it is the one a person says out loud. See store.LAYERS. */
  seq: undefined,
  layer: (() => {
    const l = store.layerOf(q.seq);
    // layerOf carries the arrival number for the server's own use. It does not
    // leave the building — see the note above — so it comes off here, where
    // the rest of what a reader may not have is taken off.
    return l ? { key: l.key, n: l.n, of: l.of, upto: l.upto } : null;
  })(),
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

  const parts = [{ key: "found", n: seat, points: FOUND(seat) }, ...actsOf(board, who)]
    .filter((r) => r.points > 0);

  return { points: parts.reduce((a, r) => a + r.points, 0), parts, seat };
}

/* ---------------------------------------------------------------------------
 * THE PIN OVER A DOOR ROOM — a second, larger ledger
 *
 * The founding ledger above is a hundred seats and a closing date. This is the
 * same idea run to a much larger number and pinned where people already are.
 * Everything it shows is read from the board; the only thing stored for it is
 * who pressed Join, and that goes in a file of its own beside board.json so
 * cleanBoard never has to know about it.
 *
 * OFF UNLESS BOARD_LEDGER_GOAL IS SET, and that is not a detail. With it unset
 * the endpoint answers {on:false} and the pin is never drawn, which means this
 * whole thing ships dark and turning it on is a deliberate act taken on the
 * box. It is the feature most likely to need turning off in a hurry.
 *
 * WHAT THE COPY SAYS, AND WHO HAS NOT READ IT. The pin tells members the
 * company intends to make a share offer at the goal, allocated by points. That
 * is question 14 in the brief written for counsel and no lawyer has answered
 * it. It is here because the operator asked for it twice, knowing that; it is
 * recorded here because the next person reading this file should not have to
 * reconstruct whether anybody thought about it.
 *
 * IT IS TIERS NOW, NOT A CURVE, and that was the whole redesign.
 *
 * A place used to be worth 1000/n^0.35 — smooth, defensible, and unsayable.
 * Member 4,712 got a different number from member 4,711 and neither of them
 * could repeat it to anybody. Worse, the screen led with the goal: "40 of
 * 50,000", a bar at a twelfth of one per cent, which is a mountain with no top
 * in sight and the opposite of a reason to join this afternoon.
 *
 * So the ledger stands on store.LAYERS: the first ten, the first hundred, the
 * first thousand, the first ten thousand — four NESTED sets, so a place in the
 * first ten is also in the other three and holds a share of all four. Points
 * per place come out 4,442 / 842 / 122 / 14 (see store.tierPoints for the
 * weights and why they are not equal), and the screen leads with the set that
 * is filling and how many places are left before it shuts. That number is
 * small, true, falls while you look at it, and is a sentence somebody says
 * out loud.
 *
 * THE GOAL IS STILL THE GOAL and it is a different number. The tiers close at
 * 10,000; BOARD_LEDGER_GOAL is how many members the company is aiming at
 * before any of this means anything. Everybody past 10,000 is a member with no
 * place, earning the other half from what they do.
 * ------------------------------------------------------------------------- */

/** The goal. Unset, none of this exists. */
const LGOAL = Math.max(0, Math.round(Number(process.env.BOARD_LEDGER_GOAL || 0)));
/** Guests counted for one member. Beyond this the board is one person's. */
const LGUESTS = (() => {
  const v = Number(process.env.BOARD_LEDGER_GUESTS);
  return Number.isInteger(v) && v > 0 ? v : 10;
})();
/* HOW THE POOL IS DIVIDED: this much by place, the rest by what people did.
 *
 * Seventy and thirty. The place half is fixed the day somebody joins and can
 * never fall, which is what makes it worth arriving for; the other half keeps
 * moving until the cutoff, which is what makes it worth staying for. One
 * number without the other is either a lottery you won by being early or a
 * treadmill with no reason to have come. */
const LSPLIT = (() => {
  /* BLANK IS UNSET, AND NOUGHT IS NOUGHT.
   *
   * Number("") is 0, and 0 passes every test this had — finite, at least
   * nought, at most a hundred — so a `TOMSCODING_BOARD_LEDGER_SPLIT=` line
   * with nothing after it, which is exactly what .env.example seeds, set the
   * place half to nought per cent of the pool. Every share on every screen
   * came out 0%, every currency figure came out $0, and nothing anywhere said
   * why. Nought is a legal value for this one, so blank cannot be allowed to
   * mean it: the string is tested before the number is. */
  const raw = String(process.env.BOARD_LEDGER_SPLIT ?? "").trim();
  if (!raw) return 70;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 && v <= 100 ? v : 70;
})();
/** The day the counting stops, and the day the goal is meant to be reached.
 *  Dates rather than prose: the screen says them in whichever language it is
 *  being read in, and a date typed as English prose cannot be. */
const LUNTIL = String(process.env.BOARD_LEDGER_UNTIL || "").trim().slice(0, 10);
const LBY = String(process.env.BOARD_LEDGER_BY || "").trim().slice(0, 10);

/* THE WHOLE POOL OF PLACE POINTS, which a share is divided by.
 *
 * Every place there will ever be, which the store holds as one figure because
 * the four sets it is split across are nested and unequal — see tierPoints.
 * Against the places taken so far instead, an early share would read as an
 * enormous fraction and then fall as the board fills, and a number that only
 * ever goes down is a grievance waiting to happen. Same argument as POOL.
 *
 * IT NO LONGER MOVES WITH THE GOAL, and that is the point of tiers: raising
 * the target from 50,000 members to 100,000 used to quietly halve what every
 * existing member's place was worth as a fraction. Now the goal is what the
 * company is aiming at and the pool is what the ledger holds, and the two are
 * free to be different numbers. */
const LPOOL = store.PLACE_POOL;

/** The ladder, as its own edges: what a place in each tier is worth. Four
 *  numbers rather than a curve in five samples — they are the thing itself. */
const LSCALE = store.LAYERS.map((l) => l.upto);

/* WHICH DOORS CARRY IT, AND BY DEFAULT NONE DO.
 *
 * The goal switch turns the ledger on; this decides where anybody sees it. An
 * empty list means no door room shows it at all, which is the default on
 * purpose: turning the ledger on and having five rooms full of people read a
 * sentence about share offers in the same breath is one env var too few.
 *
 * A hand-kept room always carries it when the ledger is on, and needs no
 * listing. That is what a hand-kept room is — the operator put every person in
 * it themselves — so it is the one room where showing somebody this cannot
 * surprise anybody, and it is the place to look at it before a real door does.
 */
const LPLACES = ["wait", ...store.WAITROOMS_CHAT];
const LROOMS = new Set(String(process.env.BOARD_LEDGER_ROOMS || "")
  .split(",").map((x) => x.trim().toLowerCase()).filter((x) => LPLACES.includes(x)));

/* MONEY, AND ONLY IF THE OPERATOR DECIDED THE TWO NUMBERS.
 *
 * The same rule the seat ledger above runs on, and for the same reason. A sale
 * figure and what share of the company the pool represents. Neither has a
 * default and neither is guessed: unset, the panel shows points and a
 * percentage and no currency appears anywhere on it.
 *
 * WHAT IT IS AND IS NOT. It is arithmetic on two numbers the operator typed:
 * at a sale of X, a pool worth Y% of the company, your place is worth this
 * much of it. The screen says that in those words. It is not a valuation,
 * nobody has done one, and it is not a forecast — the design this came from
 * carried a "Future Value, est. Mar 2027", which is a projection of a number
 * that does not exist yet and is the one thing on that screen no board could
 * honestly draw.
 *
 * ONLY THE PLACE HALF IS PRICED. That half is fixed the day somebody joins
 * and divided by every place there will ever be, so it can be worked out
 * today and cannot fall. The activity half is divided by what everybody does
 * between now and the cut-off, and a figure whose denominator is still moving
 * is a figure that would be wrong tomorrow. It is named and left unpriced.
 */
const LSALE = Math.max(0, Number(process.env.BOARD_LEDGER_SALE || 0));
/* AND WHAT IT MIGHT BE WORTH AT THE GOAL, which is the comparison anybody
   actually wants and the one the sliding scale was failing to make.
   THE SHARE ITSELF DOES NOT MOVE between the two — it is divided by every
   place there will ever be, which is what stops it falling as the board fills.
   So the only thing that differs is what the company is worth, and that is a
   second number the operator types, not something this board can work out. */
const LSALE_AT = Math.max(0, Number(process.env.BOARD_LEDGER_SALE_AT || 0));
const LCUT = Math.min(100, Math.max(0, Number(process.env.BOARD_LEDGER_CUT || 0)));
/* Not `moneyOn` — the seat ledger above owns that name, and two switches with
   one name is how a screen ends up gated on the wrong one.
   EITHER FIGURE TURNS IT ON, and that matters. It was SALE and CUT, so putting
   "what your share comes to at the goal" on the screen forced a second number
   onto it — what the company is worth TODAY — which is a weaker claim, a
   smaller figure, and one the operator may have no wish to publish. The two
   are separate sentences and either can be said without the other. */
const pinMoneyOn = () => LCUT > 0 && (LSALE > 0 || LSALE_AT > 0);

const pinOn = () => LGOAL > 0;

/* IS THIS THE APP ASKING, RATHER THAN A BROWSER?
 *
 * ---------------------------------------------------------------------------
 * WHY THE BOARD NEEDS TO KNOW, AND IT IS ONE SCREEN ONLY
 *
 * The rewards panel says, in pin.ifYesBody and on every render: "The company
 * intends to make a share offer to everyone on the ledger, allocated by
 * points, with its own offer document."
 *
 * That sentence is fine on a web page a member was invited to. Inside an App
 * Store build it is a different thing in two ways, and both of them are real:
 *
 *   APPLE. Guideline 3.2.1(viii) — apps for financial trading, investing or
 *   money management are to be submitted by the financial institution
 *   performing the service. A screen putting a dollar figure on a stake reads
 *   as exactly that, and 5.0 Legal sits behind it.
 *
 *   EVERYBODY ELSE. An offer of shares to people who are not accredited
 *   investors is regulated conduct in the US, the UK, the EU and China. A
 *   rejection costs a week. The other one does not.
 *
 * WHAT WAS TRIED FIRST AND IS NOT ENOUGH: emptying the three money variables.
 * BOARD_LEDGER_CUT, _SALE and _SALE_AT only remove the FIGURES. The share
 * offer sentence is not gated on them — it is drawn every time the panel is —
 * so that leaves the promise up and takes away the arithmetic under it, which
 * is the worst of both. Emptying BOARD_LEDGER_GOAL turns the whole panel off,
 * and turns it off for the members already looking at it, because one
 * container serves both hostnames and these are read once at boot.
 *
 * So: the panel is a web feature. It stays exactly as it is for everybody who
 * was invited to it, and the app does not have it.
 *
 * HOW IT IS DETECTED. capacitor.config.json appends "TheExchangeApp" to the
 * user agent, so the app announces itself on every request. A user agent is
 * trivially forged and that is fine here: forging it HIDES a screen from you
 * rather than revealing one, so the worst somebody can do with this is opt
 * themselves out of a panel they could have read anyway.
 *
 * Nothing else in the app changes. This is not a cut-down build. */
const inApp = (req) =>
  /TheExchangeApp/.test(String(req.get("user-agent") || ""));
/** What a place is worth: the tier it falls in, and nought past the last. */
const PLACE = (n) => store.tierPoints(n);

/* WHO PRESSED JOIN, IN A FILE OF ITS OWN.
 *
 * Beside board.json rather than in it. This is a prototype and cleanBoard is
 * the thing every other feature on this board trusts to be right — a field
 * added to it for a widget that may come out next week is a field every future
 * reader has to work out the status of. One file, one purpose, deletable. */
const LFILE = path.join(DIR, "ledger-proto.json");
async function joins() {
  try {
    const d = JSON.parse(await readFile(LFILE, "utf8"));
    return Array.isArray(d?.joined) ? d.joined.filter((x) => typeof x === "string") : [];
  } catch { return []; }
}
async function joined(who) {
  const all = await joins();
  if (all.includes(who)) return all;
  all.push(who);
  const tmp = LFILE + ".tmp";
  await writeFile(tmp, JSON.stringify({ joined: all }, null, 2) + "\n", "utf8");
  await rename(tmp, LFILE);
  return all;
}

/** THE BOARD'S OWN GROWTH, as a handful of points across its whole life.
 *
 * Cumulative members at evenly spaced moments from the first arrival to now.
 * Read from the arrival dates already on the rows — nothing is stored for it
 * and nothing is projected from it. It is the one figure on this panel that
 * moves for a reason outside the reader's own doing, which is what makes it
 * worth drawing rather than stating.
 *
 * Eight points, because a phone-width sparkline with more is a texture.
 */
function trendOf(board) {
  const at = board.people
    .filter((q) => q.state === "published" && q.handle && q.at)
    .map((q) => Date.parse(q.at)).filter((t) => Number.isFinite(t)).sort((a, b) => a - b);
  if (at.length < 2) return [];
  const first = at[0], last = Math.max(at[at.length - 1], Date.now());
  const span = last - first;
  if (span <= 0) return [];
  const out = [];
  for (let i = 0; i < 8; i++) {
    const t = first + (span * i) / 7;
    /* How many had arrived by then. A running index rather than a filter per
       point: the same walk answers all eight. */
    let n = 0;
    while (n < at.length && at[n] <= t) n++;
    out.push({ t: new Date(t).toISOString().slice(0, 10), n });
  }
  return out;
}

/** One member's line on the pin. Everything read, nothing stored.
 *
 * `asNew` asks for the shape somebody standing outside would see instead of
 * the reader's own. It exists because the operator cannot see that screen any
 * other way: they are a member, the arrival view is for people who are not,
 * and the only honest alternative is a second phone and a spare invite code.
 * Staff only — see the check at the route. */
function pinFor(board, who, asNew) {
  const mine = asNew ? null : board.people.find((q) => q.by === who && q.handle);
  /* THE PLACE IS THE STAMPED ARRIVAL NUMBER, not a position worked out from
     the dates each time. Derived, it moves: two rows that were never published
     were holding seats 2 and 3 of the first three on the live board until the
     stamp was fixed, and a place that moves after somebody has told a friend
     where they stand is worse than no place at all. See cleanBoard. */
  const place = mine && mine.seq ? mine.seq : 0;
  const members = board.people.filter((q) => q.state === "published" && q.handle).length;
  /* NOT IN YET, AND THE ANSWER IS NOT A NOUGHT.
   *
   * Somebody standing in the waiting room has no place, because a place is
   * stamped when a page goes up. Telling them they have none is true and
   * useless: what they came to find out is whether it is worth going on, and
   * the honest answer to that is the place they would get if they did, and
   * what it is worth. It moves down while they think about it, which is the
   * whole of the argument for not thinking about it long.
   *
   * Past the goal there is genuinely nothing, and that is said instead. */
  const next = members + 1;
  /* SHUT IS THE LAST TIER'S EDGE, NOT THE GOAL. They used to be the same
     number and are not any more: the ledger closes at 10,000 and the company
     is aiming at a larger figure. Past the cap there is no place to be had,
     which is what this screen is about — the other half, for what somebody
     does, is not on this pin. */
  if (!place) {
    return !store.layerOf(next)
      ? { on: true, place: 0, shut: true, ...common(members, board) }
      : { on: true, place: 0, soon: next, soonPts: PLACE(next),
          soonTier: store.layerOf(next),
          scale: LSCALE.map((at) => ({ at, pts: PLACE(at) })),
          band: LSCALE.find((at) => next <= at) || LSCALE[LSCALE.length - 1],
          share: LPOOL ? (PLACE(next) / LPOOL) * (LSPLIT / 100) * 100 : 0,
          money: pinMoneyOn() && LSALE > 0 && LPOOL
            ? Math.round(LSALE * (LCUT / 100) * (PLACE(next) / LPOOL) * (LSPLIT / 100))
            : null,
          moneyAt: pinMoneyOn() && LSALE_AT > 0 && LPOOL
            ? Math.round(LSALE_AT * (LCUT / 100) * (PLACE(next) / LPOOL) * (LSPLIT / 100))
            : null,
          sale: pinMoneyOn() && LSALE > 0 ? LSALE : null,
          saleAt: pinMoneyOn() && LSALE_AT > 0 ? LSALE_AT : null,
          cut: pinMoneyOn() ? LCUT : null,
          ...common(members, board) };
  }
  if (!store.layerOf(place)) {
    return { on: true, place: 0, shut: true, ...common(members, board) };
  }
  const acts = actsOf(board, who, LGUESTS).filter((r) => r.points > 0);
  const placePts = PLACE(place);
  const done = acts.reduce((a, r) => a + r.points, 0);
  return {
    on: true, place, placePts,
    /* WHICH TIER THEY ARE IN, which is the thing they tell people. The number
       is what it is worth; the tier is what it is called. */
    yourTier: store.layerOf(place),
    parts: acts,
    acts: done,
    total: placePts + done,
    /* THE HALF OF THE POOL THEIR PLACE ALONE IS WORTH, and the sentence that
       goes with it on the screen is "and it never falls" — which is true, and
       is the only figure here that is. It is their place over every place
       there will ever be, times the place half of the split. */
    share: LPOOL ? (placePts / LPOOL) * (LSPLIT / 100) * 100 : 0,
    /* What that share comes to at the operator's own two numbers, or null.
       Rounded to whole units: a figure this soft printed to the cent is a
       precision nobody has earned. */
    /* NULL, NOT NOUGHT, when no figure for today was given. Rounded, an unset
       LSALE came out as a real number — and "$0" beside somebody's share is
       the screen making a claim rather than declining to. */
    money: pinMoneyOn() && LSALE > 0 && LPOOL
      ? Math.round(LSALE * (LCUT / 100) * (placePts / LPOOL) * (LSPLIT / 100))
      : null,
    moneyAt: pinMoneyOn() && LSALE_AT > 0 && LPOOL
      ? Math.round(LSALE_AT * (LCUT / 100) * (placePts / LPOOL) * (LSPLIT / 100))
      : null,
    sale: pinMoneyOn() && LSALE > 0 ? LSALE : null,
    saleAt: pinMoneyOn() && LSALE_AT > 0 ? LSALE_AT : null,
    cut: pinMoneyOn() ? LCUT : null,
    /* THE CURVE IN FIVE NUMBERS, and which of them their place sits under.
       A curve drawn on a phone is a picture nobody reads; five boxes with the
       one you are in lit up is the same fact and it is read at a glance. */
    scale: LSCALE.map((at) => ({ at, pts: PLACE(at) })),
    band: LSCALE.find((at) => place <= at) || LSCALE[LSCALE.length - 1],
    ...common(members, board),
  };
}

/** THE TIER FILLING RIGHT NOW, which is the whole front of the screen.
 *
 *  Not "40 of 50,000". That bar is a twelfth of one per cent and it says the
 *  thing is hopeless; this one says sixty places left in the first hundred,
 *  which is small, true, falls while somebody reads it, and is a sentence they
 *  repeat. `nextPts` is there so the screen can say what missing it costs
 *  without anybody having to work out the factor themselves.
 *
 *  Null once the last tier has closed — see the note over store.LAYERS. */
function tierNow(members) {
  const l = store.layerLeft(members);
  if (!l) return null;
  const from = store.layerFrom(l.n);
  return {
    key: l.key, n: l.n, of: l.of, from, upto: l.upto,
    left: l.left, size: l.upto - from + 1,
    taken: Math.max(0, members - from + 1),
    pts: store.tierPoints(members + 1),
    /* What the place after this tier shuts is worth. Nought when this is the
       last one, and then the screen says the ledger closes rather than that
       the next place is worth nothing — a different fact. */
    nextPts: store.tierPoints(l.upto + 1),
  };
}

/** The things every shape of the answer carries, so three returns cannot come
 *  to three different views of the same board. */
const common = (members, board) => ({
  members, goal: LGOAL, split: LSPLIT, rest: 100 - LSPLIT,
  until: LUNTIL, by: LBY, guests: LGUESTS,
  cap: store.LAYER_CAP,
  tier: tierNow(members),
  /* THE LADDER ITSELF, so the screen can draw all four tiers with the reader's
     own lit. Sent rather than hard-coded in the browser: two copies of this
     table is how a screen ends up promising a number the ledger does not pay.
     See the note over actsOf, which is the same argument. */
  tiers: store.LAYERS.map((l, i) => {
    const from = store.layerFrom(i + 1);
    return { key: l.key, n: i + 1, from, upto: l.upto,
             size: l.upto - from + 1, pts: store.tierPoints(l.upto) };
  }),
  /* PLACES LEFT BEFORE THE LEDGER SHUTS FOR GOOD. The tier's own `left` is
     the urgent one; this is the long one, and they are different numbers. */
  left: Math.max(0, store.LAYER_CAP - members),
  trend: board ? trendOf(board) : [],
});

/** WHAT SOMEBODY HAS DONE FOR OTHER PEOPLE, priced on WORTH and nothing else.
 *
 * Lifted out of stakeOf so the founding ledger and the pin over a door room
 * read one set of rules. The note over WORTH says why in so many words — "two
 * places is how a screen ends up promising a number the ledger does not pay" —
 * and a second copy of this, written at four in the morning to get a widget up,
 * is exactly the way that happens.
 *
 * `cap` bounds the guests counted, because the pin's cohort is tens of
 * thousands rather than a hundred and one member who brings two hundred people
 * in would otherwise be the whole board. Unbounded when it is not given, which
 * is what the founding ledger has always done.
 */
function actsOf(board, who, cap = Infinity) {
  const live = (p) => p.state === "published" && !p.like && !p.report;
  const myIds = new Set(board.posts
    .filter((p) => p.by === who && live(p) && !p.re).map((p) => p.id));

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

  const kept = Math.min(guests.length, cap);
  return [
    { key: "guests", n: kept,           points: kept * WORTH.guest },
    { key: "heard",  n: answerers.size, points: answerers.size * WORTH.heard },
    { key: "cards",  n: cards,          points: cards * WORTH.card },
    { key: "weeks",  n: weeks,          points: weeks * WORTH.week },
  ];
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

/** Is this device one of the operator's? By handle, because that is what
 *  BOARD_STAFF holds and a handle is what a person knows about themselves.
 *
 *  Any of their rows counts: an operator who also keeps a page for a company
 *  is the same person at the same door. Empty BOARD_STAFF answers false for
 *  everybody, which is every deployment that has not set it. */
function isStaff(board, by) {
  if (!STAFF.size || !by) return false;
  return board.people.some((q) => q.by === by
    && STAFF.has(String(q.handle || "").toLowerCase()));
}

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

  /* BROWSE, FROM OUTSIDE THE DOOR, AND THEN A WALL.
   *
   * The waiting room was a form and a clock. The one thing that would make
   * somebody stay in it is seeing who is inside — so a handful of members are
   * browsable from out there, chosen one at a time by whoever runs the board
   * (see `peek` in cleanPerson), and after them the list stops and says how
   * many it is not showing.
   *
   * FIVE, NOT FIFTY. Browsing is what people came for; a preview that goes on
   * long enough to answer "is this worth waiting for" is doing its job, and
   * one that goes on longer is just the board, given away at the door.
   *
   * NOTHING ABOUT THE READER on these cards. No `following`, no `mine`, no
   * `shared` — those are facts about a relationship a person outside the door
   * does not have, and a card that offered a button which the door would
   * refuse is a worse screen than one that does not.
   */
  const w = board.waits.find((x) => x.by === me && !x.done);
  if (w && !board.people.some((q) => q.by === me && q.state === "published")) {
    const live = board.people.filter((q) =>
      q.state === "published" && q.looking && q.handle);
    const some = live.filter((q) => q.peek).slice(0, PEEK_N);
    return res.json({
      people: some.map((q) => ({ ...shownPerson(q, false), peek: true })),
      /* HOW MANY ARE NOT ON THE SCREEN. The wall has to be a number or it is
         a locked door with nothing behind it — "43 more inside" is the whole
         reason to stay on the list. */
      wall: { more: Math.max(0, live.length - some.length),
        /* HOW MANY HAVE ASKED TO GET IN, WHICH IS NOT HOW MANY ARE STILL
           OUTSIDE.
           This reader is on the list; the five faces above say the place is
           worth getting into, and this says they are not the only one who
           thinks so. That is a fact about demand, so it counts everybody who
           ever asked — the ones already admitted are the strongest evidence
           of it, and dropping them means the number falls every time the door
           opens, which is exactly backwards.
           The wording carries the difference: "have asked", never "are
           waiting". Sixty people waiting, when twenty of them are inside, is
           a lie on the screen whose whole job is to be worth believing.
           Absent rather than zero below the floor, the same rule /api/hello
           keeps: under five it stops describing a queue and starts describing
           an empty room. */
        asked: board.waits.length >= WAITING_FLOOR ? board.waits.length : null },
    });
  }
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
    /* Whether there is a Google button to draw. Off unless the box is
       configured — like push, mail and the hostess above — because a button
       that cannot work is worse than one screen fewer. */
    google: google.configured(),
    /* Whether to draw the button instead of the boxes — see DOOR_IN. The
       flag and not the code: a page that held the code would put it in every
       browser that opened the door. */
    doorIn: DOOR_IN,
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
  /* A ROOM DOOR ASKS FOR A NAME AND NOTHING ELSE.
   *
   * The list was the point, so the form asked for a way to be reached. The
   * rooms are the point now, and the only thing that should stand between
   * somebody and answering three sentences they have just read is their own
   * name.
   *
   * CHECKED AGAINST THE ROOM, NOT AGAINST THE BROWSER'S WORD FOR IT. `viaRoom`
   * counts only if `room` names a room this board actually has; otherwise any
   * request could drop the requirement by claiming it. */
  const viaRoom = Boolean(req.body?.viaRoom)
    && store.WAITROOMS_CHAT.includes(String(req.body?.room || ""));
  if (!name || (!reach && !viaRoom)) return res.status(400).json({ error: "both" });

  /* The row whose line wants rendering into the other language, if it has one
     and nothing has rendered it yet — started after the write, like every other
     model call on this box. See renderWhy. */
  let whyFor = "";
  let whyText = "";
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
    /* AND THE THIRD KIND OF LINK: a poster in a group chat. Checked against
       the table like the other two, so a made-up code credits nothing rather
       than inventing a post. It moves nobody up the queue — see fromA in
       cleanWait: an announcement is advertising, and advertising does not
       buy a place. It answers one question, which is whether that post
       brought anybody. */
    const asent = store.cleanCode(req.body?.a);
    const afrom = asent && board.announces.find((x) => x.code === asent);
    const row = store.cleanWait({ name, reach, why: req.body?.why,
      room: req.body?.room, by: me, via: from ? from.id : "",
      // Which door let them in with a name alone — see cleanWait.
      viaRoom: viaRoom ? String(req.body?.room || "") : "",
      fromWait: wfrom ? wfrom.id : "", shown: true,
      fromA: afrom ? afrom.code : "",
      quiet: req.body?.quiet === true });
    if (!row) return { error: "both" };
    /* CHANGING THE ANSWER MUST NOT EMPTY THE CARD. This replaces the row
       rather than merging into it, which is right for the three things the
       form owns and wrong for everything they filled in afterwards — a
       correction to a typo in a name would otherwise silently throw away a
       level, a type and a sentence. Carried over by name, so a field added
       here later has to be thought about rather than lost quietly. */
    /* THE ROOM SAYS SOMEBODY CAME IN.
     *
     * The same line a group room gets when the maker adds somebody — see
     * moSays. Without it a stranger's first sentence arrives in a room that
     * never said they had arrived, which is the thing that makes a room feel
     * like a room rather than a feed with strangers in it.
     *
     * Only for somebody who came in through a door. A row made on the public
     * form belongs to no room yet and there is nothing to announce it to. */
    /* AND SOMEBODY WHO MOVES TO ANOTHER DOOR IS AN ARRIVAL AT THAT ONE.
     *
     * The test was "no live row at all", which is right for a first arrival
     * and silent for the other case: somebody standing at the investment door
     * opens the film link, and the replace below moves their row to film —
     * where the room never says they came in, and Mo never greets them,
     * because the board can see they were already somewhere. They walked into
     * a room of twenty people and it said nothing. */
    const had = board.waits.find((w) => w.by === me && !w.done);
    const asked = String(req.body?.room || "");
    if (viaRoom && (!had || (had.room || "other") !== asked)) {
      const door = store.doorRoom(asked);
      moSays(board, door, "in", name);
      /* AND HE SAYS SOMETHING TO THEM, IN THE ROOM.
       *
       * This was on their own screen and nobody else's, to keep twenty-four
       * copies of the same instruction out of a conversation. Wrong call: the
       * rooms are quiet, people arrive and nobody answers them, and one line
       * from the doorman is the difference between a room and an empty page
       * with strangers posting into it.
       *
       * The instruction is still theirs alone — the home-screen line knows
       * which phone they are holding and belongs under the box. This is the
       * greeting, which belongs where everybody can see somebody was greeted. */
      moSays(board, door, "welcome", name);
    }
    /* THE LIVE ROW, NOT MERELY THE FIRST ONE.
     *
     * This took the first row for the browser whether or not it was done,
     * while everything that READS a name — see `named` in /api/door — takes
     * the first row that is not. A browser with an old, finished row in front
     * of a live one therefore renamed the dead row and left the room showing
     * the name on the other: somebody typed Brendan and the room went on
     * calling him by a name from a fortnight ago.
     *
     * One rule for both: the row that is still standing at the door. */
    const at = me ? board.waits.findIndex((w) => w.by === me && !w.done) : -1;
    if (at >= 0) {
      const was = board.waits[at];
      board.waits[at] = { ...row, id: was.id, at: was.at,
        levelBand: was.levelBand, type: was.type, me: was.me, want: was.want,
        photo: was.photo, photoState: was.photoState,
        // Who brought them is a fact about how they arrived, not something a
        // second visit to the form should be able to rewrite.
        via: was.via || row.via, fromWait: was.fromWait || row.fromWait,
        // Same rule: where they came from is a fact about how they arrived,
        // and a second visit to the form does not get to rewrite it.
        fromA: was.fromA || row.fromA,
        /* AND THE OTHER LANGUAGE OF THEIR LINE, kept when the line itself did
           not change. Without this, correcting a typo in a name threw away a
           rendering and paid for it again. A new line drops the old one, which
           is right — a rendering of words nobody wrote any more is worse than
           none. See whyAlt in cleanWait. */
        whyAlt: row.why === was.why ? (was.whyAlt || "") : "",
        whyAlt2: row.why === was.why ? (was.whyAlt2 || "") : "",
        whyLang: row.why === was.why ? (was.whyLang || "") : "" };
    } else board.waits.push(row);
    const live = at >= 0 ? board.waits[at] : row;
    if (String(live.why || "").trim() && !live.whyAlt) {
      whyFor = live.id; whyText = live.why;
    }
    return { ok: true, again: at >= 0 };
  });
  if (out?.error) return res.status(400).json(out);
  /* THE COOKIE IS SET HERE, on the way out of joining, and not on the first
     edit afterwards — most people fill in the form and close the tab, and
     those are exactly the ones who would otherwise lose the row when their
     browser forgets itself. See waitingRow. */
  if (me && (out?.ok || out?.again)) setWaitCookie(res, me);
  if (whyFor) renderWhy(whyFor, whyText);
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
/* ---------------------------------------------------------------------------
 * THREE A DAY, INTO THE WAITING ROOM
 *
 * A queue that never moves stops being scarcity and becomes a dead list, and
 * the people standing in it are the first to work that out. So the board moves
 * the top of it up by itself, every day, without anybody having to remember.
 *
 * THE WAITING ROOM IS NOT ADMISSION. It is the stage before it: they can read
 * the whole app and finish their own page, every write answers "coming soon",
 * and whoever runs the board reads what they filled in and decides. Nobody
 * gets in without a person saying so — that rule is the product and this does
 * not touch it. What this automates is the LOOKING AT, which is the part that
 * was not happening.
 *
 * COUNTED, NOT SCHEDULED. It asks how many went up today and tops the number
 * back up to UP_A_DAY. No cron, no marker, no "last run" to fall out of step:
 * a restart, a day the box was down, and a promotion done by hand all come out
 * right, because the only question asked is about the rows themselves.
 *
 * Hourly rather than at midnight, for the same reason: a box that was asleep
 * at midnight would otherwise skip a day in silence.
 */
const UP_A_DAY = num("BOARD_UP_A_DAY", 3);
/* HOW MANY MEMBERS SOMEBODY AT THE DOOR MAY BROWSE. Five, because browsing is
   what people came for and a preview long enough to answer "is this worth
   waiting for" has done its job; one that goes on longer is the board, given
   away at the door. An env var so it can be turned down to nothing on a board
   that does not want it at all. */
const PEEK_N = num("BOARD_PEEK", 5);
/* HOW LONG THEY HAVE. Three days, which is long enough for somebody who saw
   the message on a Friday and is free on a Sunday, and short enough that the
   waiting room does not quietly become a second list that also never moves.
   A waiting room with no clock on it is the thing this whole mechanism was
   built to stop. */
const UP_HOURS = num("BOARD_UP_HOURS", 72);

const sameDay = (a, b) => {
  const x = new Date(a), y = new Date(b);
  return x.getUTCFullYear() === y.getUTCFullYear() && x.getUTCMonth() === y.getUTCMonth()
    && x.getUTCDate() === y.getUTCDate();
};

async function liftSome() {
  if (UP_A_DAY <= 0) return;
  try {
    await change((board) => {
      const now = new Date().toISOString();
      let sent = 0;

      /* THE CLOCK, FIRST — and it runs before the lift so the places it frees
       * are filled the same hour rather than the next day.
       *
       * Three days in the waiting room with a face and a sentence to write.
       * Somebody who does not is not being judged for it: they were early,
       * they were busy, the moment was wrong. They go back on the list with
       * their place intact and their turn counted.
       *
       * WHAT IS NOT DONE HERE: nothing is deleted, nothing is refused, and
       * nobody is told they failed. The row goes back to how it was. */
      if (UP_HOURS > 0) {
        const dead = Date.now() - UP_HOURS * 3600_000;
        for (const w of board.waits) {
          if (!w.up || w.done) continue;
          if (store.waitDone(w)) continue;               // they turned up
          /* FROM upSeen, NOT upAt. The clock starts when they first open the
             board, because nothing here can reach a WeChat id and the message
             telling them goes by hand. Never opened it, no deadline — they
             have not had their turn yet, they have only been given one. */
          const at = Date.parse(w.upSeen || "") || 0;
          if (!at || at > dead) continue;
          w.up = false;
          w.upAt = "";
          w.upSeen = "";
          sent += 1;
        }
      }

      const today = board.waits.filter((w) => w.up && w.upAt && sameDay(w.upAt, now)).length;
      const room = UP_A_DAY - today;
      if (room <= 0) return sent ? { n: 0, sent } : null;
      /* IN QUEUE ORDER, which is the order the room itself shows and the one
         the people waiting can watch work — somebody who brought two people in
         is two places further up and should go up two days sooner.
         BUT A FIRST TURN BEFORE A SECOND. Somebody swept back for not filling
         their page is still near the top of the queue, so without this they
         would be lifted again the same day, for ever, and the person behind
         them would never get a turn. */
      const waiting = queueOrder(board).map((x) => x.w).filter((w) => !w.done && !w.up);
      const next = [...waiting.filter((w) => !w.ups), ...waiting.filter((w) => w.ups)]
        .slice(0, room);
      if (!next.length) return sent ? { n: 0, sent } : null;
      for (const w of next) { w.up = true; w.upAt = now; w.ups = (w.ups || 0) + 1; }
      return { n: next.length, sent };
    });
  } catch (e) {
    // A day not moved is a day not moved. Never worth taking the board down.
    console.error("waiting room lift failed:", (e && e.message) || e);
  }
}

/* Once on the way up, so a box that has been down for a week catches up the
   moment it returns, and then every hour. */
setTimeout(() => { liftSome(); }, 20_000).unref?.();
setInterval(() => { liftSome(); }, 3600_000).unref?.();

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

  /* THE CLOCK STARTS HERE, AND IT WAS NOT STARTING ANYWHERE.
   *
   * It was stamped in the gate middleware, which never runs for these people:
   * OPEN_PATHS matches /room and /api/wait and returns next() several lines
   * ABOVE the stamp. So the two things somebody in the waiting room actually
   * does — open the room, and this request — both skipped it, and upSeen was
   * only ever written when they tapped something behind the door and got
   * refused. Somebody who opened the room, read the band and closed it had no
   * deadline at all; somebody who poked at /browse started a 72-hour clock by
   * accident, at whatever moment they happened to poke.
   *
   * This request is the honest signal: it is the one every waiting-room page
   * load makes, and it is the request that hands back the number of hours
   * left. Seeing the clock and starting the clock are now the same event.
   *
   * Not awaited — a page load must not wait on a write, and this response
   * carries upLeft from the row as it was read, so the first load says the
   * full 72 and the stamp lands a moment later. */
  if (mine.up && !mine.upSeen && !mine.done) {
    change((board) => {
      const w = board.waits.find((x) => x.id === mine.id);
      if (!w || w.upSeen) return null;
      w.upSeen = new Date().toISOString();
      return { ok: true };
    }).catch(() => { /* the next load stamps it */ });
  }

  /* HOW MANY ARE AHEAD, and it is a queue position rather than a ranking.
     Everybody still waiting who is in front of them — by when they asked,
     less one place for each person they brought in. See queueOrder. */
  const order = queueOrder(board);
  const open = order.map((x) => x.w);
  const ahead = Math.max(0, order.findIndex((x) => x.w.id === mine.id));
  const broughtIn = (order.find((x) => x.w.id === mine.id) || {}).n || 0;

  /* THE OTHERS USED TO TRAVEL FROM HERE AND NO LONGER DO.
   *
   * The room page carried a list of everybody else waiting — name, room and
   * face, in queue order, for anybody who had said they could be listed. It
   * was the only way to know somebody else was out there when that screen was
   * a form and a clock.
   *
   * The room is on that screen now. Mo announces each arrival by name as it
   * happens, so a list underneath naming the same people is the same fact a
   * third time — and it is a fact about other people, so the cheapest fix is
   * to stop sending it rather than to stop drawing it. Nobody's name now
   * leaves this route except the reader's own.
   *
   * `shown` and `quiet` still decide the members' list in /api/queue, which
   * is where a name is read by somebody who can actually do something with
   * it. See cleanWait.
   */

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
    you: { name: mine.name, room: mine.room, why: mine.why,
      whyAlt: mine.whyAlt || "", whyAlt2: mine.whyAlt2 || "",
      whyLang: mine.whyLang || "", at: mine.at,
      levelBand: mine.levelBand, type: mine.type, me: mine.me, want: mine.want,
      photo: mine.photo, photoState: mine.photoState,
      canSignIn: /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/
        .test(String(mine.reach || "").trim().toLowerCase()) },
    ahead, waiting: open.length, featured, seat,
    // Whether the Inside tab has anything behind it — see peekN.
    peekN: peekN(board),
    /* THE WAITING ROOM, TO THE PERSON IN IT.
     *
     * `up` is the stage; `left` is how many hours of it remain; `done` is
     * whether they have the face and the sentence that end the clock. The page
     * says all three, because "finish your page" with no idea what is missing
     * or how long is left is a demand rather than an invitation. */
    /* Whether there is a butler to draw. It needs a key on the box, so a page
       that drew the panel unconditionally would offer a conversation that
       answers 503 — which is worse than no panel. */
    butler: butler.configured(),
    up: Boolean(mine.up),
    upDone: store.waitDone(mine),
    upSeen: Boolean(mine.upSeen),
    upLeft: mine.up && mine.upSeen && UP_HOURS > 0
      ? Math.max(0, Math.round((Date.parse(mine.upSeen) + UP_HOURS * 3600_000 - Date.now()) / 3600_000))
      : null,
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
  // A rewritten line wants rendering again — see renderWhy, and the note below.
  let whyFor = "";
  let whyText = "";
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
    /* A REWRITTEN LINE DROPS ITS OLD RENDERING. `put` is spread from the row
       they had, so without this an edited line kept the other-language text of
       the line before it — a Chinese reader would be shown words nobody had
       written since Tuesday. Cleared here and rendered again below. */
    if (String(row.why || "") !== String(was.why || "")) {
      row.whyAlt = ""; row.whyLang = "";
      if (String(row.why || "").trim()) { whyFor = row.id; whyText = row.why; }
    }
    board.waits[at] = row;
    return { on: true, you: { levelBand: row.levelBand, type: row.type,
      me: row.me, want: row.want, name: row.name, room: row.room, why: row.why,
      whyAlt: row.whyAlt || "", whyAlt2: row.whyAlt2 || "", whyLang: row.whyLang || "",
      // Whether it works as a way back, never the thing itself. See above.
      canSignIn: /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/
        .test(String(row.reach || "").trim().toLowerCase()) } };
  });
  if (out?.error === "reachTaken") return res.status(409).json(out);
  if (out?.error) return res.status(400).json(out);
  if (whyFor) renderWhy(whyFor, whyText);
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

/* ---------------------------------------------------------------------------
 * THE BUTLER
 *
 * Somebody to talk to while you finish your page. The waiting room asks a
 * stranger for one sentence — "I am a ___ looking for a ___" — in a vocabulary
 * of thirteen words nobody has been shown, and that sentence is the whole
 * board: it decides who they are shown and who is shown them. A model agent in
 * Guangzhou with forty people on her books does not think of herself as
 * `agent looking for talent`; she thinks "I have people and I need work for
 * them". This is the translator between those two.
 *
 * IT PROPOSES AND NEVER WRITES. Nothing here touches the row. What comes back
 * goes into the fields on the page as a suggestion, and a person presses a
 * button. See the note at the top of lib/butler.js for why that rule is the
 * whole design, and what is checked on the way back.
 *
 * THE WAITING ROOM ONLY, and this is a cost decision rather than a feature
 * one: a route that calls a model, on a board with no accounts, reached by
 * anybody outside the door, is a bill anybody can run up. The caps in
 * butler.js are the second line; this is the first.
 * ------------------------------------------------------------------------- */
/* WHICH SCREEN HE IS STANDING ON, AND WHAT IS TRUE OF IT.
 *
 * He was the same doorman on every page. Mounted on Messages he knew nothing
 * about Messages — so "why has nobody answered me" got the waiting room's
 * answer, or a shrug, from somebody standing in the middle of the screen that
 * has the answer on it.
 *
 * THE PAGE SAYS WHICH SCREEN, NOT WHAT IS ON IT. One word, checked against
 * the list below, and everything else is read from the board here. A page that
 * could tell him what it was showing would be a page that could tell him
 * anything.
 *
 * COUNTS, NEVER CONTENTS — the same rule as the member block above. How many
 * conversations are waiting on them is a fact about their own screen. Who the
 * other person is, and a word of what anybody wrote, is not his to hold.
 */
const SCREENS = ["wait", "browse", "notes", "profile", "person"];

function screenFacts(board, me, mine, where) {
  if (where === "browse") {
    const mutual = board.follows.filter((f) => f.by === me).filter((f) => {
      const q = board.people.find((x) => x.id === f.who);
      return q && board.follows.some((g) => g.by === q.by && g.who === mine.id);
    }).length;
    return [
      "They are on BROWSE. It deals them one card at a time — the people whose sentence answers theirs, first — and the two buttons are Follow and Next. Following is one-sided and silent: the other person is not told, and nothing opens until they follow back.",
      mutual > 0
        ? `${mutual} of the people they followed have followed them back. Those are the ones they can write to.`
        : "Nobody they have followed has followed them back yet. Until somebody does there is nobody for them to write to, and the only thing that changes it is getting through more cards.",
    ];
  }

  /* THEIR OWN PAGE. What is missing from it is the useful thing here — this
     is the one screen where the answer to "why is it quiet" is often
     something they can fix in a minute. */
  if (where === "profile") {
    const followers = board.follows.filter((f) => f.who === mine.id).length;
    const bits = [
      "They are on THEIR OWN PAGE. It is what a member sees when they come up in somebody's Browse: their sentence, their photograph, and the line under it.",
      followers > 0
        ? `${followers} people are following them.`
        : "Nobody is following them yet.",
    ];
    if (!mine.photo) bits.push("There is no photograph on it. On a board where nobody has met, that is the single thing most likely to be why it is quiet, and it is worth one straight sentence here — this is the screen where they can fix it.");
    if (!String(mine.goal || "").trim()) bits.push("The line under their sentence is empty. It is what a member reads when deciding about them.");
    return bits;
  }

  /* SOMEBODY ELSE'S PAGE. He is told nothing about that person — the member
     is looking straight at them and can read it. What he is for here is the
     machinery: what Follow does, what a match is, what giving a card means. */
  if (where === "person") {
    return [
      "They are looking at ANOTHER MEMBER'S PAGE. You are not told anything about that person — the card is right there in front of them — and you must not guess at a name, a credit or a reason.",
      "What you can explain: following is one-sided and silent, and the other person is not told. Nothing opens until both of them have followed. Then they can write to each other here, and a contact only changes hands when both press give.",
    ];
  }

  if (where === "notes") {
    /* Every conversation they are in, as counts. Notes carry device hashes on
       both sides, so this never touches a name. */
    const between = new Map();
    for (const n of board.notes) {
      const other = n.by === me ? n.to : (n.to === me ? n.by : null);
      if (!other) continue;
      const arr = between.get(other) || [];
      arr.push(n);
      between.set(other, arr);
    }
    let theirs = 0, ours = 0, unanswered = 0;
    for (const arr of between.values()) {
      const last = arr[arr.length - 1];
      if (last.to === me) theirs += 1;
      else {
        ours += 1;
        if (arr.every((n) => n.by === me)) unanswered += 1;
      }
    }
    const mutual = board.follows.filter((f) => f.by === me).filter((f) => {
      const q = board.people.find((x) => x.id === f.who);
      return q && board.follows.some((g) => g.by === q.by && g.who === mine.id);
    }).length;

    const bits = [
      "They are on MESSAGES. The faces along the top are the people who followed them back — tapping one writes to them or picks the conversation up. Under that is every conversation, newest first.",
      `${mutual} people have followed them back.`,
    ];
    if (theirs > 0) bits.push(`${theirs} of their conversations are waiting on THEM to answer. Worth saying once if it comes up; never twice.`);
    if (unanswered > 0) {
      bits.push(`${unanswered} of the messages they sent have had no reply at all. If they ask why: nobody here is obliged to answer, an introduction is a thing somebody decides about rather than a thing owed back, and the honest answer is that it happens. Do not invent a reason and do not promise one is coming.`);
    } else if (ours > 0) {
      bits.push(`${ours} conversations are waiting on the other person.`);
    }
    if (!between.size) bits.push("They have no conversations at all yet. Nothing has gone wrong; there is simply nobody they have written to and nobody who has written to them.");
    return bits;
  }

  return [];
}

app.post("/api/butler", express.json({ limit: "16kb" }), async (req, res) => {
  /* EVERY REFUSAL SAYS WHICH ONE IT WAS.
   *
   * The page turns all of them into the same red line — "He is not answering"
   * — which is right for the person reading it and useless for anybody trying
   * to fix it. Only the thrown case logged, so a route that refused before it
   * ever called the model left no trace at all: no key, no row, over the cap
   * and an empty body were four different bugs with one symptom and no
   * evidence. Keys and message text never go in here, only the reason. */
  const no = (code, why, extra) => {
    console.error(`butler: ${code} ${why}${extra ? " " + extra : ""}`);
    return res.status(code).json({ error: why });
  };

  if (!butler.configured()) return no(503, "unconfigured");
  const { row, who: me } = await waitingRow(req, res);
  /* Not "are they up" — anybody on the list with a row may use it. Somebody
     who fills their card in before their turn comes up is the best possible
     outcome of this feature, not an abuse of it. */
  /* AND MEMBERS, WHO ARE MOST OF THE BOARD AND COULD NOT REACH HIM AT ALL.
   *
   * This answered 403 to anybody without a waiting row — so the one person
   * here whose job is answering questions was unreachable from every screen
   * where somebody has a real one. A member asking "why is it quiet" or
   * "what does this word mean" had nobody.
   *
   * WHAT HE IS TOLD ABOUT THEM, and it is deliberately almost nothing: their
   * own name, their own sentence, whether their own card has a face, and HOW
   * MANY people answer their sentence. A count and not a list — no name, no
   * company, not a word anybody wrote. He is a doorman, not a way to read the
   * room, and the difference has to hold in what he is handed rather than in
   * what he is asked not to say. */
  if (!row) {
    const board = await store.load(FILE);
    const mine = me ? board.people.find((q) => q.by === me) : null;
    if (mine) {
      const others = board.people.filter((q) => q.by !== me && q.handle
        && q.state === "published" && store.scopeFits(mine, q)
        && store.sharedRooms(mine, q).length > 0);
      /* HIS SENTENCE IS IN `say`, AND THIS READ IT OFF THE WRONG ROW SHAPE.
         `me` and `want` are fields on a WAITING row; a member's row carries
         `say`, an array of up to three of those pairs. So every member who
         asked him anything was described to him as somebody with no sentence
         at all — which is exactly the case facts() treats as "do not mention
         it", so nothing looked broken and he simply never knew what the
         person in front of him was on the board for. Same two fields, two
         different tables, one silent wrong answer. */
      const first = (Array.isArray(mine.say) ? mine.say : [])[0] || {};
      /* The page names the screen; screenFacts works out what is true of it.
         An unknown word is simply no screen — never a reason to refuse a
         question. */
      const where = SCREENS.includes(String(req.body?.where || "")) ? String(req.body.where) : "";
      const out = await butler.ask(req.body?.turns, me, {
        name: mine.handle || String(mine.name || "").split(/\s+/)[0] || "",
        member: true,
        me: first.me || "",
        want: first.want || "",
        photo: Boolean(mine.photo),
        matches: others.length,
        screen: screenFacts(board, me, mine, where),
      });
      if (out.error) {
        const code = out.error === "slow-down" || out.error === "busy" ? 429
          : out.error === "unconfigured" ? 503 : 400;
        if (out.error !== "failed") console.error(`butler: ${code} ${out.error}`);
        return res.status(code).json(out);
      }
      res.set("Cache-Control", "no-store");
      return res.json(out);
    }
    /* Which half was missing: no device header at all is a different bug from
       a device that names nobody on the list. */
    const said = String(req.get("x-board-device") || "");
    return no(403, "who", said ? "device sent, no row" : "no device header");
  }
  /* WHAT HE IS TOLD ABOUT THEM — see facts() in lib/butler.js. He was told
     nothing, guessed, and told somebody who was only on the list that she had
     three days left. The hours are computed the same way /api/wait/me
     computes them, from upSeen rather than upAt, because the clock starts
     when they first saw it. Nothing here that is not already on their own
     screen: no contact, no device, no id. */
  const hours = row.up && row.upSeen && UP_HOURS > 0
    ? Math.max(0, Math.round((Date.parse(row.upSeen) + UP_HOURS * 3600_000 - Date.now()) / 3600_000))
    : null;
  const out = await butler.ask(req.body?.turns, me || row.id, {
    name: String(row.name || "").split(/\s+/)[0] || "",
    up: Boolean(row.up),
    left: hours,
    photo: Boolean(row.photo),
    me: row.me || "",
    want: row.want || "",
    // The few already on their screen, and nobody else — see peekFor.
    peek: peekFor(board),
    now: MO_NOW,
    // And what the board can count about itself — see nowOn.
    state: nowOn(board),
  });
  if (out.error) {
    const code = out.error === "slow-down" ? 429
      : out.error === "busy" ? 429
      : out.error === "unconfigured" ? 503 : 400;
    /* "failed" has already logged its status and message in butler.ask. */
    if (out.error !== "failed") console.error(`butler: ${code} ${out.error}`);
    return res.status(code).json(out);
  }
  res.set("Cache-Control", "no-store");
  res.json(out);
});

/* MO, OUT LOUD.
 *
 * The arrival's four beats are files — fixed text, rendered once by
 * scripts/voice.mjs, no key on the box and no cost per visit. His replies are
 * different every time, so there is nothing to render in advance and this is
 * the one thing on this board that calls a voice service while somebody
 * waits.
 *
 * WHAT IT WILL AND WILL NOT SPEAK. Only text, only 400 characters of it, only
 * for somebody with a row, and capped per device and per day — the same shape
 * as the conversation itself. It does not check that the words came from him,
 * because it cannot: the honest protection is the cap and the length, not a
 * comparison it would have to keep state for.
 *
 * HIS OPENERS ARE FREE AFTER THE FIRST PERSON. Everybody who opens the panel
 * hears the same one or two lines, so the cache in lib/say.js turns them into
 * one purchase for the whole board rather than one per arrival.
 */
app.post("/api/butler-voice", express.json({ limit: "4kb" }), async (req, res) => {
  if (!say.configured()) return res.status(503).json({ error: "unconfigured" });
  const { row, who: me } = await waitingRow(req, res);
  let ok = Boolean(row);
  if (!ok && me) {
    const board = await store.load(FILE);
    ok = board.people.some((q) => q.by === me);
  }
  if (!ok) return res.status(403).json({ error: "who" });

  const out = await say.speak(req.body?.text, req.body?.lang, me || (row && row.id) || "anon");
  if (out.error) {
    const code = out.error === "slow-down" || out.error === "busy" ? 429
      : out.error === "unconfigured" ? 503 : 400;
    return res.status(code).json(out);
  }
  res.set("Content-Type", "audio/mpeg");
  /* Private, because it is addressed to one person's conversation — and no
     store, because the cache that matters is the one on the box, where it is
     shared. A phone holding his openers for a week helps nobody. */
  res.set("Cache-Control", "no-store, private");
  res.send(out.audio);
});

/* MO, LISTENING — and this replaces the browser's own recogniser.
 *
 * window.SpeechRecognition is free and instant and does not work for either
 * group of people this board is for: it is DEFINED and dead in a standalone
 * iPhone app, and it is Google's service, which is unreachable from inside
 * China. See the header of lib/hear.js. So the phone records and this
 * transcribes, from Tokyo, which both of them can reach.
 *
 * THE AUDIO IS NOT KEPT. It arrives, it goes to be transcribed, the text
 * comes back, and the buffer is gone with the request. Nothing is written to
 * the box and nothing is written to the row — what the person then does with
 * the words is send them, or not, the same as if they had typed them.
 */
app.post("/api/butler-hear",
  express.raw({ type: ["audio/*", "application/octet-stream"], limit: "2mb" }),
  async (req, res) => {
    if (!hear.configured()) return res.status(503).json({ error: "unconfigured" });
    const { row, who: me } = await waitingRow(req, res);
    let ok = Boolean(row);
    if (!ok && me) {
      const board = await store.load(FILE);
      ok = board.people.some((q) => q.by === me);
    }
    if (!ok) return res.status(403).json({ error: "who" });

    const out = await hear.hear(
      req.body, req.get("content-type"),
      String(req.query.lang || "en"), me || (row && row.id) || "anon",
    );
    if (out.error) {
      const code = out.error === "slow-down" || out.error === "busy" ? 429
        : out.error === "unconfigured" ? 503
        : out.error === "long" ? 413 : 400;
      return res.status(code).json(out);
    }
    res.set("Cache-Control", "no-store");
    res.json(out);
  });

/* MO WRITES THE FIRST MESSAGE.
 *
 * The one part of this board nobody does. Two people whose sentences answer
 * each other exactly, a Send button, and an empty box — and writing cold to a
 * stranger in your own industry, in your second language, is where it stops. A
 * board whose matches never open a conversation is a directory with extra
 * steps.
 *
 * IT PROPOSES AND NEVER WRITES, the same rule as everything else he does. The
 * text lands in the box; Send is untouched; nothing leaves until a person
 * presses it. See the note above draft() in lib/butler.js for what he is given
 * and what he is refused.
 *
 * THE FIRST MESSAGE ONLY. Once there is a thread, drafting a reply would mean
 * sending the other person's words to a model — words written in a room this
 * product says only the two of them can see. That is a decision about the
 * promise this board makes and not a thing to add quietly, so a pair who have
 * already written to each other are refused here.
 *
 * EVERYTHING HE IS GIVEN IS ALREADY ON THE SCREEN of the person asking: both
 * sentences, both card lines, and the pair of words that put them together.
 * No contact, no device, no id, nothing from anybody else's row.
 */
app.post("/api/butler-draft", notesOff, express.json({ limit: "8kb" }), async (req, res) => {
  if (!butler.configured()) return res.status(503).json({ error: "unconfigured" });
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const who = String(req.body?.who || "");
  if (!me) return res.status(400).json({ error: "no" });
  if (!/^[a-f0-9]{20}$/.test(who)) return res.status(404).json({ error: "gone" });

  const board = await store.load(FILE);
  const mine = board.people.find((q) => q.by === me);
  const them = board.people.find((q) => q.id === who && q.state === "published");
  /* The same answer for somebody who never existed and somebody who took
     themselves down, so this cannot be used to ask which ids are real — the
     rule /api/note runs on, and it has to be the same rule or this route is
     the way round it. */
  if (!them || !mine || !mine.handle || them.by === me) {
    return res.status(404).json({ error: "gone" });
  }

  /* THE SAME TEST THE SEND BUTTON PASSES. A draft for a message that cannot
     be sent is worse than no button: it writes somebody a paragraph and then
     refuses to deliver it. */
  const state = threadState(board, me, them.by);
  if (!state.can) return res.status(400).json({ error: state.why || "no" });

  /* ALREADY TALKING — the boundary in the note above. Refused here rather
     than hidden only on the page, because a rule that lives in a button is a
     rule the next screen forgets. */
  const already = board.notes.some((n) => (n.by === me && n.to === them.by)
    || (n.by === them.by && n.to === me));
  if (already) return res.status(400).json({ error: "thread" });

  const pairs = pairState(board, me, them).shared;
  /* THE SENTENCE LIVES IN `say`, NOT IN `me`/`want`. Those two are the shape
     of a WAITING row — the stage before there is a person at all — and a
     member's row carries `say`, up to three pairs of them. The card line is
     `goal`; `why` on a person row is the "why should we let you in" answer and
     is emptied the moment they are published. Read the wrong pair of fields
     and every block sent up says "no card line" while the code looks
     perfectly correct, which is what this did first. */
  const card = (q) => ({
    name: q.handle || String(q.name || "").split(/\s+/)[0] || "",
    says: Array.isArray(q.say) ? q.say : [],
    where: String(q.campus || "").slice(0, 60),
    line: String(q.goal || "").replace(/\s+/g, " ").slice(0, 240),
  });
  const out = await butler.draft({
    from: card(mine),
    to: card(them),
    pairs: pairs.map((p) => p.mine + " ↔ " + p.theirs),
    started: req.body?.started,
    lang: req.body?.lang,
    who: me,
  });
  if (out.error) {
    const code = out.error === "slow-down" || out.error === "busy" ? 429
      : out.error === "unconfigured" ? 503 : 400;
    return res.status(code).json(out);
  }
  res.set("Cache-Control", "no-store");
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
      // And the same line in the other language — see whyAlt in cleanWait.
      whyAlt: x.w.whyAlt || "", whyAlt2: x.w.whyAlt2 || "", whyLang: x.w.whyLang || "",
      /* BOTH HALVES OF THE SENTENCE. `want` alone said what they are looking
         for and not what they are, which is half of the only sentence this
         board runs on — enough for a row in a list and not enough for the
         card at the top of a conversation with them. */
      levelBand: x.w.levelBand, type: x.w.type, me: x.w.me, want: x.w.want,
      brought: x.n || 0, vouches: x.v || 0,
      /* ALREADY LET IN AND NOT YET ARRIVED. The door screen offers "let in" on
         a row and has to know which rows it is not for; without it the button
         sits on somebody who was admitted this morning and is still deciding
         whether to make a page. */
      up: Boolean(x.w.up),
      // Six is more names than the row can draw; the count carries the rest.
      vouchedBy: (spoke.get(x.w.id) || []).slice(0, 6),
      /* Whether this reader has already vouched, so the button can say so
         rather than offering a thing that would do nothing. */
      mine: (board.vouches || []).some((v) => v.wait === x.w.id && v.by === me),
      photo: x.w.photoState === "published" ? x.w.photo : "",
    })),
  });
});

/** ONE PERSON AT THE DOOR, AS A PAGE.
 *
 *  A member could tap a face in a room and land in a conversation with
 *  somebody they knew nothing about. They have no /p/ page — they are not
 *  members — but the board is holding everything a page is made of: their
 *  name, their sentence, the line they wrote, their photograph, where they
 *  stand and who has spoken for them.
 *
 *  AND IT IS WHAT MAKES THEM FILL IT IN. A page that exists and is half empty
 *  is the reason to finish it; a form on a settings tab is not. Somebody at
 *  the door who knows members can look at this writes the sentence.
 *
 *  MEMBERS ONLY, like the queue it is a row of — `gate` above has already
 *  refused anybody else by the time this runs. `shown` decides it as well:
 *  everybody who answered the older form was promised no member would ever
 *  see their name, and that promise holds here exactly as it does in the
 *  list.
 */
app.get("/api/queue/:id", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
  const board = await store.load(FILE);
  /* TWO KINDS OF READER, AND THEY ARE SHOWN DIFFERENT PAGES.
   *
   * A member, who is deciding about this person: the whole of it, including
   * where they stand in the queue and which members have vouched.
   *
   * AND SOMEBODY STANDING IN THE SAME ROOM, which this refused outright —
   * so two people at a door could follow each other and neither could open
   * the other's page. Tapping a face did nothing, which on a screen where
   * every other face leads somewhere reads as the app being broken.
   *
   * They get what the room already shows them — the name, the sentence, the
   * line, the photograph — and the button to follow. Not the queue position
   * and not who vouched: those are the board deciding about somebody, and
   * that is a member's business and the operator's.
   */
  const member = board.people.some((q) => q.by === me && q.handle);
  const mine = member ? null : board.waits.find((w) => w.by === me && !w.done);
  if (!member && !mine) return res.status(403).json({ error: "members" });
  const order = queueOrder(board);
  const at = order.findIndex((x) => x.w.id === String(req.params.id || ""));
  const row = at >= 0 ? order[at] : null;
  if (!row || !row.w.shown) return res.status(404).json({ error: "gone" });
  const w = row.w;
  /* The same room, checked on the row rather than on anything the browser
     says. A different door is a different room and this is not their page. */
  if (!member && (w.room || "other") !== (mine.room || "other")) {
    return res.status(403).json({ error: "members" });
  }
  if (!member) {
    return res.json({
      id: w.id, name: w.name, room: w.room, why: w.why,
      whyAlt: w.whyAlt || "", whyAlt2: w.whyAlt2 || "", whyLang: w.whyLang || "",
      me: w.me, want: w.want, type: w.type, levelBand: w.levelBand,
      at: w.at,
      photo: w.photoState === "published" ? w.photo : "",
      fid: "w:" + w.id,
      iFollow: board.follows.some((f) => f.by === me && f.who === "w:" + w.id),
      both: bothFollow(board, me, w.by),
      // Writing needs the follow both ways, the same as it does for a member.
      canWrite: bothFollow(board, me, w.by),
      // What they are NOT shown, said once so the page can leave the block out
      // rather than drawing an empty one.
      room0: true,
    });
  }
  const spoke = (board.vouches || []).filter((v) => v.wait === w.id)
    .map((v) => (board.people.find((q) => q.by === v.by) || {}).handle)
    .filter(Boolean);
  res.json({
    id: w.id, name: w.name, room: w.room, why: w.why,
    whyAlt: w.whyAlt || "", whyAlt2: w.whyAlt2 || "", whyLang: w.whyLang || "",
    me: w.me, want: w.want, type: w.type, levelBand: w.levelBand,
    at: w.at, up: Boolean(w.up),
    place: at + 1, waiting: order.length,
    brought: row.n || 0, vouches: row.v || 0, vouchedBy: spoke.slice(0, 6),
    mine: (board.vouches || []).some((v) => v.wait === w.id && v.by === me),
    photo: w.photoState === "published" ? w.photo : "",
    /* FOLLOW, WHICH IS NOW THE FIRST THING TO DO ABOUT SOMEBODY, and the two
       older buttons beside it are a member's powers rather than the ordinary
       one. See /api/follow. */
    fid: "w:" + w.id,
    iFollow: board.follows.some((f) => f.by === me && f.who === "w:" + w.id),
    both: bothFollow(board, me, w.by),
    /* AND WHETHER WRITING TO THEM WOULD ACTUALLY WORK.
     *
     * The button was always there and the route behind it was not: a note to
     * somebody at a door is refused unless they are answering a member who
     * wrote to them, or the two of you follow each other. So "Write to them"
     * on anybody who walked into a room under their own steam led to "gone".
     * The page asks first now. */
    canWrite: Boolean(w.fromWrite) || bothFollow(board, me, w.by),
  });
});

/** MO SAYS SOMETHING TO EVERY DOOR, AND IT IS THE OPERATOR'S SENTENCE.
 *
 *  There was no way to tell the rooms anything. Somebody runs this board, and
 *  the only voice reaching the people in it was a welcome and an answer to a
 *  question somebody thought to ask. A week where three investors came in, or
 *  a date the door opens, or "photographs are being looked at tomorrow" —
 *  none of it could reach the twenty-two people standing in Film & TV.
 *
 *  VERBATIM, AND THAT IS THE POINT. No model runs on this. Mo may not invent
 *  a fact about the world (see MO_NOW and the brief), and an announcement is
 *  nothing but a fact about the world — so the operator writes the sentence
 *  and he says it, unchanged. What he adds is that it arrives in the room
 *  people are already reading, in his voice, which is the one they know.
 *
 *  The contact rule applies to him as it does to everybody: a WeChat id in an
 *  announcement is the board handing out a contact from the one account
 *  nobody can refuse.
 */
app.post("/api/mo/say", admin, express.json({ limit: "4kb" }), async (req, res) => {
  const text = String(req.body?.text || "").trim().slice(0, 600);
  if (!text) return res.status(400).json({ error: "empty" });
  const shaped = store.contactShaped(text);
  if (shaped) return res.status(400).json({ error: "contact", what: shaped });
  /* One room, or all five. A door named that this board does not have is a
     typo, and writing it into nothing would look like it worked. */
  const one = String(req.body?.room || "").trim();
  if (one && !store.WAITROOMS_CHAT.includes(one)) {
    return res.status(400).json({ error: "room" });
  }
  const rooms = one ? [one] : store.WAITROOMS_CHAT;
  const made = [];
  await change((board) => {
    for (const key of rooms) {
      const row = store.cleanSay({
        id: store.newId(), group: store.doorRoom(key), by: store.MO, text,
      });
      board.says.push(row);
      made.push({ room: key, id: row.id });
    }
    return true;
  });
  /* And in both languages, like every other line in a room — started after the
     write, never inside it. See renderSay. */
  for (const m of made) renderSay(m.id, text);
  res.json({ ok: true, rooms: made.map((m) => m.room) });
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

/** WHO HAS NOT BEEN TOLD THE ROOM IS OPEN.
 *
 *  The queue became a room people can talk in and not one of them knows,
 *  because nothing on this board can reach into WeChat. Somebody has to tell
 *  them one at a time; this is the list to work down, and the row remembers
 *  that it was done so nobody is told twice.
 *
 *  IT DOES NOT SEND ANYTHING. The script decides: an address goes by mail, and
 *  everybody else is printed for a person to paste. Marking is a second call,
 *  after the message has actually left — see POST below.
 */
app.get("/api/tell-rooms", admin, async (req, res) => {
  const board = await store.load(FILE);
  res.set("Cache-Control", "no-store");
  const again = req.query.again === "1";
  const rows = board.waits
    .filter((w) => !w.done && (again || !w.told))
    .sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
  res.json({
    rooms: store.WAITROOMS_CHAT,
    /* An address, or something else they typed. The script sends to the first
       and prints the second; this only says which it is. */
    rows: rows.map((w) => ({
      id: w.id, name: w.name, room: w.room || "other",
      reach: w.reach || "", why: w.why || "",
      mail: /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(w.reach || "")),
      told: w.told || "", toldBy: w.toldBy || "",
    })),
    told: board.waits.filter((w) => !w.done && w.told).length,
    waiting: board.waits.filter((w) => !w.done).length,
  });
});

/** One of them, by mail, and marked in the same breath.
 *
 *  The text is written by the script rather than here: it is prose in two
 *  languages and a subject line, and the server's job is the sending and the
 *  marking. Never logged — see lib/mail.js on why an address in a log is the
 *  same record as an address in a row, kept longer.
 */
app.post("/api/tell-mail", express.json({ limit: "8kb" }), admin, async (req, res) => {
  if (!mailReady()) return res.status(503).json({ error: "unconfigured" });
  const id = String(req.body?.id || "");
  const text = String(req.body?.text || "").slice(0, 2000);
  if (!id || !text) return res.status(400).json({ error: "no" });
  const board = await store.load(FILE);
  const w = board.waits.find((x) => x.id === id && !x.done);
  if (!w || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(w.reach || ""))) {
    return res.status(404).json({ error: "gone" });
  }
  const ok = await sendMail({
    to: w.reach,
    subject: "The Exchange \u2014 your room is open",
    text,
  });
  if (!ok) return res.status(502).json({ error: "failed" });
  /* MARKED ONLY AFTER IT WENT. A row that says it was told when nothing left
     is worse than one that says nothing: it takes the person off the list
     whoever runs this board is working down. */
  await change((b) => {
    const row = b.waits.find((x) => x.id === id);
    if (!row) return null;
    row.told = new Date().toISOString();
    row.toldBy = "mail";
    return true;
  }).catch(() => {});
  res.json({ ok: true });
});

/** Marking them told, after the message has left and not before. */
app.post("/api/tell-rooms", express.json({ limit: "16kb" }), admin, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String).slice(0, 500) : [];
  const how = req.body?.how === "mail" ? "mail" : "hand";
  if (!ids.length) return res.json({ ok: true, n: 0 });
  const out = await change((board) => {
    const at = new Date().toISOString();
    let n = 0;
    for (const w of board.waits) {
      if (!ids.includes(w.id) || w.done) continue;
      w.told = at;
      w.toldBy = how;
      n += 1;
    }
    return { ok: true, n };
  });
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
/* MOVED BY HAND, EITHER WAY.
 *
 * The picker takes three a day off the top, which is the right default and is
 * not a decision about a person. This is: somebody read a row and wants them
 * looked at now, or wants them back in the queue because the moment was wrong.
 *
 * Neither of these admits anybody. Admission is /api/waiting/admit and stays a
 * separate act with a separate button, because "let them see the app" and "let
 * them in" are different decisions and a panel that makes them one control is
 * a panel that will eventually make the second by accident.
 */
app.post("/api/waiting/up", express.json({ limit: "1kb" }), admin, async (req, res) => {
  const id = String(req.body?.id || "");
  const on = req.body?.on !== false;
  const out = await change((board) => {
    const w = board.waits.find((x) => x.id === id);
    if (!w) return { error: "gone" };
    if (w.done) return { error: "done" };
    w.up = on;
    /* The day is stamped going up and cleared coming back, because it is what
       the picker counts. Left behind, somebody moved down this morning would
       still be one of today's three and the queue would stall. */
    w.upAt = on ? new Date().toISOString() : "";
    return { ok: true, name: w.name };
  });
  if (out?.error) return res.status(404).json(out);
  res.json(out);
});

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
  // Same as the public form: a line typed in here gets its other language too.
  let whyFor = "";
  let whyText = "";
  const out = await change((board) => {
    /* SHOWN, AND IT WAS NOT, WHICH MADE THIS ROUTE WRITE INVISIBLE ROWS.
     *
     * The members' waiting list shows the people who agreed to be seen — see
     * `shown` in cleanWait. A row that joined through the form carries it,
     * because the form is where the agreeing happens. A row typed in here
     * carried nothing, so every person the operator added by hand landed on
     * the list and appeared to nobody: not vouchable, not visible, and no way
     * to tell from any screen that anything was wrong.
     *
     * Default true, because adding somebody here IS the operator saying they
     * asked — that is what the target's own note means by "every row is still
     * a real ask". `shown: false` in the body keeps one private. */
    const row = store.cleanWait({ name, reach, why: req.body?.why,
      room: req.body?.room, shown: req.body?.shown !== false });
    if (!row) return { error: "both" };
    /* Deduplicated on the way somebody is reached, newest winning. Adding the
       same WeChat id twice is one person asking twice, not two people. */
    const at = board.waits.findIndex((w) =>
      w.reach.toLowerCase() === row.reach.toLowerCase());
    if (at >= 0) {
      /* MERGED, NOT REPLACED. This overwrote the whole row with a fresh one,
         so running the same wait-add twice — which is exactly what somebody
         does when they are not sure it worked the first time — threw away
         everything the person had filled in since: their card, their photo,
         their sentence, their place in the waiting room. Only the three fields
         this route is actually given are written. */
      const had = board.waits[at];
      /* TWO DIFFERENT PEOPLE UNDER ONE ADDRESS, which the dedup above cannot
         see. Merging is right when it is the same person asking twice — the
         same WeChat id typed again is one person, not two. It is catastrophic
         when the address is a placeholder: two rows reading "ask Tom" are two
         people, and the second one silently becomes the first.
         It happened within the hour, to a row that had already been added,
         looked for, and not found. So the name is checked, and a different
         name under the same address is refused rather than written. */
      if (had.name && row.name && had.name.toLowerCase() !== row.name.toLowerCase()) {
        return { error: "taken", who: had.name };
      }
      board.waits[at] = {
        ...had,
        name: row.name,
        reach: row.reach,
        why: row.why || had.why,
        /* The rendering follows the line it was made from — see the same
           carry-over in /api/wait. */
        whyAlt: (row.why || had.why) === had.why ? (had.whyAlt || "") : "",
        whyAlt2: (row.why || had.why) === had.why ? (had.whyAlt2 || "") : "",
        whyLang: (row.why || had.why) === had.why ? (had.whyLang || "") : "",
        room: row.room || had.room,
        shown: row.shown || had.shown,
      };
      if (String(board.waits[at].why || "").trim() && !board.waits[at].whyAlt) {
        whyFor = had.id; whyText = board.waits[at].why;
      }
      return { ok: true, again: true, id: had.id };
    }
    board.waits.push(row);
    if (String(row.why || "").trim()) { whyFor = row.id; whyText = row.why; }
    return { ok: true, id: row.id };
  });
  if (out?.error) return res.status(400).json(out);
  if (whyFor) renderWhy(whyFor, whyText);
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
/** WHO IS BROWSABLE FROM OUTSIDE THE DOOR. `make peek WHO=ray`, one at a time.
 *
 *  Not a role and not a default: everybody else on this board decided to be in
 *  a directory that MEMBERS read, and these few are in one that strangers
 *  read. That is not a difference to hand somebody by flipping a switch they
 *  did not know about, which is why it is the operator's and why the list is
 *  meant to stay short.
 */
/** THE FEW HE MAY NAME. The same people /api/people shows somebody outside the
 *  door, in the shape facts() wants — see the note over `peek` in cleanPerson
 *  and the block in lib/butler.js about what he may say of them. */
/** HOW MANY MEMBERS A PERSON AT THE DOOR CAN ACTUALLY SEE.
 *
 *  Zero is the ordinary answer on a board where nobody has been chosen yet,
 *  and it has to travel, because a tab called "Inside" that opens an empty
 *  page is worse than no tab: it says the place is empty, which is the one
 *  thing the door is there to disprove. Both doors hide the tab on 0.
 *
 *  NOT FIXED BY SHOWING SOMEBODY AUTOMATICALLY. See `peek` in cleanPerson —
 *  everybody else on this board agreed to be in a directory MEMBERS read, and
 *  this is one STRANGERS read. Filling it by picking the best-looking cards
 *  would opt people into that without anybody deciding it. The empty door is
 *  the honest state; `make peeks` lists who could be shown and `make peek
 *  WHO=...` shows them.
 */
const peekN = (board) => board.people.filter((q) =>
  q.state === "published" && q.looking && q.handle && q.peek).length;

function peekFor(board) {
  return board.people
    .filter((q) => q.state === "published" && q.looking && q.handle && q.peek)
    .slice(0, PEEK_N)
    .map((q) => {
      const first = (Array.isArray(q.say) ? q.say : [])[0] || {};
      return { handle: q.handle, me: first.me || "", want: first.want || "",
               /* Their own words about themselves, which is the only
                  description of anybody he is ever allowed to repeat. */
               note: String(q.note || "").slice(0, 160) };
    });
}

app.post("/api/peek", express.json({ limit: "2kb" }), admin, async (req, res) => {
  const want = String(req.body?.who || "").trim().toLowerCase();
  const on = req.body?.on !== false;
  const out = await change((board) => {
    const q = board.people.find((x) =>
      String(x.handle || "").toLowerCase() === want && x.state === "published");
    if (!q) return { error: "gone" };
    q.peek = on;
    return { ok: true, who: q.handle, on };
  });
  if (out?.error) return res.status(404).json(out);
  res.json(out);
});

app.get("/api/peek", admin, async (_req, res) => {
  const board = await store.load(FILE);
  res.set("Cache-Control", "no-store");
  const live = board.people.filter((q) =>
    q.state === "published" && q.looking && q.handle);
  res.json({
    max: PEEK_N,
    shown: live.filter((q) => q.peek).map((q) => q.handle),
    /* Everybody who COULD be, so the command is a choice rather than a guess
       at a spelling. Same reason `make featured` lists what it lists. */
    could: live.filter((q) => !q.peek).map((q) => q.handle),
  });
});

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

/* ---------------------------------------------------------------------------
 * THE FOURTH DOOR ONTO THE SAME REBIND
 *
 * A key pasted in, a cookie a browser still has, six digits to an address —
 * and now a Google account. One mechanism, four doors; see the long note over
 * /api/signin for why none of them is a login and why there is still no
 * session to be logged into.
 *
 * WHAT IT IS FOR, WHICH IS ONE THING. A person here is a random number in one
 * browser's storage. On iOS, Safari and the same page added to the home screen
 * DO NOT SHARE STORAGE — so the sequence this product asks for, join in
 * WeChat and then add to the home screen so notifications work, hands somebody
 * a blank board. That is written down as an open problem over dr.sendWordsMany
 * in i18n.js. This is the answer: something to present that is not this
 * browser.
 *
 * IT IS NOT A WAY IN, AND THAT IS THE DIFFERENCE FROM THE BOARD IT CAME FROM.
 * `landed` lets anybody sign up, so a Google account there can make a person.
 * This board is invite-only. An account nobody here has attached finds nobody
 * and creates nothing — it cannot be a side entrance past the door.
 *
 * SO IT HAS TO BE ATTACHED FIRST, from inside, by somebody who is already
 * themselves. That is the same two routes: pressing it while you are somebody
 * attaches the account to your row, and pressing it on a strange browser
 * afterwards moves your row onto that browser.
 *
 * NO ENUMERATION PROBLEM, unlike the address flow. To reach the callback at
 * all somebody has to have completed a real sign-in to the account, so telling
 * them whether that account is on this board tells them only about themselves.
 * ------------------------------------------------------------------------- */

/** The address to come back to, which is this host and not a configured one.
 *
 *  The board answers on two names — see board-also.caddy — and somebody who
 *  signed in on one must come back to the one they were on, or the cookies set
 *  on the way out are not sent back. BOTH have to be registered as redirect
 *  URIs in the Google console; an unregistered one is refused by Google, which
 *  is also why a forged Host header here buys nothing. */
const googleBack = (req) => {
  const proto = String(req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0];
  const host = String(req.get("host") || "").replace(/[^A-Za-z0-9.:-]/g, "").slice(0, 253);
  return host ? proto + "://" + host + "/auth/google/cb" : "";
};

/** Our own paths only, and it is not decoration.
 *
 *  `next` decides where the browser lands after a real Google sign-in. Left
 *  open, it is an open redirect: a link that starts on this board, goes
 *  through a genuine Google screen, and finishes on a page somebody else
 *  controls that looks exactly like this asking for something. The domain is
 *  real the whole way, which is what makes it work on people who check.
 *
 *  One leading slash and not two — "//evil.example" is protocol-relative and
 *  a browser reads it as another host. */
function nextPath(v) {
  const path = String(v || "");
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "";
  return path.slice(0, 200);
}

/** Start it. A POST rather than a link, because the one thing the callback
 *  cannot get for itself is who this browser already is: the device id lives
 *  in localStorage and rides on a header, and a full-page redirect carries no
 *  headers. So the page hands it over here, it is hashed like everywhere else,
 *  and the hash waits in a signed cookie for ten minutes. */
app.post("/api/signin/google", express.json({ limit: "2kb" }), (req, res) => {
  if (!google.configured()) return res.status(503).json({ error: "unconfigured" });
  const back = googleBack(req);
  if (!back) return res.status(400).json({ error: "no" });

  const me = hashDevice(String(req.body?.device || ""), SALT);
  if (me) shortCookie(res, "board_gd", me + "." + sign(me));
  /* SIGNED IN THE FORM IT IS STORED IN. Signing the path and storing the
     escaped path is a signature that never matches its own cookie — and the
     failure is silent, because an unreadable cookie is indistinguishable from
     one that was never set: everybody quietly lands on the door instead of
     where they were. */
  const where = encodeURIComponent(nextPath(req.body?.next));
  if (where) shortCookie(res, "board_gn", where + "." + sign(where));

  const nonce = store.newId();
  shortCookie(res, "board_gs", nonce + "." + sign(nonce));
  res.json({ url: google.authUrl(back, nonce) });
});

/** And come back from it. */
app.get("/auth/google/cb", async (req, res) => {
  /* EVERY FAILURE LANDS ON THE SAME SCREEN WITH THE SAME WORD. A callback that
     explains which part went wrong is a callback that tells whoever is probing
     it which part went wrong. The one exception is `unknown`, which is not a
     failure of the flow — it is the board saying it has never heard of that
     account, which the person asking already knows more about than we do. */
  const home = (how) => {
    for (const c of ["board_gs", "board_gd", "board_gn"]) dropCookie(res, c);
    let where = "";
    try { where = nextPath(decodeURIComponent(String(signedCookie(req, "board_gn", "[^;.]+") || ""))); }
    catch { /* not ours after all */ }
    const to = where || "/enter";
    res.redirect(to + (to.includes("?") ? "&" : "?") + "signin=" + how);
  };
  if (!google.configured()) return home("failed");

  const nonce = signedCookie(req, "board_gs", "[a-f0-9]{20}");
  if (!nonce || nonce !== String(req.query.state || "")) return home("failed");

  const who = await google.whoIs(String(req.query.code || ""), googleBack(req));
  if (!who) return home("failed");

  /* WHO THIS BROWSER ALREADY IS. The hash left on the way out, and the two
     cookies as a fallback for a browser whose localStorage the page could not
     read — private mode, mostly. */
  const here = signedCookie(req, "board_gd", "[a-f0-9]{32}")
    || inCookie(req) || waitCookie(req);

  const out = await change((board) => {
    const mine = board.people.find((q) => q.google === who.sub);
    const waiting = mine ? null
      : board.waits.find((w) => !w.done && w.google === who.sub);

    /* A KNOWN ACCOUNT, ON WHATEVER BROWSER THIS IS. The person moves onto the
       id this browser already has rather than being handed a new one: the
       email flow mints a key and returns it in JSON, and a redirect has no
       JSON to put one in. Nothing new to store, nothing for anybody to lose.

       rebind is used rather than an assignment because it is the one function
       that knows every table keyed on a device. */
    const row = mine || waiting;
    if (row) {
      if (!here) return { error: "again" };
      if (who.email && mine && mine.mail !== who.email) mine.mail = who.email;
      if (row.by === here) return { ok: true, waiting: Boolean(waiting) };
      /* THIS BROWSER IS SOMEBODY ELSE. Moving the row on top of them would
         leave that person with no way back — the same thing the address flow
         warns about before it does it. There is nowhere to put a warning in a
         redirect, so it is refused and the screen says so. */
      const taken = board.people.some((q) => q.by === here && q !== mine)
        || board.waits.some((w) => !w.done && w.by === here && w !== waiting);
      if (taken) return { error: "here" };
      if (waiting) waiting.by = here;
      else store.rebind(board, mine.by, here);
      return { ok: true, waiting: Boolean(waiting) };
    }

    /* AN ACCOUNT THIS BOARD HAS NEVER SEEN, PRESSED BY SOMEBODY WHO IS ALREADY
       HERE. This is the attaching half, and it is the only way a subject ever
       gets onto a row. */
    const meP = here && board.people.find((q) => q.by === here);
    const meW = !meP && here && board.waits.find((w) => !w.done && w.by === here);
    const at = meP || meW;
    if (!at) return { error: "unknown" };
    /* ALREADY NAMES A DIFFERENT ACCOUNT. Two accounts opening one person is
       two people who both think they are them, and no way to tell later which
       was meant. */
    if (at.google && at.google !== who.sub) return { error: "other" };
    at.google = who.sub;
    if (meP && who.email && !meP.mail) meP.mail = who.email;
    return { ok: true, joined: true, waiting: Boolean(meW) };
  });

  if (out?.error) return home(out.error);
  /* THE COOKIE THAT MATCHES WHAT THEY ARE — the same rule as the address flow.
     A member gets the admission cookie, which is why signing in is also being
     let in; somebody on the list gets the waiting one, which admits them to
     nothing and is only how /room finds their card. */
  if (out.waiting) setWaitCookie(res, here);
  else setCookie(res, here);
  home(out.joined ? "joined" : "ok");
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
/** WHAT HAS ACTUALLY BEEN PAID BETWEEN TWO PEOPLE, both directions.
 *
 *  WHY IT IS ON THE CARD. Money is the only fact on a contact that is not
 *  somebody's opinion. "Has this person ever actually paid me" is the
 *  question that decides whether you say yes to the next job, and until now
 *  the only place it could be answered was a list that empties as things
 *  settle.
 *
 *  SUMMED PER CURRENCY AND NEVER ACROSS THEM. Adding ¥ to A$ produces a
 *  number that is wrong in both, and a wrong number about money is worse than
 *  no number. Two currencies between two people print as two totals.
 *
 *  MATCHED ON `toWho`, THE PERSON ID, AND NOT ON THE NAME. `to` is whatever
 *  was typed — most requests go to somebody who is not on this board at all,
 *  and two members could reasonably both be "Mei".
 *
 *  ONLY EVER BETWEEN THE TWO OF THEM. There is no route that gives anybody a
 *  third party's total, and this one is computed per pair for one reader.
 */
function paidWith(board, me, mineId, theirBy, theirId) {
  const sums = new Map();
  let jobs = 0;
  for (const q of board.requests) {
    const ours = (q.by === me && q.toWho === theirId)
      || (q.by === theirBy && q.toWho === mineId);
    if (!ours || request.requestState(q) !== "paid") continue;
    const minor = store.toMinor(q.amount, q.cur);
    if (!minor) continue;
    jobs += 1;
    sums.set(q.cur, (sums.get(q.cur) || 0) + minor);
  }
  return {
    jobs,
    paid: [...sums.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cur, minor]) => store.fromMinor(minor, cur))
      .filter(Boolean),
  };
}

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
      /* Money between the two of them, both directions. Empty for almost
         everybody, which is why it is a line that appears rather than a row
         that is always there saying nothing. */
      ...paidWith(board, me, mine.id, q.by, q.id),
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

/* ---------------------------------------------------------------------------
 * ANNOUNCEMENTS — the one thing on this board written to leave it
 *
 * Everything else here points inward. The feed is behind the door, a profile
 * is behind the door, and the only thing that ever crossed into a chat was a
 * link to a form. A form is not news. "Damon Russell just joined" is, and the
 * board had no way to say it to the two hundred people in a WeChat group who
 * would care.
 *
 * So: a picture, a line, and JOIN THE WAITING LIST, at an address with no
 * door on it. Written in the app behind the +, pasted into a group, and the
 * button at the bottom lands on the join form that already exists with the
 * poster's code riding in the query — so the answer to "did that post bring
 * anybody" is a number rather than a feeling.
 *
 * WHAT IT DOES NOT DO, and this is the line the feature lives behind: it
 * reads nobody's row. Not the name, not the face, not the sentence. Whoever
 * writes it types every word and picks the picture. The standing rule on this
 * board is that a member's page is not legible outside the door — see the
 * long note above OPEN_PATHS about /p/:handle and public-media — and a share
 * button that quietly published a profile because it was convenient would
 * break that rule while looking like a feature. An announcement is one
 * person's own words about somebody, which is what they would have typed into
 * the chat themselves; what the board adds is the picture, its name on it,
 * and the button.
 * ------------------------------------------------------------------------- */

/** May this browser write one. A published page AND the flag — see
 *  canAnnounce in store.js for why the flag is handed out one person at a
 *  time. The admin key passes without either, so the box can always post. */
async function mayAnnounce(req) {
  if (KEY && safeEqual(String(req.get("x-admin-secret") || ""), KEY)) return "box";
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
  if (!me) return "";
  const board = await store.load(FILE);
  const q = board.people.find((x) => x.by === me && x.state === "published" && x.canAnnounce);
  return q ? me : "";
}

/** Write one. */
app.post("/api/announce", express.json({ limit: "36mb" }), async (req, res) => {
  const who = await mayAnnounce(req);
  if (!who) return res.status(403).json({ error: "no" });
  const title = String(req.body?.title || "").trim();
  if (!title) return res.status(400).json({ error: "title" });

  /* THE PICTURE IS OPTIONAL AND THE PAGE IS NOT MUCH WITHOUT ONE. A link
     pasted into WeChat draws a card from og:image, and a card with no picture
     is a grey box with a line of text in it — which in a group chat scrolling
     past at speed is indistinguishable from a link nobody should tap. Said on
     the composer rather than refused here: whoever runs the board is allowed
     to post news about somebody whose photograph they do not have. */
  let photo = "";
  const data = String(req.body?.photo || "");
  if (data) {
    const buf = Buffer.from(data, "base64");
    if (buf.length > MEDIA_MAX) return res.status(413).json({ error: "tooBig" });
    photo = (await putMedia(buf, String(req.body?.photoType || ""))) || "";
    if (!photo) return res.status(415).json({ error: "badType" });
  }

  const out = await change((board) => {
    /* A CODE NOBODY ELSE HOLDS. Minted here rather than in cleanAnnounce so
       it can be checked against the rows that exist — cleanAnnounce cannot
       see them, and two posters at one address means the later one silently
       replaces a page already sitting in somebody's chat history. */
    let code = store.newCode();
    for (let i = 0; i < 20 && board.announces.some((a) => a.code === code); i++) {
      code = store.newCode();
    }
    const row = store.cleanAnnounce({
      title, body: req.body?.body, photo, code,
      /* The other language, as the composer agreed to send it. Taken as
         written and not checked against the first: half a poster is a person's
         decision to make, and a server that refused a Chinese title with an
         English body would refuse the commonest real case — a headline worth
         translating and three lines that are a list of names. */
      titleZh: req.body?.titleZh, bodyZh: req.body?.bodyZh,
      by: who === "box" ? "" : who, at: new Date().toISOString(),
    });
    if (!row) return { error: "title" };
    board.announces.push(row);
    return { code: row.code };
  });
  if (out?.error) return res.status(400).json(out);
  res.status(201).json({ ...out, at: "/a/" + out.code });
});

/** Everything this browser has posted, and whether it worked.
 *
 *  TWO NUMBERS AND THEY MEAN DIFFERENT THINGS. `seen` is how many opened it,
 *  which says whether the group was the right group. `joined` is how many put
 *  their name down off it, which is the only one worth acting on — a poster
 *  read four hundred times that brought nobody was the wrong poster, and
 *  without the second number it reads as a triumph. */
app.get("/api/announce", async (req, res) => {
  const who = await mayAnnounce(req);
  if (!who) return res.status(403).json({ error: "no" });
  const board = await store.load(FILE);
  res.set("Cache-Control", "no-store");
  const joined = new Map();
  for (const w of board.waits) {
    if (w.fromA) joined.set(w.fromA, (joined.get(w.fromA) || 0) + 1);
  }
  res.json({
    announces: board.announces
      .filter((a) => who === "box" || a.by === who)
      .slice()
      .reverse()
      .map((a) => ({
        code: a.code, title: a.title, body: a.body,
        titleZh: a.titleZh, bodyZh: a.bodyZh, photo: a.photo,
        at: a.at, state: a.state, seen: a.seen, joined: joined.get(a.code) || 0,
      })),
  });
});

/** Take one down. It stays as a row — see `state` in cleanAnnounce: a link
 *  that has been in a group chat for a week goes on being tapped, and a page
 *  saying the announcement is gone is a different thing from a 404. */
app.delete("/api/announce", express.json({ limit: "2kb" }), async (req, res) => {
  const who = await mayAnnounce(req);
  if (!who) return res.status(403).json({ error: "no" });
  const code = store.cleanCode(req.body?.code);
  if (!code) return res.status(400).json({ error: "code" });
  const out = await change((board) => {
    const a = board.announces.find((x) => x.code === code
      && (who === "box" || x.by === who));
    if (!a) return { error: "nobody" };
    a.state = "removed";
    return { ok: true };
  });
  if (out?.error) return res.status(404).json(out);
  res.json(out);
});

/** What the public page draws. Outside the door, so it carries exactly what
 *  the person who wrote it typed and nothing else — no author, no member
 *  count, no list. */
app.get("/api/announce/:code", async (req, res) => {
  const code = store.cleanCode(req.params.code);
  if (!code) return res.status(404).json({ error: "no" });
  const board = await store.load(FILE);
  const a = board.announces.find((x) => x.code === code);
  if (!a) return res.status(404).json({ error: "no" });
  res.set("Cache-Control", "no-store");
  if (a.state !== "published") return res.json({ gone: true });
  /* COUNTED HERE, not on the page request, and the difference is every link
     preview robot in China. WeChat fetches the page itself to build the card
     — once per group it is pasted into, sometimes more — and counting those
     makes a number that goes up when nobody came. This runs from a browser
     that executed the page's script, which is the nearest thing to a person
     that can be counted without counting people.
     Not awaited: a reader must never wait on a write. */
  change((b) => {
    const row = b.announces.find((x) => x.code === code);
    if (row) row.seen = Math.min(9_999_999, (row.seen || 0) + 1);
    return { ok: true };
  }).catch(() => { /* a number, and the next reader adds one */ });
  res.json({ title: a.title, body: a.body,
    titleZh: a.titleZh, bodyZh: a.bodyZh, photo: a.photo, at: a.at });
});

/** THE PICTURE, AND ONLY AN ANNOUNCEMENT'S.
 *
 *  /api/public-media is behind the door on purpose — see the note above
 *  OPEN_PATHS — so that a member's face is not fetchable by anybody holding
 *  its id. This route is open, which is the entire point of an announcement,
 *  so the id is looked up in board.announces before a byte is read. A
 *  member's photograph cannot be fetched here whatever id is presented, and
 *  the rule this board already made stands exactly as it was.
 *
 *  A REMOVED ONE STOPS BEING SERVED. Not for long — see the cache header —
 *  because a picture of a person is the part of a taken-down poster that
 *  actually matters, and a day of caching would leave it on screens after
 *  somebody asked for it to come down.
 */
app.get("/api/announce-media", async (req, res) => {
  const id = String(req.query.id || "");
  const board = await store.load(FILE);
  if (!board.announces.some((a) => a.photo === id && a.state === "published")) {
    return res.status(404).json({ error: "no such file" });
  }
  const found = await findMedia(id);
  if (!found) return res.status(404).json({ error: "no such file" });
  res.set("Content-Type", found.type);
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Cache-Control", "public, max-age=300");
  res.sendFile(found.file);
});

/** The page itself.
 *
 *  THE PREVIEW CARD IS WRITTEN PER REQUEST, which is why this does not just
 *  serve the file. A chat client builds its card from og: tags without ever
 *  running the page's script, so an announcement served with the board's
 *  default card would arrive in a group as "Invite only" and a stock picture
 *  — the same link, the same grey box, however many different things were
 *  posted. The title and the picture have to be in the HTML that comes back.
 *
 *  Escaped into an attribute, and the escape is the whole of the checking:
 *  the title is somebody's typed text going into a quoted HTML attribute on
 *  a page anybody can read.
 */
const attr = (v) => String(v || "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

app.get("/a/:code", async (req, res, next) => {
  /* A FILE IS NOT A POSTER, AND THIS ROUTE WAS ANSWERING FOR BOTH.
   *
   * The counter is loaded as <script src="/a/lx.js"> — first-party on purpose,
   * proxied by Caddy on the box so nothing here is a third-party request. Off
   * the box there is no Caddy, so the request landed HERE, matched :code, and
   * came back 200 with announce.html in it. The browser parsed a poster as
   * JavaScript and threw "Unexpected token '<'" on every page that loads the
   * counter, with no stack and no clue what asked for it. An hour to find.
   *
   * It is not only a local annoyance. If that Caddy rule is ever reordered or
   * dropped, the counter silently becomes an announcement page and the same
   * error appears on the real board — and a 200 is the one status nothing
   * anywhere will flag.
   *
   * A code is six characters and never contains a dot. Anything with one is a
   * file that is missing, and a missing file is a 404: the same rule the gate
   * above already uses to tell a page from a path. A mistyped code still gets
   * the friendly page, which is the case that wanted it. */
  if (/\.[a-z0-9]{2,5}$/i.test(String(req.params.code || ""))) return next();
  const code = store.cleanCode(req.params.code);
  const board = await store.load(FILE);
  const a = code && board.announces.find((x) => x.code === code
    && x.state === "published");
  const proto = String(req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0];
  const host = String(req.get("host") || "").replace(/[^A-Za-z0-9.:-]/g, "").slice(0, 253);
  const origin = host ? proto + "://" + host : "";
  /* WHICH LANGUAGE THE CARD IS IN, and a crawler cannot be asked.
   *
   * A chat client fetches this once, from a datacentre, with no reader and no
   * preference — so the card is whatever is written here and there is no
   * second chance at it. The Chinese wins when it exists, because the reason
   * anybody wrote one is that this link is going into a Chinese group; a
   * poster with no Chinese version is being sent somewhere else and shows the
   * English.
   *
   * ?l=en forces the English for the case the rule above gets wrong: one
   * poster, written in both, pasted into a Chinese group AND into a room full
   * of Australian agents. The page itself always shows the reader their own
   * language and has the switch on it — this is only about the card. */
  const wantEn = String(req.query.l || "") === "en";
  const zh = a && a.titleZh && !wantEn;
  return page("announce.html", req, res, next, {
    "{{A_TITLE}}": attr(a ? (zh ? a.titleZh : a.title) : "交换 · The Exchange"),
    /* The body is a paragraph and og:description is a line. Cut on a word,
       not mid-character, and only the first line: a poster's opening sentence
       is what somebody wrote to be read first. */
    "{{A_BODY}}": attr(a
      ? String((zh ? (a.bodyZh || a.body) : a.body) || "").split("\n")[0].slice(0, 160)
      : "A private board for people doing business across a border."),
    "{{A_IMAGE}}": attr(a && a.photo
      ? origin + "/api/announce-media?id=" + a.photo
      : origin + "/share.png"),
  });
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

/** Who may write an announcement. The same shape as can-offer above and for
 *  a harder reason — see canAnnounce in store.js. One person at a time. */
app.post("/api/admin/can-announce", admin, express.json({ limit: "2kb" }), async (req, res) => {
  const who = String(req.body?.who || "").trim().toLowerCase();
  const on = req.body?.on !== false;
  if (!who) return res.status(400).json({ error: "who" });
  const out = await change((board) => {
    // A handle is not unique. Refuse rather than guess — same as can-offer.
    const all = board.people.filter((x) => String(x.handle || "").toLowerCase() === who);
    const id = String(req.body?.id || "");
    const q = id ? all.find((x) => x.id === id) : all.length === 1 ? all[0] : null;
    if (!q && all.length > 1) {
      return { error: "which", rows: all.map((x) => ({ id: x.id, state: x.state, canAnnounce: Boolean(x.canAnnounce) })) };
    }
    if (!q) return { error: "nobody" };
    q.canAnnounce = on;
    Object.assign(q, store.cleanPerson(q));
    return { handle: q.handle, canAnnounce: q.canAnnounce, state: q.state, rows: all.length };
  });
  if (out?.error) return res.status(out.error === "which" ? 409 : 404).json(out);
  res.json(out);
});

app.get("/api/admin/can-announce", admin, async (_req, res) => {
  const board = await store.load(FILE);
  res.json({
    people: board.people.filter((q) => q.handle)
      .map((q) => ({ handle: q.handle, state: q.state, canAnnounce: Boolean(q.canAnnounce) })),
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
/** HOW SOMEBODY IS FOLLOWED, which is not the same as who they are.
 *
 *  A member is followed by their page id. Somebody at a door has no page, so
 *  they are followed by "w:<row id>" — the same second address a note takes.
 *  Returns "" for a browser that is neither, which follows nobody and is
 *  followed by nobody.
 */
function followKey(board, h) {
  if (!h) return "";
  const q = board.people.find((x) => x.by === h && x.handle && x.state === "published");
  if (q) return q.id;
  const w = board.waits.find((x) => x.by === h && !x.done);
  return w ? "w:" + w.id : "";
}

/** THEY FOLLOWED EACH OTHER, WHOEVER THEY ARE.
 *
 *  matched() below is the Browse mechanic: two members, whose sentences fit,
 *  in a shared room. This is the other way two people on this board end up
 *  talking — they stood in the same room, read each other, and both pressed
 *  follow.
 *
 *  IT IS NOT A WAY IN. It opens one conversation between two people who chose
 *  each other and nothing else: no Browse, no member list, nobody they could
 *  not already see. Seeing somebody in a room has never meant being inside,
 *  and this keeps it that way — what it stops is the only other place that
 *  conversation could have gone, which is WeChat.
 */
function bothFollow(board, me, them) {
  const a = followKey(board, me);
  const b = followKey(board, them);
  if (!a || !b) return false;
  return board.follows.some((f) => f.by === me && f.who === b)
    && board.follows.some((f) => f.by === them && f.who === a);
}

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
  /* NO PAGE, NO INTRODUCTION — the same rule /api/note enforces, said here so
   * the button and the route cannot disagree.
   *
   * This said "yes" to anybody with no conversation yet, because before the
   * rooms the only people on this screen had pages. Now somebody at a door
   * can reach a member's page, and "Say hello" was offered to them and then
   * refused by the route: an introduction from a name that does not exist is
   * not one. Two ways past it, both of them the other person having agreed —
   * a member who wrote to them first, or a follow each way. */
  const hasPage = board.people.some((q) => q.by === me && q.handle
    && q.state === "published");
  if (!hasPage && !writePair(board, me, them) && !bothFollow(board, me, them)) {
    return { can: false, why: "profile", open: false };
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
  /* WHOEVER RUNS THE BOARD CAN OPEN A CONVERSATION WITH ANYBODY ON IT.
   *
   * Everything below this line is the rule the board is built on: nothing
   * happens between two people until each of them is what the other is
   * looking for. That rule stays, for members, and it is what the landing page
   * and the App Store listing both say.
   *
   * It was never the right rule for the person running the place. Putting two
   * people in a room, answering somebody who has just arrived, telling a
   * member their invite went out — all of it needed a match that has no
   * meaning between an operator and a member, and the way round it was a
   * command on the box and a name looked up by hand.
   *
   * BOARD_STAFF AND NOTHING ELSE. Not a flag on a row, which is a thing that
   * can be set by a route somebody adds next month; a handle in the box's
   * environment, read once at boot, changed only by whoever can already read
   * the data. An empty BOARD_STAFF is a board where this does nothing.
   *
   * A BLOCK STILL HOLDS, and it is checked above this. Somebody who blocked
   * the operator blocked the operator: an override that ignored that would
   * make the block a suggestion, and the block is the one control on this
   * board that has to mean exactly what it says.
   *
   * THE OTHER PERSON IS TOLD WHY. `why: "staff"` reaches the screen, which
   * says who this is — see note.fromStaff. A message from somebody you never
   * matched with, with no explanation, is the thing the match rule exists to
   * prevent, and doing it silently would be building the bad version of this
   * for one person instead of for everybody. */
  if (isStaff(board, me)) {
    const last = between[between.length - 1];
    return {
      can: true, open: true, why: "staff",
      /* WHICH SIDE IS ASKING. The state is the same object for both of them,
         so without this the line explaining who opened the thread would be
         shown to the person who opened it, about themselves. */
      byStaff: true,
      answering: last && last.to === me ? last.id : "",
      deal: deal ? deal.code : "",
    };
  }

  if (isStaff(board, them)) {
    const last = between[between.length - 1];
    return {
      can: true, open: true, why: "staff", byStaff: false,
      answering: last && last.to === me ? last.id : "",
      deal: deal ? deal.code : "",
    };
  }

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
  /* Either way of choosing each other opens the same thread — see bothFollow.
     The Browse match is two members whose sentences fit; this is two people
     who stood in a room and both pressed follow. */
  if (matched(board, me, them) || bothFollow(board, me, them)) {
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

/* NOT BEHIND `gate`, for the same reason /api/follow is not.
 *
 * `gate` asks whether this browser spent an invite. Somebody who walked into
 * a door room with a name did not — and they are exactly the people this is
 * for: they are waiting, they get @'d, and nothing tells them. A subscription
 * is a device asking to be buzzed and is only ever used to buzz that device,
 * so the check that matters is that there is a person behind it at all, which
 * is done in the write below.
 */
app.post("/api/push/on", express.json({ limit: "8kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  if (!me) return res.status(400).json({ error: "no" });

  /* TWO WAYS IN, BECAUSE A PHONE HOLDING THE APP CANNOT USE THE FIRST ONE.
   *
   * The browser sends `sub` — the endpoint and keys its push service handed
   * it. The app sends `apns` — sixty-four hex characters Apple handed it, and
   * nothing else, because a WKWebView has no Push API to produce the other
   * shape. See lib/apns.js.
   *
   * ONE ROUTE AND NOT TWO. The gating below is the part worth getting right —
   * somebody real behind the row, their own row and no other — and a second
   * route would be a second copy of it, drifting. */
  const apnsTok = String(req.body?.apns || "").trim().toLowerCase();
  if (apnsTok) {
    if (!pushApns.configured()) return res.status(503).json({ error: "off" });
    /* Which language this phone reads in, said by the page that knows — see
       the note over `lang` in cleanPush. */
    const row = store.cleanPush({ by: me, apns: apnsTok, lang: req.body?.lang });
    if (!row) return res.status(400).json({ error: "bad" });
    const out = await change((board) => {
      board.pushes = board.pushes || [];
      const had = board.pushes.find((x) => x.endpoint === row.endpoint);
      if (had) { had.by = me; return { ok: true }; }
      const real = board.people.some((q) => q.by === me)
        || board.waits.some((w) => w.by === me && !w.done);
      if (!real) return { error: "who" };
      board.pushes.push(row);
      return { ok: true };
    });
    if (out && out.error) return res.status(403).json(out);
    return res.json({ ok: true });
  }

  if (!push.configured()) return res.status(503).json({ error: "off" });
  const sub = push.cleanSub(req.body?.sub);
  if (!sub) return res.status(400).json({ error: "bad" });
  const out = await change((board) => {
    board.pushes = board.pushes || [];
    /* KEYED ON THE ENDPOINT, NOT THE DEVICE. A browser rotates its endpoint
       and re-subscribes; a member signs in on a second phone. Both are one row
       each, and the same endpoint arriving twice is the same phone. */
    const had = board.pushes.find((x) => x.endpoint === sub.endpoint);
    if (had) { had.by = me; had.keys = sub.keys; return { ok: true }; }
    /* SOMEBODY REAL BEHIND IT, which is what `gate` used to be standing in
       for: a member's page, or a live row at a door. A browser that is neither
       has nothing on this board to be told about, and every row stored here is
       a request this server will later make to the internet. */
    const real = board.people.some((q) => q.by === me)
      || board.waits.some((w) => w.by === me && !w.done);
    if (!real) return { error: "who" };
    const row = store.cleanPush({ by: me, ...sub });
    if (row) board.pushes.push(row);
    return { ok: true };
  });
  // Refused rather than quietly stored, so the page can stop asking.
  if (out && out.error) return res.status(403).json(out);
  res.json({ ok: true });
});

// Turning it off is never gated — see the note on /api/push/on, and the rule
// everywhere else here that taking something back always works.
app.post("/api/push/off", express.json({ limit: "8kb" }), async (req, res) => {
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
          const w = board.waits.find((x) => x.id === who.slice(2) && !x.done);
          /* TWO WAYS TO BE REACHABLE WITHOUT A PAGE, and no third. Somebody a
             member wrote to, who is answering them; and somebody who followed
             this person in a room and was followed back. Anybody else on the
             list is not addressable, which is what the door is for. */
          if (!w || !w.by) return null;
          if (!w.fromWrite && !bothFollow(board, me, w.by)) return null;
          // Shaped like a person for the checks below, and deliberately
          // without an id: there is no page and nothing to open.
          return { id: "", by: w.by, handle: w.name, state: "published" };
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
    /* OR THE TWO OF THEM FOLLOWED EACH OTHER IN A ROOM — see bothFollow.
       The profile rule is about an introduction from a name that does not
       exist; two people who read each other in a room and both pressed follow
       are not introducing themselves to a stranger either. */
    const mine = board.people.find((q) => q.by === me);
    if ((!mine || !mine.handle) && !writePair(board, me, target.by)
        && !bothFollow(board, me, target.by)) {
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

    /* THE SAME RULE, IN THE OTHER PLACE TWO PEOPLE TALK. See the long note in
       /api/group/say: a rule that holds in a room and not in a thread is a
       rule with a gap in it, and the thread is where two matched people are
       most likely to try. */
    const shaped = store.contactShaped(text);
    if (shaped) return { error: "contact", what: shaped };

    const note = store.cleanNote({
      id: store.newId(), at: new Date().toISOString(),
      by: me, to: target.by, re, text,
    });
    if (!note) return { error: "no" };
    board.notes.push(note);
    /* WHO TO SAY WROTE, in the email: the row carries device hashes and an
       inbox cannot be addressed with one. `mine` is the writer when they are
       a member — but the person this whole idea is about is not one. A buyer
       in Shanghai who answered a listing has a name on the waiting row and
       nothing else, and hers is exactly the message that must not arrive
       anonymously. */
    const waiting = mine?.handle ? null : board.waits.find((w) => w.by === me && w.name);
    return {
      note,
      from: mine?.handle || waiting?.name || "",
      answering: Boolean(state.answering),
    };
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
  /* And the inbox, which is the one most of them will actually see. The
     link is built here because this runs after the response, when the
     request is gone. */
  mailThem(out.note.to, out.from, backHere(req, "/notes#" + encodeURIComponent(out.from)))
    .catch((err) => console.error("note mail:", err.message));
});

/* AND THE EMAIL, BECAUSE THE BUZZ REACHES ALMOST NOBODY.
 *
 * A push needs the app installed and notifications allowed, which is a
 * fraction of any board and close to none of the people this product is
 * about to list — a photographer in Melbourne who was sent a link once. So
 * somebody writes from Shanghai, the phone does not buzz, and she concludes
 * Australia ignored her. That is the whole product failing on a step nobody
 * built.
 *
 * WHAT IT CARRIES, AND WHAT IT DOES NOT. Who wrote, and a link into the
 * thread. Not the message: a push deliberately carries nothing because the
 * words belong behind the door, and an inbox is not behind it. The name is
 * the part that makes somebody open the app, and it is already the part they
 * would see on a lock screen.
 *
 * ONE AN HOUR PER CONVERSATION. A chatty buyer writes forty messages in an
 * afternoon and forty emails is how somebody unsubscribes from their own
 * business. In memory, so a restart may allow one extra — which is the right
 * way round for a thing whose failure mode is silence.
 *
 * NEVER AWAITED AND NEVER THROWN. The sender is watching their own message
 * appear; whether a mail server is slow is not theirs to wait for, and a
 * bounce is not theirs to know about.
 */
const mailedAt = new Map();

async function mailThem(to, from, link) {
  if (!mailReady() || !to || !from) return;
  const board = await store.load(FILE);
  const them = board.people.find((p) => p.by === to);
  /* No address, no email. Which is why asking for one is part of listing
     somebody, not an optional line at the end of their page. */
  const addr = String(them?.mail || "").trim();
  if (!addr) return;

  const key = to + ":" + from;
  const now = Date.now();
  if (now - (mailedAt.get(key) || 0) < 60 * 60_000) return;
  mailedAt.set(key, now);

  /* In their language, by the same rule the rest of the board uses: a name
     written in Chinese characters is a person who reads Chinese. It guesses
     wrong for a Chinese speaker with an English handle, which is the
     direction that costs the least. */
  const zh = /[\u4e00-\u9fff]/.test(String(them.handle || ""));
  const site = process.env.BOARD_SITE_NAME || "The Exchange";
  await sendMail({
    to: addr,
    subject: zh ? `${from} 给你留言了` : `${from} wrote to you`,
    text: zh
      ? `${from} 在${site}上给你留言了。\n\n看看并回复：\n${link}\n\n`
        + "你收到这封邮件，是因为你在这里留过邮箱。别人看不到它。\n"
      : `${from} wrote to you on ${site}.\n\nRead it and answer:\n${link}\n\n`
        + "You are getting this because you left an address here. Nobody else sees it.\n",
  });
}

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
  /* AND A CONVERSATION CLEARED OFF THIS LIST — see cleanHide.
   *
   * Everything up to the moment they cleared it, gone from their screen and
   * from nobody else's. The rows are still there and the other person's copy
   * is untouched; if anything arrives after that line the thread comes back
   * carrying only what is new, which is what every messenger on this phone
   * does and the reason blocking is a different button.
   */
  const cleared = new Map();
  for (const x of board.hides || []) if (x.by === me) cleared.set(x.who, x.at);
  const rows = rows0.filter((n) => !iLeft.has(other(n))
    && !(cleared.has(other(n)) && String(n.at) <= String(cleared.get(other(n)))));
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
    /* Whether there is a doorman to draw, same as /api/me and /api/wait/me.
       Messages is the screen where somebody most often has a question they
       would rather ask than guess at — what to write, whether to write at
       all — so it is the last place he should be missing from. */
    butler: butler.configured(),
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

/** Clearing one off your own list. Not leaving — see cleanHide. */
app.post("/api/note/hide", notesOff, express.json({ limit: "2kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const who = String(req.body?.who || "");
  if (!me) return res.status(400).json({ error: "no" });
  if (!/^[a-f0-9]{20}$/.test(who)) return res.status(400).json({ error: "gone" });
  const out = await change((board) => {
    /* TWO KINDS OF THREAD AND BOTH CAN BE CLEARED. A member has a profile; a
       person on the waiting list has a row and no profile at all, and their
       thread is addressed by the row's id — see `name` in /api/notes. Leaving
       only ever worked for the first, which left the one conversation most
       likely to be finished with as the one that could not be put away. */
    const q = board.people.find((x) => x.id === who);
    const w = !q && board.waits.find((x) => x.id === who);
    const hash = q ? q.by : (w ? w.by : "");
    if (!hash || hash === me) return { error: "gone" };
    board.hides = board.hides || [];
    board.hides = board.hides.filter((x) => !(x.by === me && x.who === hash));
    board.hides.push(store.cleanHide({ by: me, who: hash }));
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
  /* WHOEVER RUNS THE BOARD CAN PUT ANYBODY IN A ROOM — see the long note over
     inApp's neighbour, isStaff, and the one in threadState.
     
     The same reasoning as writing to somebody: a room is made out of the
     maker's matches, which is the right rule for a member and has no meaning
     for the operator. Putting two people together who should meet is the
     commonest thing he does and it needed a match with each of them first,
     or a command on the box.
     
     HERE AND NOT AT THE FOUR CALL SITES. This one function is the gate for
     all of them — the picker on /groups, making a room, adding to one, and
     minting a group invite — so the screen cannot offer a name the route then
     refuses, which is the bug this kind of change ships with. */
  const all = isStaff(board, me);
  return board.people
    .filter((q) => q.state === "published" && q.handle && q.by !== me
      && (all || matched(board, me, q.by)))
    .map((q) => ({ who: q.id, handle: q.handle,
      photo: q.photoState === "published" ? q.photo : "" }));
}

/* HIS NAME, IN ONE PLACE. The page has i18n and the server does not, and a
 * line he says is stored — so it is stored in whatever language it was written
 * in, like everybody else's, rather than becoming a key the page resolves
 * later. BOARD_BUTLER_NAME in .env for a board that calls him something else.
 */
const MO_NAME = (process.env.BOARD_BUTLER_NAME || "Mo").slice(0, 24);

/* WHERE THE PLATFORM'S 2% IS PAID, and the whole of the switch. Unset, no fee
   row is drawn anywhere and a deal is exactly what it was. It is a page
   belonging to whoever runs this board — the board still never holds a cent,
   the payer simply has a second person to pay. See feeOf() in lib/store.js. */
const DEAL_FEE_TO = store.cleanPayLink(process.env.BOARD_DEAL_FEE_TO || "");
/* Stripe's publishable key. Public by design — it is in the page source of
   every shop that takes cards — but sent only to somebody who has pressed pay,
   not baked into the board for everybody to read. Unset, /api/pay/start still
   answers and the room falls back to the payee's link, as it did before. */
const STRIPE_PK = (process.env.BOARD_STRIPE_PK || "").trim();
/* A LOOK, NOT A PAYMENT.
 *
 * `make try` sets this so the payer's screens can be walked on a laptop with
 * no Stripe account, no keys and no connected account — which is the only way
 * to judge them before a deploy, and judging them before a deploy is the whole
 * reason `make try` exists.
 *
 * It draws a stand-in where Stripe's form goes and says on the screen that it
 * is one. It cannot take money: there is no key behind it and no account to
 * take money into. It is never set on the box. Every guard on /api/pay/start —
 * who is asking, which side they are on, whether the amount is a number —
 * still runs, so what is skipped is the call to Stripe and nothing else. */
const PAY_DEMO = process.env.BOARD_PAY_DEMO === "1";

/* WHAT HE SAYS WHEN THE WIRE TRIPS. Stored like anybody else's line, so it is
 * written once in one language rather than being a key the page resolves —
 * see the note over MO_NAME. It is the sentence already printed under every
 * conversation on this board, said by somebody in the room at the moment it
 * stops being general advice.
 * Not an accusation, and deliberately not addressed to whoever wrote the line:
 * the tripwire is a regex and regexes are wrong about people. It tells the
 * room what is true and leaves the judgement to them. */
/* WHAT IS ACTUALLY HAPPENING, IN THE OPERATOR'S OWN WORDS.
 *
 * Tom asked for him to talk about co-productions in development, and he cannot
 * — there is nothing on this board that knows about one, and a doorman who
 * invents a film to make somebody stay is the exact failure this whole brief
 * is written to prevent.
 *
 * So it is handed to him instead. One or two true sentences in .env, written
 * by the person who knows: BOARD_BUTLER_NOW="Two co-pros are casting in
 * Beijing this month." He may use it when it answers what was asked, in his
 * own words, and it is the only thing about the state of the world he has.
 * When it stops being true it is deleted, the same rule as the brief itself.
 */
const MO_NOW = String(process.env.BOARD_BUTLER_NOW || "").slice(0, 400).trim();

/* AND WHAT THE BOARD ITSELF KNOWS, WHICH IS MOST OF THE ANSWER.
 *
 * "@Mo what's the updates" came back silent, and the reason was that the one
 * true thing he had about the world was a sentence in .env that nobody had
 * written. Which is the wrong shape for the question: the board knows exactly
 * what has happened this week — who arrived, at which door, how much was said,
 * how many are inside — and it knows it without anybody remembering to type
 * it. MO_NOW stays for the thing only a person knows ("two co-pros are casting
 * in Beijing this month"). This is the rest.
 *
 * COUNTS AND ROOMS, NEVER A NAME. The rule about who he may name does not bend
 * for a number: the only people he can say out loud are the few already
 * browsable from outside, and those come from peekFor. Nothing here is new
 * disclosure either — the door already prints how many have asked and how many
 * are in Browse, on the page somebody is standing on while they ask him.
 */
const ROOM_WORDS = { film: "Film & TV", invest: "Investment", raise: "Raising",
  trade: "Trade", other: "the other room" };

/* WHO IS STANDING IN THIS ROOM, so he can put two of them together.
 *
 * The one thing a doorman in a room is for. Katy comes to the film door and
 * says she is a model looking for shoots; Hugo is standing in the same room
 * and he is a producer; and nobody introduces them, because the only person
 * whose job that is has never been told who is in the room he is in.
 *
 * NOTHING HERE IS A DISCLOSURE. This is the door room, and everybody in it
 * sees the others — their name is on every message and their line is on the
 * queue screen. He is saying out loud what is already on the screen of the
 * person he is saying it to. The rule he must never bend is the OTHER one:
 * who is INSIDE, behind the door, which is peekFor and nothing else.
 *
 * First names and their own words. Never a contact, never a photograph,
 * never a word of what anybody said in the room — see the note over the ask:
 * he is given nobody's messages, and that has not changed.
 */
function roomFolk(board, key, me) {
  if (!store.WAITROOMS_CHAT.includes(key)) return [];
  return board.waits
    .filter((w) => !w.done && w.shown && w.by !== me
      && (w.room || "other") === key && String(w.name || "").trim())
    .slice(-12)
    .map((w) => ({
      name: String(w.name).trim().split(/\s+/)[0],
      me: w.me || "",
      want: w.want || "",
      // Their own line, which is the whole of what anybody knows about them.
      note: String(w.why || "").replace(/\s+/g, " ").slice(0, 120),
    }))
    .filter((x) => x.note || (x.me && x.want));
}

function nowOn(board) {
  const week = Date.now() - 7 * 86400_000;
  const at = (x) => Date.parse(x || "") || 0;
  const live = board.waits.filter((w) => !w.done);
  const came = live.filter((w) => at(w.at) > week);
  const inBrowse = board.people.filter(
    (q) => q.handle && q.state === "published" && q.looking).length;
  /* What people said, not what Mo said. A room where the only voice is his is
     a quiet room, and counting his own lines into "busy" would be him telling
     somebody the place is lively on the strength of his own welcomes. */
  const spoke = board.says.filter((m) => m.text && !m.evt && m.by !== store.MO
    && at(m.at) > week).length;
  const doors = {};
  for (const w of came) {
    const k = store.WAITROOMS_CHAT.includes(w.room || "") ? w.room : "other";
    doors[k] = (doors[k] || 0) + 1;
  }
  const top = Object.entries(doors).sort((a, b) => b[1] - a[1])[0];
  const bits = [];
  if (came.length) {
    bits.push(came.length + (came.length === 1 ? " person has" : " people have")
      + " come to the door in the last seven days");
  }
  if (top && top[1] > 1) bits.push("the busiest door is " + ROOM_WORDS[top[0]]);
  /* Counted out in words, because he is told to say the number as it is —
     and "1 people are in Browse" is a number he would quietly reword. */
  if (live.length) {
    bits.push(live.length + (live.length === 1 ? " is" : " are") + " waiting at the door now");
  }
  if (inBrowse) {
    bits.push(inBrowse + (inBrowse === 1 ? " person is" : " people are") + " in Browse");
  }
  if (spoke) {
    bits.push(spoke + (spoke === 1 ? " thing was" : " things were")
      + " said in the rooms this week");
  }
  return bits.length ? bits.join("; ") + "." : "";
}

const MO_WATCH = (process.env.BOARD_BUTLER_WATCH
  || "Nobody here should ask you for money, a deposit, or photographs of your"
   + " documents. If that is what just happened, report it \u2014 I have passed"
   + " it on either way.").slice(0, 600);

/** The groups this person is in, with who is in them and what was said. */
/** THE MEMO LINK IS NOT FOR THE WHOLE ROOM.
 *
 *  A room can hold more than the two people the deal is between — the
 *  operator keeps some by hand, and a deal is often struck in a room with a
 *  third person in it. They may read the memo, because they are standing in
 *  the room it was pinned in. The share is different: its code opens the deal
 *  from outside the door and its `saw` list is device hashes, which is nobody
 *  else's to hold.
 *
 *  So: the two parties get the link, the code and the clock, and never the
 *  viewer list; anybody else gets no share at all, which is also why the room
 *  draws them no Send button.
 */
function dealOut(deal, handle) {
  if (!deal) return null;
  if (!deal.share) return deal;
  const party = handle && [deal.hires, deal.provides].includes(handle);
  const { share, ...rest } = deal;
  if (!party) return rest;
  return { ...rest, share: { t: share.t, code: share.code, to: share.to, until: share.until } };
}

app.get("/api/groups", notesOff, async (req, res) => {
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
  res.set("Cache-Control", "no-store");
  if (!me) return res.json({ groups: [], canAdd: [] });
  const board = await store.load(FILE);
  const name = (hash) => {
    const q = board.people.find((x) => x.by === hash);
    return q ? { who: q.id, handle: q.handle,
      /* WHAT THEY ARE, under the name. The only fact anybody in a room is
         deciding on — see the note in named() at /api/door. */
      role: ((Array.isArray(q.say) ? q.say : [])[0] || {}).me || "",
      photo: q.photoState === "published" ? q.photo : "" } : null;
  };
  /* THE ROOMS SOMEBODY IS IN, AND THE ONE THEY WERE INVITED INTO.
     A guest reads a room exactly as a member does — that is the whole point of
     letting them in before they have a name — so it comes back on the same
     list with one word on it. `who` is drawn from members either way, so a
     guest is not in the faces along the top and nobody in there sees a
     stranger who has not said who they are. */
  /* THE DOORMAN IS IN EVERY ROOM, and he is in `who` rather than in members:
     he holds no seat, cannot be counted against the cap, cannot leave and
     cannot be left with. A row in the file would be a member with none of a
     member's properties, which is the kind of second meaning that goes wrong
     quietly. He is drawn, not stored. */
  const mo = { who: store.MO, handle: MO_NAME, photo: "", bot: true };
  /* The reader's own handle, read once — dealOut needs it per group and
     finding it inside the map would be a scan of `people` per room. */
  const myHandle = (board.people.find((q) => q.by === me) || {}).handle || "";
  const groups = board.groups
    .filter((g) => g.members.includes(me) || (g.guests || []).includes(me))
    .map((g) => ({
      id: g.id, name: g.name, at: g.at, mine: g.by === me,
      guest: !g.members.includes(me),
      /* A ROOM THE OPERATOR KEEPS BY HAND, which is the one room that carries
         the ledger at the top of it. Everywhere else it would be the app
         talking about itself over the top of a conversation; here the room is
         about the thing the ledger describes and everybody in it was put there
         on purpose. */
      hand: Boolean(g.hand),
      /* THE MEMO, PINNED. Sent whole rather than as a flag with a second
         fetch behind it: it is six short lines and it is the first thing
         anybody opening this room needs to read. `me` is the reader's own
         handle so the card can tell whether they are a party to it or a
         witness, without the page having to work that out from faces. */
      deal: dealOut(g.deal, myHandle),
      /* HOW THIS DEAL CAN ACTUALLY BE PAID, worked out here because only the
         server knows whether the payee has set up payouts. "stripe" means one
         pass through Connect in the method the payer picks; "link" is the
         payee's own page, which is what everybody had before and what a
         mainland payee keeps. Empty means neither, and the card says so
         rather than offering a button that cannot work. */
      pay: g.deal ? (() => {
        const them = board.people.find((q) =>
          g.members.includes(q.by) && q.handle === g.deal.provides);
        const readable = Array.isArray(g.deal.plan) && g.deal.plan.length
          && g.deal.plan.every((r) => store.toMinor(r.amount, g.deal.cur));
        if ((stripe.configured() || PAY_DEMO) && them?.payee && readable) return "stripe";
        return g.deal.payTo ? "link" : "";
      })() : "",
      /* Whether the reader is the one who needs to set payouts up, and has
         not. Only ever true for the payee themselves. */
      /* `where` is deliberately not consulted — see the note over
         /api/pay/onboard. It says which half of the world somebody is in, not
         where their bank is, and reading it as the second refused a payee in
         the mainland holding an Australian account. */
      needsPayout: Boolean(g.deal && stripe.configured()
        && (board.people.find((q) => q.by === me) || {}).handle === g.deal.provides
        && !(board.people.find((q) => q.by === me) || {}).payee),
      /* Computed here rather than stored, so it is right when the terms are
         edited and cannot be deleted by either side. Null when the board
         names no page to pay it on. */
      /* THE FEE, AND THE ROOM'S NAME TRAVELLING WITH IT. client_reference_id
         is handed to Stripe on the way out and handed back untouched on the
         webhook, which is the only way the board can tell which deal a
         payment belonged to. A group id and nothing else: twenty hex
         characters that name a room, no person, no amount. */
      fee: g.deal ? (() => {
        const f = store.feeOf(g.deal, DEAL_FEE_TO);
        if (!f) return null;
        try {
          const u = new URL(f.to);
          u.searchParams.set("client_reference_id", g.id);
          f.to = u.href;
        } catch { /* cleanPayLink already proved it parses; belt and braces */ }
        return f;
      })() : null,
      /* WHICH ROUTE THE MONEY SHOULD TAKE, worked out from where the two of
         them are. Computed here because only the server knows where anybody
         is: `where` is on the person row and never leaves it — the page is
         told the answer, not the two facts it came from. */
      route: g.deal ? (() => {
        const side = (h) => (board.people.find((q) =>
          g.members.includes(q.by) && q.handle === h) || {}).where || "";
        return store.routeFor(g.deal, side(g.deal.hires), side(g.deal.provides));
      })() : "",
      meHandle: (board.people.find((q) => q.by === me) || {}).handle || "",
      /* CODES MINTED FOR THIS ROOM AND NOT YET SPENT, to whoever minted them.
       * They hold seats — see groupRoom and the note over POST /api/invite —
       * so a room of two can be full and the screen has to be able to say why
       * in numbers rather than in a rule. Codes only, never the name they were
       * written for: that goes in the link and is never stored. */
      held: g.by === me
        ? board.invites.filter((x) => x.grp === g.id && !x.off && !x.usedBy
            && !store.inviteOver(x))
            .map((x) => ({ code: x.code, until: x.until }))
        : [],
      // Names and faces, never the device hashes the group is stored under.
      /* `self` so the screen can tell which face is the reader's own without
         being told a hash. The maker's ＋/－ needs it: taking yourself out is
         leaving, which is its own button further down the same screen. */
      who: [...g.members.map((h) => {
        const n = name(h);
        return n && { ...n, self: h === me };
      }).filter(Boolean), mo],
      says: board.says.filter((m) => m.group === g.id)
        .sort((a, b) => String(a.at).localeCompare(String(b.at)))
        .map((m) => ({ id: m.id, at: m.at, text: m.text,
                     /* The same line in the other language, rendered once when
                        it was said — see renderSay. The page picks; nobody
                        presses anything. */
                     alt: m.alt || "", alt2: m.alt2 || "", lang: m.lang || "",
          // What happened to the room, when the line is about the room — see
          // moSays. The page writes the sentence; this is the fact.
          evt: m.evt || null,
          mine: m.by === me, reported: Boolean(m.report),
          ...(m.by === store.MO
            ? { who: store.MO, handle: MO_NAME, photo: "", bot: true }
            : (name(m.by) || { who: "", handle: "", photo: "" })) })),
    }));
  /* THE LEDGER, AND IT IS THE SAME TWO FACTS THAT ARE ON A PERSON'S PAGE.
   *
   * Which band you are in, and how many places are left in the one still
   * filling. Sent once for the reader rather than per room, because it is a
   * fact about them and the board — not about any room — and a figure computed
   * twice is a figure that can disagree with itself.
   *
   * NO CURRENCY, AND THAT IS THE WHOLE OF THE DECISION. The prototype this
   * comes from put a dollar value per person at the top of the room. Priced
   * off the company's own deck the entire pool over 20,000 places averages
   * about a hundred dollars, so the figure is worth less to the person holding
   * it than the band name is — and a number that rises as the room grows,
   * shown to people who are in the room, is the thing the brief for counsel
   * exists to ask about. Bands ship today. The figure waits. */
  const mine = board.people.find((q) => q.by === me && q.handle);
  res.json({
    groups, canAdd: groupable(board, me), max: store.GROUP_MAX,
    /* So the line over the picker can say what the list actually is. For a
       member it is the people they matched with; for whoever runs the board
       it is everybody, and a screen that said "anybody you have matched with"
       over a list of strangers would be the screen lying about itself. */
    staff: isStaff(board, me),
    layer: mine && mine.seq ? (() => {
      const l = store.layerOf(mine.seq);
      // The arrival number stays here, the same as it does in shownPerson.
      return l ? { key: l.key, n: l.n, of: l.of } : null;
    })() : null,
    layerNow: layerNow(board),
  });
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

/** The memo pinned to a room: what is being bought, and by whom.
 *
 *  WHO MAY WRITE IT: anybody in the room. Not only the maker — the person who
 *  knows the fee is usually not the person who opened the conversation, and a
 *  memo that has to be relayed through a third party is a memo with a typo in
 *  the number.
 *
 *  EDITING CLEARS THE AGREEMENTS, and the card says so before the button is
 *  pressed. "They agreed" has to mean they agreed to these words; carrying old
 *  ticks onto new terms is the one thing this must never do, and it is the one
 *  thing a naive implementation does by default.
 */
app.post("/api/group/deal", notesOff, express.json({ limit: "8kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const id = String(req.body?.group || "");
  if (!me || !/^[a-f0-9]{20}$/.test(id)) return res.status(400).json({ error: "no" });

  const out = await change((board) => {
    const g = board.groups.find((x) => x.id === id);
    if (!g || !g.members.includes(me)) return { error: "no" };
    const mine = board.people.find((q) => q.by === me);
    if (!mine) return { error: "no" };

    const raw = req.body?.deal || {};
    /* WHAT AN EDIT MUST NOT TAKE WITH IT.
     *
     * The ticks go, and that is the point — an edit that quietly kept an
     * agreement would be somebody agreeing to words they never read. But
     * everything else on this deal happened rather than being written: two
     * people said a payment was made and arrived, somebody set where the money
     * goes, somebody sent a reminder. Changing a date is not a reason for any
     * of that to stop having happened.
     *
     * The form sends only the fields it draws, so without this the first edit
     * to a deal turned a row both of them had signed off as PAID back into DUE
     * — and there is no way to put that back except by both of them saying it
     * again. Found by changing a fee on a deal whose deposit was settled. */
    const before = g.deal || {};
    const kept = {};
    for (const f of ["paid", "nudges", "payTo", "payToAt", "feePaid"]) {
      if (before[f] !== undefined) kept[f] = before[f];
    }
    const deal = store.cleanDeal({
      ...kept, ...raw, by: me, at: new Date().toISOString(), agreed: [],
    });
    if (!deal) return { error: "sides" };
    /* Both sides have to be people in this room. A memo naming somebody who
       cannot read it is a memo about a person who never agreed to anything. */
    const handles = new Set(board.people.filter((q) => g.members.includes(q.by))
      .map((q) => q.handle).filter(Boolean));
    if (!handles.has(deal.hires) || !handles.has(deal.provides)) return { error: "sides" };
    if (deal.hires === deal.provides) return { error: "sides" };

    g.deal = deal;
    Object.assign(g, store.cleanGroup(g));
    return { ok: true, tell: otherSide(board, g, mine.handle) };
  });
  if (out?.error) return res.status(400).json(out);
  res.json({ ok: true });
  /* The other side is told there is something to read, and nothing of what it
     says — the same rule every buzz on this board follows. */
  if (out?.tell) tellThem(out.tell).catch(() => {});
});

/** Agreeing to it. Append-only, once per person, and the row carries the time.
 *
 *  There is no un-agree. Somebody who changes their mind says so in the room,
 *  where the other side can read it — a tick that can be quietly removed is
 *  worth nothing to the person relying on it. */
app.post("/api/group/deal/agree", notesOff, express.json({ limit: "2kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const id = String(req.body?.group || "");
  if (!me || !/^[a-f0-9]{20}$/.test(id)) return res.status(400).json({ error: "no" });

  const out = await change((board) => {
    const g = board.groups.find((x) => x.id === id);
    if (!g || !g.deal || !g.members.includes(me)) return { error: "no" };
    const mine = board.people.find((q) => q.by === me);
    if (!mine?.handle) return { error: "profile" };
    /* Only the two named sides. Everybody else in the room can read it and
       nobody else can be recorded as having agreed to it, because a room can
       hold an introducer and an introducer is not a party. */
    if (mine.handle !== g.deal.hires && mine.handle !== g.deal.provides) return { error: "side" };
    if (g.deal.agreed.some((a) => a.who === mine.handle)) return { ok: true };
    /* THE FEE COMES FIRST, WHERE THERE IS ONE.
     *
     * Not a way of squeezing anybody: it is the only lever this board has.
     * Nothing here holds the money, so there is nothing to deduct from, and a
     * fee that is a polite request on a screen people can scroll past is not
     * a fee. Agreeing is the moment both of them want the record, which is
     * the moment the record is worth paying for.
     *
     * Off entirely unless the board names a page to pay a fee on, so a
     * deployment with no fee behaves exactly as it did. */
    const fee = store.feeOf(g.deal, DEAL_FEE_TO);
    if (fee && !(fee.paid || []).some((r) => r.kind === "confirmed")) return { error: "fee" };
    g.deal.agreed.push({ who: mine.handle, at: new Date().toISOString() });
    Object.assign(g, store.cleanGroup(g));
    return { ok: true, tell: otherSide(board, g, mine.handle) };
  });
  if (out?.error) return res.status(400).json(out);
  res.json({ ok: true });
  if (out?.tell) tellThem(out.tell).catch(() => {});
});

/** The other party to a deal, by device hash. The memo names handles; the
 *  buzz needs the person. */
function otherSide(board, g, meHandle) {
  const want = g.deal.hires === meHandle ? g.deal.provides : g.deal.hires;
  const q = board.people.find((x) => g.members.includes(x.by) && x.handle === want);
  return q ? q.by : "";
}

/** A ROOM FOR TWO, MADE FROM A CONVERSATION, so terms can be pinned over it.
 *
 *  The memo lives in a room, and a room could only be made with three people
 *  in it — so the two people who actually have something to agree about were
 *  the only two who could not pin anything. This makes the room they are
 *  already talking in: both of them, nobody else, opened from the thread.
 *
 *  THE SAME GATE AS WRITING TO THEM. If this board would not let them send a
 *  message, it does not let them open a room either; the list threadState
 *  already keeps is the only permission consulted.
 */
app.post("/api/note/terms", notesOff, express.json({ limit: "2kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const id = String(req.body?.id || "");
  if (!me || !/^[a-f0-9]{20}$/.test(id)) return res.status(400).json({ error: "no" });

  const out = await change((board) => {
    const mine = board.people.find((q) => q.by === me);
    const them = board.people.find((q) => q.id === id);
    /* SEPARATED OUT SO THE SCREEN CAN SAY WHICH. All three of these used to
       come back as "no", and the button caught "no", re-enabled itself and
       said nothing — so somebody without a finished profile pressed Pin the
       terms and watched it do nothing at all, with no way to find out why. */
    if (!mine?.handle) return { error: "profile" };
    if (!them || them.by === me) return { error: "no" };
    /* Can they write to each other? That is the whole question, and the answer
       is already computed for the thread they are standing in. */
    const st = threadState(board, me, them.by);
    if (!st || !(st.can || st.open)) return { error: "shut" };

    /* One room per pair, made once. A second "Agree terms" a week later opens
       the room they already have rather than a second one with the same two
       people and a different memo in it. */
    const had = board.groups.find((g) => !g.hand && g.members.length === 2
      && g.members.includes(me) && g.members.includes(them.by));
    if (had) return { ok: true, id: had.id, had: true };

    const g = store.cleanGroup({ id: store.newId(), by: me, members: [me, them.by], name: "" });
    if (!g) return { error: "no" };
    board.groups.push(g);
    return { ok: true, id: g.id };
  });
  if (out?.error) return res.status(400).json(out);
  res.json(out);
});

/** WHERE THE MONEY IS SENT, set only by the person being paid.
 *
 *  Their own PayPal, Wise, Payoneer or bank page. The board holds no money and
 *  this is the whole of its involvement: it stores a link its own party put
 *  there, and shows the other side where it came from and when it last changed.
 *  A quiet change of payment details is the shape of every invoice scam, so the
 *  time is kept and the card prints it.
 */
app.post("/api/group/deal/payto", notesOff, express.json({ limit: "2kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const id = String(req.body?.group || "");
  if (!me || !/^[a-f0-9]{20}$/.test(id)) return res.status(400).json({ error: "no" });

  const out = await change((board) => {
    const g = board.groups.find((x) => x.id === id);
    if (!g || !g.deal || !g.members.includes(me)) return { error: "no" };
    const mine = board.people.find((q) => q.by === me);
    if (!mine?.handle) return { error: "profile" };
    /* Only the side being paid. The payer setting this would be the payer
       choosing where their own money goes and calling it the other's. */
    if (mine.handle !== g.deal.provides) return { error: "side" };
    /* THE ROUTE, SET BY THE PERSON BEING PAID. Which way they are used to
       being paid — see PAY_WITH in store.js. It travels with the link rather
       than on its own route: they are one decision on one screen, and two
       routes for one decision is two things to keep in step. */
    if (req.body?.payWith !== undefined) {
      if (store.PAY_WITH.includes(req.body.payWith)) g.deal.payWith = req.body.payWith;
      else delete g.deal.payWith;
    }
    const link = store.cleanPayLink(req.body?.link);
    if (!link && req.body?.link) return { error: "link" };
    if (link) { g.deal.payTo = link; g.deal.payToAt = new Date().toISOString(); }
    else if (req.body?.link !== undefined) { delete g.deal.payTo; delete g.deal.payToAt; }
    Object.assign(g, store.cleanGroup(g));
    return { ok: true };
  });
  if (out?.error) return res.status(400).json(out);
  res.json(out);
});

/** "I paid this one" and "it arrived", one tap each, and never both from the
 *  same person.
 *
 *  THIS BOARD IS NOT TOLD BY A BANK. It cannot see PayPal, and pretending
 *  otherwise would be the most expensive lie on the screen — so a row reads
 *  "paid" only when the payer said they paid and the other side said it
 *  arrived, and the card says that in those words.
 *
 *  APPEND-ONLY, like agreeing. A denial does not erase the claim; it sits under
 *  it, which is what the two of them will need if it ever goes wrong.
 */
/* ---------------------------------------------------------------------------
 * BEING PAID THROUGH THE BOARD, WITHOUT THE BOARD TOUCHING THE MONEY
 *
 * One corridor, built properly: somebody in the mainland paying somebody
 * abroad, with WeChat or Alipay, in one pass that ends on the payee's own
 * Stripe account.
 *
 * DESTINATION CHARGES AND NOTHING ELSE. The payer's money goes to the payee's
 * connected account; the board's 2% is taken by Stripe as an application fee
 * on the way past. Nothing is ever paid to this platform and forwarded — that
 * is money transmission, and in China it is 二清, illegal outright under State
 * Council Order 768. See docs/cross-border-payments.md.
 *
 * WHO THIS CANNOT REACH, and it is deliberate rather than missing: a payee in
 * the mainland. Stripe does not support recipients there. They keep the
 * payee's-own-link flow, which is what this board did before any of this and
 * what the route card already tells them to use.
 *
 * OFF UNLESS BOARD_STRIPE_KEY IS SET.
 * ------------------------------------------------------------------------ */

/** Where a payer comes back to. Built from the request rather than a setting,
 *  because the board answers on two names and the right one to return to is
 *  whichever they left from. */
const backHere = (req, path) => {
  const proto = String(req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0];
  const host = String(req.get("host") || "").replace(/[^A-Za-z0-9.:-]/g, "").slice(0, 253);
  return proto + "://" + host + path;
};

/** A LINK SOMEBODY SENDS, WHICH IS A DIFFERENT THING FROM A LINK THEY COME
 *  BACK ON.
 *
 *  backHere uses the hostname the request arrived on, which is right for
 *  every return URL here: a payee finishing their payout setup, or a payer
 *  coming back from a checkout, should land where they started, with the
 *  cookies they already have.
 *
 *  A payment link is not that. It is written into a WeChat message and opened
 *  by a stranger who has no cookies and no history, and the name on it is the
 *  first thing they read while deciding whether to trust it. Sent from the
 *  app on the board's hostname it said thexchange.app — a private networking
 *  board's name, in front of somebody about to send ten thousand yuan, which
 *  is the exact problem Dealio's own domain was bought to fix.
 *
 *  So a shared link uses Dealio's name whenever there is one, whichever door
 *  the person asking happened to walk in through. Falls back to backHere when
 *  no Dealio domain is set, which is every deployment that has not got one. */
const payLink = (req, path) => {
  const d = String(process.env.BOARD_DEALIO_DOMAIN || "").trim().toLowerCase();
  if (!/^[a-z0-9.-]{3,253}$/.test(d)) return backHere(req, path);
  return "https://" + d + path;
};

/** SETTING UP PAYOUTS, which only the payee themselves can do.
 *
 *  Mints an Express account the first time and an onboarding link every time:
 *  the link is single-use and expires, so storing one would store a thing that
 *  stops working. Somebody who abandoned it halfway presses again and carries
 *  on where they were. */
app.post("/api/pay/onboard", notesOff, express.json({ limit: "1kb" }), async (req, res) => {
  if (!stripe.configured()) return res.status(400).json({ error: "off" });
  const me = hashDevice(String(req.body?.device || ""), SALT);
  if (!me) return res.status(400).json({ error: "no" });

  const board = await store.load(FILE);
  const mine = board.people.find((q) => q.by === me);
  if (!mine?.handle) return res.status(400).json({ error: "profile" });
  /* NO GUESS ABOUT WHERE THE MONEY LANDS. This used to refuse anybody whose
     `where` was "cn" — and `where` is which half of the world the person is
     in, for matching. It is not where their bank is, and it defaults to "cn"
     for everybody who never said.

     So it refused the one person who had to test it: Tom lives in the
     mainland and his account is Australian. "Not for a mainland account yet"
     to somebody whose money lands in Sydney is simply wrong, and it stopped
     him at the first screen.

     What cannot work is a mainland *bank account* as the destination. Stripe
     asks for the country and the bank itself, on its own pages, and refuses
     in its own words — a better refusal than ours, because it is about the
     thing that is actually disqualifying. */

  try {
    let acct = mine.payee;
    if (!acct) {
      const made = await stripe.makePayee({ email: mine.mail || "" });
      acct = String(made?.id || "");
      if (!acct) return res.status(502).json({ error: "stripe" });
      await change((b) => {
        const row = b.people.find((q) => q.id === mine.id);
        if (row) row.payee = acct;
        return { ok: true };
      });
    }
    /* WHERE STRIPE PUTS THEM DOWN AFTERWARDS, chosen by whoever sent them.
       Hard-coded to /groups, somebody who started this from Dealio came back
       to a different product and had to find their way home. An allowlist
       and not the raw value: this is handed to Stripe as a redirect, and a
       redirect somebody else can set is a redirect somebody else can aim. */
    const backTo = req.body?.back === "dealio" ? "/dealio" : "/groups";
    const link = await stripe.onboardLink({
      account: acct,
      refresh: backHere(req, backTo),
      done: backHere(req, backTo),
    });
    if (!link?.url) return res.status(502).json({ error: "stripe" });
    res.json({ ok: true, url: link.url });
  } catch (err) {
    /* The upstream message verbatim into the log and a plain word to the
       screen: Stripe's text names the field it disliked and is exactly what is
       needed here, and is exactly what should not be shown to a member. */
    console.error("pay/onboard:", err.message);
    /* THE PLATFORM ITSELF IS NOT ACTIVATED, said as itself.
     *
     *   Your account must be activated in order to create accounts.
     *
     * Nothing on this board can fix that — it is a form on Stripe about the
     * business — and it arrived on the screen as "That did not open — try
     * again", which invites the one thing that cannot work. It is also the
     * first thing anybody hits on a brand new live account, so it is the
     * failure this button is most likely to produce in its whole life.
     *
     * Matched on Stripe's wording because there is no code for it; a reword
     * falls back to the generic refusal, which is what we had. */
    if (/must be activated/i.test(err.message)) {
      return res.status(400).json({ error: "unactivated" });
    }
    /* REJECTED IS NOT THE SAME AS NOT-YET-ACTIVATED, and it arrived here as
       the generic refusal because only the first wording was matched:

         You cannot create new accounts because your account has been
         rejected.

       One is a form nobody has finished and the other is a decision somebody
       made. Told the first when it is the second, whoever reads it waits for
       something that is not coming. */
    if (/has been rejected/i.test(err.message)) {
      return res.status(400).json({ error: "rejected" });
    }
    res.status(502).json({ error: "stripe" });
  }
});

/** THE BUTTON ON THE DOOR — the standing code without the typing.
 *
 *  Everything the standing-code branch of /api/enter does, minus the code:
 *  the same one named person, the same rebind, the same refusal when this
 *  browser is already somebody else. Off unless BOARD_DOOR_IN is set — see
 *  the note over DOOR_IN for what it is worth to whoever finds it. */
app.post("/api/enter/in", express.json({ limit: "1kb" }), async (req, res) => {
  if (!DOOR_IN) return res.status(404).json({ error: "off" });
  const me = hashDevice(String(req.body?.device || ""), SALT);
  if (!me) return res.status(400).json({ error: "no device" });

  let why = "";
  const got = await change((board) => {
    const q = board.people.find(
      (p) => String(p.handle || "").toLowerCase() === BACK_WHO.toLowerCase());
    if (!q) { why = "nobody"; return null; }
    if (q.by === me) return { handle: q.handle || "" };
    if (board.people.some((p) => p.by === me)) { why = "taken"; return null; }
    store.rebind(board, q.by, me);
    return { handle: q.handle || "" };
  });
  if (why === "taken") return res.status(409).json({ error: "taken" });
  if (!got) return res.status(404).json({ error: "nobody" });
  setCookie(res, me);
  res.json({ ok: true, handle: got.handle });
});

/** THE SAME THING FROM THE BOX — see the note over /api/admin/back, which
 *  exists for the same reason and takes the same shape.
 *
 *  The route above needs the payee's own device hash, which lives in one
 *  browser's localStorage and which nobody at a terminal can type. So the
 *  operator's version takes a handle and looks the member up.
 *
 *  WHY AN OPERATOR NEEDS THIS AT ALL, given that setting up payouts is the
 *  one thing a payee is supposed to do themselves. `make go-live` clears
 *  every payout account on the board — it has to, because an account minted
 *  under a test key does not exist under a live one — and the person it
 *  clears first is the operator, who then has a request on screen saying it
 *  cannot be paid and a button three taps away on a page he has to find.
 *  That is a place on a screen where there should be a line to paste.
 *
 *  IT MINTS NOTHING SECRET. An Express account id the first time, which is
 *  Stripe's own identifier and useless to anybody who is not this platform,
 *  and a single-use onboarding link that expires. The bank details are typed
 *  on Stripe's pages and this board never sees them.
 *
 *  The link opens as whoever holds it, so it goes to the person it names and
 *  nowhere else. */
app.post("/api/admin/payout", admin, express.json({ limit: "1kb" }), async (req, res) => {
  if (!stripe.configured()) return res.status(400).json({ error: "off" });
  const who = String(req.body?.who || "").trim().toLowerCase();
  if (!who) return res.status(400).json({ error: "who" });

  /* WHERE STRIPE PUTS THEM DOWN AFTERWARDS. backHere reads the Host header,
     which inside the compose network is "board:8080" — a name no phone can
     resolve — so the caller hands in the public address the Makefile already
     reads out of .env for `make back`. Validated rather than trusted even
     behind the admin key: it is handed to Stripe as a redirect, and a
     redirect is worth checking wherever it came from. */
  const raw = String(req.body?.base || "").trim().replace(/\/+$/, "");
  if (!/^https:\/\/[A-Za-z0-9.-]{1,253}(:\d{1,5})?$/.test(raw)) {
    return res.status(400).json({ error: "base" });
  }
  const done = raw + "/dealio";

  const board = await store.load(FILE);
  const mine = board.people.find(
    (q) => String(q.handle || "").toLowerCase() === who);
  if (!mine?.handle) return res.status(404).json({ error: "nobody" });

  try {
    let acct = mine.payee;
    const made = !acct;
    if (!acct) {
      const got = await stripe.makePayee({ email: mine.mail || "" });
      acct = String(got?.id || "");
      if (!acct) return res.status(502).json({ error: "stripe" });
      await change((b) => {
        const row = b.people.find((q) => q.id === mine.id);
        if (row) row.payee = acct;
        return { ok: true };
      });
    }
    const link = await stripe.onboardLink({ account: acct, refresh: done, done });
    if (!link?.url) return res.status(502).json({ error: "stripe" });
    res.json({ ok: true, url: link.url, handle: mine.handle, made });
  } catch (err) {
    console.error("admin/payout:", err.message);
    /* The platform itself is not activated — said as itself, for the same
       reason as one route up. On a brand new live account this is the most
       likely thing to come back, and "stripe" tells nobody anything. */
    if (/must be activated/i.test(err.message)) {
      return res.status(400).json({ error: "unactivated", detail: err.message });
    }
    /* And the decision, said as itself — see the note one route up. */
    if (/has been rejected/i.test(err.message)) {
      return res.status(400).json({ error: "rejected", detail: err.message });
    }
    res.status(502).json({ error: "stripe", detail: err.message });
  }
});

/** THE CHARGE. Created per press, for one row of one plan, in the method the
 *  payer already chose on the card. */
/* ONE CHECKOUT, ASKED FOR FROM TWO PLACES.
 *
 * The room asks for it (/api/pay/start) and so does a memo link opened from
 * outside the door (/api/memo/pay). The two differ entirely in who is allowed
 * to ask — membership on one, a token and a code on the other — and not at
 * all in what is asked for. Keeping the money part in one function is the
 * point: the cut, the rounding and the destination are the three things that
 * must never quietly differ between two routes, and they did not stay the
 * same by anybody remembering.
 *
 * It does no authorisation of its own. Every caller has already decided the
 * asker may pay this row.
 */
async function startCheckout({ d, i, method, payeeAcct, ref, done }) {
  const row = d.plan[i];
  const amount = store.toMinor(row.amount, d.cur);
  if (!amount) return { error: "amount" };
  /* THE BOARD'S CUT, IN THE SAME UNIT AND ROUNDED DOWN. Up would take a cent
     more than two per cent, every time, from everybody — small, permanent and
     exactly the kind of thing that is noticed once and never forgiven. */
  const fee = Math.floor(amount * store.FEE_PCT / 100);
  try {
    const session = await stripe.checkout({
      amount, currency: d.cur, fee,
      destination: payeeAcct,
      method, ref, done,
      label: row.label || d.title || "Payment",
    });
    if (!session?.client_secret) return { error: "stripe" };
    return { secret: session.client_secret, pk: STRIPE_PK };
  } catch (err) {
    console.error("checkout:", err.message);
    /* THE PAYEE HAS NOT FINISHED, SAID AS ITSELF.
     *
     * Stripe refuses a destination whose transfers capability is not yet
     * active — requested at account creation is not the same as active, which
     * only happens once identity and bank have both been accepted. That is
     * one particular, fixable thing, and it arrived on the payer's screen as
     * "That did not open — try again" on all three methods: a sentence that
     * blames the payer for something only the payee can fix, and sends them
     * to press the same dead button twice more.
     *
     * Matched on Stripe's wording because the API gives no code for it. If
     * they reword it this falls back to the generic refusal, which is the
     * behaviour we had anyway — never worse than before. */
    if (/capabilit(y|ies)/i.test(err.message) && /destination/i.test(err.message)) {
      return { error: "notready", detail: err.message };
    }
    /* STRIPE'S OWN SENTENCE, CARRIED BUT NOT SHOWN. Every route that answers a
       member drops it and says one plain word; the admin route that exists to
       answer "why was this refused" returns it, because the whole point of
       that command is the sentence. It names the method or the account that
       was the problem, and without it "that did not open" is the only thing
       anybody has to go on — which is how WeChat Pay failing looked exactly
       like all three failing for a day. */
    return { error: "stripe", detail: err.message };
  }
}

app.post("/api/pay/start", notesOff, express.json({ limit: "2kb" }), async (req, res) => {
  if (!stripe.configured() && !PAY_DEMO) return res.status(400).json({ error: "off" });
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const id = String(req.body?.group || "");
  const i = Number(req.body?.i);
  const method = String(req.body?.method || "card");
  if (!me || !/^[a-f0-9]{20}$/.test(id) || !Number.isInteger(i) || i < 0) {
    return res.status(400).json({ error: "no" });
  }
  if (!["wechat", "alipay", "card"].includes(method)) return res.status(400).json({ error: "no" });

  const board = await store.load(FILE);
  const g = board.groups.find((x) => x.id === id);
  if (!g || !g.deal || !g.members.includes(me)) return res.status(400).json({ error: "no" });
  const d = g.deal;
  const mine = board.people.find((q) => q.by === me);
  if (!mine?.handle) return res.status(400).json({ error: "profile" });
  /* Only the payer starts a payment. Anybody else pressing this would be
     paying somebody else's bill, which is not a thing to make easy. */
  if (mine.handle !== d.hires) return res.status(400).json({ error: "side" });
  if (!Array.isArray(d.plan) || i >= d.plan.length) return res.status(400).json({ error: "row" });

  const row = d.plan[i];
  const amount = store.toMinor(row.amount, d.cur);
  if (!amount) return res.status(400).json({ error: "amount" });

  const payee = board.people.find((q) => g.members.includes(q.by) && q.handle === d.provides);
  if (!payee?.payee) return res.status(400).json({ error: "payee" });

  /* Everything above this line is the real thing — who is asking, which side
     of the deal they are on, whether the row exists and reads as money, who
     the payee is and whether they can be paid. Only the call to Stripe is
     skipped. */
  if (!stripe.configured()) return res.json({ ok: true, demo: true, method });

  const out = await startCheckout({
    d, i, method, payeeAcct: payee.payee,
    /* The room and the row, so the webhook knows what was paid. Both are
       already public to the two of them and mean nothing to anybody else. */
    ref: id + ":" + i,
    done: backHere(req, "/groups?g=" + id + "&paid={CHECKOUT_SESSION_ID}"),
  });
  if (out.error) return res.status(out.error === "amount" ? 400 : 502).json(out);
  /* THE PUBLISHABLE KEY GOES DOWN WITH THE SECRET, not baked into the page.
     It is public by design, but a page that carries it always is a page
     telling every reader this board takes money — including the readers on
     boards where it does not. It travels only to somebody who just pressed
     pay. */
  res.json({ ok: true, ...out });
});

/* ===========================================================================
 * THE DEAL MEMO, SENT OUT OF THE ROOM
 * ===========================================================================
 *
 * WHAT THIS IS FOR. The payer is in WeChat. They are not going to install an
 * app to settle a bill, and half the time they are not on this board at all.
 * So the memo goes to them: a link they open where they already are, the
 * terms on it, and Pay on the row that is due.
 *
 * WHY A LINK AND NOT A PICTURE. The first shape for this was the memo
 * screenshotted into the chat with Stripe's QR on it, because WeChat reads a
 * code out of a saved image on a long press. It does — but Stripe mints that
 * code for one payment and it expires, so a picture is payable for a while
 * and then it is a photograph of nothing. A link mints a fresh code when it
 * is opened, which is what makes the shelf life stop mattering.
 *
 * WHAT IT CANNOT DO, and this is the part worth defending. It cannot agree to
 * the terms, change them, or reply. Paying is a thing a person can do from a
 * link; a signature taken from a forwarded link outside the door is how a
 * deal gets disputed a year later. Those stay in the app.
 *
 * WHAT IT IS NOT ALLOWED TO SEE. memoView in lib/memo.js is an allowlist, not
 * the deal minus a few fields, so the room, the members, the device hashes,
 * the payee's account id and the sentences about who said what are all absent
 * rather than filtered.
 *
 * THE LIFT-OUT. lib/memo.js knows nothing about this board — see its header.
 * Everything board-shaped is in these four routes: finding the deal, deciding
 * who may mint, and resolving the payee. A standalone version replaces these
 * and keeps that file.
 * ------------------------------------------------------------------------ */

/** Find the deal a token belongs to. Linear over the groups, which is the
 *  same shape every other lookup in this file has and is nothing at this size.
 *  Returns the group too, because the webhook's ref is keyed on its id. */
function dealByToken(board, t) {
  if (!t) return null;
  for (const g of board.groups) {
    if (g?.deal?.share?.t === t) return { g, d: g.deal };
  }
  return null;
}

/** MINTING ONE, which either side of the deal may do.
 *
 *  Not just the payee: the person who wants the money is usually the one who
 *  sends the memo, but a producer who has agreed terms and wants them on
 *  record in the chat is the same act from the other end.
 *
 *  A second mint replaces the first. See the note over `share` in cleanDeal —
 *  two live links to one set of terms is two clocks nobody is watching.
 */
app.post("/api/group/deal/share", notesOff, express.json({ limit: "2kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const id = String(req.body?.group || "");
  if (!me || !/^[a-f0-9]{20}$/.test(id)) return res.status(400).json({ error: "no" });
  const off = Boolean(req.body?.off);

  const out = await change((board) => {
    const g = board.groups.find((x) => x.id === id);
    if (!g || !g.deal || !g.members.includes(me)) return { error: "no" };
    const d = g.deal;
    const mine = board.people.find((q) => q.by === me);
    if (!mine?.handle) return { error: "profile" };
    if (![d.hires, d.provides].includes(mine.handle)) return { error: "side" };

    if (off) {
      if (d.share) delete d.share;
      Object.assign(g, store.cleanGroup(g));
      return { ok: true, off: true };
    }
    /* Addressed to the other side by name, because that is who a memo is for
       and because the page greets them with it — the same reason the door says
       "Tom let you in" rather than "You have been invited". */
    const to = mine.handle === d.hires ? d.provides : d.hires;
    d.share = memo.newShare({ to });
    Object.assign(g, store.cleanGroup(g));
    return { ok: true, share: g.deal.share };
  });
  if (out?.error) return res.status(400).json(out);
  if (out?.off) return res.json({ ok: true, off: true });
  res.json({
    ok: true,
    url: backHere(req, "/d/" + out.share.t),
    code: out.share.code,
    until: out.share.until,
    to: out.share.to,
  });
});

/* The page itself, outside the door — see OPEN_PATHS. It carries no memo in
   its HTML: the token is in the address and the address is forwardable, so
   everything on it arrives after a code has been given. */
app.get("/d/:t", (req, res, next) => page("memo.html", req, res, next));

/* A STOREFRONT AND AN ORDER, both open and both meant to be pasted into a
   chat. /shop/<handle> is somebody's shop; /order/<id> is one order, and
   the id is the whole of its address — twenty hex, unguessable, the same
   rule as a payment request. */
/* WHOSE SHOP, SUBSTITUTED RATHER THAN READ OFF THE ADDRESS.
 *
 * THE SHOPFRONT HAS NEVER WORKED ON ITS OWN DOMAIN AND THIS IS WHY.
 * shop.html took its handle from location.pathname, which is right on
 * thexchange.app/shop/Tom and empty on aozhoubaba.com — because the shop's
 * Caddy block REWRITES / to /shop/<handle> rather than redirecting, on
 * purpose, so the buyer keeps the name she was given in the bar. A rewrite
 * is invisible to the browser: express sees /shop/Tom, the page sees "/",
 * and it fetched /api/shop/ and drew "这家店打不开了" on the front door of
 * the shop. The API was answering ok:true the whole time.
 *
 * So the server says who it is. It is the one that knows — it has the
 * matched route parameter — and it has to be in the HTML before any fetch
 * could ask, exactly like {{DEALIO}} above. */
const shopPage = (file) => (req, res, next) =>
  page(file, req, res, next, { "{{HANDLE}}": encodeURIComponent(String(req.params.handle || "")) });

app.get("/shop/:handle/checkout", shopPage("checkout.html"));
app.get("/shop/:handle", shopPage("shop.html"));
/* THE OTHER SIDE OF THE SAME SHOP. /shop/<handle> faces China and sells the
   person; /sell faces Australia and sells the route. Two pages because there
   are two people asking different questions, and one page trying to answer
   both would ask an Australian maker to scroll past 假一赔十 to find out how
   they get paid. */
/* HOW IT GOT HERE. The level below 店主的话 — a WeChat store on a phone, a
   shop in Beijing, the year it closed, and now this. Its own address so it
   can be sent on its own, which is what somebody does with a story. */
app.get("/shop/:handle/story", shopPage("story.html"));

app.get("/sell", (req, res, next) => page("sell.html", req, res, next));
app.get("/api/sell", async (req, res) => {
  const board = await store.load(FILE);
  /* Whose shop the numbers are. The same handle the shop hostname's root
     shows — one shop, counted once, so the two pages can never disagree
     about how many parcels went out. */
  const handle = String(process.env.BOARD_SHOP_HANDLE || "").trim();
  const mine = board.orders.filter((o) => (!handle || o.shop === handle) && !o.off);
  const ids = new Set(mine.map((o) => o.id));
  const revs = board.reviews.filter((r) => ids.has(r.order) || r.src);
  const first = mine.map((o) => o.at).sort()[0] || "";
  res.set("Cache-Control", "no-cache");
  res.json({
    ok: true,
    shop: handle || (board.people.find((p) => p.shop?.name)?.handle || ""),
    proof: { sent: mine.filter((o) => o.got).length, reviews: revs.length,
      since: first.slice(0, 7) },
  });
});
app.get("/order/:id", (req, res, next) => page("order.html", req, res, next));

/* ===========================================================================
 * A PAYMENT REQUEST
 * ===========================================================================
 *
 * "Two people are chatting, then someone sends them a request to pay." That
 * is the whole product in Tom's own sentence, and these four routes are it.
 *
 * WHAT IS DIFFERENT FROM THE DEAL MEMO, which lives above this:
 *
 *   NO ROOM IS MADE. A request belongs to nothing. The memo hangs off a
 *   group, so writing terms made a two-person room and you ended up with a
 *   second place to talk to somebody you already talk to — and, worse, one
 *   memo per pair, so a second job with the same person overwrote the first.
 *   Three requests to one person are three rows.
 *
 *   NO CODE. The memo's link carries the full terms of a deal and is worth a
 *   code beside it. A request carries a name, an amount and one line. A code
 *   standing between a person and paying you costs money.
 *
 *   NO AGREEING. Sending it is the offer and paying it is the acceptance.
 *
 * THE LIFT-OUT. lib/request.js imports nothing from this board. Everything
 * board-shaped is here: who is asking, and which Stripe account the money
 * lands in. A standalone version replaces these four and keeps that file.
 * ------------------------------------------------------------------------ */

/** MAKING ONE.
 *
 *  Anybody on the board with a finished profile. Not gated on having set up
 *  payouts: you can write the request before you have said where the money
 *  goes, and the page the other person opens says plainly that it cannot be
 *  paid yet. A wall in front of the first screen loses people who would have
 *  finished; a sentence at the moment it matters does not.
 */
app.post("/api/request", notesOff, express.json({ limit: "2kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  if (!me) return res.status(400).json({ error: "no" });
  const amount = String(req.body?.amount || "").trim();
  if (!amount) return res.status(400).json({ error: "amount" });

  const out = await change((board) => {
    const mine = board.people.find((q) => q.by === me);
    /* The name on it is theirs, so there has to be one. Split from "no" so
       the screen can say which — see the note over /api/note/terms. */
    if (!mine?.handle) return { error: "profile" };
    /* THE PERSON PAYING, WHEN THEY ARE ON THE BOARD. Optional: most of the
       time they are not, which is the point of the thing. */
    const toWho = String(req.body?.toWho || "");
    const them = board.people.find((q) => q.id === toWho);
    const q = request.cleanRequest({
      id: request.newRequestId(),
      by: me,
      from: mine.handle,
      to: String(req.body?.to || them?.handle || ""),
      toWho: them ? them.id : "",
      /* "in" asks them to pay; "out" offers to pay them. The same row and
         the same link — see the note over `way` in lib/request.js. */
      way: String(req.body?.way || "in"),
      amount,
      cur: String(req.body?.cur || ""),
      what: String(req.body?.what || ""),
      when: String(req.body?.when || ""),
      at: new Date().toISOString(),
    });
    if (!q) return { error: "bad" };
    board.requests.push(q);
    return { ok: true, id: q.id };
  });
  if (out?.error) return res.status(400).json(out);
  res.json({ ok: true, id: out.id, url: payLink(req, "/pay/" + out.id) });
});

/** SAYING IT INSTEAD OF TYPING IT.
 *
 *  Audio in, a guess and a sentence back. NOTHING IS CREATED HERE — that is
 *  the whole safety of the feature and it is worth saying twice. A model
 *  pulling money terms out of speech will be wrong eventually and it is
 *  money, so this returns what it heard and the plain sentence describing
 *  it, and the screen makes the person who spoke confirm their own words
 *  before anything exists.
 *
 *  Two keys and two bills: transcription on one, reading on the other. Both
 *  are capped in their own module and both are off unless configured, so the
 *  page asks before it draws a microphone.
 */
app.post("/api/request/hear", notesOff,
  express.raw({ type: ["audio/*", "application/octet-stream"], limit: "2mb" }),
  async (req, res) => {
    const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
    if (!me) return res.status(400).json({ error: "no" });
    if (!hear.configured() || !terms.configured()) {
      return res.status(503).json({ error: "off" });
    }
    const board = await store.load(FILE);
    const mine = board.people.find((q) => q.by === me);
    if (!mine?.handle) return res.status(400).json({ error: "profile" });

    const heard = await hear.hear(req.body, req.get("content-type") || "",
      String(req.query.lang || ""), me);
    if (heard.error) return res.status(400).json({ error: heard.error });

    const out = await terms.read(heard.text);
    if (out.error) return res.status(502).json({ error: out.error });
    res.json({ ok: true, said: heard.text, terms: out.terms });
  });

/* The page, outside the door — see OPEN_PATHS. It carries no request in its
   HTML: the id is the address, and everything on the page arrives by fetch.

   /pay/ AND NOT /q/. The first draft used /q/, which has belonged to the
   waiting-room person page since long before this — so express matched that
   one, every request link served the door, and curl said 200 the whole time
   because 200 is what a wrong page is. /pay/ is also the better word: it is
   read by somebody in a chat deciding whether to tap. */
/* THE SAME PAGE, AS SOMETHING A PHONE CAN SCAN.
 *
 * WHY THIS EXISTS AND WHAT IT IS NOT. The code a payer long-presses inside
 * their wallet is the provider's — weixin://wxpay/bizpayurl?pr=… — and it
 * needs an acquirer behind it. This is not that, and it does not pretend to
 * be: it encodes this request's ordinary https address, so scanning it opens
 * the Dealio checkout in WeChat's browser exactly as tapping the link would.
 * No acquirer, no keys, no account. It works on a board that cannot take a
 * payment at all, because getting the payer to the page and taking their
 * money are two different problems and only the second one is blocked.
 *
 * WHAT IT BUYS. Until now the only way to reach a request was a link pasted
 * into a chat. A link cannot be held up at a desk, printed on an invoice,
 * put at the end of a deck or shown across a table. A code can.
 *
 * A PNG AND NOT A GRID OF DIVS, for the reason written at the top of
 * lib/qr.js: WeChat's long-press reads a QR out of an <img> and out of
 * nothing else. Served as a real image file rather than a data URI so it can
 * be saved, forwarded, and dropped into anything that takes a picture.
 *
 * NO AUTH, DELIBERATELY, and it adds no exposure: the id is already the
 * whole secret — anybody holding it can open /pay/<id> and see the same
 * thing. A 404 for an unknown or switched-off request, because a code that
 * scans to a dead page is worse than no code. */
/* ONE ADDRESS THAT IS ALWAYS A LIVE DEMO.
 *
 * Minting a request before each showing is a step, and a step done in front
 * of somebody is a step they watch you do — which is the opposite of the
 * thing being demonstrated. So this is a fixed address: every visit makes a
 * fresh request and lands on it, unpaid, ready.
 *
 * FRESH PER VISITOR, NOT A SHARED ROW. Two people opening it at once each
 * get their own, so one of them paying does not turn the other's screen
 * green mid-sentence — which is exactly what a single standing request would
 * do at the worst moment. It also means the link never needs resetting: a
 * paid one is simply never seen again.
 *
 * The defaults are overridable, so a demo can be in the money and the words
 * that suit the room: /demo?amount=A$100&for=Second%20draft
 *
 * OFF WITH THE REST OF IT. No BOARD_DEALIO_DEMO, no route — it falls through
 * to whatever else claims the path, which today is a 404. */
const DEMO_SEEN = [];

/* THE DEMO OPENS ON THE ASKING SIDE, WHICH IS THE SIDE WE SELL TO.
   It used to mint a request and drop the visitor straight onto the payer's
   page — which shows the wrong half. Whoever is being shown this is a sole
   trader, or somebody deciding whether sole traders would use it, and what
   they need to see is: type an amount, get a link, send it. The payer's
   screen is what happens next, and it is one tap away from here. */
app.get("/demo", (req, res, next) => {
  if (!DEALIO_DEMO || !DEALIO_OWNER) return next();
  res.set("Cache-Control", "no-store");
  return page("demo-ask.html", req, res, next);
});

/* WHAT THE PAD POSTS TO. Mints under the demo owner server-side, so nothing
   about anybody's identity is handed to a browser — the alternative was
   giving every visitor a device string that acts as a real member, which is
   not a demo, it is an account.
   Swept at twenty, same as before: a page shown a hundred times must not
   leave a hundred rows behind it. */
app.post("/api/demo/ask", express.json({ limit: "1kb" }), async (req, res) => {
  if (!DEALIO_DEMO || !DEALIO_OWNER) return res.status(404).json({ error: "off" });
  const amount = String(req.body?.amount || "").trim().slice(0, 24);
  const what = String(req.body?.what || "").trim().slice(0, 60);
  if (!amount) return res.status(400).json({ error: "amount" });
  const out = await change((board) => {
    const mine = board.people.find((q) => String(q.handle || "").trim().toLowerCase() === DEALIO_OWNER);
    if (!mine) return { error: "owner" };
    const q = request.cleanRequest({
      id: request.newRequestId(), by: mine.by, from: mine.handle, to: "",
      amount, cur: "", what, when: "", at: new Date().toISOString(),
    });
    if (!q) return { error: "bad" };
    q.demo = true;
    board.requests.push(q);
    DEMO_SEEN.push(q.id);
    while (DEMO_SEEN.length > 20) {
      const old = DEMO_SEEN.shift();
      const at = board.requests.findIndex((x) => x.id === old);
      if (at >= 0) board.requests.splice(at, 1);
    }
    return { ok: true, id: q.id, from: mine.handle };
  });
  if (out?.error) return res.status(400).json(out);
  const url = payLink(req, "/pay/" + out.id);
  res.json({ ok: true, id: out.id, from: out.from, url, png: await qrPng(url) });
});

/* AND THE SAME ADDRESS AS A CODE, which is the one to print or put in a
   deck: it never expires, because it points at the route above rather than
   at any one request. */
app.get("/demo.png", async (req, res, next) => {
  if (!DEALIO_DEMO) return next();
  const png = await qrPng(payLink(req, "/demo"));
  res.set("Cache-Control", "public, max-age=3600");
  res.type("png").send(Buffer.from(String(png).split(",").pop(), "base64"));
});

/* THE MOCK WALLET, WHICH IS WHERE OUR OWN CODE GOES.
   A page that looks like paying, because the point is to show somebody the
   shape of it — the amount, who is being paid, one button. It says DEMO on
   it in both languages and it says so where the payer looks, not in a
   footnote. Off unless BOARD_DEALIO_DEMO=1. */
app.get("/pay/:id/wallet", (req, res, next) => {
  if (!DEALIO_DEMO) return next();
  return page("wallet-demo.html", req, res, next);
});

/* AND THE BUTTON ON IT. Marks the request paid the same way settleIfPaid
   does, so the asker's list and the payer's own page both turn green from
   the ordinary /check poll with nothing knowing this was not a provider.
   GUARDED THREE WAYS: the demo has to be on, the row has to have been sent
   down the demo rail (pay.ref starts "demo:"), and an already-paid row is
   left alone — a link scrolled back to must not settle twice. */
app.post("/api/request/:id/wallet-paid", express.json({ limit: "1kb" }), async (req, res) => {
  if (!DEALIO_DEMO) return res.status(404).json({ error: "off" });
  const id = request.cleanId(req.params.id);
  if (!id) return res.status(404).json({ error: "gone" });
  const out = await change((b) => {
    const row = b.requests.find((x) => x.id === id);
    if (!row || row.off) return { error: "gone" };
    if (!String(row?.pay?.ref || "").startsWith("demo:")) return { error: "no" };
    if (request.requestState(row) === "paid") return { ok: true, state: "paid" };
    row.said = Array.isArray(row.said) ? row.said : [];
    const at = new Date().toISOString();
    /* The same two halves settleIfPaid writes, and `auto` for the same
       reason: nobody typed a handle, so nobody is credited with saying
       anything they did not say. */
    if (!row.said.some((x) => x.kind === "claimed")) row.said.push({ kind: "claimed", at, auto: true });
    if (!row.said.some((x) => x.kind === "confirmed")) row.said.push({ kind: "confirmed", at, auto: true });
    return { ok: true, state: "paid" };
  });
  if (out?.error) return res.status(400).json(out);
  res.json({ ok: true, state: "paid" });
});

app.get("/pay/:file", async (req, res, next) => {
  const m = /^([A-Za-z0-9]{1,64})\.png$/.exec(String(req.params.file || ""));
  if (!m) return next();
  const id = request.cleanId(m[1]);
  if (!id) return res.status(404).end();
  const board = await store.load(FILE);
  const q = board.requests.find((x) => x.id === id);
  if (!q || q.off) return res.status(404).end();
  const png = await qrPng(payLink(req, "/pay/" + id));
  const body = Buffer.from(String(png).split(",").pop(), "base64");
  /* A code for a request that has not changed is the same code forever, so
     it is worth caching — but not for long: a request can be switched off,
     and a scannable code for a dead row should stop working within a day
     rather than whenever a phone decides to look again. */
  res.set("Cache-Control", "public, max-age=3600");
  res.type("png").send(body);
});

app.get("/pay/:id", (req, res, next) => page("request.html", req, res, next));

/* DEALIO — the asking half, on its own page.
 *
 * OUTSIDE THE BOARD'S DOOR, and the reasoning is worth writing down because
 * it looks like a hole and is not one.
 *
 * It was behind it, and that was wrong in two ways. Practically: Tom could
 * not open it on the phone he was testing with, because that browser had
 * never been let through the board's door, and the answer "go and sign in to
 * the other product first" is not a thing to say to somebody testing this
 * one. Structurally: the door belongs to The Exchange, and this page is step
 * one of leaving. A page that only works behind another product's password
 * is a page that cannot be lifted out.
 *
 * WHAT ACTUALLY GATES IT is on the route, where it belongs: making a request
 * needs a person row with a handle on it, and only a member has one. A
 * stranger who finds this address gets an empty list and a button that
 * refuses — which is the correct amount of nothing.
 *
 * WHAT IS NOT OPENED: the board. Its own door is untouched, and every route
 * that reads people, rooms or messages is still behind it.
 *
 * The paying half at /pay/ is outside the door and always will be: the whole
 * design is that the person paying needs nothing at all. */
/* THE MONEY SCREENS ARE NOT IN THE APP, and this is the whole of how.
 *
 * 22 Sep 2026. The App Store rejected build 1 and asked five questions about
 * the payments product — who the merchants are, who takes the money, what is
 * being sold. All five are questions about Dealio, which is a separate
 * product that happens to be reachable from the board because the same people
 * use both. The board is a place to meet people; that is one purpose and it
 * is what the listing describes. Answering five payment-facilitator questions
 * to keep a tab the app did not need is the wrong trade.
 *
 * SO IT IS OFF FOR EVERY APP USER, not hidden from reviewers. That distinction
 * is the only thing here worth being careful about: a feature turned off for
 * everybody on a platform is a product decision Apple has no view on, and a
 * feature hidden from reviewers alone is guideline 2.3.1 and the account.
 * Nothing in here looks at who is asking — only at what is asking.
 *
 * WHY A REDIRECT AND NOT A 404. Somebody in the app may have a /dealio link
 * from a message, and a dead end is a worse answer than the board. The web is
 * untouched: same URL, same page, on a phone browser or a desktop.
 *
 * The three entry points that used to point here — the Money tab in
 * index.html and notes.html, and the sibling-product panel on the landing
 * page — read {{INAPP}} and are not drawn. This route is the floor under
 * them, for a link that arrives some other way. */
const webOnly = (req, res, next) =>
  inApp(req) ? res.redirect(302, "/board") : next();

/* CHINA BUSINESS SOLUTIONS — the merchant's way in, and its own set.
 *
 * Six pages and one stylesheet, outside the board's door on purpose: somebody
 * deciding whether they can take money from China is not a member of anything
 * yet, and a door in front of the pitch is a door in front of the decision.
 *
 * ITS OWN FILES RATHER THAN A BRANCH OF THE BOARD. The flow was drawn on a
 * canvas first and is meant to move — into the Exchange, onto its own domain,
 * or into whatever this turns out to be. Nothing in cbs*.html imports from
 * index.html, i18n.js or the store, so lifting it is copying seven files.
 *
 * NOT web-only. /dealio is off in the app because the App Store asked what the
 * payments business is; these are the pages that ANSWER that question, and a
 * merchant reading them is not a member being sold a wallet. They stay.
 */
/* MOUNTED AS A FOLDER, NOT WIRED IN AS SIX ROUTES.
 *
 * The first version of this was six app.get lines naming six files in
 * board/public, which is the shape of thing that quietly becomes part of the
 * board: a shared stylesheet here, a string from i18n.js there, and a year
 * later it cannot be lifted out. So it lives in ../china/public, every link
 * inside it is relative, and this server's only knowledge of it is the line
 * below. Adding a screen to it needs no change here at all.
 *
 * Serving it from somewhere else — its own container, a static host, an S3
 * bucket — is copying that folder. Nothing in it imports from the board, and
 * the one host name it prints is an attribute on <body>.
 *
 * WHY IT SITS UNDER board/ AND NOT AT THE ROOT. It was ../china/public for an
 * hour and the deployed page was blank: the board's image is built with
 * `context: ./board`, so anything above that directory is not in the build at
 * all and the path resolved to nothing inside the container. A folder that
 * only works on the machine it was written on is not portable, it is
 * untested. So it lives where the image can see it, and moving it out later
 * is a git mv and this one line.
 *
 * `extensions` so /china/connect works as well as /china/connect.html: the
 * short form is what goes in a message to somebody.
 *
 * AND NO-CACHE, WHICH page() HAS DONE SINCE THE BOARD HAD A PHONE ON IT.
 * express.static sends its own ETag and Last-Modified and nothing else, so a
 * phone that had loaded a screen once kept serving it: a deploy went out, the
 * button on the box changed, and the device in the hand still had the old
 * file. That reads as "nothing happens when I press it", which is the hardest
 * kind of bug to be told about because the person reporting it is looking at
 * something that no longer exists.
 *
 * Same rule as the board's own pages, for the same reason written there:
 * WeChat on iOS caches hard against the URL, and a screen must never be a day
 * old. ETag still does the work — a page that has not changed comes back 304
 * and costs one round trip, not a download. */
app.use("/china", express.static("china", {
  extensions: ["html"],
  setHeaders: (res) => res.set("Cache-Control", "no-cache"),
}));

/* THE CONNECT BUTTON, FOR REAL.
 *
 * Stripe Connect and not a pasted key, for the reason written on the screen
 * itself: collecting somebody's API key is the pattern Stripe steers
 * platforms away from, and it is the MERCHANT's account that gets flagged
 * for it. Here they press a button, finish on Stripe's own pages, and come
 * back. This board never sees a bank number.
 *
 * WHERE STRIPE PUTS THEM DOWN AFTERWARDS is the whole reason the "stopped"
 * screen exists. An account link takes two URLs and only two:
 *
 *   return_url   they finished, or think they did  ->  /china/switch
 *   refresh_url  the link expired or they backed out  ->  /china/stopped
 *
 * So "they closed Stripe halfway" is not a state invented for the mockup; it
 * is the one Stripe actually sends people to, and before this it was a page
 * nothing pointed at.
 *
 * NOT AIRWALLEX, and the fork says "Stripe or Airwallex" out loud. Airwallex
 * terminated the account on 21 Sep and the box is blocked at their edge — a
 * POST from here with no credentials at all comes back with the same HTML
 * 403, so no pair of keys will ever get through. See NOW.md. A second button
 * wired to them would be a button that fails on every press, which is worse
 * than one that is not there yet.
 */
const CHINA = openChina(DIR);
const CHINA_COOKIE = "china";

app.post("/china/api/connect", express.json(), async (req, res) => {
  if (!stripe.configured()) return res.status(503).json({ error: "off" });
  /* An address, because an account with no owner is an account nobody can be
     told anything about. Stripe wants it too and asks again on its own page —
     this one is so the row here means something. */
  const email = String(req.body?.email || "").trim().slice(0, 120);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "email" });
  try {
    const made = await stripe.makePayee({ country: "au", email });
    const account = String(made?.id || "");
    if (!account) return res.status(502).json({ error: "stripe" });
    const token = await CHINA.remember({ account, email });
    /* Host-only and SameSite=Lax: this cookie is read by one folder on one
       name, and it is not a session — losing it costs a merchant the status
       page, not the account. */
    res.cookie(CHINA_COOKIE, token, {
      httpOnly: true, sameSite: "Lax", secure: true, maxAge: 180 * 24 * 3600 * 1000, path: "/china",
    });
    const origin = backHere(req, "");
    const link = await stripe.onboardLink({
      account,
      refresh: origin + "/china/stopped",
      done: origin + "/china/switch",
    });
    if (!link?.url) return res.status(502).json({ error: "stripe" });
    res.json({ ok: true, url: link.url });
  } catch (err) {
    /* Stripe's own sentence into the log, one plain word to the screen. Its
       text names the field it disliked and is exactly what is needed here,
       and exactly what should not be shown to somebody signing up. */
    console.error("china connect:", err.message);
    res.status(502).json({ error: /not.*activat|platform/i.test(err.message) ? "unactivated" : "stripe" });
  }
});

/** Where this merchant has got to, for the Check again button. */
app.get("/china/api/state", async (req, res) => {
  res.set("Cache-Control", "no-store");
  /* Read off the header rather than through cookie-parser: this box does not
     use it, and one regexp is a smaller thing than a dependency. */
  const m = new RegExp("(?:^|;\\s*)" + CHINA_COOKIE + "=([0-9a-f]{32})")
    .exec(String(req.headers.cookie || ""));
  const row = await CHINA.find(m && m[1]);
  if (!row) return res.json({ started: false, ready: false });
  if (!stripe.configured()) return res.json({ started: true, ready: false });
  let ready = false;
  try { ready = await stripe.payeeReady(row.account); }
  catch (err) { console.error("china state:", err.message); }
  res.json({ started: true, ready, email: row.email });
});

app.get(["/dealio", "/dealio/"], webOnly, notesOff,
  (req, res, next) => page("dealio.html", req, res, next));

/** THE PUBLIC PAGE ABOUT THE PAYMENTS PRODUCT, and the one page about it that
 *  is not behind a door.
 *
 *  It sat in site/ for an hour, which serves nothing: TOMSCODING_SITE_DOMAIN
 *  is deliberately empty on this box (see app/README.md) because both names
 *  serve the board, so a file there is a file nobody can open. On the board,
 *  at an address somebody can be given.
 *
 *  /dealio/about and not /pay.html: /pay/<id> is where a payer lands and the
 *  two should not look like halves of the same thing. This one is read by a
 *  payment provider assessing an application, by a customer deciding whether
 *  to trust a link, and by anybody who asks what this is. */
app.get(["/dealio/about", "/dealio/about/"], webOnly, notesOff,
  (req, res, next) => page("pay.html", req, res, next));

/** Dealio's own terms. The board's /terms are the board's — a networking
 *  board's house rules in front of somebody about to send money would be the
 *  wrong document in the one place it matters. */
app.get(["/dealio/terms", "/dealio/terms/"], webOnly, notesOff,
  (req, res, next) => page("dealio-terms.html", req, res, next));

/** THE WALKTHROUGH, for the one thing nobody outside could do: watch it work.
 *  The app is behind a sign-in and the payer's page needs a real request to
 *  exist, so a stranger could read every word about this product and never
 *  see it move. Four screens, no account, nothing created. */
app.get(["/dealio/try", "/dealio/try/"], webOnly, notesOff,
  (req, res, next) => page("try.html", req, res, next));

/** A REAL WECHAT CODE ON THE WALKTHROUGH, when there is a provider to ask.
 *
 *  Screen three draws an invented code by default, and says so. With
 *  Airwallex configured it asks for a real one instead: a payment intent in
 *  yuan, confirmed in qrcode flow, and what comes back is a string this
 *  server turns into a grid of bits for the page to draw. Nothing is fetched
 *  by the phone and no image is served — same bits, same divs, real content.
 *
 *  ONE CODE AT A TIME, CACHED FOR LESS TIME THAN THE CODE LASTS. This is a
 *  public page and an intent is a real object at Airwallex even in sandbox,
 *  so a visitor should not mint one per reload; the last one is kept and
 *  everybody gets it, which is also true to life — a code on a page is a
 *  code, not a code per reader.
 *
 *  It was held for ten minutes, and the code does not live that long: the
 *  sandbox checkout that opens from it counts down from about eight. So for
 *  the last couple of minutes of every window the page would have shown a
 *  dead code under a line promising a real one, which is worse than showing
 *  the drawn one. Four minutes, comfortably inside whatever the real expiry
 *  turns out to be.
 *
 *  It answers 404 when there is no provider, and the page keeps its drawn
 *  one. A walkthrough that claims a live code it does not have would be the
 *  one dishonest screen in the whole product. */
const tryQr = { at: 0, body: null };
app.get("/api/dealio/try/qr", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const p = WALLET.on ? WALLET.provider : null;
  if (!p || typeof p.wechatQr !== "function") return res.status(404).json({ error: "no provider" });
  if (tryQr.body && Date.now() - tryQr.at < 4 * 60_000) return res.json(tryQr.body);
  try {
    const r = await p.wechatQr({ amount: "240000", currency: "CNY", reference: "12 lessons" });
    if (!r.qr) return res.status(502).json({ error: "no code" });
    const { size, bits } = qrBits(r.qr);
    tryQr.body = { live: true, size, bits, png: await qrPng(r.qr) };
    tryQr.at = Date.now();
    res.json(tryQr.body);
  } catch (err) {
    console.error("try qr", err.message);
    res.status(502).json({ error: "upstream" });
  }
});

/** READING ONE. No code, no device, no membership — the link is the whole of
 *  it. What comes back is requestView, which is an allowlist. */
app.get("/api/request/:id", async (req, res) => {
  const id = request.cleanId(req.params.id);
  res.set("Cache-Control", "no-store");
  if (!id) return res.status(404).json({ error: "gone" });
  const board = await store.load(FILE);
  const q = board.requests.find((x) => x.id === id);
  if (!q || q.off) return res.status(404).json({ error: "gone" });
  const asker = board.people.find((p) => p.by === q.by);
  /* WHOSE ACCOUNT THE MONEY LANDS IN DEPENDS ON WHICH WAY IT IS GOING.
     Asking: the person who made the row, and their account is on their
     member row. Sending: the person reading this page, who is usually not on
     this board at all, so the account is minted against the request. */
  /* WHAT CAN ACTUALLY TAKE THIS MONEY, WHICH IS TWO QUESTIONS NOW.
   *
   * A code needs nowhere for the money to land — it lands in the one account
   * the keys belong to — and that was the whole of why this page offered no
   * way to pay at all on the box with Airwallex: `ready` asked about a Stripe
   * payout account, there was none, and the payer was told the person had not
   * finished setting up payments, under a perfectly good amount.
   *
   * And the two rails are not the same three buttons. Tom's box has live
   * Stripe keys and nobody with a payout account, so Card was drawn and could
   * only ever be refused. Each rail contributes the methods it can really
   * take; nothing else is offered. */
  const qrWays = dealioWays(board, q);
  const stripeOk = stripe.configured() && ((q.way || "in") === "out"
    ? Boolean(q.acct && q.landed)
    : Boolean(asker?.payee));
  /* The stand-in, which draws all three because none of them is real. */
  const ways = (!qrWays.length && !stripeOk && PAY_DEMO)
    ? ["wechat", "alipay", "card"]
    : [...new Set([...qrWays, ...(stripeOk ? ["wechat", "alipay", "card"] : [])])];
  const ready = ways.length > 0;

  /* AND WHY NOT, WHEN THERE IS NOTHING. "{who} has not said where the money
     should land" is one reason out of two, and it was being printed for the
     other one: a request in Australian dollars on a box whose only rails are
     the yuan codes. True of the Stripe path, false here, and it sends the
     asker to go and set up a payout account that would not have helped.
     Only the two reasons the reader can do something about. */
  const why = ready ? ""
    : (dealioQr() && dealioOwns(board, q) && (q.way || "in") === "in"
       && q.cur && q.cur !== "cny" && !CNY_PAIRS.has(q.cur))
      ? "cny" : "";
  /* WHICH SIDE OF THE LINK IS READING IT.
   *
   * The page could not tell, and on a request going out that is the whole
   * question. The receiver says where the money should land, comes back from
   * Stripe onto this same address, and was handed a PAY button for the money
   * they are owed — under a line reading "the money goes straight to your
   * account". Both true of somebody, neither true of them.
   *
   * The sender is the one browser that can prove who it is: the device that
   * made the row. The receiver has no account here and never gets one, so
   * "not the sender" is the only thing that can be known about them, and it
   * is enough — every screen on this page is written for one of those two. */
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
  res.json({
    ok: true,
    yours: Boolean(me && me === q.by),
    /* WHICH WALLETS TO DRAW, so the sheet never offers one that cannot work.
       A refused button is worse than no button: it is read as the whole page
       being broken, and the payer presses the other two to find out. */
    ways,
    why,
    request: request.requestView(q, { payeeReady: ready }),
  });
});

/** SAYING WHERE THE MONEY SHOULD LAND, by somebody who is not on this board.
 *
 *  The other half of sending money. Somebody opens a link that says Tom wants
 *  to pay them ¥2,400 and presses one button; an account is minted for them
 *  and Stripe takes the bank and the identity on its own pages.
 *
 *  NO ACCOUNT HERE AND NONE WANTED. They never become a member, never get a
 *  password and never see this board. The only thing stored about them is
 *  Stripe's own identifier for the account, on the request, which is useless
 *  to anybody who is not this platform.
 *
 *  MINTED ONCE AND REUSED. Somebody who abandons Stripe halfway and comes
 *  back gets the same account and carries on where they were, rather than a
 *  second one with half their details in it.
 */
/* THE SEND HALF NEEDS STRIPE CONNECT, AND FINDS OUT ON A STRANGER'S PHONE.
 *
 * Accepting money that is being sent to you means minting an account for
 * somebody who is not a member and handing them to Stripe's own onboarding.
 * On a box whose live keys have no Connect that fails at the moment a
 * stranger presses the button, and the screen said "That did not work — try
 * again", which is an invitation to press it twice more.
 *
 * Nothing here can test Connect without creating an account, so it is
 * remembered instead: the first failure switches the offer off for the rest
 * of this process, and a restart tries again. The app stops offering a
 * button whose only outcome is that sentence. */
let sendBroken = "";

app.post("/api/request/:id/land", express.json({ limit: "1kb" }), async (req, res) => {
  if (!stripe.configured()) return res.status(400).json({ error: "off" });
  const id = request.cleanId(req.params.id);
  if (!id) return res.status(404).json({ error: "gone" });

  const board = await store.load(FILE);
  const q = board.requests.find((x) => x.id === id);
  if (!q || q.off) return res.status(404).json({ error: "gone" });
  if ((q.way || "in") !== "out") return res.status(400).json({ error: "no" });

  try {
    let acct = q.acct;
    if (!acct) {
      const made = await stripe.makePayee({ email: "" });
      acct = String(made?.id || "");
      if (!acct) { sendBroken = "no account"; return res.status(502).json({ error: "connect" }); }
      await change((b) => {
        const row = b.requests.find((x) => x.id === id);
        if (row) row.acct = acct;
        return { ok: true };
      });
    }
    const link = await stripe.onboardLink({
      account: acct,
      refresh: backHere(req, "/pay/" + id),
      done: backHere(req, "/pay/" + id + "?landed=1"),
    });
    if (!link?.url) { sendBroken = "no onboarding link"; return res.status(502).json({ error: "connect" }); }
    res.json({ ok: true, url: link.url });
  } catch (err) {
    /* Stripe's own sentence to the log, one plain word to the page, and the
       offer withdrawn until this process restarts. */
    console.error("request/land:", err.message);
    sendBroken = err.message || "connect";
    res.status(502).json({ error: "connect" });
  }
});

/** DID THEY FINISH. Stripe sends them back here and the answer is not on the
 *  query string — ?landed=1 is something anybody can type. Asked of Stripe. */
app.post("/api/request/:id/landed", express.json({ limit: "1kb" }), async (req, res) => {
  if (!stripe.configured()) return res.status(400).json({ error: "off" });
  const id = request.cleanId(req.params.id);
  if (!id) return res.status(404).json({ error: "gone" });
  const board = await store.load(FILE);
  const q = board.requests.find((x) => x.id === id);
  if (!q || !q.acct) return res.status(400).json({ error: "no" });
  if (q.landed) return res.json({ ok: true, landed: true });

  let ready = false;
  try { ready = await stripe.payeeReady(q.acct); }
  catch (err) { console.error("request/landed:", err.message); return res.status(502).json({ error: "stripe" }); }
  if (ready) {
    await change((b) => {
      const row = b.requests.find((x) => x.id === id);
      if (row) row.landed = true;
      return { ok: true };
    });
  }
  res.json({ ok: true, landed: ready });
});

/* WHOSE REQUESTS SETTLE THROUGH THE ACCOUNT THESE KEYS BELONG TO.
 *
 * One handle, from the environment, lower-cased on both sides so what Tom
 * types in .env does not have to match the capitals he chose on the board.
 * Empty — the normal state of every other box that ever runs this code —
 * means no request anywhere reaches the QR branch at all. */
const DEALIO_OWNER = String(process.env.BOARD_DEALIO_OWNER || "").trim().toLowerCase();

/* A CODE THAT GOES SOMEWHERE, WITH NO PROVIDER BEHIND IT.
 *
 * Stripe closed on 20 September and Airwallex blocked this box at their edge
 * on the 21st — not a key problem, a door problem: the same request with no
 * credentials at all comes back 403 and an HTML page. So nothing can draw a
 * real payment code here, and the whole chain after it — scan, pay, the row
 * going green — cannot be shown to anybody.
 *
 * This draws the code ourselves, with our own encoder, pointing at our own
 * checkout. The payer scans, lands on a page that looks like paying, taps,
 * and the request settles exactly as it would have. Everything except the
 * money is real.
 *
 * IT IS OFF UNLESS ASKED FOR, and it says what it is on every screen it
 * touches. A fake payment that does not announce itself is a lie told to
 * somebody about their own money, and the same rule applies here as to the
 * line in CLAUDE.md about not claiming to be encrypted. Never set on a box
 * taking real money. */
const DEALIO_DEMO = process.env.BOARD_DEALIO_DEMO === "1";

/* WHAT POSTAGE COSTS AND WHAT A STOREFRONT EARNS. One flat postage per
   order, because that is how a parcel to China is actually charged and a
   calculated one is a promise about a courier's pricing nobody here can
   keep. The cut is a percentage of the goods, never of the postage —
   nobody earns commission on freight. */
const POST_FEN = Math.max(0, Math.round(Number(process.env.BOARD_SHOP_POST || 3000)));
const SHOP_CUT_PCT = Math.min(Math.max(Number(process.env.BOARD_SHOP_CUT || 15), 0), 60);

/** The provider, only if it can do both halves: draw a code and later say
 *  whether that code was paid. A provider that can only do the first would
 *  leave money arriving with nothing to notice it. */
function dealioQr() {
  const p = WALLET.on ? WALLET.provider : null;
  if (!p || typeof p.qrPay !== "function" || typeof p.intentStatus !== "function") return null;
  return p;
}

/** Whether this request was made by the person whose account the money goes
 *  to. The handle is read from the board rather than trusted from anywhere
 *  else, and an asker with no published row is nobody. */
function dealioOwns(board, q) {
  if (!DEALIO_OWNER) return false;
  const asker = board.people.find((p) => p.by === q.by);
  return Boolean(asker?.handle && String(asker.handle).trim().toLowerCase() === DEALIO_OWNER);
}

/** The wallets that can pay this request with a code, which is either both of
 *  them or neither.
 *
 *  Four things at once, and they are the whole gate: the provider can draw a
 *  code and ask about it, the request was made by the one person whose
 *  account the money lands in, the money is coming IN rather than being
 *  promised out, and it is in yuan — which is what these two wallets take. */
function dealioWays(board, q) {
  const p = dealioQr();
  /* THE DEMO RAIL NEEDS NO PROVIDER, which is the point of it — it is for the
     board that has none. Same two wallets, same screens, and a code drawn
     here rather than fetched from anybody. */
  if (DEALIO_DEMO && q && (q.way || "in") === "in" && dealioOwns(board, q)) return ["wechat", "alipay"];
  if (!q || !p || !q.cur) return [];
  if ((q.way || "in") !== "in" || !dealioOwns(board, q)) return [];
  /* THE PAYER ALWAYS SENDS YUAN. An Australian quotes in Australian
     dollars, because that is the only price he knows, and the woman in
     Beijing pays in the only money she has. Anything the provider can price
     against yuan is payable; what it cannot price is not. */
  if (q.cur !== "cny" && (typeof p.quote !== "function" || !CNY_PAIRS.has(q.cur))) return [];
  return ["wechat", "alipay"];
}

/** Whether this person's own requests draw codes — the list screen's
 *  version of dealioWays, which needs a request and this does not. */
function dealioIsOwner(person) {
  return Boolean(dealioQr()) && Boolean(DEALIO_OWNER)
    && String(person?.handle || "").trim().toLowerCase() === DEALIO_OWNER;
}

/* The currencies the provider will quote against yuan. Its own table, and
   shorter than the board's — a request in pounds is a request nobody here
   can price, and saying so beats a refusal from the provider on the payer's
   phone. */
const CNY_PAIRS = new Set(["aud", "usd", "eur", "hkd"]);

/* ASKING THE PROVIDER, WITHOUT ASKING IT TWICE A SECOND. Both pages poll
   this while a code is on the screen, and the answer does not change between
   two taps of a phone. One live call per request every four seconds; the
   rest are answered from here. */
const payChecked = new Map();

/** The request a payment intent belongs to, settled. Called by the webhook,
 *  which knows the provider's id for the payment and nothing about us.
 *
 *  An intent this board has never heard of is one of the wallet's own, or
 *  another product's on the same account: not ours, and silence is the right
 *  answer. The cached status is dropped first — a page that asked two
 *  seconds ago holds a "not yet" that would make this event a no-op. */
async function settleByIntent(intentId) {
  const board = await store.load(FILE);
  const q = board.requests.find((x) => x.pay?.ref === intentId);
  if (!q) return false;
  payChecked.delete(q.id);
  return settleIfPaid(q);
}

/** Ask whether the code on this request has been paid, and write it down if
 *  it has. True only when this call is the one that moved the row.
 *
 *  Safe to call about anything: a request with no code, a board with no
 *  provider, a row already settled and a provider that cannot be reached all
 *  answer false without writing. */
async function settleIfPaid(q) {
  const p = dealioQr();
  if (!p || !q?.pay?.ref || request.requestState(q) === "paid") return false;
  const seen = payChecked.get(q.id);
  let status = seen && Date.now() - seen.at < 4000 ? seen.status : "";
  if (!status) {
    try {
      const r = await p.intentStatus(q.pay.ref);
      status = String(r.status || "");
      payChecked.set(q.id, { at: Date.now(), status });
    } catch (err) {
      /* THE PROVIDER BEING UNREACHABLE IS NOT THE MONEY NOT ARRIVING, and
         neither page may be told it was refused. */
      console.error("dealio check:", err.message);
      return false;
    }
  }
  if (status !== "SUCCEEDED") return false;

  const out = await change((b) => {
    const row = b.requests.find((x) => x.id === q.id);
    if (!row || request.requestState(row) === "paid") return { ok: true };
    row.said = Array.isArray(row.said) ? row.said : [];
    const at = new Date().toISOString();
    /* BOTH HALVES AT ONCE, AND NEITHER OF THEM IS A PERSON. The provider saw
       the money arrive, which is a better witness than either side tapping a
       button, so this writes the claim and the confirmation together and
       marks both `auto` — the same shape the Stripe webhook writes on a
       deal's plan row, and for the same reason. A handle in `who` would
       credit somebody with having said something they never said. */
    if (!row.said.some((x) => x.kind === "claimed")) {
      row.said.push({ kind: "claimed", who: "", at, auto: true });
    }
    row.said.push({ kind: "confirmed", who: "", at, auto: true });
    return { ok: true, tell: row.by };
  });
  /* The person owed it, told, whether or not any page is open. */
  if (out?.tell) tellThem(out.tell).catch(() => {});
  return true;
}

/** PAYING ONE.
 *
 *  The same checkout the room asks for, authorised by nothing but the link —
 *  which is what a payment request is. Nothing about the money differs, which
 *  is why this goes through startCheckout like the other two.
 */
app.post("/api/request/:id/pay", express.json({ limit: "1kb" }), async (req, res) => {
  /* The QR rails are a third way to be configured, and on the box that has
     Airwallex keys and no Stripe they are the only one. */
  /* FOUR WAYS TO BE CONFIGURED NOW. The demo rail is the one that needs
     nothing at all, which is exactly the board this is for — no Stripe, no
     wallet provider, and a chain that still has to be showable. */
  if (!stripe.configured() && !PAY_DEMO && !dealioQr() && !DEALIO_DEMO) return res.status(400).json({ error: "off" });
  const id = request.cleanId(req.params.id);
  const method = String(req.body?.method || "card");
  if (!id) return res.status(404).json({ error: "gone" });
  if (!["wechat", "alipay", "card"].includes(method)) return res.status(400).json({ error: "no" });

  const board = await store.load(FILE);
  const q = board.requests.find((x) => x.id === id);
  if (!q || q.off) return res.status(404).json({ error: "gone" });
  /* Already settled. A link somebody scrolled back to a month later must not
     take the money a second time. */
  if (request.requestState(q) === "paid") return res.status(400).json({ error: "already" });

  /* A REQUEST WITH NO CURRENCY CANNOT BE PRICED, and this came back as
     "amount" — so the page said "that did not open" for all three methods
     while the amount on the screen was perfectly fine. Said as itself. */
  if (!q.cur) return res.status(400).json({ error: "currency" });

  /* A CODE ON THE SCREEN, WHEN THE MONEY IS GOING WHERE THE KEYS POINT.
   *
   * This is the whole of Dealio's first real payment and it is deliberately
   * the narrowest thing that works. Airwallex will onboard other people as
   * connected accounts and take the money straight to them — that is the
   * product — but it is not approved yet, and until it is, every payment
   * these keys confirm lands in ONE account: the account holder's.
   *
   * So the gate is four things at once, and the first of them is who asked.
   * BOARD_DEALIO_OWNER names the handle whose requests may use these rails,
   * and nobody else's request can reach this branch. A member's client
   * paying through it would be paying the account holder for work they did
   * not do, which is not a bug to be found later.
   *
   * The other three: the money is coming IN (a request, not a promise to
   * send), it is in yuan, which is what WeChat Pay and Alipay take, and the
   * payer chose one of those two wallets. Anything else falls through to
   * Stripe below, unchanged.
   *
   * What comes back is a string, and the page draws it. Nothing about the
   * payer reaches this server: they long-press a code and pay inside the
   * wallet they already had open, which is the one gesture this whole
   * product is built around. */
  /* OUR OWN CODE, WHEN THERE IS NOBODY ELSE'S TO DRAW. Encodes an ordinary
     https address on this board — the mock wallet at /pay/<id>/wallet — so a
     phone scanning it lands on a page instead of on nothing. Ahead of the
     provider branch because when the demo is on it is the whole rail. */
  if (DEALIO_DEMO && dealioWays(board, q).includes(method)) {
    const url = payLink(req, "/pay/" + q.id + "/wallet?w=" + method);
    const drawn = qrBits(url);
    const png = await qrPng(url);
    await change((b) => {
      const row = b.requests.find((x) => x.id === id);
      if (row) row.pay = { ref: "demo:" + method, how: method, at: new Date().toISOString(), cny: "" };
      return { ok: true };
    });
    return res.json({
      ok: true, how: method, demoRail: true,
      qr: { size: drawn.size, bits: drawn.bits, png },
      amount: store.fromMinor(store.toMinor(q.amount, q.cur), q.cur),
      orig: "",
    });
  }

  const qrProvider = dealioWays(board, q).includes(method) ? dealioQr() : null;
  if (qrProvider) {
    const minor = store.toMinor(q.amount, q.cur);
    if (!minor) return res.status(400).json({ error: "amount" });
    try {
      /* HIS PRICE, HER MONEY.
       *
       * A request in Australian dollars is turned into yuan here, at the
       * rate the moment the code is drawn, and the code is for that many
       * yuan. Asked as a buy: how much yuan must be sold to produce exactly
       * A$1,000, so the number on the asker's row is the number that lands
       * and the rounding is not his problem.
       *
       * THE RATE IS FIXED WHEN THE CODE IS. Between drawing and paying the
       * market moves, and whoever asked wears it — a few points either way
       * over the eight minutes a code lasts. Settling in yuan and
       * converting separately is 0.88%; letting the wallet convert would be
       * 2.00%, which is the whole reason this is done here. */
      let cny = minor;
      if (q.cur !== "cny") {
        const quote = await qrProvider.quote({
          sell: "CNY", buy: q.cur.toUpperCase(), buyAmount: minor, validSeconds: 900,
        });
        cny = Number(quote?.sellAmount);
        if (!Number.isInteger(cny) || cny <= 0) return res.status(502).json({ error: "qr" });
      }
      const r = await qrProvider.qrPay({
        amount: cny, currency: "CNY", method,
        /* What the payer sees beside the amount in their own wallet. Their
           own line about the job, not our name for it. */
        reference: q.what || q.from,
      });
      if (!r.qr) return res.status(502).json({ error: "qr" });
      const drawn = qrBits(r.qr);
      /* The one a finger can do anything with — see the note in lib/qr.js. */
      const png = await qrPng(r.qr);
      /* THE INTENT ID ON THE ROW, BEFORE THE CODE IS ON THE SCREEN. It is
         the only way to ask later whether the money arrived, and a code
         drawn without it is a payment nobody can see. */
      await change((b) => {
        const row = b.requests.find((x) => x.id === id);
        if (row) {
          row.pay = { ref: r.id, how: method, at: new Date().toISOString(),
            cny: q.cur === "cny" ? "" : String(cny) };
        }
        return { ok: true };
      });
      return res.json({
        ok: true, how: method, qr: { size: drawn.size, bits: drawn.bits, png },
        /* What to put above the code, and the asker's own price under it
           when the two are different money. */
        amount: store.fromMinor(cny, "cny"),
        orig: q.cur === "cny" ? "" : store.fromMinor(minor, q.cur),
      });
    } catch (err) {
      console.error("dealio qr:", err.message);
      return res.status(502).json({ error: "qr" });
    }
  }

  /* WHOSE ACCOUNT, BY DIRECTION — see the note in the read route above. */
  const asker = board.people.find((p) => p.by === q.by);
  const dest = (q.way || "in") === "out"
    ? (q.landed ? q.acct : "")
    : asker?.payee;
  if (!dest) return res.status(400).json({ error: "payee" });
  if (!stripe.configured()) return res.json({ ok: true, demo: true, method });

  /* startCheckout reads a plan row, so the request is handed to it as one.
     The shape is the same — a label, an amount, a currency — and keeping one
     function is the point: the cut, the rounding and the destination are the
     three things that must never quietly differ between routes. */
  const out = await startCheckout({
    d: { plan: [{ label: q.what || q.from, amount: q.amount }], cur: q.cur, title: q.what },
    i: 0, method, payeeAcct: dest,
    /* `q:` so the webhook can tell a request from a room's plan row: the
       other two refs are a twenty-hex group id and a row number. */
    ref: "q:" + q.id,
    done: backHere(req, "/pay/" + q.id + "?paid={CHECKOUT_SESSION_ID}"),
  });
  if (out.error) return res.status(out.error === "stripe" ? 502 : 400).json(out);
  res.json({ ok: true, ...out });
});

/** DID THE MONEY ARRIVE?
 *
 *  THE ONE WITNESS A CODE ON A WALL HAS. A card payment comes back through
 *  the payer's own browser and a webhook behind it; a wallet payment does
 *  neither. The payer long-presses a code, leaves for WeChat, pays, and that
 *  is the last this server hears of them — the page they left may be closed
 *  before the money moves, and on a phone it usually is.
 *
 *  So both sides ask instead. The payer's page polls this while the code is
 *  up, and the person owed the money asks it when they open the request an
 *  hour later. Whoever asks first is the one who turns the row green; the
 *  answer is the same either way because it comes from the provider and not
 *  from either of them.
 *
 *  A WEBHOOK WOULD BE BETTER and is the next thing: it needs a public address
 *  registered in Airwallex's dashboard and its secret in .env, neither of
 *  which exists yet, and asking needs nothing set up at all.
 *
 *  Open, like every other route on a request: the link is the whole of the
 *  authority here, and this says only what the page already shows.
 */
app.get("/api/request/:id/check", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const id = request.cleanId(req.params.id);
  if (!id) return res.status(404).json({ error: "gone" });
  const board = await store.load(FILE);
  const q = board.requests.find((x) => x.id === id);
  if (!q || q.off) return res.status(404).json({ error: "gone" });
  const now = () => request.requestState(q);
  if (now() === "paid") return res.json({ ok: true, state: "paid" });

  const paid = await settleIfPaid(q);
  res.json({ ok: true, state: paid ? "paid" : now() });
});

/** TAKING ONE BACK, by whoever asked. Kept rather than deleted: somebody was
 *  sent a link and is owed an answer about why it stopped working. */
app.post("/api/request/:id/off", notesOff, express.json({ limit: "1kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const id = request.cleanId(req.params.id);
  if (!me || !id) return res.status(400).json({ error: "no" });
  const out = await change((board) => {
    const q = board.requests.find((x) => x.id === id);
    if (!q || q.by !== me) return { error: "no" };
    if (request.requestState(q) === "paid") return { error: "paid" };
    q.off = true;
    return { ok: true };
  });
  if (out?.error) return res.status(400).json(out);
  res.json({ ok: true });
});

/** THE ONES YOU HAVE SENT. Yours only, newest first. */
/** CAN STRIPE ACTUALLY PAY THIS ACCOUNT — cached for a minute.
 *
 *  Asked on every load of Dealio's home screen, and the answer changes at
 *  most once in a person's life, so a minute of memory saves a round trip to
 *  Stripe on every refresh without ever being stale enough to matter.
 *
 *  A failure to reach Stripe answers "no". The alternative is a screen that
 *  says somebody is set up because we could not check, which is precisely
 *  the false yes this whole change exists to stop.
 */
const payeeSeen = new Map();
async function canBePaid(acct) {
  if (!acct) return false;
  const now = Date.now();
  const had = payeeSeen.get(acct);
  if (had && now - had.at < 60_000) return had.ok;
  let ok = false;
  try { ok = await stripe.payeeReady(acct); }
  catch (err) { console.error("payeeReady:", err.message); }
  payeeSeen.set(acct, { ok, at: now });
  /* Never allowed to grow: one entry per payee is small, but a map that only
     ever gains keys is a leak with a slow fuse. */
  if (payeeSeen.size > 500) payeeSeen.clear();
  return ok;
}

app.get("/api/requests", notesOff, async (req, res) => {
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
  res.set("Cache-Control", "no-store");
  if (!me) return res.json({ requests: [] });
  let board = await store.load(FILE);
  const me_ = board.people.find((p) => p.by === me);
  let mine = board.requests.filter((q) => q.by === me).reverse();
  /* A CODE PAID WHILE NOBODY WAS LOOKING.
     The payer long-presses a code, pays in their wallet and closes the tab;
     nothing comes back here. So this screen — the one the person owed the
     money opens to find out — asks about its own unsettled codes. Three at
     most, newest first, and each one answered from the last four seconds
     when it was asked that recently, so opening this page twice is not two
     calls to Airwallex. */
  const coded = mine.filter((q) => q.pay?.ref && request.requestState(q) === "due").slice(0, 3);
  if (coded.length) {
    let moved = false;
    for (const q of coded) { if (await settleIfPaid(q)) moved = true; }
    if (moved) {
      board = await store.load(FILE);
      mine = board.requests.filter((q) => q.by === me).reverse();
    }
  }
  res.json({
    /* WHETHER THERE IS ANYWHERE FOR THE MONEY TO LAND, said at the top of the
       list rather than discovered by the person who was sent a link. Without
       it every request here is unpayable and nothing on this screen would
       say so. */
    /* READY MEANS STRIPE WILL ACTUALLY TAKE THE MONEY, not that a row has an
       account id on it. Having an id was the whole test, and an id is minted
       the instant somebody presses the button — before any identity, before
       any bank. So Dealio drew a clean home screen with no warning on it for
       a person Stripe was refusing every payment to, and the only place that
       disagreement surfaced was on the payer's phone, as "that did not open".

       One call to Stripe per load of this screen. It is the screen that
       exists to tell somebody whether they can be paid; asking is the job. */
    /* CAN ANYBODY PAY YOU. It asked Stripe and only Stripe, so the home
       screen of the box whose codes work said "Nobody can pay you yet" to
       the one person they work for — every time he opened it, under a list
       of requests people could have paid. A warning that is false is worse
       than no warning: it is the app telling its owner his own product is
       broken. */
    ready: dealioIsOwner(me_) || (Boolean(me_?.payee) && (stripe.configured() || PAY_DEMO)
      && (!stripe.configured() || await canBePaid(me_.payee))),
    /* AND WHICH MONEY CAN ACTUALLY BE ASKED FOR. The picker offers seven
       currencies; the codes can price four of them against yuan. Asking in
       pounds made a request that could only be refused on somebody else's
       phone, an hour after it was sent. Empty means no restriction — every
       board that is not this one. */
    curs: dealioIsOwner(me_) ? ["cny", ...CNY_PAIRS] : [],
    /* WHETHER SENDING MONEY CAN WORK AT ALL. It is the Stripe half, and on
       a box whose Connect is not on, the button leads to a dead end on
       somebody else's phone. Off until this process is restarted — see
       sendBroken. */
    canSend: stripe.configured() && !sendBroken,
    /* STARTED BUT NOT FINISHED IS ITS OWN STATE, and it is the commonest one:
       Stripe's onboarding is several screens and people leave in the middle
       of it. "You have not said where the money should land" is untrue to
       somebody who said it twenty minutes ago and stopped at the bank page. */
    started: Boolean(me_?.payee),
    you: me_?.handle || "",
    /* Whether the page may draw a microphone. Two keys and two bills behind
       it; asking beats drawing one that cannot work. */
    canHear: hear.configured() && terms.configured(),
    /* WHETHER THERE IS A WECHAT WAY IN. There is not yet: it needs a WeChat
       Open Platform account, which needs a registered company and a review,
       and neither exists. The page asks rather than drawing a button that
       cannot work — the same rule the microphone runs on — so the day the
       credentials land the button appears and nothing else changes.

       It matters more than it looks: accounts.google.com does not answer in
       the mainland, and the mainland is who this is for. Until WeChat is
       here, the invite code is the only road that works for most of them,
       which is why the sign-in sheet draws it the same size as Google. */
    canWeChat: Boolean((process.env.BOARD_WECHAT_APPID || "").trim()
      && (process.env.BOARD_WECHAT_SECRET || "").trim()),
    requests: mine.map((q) => ({
      ...request.requestView(q),
      /* The asker's own view carries what the payer's must not: whether it
         was taken back, and the address to send again. */
      off: Boolean(q.off),
      url: payLink(req, "/pay/" + q.id),
    })),
  });
});

/** WHAT THEY JUST SAID, TURNED INTO A REQUEST — the hard half, on its own.
 *
 *  Testable without a microphone, a phone, or a deploy in between. The thing
 *  that can be wrong here is the reading, not the recording, and the reading
 *  is the part that will quietly write a number nobody said.
 *
 *    make hear TEXT="twelve lessons at two hundred, Tuesdays at seven"
 */
app.post("/api/admin/terms", admin, express.json({ limit: "4kb" }), async (req, res) => {
  const said = String(req.body?.said || "").trim();
  if (!said) return res.status(400).json({ error: "empty" });
  const out = await terms.read(said);
  if (out.error) return res.status(out.error === "unconfigured" ? 503 : 502).json(out);
  res.json({ ok: true, ...out });
});

/** ONE REQUEST, MADE FROM A TERMINAL.
 *
 *  WHAT THIS IS FOR. Testing the half that matters without signing anything
 *  in. The person paying needs no account — that is the whole design — but
 *  the person asking does, and getting an identity onto a particular phone is
 *  three steps and a code typed by hand. For a ¥1 test of the paying screens
 *  that is three steps too many.
 *
 *  So: whoever runs the board makes the request as somebody, and gets back
 *  the link. Opened on any phone, signed in or not, it is exactly what the
 *  person being asked would see.
 *
 *  WHO is a first name — the handle as it appears on the board. Everything
 *  else is what the request says.
 */
/* ---- THE SHOP ------------------------------------------------------------
 *
 * One catalogue, many storefronts — see the header of lib/shop.js. These
 * three routes are the buyer's whole world: the shop she opened from a
 * WeChat message, the order she makes on it, and the state of that order
 * afterwards. No account at any point.
 *
 * OPEN, like the payment pages. A storefront that needs a code is a
 * storefront nobody outside the board can buy from, which is all of them.
 */

/** A STOREFRONT: whose it is, and what is on it.
 *
 *  Every published member has one, and today every storefront shows the
 *  whole catalogue. Letting somebody pick the twelve things they will stand
 *  behind is the next thing and is a field on this route, not a new one. */
app.get("/api/shop/:handle", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const handle = String(req.params.handle || "").slice(0, 40);
  if (!handle) return res.status(404).json({ error: "gone" });
  const board = await store.load(FILE);
  /* A HANDLE IS ENOUGH FOR A SHOP, AND A PUBLISHED PROFILE IS NOT REQUIRED.
     It was, and the first shopfront anybody opened — Tom's own — answered
     "gone", because a member who never filled in a profile page is not
     "published" and has no business being told his shop does not exist. A
     storefront sells things; the profile is a different object, and what
     comes off it here is only shown when it was published. */
  const who = board.people.find((p) => p.handle && p.handle === handle);
  if (!who) return res.status(404).json({ error: "gone" });
  const live = who.state === "published";
  res.json({
    ok: true,
    shop: {
      handle: who.handle,
      /* The shop's own name and banner, when it has been given one. A
         handle and a grey circle is not a shop — see `shop` in store.js. */
      name: who.shop?.name || "",
      banner: shopPic(who.shop?.banner),
      /* 联系店家 — see the note on `shop` in store.js. The id is public by
         the act of putting it on a shopfront; nothing else about her is. */
      wechat: who.shop?.wechat || "",
      qr: shopPic(who.shop?.qr),
      ai: Boolean(who.shop?.ai),
      /* HIS OWN WORDS, unrendered. Every other pair on this board carries a
         machine version into the other language; this one does not, because
         the whole value of the paragraph is that a person wrote it. */
      story: who.shop?.story || "",
      /* The moments, for the page below this one. Photographs are rewritten
         to the shop route like every other picture here. */
      chapters: (who.shop?.chapters || []).map((c) => ({
        when: c.when, text: c.text, photo: shopPic(c.photo),
      })),
      /* Their own line, in whichever language they wrote it and its render
         into the other — the same pair every card on this board shows, and
         only when the page it came from is public. */
      say: live ? who.goal || "" : "",
      sayZh: live ? who.goalZh || "" : "",
      /* AN ADDRESS, NOT AN ID. This handed the raw media id to the page,
         which set it as a src, which resolved against the shop's own path
         and 404'd — so every shopfront quietly dropped its shopkeeper's
         face and nobody noticed, because the <img> removes itself on
         error and an absent face looks like a shop that never had one. */
      photo: live && who.photoState === "published" && who.photo
        ? SHOP_PIC + encodeURIComponent(who.photo) : "",
    },
    /* WHAT THE SHOP CAN ACTUALLY BACK, and nothing it cannot.
       Three numbers under his words, each one counted here rather than
       typed into a field: parcels that a buyer confirmed arrived, reviews
       written against a real order, and the month the first order came in.
       A shop that says something it cannot back is the thing this trade
       punishes hardest — see the note on `shop` in store.js — so a shop
       with no history sends zeros and the page shows nothing rather than
       a flattering round number nobody earned. */
    proof: (() => {
      const mine = board.orders.filter((o) => o.shop === who.handle && !o.off);
      const done = mine.filter((o) => o.got);
      const ids = new Set(mine.map((o) => o.id));
      const revs = board.reviews.filter((r) => ids.has(r.order) || r.src);
      const first = mine.map((o) => o.at).sort()[0] || "";
      return { sent: done.length, reviews: revs.length, since: first.slice(0, 7) };
    })(),
    /* Sold-out rows stay, marked: a shopfront that linked to something has
       to be able to say 已售完 rather than go quiet. */
    products: board.products
      .filter((p) => !p.off)
      /* The English name goes with it, because the one person who reads
         this page in English is whoever runs the shop, and a picking-list
         name is more use to him than a Chinese one he is checking. */
      .map((p) => ({ id: p.id, name: p.name, en: p.en, unit: p.unit, kind: p.kind,
        price: p.price, photo: shopPic(p.photo), out: Boolean(p.out) })),
    /* One postage per order, the way every parcel out of Australia is
       actually charged. */
    post: POST_FEN,
  });
});

/** ONE ORDER, MADE BY SOMEBODY WITH NO ACCOUNT.
 *
 *  The lines are re-priced from the catalogue here and never trusted from
 *  the page: a browser that says a tin of formula costs one fen is a browser
 *  saying it, not a price. */
app.post("/api/shop/:handle/order", express.json({ limit: "8kb" }), async (req, res) => {
  const handle = String(req.params.handle || "").slice(0, 40);
  const want = Array.isArray(req.body?.lines) ? req.body.lines.slice(0, 40) : [];
  const by = hashDevice(String(req.body?.device || ""), SALT);
  if (!handle || !want.length) return res.status(400).json({ error: "no" });

  const ship = shop.cleanShip(req.body?.ship);
  if (!ship) return res.status(400).json({ error: "address" });

  const out = await change((board) => {
    const who = board.people.find((p) => p.handle === handle);
    if (!who) return { error: "gone" };

    const lines = [];
    for (const l of want) {
      const found = board.products.find((p) => p.id === shop.cleanId(l?.id));
      if (!found || found.off || found.out) continue;
      const n = Math.min(Math.max(Math.round(Number(l?.n) || 0), 1), 99);
      lines.push({ id: found.id, name: found.name, price: found.price, n });
    }
    if (!lines.length) return { error: "empty" };

    const order = shop.cleanOrder({
      id: shop.newId(), at: new Date().toISOString(),
      shop: who.handle, by, lines, ship, post: POST_FEN,
      /* WHAT THE STOREFRONT EARNS, fixed now. A rate that changes next month
         must not reach back into what somebody has already sold. */
      cut: Math.floor(lines.reduce((n, l) => n + l.price * l.n, 0) * SHOP_CUT_PCT / 100),
    });
    if (!order) return { error: "bad" };
    board.orders.push(order);
    return { ok: true, id: order.id, tell: who.by };
  });
  if (out?.error) {
    return res.status(out.error === "gone" ? 404 : 400).json({ error: out.error });
  }
  res.status(201).json({ ok: true, id: out.id });
  /* The person whose shop it is, told an order came in. */
  if (out.tell) tellThem(out.tell).catch(() => {});
});

/** READING ONE. The link is the whole of the authority, as everywhere else
 *  here: what comes back is an allowlist and carries nobody's device hash. */
app.get(["/orders", "/orders/"], (req, res, next) => page("orders.html", req, res, next));

/* ---- THE REPRESENTATIVE'S OWN SHOP ---------------------------------------
 *
 * She sold it, so she is the one asked where it is — and she had a number on
 * /paid and nothing else. One screen: her link, what has been ordered
 * through it, and what she has earned.
 *
 * WHAT SHE IS NOT SHOWN, AND THIS IS THE WHOLE DESIGN OF IT: the buyer's
 * address and phone. She is not shipping anything — the stock and the
 * distributor are his — so an address in her hands is a liability she was
 * never asked whether she wanted. A first name so she knows which of her
 * friends it was, the tracking number so she can answer the question, and
 * nothing further.
 */
app.get(["/mine", "/mine/"], (req, res, next) => page("mine.html", req, res, next));

app.get("/api/mine", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
  if (!me) return res.json({ ok: true, handle: "" });
  const board = await store.load(FILE);
  const mine = board.people.find((p) => p.by === me);
  if (!mine) return res.json({ ok: true, handle: "" });

  const rows = board.orders
    .filter((o) => !o.off && o.shop === mine.handle)
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))
    .slice(0, 100);

  res.json({
    ok: true,
    handle: mine.handle,
    name: mine.shop?.name || "",
    /* Earned is every commission on a paid order; owed is the part that has
       not reached her yet. Two numbers because "you have earned X" with X
       sitting in somebody else's account is the sentence that loses trust. */
    earned: store.fromMinor(rows.filter((o) => o.paid).reduce((n, o) => n + (o.cut || 0), 0), "cny"),
    owed: store.fromMinor(rows.filter((o) => o.paid && !o.cutPaid).reduce((n, o) => n + (o.cut || 0), 0), "cny"),
    owedFen: rows.filter((o) => o.paid && !o.cutPaid).reduce((n, o) => n + (o.cut || 0), 0),
    paid: Boolean(mine.payout),
    ai: Boolean(mine.shop?.ai),
    /* What she has asked for and not yet been sent. The screen says
       处理中 rather than offering the button again. */
    asked: (() => {
      const c = board.cashouts.find((x) => x.who === mine.handle && !x.paid);
      return c ? { amount: store.fromMinor(c.fen, "cny"), at: c.at } : null;
    })(),
    /* Unread across every thread, for the one badge that decides whether
       she opens the list at all. */
    unread: board.chats
      .filter((c) => c.shop === mine.handle)
      .reduce((n, c) => n + Math.max(0, c.lines.length - c.seenShop), 0),
    orders: rows.map((o) => ({
      id: o.id, at: o.at,
      state: shop.orderState(o),
      total: store.fromMinor(shop.orderTotal(o), "cny"),
      cut: o.cut ? store.fromMinor(o.cut, "cny") : "",
      cutPaid: Boolean(o.cutPaid),
      first: o.lines[0]?.name || "",
      n: o.lines.reduce((n, l) => n + l.n, 0),
      /* A first name and nothing else — see the note above. */
      who: String(o.ship?.name || "").slice(0, 1) ? o.ship.name : "",
      tracking: o.sent?.tracking || "",
      courier: o.sent?.courier || "",
    })),
  });
});

app.get("/api/order/:id", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const id = shop.cleanId(req.params.id);
  if (!id) return res.status(404).json({ error: "gone" });
  const board = await store.load(FILE);
  const o = board.orders.find((x) => x.id === id);
  if (!o) return res.status(404).json({ error: "gone" });
  res.json({ ok: true, order: shop.orderView(o) });
});

/** 确认收货 — THE STATE NOBODY COULD REACH.
 *
 *  orderState returns 完成 on `got`, and nothing ever set it: every order
 *  stopped at 待收货 forever. That is the state the review hangs off, and
 *  confirming receipt is a button every Chinese buyer expects to press.
 *
 *  Only she can press it, and only once it has been sent. The seller must
 *  never be able to mark somebody else's parcel as arrived — that is the
 *  one click in this whole shop that decides whether she was looked after.
 */
app.post("/api/order/:id/got", express.json({ limit: "1kb" }), async (req, res) => {
  const id = shop.cleanId(req.params.id);
  const me = hashDevice(String(req.body?.device || ""), SALT);
  if (!id || !me) return res.status(400).json({ error: "no" });
  const out = await change((b) => {
    const o = b.orders.find((x) => x.id === id);
    if (!o || o.off || o.by !== me) return { error: "gone" };
    if (!o.sent?.tracking) return { error: "notyet" };
    o.got = true;
    return { ok: true };
  });
  if (out?.error) return res.status(out.error === "notyet" ? 400 : 404).json(out);
  res.json({ ok: true });
});

/** 评价 — WHAT SHE SAID, ON A LINE SHE ACTUALLY BOUGHT.
 *
 *  Every guard here is what makes a review worth reading: her device owns
 *  the order, the order arrived, the product was on it, and there is not
 *  one already. See cleanReview in lib/shop.js. */
app.post("/api/order/:id/review", express.json({ limit: "4kb" }), async (req, res) => {
  const id = shop.cleanId(req.params.id);
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const product = shop.cleanId(req.body?.product);
  const stars = Math.min(Math.max(Math.round(Number(req.body?.stars) || 0), 1), 5);
  const text = String(req.body?.text || "").replace(/\r\n?/g, "\n").trim().slice(0, 300);
  if (!id || !me || !product || !stars) return res.status(400).json({ error: "no" });

  let photo = "";
  if (req.body?.photo) {
    try { photo = await fetchPhoto(req.body.photo); } catch (err) {
      console.error("review photo:", err.message);
    }
  }

  const out = await change((b) => {
    const o = b.orders.find((x) => x.id === id);
    if (!o || o.off || o.by !== me) return { error: "gone" };
    if (!o.got) return { error: "notyet" };
    if (!o.lines.some((l) => l.id === product)) return { error: "notyours" };
    if (b.reviews.some((r) => r.order === id && r.product === product)) {
      return { error: "already" };
    }
    b.reviews.push({
      id: shop.newId(), order: id, product, by: me, stars, text, photo,
      at: new Date().toISOString(),
      /* Masked here, once, rather than at every render — the full name is
         then never in a response waiting for somebody to forget. */
      who: shop.maskName(o.ship?.name || ""),
      back: "",
    });
    return { ok: true };
  });
  if (out?.error) {
    return res.status(out.error === "gone" ? 404 : 400).json(out);
  }
  res.status(201).json({ ok: true });
});

/** 问大家 — ASK. Open to anybody, because the person asking has not bought
 *  anything yet and that is the whole point of her asking.
 *
 *  One unanswered question per device per product. Somebody who has asked
 *  and been answered can ask again; somebody who has asked and is waiting
 *  cannot fill a page with the same question. */
app.post("/api/product/:id/ask", express.json({ limit: "2kb" }), async (req, res) => {
  const product = shop.cleanId(req.params.id);
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const text = String(req.body?.text || "").replace(/\s+/g, " ").trim().slice(0, 200);
  if (!product || !me || !text) return res.status(400).json({ error: "no" });
  const out = await change((b) => {
    if (!b.products.some((p) => p.id === product)) return { error: "gone" };
    const waiting = b.asks.some((a) => !a.off && a.product === product
      && a.by === me && !a.answers.length);
    if (waiting) return { error: "waiting" };
    b.asks.push({ id: shop.newId(), product, by: me, text,
      at: new Date().toISOString(), who: "", answers: [] });
    return { ok: true };
  });
  if (out?.error) {
    return res.status(out.error === "gone" ? 404 : 400).json(out);
  }
  res.status(201).json({ ok: true });
});

/** 问大家 — ANSWER, from the shop or from somebody who bought the thing.
 *
 *  Not from anybody with a browser: an open answer box on a product page is
 *  a billboard, and the first thing it carries is a link to a cheaper shop.
 *  The check is against the orders, the same way a review's is. */
app.post("/api/ask/:id/answer", express.json({ limit: "2kb" }), async (req, res) => {
  const id = shop.cleanId(req.params.id);
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const text = String(req.body?.text || "").replace(/\r\n?/g, "\n").trim().slice(0, 300);
  if (!id || !me || !text) return res.status(400).json({ error: "no" });
  const out = await change((b) => {
    const a = b.asks.find((x) => x.id === id && !x.off);
    if (!a) return { error: "gone" };
    /* Somebody who runs a storefront speaks as 店家. */
    const keeper = b.people.find((p) => p.by === me);
    const isShop = Boolean(keeper);
    /* Or somebody who bought this exact thing and has it in her hands. */
    const bought = b.orders.find((o) => !o.off && o.paid && o.by === me
      && o.lines.some((l) => l.id === a.product));
    if (!isShop && !bought) return { error: "notyours" };
    a.answers.push({
      text, at: new Date().toISOString(), shop: isShop,
      who: isShop ? "" : shop.maskName(bought.ship?.name || ""),
    });
    if (a.answers.length > 20) a.answers = a.answers.slice(-20);
    return { ok: true };
  });
  if (out?.error) {
    return res.status(out.error === "gone" ? 404 : 403).json(out);
  }
  res.status(201).json({ ok: true });
});

/** THE QUESTIONS ON ONE THING. Answered first, because an unanswered
 *  question at the top of a page is a shop that does not reply. */
app.get("/api/product/:id/asks", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const id = shop.cleanId(req.params.id);
  if (!id) return res.json({ ok: true, rows: [], n: 0 });
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
  const board = await store.load(FILE);
  const all = board.asks.filter((a) => !a.off && a.product === id);
  /* Whether whoever is reading may answer — asked once here rather than
     guessed at by the page, which cannot see the orders. */
  const canAnswer = Boolean(me) && (
    board.people.some((p) => p.by === me)
    || board.orders.some((o) => !o.off && o.paid && o.by === me
      && o.lines.some((l) => l.id === id)));
  const rows = [...all]
    .sort((a, b) => (b.answers.length > 0) - (a.answers.length > 0)
      || String(b.at || "").localeCompare(String(a.at || "")))
    .slice(0, 50)
    .map((a) => ({ id: a.id, text: a.text, at: a.at, answers: a.answers }));
  res.json({ ok: true, rows, n: all.length, canAnswer });
});

/** A REVIEW FROM SOMEWHERE ELSE — the WeChat store, years of them.
 *
 *  It carries `src`, which the shopfront shows as 来自老店. The reviews
 *  written here are worth reading because an order nobody can fake stands
 *  behind them; one imported by hand has nothing behind it but Tom's word,
 *  and saying so is what keeps the others worth anything. */
app.post("/api/admin/review-add", admin, express.json({ limit: "512kb" }), async (req, res) => {
  /* A LIST, OR ONE. Six hundred reviews typed in one at a time is six
     hundred commands, and the WeChat store has that many. The single form
     below is the same path with an array of one. */
  if (Array.isArray(req.body?.rows)) {
    const product = shop.cleanId(req.body?.product);
    if (!product) return res.status(400).json({ error: "bad" });
    const rows = req.body.rows.slice(0, 500);
    const out = await change((b) => {
      if (!b.products.some((p) => p.id === product)) return { error: "gone" };
      let n = 0;
      for (const r of rows) {
        const text = String(r?.text || "").replace(/\r\n?/g, "\n").trim().slice(0, 300);
        if (!text) continue;
        /* THE SAME WORDS TWICE IS THE SAME REVIEW. Imports get run again —
           a second page, a retry, a file pasted over itself — and six
           hundred of somebody else's words are impossible to eyeball for
           duplicates afterwards. */
        if (b.reviews.some((x) => x.product === product && x.text === text)) continue;
        b.reviews.push({
          id: shop.newId(), order: shop.newId(), product, by: "0".repeat(32),
          stars: Math.min(Math.max(Math.round(Number(r?.stars) || 5), 1), 5),
          text, photo: "", who: shop.maskName(String(r?.who || "")), back: "",
          at: String(r?.at || "").trim().slice(0, 40) || new Date().toISOString(),
          src: "wechat",
        });
        n += 1;
      }
      return { ok: true, added: n, n: b.reviews.filter((r) => r.product === product).length };
    });
    if (out?.error) return res.status(404).json(out);
    return res.status(201).json({ ok: true, added: out.added, n: out.n });
  }

  const product = shop.cleanId(req.body?.product);
  const stars = Math.min(Math.max(Math.round(Number(req.body?.stars) || 5), 1), 5);
  const text = String(req.body?.text || "").replace(/\r\n?/g, "\n").trim().slice(0, 300);
  const who = String(req.body?.who || "").trim().slice(0, 20);
  if (!product || !text) return res.status(400).json({ error: "bad" });
  let photo = "";
  if (req.body?.photo) {
    try { photo = await fetchPhoto(req.body.photo); } catch (err) {
      console.error("old review photo:", err.message);
    }
  }
  const out = await change((b) => {
    if (!b.products.some((p) => p.id === product)) return { error: "gone" };
    b.reviews.push({
      id: shop.newId(), order: shop.newId(), product,
      /* No device owns it, and the id below is not an order anybody can
         find — it is there because the row shape wants one. `src` is what
         tells the page, and the reader, the truth about it. */
      by: "0".repeat(32),
      stars, text, photo, who: shop.maskName(who), back: "",
      at: String(req.body?.at || "").trim().slice(0, 40) || new Date().toISOString(),
      src: "wechat",
    });
    return { ok: true, n: b.reviews.filter((r) => r.product === product).length };
  });
  if (out?.error) return res.status(404).json(out);
  res.status(201).json({ ok: true, n: out.n });
});

/** ONE TAKEN DOWN. The catalogue is his, so this is his. */
app.post("/api/admin/ask-off", admin, express.json({ limit: "1kb" }), async (req, res) => {
  const id = shop.cleanId(req.body?.id);
  if (!id) return res.status(400).json({ error: "id" });
  const out = await change((b) => {
    const a = b.asks.find((x) => x.id === id);
    if (!a) return { error: "gone" };
    a.off = true;
    return { ok: true };
  });
  if (out?.error) return res.status(404).json(out);
  res.json({ ok: true });
});

/** WHAT PEOPLE SAID ABOUT ONE THING. Newest first, and the ones with words
 *  in them before the ones without — a wall of bare five-star rows reads as
 *  bought, which is the opposite of what a review is for. */
app.get("/api/product/:id/reviews", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const id = shop.cleanId(req.params.id);
  if (!id) return res.json({ ok: true, rows: [], n: 0, stars: 0 });
  const board = await store.load(FILE);
  const all = board.reviews.filter((r) => r.product === id);
  const rows = [...all]
    .sort((a, b) => (Boolean(b.text) - Boolean(a.text))
      || String(b.at || "").localeCompare(String(a.at || "")))
    .slice(0, 50)
    .map((r) => ({ who: r.who, stars: r.stars, text: r.text,
      photo: shopPic(r.photo), at: r.at, back: r.back, src: r.src }));
  res.json({
    ok: true, rows, n: all.length,
    stars: all.length
      ? Math.round((all.reduce((n, r) => n + r.stars, 0) / all.length) * 10) / 10
      : 0,
  });
});

/* ---- 联系店家 -------------------------------------------------------------
 *
 * The first version of this showed a WeChat id and a QR code, which is what
 * a shopfront carries — and it is the wrong thing to put behind this button.
 * Both shops the design was taken from open a MESSAGE THREAD on 联系店家.
 * Asking a stranger to add you as a WeChat friend before she has bought
 * anything is a bigger ask than the purchase, and it is the step where she
 * leaves. The WeChat details stay, underneath, for whoever wants them.
 *
 * She has no account. See cleanChat in lib/shop.js for what that costs and
 * what is done about it.
 */
app.get("/api/shop/:handle/chat", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const handle = String(req.params.handle || "").slice(0, 40);
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
  if (!me) return res.json({ ok: true, lines: [] });
  const board = await store.load(FILE);
  const c = board.chats.find((x) => x.shop === handle && x.by === me);
  if (!c) return res.json({ ok: true, lines: [] });
  /* Reading it is what marks it read, and only for her side. */
  if (c.seenBuyer < c.lines.length) {
    change((b) => {
      const row = b.chats.find((x) => x.id === c.id);
      if (row) row.seenBuyer = row.lines.length;
      return { ok: true };
    }).catch(() => {});
  }
  res.json({ ok: true, id: c.id, lines: c.lines });
});

app.post("/api/shop/:handle/chat", express.json({ limit: "2kb" }), async (req, res) => {
  const handle = String(req.params.handle || "").slice(0, 40);
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const text = String(req.body?.text || "").replace(/\r\n?/g, "\n").trim().slice(0, 600);
  const order = shop.cleanId(req.body?.order);
  if (!me || !text) return res.status(400).json({ error: "no" });

  const out = await change((b) => {
    const who = b.people.find((p) => p.handle === handle);
    if (!who) return { error: "gone" };
    let c = b.chats.find((x) => x.shop === handle && x.by === me);
    const line = { who: "buyer", text, at: new Date().toISOString(), order };
    if (!c) {
      c = { id: shop.newId(), shop: handle, by: me, at: line.at, last: line.at,
        lines: [line], seenShop: 0, seenBuyer: 1 };
      b.chats.push(c);
    } else {
      c.lines.push(line);
      if (c.lines.length > 100) c.lines = c.lines.slice(-100);
      c.last = line.at;
      c.seenBuyer = c.lines.length;
    }
    return { ok: true, id: c.id, lines: c.lines, tell: who.by };
  });
  if (out?.error) return res.status(404).json({ error: out.error });
  res.status(201).json({ ok: true, id: out.id, lines: out.lines });
  /* The shopkeeper, told somebody is asking. Same channel an order uses. */
  if (out.tell) tellThem(out.tell).catch(() => {});
});

/** THE SHOPKEEPER'S SIDE. Every thread on her shop, newest first, with the
 *  count of what she has not read. */
app.get("/api/mine/chats", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
  if (!me) return res.json({ ok: true, chats: [] });
  const board = await store.load(FILE);
  const mine = board.people.find((p) => p.by === me);
  if (!mine) return res.json({ ok: true, chats: [] });
  const rows = board.chats
    .filter((c) => c.shop === mine.handle)
    .sort((a, b) => String(b.last || "").localeCompare(String(a.last || "")))
    .slice(0, 100)
    .map((c) => ({
      id: c.id, last: c.last,
      unread: Math.max(0, c.lines.length - c.seenShop),
      /* The last thing said, which is how anybody picks a thread out of a
         list — not an id and not a name she does not have. */
      tail: c.lines[c.lines.length - 1]?.text || "",
      who: c.lines[c.lines.length - 1]?.who || "",
    }));
  res.json({ ok: true, chats: rows });
});

app.get("/api/mine/chat/:id", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
  const id = shop.cleanId(req.params.id);
  if (!me || !id) return res.status(404).json({ error: "gone" });
  const board = await store.load(FILE);
  const mine = board.people.find((p) => p.by === me);
  const c = board.chats.find((x) => x.id === id);
  if (!mine || !c || c.shop !== mine.handle) return res.status(404).json({ error: "gone" });
  if (c.seenShop < c.lines.length) {
    change((b) => {
      const row = b.chats.find((x) => x.id === id);
      if (row) row.seenShop = row.lines.length;
      return { ok: true };
    }).catch(() => {});
  }
  res.json({ ok: true, id: c.id, lines: c.lines });
});

app.post("/api/mine/chat/:id", express.json({ limit: "2kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const id = shop.cleanId(req.params.id);
  const text = String(req.body?.text || "").replace(/\r\n?/g, "\n").trim().slice(0, 600);
  if (!me || !id || !text) return res.status(400).json({ error: "no" });
  const out = await change((b) => {
    const mine = b.people.find((p) => p.by === me);
    const c = b.chats.find((x) => x.id === id);
    if (!mine || !c || c.shop !== mine.handle) return { error: "gone" };
    c.lines.push({ who: "shop", text, at: new Date().toISOString(), order: "" });
    if (c.lines.length > 100) c.lines = c.lines.slice(-100);
    c.last = c.lines[c.lines.length - 1].at;
    c.seenShop = c.lines.length;
    return { ok: true, lines: c.lines };
  });
  if (out?.error) return res.status(404).json({ error: out.error });
  res.json({ ok: true, lines: out.lines });
});

/** THIS MONTH'S BOARD, AND WHO IS ON TOP OF IT.
 *
 *  RANKED ON WHAT SHE SOLD. It was new buyers first, on the argument that
 *  money rewards whoever already had the biggest friends list — Tom's call
 *  is revenue, and it is the simpler promise: the bonus goes to whoever
 *  brought in the most. New buyers stay beside it, because a month spent
 *  selling more to the same four people is a month that looks good on this
 *  board and is not growth.
 *
 *  THE MONTH IS CHINA'S. Every representative is in mainland China, so a
 *  month that turns over at midnight UTC ends in the middle of their
 *  afternoon and a sale made on the 1st lands in the wrong month. +08:00.
 *
 *  A buyer is new to a SHOP, not to the board: two representatives selling
 *  to the same person have each done the work of persuading her.
 */
function monthCN(at) {
  /* Shifted into +08:00 before the year and month are read off it. */
  const t = new Date(at);
  if (Number.isNaN(t.getTime())) return "";
  const cn = new Date(t.getTime() + 8 * 3600 * 1000);
  return cn.toISOString().slice(0, 7);
}

app.get("/api/mine/top", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
  const board = await store.load(FILE);
  const mine = me ? board.people.find((p) => p.by === me) : null;
  const now = monthCN(new Date().toISOString());

  /* Who had already bought from this shop before this month started. */
  const before = new Map();
  for (const o of board.orders) {
    if (o.off || !o.paid || !o.shop || !o.by) continue;
    if (monthCN(o.at) >= now) continue;
    if (!before.has(o.shop)) before.set(o.shop, new Set());
    before.get(o.shop).add(o.by);
  }

  const by = new Map();
  for (const o of board.orders) {
    if (o.off || !o.paid || !o.shop || monthCN(o.at) !== now) continue;
    const row = by.get(o.shop)
      || { shop: o.shop, orders: 0, sold: 0, fresh: new Set(), seen: new Set() };
    row.orders += 1;
    row.sold += shop.orderTotal(o);
    if (o.by) {
      row.seen.add(o.by);
      if (!before.get(o.shop)?.has(o.by)) row.fresh.add(o.by);
    }
    by.set(o.shop, row);
  }

  const rows = [...by.values()]
    .map((r) => ({ shop: r.shop, orders: r.orders, buyers: r.fresh.size,
      soldFen: r.sold, sold: store.fromMinor(r.sold, "cny") }))
    /* Money, then new buyers, then orders — a tie broken by nothing looks
       to the person below it like the board cannot count. */
    .sort((a, b) => b.soldFen - a.soldFen || b.buyers - a.buyers || b.orders - a.orders)
    .slice(0, 20)
    .map((r, i) => ({ ...r, rank: i + 1, soldFen: undefined,
      /* Their own shop's name where they have set one, because a handle is
         not what anybody calls anybody. */
      name: board.people.find((p) => p.handle === r.shop)?.shop?.name || r.shop,
      you: Boolean(mine && r.shop === mine.handle) }));

  res.json({ ok: true, month: now, rows });
});

/** 提现 — SHE ASKS FOR HER MONEY, AND THE ASK IS REAL.
 *
 *  The transfer is still made by hand (see /api/admin/pay-list: Airwallex
 *  will not take a yuan beneficiary yet), but nothing about this button is
 *  pretend. She taps it, the board records what she asked for and when, and
 *  it comes out at the top of the list the money is sent from. A button
 *  that does nothing would be worse than no button; this one does the only
 *  part a board can do.
 *
 *  ONE AT A TIME. A second request while the first is unpaid is the same
 *  money asked for twice, and two rows for one transfer is how somebody
 *  gets paid twice or not at all.
 */
app.post("/api/mine/cashout", express.json({ limit: "1kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  if (!me) return res.status(400).json({ error: "no" });
  const out = await change((b) => {
    const mine = b.people.find((p) => p.by === me);
    if (!mine) return { error: "gone" };
    /* Nowhere to send it is not a refusal, it is the next screen. */
    if (!mine.payout) return { error: "nocard" };
    if (b.cashouts.some((c) => c.who === mine.handle && !c.paid)) {
      return { error: "already" };
    }
    const fen = b.orders
      .filter((o) => !o.off && o.paid && o.cut && !o.cutPaid && o.shop === mine.handle)
      .reduce((n, o) => n + o.cut, 0);
    if (!fen) return { error: "nothing" };
    b.cashouts.push({ id: shop.newId(), who: mine.handle, fen,
      at: new Date().toISOString() });
    return { ok: true, amount: store.fromMinor(fen, "cny") };
  });
  if (out?.error) {
    return res.status(out.error === "gone" ? 404 : 400).json(out);
  }
  res.status(201).json({ ok: true, amount: out.amount });
});

/** THE ASSISTANT, ON OR OFF, BY THE PERSON WHOSE SHOP IT IS.
 *
 *  Not an admin target. Whether a machine answers her buyers in her name is
 *  hers to decide at the moment she decides it — a switch she has to message
 *  somebody to flip is a switch that stays wherever it was left. */
app.post("/api/mine/ai", express.json({ limit: "1kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  if (!me) return res.status(400).json({ error: "no" });
  const on = Boolean(req.body?.on);
  const out = await change((b) => {
    const mine = b.people.find((p) => p.by === me);
    if (!mine) return { error: "gone" };
    mine.shop = { ...(mine.shop || {}), ai: on };
    return { ok: true, ai: on };
  });
  if (out?.error) return res.status(404).json(out);
  res.json({ ok: true, ai: out.ai });
});

/** HER OWN ORDERS, AND STILL NO ACCOUNT.
 *
 *  One order was one link, and a link lost in a WeChat chat took the order
 *  with it — so she asks the person who sold it to her, who has no more idea
 *  than she does. Every shop she has ever used has 我的订单 and she will
 *  look for it here.
 *
 *  The browser is the whole of her identity (see `by` on an order), which is
 *  the same bargain as the rest of this: no account, and therefore nothing to
 *  recover on a new phone. Said on the page rather than discovered.
 */
app.get("/api/orders", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
  if (!me) return res.json({ ok: true, orders: [] });
  const board = await store.load(FILE);
  const mine = board.orders
    .filter((o) => o.by && o.by === me && !o.off)
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))
    .slice(0, 50)
    .map((o) => ({
      id: o.id, at: o.at, shop: o.shop,
      state: shop.orderState(o),
      total: store.fromMinor(shop.orderTotal(o), "cny"),
      /* The first thing in it and how many things there are — which is how
         she recognises an order, not by twenty characters of id. */
      first: o.lines[0]?.name || "",
      n: o.lines.reduce((n, l) => n + l.n, 0),
    }));
  res.json({ ok: true, orders: mine });
});

/** PAYING FOR ONE, with the code — the same rails as a payment request and
 *  the same four things that have to be true (see dealioWays): a provider
 *  that can draw a code and ask about it later, the shop's own account, yuan,
 *  and one of the two wallets. An order is always in yuan, so the currency
 *  question does not arise.
 *
 *  THE MONEY GOES TO THE ONE ACCOUNT, as everywhere else here: the seller is
 *  whoever holds the keys, the storefront earns a commission out of it, and
 *  nobody else's money passes through. That is what makes this an ordinary
 *  shop rather than a payment business.
 */
app.post("/api/order/:id/pay", express.json({ limit: "1kb" }), async (req, res) => {
  const id = shop.cleanId(req.params.id);
  const method = String(req.body?.method || "wechat");
  if (!id || !["wechat", "alipay"].includes(method)) return res.status(400).json({ error: "no" });
  const p = dealioQr();
  if (!p) return res.status(400).json({ error: "off" });

  const board = await store.load(FILE);
  const o = board.orders.find((x) => x.id === id);
  if (!o || o.off) return res.status(404).json({ error: "gone" });
  if (o.paid) return res.status(400).json({ error: "already" });

  const total = shop.orderTotal(o);
  if (!total) return res.status(400).json({ error: "amount" });
  try {
    const r = await p.qrPay({
      amount: total, currency: "CNY", method,
      /* What she sees beside the amount in her own wallet: the first thing
         in the order, which is what she remembers ordering. */
      reference: o.lines[0]?.name || "",
    });
    if (!r.qr) return res.status(502).json({ error: "qr" });
    const drawn = qrBits(r.qr);
    const png = await qrPng(r.qr);
    await change((b) => {
      const row = b.orders.find((x) => x.id === id);
      if (row) row.pay = { ref: r.id, how: method, at: new Date().toISOString() };
      return { ok: true };
    });
    res.json({ ok: true, how: method, amount: store.fromMinor(total, "cny"),
      qr: { size: drawn.size, bits: drawn.bits, png } });
  } catch (err) {
    console.error("order qr:", err.message);
    res.status(502).json({ error: "qr" });
  }
});

/** DID SHE PAY? The same witness a request has, for the same reason: she
 *  pays inside a wallet and may never come back to this page. */
app.get("/api/order/:id/check", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const id = shop.cleanId(req.params.id);
  if (!id) return res.status(404).json({ error: "gone" });
  const board = await store.load(FILE);
  const o = board.orders.find((x) => x.id === id);
  if (!o) return res.status(404).json({ error: "gone" });
  if (o.paid) return res.json({ ok: true, state: shop.orderState(o) });

  const p = dealioQr();
  if (!p || !o.pay?.ref) return res.json({ ok: true, state: shop.orderState(o) });
  let status = "";
  try {
    const r = await p.intentStatus(o.pay.ref);
    status = String(r.status || "");
  } catch (err) {
    console.error("order check:", err.message);
    return res.json({ ok: true, state: shop.orderState(o) });
  }
  if (status !== "SUCCEEDED") return res.json({ ok: true, state: shop.orderState(o) });

  const out = await change((b) => {
    const row = b.orders.find((x) => x.id === id);
    if (!row || row.paid) return { ok: true };
    row.paid = true;
    /* The storefront, told they have a sale to follow up, and the seller,
       told there is a parcel to send. */
    const seller = b.people.find((x) => x.handle === row.shop);
    return { ok: true, tell: seller?.by || "" };
  });
  if (out?.tell) tellThem(out.tell).catch(() => {});
  res.json({ ok: true, state: "toShip" });
  /* And the storefront's share, on its way before she has put her phone
     down. Not awaited: she is watching her own order turn 待发货, and a
     bank's afternoon is not something she should wait for. */
  payCut(id).catch((err) => console.error("cut:", err.message));
});

/* ---- WHERE A STOREFRONT'S COMMISSION LANDS -------------------------------
 *
 * One form, once, by the person themselves — behind the door, because a
 * storefront belongs to a member and a member is signed in. Their bank
 * details go straight to Airwallex and what comes back is an id and a
 * label; nothing of the account is kept here. See the note on `payout` in
 * lib/store.js.
 */
app.get(["/paid", "/paid/"], (req, res, next) => page("paid.html", req, res, next));

/** What this person has said so far, which is either a label or nothing. */
app.get("/api/paid", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
  if (!me) return res.json({ ok: true, on: false });
  const board = await store.load(FILE);
  const mine = board.people.find((p) => p.by === me);
  const rows = board.orders.filter((o) => o.paid && !o.off && o.shop && o.shop === mine?.handle);
  res.json({
    ok: true,
    /* Whether there is a shop behind this at all. NOT whether the money can
       be sent by itself: a representative in China gives their card so they
       can be paid, and whether that happens on a schedule or by hand at the
       end of the month is this board's problem, not theirs. */
    on: Boolean(dealioQr()),
    handle: mine?.handle || "",
    payout: mine?.payout
      ? { label: mine.payout.label || (mine.payout.bank || ""), name: mine.payout.name,
          last4: mine.payout.last4 || "" }
      : null,
    owed: store.fromMinor(rows.filter((o) => !o.cutPaid).reduce((n, o) => n + (o.cut || 0), 0), "cny"),
    /* The fen as well as the ¥, because "¥0" is a true sentence and a box
       that says it is a box nobody needed to read. */
    owedFen: rows.filter((o) => !o.cutPaid).reduce((n, o) => n + (o.cut || 0), 0),
    sold: rows.length,
  });
});

/** THE FORM: A NAME, A BANK, A CARD NUMBER.
 *
 *  Everybody running a storefront is in mainland China, so this is a
 *  Chinese bank card and not an Australian account — see the two shapes on
 *  `payout` in lib/store.js, and note 2 in providers/airwallex.js for why
 *  there is no beneficiary to make out of it yet.
 *
 *  It tries anyway, every time. The day Airwallex takes a yuan beneficiary
 *  this route starts keeping an id instead of a sealed number, with nobody
 *  filling anything in again. */
app.post("/api/paid", express.json({ limit: "2kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  if (!me) return res.status(400).json({ error: "no" });

  const name = String(req.body?.name || "").trim().slice(0, 60);
  const bank = String(req.body?.bank || "").trim().slice(0, 40);
  const card = String(req.body?.card || "").replace(/\D/g, "");
  if (!name) return res.status(400).json({ error: "name" });
  if (!bank) return res.status(400).json({ error: "bank" });
  /* A UnionPay card is 16 to 19 digits; some older savings books are 12.
     Wider than that and it is a typed-in phone number. */
  if (card.length < 12 || card.length > 19) return res.status(400).json({ error: "card" });

  /* If the provider will take it, the number leaves and never comes back —
     an id and a label instead, which is the shape the rule in store.js
     wants. It refuses today, and that is not an error to show anybody. */
  let made = null;
  const p = WALLET.on ? WALLET.provider : null;
  if (p && typeof p.createBeneficiary === "function") {
    try {
      made = await p.createBeneficiary({
        currency: "CNY", country: "CN",
        details: { accountName: name, accountNumber: card, bankName: bank },
      });
    } catch (err) {
      if (err?.code !== "provider_not_ready") console.error("beneficiary:", err.message);
    }
  }

  const row = made?.beneficiaryId
    ? { id: made.beneficiaryId, label: made.label || bank, name, at: new Date().toISOString() }
    : { cn: true, name, bank, last4: card.slice(-4),
        sealed: sealed.seal(DIR, card), at: new Date().toISOString() };

  const out = await change((b) => {
    const mine = b.people.find((x) => x.by === me);
    if (!mine) return { error: "gone" };
    mine.payout = row;
    return { ok: true, bank: row.label || row.bank, last4: row.last4 || "", name };
  });
  if (out?.error) return res.status(400).json(out);
  res.json({ ok: true, ...out });
});

/* ---- THE COMMISSION, ACTUALLY SENT ---------------------------------------
 *
 * The money arrives as yuan in one Airwallex account. A storefront in
 * Australia is owed a share of it in dollars. So three calls, in this
 * order: a quote for the yuan, the conversion, and a local transfer to the
 * beneficiary they made on /paid.
 *
 * IMMEDIATELY, WHICH TOM CHOSE KNOWING THE COST. Holding the payout until a
 * buyer confirms delivery is the strongest protection there is against a
 * storefront that takes a commission on something never sent — and he asked
 * for immediate anyway, because the people selling are people he knows.
 * Said here because the next person reading this will wonder.
 *
 * A FAILURE LEAVES THE ROW ALONE. The commonest one is money that has not
 * settled into the account yet: the payment reads SUCCEEDED before the funds
 * are there to send on. Nothing is marked paid unless the transfer was
 * accepted, so `make pay-owed` sweeps the rest later and a row can never be
 * paid twice.
 */
async function payCut(orderId) {
  const p = WALLET.on ? WALLET.provider : null;
  if (!p || typeof p.payout !== "function" || typeof p.quote !== "function") return "";

  const board = await store.load(FILE);
  const o = board.orders.find((x) => x.id === orderId);
  if (!o || o.off || !o.paid || !o.cut || o.cutPaid) return "";
  const who = board.people.find((x) => x.handle === o.shop);
  /* A Chinese card is not a beneficiary yet, so there is nothing to send to
     and nothing has gone wrong — it is a row for `make pay-list`, said as
     its own word so the sweep does not report it as a failure. */
  if (who?.payout?.cn) return "byhand";
  if (!who?.payout?.id) return "nowhere";

  try {
    /* Sold as yuan, bought as dollars: how many dollars this many yuan
       makes, at the rate right now. The cut is in fen and comes back in
       cents, both integers, because money here is never a float. */
    const quote = await p.quote({ sell: "CNY", buy: "AUD", sellAmount: o.cut, validSeconds: 900 });
    const aud = Number(quote?.buyAmount);
    if (!Number.isInteger(aud) || aud <= 0) return "quote";
    await p.convert({ quoteId: quote.quoteId, sell: "CNY", buy: "AUD" });

    const sent = await p.payout({
      amount: aud, currency: "AUD", beneficiaryId: who.payout.id,
      /* What lands on their bank statement. Their own shop's name and the
         order, so a line on a statement can be matched to a sale. */
      reference: (o.shop || "Dealio") + " " + o.id.slice(0, 8),
    });
    if (!sent?.payoutId) return "refused";

    await change((b) => {
      const row = b.orders.find((x) => x.id === orderId);
      if (row && !row.cutPaid) row.cutPaid = true;
      return { ok: true };
    });
    return "";
  } catch (err) {
    /* Airwallex's own sentence into the log — usually "insufficient funds",
       which is a wait rather than a fault. */
    console.error("cut payout:", err.message);
    return "failed";
  }
}

/** WHAT IS WAITING TO BE SENT, oldest first.
 *
 *  The seller's whole screen, and it is a terminal: the address as the
 *  courier needs it, the English names because a warehouse in Melbourne
 *  cannot pick from Chinese ones, and a number per row so nothing has to be
 *  copied. */
app.get("/api/admin/orders", admin, async (req, res) => {
  const want = String(req.query.state || "toShip");
  const board = await store.load(FILE);
  const names = new Map(board.products.map((p) => [p.id, p.en || p.name]));
  const rows = board.orders
    .filter((o) => !o.off && (want === "all" || shop.orderState(o) === want))
    .map((o) => ({
      id: o.id, at: o.at, shop: o.shop, state: shop.orderState(o),
      total: store.fromMinor(shop.orderTotal(o), "cny"),
      cut: o.cut ? store.fromMinor(o.cut, "cny") : "",
      ship: o.ship || null,
      tracking: o.sent?.tracking || "",
      lines: o.lines.map((l) => ({ n: l.n, name: l.name, en: names.get(l.id) || "" })),
    }));
  res.json({ ok: true, orders: rows });
});

/** IT HAS GONE. A courier and a number, and the buyer's page stops asking
 *  her to wait and starts telling her where it is. */
app.post("/api/admin/ship", admin, express.json({ limit: "2kb" }), async (req, res) => {
  const id = shop.cleanId(String(req.body?.id || ""));
  const tracking = String(req.body?.tracking || "").trim().slice(0, 40);
  if (!id || !tracking) return res.status(400).json({ error: "no" });
  const out = await change((b) => {
    const o = b.orders.find((x) => x.id === id);
    if (!o) return { error: "gone" };
    if (!o.paid) return { error: "unpaid" };
    o.sent = { tracking, courier: String(req.body?.courier || "").trim().slice(0, 40),
      at: new Date().toISOString() };
    return { ok: true, to: o.ship?.name || "", by: o.by };
  });
  if (out?.error) return res.status(400).json(out);
  res.json({ ok: true, to: out.to });
});

/** SEND WHAT IS OWED, or say why it could not go.
 *
 *  Everything a payout could not manage at the time — almost always money
 *  that had not settled into the account yet — swept in one command. Safe
 *  to run twice: a row that has been paid is skipped. */
app.post("/api/admin/pay-owed", admin, express.json({ limit: "1kb" }), async (req, res) => {
  const board = await store.load(FILE);
  const todo = board.orders
    .filter((o) => o.paid && !o.off && o.cut && !o.cutPaid && o.shop)
    .slice(0, 50);
  const out = [];
  for (const o of todo) {
    const why = await payCut(o.id);
    out.push({ shop: o.shop, amount: store.fromMinor(o.cut, "cny"), ok: !why, why });
  }
  res.json({ ok: true, tried: out });
});

/** THE PAYMENTS TO MAKE BY HAND, WITH THE CARD NUMBERS IN THEM.
 *
 *  Until Airwallex takes a yuan beneficiary this is how a representative is
 *  actually paid: one transfer each, off a list the board keeps straight.
 *  The numbers are unsealed here and nowhere else — this answers to the
 *  admin key, on the box, into his own terminal, and the page that collects
 *  them says the card is used for paying them and nothing else. */
app.get("/api/admin/pay-list", admin, async (req, res) => {
  res.set("Cache-Control", "no-store");
  const board = await store.load(FILE);
  const owed = new Map();
  for (const o of board.orders) {
    if (o.off || !o.paid || !o.cut || o.cutPaid || !o.shop) continue;
    owed.set(o.shop, (owed.get(o.shop) || 0) + o.cut);
  }
  /* WHOEVER ASKED COMES FIRST. Somebody who pressed 提现 is waiting on a
     screen that says it is being handled; somebody who has not is not
     waiting at all. */
  const asked = new Map(board.cashouts.filter((c) => !c.paid).map((c) => [c.who, c]));
  const rows = [...owed]
    .sort((a, b) => (asked.has(b[0]) - asked.has(a[0])) || b[1] - a[1])
    .map(([handle, fen]) => {
      const who = board.people.find((x) => x.handle === handle);
      const card = who?.payout?.cn ? sealed.unseal(DIR, who.payout.sealed) : "";
      return {
        shop: handle,
        amount: store.fromMinor(fen, "cny"),
        name: who?.payout?.name || "",
        bank: who?.payout?.bank || who?.payout?.label || "",
        card,
        /* No card and no id means they have not filled the form in. That is
           a message to send, not a payment to make. */
        ready: Boolean(card || who?.payout?.id),
        asked: asked.get(handle)?.at || "",
      };
    });
  res.json({ ok: true, rows });
});

/** THAT ONE IS SENT.
 *
 *  A list that cannot be crossed off prints the same transfer every week
 *  until somebody sends it twice. So the hand-made payment is marked here,
 *  against every order the cut was owed on, in one go. */
app.post("/api/admin/paid-out", admin, express.json({ limit: "1kb" }), async (req, res) => {
  const who = String(req.body?.who || "").trim();
  if (!who) return res.status(400).json({ error: "who" });
  const out = await change((b) => {
    if (!b.people.some((p) => p.handle === who)) return { error: "gone" };
    /* Her request is answered by the same act that pays it — a row left
       open after the money went is a screen still saying 处理中. */
    for (const c of b.cashouts) {
      if (c.who === who && !c.paid) c.paid = new Date().toISOString();
    }
    let n = 0, fen = 0;
    for (const o of b.orders) {
      if (o.off || !o.paid || !o.cut || o.cutPaid || o.shop !== who) continue;
      o.cutPaid = true;
      n += 1;
      fen += o.cut;
    }
    return { ok: true, n, fen };
  });
  if (out?.error) return res.status(404).json({ error: "not on this board: " + who });
  res.json({ ok: true, n: out.n, amount: store.fromMinor(out.fen, "cny") });
});

/** WHAT EACH STOREFRONT HAS EARNED, and what is still owed.
 *
 *  A commission becomes owed when the money arrives, not when the order is
 *  made — nobody is paid out of a cart. Nothing here pays anybody: until
 *  Airwallex confirms this account can send a transfer at all (make
 *  payout-try) this is a list, and a list that is honest about being one is
 *  better than a button that fails on somebody's phone. */
app.get("/api/admin/owed", admin, async (req, res) => {
  const board = await store.load(FILE);
  const by = new Map();
  for (const o of board.orders) {
    if (o.off || !o.paid || !o.cut || !o.shop) continue;
    const row = by.get(o.shop) || { shop: o.shop, owed: 0, paidOut: 0, orders: 0 };
    row.orders += 1;
    if (o.cutPaid) row.paidOut += o.cut; else row.owed += o.cut;
    by.set(o.shop, row);
  }
  const rows = [...by.values()]
    .sort((a, b) => b.owed - a.owed)
    .map((r) => ({ shop: r.shop, orders: r.orders,
      owed: store.fromMinor(r.owed, "cny"), owedFen: r.owed,
      paidOut: r.paidOut ? store.fromMinor(r.paidOut, "cny") : "" }));
  res.json({ ok: true, pct: SHOP_CUT_PCT, rows });
});

/* A PICTURE, FETCHED ONTO THIS BOARD RATHER THAN LINKED.
 *
 * Nothing sells in China off a grey square — her whole scan of a shop page
 * is photographs and prices, in that order. The pictures exist already, on
 * a brand's site or a supplier's, so the cheapest way to get them is a URL.
 *
 * BUT NOT AS A URL. A page whose images come from an Australian host is a
 * page that loads slowly in Shanghai and sometimes not at all, and a link
 * that rots takes the shop down with it. So the bytes are fetched once,
 * stored here like every other photograph on this board, and served off our
 * own domain by an id nobody can guess.
 *
 * WHAT IT REFUSES: anything that is not http(s), anything on this machine's
 * own network — an admin-only route is still a route that fetches what it is
 * told to — anything that is not an image, and anything over the same
 * ceiling every other upload has. Ten seconds and it gives up.
 */
const PRIVATE_HOST = /^(localhost$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|\[?::1\]?$|.*\.internal$|.*\.local$)/i;

async function fetchPhoto(raw) {
  const url = String(raw || "").trim();
  if (!url) return "";
  /* Already one of ours — a re-run of the same command should not fetch the
     same picture twice. */
  if (url.startsWith("/api/public-media?id=")) return url;
  let u;
  try { u = new URL(url); } catch { return ""; }
  if (!/^https?:$/.test(u.protocol)) return "";
  if (PRIVATE_HOST.test(u.hostname)) return "";
  const res = await fetch(u, {
    redirect: "follow",
    signal: AbortSignal.timeout ? AbortSignal.timeout(10_000) : undefined,
  });
  if (!res.ok) return "";
  const type = String(res.headers.get("content-type") || "").split(";")[0].trim();
  if (!KINDS.has(type) || !type.startsWith("image/")) return "";
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length || buf.length > MEDIA_MAX) return "";
  const id = await putMedia(buf, type);
  return id ? "/api/public-media?id=" + id : "";
}

/** HOW A BUYER REACHES THE PERSON WHO SOLD IT TO HER.
 *
 *  A WeChat id she can search for, a code she can long press, or both. The
 *  code is fetched onto this board like every other picture here — a link to
 *  somebody's own host is slow in Shanghai and rots without warning, and a
 *  contact code that has rotted is a shop nobody can reach. */
app.post("/api/admin/shop-contact", admin, express.json({ limit: "2kb" }), async (req, res) => {
  const who = String(req.body?.who || "").trim();
  if (!who) return res.status(400).json({ error: "who" });
  let qr = "";
  if (req.body?.qr) {
    try { qr = await fetchPhoto(req.body.qr); } catch (err) {
      console.error("contact qr:", err.message);
    }
    if (!qr) return res.status(400).json({ error: "photo" });
  }
  const out = await change((b) => {
    const p = b.people.find((x) => x.handle === who);
    if (!p) return { error: "gone" };
    const now = p.shop || {};
    p.shop = {
      ...now,
      wechat: req.body?.wechat !== undefined
        ? String(req.body.wechat).trim().slice(0, 40) : (now.wechat || ""),
      qr: qr || now.qr || "",
      ai: req.body?.ai !== undefined ? Boolean(req.body.ai) : Boolean(now.ai),
    };
    return { ok: true, wechat: p.shop.wechat, qr: Boolean(p.shop.qr), ai: p.shop.ai };
  });
  if (out?.error) return res.status(404).json({ error: "not on this board: " + who });
  res.json({ ok: true, ...out });
});

/** WHAT A SHOP ROW ACTUALLY HOLDS, said plainly.
 *
 *  The banner went missing and nothing in the writes could have dropped it
 *  — every one of them spreads the row. Which leaves the picture itself,
 *  and there was no way to ask. Now there is: this says what is stored and
 *  whether the file behind it is still on disk, which are two different
 *  questions and were being answered as one. */
app.get("/api/admin/shop-check", admin, async (req, res) => {
  res.set("Cache-Control", "no-store");
  const who = String(req.query?.who || "").trim();
  const board = await store.load(FILE);
  const p = board.people.find((x) => x.handle === who);
  if (!p) return res.status(404).json({ error: "not on this board: " + who });
  /* findMedia, because the file on disk carries an extension the address
     does not — looking for the bare id finds nothing and would have
     reported every picture on this board as missing. */
  const media = async (url) => {
    const id = String(url || "").split("id=")[1] || "";
    if (!id) return url ? "not one of ours" : "";
    return (await findMedia(id)) ? "on disk" : "MISSING FROM DISK";
  };
  res.json({
    ok: true, handle: p.handle,
    name: p.shop?.name || "", wechat: p.shop?.wechat || "",
    banner: p.shop?.banner || "", bannerFile: await media(p.shop?.banner),
    photo: p.photo || "", photoFile: await media(p.photo),
    qr: p.shop?.qr || "", qrFile: await media(p.shop?.qr),
    ai: Boolean(p.shop?.ai), payout: Boolean(p.payout),
  });
});

/** A SHOP'S NAME AND THE PICTURE ACROSS THE TOP OF IT. */
app.post("/api/admin/shop-brand", admin, express.json({ limit: "2kb" }), async (req, res) => {
  const who = String(req.body?.who || "").trim();
  if (!who) return res.status(400).json({ error: "who" });
  let banner = "";
  if (req.body?.banner) {
    try { banner = await fetchPhoto(req.body.banner); } catch (err) {
      console.error("banner:", err.message);
    }
    if (!banner) return res.status(400).json({ error: "photo" });
  }
  const out = await change((b) => {
    const p = b.people.find((x) => x.handle === who);
    if (!p) return { error: "gone" };
    const now = p.shop || {};
    /* Spread first: `shop` holds the contact and the assistant switch too,
       and a rename that silently dropped somebody's WeChat code would be
       found by a buyer rather than by us. */
    p.shop = {
      ...now,
      name: req.body?.name !== undefined ? String(req.body.name).trim().slice(0, 40) : (now.name || ""),
      banner: banner || now.banner || "",
      story: req.body?.story !== undefined ? String(req.body.story).trim().slice(0, 400) : (now.story || ""),
    };
    return { ok: true, name: p.shop.name, banner: Boolean(p.shop.banner), story: Boolean(p.shop.story) };
  });
  if (out?.error) return res.status(404).json({ error: "not on this board: " + who });
  res.json({ ok: true, ...out });
});

/** WHAT KIND OF PICTURE THIS IS, READ OFF THE FIRST FEW BYTES.
 *
 *  A file arriving down a pipe has no content-type and the name it had on
 *  somebody's desktop is not evidence — .jpg on a screenshot that is really
 *  a PNG is the commonest thing in the world. So the bytes say. */
function sniffImage(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return "";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 4).toString("latin1") === "GIF8") return "image/gif";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF"
    && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return "";
}

/** THE SAME PICTURE, HANDED OVER AS A FILE RATHER THAN A LINK.
 *
 *  The picture worth putting across the top of a shop is the one already on
 *  his machine — the artwork from the old WeChat store, a photograph taken
 *  this morning. Sending him off to upload it somewhere first, for an
 *  address to paste back, is a step done by hand with an account and a
 *  screen in the middle of it. So the bytes come up the same pipe as the
 *  command:  make shop-banner WHO="Tom" < dad.png
 *
 *  The name is untouched — a new picture is not a rename. */
app.post("/api/admin/shop-banner", admin,
  express.raw({ type: () => true, limit: MEDIA_MAX }), async (req, res) => {
  const who = String(req.query?.who || "").trim();
  if (!who) return res.status(400).json({ error: "who" });
  const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (!buf.length) return res.status(400).json({ error: "empty" });
  const type = sniffImage(buf);
  if (!type) return res.status(400).json({ error: "kind" });
  const id = await putMedia(buf, type);
  if (!id) return res.status(500).json({ error: "store" });
  const out = await change((b) => {
    const p = b.people.find((x) => x.handle === who);
    if (!p) return { error: "gone" };
    p.shop = { ...(p.shop || {}), banner: "/api/public-media?id=" + id };
    return { ok: true, name: p.shop.name, bytes: buf.length, kind: type };
  });
  if (out?.error) return res.status(404).json({ error: "not on this board: " + who });
  res.json({ ok: true, ...out });
});

/** THE CATALOGUE, NUMBERED — so a photograph can be attached to row 2
 *  rather than to twenty characters copied out of a terminal. */
app.get("/api/admin/products", admin, async (req, res) => {
  const board = await store.load(FILE);
  res.json({
    ok: true,
    products: board.products.map((p) => ({
      id: p.id, name: p.name, en: p.en, unit: p.unit, kind: p.kind,
      price: store.fromMinor(p.price, "cny"),
      photo: Boolean(p.photo), out: Boolean(p.out), off: Boolean(p.off),
    })),
  });
});

/** A PICTURE ON ONE OF THEM, or taking it out of the shop. */
app.post("/api/admin/product/:id", admin, express.json({ limit: "2kb" }), async (req, res) => {
  const id = shop.cleanId(req.params.id);
  if (!id) return res.status(400).json({ error: "no" });
  let photo = "";
  if (req.body?.photo) {
    try { photo = await fetchPhoto(req.body.photo); } catch (err) {
      console.error("product photo:", err.message);
      return res.status(400).json({ error: "photo" });
    }
    if (!photo) return res.status(400).json({ error: "photo" });
  }
  const out = await change((b) => {
    const p = b.products.find((x) => x.id === id);
    if (!p) return { error: "gone" };
    if (photo) p.photo = photo;
    if (req.body?.out !== undefined) p.out = Boolean(req.body.out);
    if (req.body?.off !== undefined) p.off = Boolean(req.body.off);
    if (req.body?.kind !== undefined) p.kind = String(req.body.kind).trim().slice(0, 20);
    return { ok: true, name: p.name };
  });
  if (out?.error) return res.status(404).json(out);
  res.json({ ok: true, name: out.name, photo: Boolean(photo) });
});

/** A PRODUCT'S PICTURE, FROM A FILE RATHER THAN A LINK.
 *
 *  Same reason as the shop banner: the photograph of the tin is on his
 *  machine, or it is a screenshot out of the old store, and sending him off
 *  to upload it somewhere for an address to paste back is two accounts in
 *  the middle of a one-line job. `make product-photo N=1 < tin.jpg`.
 *
 *  Her whole scan of a shop page is photographs and prices, in that order,
 *  so this is the difference between a catalogue and a list. */
app.post("/api/admin/product-photo", admin,
  express.raw({ type: () => true, limit: MEDIA_MAX }), async (req, res) => {
  const id = shop.cleanId(req.query?.id);
  if (!id) return res.status(400).json({ error: "id" });
  const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (!buf.length) return res.status(400).json({ error: "empty" });
  const type = sniffImage(buf);
  if (!type) return res.status(400).json({ error: "kind" });
  const mid = await putMedia(buf, type);
  if (!mid) return res.status(500).json({ error: "store" });
  const out = await change((b) => {
    const p = b.products.find((x) => x.id === id);
    if (!p) return { error: "gone" };
    p.photo = "/api/public-media?id=" + mid;
    return { ok: true, name: p.name, bytes: buf.length, kind: type };
  });
  if (out?.error) return res.status(404).json(out);
  res.json({ ok: true, ...out });
});

/** ADDING SOMETHING TO THE CATALOGUE, from a terminal. The shop has one
 *  seller and he does not need a screen to type a price into. */
app.post("/api/admin/product", admin, express.json({ limit: "4kb" }), async (req, res) => {
  const price = store.toMinor(String(req.body?.price || ""), "cny");
  if (!price) return res.status(400).json({ error: "price" });
  /* Fetched before the row is written, so a picture that cannot be had is a
     refusal rather than a product with a broken square on it. */
  let photo = "";
  if (req.body?.photo) {
    try { photo = await fetchPhoto(req.body.photo); } catch (err) {
      console.error("product photo:", err.message);
    }
    if (!photo) return res.status(400).json({ error: "photo" });
  }
  const out = await change((board) => {
    const p = shop.cleanProduct({
      id: shop.newId(), at: new Date().toISOString(),
      name: req.body?.name, en: req.body?.en, unit: req.body?.unit,
      kind: req.body?.kind,
      photo, price,
    });
    if (!p) return { error: "bad" };
    board.products.push(p);
    return { ok: true, id: p.id, n: board.products.length };
  });
  if (out?.error) return res.status(400).json(out);
  res.json({ ok: true, id: out.id, n: out.n });
});

app.post("/api/admin/request", admin, express.json({ limit: "2kb" }), async (req, res) => {
  const who = String(req.body?.who || "").trim();
  const amount = String(req.body?.amount || "").trim();
  if (!who || !amount) return res.status(400).json({ error: "who and amount" });

  const out = await change((board) => {
    const mine = board.people.find((q) => q.handle === who);
    if (!mine) return { error: "not on this board: " + who };
    const q = request.cleanRequest({
      id: request.newRequestId(),
      by: mine.by,
      from: mine.handle,
      to: String(req.body?.to || ""),
      amount,
      cur: String(req.body?.cur || ""),
      what: String(req.body?.what || ""),
      when: String(req.body?.when || ""),
      at: new Date().toISOString(),
    });
    if (!q) return { error: "bad" };
    board.requests.push(q);
    /* HOW IT CAN BE PAID, said back rather than discovered on the phone.
       A payout account is no longer the only answer: a request that draws a
       WeChat or Alipay code needs nowhere for the money to land, and this
       said "cannot be paid" about one that could. */
    const ways = dealioWays(board, q);
    return { ok: true, id: q.id, ready: ways.length > 0 || Boolean(mine.payee),
      code: ways.length > 0 };
  });
  if (out?.error) return res.status(400).json(out);
  res.json({ ok: true, id: out.id, ready: out.ready, code: out.code,
    url: payLink(req, "/pay/" + out.id) });
});

/** CAN THIS BOARD TAKE A PAYMENT, AND SAY WHY NOT.
 *
 *  Tom asked "can the app do payments" and there was no way to answer it
 *  except by guessing: the code is built, the box is deployed, and whether it
 *  actually works turns on five environment variables and one Stripe setting
 *  that live where nobody can see them. A question about the running system
 *  that can only be answered by reading a commit is a question that will be
 *  answered wrong.
 *
 *  So it answers itself. Every line is a fact about this process or about the
 *  board file, and the last one is a verdict.
 *
 *  NO SECRETS COME OUT OF HERE. Whether a key is set, and which mode its
 *  prefix says it is in — never the key, never a fragment of one, never an
 *  account id belonging to a person. That rule is why this prints words
 *  rather than a dump of process.env.
 */
/** WHY WAS THAT REFUSED — asked of Stripe, for one request, in each method.
 *
 *  WHY THIS EXISTS. WeChat Pay was refused and the other two were never
 *  pressed, so the screen read as "none of the payments work" and the only
 *  record of the reason was one line in a container log. Three methods, three
 *  possible answers, and no way to see them without a phone and a guess.
 *
 *  It creates real checkout sessions and abandons them. That is deliberate:
 *  anything less is a different call from the one that fails. Nothing is
 *  charged — a session nobody completes expires — and nothing is written to
 *  the board.
 *
 *  STRIPE'S OWN SENTENCE COMES BACK HERE and nowhere else. The one reader is
 *  whoever holds the admin key, who can already see everything; a member gets
 *  a plain word, because Stripe's text names fields and accounts.
 */
app.post("/api/admin/pay-try", admin, express.json({ limit: "1kb" }), async (req, res) => {
  if (!stripe.configured()) return res.status(400).json({ error: "off" });
  const id = request.cleanId(String(req.body?.id || ""));
  if (!id) return res.status(400).json({ error: "id" });

  const board = await store.load(FILE);
  const q = board.requests.find((x) => x.id === id);
  if (!q) return res.status(404).json({ error: "gone" });
  if (!q.cur) return res.status(400).json({ error: "currency" });

  const asker = board.people.find((p) => p.by === q.by);
  const dest = (q.way || "in") === "out" ? (q.landed ? q.acct : "") : asker?.payee;
  if (!dest) return res.status(400).json({ error: "payee" });

  const want = String(req.body?.method || "");
  const methods = ["wechat", "alipay", "card"].includes(want)
    ? [want] : ["wechat", "alipay", "card"];

  const tried = [];
  for (const method of methods) {
    const out = await startCheckout({
      d: { plan: [{ label: q.what || q.from, amount: q.amount }], cur: q.cur, title: q.what },
      i: 0, method, payeeAcct: dest,
      ref: "q:" + q.id,
      done: backHere(req, "/pay/" + q.id),
    });
    tried.push({ method, ok: !out.error, error: out.error || "", detail: out.detail || "" });
  }
  res.json({ ok: true, amount: q.amount, cur: q.cur, to: q.to || "", tried });
});

app.get("/api/admin/pay", admin, async (req, res) => {
  const KEY = (process.env.BOARD_STRIPE_KEY || "").trim();
  /* The prefix, and only the prefix. sk_live_ and sk_test_ are the one thing
     worth knowing and the one thing that is not a secret. */
  const mode = KEY.startsWith("sk_live_") ? "live"
    : KEY.startsWith("sk_test_") ? "test"
    : KEY ? "unrecognised" : "";

  const board = await store.load(FILE);
  /* WHO COULD BE PAID THROUGH CONNECT AT ALL, by name.
     It was a count, on the principle that this command names nobody. That
     principle was about the people on the board and it does not apply here:
     the one reader of this is whoever runs it, who holds the admin key and
     can already see everything — and "1" left them with the next command
     half-typed and no idea whose name goes in it. Handles only, which are
     the names the operator types at every other target here. Never an
     account id. */
  const payees = board.people.filter((q) => q.payee).map((q) => q.handle).filter(Boolean);
  const deals = board.groups.filter((g) => g.deal?.plan?.length).length;
  /* Requests made and requests settled, because "did the one I just made
     actually land" is the question somebody testing this asks first, and the
     only place to see it was a page on a phone. */
  const asks = board.requests.length;
  const asksPaid = board.requests.filter(
    (q) => (q.said || []).some((x) => x.kind === "confirmed")).length;

  const why = [];
  if (!KEY) why.push("BOARD_STRIPE_KEY is not set");
  else if (mode === "unrecognised") why.push("BOARD_STRIPE_KEY is not an sk_ key");
  if (!STRIPE_PK) why.push("BOARD_STRIPE_PK is not set — the form cannot mount");
  if (!process.env.BOARD_STRIPE_VERSION) {
    why.push("BOARD_STRIPE_VERSION is not set — Accounts v2 refuses without it");
  }
  if (!FEE_SECRET) why.push("BOARD_DEAL_FEE_SECRET is not set — nothing flips a row to PAID");
  if (KEY && !payees.length) why.push("nobody has a payee account yet — Pay lands on \"not finished setting up\"");

  /* THE CODE RAILS, WHICH ARE A DIFFERENT QUESTION FROM STRIPE'S.
     Whether a WeChat or Alipay code can be drawn turns on three things that
     live where nobody can look: which provider is configured, whether a
     handle is named in BOARD_DEALIO_OWNER, and whether that handle is a
     person on this board. Half-set looks exactly like off from a phone —
     which is a morning already spent — so each half says so by name. */
  const codeOwner = DEALIO_OWNER
    ? board.people.find((q) => String(q.handle || "").trim().toLowerCase() === DEALIO_OWNER)
    : null;
  const codes = {
    on: Boolean(dealioQr() && codeOwner),
    provider: WALLET.on ? WALLET.provider.name : "",
    /* Sandbox or not, which decides whether the money is real. */
    sandbox: WALLET.on && WALLET.provider.name === "airwallex"
      ? process.env.BOARD_WALLET_AIRWALLEX_SANDBOX !== "0" : true,
    /* THE HANDLE AS THE BOARD SPELLS IT, not as it was typed into .env. The
       next thing anybody does with this line is paste it into `make ask`,
       which matches the handle exactly — so printing the lower-cased copy
       hands over a command that fails. */
    owner: codeOwner?.handle || DEALIO_OWNER,
    ownerOnBoard: Boolean(codeOwner),
    drawn: board.requests.filter((q) => q.pay?.ref).length,
    /* Whether a row can settle with nobody looking. Without it the money
       still arrives and the row still goes green — but only once somebody
       opens a page, which is the bottleneck a webhook exists to remove. */
    told: Boolean(String(process.env.BOARD_WALLET_AIRWALLEX_WEBHOOK_SECRET || "").trim()),
    /* Kept apart from Stripe's reasons. They are two different answers to
       two different questions and one list of them reads as one fault. */
    why: [],
  };
  if (!codes.on) {
    if (!WALLET.on) codes.why.push("BOARD_WALLET is not set — no provider, so no code can be drawn");
    else if (!dealioQr()) codes.why.push("the " + codes.provider + " provider cannot draw a code — it is not the one that does");
    else if (!DEALIO_OWNER) codes.why.push("BOARD_DEALIO_OWNER is not set — run: make dealio-me WHO=\"Tom\"");
    else codes.why.push("BOARD_DEALIO_OWNER is \"" + DEALIO_OWNER + "\" and nobody on this board has that handle");
  }

  res.json({
    ok: true,
    takesPayments: Boolean(KEY && STRIPE_PK && FEE_SECRET && payees.length),
    codes,
    mode,
    key: Boolean(KEY),
    publishable: Boolean(STRIPE_PK),
    /* The webhook's signing secret. Without it the board never hears that a
       payment landed, so the money moves and the row still says DUE. */
    webhook: Boolean(FEE_SECRET),
    apiVersion: (process.env.BOARD_STRIPE_VERSION || "").trim(),
    feePage: Boolean(DEAL_FEE_TO),
    feePct: store.FEE_PCT,
    payees,
    deals,
    asks,
    asksPaid,
    demo: PAY_DEMO,
    why,
  });
});


/** OPENING ONE.
 *
 *  Throttled on the same map and the same numbers as the front door: five
 *  wrong codes an hour per browser, against 32^6. A memo is a smaller prize
 *  than the board and the same arithmetic covers it.
 */
app.post("/api/memo/open", express.json({ limit: "1kb" }), async (req, res) => {
  const viewer = hashDevice(String(req.body?.viewer || ""), SALT);
  const t = memo.cleanToken(req.body?.t);
  if (!viewer || !t) return res.status(400).json({ error: "no" });

  const now = Date.now();
  const key = "memo:" + viewer;
  const tr = tries.get(key) || { n: 0, at: now };
  if (tr.at < now - 3600_000) { tr.n = 0; tr.at = now; }
  if (tr.n >= 5) return res.status(429).json({ error: "slow-down" });

  const board = await store.load(FILE);
  const found = dealByToken(board, t);
  /* A token nobody has and an expired one answer the same way on purpose:
     "gone" tells somebody holding a stale link what they need to know, and
     tells somebody guessing tokens nothing about which guesses were close. */
  if (!found) return res.status(404).json({ error: "gone" });

  const got = memo.openShare(found.d.share, { code: req.body?.code, viewer, same: safeEqual });
  if (got.error) {
    if (got.error === "code") {
      tr.n += 1; tr.at = now; tries.set(key, tr);
      return res.status(400).json({ error: "code", left: Math.max(0, 5 - tr.n) });
    }
    return res.status(got.error === "gone" || got.error === "expired" ? 404 : 400).json(got);
  }
  tries.delete(key);

  /* Remembered so this browser is never asked again — a memo is read on
     Tuesday and paid on Friday, and a code demanded twice is a code lost. */
  if (!found.d.share.saw.includes(viewer)) {
    await change((b) => {
      const f = dealByToken(b, t);
      if (!f) return { ok: true };
      f.d.share.saw = got.saw;
      Object.assign(f.g, store.cleanGroup(f.g));
      return { ok: true };
    });
  }

  const payee = board.people.find(
    (q) => found.g.members.includes(q.by) && q.handle === found.d.provides);
  res.json({
    ok: true,
    to: found.d.share.to,
    until: found.d.share.until,
    memo: memo.memoView(found.d, {
      /* Drawn as payable only when there is somewhere for the money to land
         AND a payment system behind it. Either missing and the page says so
         instead of offering a button that opens a refusal. */
      payeeReady: Boolean(payee?.payee) && (stripe.configured() || PAY_DEMO),
    }),
  });
});

/** PAYING FROM ONE.
 *
 *  The same checkout the room asks for, authorised differently: membership
 *  there, a remembered viewer here. Nothing about the money differs, which is
 *  why both go through startCheckout.
 */
app.post("/api/memo/pay", express.json({ limit: "1kb" }), async (req, res) => {
  if (!stripe.configured() && !PAY_DEMO) return res.status(400).json({ error: "off" });
  const viewer = hashDevice(String(req.body?.viewer || ""), SALT);
  const t = memo.cleanToken(req.body?.t);
  const i = Number(req.body?.i);
  const method = String(req.body?.method || "card");
  if (!viewer || !t || !Number.isInteger(i) || i < 0) return res.status(400).json({ error: "no" });
  if (!["wechat", "alipay", "card"].includes(method)) return res.status(400).json({ error: "no" });

  const board = await store.load(FILE);
  const found = dealByToken(board, t);
  if (!found) return res.status(404).json({ error: "gone" });
  const { g, d } = found;
  /* No code here: this viewer gave it already and is remembered. An expired
     link stops paying even for somebody who opened it while it was alive —
     the deadline is on the link, not on the reading of it. */
  if (!memo.shareLive(d.share)) return res.status(404).json({ error: "expired" });
  if (!d.share.saw.includes(viewer)) return res.status(403).json({ error: "code" });
  if (!Array.isArray(d.plan) || i >= d.plan.length) return res.status(400).json({ error: "row" });
  /* A row already settled is not payable twice from a link somebody scrolled
     back to. The room's own button is guarded by the chip; this is the guard
     for the copy of the memo sitting in a chat. */
  if ((d.paid || []).some((r) => r.i === i && r.kind === "confirmed")) {
    return res.status(400).json({ error: "already" });
  }

  const payee = board.people.find((q) => g.members.includes(q.by) && q.handle === d.provides);
  if (!payee?.payee) return res.status(400).json({ error: "payee" });
  if (!stripe.configured()) return res.json({ ok: true, demo: true, method });

  const out = await startCheckout({
    d, i, method, payeeAcct: payee.payee,
    ref: g.id + ":" + i,
    /* Back to the memo, not to the room — the payer may have no way into the
       room and landing them at a door they cannot open is worse than no
       redirect at all. */
    done: backHere(req, "/d/" + t + "?paid={CHECKOUT_SESSION_ID}"),
  });
  if (out.error) return res.status(out.error === "amount" ? 400 : 502).json(out);
  res.json({ ok: true, ...out });
});


app.post("/api/group/deal/paid", notesOff, express.json({ limit: "2kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const id = String(req.body?.group || "");
  const i = Number(req.body?.i);
  const kind = String(req.body?.kind || "");
  if (!me || !/^[a-f0-9]{20}$/.test(id) || !Number.isInteger(i) || i < 0) return res.status(400).json({ error: "no" });
  if (!["claimed", "confirmed", "denied"].includes(kind)) return res.status(400).json({ error: "no" });

  const out = await change((board) => {
    const g = board.groups.find((x) => x.id === id);
    if (!g || !g.deal || !g.members.includes(me)) return { error: "no" };
    const d = g.deal;
    if (!Array.isArray(d.plan) || i >= d.plan.length) return { error: "row" };
    const mine = board.people.find((q) => q.by === me);
    if (!mine?.handle) return { error: "profile" };

    /* One half each: the payer claims, the paid confirms or denies. */
    if (kind === "claimed" && mine.handle !== d.hires) return { error: "side" };
    if (kind !== "claimed" && mine.handle !== d.provides) return { error: "side" };

    d.paid = Array.isArray(d.paid) ? d.paid : [];
    if (d.paid.some((r) => r.i === i && r.kind === kind && r.who === mine.handle)) return { ok: true };
    /* Confirming what nobody has claimed is somebody ticking a box on their own.
       The money may well have arrived; the record is still half a record. */
    if (kind !== "claimed" && !d.paid.some((r) => r.i === i && r.kind === "claimed")) return { error: "unclaimed" };
    d.paid.push({ i, kind, who: mine.handle, at: new Date().toISOString() });
    Object.assign(g, store.cleanGroup(g));
    return { ok: true, tell: otherSide(board, g, mine.handle) };
  });
  if (out?.error) return res.status(400).json(out);
  res.json({ ok: true });
  /* "They say they paid" and "it arrived" are both worth a phone buzzing:
     each is the other person's cue to do something. */
  if (out?.tell) tellThem(out.tell).catch(() => {});
});

/** A REMINDER, SENT BY A PERSON RATHER THAN BY A CLOCK.
 *
 *  The due dates on a plan are words — "on signing", "25 Sep", "when episode
 *  four is in" — because that is how two people write them, and a date this
 *  board has guessed at is a date it will eventually be wrong about, loudly,
 *  at seven in the morning. So there is no scheduler: whoever is waiting for
 *  the money presses a button, and the other phone buzzes.
 *
 *  ONCE A DAY, PER ROW. A nudge that can be sent ten times in a minute is a
 *  way to shout at somebody through their lock screen.
 */
/* ---------------------------------------------------------------------------
 * THE PLATFORM'S TWO PER CENT, SAID BY THE SAME TWO TAPS
 *
 * The same shape as a plan row and for the same reason: a row that says paid
 * because one person ticked it is not a record. What differs is who holds the
 * other half. The plan's rows are between the two of them; this one is between
 * the payer and whoever runs this board, so the confirming half is staff.
 *
 * NOBODY CAN CLAIM IT BUT THE PAYER, and nobody can confirm it but staff. A
 * board that let the person being paid confirm their own fee would be a board
 * where the fee row means nothing.
 * ------------------------------------------------------------------------ */
app.post("/api/group/deal/fee", notesOff, express.json({ limit: "2kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const id = String(req.body?.group || "");
  const kind = String(req.body?.kind || "");
  if (!me || !/^[a-f0-9]{20}$/.test(id)) return res.status(400).json({ error: "no" });
  if (!["claimed", "confirmed", "denied"].includes(kind)) return res.status(400).json({ error: "no" });
  /* No page to pay it on means there is no fee, so there is nothing to say
     about one — checked here as well as at the draw, because a client can ask
     for anything. */
  if (!DEAL_FEE_TO) return res.status(400).json({ error: "off" });

  const out = await change((board) => {
    const g = board.groups.find((x) => x.id === id);
    if (!g || !g.deal || !g.members.includes(me)) return { error: "no" };
    const d = g.deal;
    const mine = board.people.find((q) => q.by === me);
    if (!mine?.handle) return { error: "profile" };

    if (kind === "claimed" && mine.handle !== d.hires) return { error: "side" };
    if (kind !== "claimed" && !isStaff(board, me)) return { error: "side" };

    d.feePaid = Array.isArray(d.feePaid) ? d.feePaid : [];
    if (d.feePaid.some((r) => r.kind === kind && r.who === mine.handle)) return { ok: true };
    if (kind !== "claimed" && !d.feePaid.some((r) => r.kind === "claimed")) return { error: "unclaimed" };
    d.feePaid.push({ kind, who: mine.handle, at: new Date().toISOString() });
    Object.assign(g, store.cleanGroup(g));

    /* Confirming is worth the payer's phone buzzing — it is the half they are
       waiting on. Claiming is not: it is addressed to whoever runs the board,
       who is reading it rather than waiting for it. */
    const payer = kind === "claimed" ? "" :
      (board.people.find((x) => g.members.includes(x.by) && x.handle === d.hires) || {}).by || "";
    return { ok: true, tell: payer };
  });
  if (out?.error) return res.status(400).json(out);
  res.json({ ok: true });
  if (out?.tell) tellThem(out.tell).catch(() => {});
});

app.post("/api/group/deal/nudge", notesOff, express.json({ limit: "2kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const id = String(req.body?.group || "");
  const i = Number(req.body?.i);
  if (!me || !/^[a-f0-9]{20}$/.test(id) || !Number.isInteger(i) || i < 0) return res.status(400).json({ error: "no" });

  const out = await change((board) => {
    const g = board.groups.find((x) => x.id === id);
    if (!g || !g.deal || !g.members.includes(me)) return { error: "no" };
    const mine = board.people.find((q) => q.by === me);
    if (!mine?.handle) return { error: "profile" };
    const d = g.deal;
    if (!Array.isArray(d.plan) || i >= d.plan.length) return { error: "row" };
    /* Only the person waiting to be paid, and only while it is unpaid. */
    if (mine.handle !== d.provides) return { error: "side" };
    if ((d.paid || []).some((r) => r.i === i && r.kind === "confirmed")) return { error: "done" };
    d.nudges = Array.isArray(d.nudges) ? d.nudges : [];
    const last = d.nudges.filter((n) => n.i === i).slice(-1)[0];
    if (last && Date.now() - Date.parse(last.at) < 20 * 3600 * 1000) return { error: "soon" };
    d.nudges.push({ i, at: new Date().toISOString() });
    Object.assign(g, store.cleanGroup(g));
    return { ok: true, tell: otherSide(board, g, mine.handle) };
  });
  if (out?.error) return res.status(400).json(out);
  res.json({ ok: true });
  if (out?.tell) tellThem(out.tell).catch(() => {});
});

/** Adding somebody who is already a member of the board to a room you made.
 *
 *  The room could only ever be filled at the moment it was created, so a third
 *  person thought of on Tuesday meant making a second room. Same rules as
 *  making one: your matches only, read from groupable(), and the cap counts
 *  the codes nobody has spent yet.
 */
app.post("/api/group/add", notesOff, express.json({ limit: "4kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const id = String(req.body?.group || "");
  const who = String(req.body?.who || "");
  if (!me || !/^[a-f0-9]{20}$/.test(who)) return res.status(400).json({ error: "no" });

  const out = await change((board) => {
    const g = board.groups.find((x) => x.id === id);
    /* NOT A ROOM THE OPERATOR KEEPS. Its list is set from outside the app,
       because being in it depends on something this board cannot see — see
       /api/room/hand. One keeper, and no second way in or out. */
    if (g.hand) return { error: "gone" };
    if (!g) return { error: "gone" };
    /* ONLY THE ROOM'S OWN MAKER. Everybody in here matched with them, and
       letting a member add their own matches would put somebody in a room
       with a stranger they never agreed to hear from — which is the one rule
       the whole feature rests on. */
    if (g.by !== me) return { error: "notyours" };
    if (!groupable(board, me).some((c) => c.who === who)) return { error: "notmatched" };
    const q = board.people.find((x) => x.id === who);
    if (!q) return { error: "gone" };
    if (g.members.includes(q.by)) return { error: "already" };
    const held = board.invites.filter((x) => x.grp === g.id && !x.off && !x.usedBy
      && !store.inviteOver(x)).length;
    if (store.groupRoom(g) - held < 1) return { error: "full" };
    g.members.push(q.by);
    // A guest who turns out to be a member already is not both.
    g.guests = (g.guests || []).filter((h) => h !== q.by);
    Object.assign(g, store.cleanGroup(g));
    moSays(board, g.id, "in", q.handle);
    return { ok: true, handle: q.handle };
  });
  if (out?.error) {
    return res.status(out.error === "notyours" ? 403 : 409).json(out);
  }
  res.json(out);
});

/** Taking back a code you minted for a room you made.
 *
 *  An unspent code sits in one of the room's five seats until it runs out, so
 *  a room of two can refuse a third person because of two invites nobody
 *  answered. Whoever minted it can stand it down; nobody else can, and a spent
 *  one cannot be stood down at all — the person is already in.
 */
app.post("/api/group-invite/off", notesOff, express.json({ limit: "1kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || req.get("x-board-device") || ""), SALT);
  const code = String(req.body?.code || "").toUpperCase();
  if (!me || !code) return res.status(400).json({ error: "no" });
  const out = await change((board) => {
    const v = board.invites.find((x) => x.code === code);
    if (!v || !v.grp) return { error: "gone" };
    if (v.by !== me) return { error: "notyours" };
    if (v.usedBy) return { error: "spent" };
    v.off = true;
    return { ok: true };
  });
  if (out?.error) return res.status(out.error === "notyours" ? 403 : 409).json(out);
  res.json(out);
});

/** One room at the door, read by somebody entitled to read it.
 *
 *  The same shape for both kinds of reader, because it is the same room. What
 *  differs is one word on each line — `inside` — which is the only thing
 *  anybody needs to tell a member from somebody still waiting, and the reason
 *  it matters is that it is what a waiting person is looking for: is anybody
 *  in there reading this.
 */
app.get("/api/door", notesOff, async (req, res) => {
  res.set("Cache-Control", "no-store");
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT) || waitCookie(req);
  const key = String(req.query.room || "");
  const id = store.doorRoom(key);
  if (!id) return res.status(404).json({ error: "no" });
  const board = await store.load(FILE);
  /* A STRANGER ON THE LINK SEES THE ROOM.
   *
   * The whole point of sending somebody a room is that they open the room.
   * They were landing on the page that sells the board — a headline and two
   * buttons — which is the right page for a cold address and the wrong one
   * for "Brendan, come and talk to these people".
   *
   * WHAT IT COSTS, said plainly: anybody holding the link reads that
   * conversation. The room's own header has always said "anyone inside can
   * read", and there are no contact details in there to leak — the contact
   * rule refuses them before they are stored. What is in there is first names
   * and what people are looking for, which is the thing that would make
   * somebody want in.
   *
   * A READ AND NOTHING ELSE. No `wid`, so no thread can be opened from it; no
   * `mine`, because there is nothing of theirs in there yet; and the last
   * dozen lines rather than two hundred, because it is a window and not an
   * archive. Speaking still means joining, which is the box under it. */
  const how = doorAccess(board, me, key) || "peek";

  /* TWO PLACES A NAME CAN COME FROM, and neither of them carries a way to
     reach anybody: a member's handle, or the name somebody typed on the way
     in. Never the device hash the row is stored under. */
  /* Who this reader already follows, worked out once rather than per row. */
  const iFollow = new Set(board.follows.filter((f) => f.by === me).map((f) => f.who));
  const named = (h) => {
    if (h === store.MO) return { handle: MO_NAME, inside: false, bot: true };
    const q = board.people.find((x) => x.by === h && x.handle);
    /* WHETHER A READER STILL OUTSIDE COULD REACH THEM. The door shows a few
       members from outside — see peekFor — and those are the only faces in
       this room that lead anywhere for somebody who has not been let in. Sent
       so the page can link exactly those and leave the rest plain, rather
       than offering a link that lands on a refusal. */
    /* WHAT THEY ARE, under the name, and it is the fact the room is for.
       The line said "inside" or "waiting", which is true and is about the
       board's process — a Chinese agent scrolling a room is deciding which
       of these people is a director, not which of them has been admitted.
       The role leads and the side of the door follows it. */
    const roleOf = (r) => (r && r.me) || "";
    /* AND THEIR PAGE ID, FOR A MEMBER READER, so the room can offer Follow
       where the decision is made rather than two screens away. Same rule as
       `wid` below and for the same reason: an id is the way to act on
       somebody, and acting is a member's. A reader still outside gets the
       name and nothing to press.
       Only for somebody who is actually followable — published and looking —
       so the button is never offered against a refusal. */
    /* HOW TO FOLLOW THEM, for anybody standing in this room.
     *
     * Not the same thing as `pid` and `wid` below, which are a member's way of
     * ACTING on somebody — opening their page, opening a thread. This is the
     * one button the room itself offers, and it is offered to everybody in the
     * room because that is the whole change: two people who read each other in
     * here can say so, and if both do they get somewhere to talk.
     *
     * It is not access and it hands over nothing. A wait id is only ever
     * useful for following and for a thread the other person also agreed to —
     * see /api/follow and the `w:` branch in /api/note. */
    if (q) return { handle: q.handle, inside: true, bot: false,
                    role: roleOf((Array.isArray(q.say) ? q.say : [])[0]),
                    ...(q.state === "published" && (q.looking || q.runBy)
                      ? { fid: q.id, iFollow: iFollow.has(q.id) } : {}),
                    ...(how === "member" && q.state === "published"
                      && (q.looking || q.runBy) ? { pid: q.id } : {}),
                    ...(q.peek && q.looking && q.state === "published" ? { peek: true } : {}) };
    const w = board.waits.find((x) => x.by === h && !x.done);
    /* THE ROW ID, FOR A MEMBER ONLY. Not to name them — the name is already
       here — but so the screen can tell who in the room has never said
       anything, which is the list a member was reading before the room
       existed and still the one they are deciding from. Never to somebody
       waiting: the ids are the way into a thread, which is a member's. */
    return { handle: (w && w.name) || "", inside: false, bot: false,
             role: (w && w.me) || "",
             // Followable by anybody in the room with them — see above.
             ...(w && w.shown ? { fid: "w:" + w.id, iFollow: iFollow.has("w:" + w.id) } : {}),
             ...(w && how === "member" ? { wid: w.id } : {}) };
  };

  /* WHETHER THIS READER MAY LET SOMEBODY IN, so the screen can offer it.
     Staff, and nobody else: admission is the operator's, and a board where any
     member can open the door is not one with a door. Read from BOARD_STAFF the
     same way standing() reads it. */
  const mine = board.people.find((q) => q.by === me && q.handle);
  const staff = Boolean(mine && STAFF.has(String(mine.handle).toLowerCase()));

  res.json({
    room: key, id, how, staff,
    // Whether the Inside tab has anything behind it — see peekN.
    peekN: peekN(board),
    /* HOW MANY ARE STANDING IN IT. The people, not the lines — a room of one
       person talking to themselves and a room of six is the thing somebody
       wants to know before they read a word of it. */
    n: board.waits.filter((w) => !w.done && (w.room || "other") === key && w.shown).length,
    says: board.says.filter((m) => m.group === id)
      .sort((a, b) => String(a.at).localeCompare(String(b.at)))
      .slice(how === "peek" ? -12 : -200)
      .map((m) => ({ id: m.id, at: m.at, text: m.text,
                     /* The same line in the other language, rendered once when
                        it was said — see renderSay. The page picks; nobody
                        presses anything. */
                     alt: m.alt || "", alt2: m.alt2 || "", lang: m.lang || "",
                     /* What happened to the room rather than something said in
                        it — see moSays. Sent here as well as from /api/groups:
                        without it his arrival lines arrived as empty bubbles
                        with a face on them, which is worse than not sending
                        them at all. */
                     evt: m.evt || null,
                     mine: how !== "peek" && m.by === me,
                     reported: Boolean(m.report), ...named(m.by) })),
  });
});

/** LETTING SOMEBODY IN, FROM THE ROOM THEY ARE STANDING IN.
 *
 *  The same thing /api/waiting/up does and the same thing `make admit` does in
 *  bulk — moved to where the decision is actually made. Whoever runs this
 *  board reads the door on a phone, in the room, next to what the person
 *  wrote and who spoke for them; going to a terminal to act on it meant the
 *  reading and the deciding happened in two places on two machines, and the
 *  second one usually did not happen.
 *
 *  STAFF, AND NOBODY ELSE. Admission is the operator's. A member can vouch,
 *  which moves somebody up one place, and that is the whole of what a member
 *  can do about the door — see /api/vouch. A board where any member can open
 *  it is not a board with a door.
 *
 *  IT DOES NOT LET THEM IN. It moves them into the waiting room proper with
 *  the clock running: they still have to open it, write a name and a line, and
 *  put up a face. Nothing here mints a code and nothing here makes a member.
 */
/** ONE MEMBER'S LINE ON THE PIN, for the room they are standing in.
 *
 * Their own and nobody else's. A pin that showed the room a table of everybody
 * would be a leaderboard, and a leaderboard is a different product: it makes
 * the number a thing to beat somebody at rather than a record of what you did.
 *
 * `room` is taken and checked so the pin cannot be read from outside a door,
 * but nothing in the answer depends on which door it is — the ledger is one
 * board-wide thing and showing a per-room figure would invite the reading that
 * there are five ledgers.
 */
app.get("/api/ledger/pin", notesOff, async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!pinOn()) return res.json({ on: false });
  /* NOT IN THE APP — see the long note over inApp. Answered the same way an
     unset BOARD_LEDGER_GOAL is answered, so there is no second "hidden" state
     for the page to learn: ledger-pin.js has drawn nothing for {on:false}
     since the day the feature was written, and that path is the one every
     deployment without a ledger has been running. */
  if (inApp(req)) return res.json({ on: false });
  const key = String(req.query.room || "");
  const gid = String(req.query.group || "");
  if (!key && !gid) return res.status(400).json({ error: "no" });
  if (key && !LPLACES.includes(key)) return res.status(400).json({ error: "no" });
  /* A place nobody listed shows nothing, and says so the same way off does —
     except the rewards door, which needs no listing. A room named for the
     thing and then empty of it would be the app's own joke. */
  if (key && key !== store.OPEN_DOOR && !LROOMS.has(key)) return res.json({ on: false });
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
  /* THE WAITING ROOM, WHICH IS BEFORE ANY DOOR. Somebody here is not a member
     and may have no member row at all, so the cookie is the identity — the
     same one /api/wait/me runs on. Everywhere else needs the device. */
  if (key === "wait") {
    const w = await inWaitingRoom(req);
    if (!w) return res.json({ on: false });
    const board = await store.load(FILE);
    return res.json({
      ...pinFor(board, me || w.by),
      joined: Boolean(me) && (await joins()).includes(me),
    });
  }
  if (!me) return res.json({ on: false });
  const board = await store.load(FILE);
  if (gid) {
    /* A HAND-KEPT ROOM AND NO OTHER. An ordinary group is people who matched;
       this is a list the operator typed, which is the only room where nobody
       can arrive without having been put there. */
    const g = board.groups.find((x) => x.id === gid && x.hand);
    if (!g || !g.members.includes(me)) return res.json({ on: false });
    /* THE ARRIVAL VIEW, FOR THE PERSON WHO CANNOT OTHERWISE SEE IT. Staff, in
       a room they keep by hand, and nowhere else: the toggle is a tool for
       checking what a stranger reads, not a mode anybody else can enter. */
    const boss = STAFF.has(String((board.people.find((q) => q.by === me) || {}).handle || "")
      .toLowerCase());
    if (boss) {
      return res.json({
        ...pinFor(board, me, String(req.query.preview || "") === "1"),
        staff: true, joined: (await joins()).includes(me),
      });
    }
  } else if (!doorAccess(board, me, key)) {
    /* A STRANGER ON THE LINK, AT THE ONE DOOR THAT IS OPEN TO EVERYBODY.
     *
     * "Somebody who is neither a member nor waiting has no line" was the rule,
     * and at every other door it still is. Here it was backwards: this room is
     * the one that gets sent to people, and the person it is sent to is by
     * definition neither — so the whole reason to share it showed them nothing.
     *
     * What they get is the arrival view, which is the honest one: the place
     * they WOULD have, what it is worth, and what it falls to if they wait.
     * No member's name, no count of who is inside, nothing they could not read
     * off the room they are already looking at.
     *
     * `outside` so the screen can offer them the one thing they can actually
     * do — see the note over saveRow in ledger-pin.js. */
    if (key !== store.OPEN_DOOR) return res.json({ on: false });
    return res.json({ ...pinFor(board, me), outside: true, joined: false });
  }
  const out = pinFor(board, me);
  res.json({ ...out, joined: (await joins()).includes(me) });
});

/** PRESSED JOIN.
 *
 * Written to a file of its own, and it is the only thing this feature stores.
 * Idempotent: pressing it twice is pressing it once, because a button that can
 * be pressed twice into two rows is a count that is wrong the first time
 * somebody double-taps on a slow connection.
 */
app.post("/api/ledger/join", notesOff, express.json({ limit: "1kb" }), async (req, res) => {
  if (!pinOn()) return res.status(404).json({ error: "off" });
  /* And the button cannot be pressed from the app either, not merely hidden.
     Claiming a place on a ledger is the act the share offer is about, and a
     route that refuses only in the interface is a route that does not refuse. */
  if (inApp(req)) return res.status(404).json({ error: "off" });
  const me = hashDevice(String(req.body?.device || ""), SALT);
  if (!me) return res.status(400).json({ error: "no" });
  const board = await store.load(FILE);
  const mine = board.people.find((q) => q.by === me && q.handle);
  /* A page first. Joining is a claim on a place in an order, and somebody with
     no page is not yet in that order — cleanBoard has not stamped them. */
  if (!mine || !mine.seq) return res.status(403).json({ error: "profile" });
  await joined(me);
  res.json({ ok: true, ...pinFor(board, me), joined: true });
});

app.post("/api/door/up", notesOff, express.json({ limit: "2kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const id = String(req.body?.id || "");
  if (!me || !id) return res.status(400).json({ error: "no" });
  const out = await change((board) => {
    const mine = board.people.find((q) => q.by === me && q.handle
      && q.state === "published");
    if (!mine || !STAFF.has(String(mine.handle).toLowerCase())) {
      return { error: "notyours" };
    }
    const w = board.waits.find((x) => x.id === id);
    if (!w || w.done) return { error: "gone" };
    if (w.up) return { ok: true, name: w.name, already: true };
    w.up = true;
    /* Stamped, because it is what the picker counts — see /api/waiting/up and
       liftSome. A row lifted by hand that did not carry the day would let the
       automatic three go out on top of it. */
    w.upAt = new Date().toISOString();
    w.ups = (w.ups || 0) + 1;
    return { ok: true, name: w.name };
  });
  if (out?.error) {
    return res.status(out.error === "notyours" ? 403 : 404).json(out);
  }
  res.json(out);
});

/** WHO MAY READ AND WRITE IN A DOOR ROOM.
 *
 *  Two kinds of person and no third. A member, because deciding who to let in
 *  is the job and reading what somebody says over a week beats reading three
 *  form fields. And somebody waiting in THAT room — not in any other one,
 *  which is the whole of the check that matters: the waiting-room gate exists
 *  to stop a stranger writing anywhere on this board, and the one door opened
 *  in it opens onto the one room they are already standing in.
 *
 *  Returns "member", "wait" or "".
 */
function doorAccess(board, me, key) {
  if (!key || !me) return "";
  const mine = board.people.find((q) => q.by === me && q.state === "published");
  if (mine && mine.handle) return "member";
  const w = board.waits.find((x) => x.by === me && !x.done);
  /* THE ONE DOOR THAT IS OPEN TO EVERYBODY WAITING, whichever pile they are
     in. Every other door is about what somebody does, so standing at one you
     were not filed under would be standing in a room of strangers who have
     nothing to do with you. This one is about where you are in the order
     people arrived, which is the same question for all of them — and a room
     about that which half the waiting list cannot open is not a room. */
  if (w && key === store.OPEN_DOOR) return "wait";
  /* THE ROOM THEY JOINED AND NOT THE ONE THEY ASKED FOR. cleanWait falls back
     to "other" for anything it does not know, so the row is the authority —
     see the note over WAITROOMS in scripts/waiting.mjs. */
  if (w && (w.room || "other") === key) return "wait";
  return "";
}

/** WHAT MO IS TOLD ABOUT THE LEDGER, IN THE ROOM THAT CARRIES IT.
 *
 *  THE NUMBERS ARE pinFor's, NOT A SECOND SET. The house rule written over
 *  actsOf, again and for the same reason: "two places is how a screen ends up
 *  promising a number the ledger does not pay". If he learns the tiers from a
 *  literal in here, then the day the tiers change he is the one still quoting
 *  the old ones, confidently, in a room full of people.
 *
 *  It goes to a model, so what is in it matters. Their place and their own
 *  points — which is their own screen read back to them — the tiers, which are
 *  the same for everybody, and the goal. No other member, no names, nothing
 *  about who is in.
 *
 *  Null when the ledger is off or this room does not carry it, and then he has
 *  never heard of any of it, which is the right answer in a room where it does
 *  not exist.
 */
function ledgerFor(board, who, key) {
  if (!pinOn()) return null;
  if (!key || (key !== store.OPEN_DOOR && !LROOMS.has(key))) return null;
  const d = pinFor(board, who);
  if (!d || !d.on) return null;
  const tiers = (d.tiers || []).map((t) =>
    `the first ${t.upto.toLocaleString()} — ${t.size.toLocaleString()} places, `
    + `${t.pts.toLocaleString()} points each`);
  const out = {
    tiers,
    filling: d.tier
      ? `the first ${d.tier.upto.toLocaleString()}, ${d.tier.left.toLocaleString()} places left`
      : "none — the last tier is full and the ledger is closed",
    members: d.members,
    goal: d.goal,
    cap: d.cap,
    mine: d.place
      ? `place #${d.place}, ${d.total.toLocaleString()} points, ${d.share.toFixed(2)}% of the pool`
      : d.soon
        ? `not in yet. Their place would be #${d.soon}, worth ${d.soonPts.toLocaleString()} points`
        : "",
    /* The figure only when the operator put one on the box, and named as what
       it is. He is told the arithmetic so he can say it, because a figure he
       cannot account for is a figure he should not repeat. */
    money: typeof d.moneyAt === "number"
      ? `if the company sold for ${money0(d.saleAt)} at ${d.goal.toLocaleString()} members and the members' pool is ${d.cut}% of a sale, their share comes to ${money0(d.moneyAt)}`
      : "",
  };
  return out;
}

const money0 = (v) => "$" + Math.round(Number(v) || 0).toLocaleString("en-US");

/** MO SAYS WHAT HAPPENED TO THE ROOM.
 *
 *  He is a member of every one of them and he is silent — that is the bargain,
 *  and it holds: this is not him reading anything. It is the room's own state,
 *  said out loud by the one member whose job that is.
 *
 *  IT EXISTS BECAUSE TAKING SOMEBODY OUT WAS SILENT. Somebody vanished from a
 *  room of four and the other three were told nothing, which is worse than the
 *  removal — a person you were talking to on Tuesday is gone on Wednesday and
 *  the room has no account of it. Joining had the same hole from the other
 *  side: a stranger's first line arriving in a room that never said they had
 *  come in.
 *
 *  A FACT, NOT A SENTENCE. `evt` carries the kind and the name and the page
 *  writes the words, in whichever language it is being read in — see cleanSay,
 *  and the house rule that strings live in i18n.js in both languages.
 */
function moSays(board, group, kind, who) {
  if (!who) return;
  board.says.push(store.cleanSay({
    id: store.newId(), group, by: store.MO, text: "", evt: { kind, who },
  }));
}

/** Saying something in one. */
app.post("/api/group/say", notesOff, express.json({ limit: "16kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const id = String(req.body?.group || "");
  let text = String(req.body?.text || "").trim().slice(0, 600);
  if (!me) return res.status(400).json({ error: "no" });
  if (!text) return res.status(400).json({ error: "empty" });

  const door = store.doorKey(id);
  /* The id of the line this call writes, so the other-language render can be
     started once the write has committed. Set inside and read outside: a
     model call must never happen while the file lock is held. */
  let saidId = "";
  /* The wait row whose line this message just became, if it did — rendered
     into the other language after the write, like everything else here. */
  let whyFor = "";
  /* Whether this line is a reply to something he just said — see below. */
  let stillMo = false;
  /* What was taken out of it on the way in, for the sender's eyes only — see
     stripContact. It never goes into the room. */
  let took = [];
  /* THE PHONES TO BUZZ. Filled inside the write, where who is in this room is
     already being worked out, and spent after it — a push service having a
     slow afternoon must not be something the sender waits for. */
  let buzz = [];
  const out = await change((board) => {
    /* WHO CAN BE @'D IN HERE, worked out before the rules below need it: the
       people in this room, so a mention of one of them is read as a mention
       and not as a handle for somewhere else. Filled in per kind of room
       further down, where membership is already being checked. */
    let mentionable = [];
    // Name -> the browser it belongs to, for the buzz. See below.
    const whose = new Map();
    /* A DOOR ROOM IS NOT A GROUP and takes the other set of rules: no members,
       no cap, nobody can leave it, and the people in it have not been vouched
       for by anybody. Everything below this — the contact rule, the doorman's
       tripwire, reporting — applies to it unchanged, which is the whole reason
       its lines live in `says` beside everybody else's. */
    if (door) {
      if (!doorAccess(board, me, door)) return { error: "gone" };
      /* Everybody at that door, and every member — a member reading a door
         room is in it for this purpose whether or not they have spoken. */
      /* HIM TOO, in every room. @ somebody who is not in the room is read as a
         handle for somewhere else and refused — which was true of the doorman
         himself, so "ask @Mo" came back as a contact detail. See unmention. */
      mentionable = [
        MO_NAME,
        ...board.waits.filter((w) => !w.done && (w.room || "other") === door).map((w) => w.name),
        ...board.people.filter((q) => q.handle).map((q) => q.handle),
      ];
      /* AND WHOSE PHONE EACH NAME BELONGS TO — see the buzz below. Built here
         because this is where the room's membership is already in hand, and
         nowhere else on this route knows it. */
      for (const w of board.waits) {
        if (!w.done && (w.room || "other") === door && w.name) whose.set(w.name, w.by);
      }
      for (const q of board.people) if (q.handle) whose.set(q.handle, q.by);
    } else {
    const g = board.groups.find((x) => x.id === id);
    // The same answer for a group that never existed and one you are not in:
    // this must not become a way to ask which groups are real.
    if (!g || !(g.members.includes(me) || (g.guests || []).includes(me))) {
      return { error: "gone" };
    }
    /* A GUEST READS AND DOES NOT SPEAK, and this is the line that means it.
     *
     * Told apart from "gone" on purpose, and it is the one place in this file
     * where the difference is worth leaking: they are IN the room, they can
     * see it, and what is missing is a name. "Gone" would send somebody who is
     * looking at a conversation away to work out why they cannot answer it.
     * The page turns this word into the box that fixes it. */
    if (!g.members.includes(me)) return { error: "profile" };
    // Him too — he is in every room. Same reason as at the door above.
    mentionable = [MO_NAME, ...g.members
      .map((h) => (board.people.find((q) => q.by === h) || {}).handle)
      .filter(Boolean)];
    for (const h of g.members) {
      const q = board.people.find((x) => x.by === h);
      if (q && q.handle) whose.set(q.handle, h);
    }
    }

    /* A WECHAT ID PASTED INTO A ROOM IS THE WHOLE PRODUCT GOING OUT OF THE
     * WINDOW, AND THIS IS THE ONE THING HERE THAT IS REFUSED RATHER THAN
     * FLAGGED.
     *
     * Everything else the doorman notices is delivered and marked — see the
     * note over screen() — because a regex is wrong about people and the cost
     * of silencing somebody's ordinary sentence is higher than the cost of a
     * visible warning. This is the exception, for three reasons that do not
     * apply to any of the others.
     *
     * It is objective. An email address is an email address; nobody has to
     * judge whether it was meant unkindly.
     *
     * It is already the rule everywhere else on this board. cleanPerson
     * refuses contact-shaped text in a profile and has since the beginning —
     * see contactShaped — and a rule that holds on a page and not in a
     * message is not a rule, it is a suggestion with a gap in it.
     *
     * And the thing they are trying to do has a way to do it, one tap away.
     * A card moves a contact when both of them press give. Refusing this is
     * not stopping anybody, it is pointing at the door that works — which is
     * why the answer carries the matched text, so they can see which bit.
     */
    /* The mentions come out first — see unmention. The rest of the sentence is
       screened exactly as it always was, and @ somebody who is not in this
       room is still a handle for somewhere else and still refused. */
    /* THE CONTACT COMES OUT. THE MESSAGE GOES IN.
     *
     * This refused the whole message, and that is the wrong end of the rule.
     * Somebody wrote "@hugo I know a venture capital investor I can connect
     * you with, my wechat is tomshan88" — a member doing the exact thing this
     * board is for, with four words on the end that cannot be here — and got
     * a red line and lost the sentence. Nobody retypes it. They go to WeChat,
     * which is the outcome the rule exists to prevent: refusing it made the
     * thing it forbids more likely.
     *
     * So the id comes out and the rest is posted. What was taken goes back to
     * the sender alone, on their own screen, never into the room — a line
     * quoting the WeChat id out loud has published it to everybody in here.
     *
     * The rule has not moved an inch: no contact detail reaches this board,
     * and a card is still the only way one changes hands. See stripContact,
     * which keeps mentions of people standing in this room. */
    /* WHO WAS ACTUALLY @'D, AND THEIR PHONE.
     *
     * An @ in a room buzzed nobody. Somebody writes "@Ray this is the one you
     * asked about" and Ray finds out two days later, or never — and the whole
     * reason for putting the app on a home screen is that it tells you when
     * somebody wants you.
     *
     * ONLY AN @, and that is the line. Every message in a busy room going to
     * twenty-two lock screens is how a room gets muted, and a muted room is
     * worse than a quiet one. Being named is the signal; the rest is reading.
     *
     * The same test unmention uses, so the thing that counts as a mention here
     * and the thing the room draws as one cannot come apart. Not the doorman,
     * who has no phone, and not yourself. */
    for (const name of new Set(mentionable)) {
      if (!name || name === MO_NAME) continue;
      if (!text.includes("@" + name)) continue;
      const to = whose.get(name);
      if (to && to !== me) buzz.push(to);
    }

    const cut = store.stripContact(text, mentionable);
    /* NOTHING LEFT BUT THE CONTACT. "wechat tomshan88" on its own is not a
       message with a problem in it — it is the problem, and there is nothing
       to post. Still refused, and now it is the only thing that is. */
    if (!cut.text) return { error: "contact", what: cut.took[0] || "" };
    took = cut.took;
    text = cut.text;

    /* IS THIS LINE STILL TO HIM? — read before the push, so it looks at the
     * room as it was a moment ago.
     *
     * "@Mo are there investors coming?" got an answer. "How can I contact
     * him?", the next line, got nothing, because it had no @ on it — and a
     * doorman who needs to be addressed by name on every single line is not
     * somebody having a conversation, he is a command line.
     *
     * NARROW ON PURPOSE, because the opposite failure is worse: him joining
     * in on a room that was not talking to him. All three have to hold — he
     * spoke last, the line before his was this same person's, and it was
     * within three minutes. That is a two-person exchange still in progress
     * and nothing else is.
     *
     * The tripwire line is not an invitation. It is the one thing he says
     * without being asked (see MO_WATCH), so the person it lands on has not
     * started a conversation with him and their next line is to the room.
     */
    const rows = board.says.filter((m) => m.group === id && !m.evt && m.text);
    const was = rows[rows.length - 1];
    const before = rows[rows.length - 2];
    stillMo = Boolean(was && was.by === store.MO && was.text !== MO_WATCH
      && before && before.by === me
      && Date.now() - (Date.parse(was.at || "") || 0) < 3 * 60_000);

    board.says.push(store.cleanSay({ id: store.newId(), group: id, by: me, text }));
    /* Held so the render can be started after this write commits — see
       renderSay, which must not run inside the lock. */
    saidId = board.says[board.says.length - 1].id;

    /* THE FIRST THING SOMEBODY SAYS AT A DOOR IS THEIR INTRODUCTION.
     *
     * People arrive at a room with a name and nothing else — the door asks
     * for a name and that is deliberate, it is the whole reason anybody gets
     * as far as the room. Then Mo says "say what you're looking for", and
     * they do:
     *
     *   Hi! I'm a professional model and actress. I would like to have film
     *   shootings.
     *
     * Which is their introduction, written in their own words, in answer to
     * the question their own card asks. And it went into the room and nowhere
     * else — so their card, their row in the queue and their page all stayed
     * blank, and every screen a member reads them on said nothing.
     *
     * THE FIRST ONE ONLY, AND ONLY INTO AN EMPTY LINE. The second message is
     * a conversation, not an introduction, and a line somebody wrote on the
     * You tab is theirs and is not overwritten by something they said in a
     * room. Theirs to change either way — this fills a blank, it does not
     * take the pen.
     *
     * NOTHING NEW IS DISCLOSED. The same members who can read the room can
     * read the queue; this moves their own sentence from one screen they are
     * on to another. */
    if (door) {
      const mine = board.waits.find((w) => w.by === me && !w.done);
      if (mine && !String(mine.why || "").trim()) {
        const line = String(text).trim().slice(0, 300);
        /* Long enough to be an introduction. "hi" and "在吗" are somebody
           checking the room is alive, and putting that on their card is
           worse than leaving it empty. */
        if (line.length >= 12) { mine.why = line; whyFor = mine.id; }
      }
    }

    /* AND, NOW AND THEN, HE TELLS THEM TO WRITE THEIR PAGE.
     *
     * The room is where they are and the page is what gets them out of it:
     * nobody can be vouched for on a name alone, and a card with a sentence
     * on it is the whole of what a member reads before deciding. People have
     * been talking in these rooms for days without one.
     *
     * INTERMITTENTLY, AND THAT WORD IS THE FEATURE. A doorman who says this
     * once is useful; one who says it after every message is the reason
     * people mute a room. So: not on their first line, because their first
     * line is an introduction and answering it with a chore is the worst
     * possible welcome; not twice in two days; and never to somebody who has
     * already done it.
     *
     * IT IS A LINE IN THE ROOM, not a private one — the same shape as the
     * welcome. Everybody seeing that the doorman asks for this is most of
     * what makes it ordinary rather than a telling-off.
     */
    if (door) {
      const mine = board.waits.find((w) => w.by === me && !w.done);
      const done = mine && mine.me && mine.want && mine.photo;
      const said = board.says.filter((m) => m.group === id && m.by === me && m.text).length;
      const ago = mine && mine.nudged
        ? Date.now() - (Date.parse(mine.nudged) || 0) : Infinity;
      if (mine && !done && said >= 2 && ago > 2 * 86400_000) {
        mine.nudged = new Date().toISOString();
        moSays(board, id, "page", mine.name);
      }
    }

    /* WHAT WAKES THE DOORMAN, and it is a regex on this box — see screen() in
       store.js. He is in every room and reads none of them; this runs where
       the message is already being written down, sends nothing anywhere, and
       is the only thing that makes him aware a line exists.
       IT DOES NOT BLOCK. The line above has already been pushed. A tripwire
       that refused to deliver would be a censor, and would be wrong about
       somebody's ordinary sentence inside a week. */
    const tripped = store.screen(text);
    if (tripped) {
      /* MARKED THE WAY A REPORT MARKS ONE, so it reaches whoever runs the
         board through the machinery that already exists — and without anybody
         in the room having had to report a stranger. */
      const mine = board.says[board.says.length - 1];
      if (mine) mine.report = "screen: " + tripped;
      board.says.push(store.cleanSay({
        id: store.newId(), group: id, by: store.MO, text: MO_WATCH,
      }));
    }
    return { ok: true, tripped: Boolean(tripped), took };
  });
  if (out?.error) return res.status(400).json(out);

  /* AND ANSWERING, WHEN SOMEBODY ACTUALLY ASKS HIM.
   *
   * Outside the write above, because it calls a model and a request that holds
   * the file lock while it waits is a room nobody else can speak in. The line
   * is already saved by here; his answer arriving a second later is how a
   * person answering would look anyway.
   *
   * WHAT GOES OUT: THIS PERSON'S OWN LINES AND HIS OWN, AND NOTHING ELSE.
   *
   * It was the one question and nothing else, which is why he could not hold
   * a conversation — asked "are there investors coming", told "Film producer"
   * a line earlier, he had never seen the second and answered as if he had
   * walked in. Every line was the first line.
   *
   * So he is given the exchange: what THIS person said and what HE said back,
   * last ten, and nobody else's words at any point. Which keeps the thing the
   * old rule was actually protecting — he still cannot answer "what did she
   * mean by that", because he has never seen a word she wrote, and that is
   * exactly the question he should not be able to answer. What he gains is
   * the ability to remember what you told him thirty seconds ago, which is
   * the difference between a doorman and a form.
   */
  /* Named, or still talking to him — see stillMo. A line in a conversation he
     is already in does not have to carry his name to be addressed to him. */
  const asked = store.forMo(text) || (stillMo ? String(text).trim() : "");
  if (asked && butler.configured()) {
    /* AND IN A ROOM HE IS TOLD THE SAME FEW. Somebody at a door asking him
       what is inside is the commonest question there is, and until now he had
       nothing true to answer it with — so he refused, which reads as a board
       with nothing in it. See peekFor and the block in lib/butler.js. */
    /* Read again rather than closed over: `board` up there belongs to the
       change() that already committed, and this runs outside that lock on
       purpose — see the note above about not holding it across a model call. */
    /* One read, both answers: who he may name, and what the board counts
       about itself. See peekFor and nowOn. */
    const now = await store.load(FILE).catch(() => null);
    const shown = now ? peekFor(now) : [];
    /* WHO IS ASKING, WHICH THE ROOM NEVER SAID.
     *
     * He was handed the question and nothing else, so `member` was never set
     * and he ran the card-filling script at everybody — including at a member
     * with a page, a sentence and nothing left to fill in, three times in a
     * row. See the room block in facts(): the script is off in here either
     * way, and this is the other half of it, which is knowing whether he is
     * talking to somebody who is in or somebody still outside. */
    const mine = now && now.people.find(
      (q) => q.by === me && q.state === "published" && q.handle);
    const w = now && now.waits.find((x) => x.by === me && !x.done);
    const sentence = (mine && mine.say && mine.say[0]) || w || {};
    /* HIS SIDE AND THEIRS, in order, ending with the question just asked —
       which is already in the file, pushed by the change() above. An @ is
       taken off each of their lines: it addressed him, it is not part of what
       they said. */
    const turns = (now ? now.says : [])
      .filter((m) => m.group === id && m.text && !m.evt
        && (m.by === me || m.by === store.MO))
      .slice(-10)
      .map((m) => (m.by === store.MO
        ? { from: "you", text: m.text }
        : { from: "them", text: store.forMo(m.text) || m.text }));
    const said = await butler.ask(turns.length ? turns
      : [{ from: "them", text: asked }], "grp:" + id, {
      // A room, which turns the card off — see facts().
      room: true,
      peek: shown,
      now: MO_NOW,
      state: now ? nowOn(now) : "",
      member: Boolean(mine),
      // First names only, the way the card page does it.
      name: String((mine && mine.handle) || (w && w.name) || "").split(/\s+/)[0] || "",
      me: sentence.me || "",
      want: sentence.want || "",
      up: Boolean(w && w.up),
      photo: Boolean((mine && mine.photo) || (w && w.photo)),
      // And who else is standing here — see roomFolk.
      folk: now && door ? roomFolk(now, door, me) : [],
      /* THE REWARDS SCHEME, IN THE ROOM THAT CARRIES IT — see ledgerFor.
         Somebody asks "how does this work" in the room built to explain it and
         he had never heard of it, which is the one question he should be able
         to answer better than anybody. */
      /* AND HE IS NOT TOLD ABOUT IT IN THE APP EITHER. Handed the facts,
         Mo explains the scheme when asked — which would put the share offer
         back on a screen the panel was just taken off. Hiding a panel and
         leaving the doorman able to describe it is not removing a feature.
         See the note over inApp. */
      ledger: now && !inApp(req) ? ledgerFor(now, me, store.doorKey(id)) : null,
    }).catch(() => ({ error: "no" }));
    /* `say`, NOT `text`, AND THAT ONE WORD COST THE WHOLE FEATURE.
     *
     * clean() in lib/butler.js returns { say, me, want, why, ready } — the
     * shape the card page has always read. This asked for `.text`, which is
     * undefined on every reply he has ever written, so the line was empty
     * every time and he has never once answered in a room. The model ran, the
     * answer was 155 characters of perfectly good English, and it went in the
     * bin between one property name and another.
     *
     * WHAT MADE IT SURVIVE A WHOLE NIGHT: the log said "silent — the model
     * returned nothing", which was true of this variable and false of the
     * world, and read exactly like a model refusing. Two lines above each
     * other in the log — "ok 4083ms 155 chars" and "silent" — were the same
     * question, and only together do they say where it went. */
    const line = said && said.say ? String(said.say).slice(0, 600) : "";
    /* WHY HE WAS SILENT, WRITTEN DOWN.
     *
     * Somebody asks him something in a room, nothing comes back, and there was
     * no way to tell from anywhere whether the question reached him, whether
     * the model refused, whether the day's cap had gone, or whether the answer
     * was written and the page had simply not redrawn yet. Four very different
     * problems and one symptom, which is how an afternoon goes.
     *
     * The question is not logged — that is somebody's message and the rule
     * about what this box writes down applies to him as much as to anybody.
     * The reason is. */
    if (!line) {
      console.error("butler: silent in " + (store.doorKey(id) || "a room")
        + " — " + ((said && said.error) || "the model returned nothing")
        + (MO_NOW ? "" : " (BOARD_BUTLER_NOW is empty)"));
      // Which is worth knowing but is no longer the whole story — see nowOn.
    }
    if (line) {
      await change((board) => {
        /* A DOOR ROOM HAS NO GROUP ROW, and this looked for one before writing.
           So he answered every question anybody at the door asked him and the
           answer was dropped on the floor — the ask went through, the model
           ran, and the room stayed silent. Which is worse than not having him
           there: they had seen his face in it and spoken to him.
           The room still has to exist: a group they are in, or one of the five
           at the door. Anything else is an id somebody made up. */
        if (!board.groups.some((x) => x.id === id) && !store.doorKey(id)) return null;
        const row = store.cleanSay({
          id: store.newId(), group: id, by: store.MO, text: line,
        });
        board.says.push(row);
        return row.id;
      }).then((moId) => {
        /* AND HIS ANSWER READS IN BOTH LANGUAGES, like every other line in
           the room — see renderSay. He answers in the language he was asked
           in, so half the room would otherwise get his one useful sentence
           in the wrong one. */
        if (moId) renderSay(moId, line);
      }).catch(() => { /* his silence is not the sender's problem */ });
    }
  }
  /* AND THE OTHER LANGUAGE OF IT — after the answer, never before. See
     renderSay: the message is already written and already delivered, and a
     model on the far side of a mainland connection must not be why sending
     one takes four seconds. */
  if (saidId) renderSay(saidId, text);
  if (whyFor) renderWhy(whyFor, String(text).trim().slice(0, 300));
  /* THE BUZZ, AFTER THE WRITE AND NEVER AWAITED. The line is already saved and
     already on its way to everybody reading; whether somebody's phone lit up
     is not an outcome the sender is entitled to wait for. Nothing goes WITH it
     — see lib/push.js: the buzz says somebody wants you, and who and what are
     behind the door where they belong. */
  for (const to of new Set(buzz)) {
    tellThem(to).catch(() => { /* a push that failed is a push that did not arrive */ });
  }
  res.json(out);
});

/** Leaving one. Yours to take and nobody else's to take for you. */
app.post("/api/group/leave", notesOff, express.json({ limit: "2kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const id = String(req.body?.group || "");
  if (!me) return res.status(400).json({ error: "no" });
  const out = await change((board) => {
    const g = board.groups.find((x) => x.id === id);
    /* A GUEST LEAVES THE SAME WAY, and it has to work before it has to be
       tidy: somebody put in a room they do not want to be in must be able to
       walk out of it whether or not they ever wrote their name. A room nobody
       can leave is the one thing this board must never be. */
    if (g && (g.guests || []).includes(me)) {
      g.guests = g.guests.filter((x) => x !== me);
      return { ok: true };
    }
    if (!g || !g.members.includes(me)) return { error: "gone" };
    g.members = g.members.filter((m) => m !== me);
    /* A member walking out is named. A guest is not — they never said who they
       were, so there is no name to say, and "somebody left" is a sentence that
       makes a room of four look over its shoulder for no reason. */
    moSays(board, g.id, "left",
      (board.people.find((q) => q.by === me) || {}).handle);
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

/** TAKING SOMEBODY OUT OF A ROOM YOU MADE.
 *
 *  The other half of the ＋. Somebody put four people in a room and one of them
 *  turned out to be wrong for it; without this the only fix is everybody
 *  leaving and the room being made again, which nobody does — they abandon the
 *  room and the four people stop talking.
 *
 *  ONLY THE PERSON WHO MADE IT. Not "any member", which would be a room where
 *  the quickest hand wins an argument, and not an admin — whoever runs this
 *  board does not reach into a conversation, which is the rule the whole of
 *  the rest of this file is built on.
 *
 *  AND NOT YOURSELF. Walking out is leave, it is one tap away, and a maker who
 *  could remove themselves would be a room with nobody who can let anybody in.
 *
 *  What they said stays. It is the room's conversation and the people still in
 *  it were part of it; silently deleting half the sentences somebody read last
 *  week is a worse thing to do to them than the removal it was tidying up
 *  after. The same rule the leave route already follows.
 */
app.post("/api/group/out", notesOff, express.json({ limit: "2kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const id = String(req.body?.group || "");
  const who = String(req.body?.who || "");
  if (!me || !who) return res.status(400).json({ error: "no" });
  const out = await change((board) => {
    const g = board.groups.find((x) => x.id === id);
    /* NOT A ROOM THE OPERATOR KEEPS. Its list is set from outside the app,
       because being in it depends on something this board cannot see — see
       /api/room/hand. One keeper, and no second way in or out. */
    if (g.hand) return { error: "gone" };
    if (!g || !g.members.includes(me)) return { error: "gone" };
    if (g.by !== me) return { error: "notyours" };
    /* WHO, BY HANDLE. The screen has handles and never device hashes, and it
       should stay that way: a page that can name the hash of a browser is a
       page that can be asked to. Resolved here, where the board already
       knows both. */
    const them = board.people.find((q) => q.handle && q.handle === who);
    const hash = them && them.by;
    if (!hash) return { error: "gone" };
    if (hash === me) return { error: "self" };
    const was = g.members.length + (g.guests || []).length;
    g.members = g.members.filter((m) => m !== hash);
    g.guests = (g.guests || []).filter((m) => m !== hash);
    if (g.members.length + (g.guests || []).length === was) return { error: "gone" };
    moSays(board, g.id, "out", them.handle);
    /* The same end a room comes to when people leave it: nobody left is not an
       empty room, it is no room. See the leave route. */
    if (g.members.length < 2) {
      board.groups = board.groups.filter((x) => x.id !== id);
      board.says = board.says.filter((m) => m.group !== id);
      return { ok: true, gone: true };
    }
    return { ok: true };
  });
  if (out?.error) return res.status(out.error === "notyours" ? 403 : 400).json(out);
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
    /* SOMEBODY IN THE ROOM, AND NEVER YOUR OWN WORDS.
       A GUEST COUNTS. They were put in here by somebody else and are reading
       every word of it before they have given a name — which makes them the
       person in this room most likely to need this and the one who had it
       taken away. Report is on the line under every message on their screen;
       a button that is drawn and refuses is worse than one that is not there,
       and on this particular button it is worse than that. */
    const here = g && (g.members.includes(me) || (g.guests || []).includes(me));
    if (!here || m.by === me) return { error: "gone" };
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
/* NOT BEHIND `gate`, AND THAT IS THE POINT OF THE WHOLE CHANGE.
 *
 * `gate` asks whether this browser spent an invite. Somebody who walked into
 * a door room with a name did not — the room link is its own way in — so
 * every one of them would be refused here, which is exactly the people this
 * is for.
 *
 * What replaces it is stricter, not looser, and it is inside the write where
 * it can be checked against the board rather than believed: you may follow
 * somebody if you have a page that is out in Browse, OR if the two of you are
 * standing in the same room. Neither is a thing a browser can claim. And a
 * follow is only ever stored under the follower's own device hash, so nobody
 * can press it on anybody else's behalf.
 */
app.post("/api/follow", express.json({ limit: "8kb" }), async (req, res) => {
  const me = hashDevice(String(req.body?.device || ""), SALT);
  const who = String(req.body?.who || "");
  if (!me || !store.FOLLOW_ID.test(who)) return res.status(400).json({ error: "no" });
  const on = req.body?.on !== false;
  /* WHICH ROOM THEY WERE BOTH STANDING IN, when that is how this was pressed.
     Sent by the room screen; the checks below decide whether it is true. */
  const room = String(req.body?.room || "");

  let why = "";
  const out = await change((board) => {
    /* SOMEBODY AT A DOOR IS A PERSON YOU CAN FOLLOW.
     *
     * They have no page, so they are addressed as "w:<row>" — see cleanFollow.
     * Shaped like a person here so every check below reads the same for both,
     * and without an id, because there is no page to open.
     */
    const target = who.startsWith("w:")
      ? (() => {
          const w = board.waits.find((x) => x.id === who.slice(2) && !x.done && x.shown);
          return w && w.by ? { id: "", by: w.by, handle: w.name, state: "published",
                               wait: w } : null;
        })()
      : board.people.find((x) => x.id === who && x.state === "published");
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
    /* AND THE OTHER WAY TWO PEOPLE END UP ABLE TO REACH FOR EACH OTHER.
     *
     * The rule above is Browse's: you may reach for somebody because you let
     * yourself be seen. It is the right rule for a deck of strangers and the
     * wrong one for a room. Two people standing in the same room have already
     * seen each other — their names are on their messages, their lines are on
     * the screen — and telling one of them they may not press follow because
     * they have not written a profile yet is the board refusing the one thing
     * that would keep the conversation on it.
     *
     * SO: THE ROOM IS THE PERMISSION. Both of them in it, checked against the
     * board rather than believed — `room` names a door this browser can open,
     * and the person being followed is standing in it. Being in a room has
     * never meant being inside and it still does not: this opens one
     * conversation between two people who chose each other, and not one thing
     * more. No Browse, no member list, nobody they could not already see.
     */
    const together = (() => {
      /* A FOLLOW BACK IS ALWAYS ALLOWED, and without this the pair had a dead
       * end in it. A member reads a room without ever posting in it, follows
       * somebody standing in it — fine, she is in the room — and when she goes
       * to follow him back he is not "in" that room by any test the board can
       * make, because he has never said a word in it. So the second half could
       * never happen and the two of them could never talk.
       *
       * Somebody who has already reached for you has opted into exactly this.
       * Answering it needs no other permission. */
      const mineKey = followKey(board, me);
      if (mineKey && board.follows.some((f) => f.by === target.by && f.who === mineKey)) {
        return true;
      }
      if (!room || !store.WAITROOMS_CHAT.includes(room)) return false;
      if (!doorAccess(board, me, room)) return false;
      // The one being followed has to be standing in that same room.
      if (target.wait) return (target.wait.room || "other") === room;
      // A member is in every door room — but only counts as in THIS one if
      // they have actually said something in it, which is how anybody came to
      // be reading them.
      const id = store.doorRoom(room);
      return board.says.some((m) => m.group === id && m.by === target.by && m.text);
    })();

    const mine = board.people.find((x) => x.by === me);
    const seen = mine && mine.state === "published" && mine.handle
      && (mine.looking || mine.runBy);
    if (on && !seen && !together) {
      why = mine && mine.handle ? "hidden" : "nopage";
      return null;
    }
    const had = board.follows.findIndex((f) => f.by === me && f.who === who);
    if (on && had < 0) board.follows.push(store.cleanFollow({ by: me, who }));
    if (!on && had >= 0) board.follows.splice(had, 1);
    /* AND WHETHER THAT WAS THE SECOND HALF OF IT. The page says "you can
       write to them now" rather than leaving somebody to discover it. */
    return { count: store.followersOf(board.follows, who), following: on,
             both: on && bothFollow(board, me, target.by) };
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
  /* YOUR OWN PAGE IS YOURS WHATEVER STATE IT IS IN.
   *
   * `make hide` puts somebody back to held — out of Browse, out of matches,
   * off their public page — and it hid them from THEMSELVES: their own
   * profile answered "No profile yet", as though the board had forgotten a
   * person who was standing in front of it. That is the wrong lesson to teach
   * somebody about a place holding their work.
   *
   * Held means nobody else may see it. It has never meant they may not. */
  const q = board.people.find((x) => x.handle.toLowerCase() === want
    && (x.state === "published" || (me && x.by === me)));
  if (!q) return res.json({ person: null });
  const live = board.posts.filter((p) => p.state === "published");
  res.set("Cache-Control", "no-store");
  res.json({
    /* HOW MANY PLACES ARE LEFT IN THE LAYER STILL FILLING.
     *
     * Beside `person` rather than inside it, because it is a fact about the
     * board and not about them — and it is on a page rather than on the feed,
     * which is the whole decision. A row at the top of the deck saying the
     * same thing every visit is the app talking about itself in the place
     * people came to look at other people; that is why the fourth state came
     * out of drawMine. This is a fact somebody went and looked at.
     *
     * Their own page only. On somebody else's it answers a question nobody
     * asked and turns their card into a recruitment poster. */
    layerNow: (me && q.by === me) ? layerNow(board) : null,
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
    /* Whether there is a doorman to put on this screen — the same flag
       /api/me and /api/notes carry, so the page can mount him without a
       second request and he never appears as a circle that answers nothing. */
    butler: butler.configured(),
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

/** WHAT YOU HAVE EARNED HERE — AND ONLY EVER TO YOU.
 *
 *  THE NUMBER IS NOT ON ANYBODY'S PAGE AND NEVER WILL BE. A board that prints
 *  what somebody earned on their profile is a board people decline to join,
 *  and doubly so for the half of this one that reads Chinese. This route
 *  answers for the reader and for nobody else: there is no handle parameter to
 *  ask about somebody else with, deliberately.
 *
 *  AND IT IS NOT A BALANCE. The board never holds the money, never sees a bank
 *  and cannot see a Wise transfer. What it has is two kinds of record, and
 *  they are different kinds of truth:
 *
 *    - `seen`: rows the payment page wrote, where Stripe watched the money
 *      arrive. These the board knows.
 *    - `said`: rows where the payer tapped "I paid this" and the payee tapped
 *      "it arrived". These are two people's word, which is worth a great deal
 *      and is not a bank statement.
 *
 *  The screen keeps them apart because calling the sum a balance is the kind
 *  of quiet lie somebody takes to an accountant.
 *
 *  CURRENCIES ARE NOT ADDED UP. ¥30,000 and A$2,000 are two totals, not one:
 *  summing them needs a rate this board would have to invent, and an invented
 *  total is worse than two true ones.
 */
app.get("/api/earned", notesOff, async (req, res) => {
  const me = hashDevice(String(req.get("x-board-device") || ""), SALT);
  res.set("Cache-Control", "no-store");
  if (!me) return res.json({ rows: [], totals: [], waiting: [] });

  const board = await store.load(FILE);
  const mine = board.people.find((q) => q.by === me);
  if (!mine?.handle) return res.json({ rows: [], totals: [], waiting: [] });

  const rows = [], waiting = [];
  for (const g of board.groups) {
    const d = g.deal;
    if (!d || !g.members.includes(me)) continue;
    /* ONLY WHAT YOU WERE PAID. The other side of the same row is money you
       spent, and a page called Earned that quietly includes it is wrong in
       the direction that flatters. */
    if (d.provides !== mine.handle) continue;
    const plan = Array.isArray(d.plan) ? d.plan : [];
    plan.forEach((row, i) => {
      const said = (d.paid || []).filter((r) => r.i === i);
      const claim = said.find((r) => r.kind === "claimed");
      const okd = said.find((r) => r.kind === "confirmed");
      const it = {
        group: g.id, i,
        title: d.title || g.name || "",
        label: row.label || "",
        amount: row.amount || "",
        cur: d.cur || "",
        from: d.hires || "",
      };
      if (claim && okd) {
        rows.push({ ...it, at: okd.at, seen: Boolean(claim.auto && okd.auto) });
      } else {
        /* NOT COUNTED, AND SAID SO ON THE SCREEN. A total that includes money
           somebody has not got is the one that gets them hurt. */
        waiting.push({ ...it, due: row.due || "" });
      }
    });
  }
  rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));

  /* Per currency, and in the currency's own smallest unit so the arithmetic is
     integer — a float total of money is a rounding error waiting for somebody
     to notice it. Rows whose amount is words rather than a number are counted
     nowhere and said separately; see readMoney. */
  const pot = new Map();
  let unreadable = 0;
  for (const r of rows) {
    const minor = store.toMinor(r.amount, r.cur);
    if (!minor) { unreadable += 1; continue; }
    const k = r.cur || "?";
    const was = pot.get(k) || { cur: k, minor: 0, seen: 0, n: 0 };
    was.minor += minor;
    if (r.seen) was.seen += minor;
    was.n += 1;
    pot.set(k, was);
  }
  const totals = [...pot.values()]
    .sort((a, b) => b.minor - a.minor)
    .map((t) => ({
      cur: t.cur, n: t.n,
      /* Rendered here rather than at the screen. A page that divides by a
         hundred itself will one day do it to yen and be twenty times out. */
      all: store.fromMinor(t.minor, t.cur),
      seen: t.seen ? store.fromMinor(t.seen, t.cur) : "",
      said: t.minor - t.seen ? store.fromMinor(t.minor - t.seen, t.cur) : "",
    }));

  res.json({ rows, totals, waiting, unreadable });
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
    /* WHICH LAYER IS FILLING, AND HOW MANY PLACES ARE LEFT IN IT. Their own
       layer is on their card; this is the one still open, which is the half a
       member can actually do something about. */
    layerNow: layerNow(board),
    rank: rankOf(board, me),
    /* The half of the sentence they do not get to pick. Sent whether or not
       they have one: the page needs to know the difference between "fixed to
       producer" and "nobody ever asked", and an absent field says neither. */
    sayMe: roleFromWait(board, mine),
    // Whether the panel shows the offer block. The check that matters is
    // on POST /api/offer; this only decides whether a button is drawn.
    canOffer: Boolean(mine && mine.canOffer),
    // Whether the + draws the third line. The check that matters is on
    // POST /api/announce; this only decides whether a button exists.
    canAnnounce: Boolean(mine && mine.canAnnounce),
    /* Whether there is a doorman to draw — the same flag /api/wait/me carries
       for the waiting room, and for the same reason: a circle that offers a
       conversation and answers 503 is worse than no circle. */
    butler: butler.configured(),
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

  /* WHETHER THE LINE ITSELF CHANGED, read inside the write where the old one
     is still there. The page saves the whole profile on every edit, so
     without this, picking a new photograph would re-render a sentence nobody
     touched — see renderBio. */
  let bioChanged = false;
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
        const next = String(req.body[k]).slice(0, k === "goal" ? 600 : k === "li" ? 200 : 120);
        if (k === "goal" && next.trim() !== String(q.goal || "").trim()) {
          bioChanged = true;
          /* The old rendering is of the old sentence and is now wrong in a way
             that is worse than missing: it would be shown, in Chinese, saying
             something they have just stopped saying. Cleared here and filled
             again when the new one lands. */
          q.goalAlt = "";
          q.goalLang = "";
        }
        q[k] = next;
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

    /* THE GUEST BECOMES SOMEBODY.
     *
     * They were invited into one conversation and have been reading it without
     * a name. This save is the name. They move from `guests` to `members` and
     * the room gains a person — which is the first thing anybody already in it
     * sees of them, and it has a face and a sentence on it rather than being a
     * stranger who appeared yesterday.
     *
     * THE FOLLOWS, BOTH WAYS, WITH WHOEVER MADE THE ROOM. Every other person
     * in there matched with them; this keeps that true rather than leaving one
     * member who is in it by a different rule. Faking a follow is allowed here
     * for the same reason it is in POST /api/pair and no other: the maker sent
     * this code to this person, and this person walked through it and typed
     * their name into that room. That is consent twice over, from both sides,
     * and it is a stronger pair of acts than the two taps it stands in for.
     *
     * It opens a thread between them. It moves no contact: a card still needs
     * both of them to press give. And it is not a promise that matched() comes
     * back true — the rooms are the other half and neither of them has been
     * asked about those yet. The group does not care; it reads `members`.
     *
     * NO CAP CHECK. A guest has held a seat in this room since the code was
     * minted (see groupRoom), so moving one across leaves the total where it
     * was. The cap is enforced at the two places somebody is ADDED. */
    if (q.handle && q.state === "published") {
      for (const g of board.groups) {
        if (!(g.guests || []).includes(me)) continue;
        g.guests = g.guests.filter((x) => x !== me);
        if (!g.members.includes(me)) g.members.push(me);
        const maker = board.people.find((x) => x.by === g.by);
        if (maker && g.by !== me) {
          const put = (by, who) => {
            if (!who || board.follows.some((f) => f.by === by && f.who === who)) return;
            const f = store.cleanFollow({ by, who });
            if (f) board.follows.push(f);
          };
          put(me, maker.id);
          put(g.by, q.id);
        }
        Object.assign(g, store.cleanGroup(g));
      }
    }

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
  /* AND THE OTHER LANGUAGE OF THE LINE, after the answer rather than before
     it — see renderBio. Only when it changed: the page saves the whole
     profile on every edit, so without this check picking a new photograph
     would re-translate a sentence nobody touched. */
  if (bioChanged) renderBio(out.id, out.goal);
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
/** Everything the operator asked about two people, in the one shape both the
 *  question and the making of it answer in. Names only — nothing about either
 *  person's device leaves this route. */
function pairReport(board, a, b) {
  const follows = (x, y) => board.follows.some((f) => f.by === x.by && f.who === y.id);
  const shared = store.sharedRooms(a, b);
  const side = (p) => ({ name: p.handle, rooms: p.rooms || [], where: p.where || "cn",
                         wants: p.wants || "any", looking: Boolean(p.looking), state: p.state });
  /* SHUT EITHER WAY BEATS A MATCH — see threadState, where leaving and
     blocking both come before the match test. Reported because a pair that
     passes all four tests and still has no thread is otherwise a bug hunt,
     and this is the answer to it. */
  const shut = board.blocks.some((x) => (x.by === a.by && x.who === b.id)
      || (x.by === b.by && x.who === a.id))
    || board.shuts.some((x) => (x.by === a.by && x.who === b.by)
      || (x.by === b.by && x.who === a.by));
  return {
    a: side(a), b: side(b),
    aFollowsB: follows(a, b),
    bFollowsA: follows(b, a),
    scopeFits: store.scopeFits(a, b),
    shared: shared.map((x) => x.mine + " ↔ " + x.theirs),
    shut,
    matched: matched(board, a.by, b.by),
  };
}

/** The room A would have to tick for B's sentence to answer it, or "". Named
 *  and never ticked — see the note on POST. "Which box, then" is the next
 *  question every single time. */
const roomToTick = (a, b) => (b.rooms || [])
  .map(store.answerTo)
  .find((r) => !(a.rooms || []).includes(r)) || "";

const findByName = (board, name) => board.people.find(
  (q) => (q.handle || "").toLowerCase() === String(name || "").trim().toLowerCase());

app.get("/api/pair", admin, async (req, res) => {
  const board = await store.load(FILE);
  res.set("Cache-Control", "no-store");
  const a = findByName(board, req.query.a), b = findByName(board, req.query.b);
  if (!a || !b) {
    return res.status(404).json({ error: "who", missing: [!a && req.query.a, !b && req.query.b].filter(Boolean) });
  }
  res.json({ ...pairReport(board, a, b), tick: roomToTick(a, b) });
});

/* MAKING THE PAIR, which is the one thing on this board done on somebody
 * else's behalf.
 *
 * A follow is the consent half, and the product never fakes one: /api/follow
 * is a tap on their page, and pair.mjs says in so many words that nobody can
 * do it for them. This breaks that rule on purpose, in one place, for the
 * operator only. What it buys and what it does not is worth being exact
 * about, because the difference is the whole reason it is allowed to exist.
 *
 * IT OPENS A THREAD AND NOTHING ELSE. Both follow rows go in, so the two of
 * them can write to each other in Messages. No contact moves: a card still
 * needs both of them to press give, and those two decisions are untouchable
 * from here. So the worst this can do is put a conversation in front of
 * somebody who was invited here to have one.
 *
 * IT CANNOT FAKE THE OTHER HALF, AND MUST NOT. The rooms decide whether two
 * sentences answer each other, and the sentence is the whole product —
 * rewriting somebody's so that a match comes out is the one thing this must
 * never do. When the rooms do not pair it says which box would fix it and
 * leaves the ticking to the person whose box it is.
 *
 * WHY IT EXISTS. Every person brought in by name — an invite minted for them,
 * a room held open — arrived to a board where the person who invited them was
 * unreachable until both of them had found each other in Browse and pressed
 * the same button. That is the right rule between two strangers and the wrong
 * one between somebody and the person who let them in.
 *
 *   make match A="Tom" B="Brendan"
 */
app.post("/api/pair", admin, express.json({ limit: "2kb" }), async (req, res) => {
  const out = await change((board) => {
    const a = findByName(board, req.body?.a), b = findByName(board, req.body?.b);
    if (!a || !b) {
      return { error: "who", missing: [!a && String(req.body?.a || ""),
                                       !b && String(req.body?.b || "")].filter(Boolean) };
    }
    if (a.id === b.id) return { error: "self" };
    /* BOTH PAGES PUBLISHED, because matched() reads two rows that are on the
       board and a draft is not on it. Following a draft writes a row pointing
       at somebody nobody can see and the thread still does not open — a silent
       no, which is the exact failure this pair of routes exists to end. */
    const draft = [a, b].filter((p) => p.state !== "published").map((p) => p.handle);
    if (draft.length) return { error: "draft", who: draft };

    const made = [];
    const put = (x, y) => {
      // Pressing Follow twice is one follow, and so is running this twice.
      if (board.follows.some((f) => f.by === x.by && f.who === y.id)) return;
      const f = store.cleanFollow({ by: x.by, who: y.id });
      if (!f) return;
      board.follows.push(f);
      made.push(x.handle + " → " + y.handle);
    };
    put(a, b);
    put(b, a);
    return { made, ...pairReport(board, a, b), tick: roomToTick(a, b) };
  });
  if (out.error === "who") return res.status(404).json(out);
  if (out.error) return res.status(409).json(out);
  res.json(out);
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
      /* WHETHER THERE IS ANYTHING ON THE PAGE, as a yes or no and never the
         words themselves. `make who` lists the profiles held for review and
         the operator's next move is releasing them — but a page with no
         sentence and no line on it goes into Browse as a name over an empty
         card, which makes the deck worse rather than fuller. That is the whole
         decision, and it was being made blind: eighteen names, no way to tell
         which six were worth the command. A boolean answers it and carries
         nothing out of here that the panel does not already show. */
      hasCard: Boolean(q.goal || (Array.isArray(q.say) && q.say.length)),
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
/* THE LINES THAT WERE WRITTEN BEFORE ANY OF THIS EXISTED.
 *
 * renderBio runs when somebody saves a line, which does nothing for the cards
 * already on the board — and those are the ones a reader sees. One pass, one
 * call per card, and it says what it did.
 *
 * ONE AT A TIME, NOT ALL AT ONCE. Twenty cards in parallel is twenty requests
 * to the same provider in the same second, which is the shape that earns a
 * 429 and leaves half the board done. It is a command somebody runs from a
 * terminal and waits ten seconds for.
 *
 * SKIPS WHAT IS ALREADY RENDERED, so running it twice costs nothing and
 * running it after adding one card renders one card.
 */
app.post("/api/bios", admin, async (req, res) => {
  if (!translateReady()) return res.status(503).json({ error: "unconfigured" });
  const board = await store.load(FILE);

  /* AND THE MESSAGES ALREADY IN THE ROOMS. renderSay runs when a line is
     said, which does nothing for the ones already there — and a room that
     reads in one language for everything before today and both languages
     after it is a room somebody scrolls back through and gives up on.
     RECENT ONES ONLY, AND CAPPED. Messages accumulate for ever and every one
     is a call; the rooms are where people are reading now, so a fortnight is
     the whole of what anybody scrolls. */
  const DAYS = Math.max(1, Math.min(90, Number(req.query.days) || 14));
  const CAP = 200;
  const cut = Date.now() - DAYS * 86400_000;
  const says = board.says.filter((m) => m.text && !m.alt && !m.evt
    && (Date.parse(m.at || "") || 0) > cut).slice(-CAP);
  let lines = 0;
  for (const m of says) {
    const words = String(m.text).trim();
    if (!/[\p{L}]{2}/u.test(words)) continue;
    const out = await renderPair(words, "say:" + m.id);
    if (!out) continue;
    await change((b) => {
      const row = b.says.find((x) => x.id === m.id);
      if (!row || String(row.text || "").trim() !== words) return null;
      row.alt = out.alt;
      row.alt2 = out.alt2;
      row.lang = out.lang;
      return true;
    });
    lines += 1;
  }

  /* AND THE LINES OF THE PEOPLE STILL AT THE DOOR. renderWhy runs when one
     lands, which does nothing for the sixty rows already standing there — and
     those are the ones a member is reading when they decide whether to vouch.
     Capped like the messages: a call each, from a terminal somebody is
     sitting at. */
  const waits = board.waits.filter((w) => !w.done && String(w.why || "").trim()
    && !w.whyAlt).slice(0, CAP);
  let asked = 0;
  for (const w of waits) {
    const words = String(w.why).trim();
    if (!/[\p{L}]{2}/u.test(words)) continue;
    const out = await renderPair(words, "why:" + w.id);
    if (!out) continue;
    await change((b) => {
      const row = b.waits.find((x) => x.id === w.id);
      if (!row || String(row.why || "").trim() !== words) return null;
      row.whyAlt = out.alt;
      row.whyAlt2 = out.alt2;
      row.whyLang = out.lang;
      return true;
    });
    asked += 1;
  }

  const todo = board.people.filter((q) => q.handle && String(q.goal || "").trim() && !q.goalAlt);
  const done = [];
  const failed = [];
  for (const q of todo) {
    const words = String(q.goal).trim();
    const out = await renderPair(words, "bio:" + q.id);
    if (!out) { failed.push(q.handle); continue; }
    await change((board2) => {
      const row = board2.people.find((x) => x.id === q.id);
      if (!row || String(row.goal || "").trim() !== words) return null;
      row.goalAlt = out.alt;
      row.goalAlt2 = out.alt2;
      row.goalLang = out.lang;
      return true;
    });
    done.push(q.handle);
  }
  res.json({ ok: true, done, failed, lines, asked,
    already: board.people.filter((q) => q.handle && q.goalAlt).length });
});

/* WHAT HAPPENED SINCE YESTERDAY, ON ONE SCREEN.
 *
 * The operator reads this board on a phone, in a queue, between two other
 * things — the same way everybody else reads it. Everything he needs to know
 * was spread across five commands at a terminal he is not sitting at, so it
 * was read once a day at best and usually not at all.
 *
 * ORDERED BY WHAT HE CAN DO ABOUT IT. Who arrived and who spoke come first,
 * because those are people waiting on a person; the counts come last, because
 * a count is a thing to glance at. Names, not totals, wherever a name is what
 * he would act on — "3 new at the door" is a number he cannot do anything
 * with and "Liza, Brendan, Mei" is three decisions.
 *
 * READ-ONLY, AND ITS OWN SECRET. See SNAP. Nothing here changes anything, and
 * the token that opens it opens nothing else.
 */
const snapGate = (req, res, next) => {
  const given = String(req.query.t || req.params.token || "");
  if (!SNAP || !safeEqual(given, SNAP)) return res.status(404).send("Not found");
  next();
};

app.get("/api/snap", snapGate, async (_req, res) => {
  res.set("Cache-Control", "no-store");
  const board = await store.load(FILE);
  const now = Date.now();
  const since = (iso, hours) => (Date.parse(iso || "") || 0) > now - hours * 3600_000;

  /* A DAY, NOT A CALENDAR DAY. He might open it at midnight or at noon, and
     "since yesterday" meaning "since 00:00" is a screen that says nothing
     every morning and everything every evening. */
  const DAY = 24;

  const open = board.waits.filter((w) => !w.done);
  const at = (w) => w.at;

  const rooms = store.WAITROOMS_CHAT.map((key) => {
    const id = store.doorRoom(key);
    const said = board.says.filter((m) => m.group === id);
    return {
      room: key,
      /* People standing in it, not lines in it — the thing worth knowing
         before reading a word. Same count the door header shows. */
      n: open.filter((w) => (w.room || "other") === key && w.shown).length,
      /* WHAT PEOPLE SAID, not what the room said about itself. Mo announces
         every arrival, so counting every line made three people walking in
         look like eight messages — the one number on this row that is meant
         to mean "somebody is talking in here". */
      today: said.filter((m) => since(m.at, DAY) && !m.evt && m.text).length,
      last: said.length ? said[said.length - 1].at : "",
    };
  }).filter((r) => r.n || r.today);

  /* THE ONES A PERSON IS WAITING ON. A profile held with something written on
     it is somebody who did the work and is sitting behind a queue; a
     photograph in the queue is the same. Both are his, and both are the kind
     of thing that goes unnoticed for a week. */
  const held = board.people.filter((q) => q.handle && q.state !== "published"
    && String(q.goal || "").trim()).map((q) => q.handle);
  const faces = board.people.filter((q) => q.handle && q.photo
    && q.photoState !== "published").map((q) => q.handle);

  res.json({
    at: new Date().toISOString(),
    /* WHO ARRIVED, by name and room. */
    came: open.filter((w) => since(at(w), DAY))
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, 20)
      .map((w) => ({ name: w.name, room: w.room || "other", at: w.at })),
    /* WHO SPOKE, and what they said. The line itself, because the whole point
       of the rooms is that somebody says something worth answering, and a
       count of messages is exactly the thing that does not tell him that. */
    said: board.says.filter((m) => since(m.at, DAY) && m.by !== store.MO && m.text)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, 12)
      .map((m) => {
        const q = board.people.find((x) => x.by === m.by && x.handle);
        const w = board.waits.find((x) => x.by === m.by && !x.done);
        return {
          who: q ? q.handle : (w ? w.name : ""),
          inside: Boolean(q),
          room: store.doorKey(m.group) || "",
          text: String(m.text).slice(0, 140),
          at: m.at,
        };
      }),
    rooms,
    waiting: { held, faces },
    /* AND THE SHAPE OF THE PLACE, last, because it changes slowly. */
    board: {
      inBrowse: board.people.filter((q) =>
        q.state === "published" && q.looking && q.handle).length,
      peek: board.people.filter((q) => q.peek && q.looking
        && q.state === "published" && q.handle).length,
      asked: board.waits.length,
      outside: open.length,
    },
  });
});

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

/* THE PANEL COULD NOT SEE A SINGLE FACE.
 *
 * Every row in its People tab said "would not load", because the picture was
 * fetched from /api/public-media — which is behind the door on purpose (see
 * the long note above OPEN_PATHS), and the panel is a different origin with no
 * board cookie on it. So the operator uploaded a photograph, the upload
 * worked, and the panel showed the same grey circle as before: indisting-
 * uishable from a failure, and reported as one.
 *
 * NOT FIXED BY OPENING public-media. That route stays shut for the reason it
 * was shut: a member's face should not be fetchable by anybody holding its id.
 * This is the same bytes behind the admin key, which the panel already holds
 * and already uses to put the picture there in the first place.
 *
 * no-store, because the whole point of looking at it is to see the one that
 * was just uploaded.
 */
app.get("/api/face/img", admin, async (req, res) => {
  const found = await findMedia(req.query.id);
  if (!found) return res.status(404).json({ error: "no such file" });
  res.set("Content-Type", found.type);
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Cache-Control", "no-store");
  res.sendFile(found.file);
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
  /* Made here rather than on the first form, so two people filling one in at
     the same moment cannot race for the file and leave one of them with a
     sealed card nothing can open. */
  try { sealed.ready(DIR); } catch (err) { console.error("payout key:", err.message); }
  if (!KEY) console.error("BOARD_ADMIN_KEY is not set — the admin routes will refuse everything.");
  if (!SALT) console.error("BOARD_SALT is not set — device hashes are unsalted.");
});
