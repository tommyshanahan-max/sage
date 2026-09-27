/* A VIDEO CALL BETWEEN TWO PEOPLE IN A CONVERSATION.
 *
 * THE VIDEO NEVER PASSES THROUGH THIS FILE, and that is the whole shape of
 * it. Two browsers send it to each other directly (WebRTC); all this carries
 * is the handful of short messages they need to find each other — an offer, an
 * answer, and addresses to try. That is called signalling and it is kilobytes
 * per call, whatever the call's length.
 *
 * LONG-POLLING, NOT A SOCKET. Each browser asks "anything for me?" and the
 * question is held open up to twenty seconds until something arrives. It is
 * the least clever transport there is and that is the point: it is a plain
 * request, so it survives Caddy's compression, a Chinese mobile network that
 * drops idle connections, and a phone that sleeps between two polls. A socket
 * would be faster by milliseconds nobody in a conversation notices.
 *
 * ALL IN MEMORY, DELIBERATELY. A call is two queues and two timestamps. A
 * restart drops every call in progress and both sides simply ring again —
 * which is the right trade for something with no value after it ends. Nothing
 * here is written to the board file, so a call leaves no record beyond the
 * line the thread already shows.
 *
 * ---------------------------------------------------------------------------
 * A SECOND COPY OF AN IDEA THAT IS ALREADY ON THIS BOX, and it is worth being
 * honest about why. book/lib/room.mjs does the same job for a lesson. They are
 * separate containers with separate images and no shared module path, so
 * importing one from the other is not a thing that can be done here. What is
 * NOT duplicated is the part that actually differs: a lesson is authorised by
 * a key in a link, and a call here is authorised by being able to message the
 * person — the same notePermit that decides whether you may write to them.
 * ------------------------------------------------------------------------- */
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

/* THE RELAY, AND WHAT HAPPENS WITHOUT ONE.
 *
 * Most calls go phone to phone. Some networks — Chinese mobile networks
 * especially — will not let two phones reach each other at all, and those
 * calls need a relay in the middle (TURN). There is one on this box for the
 * lesson rooms; these two names point at it.
 *
 * UNSET IS A STATE THE SCREEN HAS TO KNOW ABOUT, not one to paper over. With
 * no relay a call works on the same network and fails everywhere else, and
 * the failure looks exactly like a call that is about to connect. So `relay()`
 * answers honestly and the page says "could not connect" after twenty seconds
 * rather than spinning until somebody gives up.
 */
const HOST = String(process.env.BOARD_TURN_HOST || "").trim();
const DIR = process.env.BOARD_DIR || "/data";
let SECRET = String(process.env.BOARD_TURN_SECRET || "").trim();

/* THE RELAY'S PASSWORD, MADE HERE AND NEVER TYPED BY ANYBODY.
 *
 * A secret somebody has to put in .env by hand, once per machine, with nothing
 * checking that they did, is a step that will one day be wrong — and the way
 * it goes wrong is silent: calls simply stop connecting for the half of people
 * on a mobile network. So this mints one on first start, keeps it, and writes
 * the relay's whole configuration beside it. The coturn container mounts this
 * volume read-only and reads that file. There is nothing to set and nothing to
 * remember.
 *
 * REWRITTEN ON EVERY START, so a changed address takes effect on a deploy
 * rather than on somebody noticing.
 *
 * Same idea as book/lib/room.mjs, which does this for the lesson rooms. If
 * both ever end up in one compose file they are one coturn and one of these
 * has to go; today they are two branches and only one is ever on the box.
 */
export function relaySetup() {
  if (!HOST || SECRET) return;
  try {
    mkdirSync(DIR, { recursive: true });
    const f = path.join(DIR, "turn-secret");
    try { SECRET = readFileSync(f, "utf8").trim(); } catch { /* first start */ }
    if (!/^[a-f0-9]{48}$/.test(SECRET)) {
      SECRET = randomBytes(24).toString("hex");
      writeFileSync(f, SECRET, { mode: 0o600 });
    }
    writeFileSync(path.join(DIR, "turnserver.conf"), [
      "listening-port=3478",
      "min-port=49210",
      "max-port=49250",
      `external-ip=${HOST}`,
      "use-auth-secret",
      `static-auth-secret=${SECRET}`,
      "realm=board",
      "fingerprint",
      "no-cli",
      "no-tls",
      "no-dtls",
      "no-multicast-peers",
      /* A RELAY IS A WAY TO REACH WHATEVER IT WILL REACH, so it is told what
         it may not. The private ranges are the containers on this box. The
         link-local one is the cloud's metadata service, which is the address
         that actually matters and the one most often left out: 169.254.169.254
         answers questions about this machine to anything that can reach it. */
      "denied-peer-ip=10.0.0.0-10.255.255.255",
      "denied-peer-ip=172.16.0.0-172.31.255.255",
      "denied-peer-ip=192.168.0.0-192.168.255.255",
      "denied-peer-ip=127.0.0.0-127.255.255.255",
      "denied-peer-ip=169.254.0.0-169.254.255.255",
      "denied-peer-ip=0.0.0.0-0.255.255.255",
      /* AND IT IS NOT A GENERAL-PURPOSE RELAY. A login lasts a day; without a
         ceiling that is a day of somebody else's traffic leaving this box
         under its address. A call needs one allocation and a few hundred
         kilobits; these are generous for that and useless for anything else. */
      "no-tcp-relay",
      "user-quota=4",
      "total-quota=200",
      "max-bps=600000",
      "",
    ].join("\n"));
  } catch {
    /* A READ-ONLY volume, or no volume at all — a board running on somebody's
       laptop. Calls fall back to no relay, which the screen says out loud
       rather than spinning. Never fatal: the board is not a phone. */
    SECRET = "";
  }
}

/** Whether a relay is configured at all. The screen asks, and `make call-check`
 *  asks, because "no relay" is the commonest reason a call will not connect
 *  and it is invisible from the outside. */
export const relay = () => Boolean(HOST && SECRET);

/** What a browser needs to find the other one, including a day's relay login.
 *
 *  THE PASSWORD ITSELF NEVER LEAVES THE BOX. coturn's REST scheme: the
 *  username is an expiry timestamp and the credential is that timestamp signed
 *  with the shared secret, so a login handed to a phone stops working on its
 *  own and cannot be turned back into the secret. */
export function iceServers() {
  if (!HOST) return [];
  const stun = [{ urls: [`stun:${HOST}:3478`] }];
  if (!SECRET) return stun;
  const user = `${Math.floor(Date.now() / 1000) + 86400}:board`;
  const cred = createHmac("sha1", SECRET).update(user).digest("base64");
  return [...stun, {
    urls: [`turn:${HOST}:3478?transport=udp`, `turn:${HOST}:3478?transport=tcp`],
    username: user, credential: cred,
  }];
}

/* ---------------------------------------------------------------------------
 * The calls themselves
 *
 * Keyed by the two device hashes, sorted, so either side names the same call
 * without either of them ever seeing the other's hash — the key is made here
 * and never sent anywhere. Each side has its own queue of messages waiting for
 * it and its own held-open request.
 * ------------------------------------------------------------------------- */
const CALLS = new Map();
const HERE_MS = 30e3;
/* A RING GIVES UP BY ITSELF. A phone in a pocket rings out; so does this, and
   at the same sort of length, so "did they see it" is answered rather than
   left hanging. */
export const RING_MS = 45e3;

const pairKey = (a, b) => [a, b].sort().join("~");

function call(a, b) {
  const k = pairKey(a, b);
  let c = CALLS.get(k);
  if (!c) {
    c = { q: {}, seen: {}, wait: {}, n: 0, ring: null };
    c.q[a] = []; c.q[b] = [];
    CALLS.set(k, c);
  }
  if (!c.q[a]) c.q[a] = [];
  if (!c.q[b]) c.q[b] = [];
  return c;
}

const here = (c, who) => Date.now() - (c.seen[who] || 0) < HERE_MS;

function push(c, who, m) {
  c.n += 1;
  if (!c.q[who]) c.q[who] = [];
  c.q[who].push({ n: c.n, m });
  // A queue that grows without bound is a call nobody is reading; keep the
  // tail, which is all a browser rejoining can use anyway.
  if (c.q[who].length > 200) c.q[who].splice(0, c.q[who].length - 200);
  const w = c.wait[who];
  if (w) { c.wait[who] = null; w(); }
}

/** Whether a ring is still live. Its own function because three places ask. */
const ringing = (c) => Boolean(c.ring && Date.now() - c.ring.at < RING_MS);

/** STARTING ONE. Returns false when the other side is already ringing this
 *  person — two people pressing call at the same moment is a real thing on a
 *  slow connection, and the earlier ring wins rather than both being replaced
 *  by a call neither of them is in. */
export function ring(me, them) {
  const c = call(me, them);
  c.seen[me] = Date.now();
  if (ringing(c) && c.ring.from !== me) return false;
  c.ring = { from: me, at: Date.now() };
  c.q[me] = [];
  c.q[them] = [];
  push(c, them, { type: "ring" });
  return true;
}

/** ANSWERING. The caller is told, and the ring stops being a ring. */
export function answer(me, them) {
  const c = call(me, them);
  c.seen[me] = Date.now();
  if (!ringing(c) || c.ring.from === me) return false;
  c.ring = null;
  push(c, them, { type: "answered" });
  return true;
}

/** HANGING UP, AND TURNING ONE DOWN ARE THE SAME PRESS to this file. What
 *  differs is only what the other screen says, and the other screen knows
 *  which of the two it was watching. */
export function bye(me, them) {
  const c = call(me, them);
  c.seen[me] = Date.now();
  c.ring = null;
  push(c, them, { type: "bye" });
}

/** An offer, an answer, or an address to try. Relayed untouched: only the two
 *  people in the conversation can reach this, and what they send each other is
 *  between their two browsers. */
export function send(me, them, m) {
  const c = call(me, them);
  c.seen[me] = Date.now();
  push(c, them, m);
}

/** Everything for me after `since`, waiting up to 20s for something to arrive.
 *
 *  ONE HELD REQUEST PER PERSON. A second poll from the same person — two tabs,
 *  or a phone that woke up and asked again — releases the first rather than
 *  leaving it hanging until it times out. */
export function poll(me, them, since) {
  const c = call(me, them);
  c.seen[me] = Date.now();
  const take = () => ({
    msgs: (c.q[me] || []).filter((x) => x.n > since),
    here: here(c, them),
    ringing: ringing(c) ? { from: c.ring.from === me ? "me" : "them" } : null,
  });
  const now = take();
  if (now.msgs.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const prev = c.wait[me];
    if (prev) prev();
    const timer = setTimeout(() => {
      if (c.wait[me] === done) c.wait[me] = null;
      resolve(take());
    }, 20e3);
    function done() { clearTimeout(timer); resolve(take()); }
    c.wait[me] = done;
  });
}

/** Where a call stands, for a screen that has just opened. No waiting. */
export function state(me, them) {
  const c = CALLS.get(pairKey(me, them));
  if (!c) return { since: 0, here: false, ringing: null };
  return {
    since: c.n, here: here(c, them),
    ringing: ringing(c) ? { from: c.ring.from === me ? "me" : "them" } : null,
  };
}

/** WHICH OF THESE PEOPLE IS RINGING ME, IF ANY.
 *
 * Asked once when the Chat page loads, and it is the other half of the push.
 * A buzz in a pocket is the thing that reaches somebody with the app shut; it
 * says "someone is calling you" and nothing else, on purpose. Opening the app
 * has to then show the call, or the buzz was a dead end — and the call is over
 * in forty-five seconds, so there is no time for anybody to go looking.
 *
 * `them` is a list of device hashes, which is what the inbox is working in
 * anyway. Scans the map once rather than once per thread: an inbox of forty
 * conversations is forty lookups otherwise, on every load, for a thing that is
 * almost always nothing.
 */
export function ringingFrom(me, them) {
  const want = new Set(them);
  for (const [k, c] of CALLS) {
    if (!ringing(c) || c.ring.from === me) continue;
    const ends = k.split("~");
    if (!ends.includes(me)) continue;
    const other = ends[0] === me ? ends[1] : ends[0];
    if (want.has(other)) return { by: other, at: c.ring.at };
  }
  return null;
}

// Calls nobody has touched in an hour are forgotten. Nothing in one is worth
// keeping and a map that only grows is a leak with a slow fuse.
setInterval(() => {
  const cut = Date.now() - 3600e3;
  for (const [k, c] of CALLS) {
    if (Math.max(0, ...Object.values(c.seen)) < cut) CALLS.delete(k);
  }
}, 600e3).unref?.();
