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
  /* THE CURRENCY, FROM THE SIGN THEY WROTE IT WITH.
   *
   * This took a request with no `cur` on it, and every payment on it failed:
   * toMinor refuses an amount it cannot price, the route answered "amount",
   * and the screen said "that did not open" for all three methods. The amount
   * said ¥1 the whole time.
   *
   * So the sign decides when nothing else does. It is on the front of every
   * amount anybody types, and a request whose currency has to be supplied
   * separately is a request that will one day be sent without one.
   *
   * ¥ IS BOTH YUAN AND YEN and this picks yuan. On a board built for money
   * crossing the Chinese border that is right far more often than not; a yen
   * request passes cur explicitly. Guessing wrong here is a visible wrong
   * number on a page, not a silent one. */
  out.cur = CURRENCIES.includes(raw.cur) ? raw.cur : curOf(out.amount);
  if (!out.cur) delete out.cur;
  /* THE PERSON PAYING, WHEN THEY ARE ON THE BOARD. Optional, and only so the
     request can appear on their side too — on their card, and in what they
     have paid. A request to somebody who has never heard of this board is
     the normal case and works without it. */
  const toWho = /^[a-f0-9]{20}$/.test(String(raw.toWho || "")) ? String(raw.toWho) : "";
  if (toWho) out.toWho = toWho;

  /* WHERE THE MONEY LANDS WHEN IT IS NOT A MEMBER'S.
   *
   * Sending money to somebody needs an account for them, and they may have
   * nothing to do with this board — that is the normal case. So the account
   * is minted against the request itself when they press the button on the
   * page, and lives here. A member's own account stays on their row where it
   * belongs; this is only for the other kind.
   *
   * Stripe's own identifier, useless to anybody who is not this platform.
   * Never a bank number, and never sent to the page. */
  const acct = s(raw.acct, 64);
  if (/^acct_[A-Za-z0-9]+$/.test(acct)) out.acct = acct;
  /* Set once Stripe says the account can actually take a transfer. Onboarding
     is not one screen, and somebody who abandoned it halfway has an id and no
     ability to be paid. */
  if (raw.landed) out.landed = true;

  /* THE CODE ON THE WALL, AND HOW TO ASK ABOUT IT LATER.
   *
   * A WeChat or Alipay payment on this request is one payment intent at the
   * provider, and its id is the only way to find out whether the money
   * arrived. It has to live on the row rather than in the payer's browser,
   * because the payer is not a witness: they long-press a code, pay inside
   * their wallet, and may never come back to this page at all. The person
   * owed the money opens their list an hour later and that is where the
   * answer has to be waiting.
   *
   * The provider's own identifier, useless to anybody who is not this
   * platform, and never sent to either page. */
  const pay = raw.pay && typeof raw.pay === "object" ? {
    ref: s(raw.pay.ref, 64),
    how: ["wechat", "alipay"].includes(raw.pay.how) ? raw.pay.how : "",
    at: s(raw.pay.at, 40),
    /* WHAT THE PAYER WAS ACTUALLY ASKED FOR, in the smallest unit of yuan.
       A request written in Australian dollars is paid in yuan at the rate
       when the code was drawn, and the row has to remember which number was
       on the screen — the amount above it is the asker's currency and is no
       longer the whole story. Empty when the request was in yuan already. */
    cny: /^[0-9]{1,15}$/.test(String(raw.pay.cny ?? "")) ? String(raw.pay.cny) : "",
  } : null;
  if (pay && pay.ref && pay.how) out.pay = pay;

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

/** Which currency an amount is written in, from its sign. Longest first, so
 *  A$ and HK$ are read before the $ inside them. "" when it cannot be told —
 *  which is a request that cannot be paid, said as such rather than guessed
 *  at. */
const SIGNS = [
  ["HK$", "hkd"], ["A$", "aud"], ["US$", "usd"],
  ["\u00a5", "cny"], ["\uffe5", "cny"], ["\u5143", "cny"],
  ["\u20ac", "eur"], ["\u00a3", "gbp"], ["$", "usd"],
];
export function curOf(amount) {
  const t = String(amount || "");
  for (const [sign, cur] of SIGNS) if (t.includes(sign)) return cur;
  return "";
}

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
  /* SENDING MONEY HAS A STATE THE OTHER DIRECTION DOES NOT: waiting on the
     person being paid to say where it should land. Until they have, there is
     nothing for the sender to press, and a row that said "due" would be
     telling them to do a thing they cannot do. */
  if ((r.way || "in") === "out" && !r.landed) return "asking";
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
    /* Whether the person being paid has finished saying where. Only ever a
       yes or no — the account id never leaves the server. */
    landed: Boolean(r.landed),
    /* False and the page says so rather than drawing a Pay button that opens
       a refusal. */
    payeeReady: Boolean(payeeReady),
    /* WHETHER A CODE WAS EVER PUT ON THE SCREEN FOR THIS ONE. Not the code
       and not the provider's id for it — only that there is something to ask
       about, so a page that opens on an unpaid request knows whether asking
       is worth a call. */
    coded: Boolean(r.pay && r.pay.ref),
  };
}
