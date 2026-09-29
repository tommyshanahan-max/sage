/* LAONEI SHOP, A TEST — Tom's 微店 products, in English, for buyers abroad.
 *
 * Standalone at call.laonei.co/shop, before any of it goes into the app: the
 * question it answers is whether people outside China want these things
 * enough to ask for them, and it answers it without taking a cent.
 *
 *   make shop-sync SHOP=https://weidian.com/s/…   read the shop, translate, show
 *   make shop-wants                               who asked for what
 *
 * THE PRODUCTS COME FROM 微店's PUBLIC PAGES (scripts/weidian-pull.mjs, the
 * reader the board already uses, not logged in), and their names are put
 * into English once, on import, by the same translator the calls use.
 *
 * NO MONEY, ON PURPOSE. "I want this" records a name, a way to reach them
 * and a country. Paying comes when the PingPong keys do — and only for Tom's
 * OWN goods: docs/cross-border-payments.md is the reason. Collecting a buyer's
 * money and passing it on to another seller is settlement, 二清, illegal in
 * China without a payment licence. Other sellers' goods are only ever paid
 * through a provider's own marketplace product, never through Tom.
 *
 * A LIVE ON TOP. When a broadcast (cast.mjs) is on, the shop leads with it —
 * the best advert for a product is somebody holding it.
 */
import { createHash } from "node:crypto";
import { load, save, newId } from "./store.mjs";

const OPEN_CAST_MS = 12 * 3600e3;
// Roughly, for showing; the real price is the ¥ one beside it. .env can move it.
const AUD_PER_CNY = Number(process.env.BOOK_AUD_PER_CNY || 0.21);
const words = (v, n) => String(v || "").replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, n);

export function cleanItem(r) {
  if (!r || !/^[a-z0-9]{6,24}$/.test(r.id)) return null;
  const cny = Number(r.cny);
  if (!Number.isFinite(cny) || cny <= 0) return null;
  const url = /^https:\/\/[a-z0-9.-]*weidian\.com\//i.test(r.url || "") ? String(r.url).slice(0, 300) : "";
  const photo = /^https:\/\//.test(r.photo || "") ? String(r.photo).slice(0, 500) : "";
  return { id: r.id, zh: words(r.zh, 120), en: words(r.en, 120), cny, url, photo, off: Boolean(r.off) };
}
export function cleanWant(r) {
  if (!r || !/^[a-f0-9]{16}$/.test(r.id) || Number.isNaN(Date.parse(r.at))) return null;
  return { id: r.id, item: words(r.item, 24), name: words(r.name, 40), reach: words(r.reach, 80), country: words(r.country, 40), at: r.at };
}

/** From weidian-pull's JSON: { items: [{ name, price, photo, url }] }. The
 *  translator is passed in so the terminal can say what it is doing. */
export async function importItems(pulled, translate) {
  const db = load();
  const before = new Map(db.shop.items.map((x) => [x.id, x]));
  const out = [];
  for (const it of (pulled && pulled.items) || []) {
    const cny = Number(String(it.price || "").replace(/[^\d.]/g, ""));
    const zh = words(it.name, 120);
    if (!zh || !cny) continue;
    // 微店's own item id when the link has it, so a re-sync updates rather than doubles.
    const m = String(it.url || "").match(/itemI[Dd]=(\d{6,20})/);
    const id = m ? m[1] : createHash("sha256").update(zh).digest("hex").slice(0, 12);
    const was = before.get(id);
    let en = was && was.zh === zh ? was.en : "";
    if (!en) { try { en = await translate(zh); } catch { en = ""; } }
    const row = cleanItem({ id, zh, en, cny, url: it.url, photo: it.photo, off: was ? was.off : false });
    if (row) out.push(row);
  }
  db.shop.items = out;
  save(db);
  return out;
}

export async function routes(req, res, p, { send, readBody, allowed, ip }) {
  if (p === "/api/shop" && req.method === "GET") {
    const db = load();
    /* The newest broadcast still open leads the page. */
    const live = db.casts.filter((c) => !c.off && Date.now() - Date.parse(c.at) < OPEN_CAST_MS)
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
    return send(res, 200, {
      items: db.shop.items.filter((x) => !x.off).map((x) => ({ id: x.id, zh: x.zh, en: x.en, cny: x.cny, aud: Math.round(x.cny * AUD_PER_CNY), photo: x.photo })),
      live: live ? { id: live.id, name: live.name, title: live.title } : null,
    }), true;
  }
  if (p === "/api/shop/want" && req.method === "POST") {
    if (!allowed(ip)) return send(res, 429, { error: "slow" }), true;
    const b = (await readBody(req)) || {};
    const db = load();
    const item = db.shop.items.find((x) => x.id === String(b.item || ""));
    const reach = words(b.reach, 80);
    if (!item || !reach) return send(res, 400, { error: "missing" }), true;
    const w = cleanWant({ id: newId(), item: item.id, name: b.name, reach, country: b.country, at: new Date().toISOString() });
    db.shop.wants = db.shop.wants.concat(w).slice(-2000);
    save(db);
    console.log(`shop: somebody wants ${item.en || item.zh}`);
    return send(res, 201, { ok: true }), true;
  }
  return false;
}
