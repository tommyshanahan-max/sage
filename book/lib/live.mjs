/* THE LIVE CLASS: one teacher on camera, up to ten people watching.
 *
 * WHY NOT THE LESSON ROOM, WITH MORE PEOPLE IN IT. The lesson room (room.mjs)
 * is browser to browser: the teacher's phone sends its video once, to the
 * one student. With ten watching, that phone would have to encode and upload
 * the same video ten times — ten times the upload a Chinese mobile plan
 * gives, and a phone hot enough to notice. So here the teacher sends it ONCE,
 * to a video server on this box, and the box sends it on to each viewer. The
 * box has the bandwidth; the phone does not.
 *
 * THE VIDEO SERVER IS LIVEKIT — the `livekit` container in docker-compose.yml,
 * free and self-hosted, nothing paid and no account anywhere. This file only
 * does what LiveKit asks of whoever runs it: it writes LiveKit's settings on
 * start (like the relay's in room.mjs, so nothing goes in .env) and it hands
 * each browser a signed ticket saying which class it may enter and whether it
 * may send video (the teacher) or only watch (everybody else).
 *
 * The browser talks to LiveKit through Caddy, at /book/lk — the same name as
 * everything else, so no new certificate. The video itself goes to the box's
 * address on UDP 7882, or TCP 7881 for networks that drop UDP, and through
 * the existing relay (the `turn` container) for the ones that drop both.
 */
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const DIR = process.env.BOOK_DIR || "/data";
const IP = (process.env.BOOK_TURN_IP || "").trim();
const PUBLIC = (process.env.BOOK_PUBLIC || "https://thexchange.app/book").replace(/\/$/, "");
// What the browser connects to. Worked out from the public address; set only
// to point a test at a LiveKit running somewhere else.
const URL_WS = (process.env.BOOK_LIVE_URL || PUBLIC.replace(/^http/, "ws") + "/lk").replace(/\/$/, "");
/* Ten watching, Tom's number. It is a setting on LiveKit, not a count kept
   here, because LiveKit is what actually knows who is in the room — +1 for
   the teacher. */
export const MAX = Math.min(100, Math.max(1, Number.parseInt(process.env.BOOK_LIVE_MAX, 10) || 10));

const KEY = "book";
let SECRET = "";

/** Mint LiveKit's key once, keep it, and rewrite its settings on every start. */
export function liveSetup() {
  if (!IP) return;
  mkdirSync(DIR, { recursive: true });
  const f = path.join(DIR, "live-secret");
  try { SECRET = readFileSync(f, "utf8").trim(); } catch { /* first start */ }
  if (SECRET.length < 32) {
    SECRET = randomBytes(24).toString("hex");
    writeFileSync(f, SECRET, { mode: 0o600 });
  }
  let turn = "";
  try { turn = readFileSync(path.join(DIR, "turn-secret"), "utf8").trim(); } catch { /* no relay */ }
  writeFileSync(path.join(DIR, "livekit.yaml"), [
    "port: 7880",
    "bind_addresses: [\"0.0.0.0\"]",
    "rtc:",
    "  tcp_port: 7881",
    // One UDP port for everybody, not a range: it is one line in compose and
    // one hole in any firewall, and LiveKit tells the streams apart itself.
    "  udp_port: 7882",
    // The container sits on a private network; this is the address to tell
    // browsers. Not looked up from a STUN server — it is known.
    "  use_external_ip: false",
    `  node_ip: ${IP}`,
    ...(turn ? [
      "  turn_servers:",
      `    - {host: ${IP}, port: 3478, protocol: udp, secret: ${turn}}`,
      `    - {host: ${IP}, port: 3478, protocol: tcp, secret: ${turn}}`,
    ] : []),
    "room:",
    `  max_participants: ${MAX + 1}`,
    "  empty_timeout: 600",
    "keys:",
    `  ${KEY}: ${SECRET}`,
    "logging:",
    "  level: info",
    "",
  ].join("\n"), { mode: 0o644 });
}

// Where this container reaches LiveKit itself, on the private network.
const API = (process.env.BOOK_LIVE_API || "http://livekit:7880").replace(/\/$/, "");

const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");

/** A ticket into one class — LiveKit's own format, a signed JWT. Six hours:
 *  longer than any class, shorter than a forwarded link is worth keeping. */
export function ticket(room, identity, name, host) {
  if (!SECRET) return null;
  const now = Math.floor(Date.now() / 1000);
  const body = b64({ alg: "HS256", typ: "JWT" }) + "." + b64({
    iss: KEY, sub: identity, name, nbf: now - 10, exp: now + 6 * 3600,
    video: {
      room, roomJoin: true, canSubscribe: true,
      // Watchers can send nothing at all: not video, not sound, not data.
      canPublish: host, canPublishData: host,
    },
  });
  return { url: URL_WS, token: body + "." + createHmac("sha256", SECRET).update(body).digest("base64url") };
}

/** How many are watching, asked of LiveKit — or null if it cannot say.
 *  Asked before handing a viewer a ticket, because when LiveKit turns the
 *  eleventh away itself, the browser is told only that the connection failed,
 *  and "check your network" is the wrong thing to tell somebody who is fine. */
export async function watching(room) {
  if (!SECRET) return null;
  const now = Math.floor(Date.now() / 1000);
  const body = b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ iss: KEY, nbf: now - 10, exp: now + 60, video: { room, roomAdmin: true } });
  try {
    const r = await fetch(API + "/twirp/livekit.RoomService/ListParticipants", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + body + "." + createHmac("sha256", SECRET).update(body).digest("base64url") },
      body: JSON.stringify({ room }),
      signal: AbortSignal.timeout(3000),
    });
    // No room yet is nobody watching; anything else odd is "don't know".
    if (!r.ok) return r.status === 404 ? 0 : null;
    const j = await r.json();
    return (j.participants || []).filter((x) => x.identity !== "host").length;
  } catch { return null; }
}

/** A class row, or null. `hKey` opens it as the teacher, `vKey` as a viewer —
 *  the viewer link is one link for everybody, sent to the group. */
export function cleanLive(r) {
  if (!r || typeof r !== "object" || !/^[a-f0-9]{16}$/.test(r.id)) return null;
  const s = (v, n) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
  const host = s(r.host, 60);
  if (!host || !r.start || Number.isNaN(Date.parse(r.start))) return null;
  return {
    id: r.id, host, title: s(r.title, 80), start: r.start,
    hKey: /^[a-f0-9]{24}$/.test(r.hKey) ? r.hKey : randomBytes(12).toString("hex"),
    vKey: /^[a-f0-9]{24}$/.test(r.vKey) ? r.vKey : randomBytes(12).toString("hex"),
    off: Boolean(r.off),
  };
}

/* Open from the moment it is made until three hours after it starts — so the
   teacher can try the camera the day before, and a class that runs long is
   not cut off. */
export const liveOpen = (l, now = Date.now()) => !l.off && now < Date.parse(l.start) + 3 * 3600e3;
