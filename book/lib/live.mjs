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
import { TURN_PORT } from "./room.mjs";

const DIR = process.env.BOOK_DIR || "/data";
const IP = (process.env.BOOK_TURN_IP || "").trim();
const PUBLIC = (process.env.BOOK_PUBLIC || "https://thexchange.app/book").replace(/\/$/, "");
// What the browser connects to. Worked out from the public address; set only
// to point a test at a LiveKit running somewhere else.
const URL_WS = (process.env.BOOK_LIVE_URL || PUBLIC.replace(/^http/, "ws") + "/lk").replace(/\/$/, "");
/* Ten watching unless the live says otherwise — Tom's number for a class.
   A market stall is free to watch and says MAX=100 or so. CEIL is the most
   any one live may have, whatever it says: every viewer is 1–2 Mbps out of
   this box, and the box runs other things. */
export const MAX = Math.min(200, Math.max(1, Number.parseInt(process.env.BOOK_LIVE_MAX, 10) || 10));
export const CEIL = 200;

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
      `    - {host: ${IP}, port: ${TURN_PORT}, protocol: udp, secret: ${turn}}`,
      `    - {host: ${IP}, port: ${TURN_PORT}, protocol: tcp, secret: ${turn}}`,
    ] : []),
    // A backstop only: each live's own limit is set when its room is made
    // (see `ensureRoom`) and checked before a viewer is let in.
    "room:",
    `  max_participants: ${CEIL + 1}`,
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

/* LIVEKIT'S OWN API, for the three things only the server may do: make a
   room with its limit, count who is in it, and say something into it. A
   minute-long admin ticket per call, signed with the same key. */
async function twirp(method, room, body) {
  // The terminal (cli.mjs) never runs liveSetup; it reads the key kept by it.
  if (!SECRET) { try { SECRET = readFileSync(path.join(DIR, "live-secret"), "utf8").trim(); } catch { /* off */ } }
  if (!SECRET) throw new Error("live is off");
  const now = Math.floor(Date.now() / 1000);
  const t = b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ iss: KEY, nbf: now - 10, exp: now + 60,
    video: { room, roomAdmin: true, roomCreate: true } });
  const r = await fetch(API + "/twirp/livekit.RoomService/" + method, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + t + "." + createHmac("sha256", SECRET).update(t).digest("base64url") },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(3000),
  });
  if (!r.ok) { const e = new Error(method + " " + r.status); e.status = r.status; throw e; }
  return r.json();
}

/** The room, made with this live's limit before anybody is let in. Making a
 *  room that exists already changes nothing, so it is asked every time. */
export async function ensureRoom(room, max) {
  try { await twirp("CreateRoom", room, { name: room, max_participants: Math.min(max, CEIL) + 1, empty_timeout: 600 }); }
  catch { /* LiveKit's backstop still holds */ }
}

/** How many are watching, asked of LiveKit — or null if it cannot say.
 *  Asked before handing a viewer a ticket, because when LiveKit turns one
 *  away itself, the browser is told only that the connection failed, and
 *  "check your network" is the wrong thing to tell somebody who is fine. */
export async function watching(room) {
  try {
    const j = await twirp("ListParticipants", room, { room });
    return (j.participants || []).filter((x) => x.identity !== "host").length;
  } catch (e) {
    // No room yet is nobody watching; anything else is "don't know".
    return e.status === 404 ? 0 : null;
  }
}

/** Everybody out: the live has been ended. Their pages see the connection
 *  close and say the live is over. */
export async function closeRoom(room) {
  try { await twirp("DeleteRoom", room, { room }); } catch { /* already empty */ }
}

/** Something said into the room by the server — a sale, a gift, a message,
 *  the item now pinned. Viewers cannot send into the room themselves: every
 *  line goes through here, where it can be limited and kept. */
export async function tell(room, msg, to) {
  try {
    await twirp("SendData", room, { room, data: Buffer.from(JSON.stringify(msg)).toString("base64"), kind: "RELIABLE", topic: "live",
      ...(to ? { destination_identities: to } : {}) });
  } catch { /* nobody there, or LiveKit away — the page asks again on join */ }
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
    // Which app made it, when one did — an app sees and ends only its own.
    ...(/^[a-z0-9-]{1,30}$/.test(r.app || "") ? { app: r.app } : {}),
    max: Math.min(CEIL, Math.max(1, Number.parseInt(r.max, 10) || MAX)),
    // WHAT IS FOR SALE, added from the seller's phone mid-live. The photo is
    // a file beside book.json, not in it — see /photo in server.mjs.
    items: (Array.isArray(r.items) ? r.items : []).map((i) => i && /^[a-f0-9]{8}$/.test(i.id) && {
      // Cents, Australian: Square in Australia charges AUD — see pay.mjs.
      id: i.id, name: s(i.name, 40), cents: Math.max(100, Math.min(1e6, Math.round(Number(i.cents) || 0))),
    }).filter((i) => i && i.name && i.cents),
    pinned: /^[a-f0-9]{8}$/.test(r.pinned || "") ? r.pinned : "",
    /* EVERY SALE AND GIFT, once Square has said COMPLETED — a payment that
       failed is never written down. `contact` is what Apple or Google Pay
       handed over for posting it (or what a card payer typed); only the
       seller's screen ever shows it. */
    sales: (Array.isArray(r.sales) ? r.sales : []).map((x) => x && /^[a-f0-9]{16}$/.test(x.id) && {
      id: x.id, kind: x.kind === "gift" ? "gift" : "item", item: s(x.item, 40),
      cents: Math.max(0, Math.round(Number(x.cents) || 0)),
      name: s(x.name, 40), contact: s(x.contact, 300), at: s(x.at, 40), square: s(x.square, 80),
    }).filter(Boolean),
  };
}

/** A new live, from the terminal (`make book-live`) or from an app (POST
 *  /api/lives). `when` is Beijing time, "2026-10-03 19:00", or empty for
 *  now. Returns the row, or a sentence saying what was wrong with the ask. */
export function newLive({ host, title, when, max, app }) {
  if (!String(host || "").trim()) return { error: 'host is who is on camera, as viewers see it: host: "Tom"' };
  let start = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 16) + ":00+08:00";
  if (when) {
    const w = String(when).trim().replace(" ", "T");
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(w)) return { error: 'when is "2026-10-03 19:00", Beijing time, or left out for now' };
    start = w + ":00+08:00";
  }
  const l = cleanLive({ id: randomBytes(8).toString("hex"), host, title, start, max });
  if (!l) return { error: "not a live" };
  if (app) l.app = app;
  return { live: l };
}

/** Its two links, and until when they work. */
export const links = (l) => ({
  id: l.id,
  seller: `${PUBLIC}/live/${l.id}#${l.hKey}`,
  viewer: `${PUBLIC}/live/${l.id}#${l.vKey}`,
  start: l.start,
  until: new Date(Date.parse(l.start) + 12 * 3600e3).toISOString(),
  max: l.max,
});

/* Open from the moment it is made until twelve hours after it starts — so the
   teacher can try the camera the day before, and a market day is one link
   from setting up to packing away. */
export const liveOpen = (l, now = Date.now()) => !l.off && now < Date.parse(l.start) + 12 * 3600e3;
