/* A SHOP, AND A HUNDRED SHOPFRONTS OVER ONE CATALOGUE
 * ===========================================================================
 *
 * Tom ran this before, as one WeChat store selling Australian things into
 * China, with a distributor behind it. What was missing was everybody else:
 * the mums who already tell their own groups what to buy, and who sell more
 * in an afternoon than a shopfront does in a month. So the catalogue is one
 * — his, because he holds the stock and the distributor — and the
 * storefronts are many: a member picks the things they will stand behind,
 * their page becomes a shop, and every order lands in his list to be sent.
 *
 * WHAT THIS FILE IS NOT, and each of these was a wrong turn worth naming:
 *
 *   - NOT A MARKETPLACE. Two sides, two catalogues, two sets of stock and a
 *     dispute process is a different company. One catalogue, one seller, one
 *     person responsible for what arrives.
 *   - NOT A CART ACROSS SHOPS. An order belongs to one storefront, because
 *     the commission does. Buying from two people at once is a second order.
 *   - NOT AN ACCOUNT FOR THE BUYER. She opens a link in WeChat, picks, types
 *     an address and pays — the same as the payment page, and for the same
 *     reason: an account is the step where half of them leave.
 *
 * THE FOUR WORDS ARE NOT OURS. 待付款 · 待发货 · 待收货 · 完成 is the
 * vocabulary every Chinese buyer already has, in that order, from every shop
 * they have ever used. orderState returns those four and no fifth: a state
 * nobody recognises is a state that generates a message.
 *
 * NO ID NUMBERS. These clear customs as personal articles and the recipient's
 * identity card has to be matched to the parcel — but the courier collects it
 * themselves, on their own page, off the QR printed on the label. So this
 * file never sees one, and a shop that does not hold identity documents does
 * not have to explain how it protects them.
 *
 * BUILT TO LEAVE, like lib/request.js beside it: nothing here imports the
 * board. Plain data in, plain data out; what is board-shaped — who is
 * selling, whose money it is — the caller supplies.
 */
import { randomBytes } from "node:crypto";

export const newId = () => randomBytes(10).toString("hex");
export const cleanId = (v) =>
  (/^[a-f0-9]{20}$/.test(String(v ?? "")) ? String(v) : "");

const s = (v, n) => String(v ?? "").replace(/\r\n?/g, " ")
  .replace(/[^\P{C}]/gu, "").trim().slice(0, n);

/* MONEY IS FEN, AS AN INTEGER, EVERYWHERE IN HERE. A cart is arithmetic —
   two of this, three of that, plus postage — and arithmetic on a string with
   a ¥ in front of it is how somebody is charged a hundred times too much.
   It becomes a ¥ again at the edge, once, in the page. */
const fen = (v) => {
  const n = Math.round(Number(v));
  return Number.isSafeInteger(n) && n > 0 && n < 100_000_000 ? n : 0;
};

/** ONE THING FOR SALE.
 *
 *  The name is Chinese first because the reader is: 「Bellamy's 贝拉米3段 有机
 *  婴儿奶粉 900g」 is how it is written on every screen she has ever bought
 *  from, brand in Latin letters and the rest in her own. The English name is
 *  for the picking list and the courier's label, not for her. */
export function cleanProduct(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = cleanId(raw.id);
  const name = s(raw.name, 80);
  const price = fen(raw.price);
  if (!id || !name || !price) return null;
  const out = {
    id, name, price,
    at: s(raw.at, 40) || new Date().toISOString(),
    /* What the buyer is getting, in her words: 120粒 x2, 900g *3. It is not
       a description and it is never a paragraph. */
    unit: s(raw.unit, 40),
    /* For the label and the packing list, where a Chinese name is no help to
       a warehouse in Melbourne. */
    en: s(raw.en, 80),
    photo: s(raw.photo, 300),
  };
  /* Out of stock is not deleted. A storefront that linked to it has to be
     able to say "sold out" rather than show a page that is gone. */
  if (raw.out) out.out = true;
  if (raw.off) out.off = true;
  return out;
}

/** WHERE A PARCEL GOES, in the shape Chinese addresses are actually written:
 *  province, city, district, then the rest in one line. A Western two-line
 *  address box is the commonest way a foreign shop tells a Chinese buyer it
 *  was not built for her. */
export function cleanShip(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = {
    name: s(raw.name, 40),
    phone: s(raw.phone, 20).replace(/[^\d+\-\s]/g, ""),
    province: s(raw.province, 40),
    city: s(raw.city, 40),
    district: s(raw.district, 40),
    detail: s(raw.detail, 160),
  };
  /* Everything but the district: a first-tier city is its own province and
     some addresses have no district at all. */
  if (!out.name || !out.phone || !out.province || !out.city || !out.detail) return null;
  return out;
}

/** ONE ORDER, BELONGING TO ONE STOREFRONT. */
export function cleanOrder(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = cleanId(raw.id);
  if (!id) return null;

  const lines = (Array.isArray(raw.lines) ? raw.lines : [])
    .map((l) => {
      const pid = cleanId(l?.id);
      const name = s(l?.name, 80);
      const price = fen(l?.price);
      const n = Math.min(Math.max(Math.round(Number(l?.n) || 0), 1), 99);
      /* THE PRICE IS COPIED ONTO THE LINE, not read from the catalogue when
         the order is looked at. A price that changes next week must not
         change what somebody was charged last week. */
      return pid && name && price ? { id: pid, name, price, n } : null;
    })
    .filter(Boolean)
    .slice(0, 40);
  if (!lines.length) return null;

  /* AN ORDER WITH NOWHERE TO SEND IT IS NOT AN ORDER. The route already
     refuses one (error: "address"), so a row without a good address got here
     by being edited or restored by hand — and every screen downstream reads
     ship.name without asking, which is a page that renders as a crash rather
     than as a missing address. */
  const ship = cleanShip(raw.ship);
  if (!ship) return null;
  const out = {
    id, lines,
    at: s(raw.at, 40) || new Date().toISOString(),
    /* WHOSE SHOPFRONT, as a handle. Not a device hash: the commission is
       theirs and the page says their name, both of which are public facts
       about a member. */
    shop: s(raw.shop, 40),
    /* The buyer's browser, so she can find her own order again. She never
       makes an account, so this is all there is of her. */
    by: /^[a-f0-9]{32}$/.test(String(raw.by || "")) ? String(raw.by) : "",
    post: fen(raw.post),
    cur: "cny",
  };
  if (ship) out.ship = ship;

  /* What was paid, and with what. Same shape as a request's: the provider's
     own id, which is the only way to ask later whether the money arrived. */
  if (raw.pay && typeof raw.pay === "object") {
    const ref = s(raw.pay.ref, 64);
    const how = ["wechat", "alipay"].includes(raw.pay.how) ? raw.pay.how : "";
    if (ref && how) out.pay = { ref, how, at: s(raw.pay.at, 40) };
  }
  if (raw.paid) out.paid = true;

  /* THE PARCEL. A courier and a number, and the date it left. */
  if (raw.sent && typeof raw.sent === "object") {
    const tracking = s(raw.sent.tracking, 40);
    if (tracking) {
      out.sent = {
        tracking,
        courier: s(raw.sent.courier, 40),
        at: s(raw.sent.at, 40) || new Date().toISOString(),
      };
    }
  }
  if (raw.got) out.got = true;
  if (raw.off) out.off = true;

  /* WHAT THE STOREFRONT EARNS, in fen, fixed when the order is made. A rate
     that changes must not reach back into what somebody has already sold. */
  const cut = fen(raw.cut);
  if (cut) out.cut = cut;
  /* And whether that commission has been sent on. Kept beside the amount
     rather than in a ledger of its own: one row, one answer, and no way for
     two places to disagree about whether somebody has been paid. */
  if (raw.cutPaid) out.cutPaid = true;
  return out;
}

/** What the whole thing comes to, postage included. */
export const orderTotal = (o) =>
  (o?.lines || []).reduce((n, l) => n + l.price * l.n, 0) + (o?.post || 0);

/** THE FOUR WORDS, AND NO FIFTH. Everything a Chinese buyer expects to see,
 *  in the order she expects to see it — see the header. */
export function orderState(o) {
  if (!o || o.off) return "off";
  if (o.got) return "done";
  if (o.sent?.tracking) return "shipped";
  if (o.paid) return "toShip";
  return "due";
}

/** WHAT THE BUYER'S PAGE IS ALLOWED TO SEE. An allowlist, not the row minus
 *  a few fields: the row will grow and a denylist leaks whatever is added to
 *  it next. `by` and `cut` never leave the server — one is a device hash and
 *  the other is somebody else's money. */
export function orderView(o) {
  if (!o) return null;
  return {
    id: o.id,
    at: o.at,
    shop: o.shop,
    lines: (o.lines || []).map((l) => ({ id: l.id, name: l.name, price: l.price, n: l.n })),
    post: o.post || 0,
    cur: o.cur || "cny",
    total: orderTotal(o),
    ship: o.ship || null,
    sent: o.sent ? { tracking: o.sent.tracking, courier: o.sent.courier, at: o.sent.at } : null,
    state: orderState(o),
  };
}

/** A THREAD BETWEEN A BUYER AND THE SHOP SHE IS BUYING FROM.
 *
 *  WHY THIS IS NOT `notes`. That is member to member, keyed on two person
 *  rows, and it says of itself that it is an introduction rather than a chat
 *  — the conversation is meant to leave the board. This is the opposite: a
 *  buyer with no account at all, asking the question she would ask in any
 *  shop, and the conversation must NOT leave, because the alternative is
 *  asking a stranger to add her on WeChat before she has bought anything.
 *  That is a bigger ask than the purchase.
 *
 *  ONE THREAD PER BUYER PER SHOP, not per order. She asks before she buys,
 *  she asks again about the parcel, and two threads with the same person
 *  about the same shop is a filing system nobody wanted. The order she was
 *  looking at when she opened it rides along on the line instead.
 *
 *  SHE IS A DEVICE, which is the whole of her identity here and the same
 *  bargain as everywhere else: no account, and nothing to recover on a new
 *  phone. A thread is therefore not a mailbox and must never hold anything
 *  she would be sorry to lose.
 */
const WHOS = new Set(["buyer", "shop", "ai"]);

export function cleanLine(raw) {
  if (!raw || typeof raw !== "object") return null;
  const who = WHOS.has(raw.who) ? raw.who : "";
  const text = s(raw.text, 600);
  if (!who || !text) return null;
  return {
    who, text,
    at: s(raw.at, 40) || new Date().toISOString(),
    /* Which order she was looking at, when she opened it from one. The rep
       then answers "where is it" without asking which it is. */
    order: cleanId(raw.order),
  };
}

export function cleanChat(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = cleanId(raw.id);
  const shop = s(raw.shop, 40);
  const by = /^[a-f0-9]{32}$/.test(String(raw.by || "")) ? String(raw.by) : "";
  if (!id || !shop || !by) return null;
  const lines = (Array.isArray(raw.lines) ? raw.lines : [])
    .map(cleanLine)
    .filter(Boolean)
    /* The last hundred. A thread that grows without bound is a file that
       grows without bound, and nobody is reading message nine hundred. */
    .slice(-100);
  if (!lines.length) return null;
  return {
    id, shop, by, lines,
    at: s(raw.at, 40) || lines[0].at,
    /* The last line's time, kept beside rather than derived, so an inbox
       sorts without walking every thread. */
    last: s(raw.last, 40) || lines[lines.length - 1].at,
    /* How far each side has read. Two numbers because a badge that is right
       for one of them is wrong for the other. */
    seenShop: Math.max(0, Math.min(Number(raw.seenShop) || 0, lines.length)),
    seenBuyer: Math.max(0, Math.min(Number(raw.seenBuyer) || 0, lines.length)),
  };
}

export const CHAT_MAX = 2000;

export const PRODUCT_MAX = 400;
export const ORDER_MAX = 4000;
