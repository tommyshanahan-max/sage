/* A PAYMENT REQUEST, AND NOTHING ELSE
 * ===========================================================================
 *
 * Tom put the whole product in one sentence: "two people are chatting, then
 * someone sends them a request to pay". This is that request.
 *
 * WHAT IT IS NOT, and each of these was in the way of it:
 *
 *   - NOT A ROOM. The deal memo hangs off a group, so writing terms made a
 *     two-person room and you ended up with a second place to talk to
 *     somebody you already talk to. Worse, a room holds one memo, so a second
 *     job with the same person overwrote the first. A request belongs to
 *     nothing. Three requests to one person are three rows.
 *   - NOT A CONTRACT. Seven fields, both sides pressing Agree, instalments.
 *     A request has an amount and a line saying what it is for. The memo
 *     still exists for deals that need it; it is no longer the front door.
 *   - NOT BEHIND A CODE. The memo's link carries the full terms of a deal —
 *     what is covered, what happens if it is called off — and that is worth a
 *     code beside the link. A request carries a name, an amount and one line.
 *     Less to protect, and a code standing between a person and paying you
 *     costs money. The code stays on the memo and is not here.
 *
 * BUILT TO LEAVE, like lib/memo.js beside it: nothing in this file imports
 * the board. It takes and returns plain data. What is board-shaped — who is
 * asking, which Stripe account the money lands in — the caller supplies.
 */
import { randomBytes } from "node:crypto";

/** Twenty hex, the same shape as every other id here. It is the whole address
 *  of a request, so it has to be unguessable on its own: 80 bits. */
export const newRequestId = () => randomBytes(10).toString("hex");
export const cleanId = (v) =>
  (/^[a-f0-9]{20}$/.test(String(v ?? "")) ? String(v) : "");

/* THE SAME TWO HALVES AS A PLAN ROW, and deliberately.
 *
 * The payer says they paid, the person owed says it arrived, and a row reads
 * as settled only when both are there — or when the payment page says so
 * itself, which carries `auto` because neither of them said it.
 *
 * Keeping the shape identical is what lets one list count a request and a
 * deal's plan row side by side, which is what Paid Jobs has to do. */
export function cleanSaid(raw) {
  if (!raw || typeof raw !== "object") return null;
  const kind = ["claimed", "confirmed", "denied"].includes(raw.kind) ? raw.kind : "";
  const s = (v, n) => String(v ?? "").replace(/[^\P{C}]/gu, "").trim().slice(0, n);
  const who = s(raw.who, 64), at = s(raw.at, 40);
  if (!kind || !at || (!who && !raw.auto)) return null;
  return { kind, who, at, ...(raw.auto ? { auto: true } : {}) };
}

export function cleanRequest(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = cleanId(raw.id);
  if (!id) return null;
  const s = (v, n) => String(v ?? "").replace(/\r\n?/g, " ")
    .replace(/[^\P{C}]/gu, "").trim().slice(0, n);
  /* WHO IS ASKING, as a device hash — the only thing on this row that is not
     readable by the person paying. Everything else is on the page they open. */
  const by = /^[a-f0-9]{32}$/.test(String(raw.by || "")) ? String(raw.by) : "";
  const from = s(raw.from, 64);
  const amount = s(raw.amount, 40);
  if (!by || !from || !amount) return null;

  /* WHICH WAY THE MONEY GOES, and it is the only thing that separates the two
     halves of this product.
     "in"  — a request. I made the row, you get the link, you pay me.
     "out" — sending money. I made the row, you get the link, and it asks you
             where the money should land before it can be paid.
     Same row, same link, same rails. Who pressed the button first decides
     which end the link opens on, and nothing else.
     THE ASYMMETRY THAT CANNOT BE DESIGNED AWAY: money cannot move until the
     receiving side has somewhere for it to land, and this board is never
     allowed to hold it in the meantime. So "send money" is a promise and then
     a payment, not a payment and then a wait. */
  const way = raw.way === "out" ? "out" : "in";

  const out = {
    id, by, from, amount, way,
    at: s(raw.at, 40) || new Date().toISOString(),
    /* The name the asker typed. Not a handle and not checked against the
       board: most of the time the person paying is not on it. */
    to: s(raw.to, 64),
    /* One line. Not a description, not terms — what it is for, the way you
       would say it to them. */
    what: s(raw.what, 140),
    /* Words, not a date. "Before the first lesson" is how people write this,
       and a date the software guessed at is one it will be wrong about. */
    when: s(raw.when, 60),
  };
  if (CURRENCIES.includes(raw.cur)) out.cur = raw.cur;
  /* THE PERSON PAYING, WHEN THEY ARE ON THE BOARD. Optional, and only so the
     request can appear on their side too — on their card, and in what they
     have paid. A request to somebody who has never heard of this board is
     the normal case and works without it. */
  const toWho = /^[a-f0-9]{20}$/.test(String(raw.toWho || "")) ? String(raw.toWho) : "";
  if (toWho) out.toWho = toWho;

  const said = (Array.isArray(raw.said) ? raw.said : [])
    .map(cleanSaid).filter(Boolean).slice(0, 8);
  if (said.length) out.said = said;
  /* Cancelled by whoever asked. Kept rather than deleted: somebody was sent a
     link and is owed an answer about why it stopped working. */
  if (raw.off) out.off = true;
  return out;
}

/* Held here rather than imported from the store, for the same reason memo.js
   carries its own code alphabet: this file leaves whole or it does not leave.
   store.js asserts the two lists match at load. */
export const CURRENCIES = ["cny", "aud", "hkd", "usd", "eur", "gbp", "jpy"];

export const REQUEST_MAX = 400;

/** Settled, waiting on the other half, or still owed. Three states and no
 *  fourth: "denied" is an argument in progress, and the page says it is still
 *  owed rather than telling somebody outside the room it is being argued
 *  about. */
export function requestState(r) {
  if (!r || r.off) return "off";
  const said = (k) => (r.said || []).some((x) => x.kind === k);
  if (said("confirmed")) return "paid";
  if (said("claimed")) return "waiting";
  return "due";
}

/** WHAT THE PERSON PAYING IS ALLOWED TO SEE.
 *
 *  An allowlist, not the row minus a few fields: the row will grow and a
 *  denylist would leak whatever is added to it next. `by` and `toWho` never
 *  come out — one is a device hash and the other is somebody's id on a board
 *  the reader may have nothing to do with. */
export function requestView(r, { payeeReady = false } = {}) {
  if (!r) return null;
  return {
    id: r.id,
    way: r.way || "in",
    from: r.from,
    to: r.to,
    amount: r.amount,
    cur: r.cur || "",
    what: r.what,
    when: r.when,
    at: r.at,
    state: requestState(r),
    /* False and the page says so rather than drawing a Pay button that opens
       a refusal. */
    payeeReady: Boolean(payeeReady),
  };
}
