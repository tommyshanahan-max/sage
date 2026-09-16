/* Telling a phone something arrived, when the phone is holding a real app.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS AT ALL, GIVEN push.js ALREADY WORKS
 *
 * push.js is Web Push: the browser subscribes, the board POSTs an empty signed
 * request to whatever URL the browser handed over, and the phone buzzes. It
 * works in Safari and it works in a PWA somebody has added to their home
 * screen, and for most of this board's life that was every case there was.
 *
 * It does not work inside an app. A WKWebView — which is what an App Store
 * build of this is — has no Push API at all, so an app wrapping these same
 * pages would have shipped with the notifications quietly turned off. That is
 * the one feature that makes this worth being an app rather than a tab, so the
 * app cannot ship without this file.
 *
 * BOTH, NOT ONE OR THE OTHER. Nobody is being moved off the web version, and a
 * person may have the site on one phone and the app on another. A row in
 * `pushes` is now either a browser subscription or a device token, and tell()
 * in push.js sends each by whichever it is. See cleanPush in store.js.
 *
 * ---------------------------------------------------------------------------
 * STILL NO DEPENDENCY, AND THIS ONE IS HARDER
 *
 * The same argument as push.js: every package is code running on the box that
 * holds what members write, and this board has two of them.
 *
 * APNs makes it harder in one specific way — it speaks HTTP/2 and refuses
 * HTTP/1.1 outright. node's fetch is HTTP/1.1, so this uses node:http2, which
 * is in the runtime and costs nothing. The connection is kept open between
 * pushes because opening one is a TLS handshake and a phone buzzing is not
 * worth a handshake.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS IN THE PUSH, WHICH IS AS LITTLE AS APNs ALLOWS
 *
 * The web half sends NO payload — the wording lives in sw.js and is the same
 * every time — and the reasoning is written out at the top of push.js: a lock
 * screen is the least private surface a phone has, and a notification that
 * CANNOT leak a name is worth more than one that promises not to.
 *
 * APNs will not show anything without an alert body, so this one has to carry
 * a payload. It carries the same fixed words and nothing else: no name, no
 * room, no message, no count. The board sends exactly as much as it sent
 * before, which is that something happened.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS SET ON THE BOX
 *
 *   BOARD_APNS_KEY     the .p8 from developer.apple.com, contents and all
 *   BOARD_APNS_KEY_ID  the ten characters Apple names that key by
 *   BOARD_APNS_TEAM    the team it belongs to, also ten characters
 *   BOARD_APNS_TOPIC   the app's bundle id, e.g. app.thexchange
 *   BOARD_APNS_HOST    "sandbox" while building, empty for the real one
 *
 * A key belongs to a TEAM and not to an app, so the one already minted for
 * another app in the same account is the one to use here.
 *
 * Unset, this file does nothing and says nothing — the same shape as push.js
 * with no VAPID pair. An app build with no key configured is an app with no
 * notifications, which is a bad day; a board that refuses to boot because a
 * key it does not need yet is missing is a worse one.
 */

import { createPrivateKey, sign as cryptoSign } from "node:crypto";
import http2 from "node:http2";

const KEY = (process.env.BOARD_APNS_KEY || "").trim();
const KEY_ID = (process.env.BOARD_APNS_KEY_ID || "").trim();
const TEAM = (process.env.BOARD_APNS_TEAM || "").trim();
const TOPIC = (process.env.BOARD_APNS_TOPIC || "").trim();
/* The two APNs hosts are different servers, and a token minted on a phone
   running a development build is meaningless to the production one — it
   answers 400 BadDeviceToken, which reads like a bug in the token rather than
   a build talking to the wrong house. */
const HOST = /^sandbox$/i.test(String(process.env.BOARD_APNS_HOST || "").trim())
  ? "https://api.sandbox.push.apple.com"
  : "https://api.push.apple.com";

export const configured = () => Boolean(KEY && KEY_ID && TEAM && TOPIC);

const b64url = (buf) => Buffer.from(buf).toString("base64")
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/* THE .p8 IS ALREADY PEM, which is the one mercy in this file — unlike the
   VAPID pair, which arrives as raw base64url and has to be rebuilt into a JWK
   before node will look at it. Newlines survive a trip through .env badly, so
   an escaped \n is put back: a key pasted into a one-line env var is the
   commonest way this is set and it should not be the commonest way it fails. */
let PKEY = null;
function privateKey() {
  if (PKEY) return PKEY;
  PKEY = createPrivateKey(KEY.includes("\\n") ? KEY.split("\\n").join("\n") : KEY);
  return PKEY;
}

/* ONE TOKEN, REUSED FOR AN HOUR.
 *
 * Apple rejects a token older than an hour, and — separately and more sharply
 * — rejects a sender that mints them too often, with a 429 that lasts. So this
 * is cached and re-minted at fifty minutes, which is the same shape as the
 * VAPID cache in push.js and for a stricter reason. */
let TOK = { jwt: "", at: 0 };
function token() {
  const now = Math.floor(Date.now() / 1000);
  if (TOK.jwt && now - TOK.at < 50 * 60) return TOK.jwt;
  const head = b64url(JSON.stringify({ alg: "ES256", kid: KEY_ID }));
  const body = b64url(JSON.stringify({ iss: TEAM, iat: now }));
  const data = Buffer.from(head + "." + body);
  /* ieee-p1363 and not der, for the same reason as push.js: a JOSE signature
     is r and s as raw bytes, node's default for EC is DER, and Apple answers a
     403 InvalidProviderToken that says nothing about which of the two it is. */
  const sig = cryptoSign("sha256", data, { key: privateKey(), dsaEncoding: "ieee-p1363" });
  TOK = { jwt: head + "." + body + "." + b64url(sig), at: now };
  return TOK.jwt;
}

/* ONE CONNECTION, KEPT. Opening an HTTP/2 session to Apple is a TLS handshake,
   and there is one of these per message per device. Reopened when it dies,
   which it does — Apple closes idle sessions and says nothing about it. */
let SESSION = null;
function session() {
  if (SESSION && !SESSION.closed && !SESSION.destroyed) return SESSION;
  SESSION = http2.connect(HOST);
  /* NEVER LET A DEAD SOCKET THROW INTO THE PROCESS. An unhandled 'error' on an
     http2 session takes the board down, and the board going down because a
     phone could not be told about a message is the wrong trade by a distance. */
  SESSION.on("error", () => { SESSION = null; });
  SESSION.on("close", () => { SESSION = null; });
  /* AND NEVER LET ONE SIT THERE HALF-OPEN.
   *
   * Found by running it: with no route to Apple, http2.connect neither
   * connects nor fails — it waits — and a request queued on a session that has
   * not connected never fires its own timeout, because there is no stream yet
   * to time out. The test hung until it was killed, which is what this would
   * have done to a message send on a box whose network had gone.
   *
   * Twenty seconds of silence and the session is destroyed, which rejects
   * everything queued on it and makes the next push open a fresh one. */
  SESSION.setTimeout(20_000, () => {
    try { SESSION && SESSION.destroy(); } catch {}
    SESSION = null;
  });
  return SESSION;
}

/** Tell one device.
 *
 *  "gone" when Apple says the token is dead and the caller should drop it, ""
 *  on success, "fail" for everything else — the same three answers push.js
 *  gives, because tell() treats them the same way.
 */
/* WHAT A LOCK SCREEN SAYS, WHICH IS TWO FACTS AND NEITHER IS THE MESSAGE:
 * who it is from, and that somebody wrote. The same two the web half's sw.js
 * shows.
 *
 * BOTH LANGUAGES ON ONE LINE WHEN NOBODY SAID, which is every row stored
 * before the field existed. It is not a fallback that reads as broken — the
 * board's own name is written that way wherever it appears to strangers. */
const WORDS = (lang) => (
  lang === "zh" ? { title: "交换", body: "有人给你留言了" }
  : lang === "en" ? { title: "The Exchange", body: "Somebody wrote to you" }
  : { title: "交换 · The Exchange", body: "有人给你留言了 · Somebody wrote to you" }
);

export function one(deviceToken, lang) {
  return new Promise((resolve) => {
    /* SETTLED ONCE, WHATEVER HAPPENS.
     *
     * There are five ways out of this function — a response, an error, a
     * stream timeout, a throw while building the request, and the deadline
     * below — and two of them can fire for the same push. Resolving twice is
     * harmless to the promise and a lie to whoever is counting dead rows. */
    let over = false;
    const done = (why) => {
      if (over) return;
      over = true;
      clearTimeout(deadline);
      resolve(why);
    };
    /* THE OUTER DEADLINE, AND IT IS NOT BELT AND BRACES.
     *
     * The stream timeout further down only helps once there IS a stream. A
     * session that never connects — no route to Apple, a box whose network has
     * gone — leaves the request queued and nothing fires at all. That hung a
     * test until it was killed; on the box it would hang a message send.
     *
     * unref so a pending push cannot hold the process open at shutdown. */
    const deadline = setTimeout(() => done("fail"), 15_000);
    if (deadline.unref) deadline.unref();

    if (!configured()) return done("fail");
    let req;
    try {
      req = session().request({
        ":method": "POST",
        ":path": "/3/device/" + encodeURIComponent(deviceToken),
        authorization: "bearer " + token(),
        "apns-topic": TOPIC,
        /* alert, because this is a person being told somebody wrote to them.
           Without it Apple treats the push as background and may never show
           anything, which is the failure that looks like a delivery. */
        "apns-push-type": "alert",
        /* Wake the phone now. The same argument as Urgency: high on the web
           half — a message held until the device is next up anyway is the
           whole point missed. */
        "apns-priority": "10",
        /* A day, matching the web half's TTL. After that the message is not
           news and a buzz about it is an annoyance. */
        "apns-expiration": String(Math.floor(Date.now() / 1000) + 86400),
      });
    } catch { SESSION = null; return done("fail"); }

    let status = 0, body = "";
    /* NOBODY IS WATCHING A SPINNER — this runs after the reply has gone back —
       but a hung stream holds a slot, and there are as many of these as there
       are devices. */
    req.setTimeout(10_000, () => { try { req.close(); } catch {} done("fail"); });
    req.on("response", (h) => { status = Number(h[":status"]) || 0; });
    req.on("data", (c) => { body += c; });
    req.on("error", () => { SESSION = null; done("fail"); });
    req.on("end", () => {
      if (status === 200) return done("");
      /* THE TWO THAT MEAN THE PHONE IS GONE, and they are not the same thing:
         410 is a token Apple knows is dead, 400 BadDeviceToken is one that was
         never valid here — usually a sandbox token reaching production. Both
         mean stop sending to it; keeping it is a row that fails for ever. */
      let why = "";
      try { why = String(JSON.parse(body).reason || ""); } catch { why = ""; }
      if (status === 410 || why === "Unregistered" || why === "BadDeviceToken") return done("gone");
      /* WORTH SAYING OUT LOUD ONCE. Every other failure here is a
         misconfiguration that looks identical from the outside — a key for the
         wrong team, a bundle id that is not the app's, a production key
         against the sandbox host — and none of them are visible anywhere else.
         The device token is not logged: it identifies a phone. */
      if (status === 403 || status === 400) {
        console.error("apns: " + status + " " + (why || "no reason given")
          + " — check BOARD_APNS_KEY_ID, _TEAM and _TOPIC against the app");
      }
      done("fail");
    });
    req.end(JSON.stringify({
      /* THE SAME TWO LINES EVERY TIME, and see the note at the top: the web
         half sends no payload at all, and this sends the least Apple will
         accept. No name, no room, no message, no count — nothing a lock screen
         can leak, which is the property that matters and is unchanged.

         WORDS, AND THEY USED TO BE KEYS. A loc-key names a line in the app's
         own Localizable.strings, so iOS picked the language and two constants
         travelled instead of any text. That was the better shape on the wire
         and it cost a manual step in Xcode on every machine that ever builds
         this: two .lproj folders dragged into the target by hand, with the
         failure mode being a lock screen that says "PUSH_TITLE" to everybody.
         It was dropped the first time somebody tried to do it.

         So the words travel, in the language the browser said it was reading
         when it subscribed — which is the same guess iOS was making, made one
         step earlier by something that also knows. Written here rather than in
         i18n.js for the same reason MO_NAME is: this is the server, it has no
         i18n, and a line it sends is stored in the language it was written in. */
      aps: {
        alert: WORDS(lang),
        sound: "default",
        /* ONE LINE ON THE LOCK SCREEN, NOT ELEVEN, matching the web half's
           tag: eleven replies while somebody is asleep collapse into one. */
        "thread-id": "board-note",
      },
    }));
  });
}
