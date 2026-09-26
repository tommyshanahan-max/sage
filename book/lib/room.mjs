/* The lesson room: two people, one video call.
 *
 * THE VIDEO NEVER PASSES THROUGH THIS FILE. Browsers send it to each other
 * directly (WebRTC); all this does is carry the few short messages the two
 * browsers need to find each other — an offer, an answer, and addresses to
 * try. That is called signalling, and it is kilobytes per lesson.
 *
 * LONG-POLLING, NOT A SOCKET OR SERVER-SENT EVENTS. Each browser asks "anything
 * for me?" and the question is held open up to twenty seconds until something
 * arrives. It is the least clever transport there is, and that is the point:
 * it is a plain request, so it survives Caddy's compression, a mobile network
 * in China that drops idle connections, and a phone that sleeps between two
 * polls. A socket would be faster by milliseconds nobody in a lesson notices.
 *
 * ALL IN MEMORY. A room is two queues and two timestamps; a restart empties
 * it and both browsers simply introduce themselves again on their next poll.
 *
 * WHEN THE PHONES CANNOT REACH EACH OTHER DIRECTLY — common on Chinese mobile
 * networks — the video goes through a relay (TURN) on this same box: the
 * `turn` container in docker-compose.yml. Its password is minted here on
 * first start and written where that container reads it, so there is no
 * secret for anybody to put in .env. Each browser is handed a login that
 * expires in a day, made from that password (the standard TURN REST scheme),
 * so the password itself never leaves the box.
 */
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const DIR = process.env.BOOK_DIR || "/data";
const TURN_IP = (process.env.BOOK_TURN_IP || "").trim();
const TURN_HOST = (process.env.BOOK_TURN_HOST || TURN_IP).trim();

/* The relay's password, and the config file the relay container reads. Made
   once and kept; rewritten on every start so a changed address takes effect. */
let SECRET = "";
export function turnSetup() {
  if (!TURN_IP) return;
  mkdirSync(DIR, { recursive: true });
  const f = path.join(DIR, "turn-secret");
  try { SECRET = readFileSync(f, "utf8").trim(); } catch { /* first start */ }
  if (!/^[a-f0-9]{48}$/.test(SECRET)) {
    SECRET = randomBytes(24).toString("hex");
    writeFileSync(f, SECRET, { mode: 0o600 });
  }
  writeFileSync(path.join(DIR, "turnserver.conf"), [
    "listening-port=3478",
    "min-port=49160",
    "max-port=49200",
    `external-ip=${TURN_IP}`,
    "use-auth-secret",
    `static-auth-secret=${SECRET}`,
    "realm=book",
    "fingerprint",
    "no-cli",
    "no-tls",
    "no-dtls",
    "no-multicast-peers",
    // Never relay into the box's own private networks — a relay is otherwise a
    // way for a stranger to reach the containers behind it.
    "denied-peer-ip=10.0.0.0-10.255.255.255",
    "denied-peer-ip=172.16.0.0-172.31.255.255",
    "denied-peer-ip=192.168.0.0-192.168.255.255",
    "denied-peer-ip=127.0.0.0-127.255.255.255",
    "",
  ].join("\n"));
}

/** What a browser needs to find the other one, including a day's relay login. */
export function iceServers() {
  if (!TURN_HOST || !SECRET) return [];
  const user = `${Math.floor(Date.now() / 1000) + 86400}:book`;
  const cred = createHmac("sha1", SECRET).update(user).digest("base64");
  return [
    { urls: [`stun:${TURN_HOST}:3478`] },
    { urls: [`turn:${TURN_HOST}:3478?transport=udp`, `turn:${TURN_HOST}:3478?transport=tcp`], username: user, credential: cred },
  ];
}

/* rooms: id → { seen: {s, t}, q: {s: [], t: []}, n, wait: {s, t} } */
const ROOMS = new Map();
const other = (r) => (r === "s" ? "t" : "s");
const HERE_MS = 30e3;

function room(id) {
  let r = ROOMS.get(id);
  if (!r) { r = { seen: { s: 0, t: 0 }, q: { s: [], t: [] }, n: 0, wait: { s: null, t: null } }; ROOMS.set(id, r); }
  return r;
}
const here = (r, role) => Date.now() - r.seen[role] < HERE_MS;

function push(r, role, m) {
  r.n += 1;
  r.q[role].push({ n: r.n, m });
  if (r.q[role].length > 200) r.q[role].splice(0, r.q[role].length - 200);
  const w = r.wait[role];
  if (w) { r.wait[role] = null; w(); }
}

/** Arriving. Tells the other side you are here, and you whether they are. */
export function join(id, role) {
  const r = room(id);
  r.seen[role] = Date.now();
  r.q[role] = [];
  push(r, other(role), { type: "here" });
  return { here: here(r, other(role)), since: r.n };
}

export function send(id, role, m) {
  const r = room(id);
  r.seen[role] = Date.now();
  push(r, other(role), m);
}

export function leave(id, role) {
  const r = room(id);
  r.seen[role] = 0;
  push(r, other(role), { type: "left" });
}

/** Everything for `role` after `since`, waiting up to 20s for something. */
export function poll(id, role, since) {
  const r = room(id);
  r.seen[role] = Date.now();
  const take = () => ({ msgs: r.q[role].filter((x) => x.n > since), here: here(r, other(role)) });
  const now = take();
  if (now.msgs.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const prev = r.wait[role];
    if (prev) prev();
    const timer = setTimeout(() => { if (r.wait[role] === done) r.wait[role] = null; resolve(take()); }, 20e3);
    function done() { clearTimeout(timer); resolve(take()); }
    r.wait[role] = done;
  });
}

// Rooms nobody has touched in a day are forgotten.
setInterval(() => {
  const cut = Date.now() - 86400e3;
  for (const [id, r] of ROOMS) if (Math.max(r.seen.s, r.seen.t) < cut) ROOMS.delete(id);
}, 3600e3).unref();
