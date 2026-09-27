/* SELLING DURING A LIVE — the stall, the gifts and the chat.
 *
 * Tom's use for the live: standing at a market in China with one phone,
 * showing what he has to people watching anywhere, who buy it or send a gift
 * with Apple Pay — a double-click over the video, and it is theirs. So the
 * seller's side is built for one hand: tap +, the phone keeps a still from
 * the camera that is already streaming, type a name and a price, and it
 * joins the row under the video for everybody watching. No second phone, no
 * camera app, no upload step — the stream never stops.
 *
 * EVERYTHING ANYBODY SEES ARRIVE — a line of chat, a sale, a gift, the item
 * now shown — is said into the room by this server (`tell`), never by a
 * viewer's own browser. Viewers are not allowed to send into the room at all
 * (see `ticket` in live.mjs). That is what lets a chat line be rate-limited
 * and "Amy sent $5" be true: it is sent only after Square says COMPLETED.
 *
 * The buyer's contact — name, email, address, from Apple or Google Pay —
 * goes to the seller's screen and nowhere else. It is what he needs to send
 * what was bought, and nothing a viewer needs.
 *
 * PRICES ARE AUSTRALIAN DOLLARS, IN CENTS: Square in Australia — see pay.mjs.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { load, save, newId } from "./store.mjs";
import { ticket, liveOpen, watching, ensureRoom, tell } from "./live.mjs";
import * as pay from "./pay.mjs";

const DIR = process.env.BOOK_DIR || "/data";
const room = (l) => "live-" + l.id;
// The gifts a viewer can pick, in cents. Any other amount is refused: a free
// box is a place to type 99999 by mistake.
export const GIFTS = [200, 500, 2000];

/* The last thirty things said, per live, so somebody arriving mid-way sees
   the conversation they walked into. Memory only — a restart forgets the chat
   and nothing else; sales are in book.json. */
const FEED = new Map();
function feed(id, line) {
  const f = FEED.get(id) || [];
  f.push(line);
  if (f.length > 30) f.splice(0, f.length - 30);
  FEED.set(id, f);
}
const first = (name) => String(name || "").trim().split(/\s+/)[0].slice(0, 16);
const clean = (v, n) => String(v || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);

/* One chat line per address every two seconds. The booking bucket in
   server.mjs is for writes to a file; this one is for a room with a hundred
   people in it and somebody holding down Enter. */
const LAST = new Map();
function chatty(ip) {
  const now = Date.now();
  if (now - (LAST.get(ip) || 0) < 2000) return true;
  LAST.set(ip, now);
  if (LAST.size > 5000) LAST.clear();
  return false;
}

const photoFile = (id, item) => path.join(DIR, "live", id, item + ".jpg");
const itemOut = (l, i) => ({ id: i.id, name: i.name, cents: i.cents, photo: `live/${l.id}/photo/${i.id}` });

/** What the seller's screen shows: the takings, and who to send what to. */
function takings(l) {
  return {
    cents: l.sales.reduce((n, x) => n + x.cents, 0),
    sold: l.sales.filter((x) => x.kind === "item").length,
    gifts: l.sales.filter((x) => x.kind === "gift").length,
    list: l.sales.slice(-50).reverse().map((x) => ({ kind: x.kind, item: x.item, cents: x.cents, name: x.name, contact: x.contact, at: x.at })),
  };
}

/** The live's routes. Returns false when the path is not one of them. */
export async function routes(req, res, p, { send, readBody, allowed, ip }) {
  let m = p.match(/^\/api\/live\/([a-f0-9]{16})\/photo\/([a-f0-9]{8})$/);
  if (req.method === "GET" && m) {
    try {
      const jpg = readFileSync(photoFile(m[1], m[2]));
      res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400", "Access-Control-Allow-Origin": "*" });
      res.end(jpg);
    } catch { send(res, 404, { error: "gone" }); }
    return true;
  }
  m = p.match(/^\/api\/live\/([a-f0-9]{16})\/(info|join|state|say|item|pin|pay)$/);
  if (!m || req.method !== "POST") return false;
  const what = m[2];
  // A photo is the one big thing anybody sends: a still, already shrunk by
  // the page to 640px, is well under this.
  const b = (await readBody(req, what === "item" ? 400e3 : 4096)) || {};
  const key = String(b.key || "");
  const db = load();
  const l = db.lives.find((x) => x.id === m[1]);
  const host = Boolean(l && key === l.hKey);
  if (!l || (!host && key !== l.vKey)) return send(res, 403, { error: "key" }), true;
  if (!liveOpen(l)) return send(res, 410, { error: "over" }), true;
  const about = { host, name: l.host, title: l.title, start: l.start, pay: pay.client(), gifts: GIFTS };

  if (what === "info") return send(res, 200, about), true;

  if (what === "join") {
    await ensureRoom(room(l), l.max);
    // Full is said here, in words; LiveKit would only drop the connection.
    // The seller is never turned away from their own live.
    if (!host && (await watching(room(l))) >= l.max) return send(res, 409, { error: "full" }), true;
    /* Every viewer is somebody new to LiveKit — a name it has seen before
       would push the earlier one out. The seller is always "host", so a
       phone that reconnects replaces itself instead of appearing twice. */
    const t = ticket(room(l), host ? "host" : "v-" + newId(), host ? l.host : "", host);
    if (!t) return send(res, 503, { error: "off" }), true;
    return send(res, 200, { ...about, ...t }), true;
  }

  if (what === "state") {
    return send(res, 200, {
      items: l.items.map((i) => itemOut(l, i)),
      pinned: l.pinned,
      feed: FEED.get(l.id) || [],
      takings: host ? takings(l) : undefined,
    }), true;
  }

  if (what === "say") {
    const text = clean(b.text, 120);
    const name = host ? l.host : first(b.name);
    if (!text || !name) return send(res, 400, { error: "empty" }), true;
    if (chatty(ip)) return send(res, 429, { error: "slow" }), true;
    const line = { t: "say", name, text, host };
    feed(l.id, line);
    await tell(room(l), line);
    return send(res, 200, { ok: true }), true;
  }

  if (what === "item" || what === "pin") {
    if (!host) return send(res, 403, { error: "key" }), true;
    if (what === "item") {
      const name = clean(b.name, 40);
      const cents = Math.round(Number(b.price) * 100);
      if (!name || !(cents >= 100 && cents <= 1e6)) return send(res, 400, { error: "item" }), true;
      const id = randomBytes(4).toString("hex");
      const jpg = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.photo || ""));
      if (jpg) {
        mkdirSync(path.dirname(photoFile(l.id, id)), { recursive: true });
        writeFileSync(photoFile(l.id, id), Buffer.from(jpg[1], "base64"));
      }
      l.items.push({ id, name, cents });
      l.pinned = id;
    } else {
      l.pinned = l.items.some((i) => i.id === b.item) ? b.item : "";
    }
    save(db);
    const items = l.items.map((i) => itemOut(l, i));
    // The whole row each time: a dozen items is a few hundred bytes, and a
    // viewer who missed one message is never left with a stale row.
    await tell(room(l), { t: "items", items, pinned: l.pinned });
    return send(res, 200, { ok: true, items, pinned: l.pinned }), true;
  }

  if (what === "pay") {
    if (!pay.on()) return send(res, 503, { error: "off" }), true;
    if (!allowed(ip)) return send(res, 429, { error: "slow" }), true;
    const kind = b.kind === "gift" ? "gift" : "item";
    const item = kind === "item" ? l.items.find((i) => i.id === b.item) : null;
    const cents = kind === "gift" ? Number(b.cents) : item && item.cents;
    if (kind === "item" ? !item : !GIFTS.includes(cents)) return send(res, 400, { error: "what" }), true;
    const token = String(b.token || "").slice(0, 400);
    if (!token) return send(res, 400, { error: "token" }), true;
    // Apple or Google Pay's contact, or what a card payer typed. A gift needs
    // only a name to thank; a sale needs somewhere to send it.
    const name = clean(b.name, 40) || "Someone";
    const contact = kind === "item" ? clean(b.contact, 300) : "";
    let square;
    try {
      square = await pay.charge({ token, cents, note: `${kind === "gift" ? "Gift" : item.name} · live ${l.id} · ${name}` });
    } catch (e) {
      console.log("live pay:", e.message);
      return send(res, 402, { error: "declined" }), true;
    }
    // Written from a fresh read: the charge took a second or two, and the
    // seller may have added an item meanwhile.
    const db2 = load();
    const l2 = db2.lives.find((x) => x.id === l.id);
    l2.sales.push({ id: newId(), kind, item: item ? item.name : "", cents, name, contact, at: new Date().toISOString(), square });
    save(db2);
    const line = kind === "gift" ? { t: "gift", name: first(name), cents } : { t: "buy", name: first(name), item: item.name };
    feed(l.id, line);
    await tell(room(l), line);
    await tell(room(l), { t: "takings", ...takings(l2) }, ["host"]);
    return send(res, 200, { ok: true }), true;
  }
  return false;
}
