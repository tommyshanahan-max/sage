/* SELLING DURING A LIVE — the stall, the gifts and the chat.
 *
 * Tom's use for the live: standing at a market with one phone, showing what
 * he has, and people watching buy it or send a gift. So the seller's side is
 * built for one hand: tap +, the phone keeps a still from the camera that is
 * already streaming, type a name and a price, and it is pinned under the
 * video for everybody watching. No second phone, no camera app, no upload
 * step — the stream never stops.
 *
 * EVERYTHING ANYBODY SEES ARRIVE — a line of chat, a sale, a gift, the item
 * now pinned — is said into the room by this server (`tell`), never by a
 * viewer's own browser. Viewers are not allowed to send into the room at all
 * (see `ticket` in live.mjs). That is what lets a chat line be rate-limited
 * and a "Amy sent ¥20" be true: it is only ever sent once Stripe says paid.
 *
 * The buyer's phone number goes to the seller's screen and nowhere else. It
 * is what he needs to hand over the oranges, and nothing a viewer needs.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { load, save, newId } from "./store.mjs";
import { ticket, liveOpen, watching, ensureRoom, tell } from "./live.mjs";
import * as pay from "./pay.mjs";

const DIR = process.env.BOOK_DIR || "/data";
const PUBLIC = (process.env.BOOK_PUBLIC || "https://thexchange.app/book").replace(/\/$/, "");
const room = (l) => "live-" + l.id;
// The gifts a viewer can pick. Any other amount is refused: a free box is a
// place to type 99999 by mistake.
export const GIFTS = [5, 20, 50];

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

const photoFile = (l, item) => path.join(DIR, "live", l.id, item + ".jpg");
const itemOut = (l, i) => ({ id: i.id, name: i.name, price: i.price, photo: `live/${l.id}/photo/${i.id}` });

/** What the seller's screen shows: the takings, and who to hand what to. */
function takings(l) {
  const paid = l.sales.filter((x) => x.paid);
  return {
    yuan: paid.reduce((n, x) => n + x.yuan, 0),
    sold: paid.filter((x) => x.kind === "item").length,
    gifts: paid.filter((x) => x.kind === "gift").length,
    list: paid.slice(-50).reverse().map((x) => ({ kind: x.kind, item: x.item, yuan: x.yuan, name: x.name, phone: x.phone, at: x.at })),
  };
}

/** Stripe has said paid: count it once, and tell the room. */
async function paid(l, x) {
  const line = x.kind === "gift" ? { t: "gift", name: first(x.name), yuan: x.yuan } : { t: "buy", name: first(x.name), item: x.item };
  feed(l.id, line);
  await tell(room(l), line);
  await tell(room(l), { t: "takings", ...takings(l) }, ["host"]);
}

/* ASKING STRIPE ABOUT EVERY SALE STILL WAITING, every ten seconds, instead
   of a webhook — see pay.mjs. A sale is asked about until it is paid or
   Stripe lets its form expire (half an hour). */
let busy = false;
export async function settle(only) {
  if (busy || !pay.on()) return;
  busy = true;
  try {
    const db = load();
    const done = [];
    for (const l of db.lives) {
      for (const x of l.sales) {
        if (x.paid || x.gone || !x.session || (only && x.id !== only)) continue;
        if (Date.now() - Date.parse(x.at) > 40 * 60e3) { x.gone = true; continue; }
        let st = "open";
        try { st = await pay.status(x.session); } catch (e) { console.log("live settle:", e.message); }
        if (st === "paid") { x.paid = true; done.push([l, x]); }
        else if (st === "expired") x.gone = true;
      }
    }
    save(db);
    for (const [l, x] of done) await paid(l, x);
  } finally { busy = false; }
}
setInterval(() => settle(), 10e3).unref();

/** The live's routes. Returns false when the path is not one of them. */
export async function routes(req, res, p, { send, readBody, allowed, ip }) {
  let m = p.match(/^\/api\/live\/([a-f0-9]{16})\/photo\/([a-f0-9]{8})$/);
  if (req.method === "GET" && m) {
    try {
      res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400", "Access-Control-Allow-Origin": "*" });
      res.end(readFileSync(photoFile({ id: m[1] }, m[2])));
    } catch { send(res, 404, { error: "gone" }); }
    return true;
  }
  m = p.match(/^\/api\/live\/([a-f0-9]{16})\/(info|join|state|say|item|pin|pay|check)$/);
  if (!m || req.method !== "POST") return false;
  const what = m[2];
  // A photo is the one big thing anybody sends: a phone's still, already
  // shrunk by the page to 640px, is well under this.
  const b = await readBody(req, what === "item" ? 400e3 : 4096);
  const key = String((b && b.key) || "");
  const db = load();
  const l = db.lives.find((x) => x.id === m[1]);
  const host = Boolean(l && key === l.hKey);
  if (!l || (!host && key !== l.vKey)) return send(res, 403, { error: "key" }), true;
  if (!liveOpen(l)) return send(res, 410, { error: "over" }), true;
  const about = { host, name: l.host, title: l.title, start: l.start, pay: pay.on(), gifts: GIFTS };

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
    const pin = l.items.find((i) => i.id === l.pinned);
    return send(res, 200, {
      pinned: pin ? itemOut(l, pin) : null,
      items: host ? l.items.map((i) => itemOut(l, i)) : undefined,
      feed: FEED.get(l.id) || [],
      takings: host ? takings(l) : undefined,
    }), true;
  }

  if (what === "say") {
    const text = String(b.text || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 120);
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
      const name = String(b.name || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 40);
      const price = Math.round(Number(b.price));
      if (!name || !(price >= 1 && price <= 100000)) return send(res, 400, { error: "item" }), true;
      const id = randomBytes(4).toString("hex");
      const jpg = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.photo || ""));
      if (jpg) {
        mkdirSync(path.dirname(photoFile(l, id)), { recursive: true });
        writeFileSync(photoFile(l, id), Buffer.from(jpg[1], "base64"));
      }
      l.items.push({ id, name, price });
      l.pinned = id;
    } else {
      l.pinned = l.items.some((i) => i.id === b.item) ? b.item : "";
    }
    save(db);
    const pin = l.items.find((i) => i.id === l.pinned);
    await tell(room(l), { t: "pin", item: pin ? itemOut(l, pin) : null });
    return send(res, 200, { ok: true, items: l.items.map((i) => itemOut(l, i)), pinned: pin ? itemOut(l, pin) : null }), true;
  }

  if (what === "pay") {
    if (!pay.on()) return send(res, 503, { error: "off" }), true;
    if (!allowed(ip)) return send(res, 429, { error: "slow" }), true;
    const kind = b.kind === "gift" ? "gift" : "item";
    const item = kind === "item" ? l.items.find((i) => i.id === b.item) : null;
    const yuan = kind === "gift" ? Number(b.yuan) : item && item.price;
    if (kind === "item" ? !item : !GIFTS.includes(yuan)) return send(res, 400, { error: "what" }), true;
    const name = String(b.name || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 30);
    const phone = String(b.phone || "").replace(/[^\d+ -]/g, "").trim().slice(0, 30);
    // The seller has to be able to find who bought it; a gift needs only a
    // name to thank.
    if (!name || (kind === "item" && phone.replace(/\D/g, "").length < 6)) return send(res, 400, { error: "who" }), true;
    const x = { id: newId(), kind, item: item ? item.name : "", yuan, name, phone: kind === "item" ? phone : "",
      at: new Date().toISOString(), session: "", paid: false, gone: false };
    try {
      const s = await pay.checkout({
        yuan, method: b.method, ref: "live:" + l.id + ":" + x.id,
        label: kind === "gift" ? `Gift for ${l.host}` : item.name,
        // Back to the live, with the key as a query this time: Stripe keeps a
        // query and is not promised to keep a #fragment. The page moves it
        // back into the fragment on arrival.
        back: `${PUBLIC}/live/${l.id}?k=${key}&sale=${x.id}`,
      });
      x.session = s.id;
      l.sales.push(x);
      save(db);
      return send(res, 200, { ok: true, sale: x.id, secret: s.client_secret, pk: pay.PK }), true;
    } catch (e) {
      console.log("live pay:", e.message);
      return send(res, 502, { error: "stripe" }), true;
    }
  }

  if (what === "check") {
    // Back from paying: ask Stripe about this one now rather than in ten
    // seconds, so the "thank you" and the line in the room arrive together.
    const x = l.sales.find((s) => s.id === b.sale);
    if (!x) return send(res, 404, { error: "gone" }), true;
    if (!x.paid) await settle(x.id);
    const again = load().lives.find((y) => y.id === l.id).sales.find((s) => s.id === x.id);
    return send(res, 200, { paid: Boolean(again && again.paid), kind: x.kind, item: x.item, yuan: x.yuan }), true;
  }
  return false;
}
