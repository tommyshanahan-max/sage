/* THE DEAL MEMO, AS A THING THAT COULD LEAVE THIS BOARD
 * ===========================================================================
 *
 * A memo link is one deal, sent to one person, openable outside the door.
 * They read the terms and they pay the row that is due. They cannot agree,
 * cannot change a word, and cannot see the room it came from.
 *
 * WHY THIS IS ITS OWN FILE. The memo is the one part of this board that is
 * not about the board: two people, some terms, and a payment. Tom's brief was
 * to build it here "with the vision that this can be a standalone app, or
 * website in the future, or payment widget that can be put onto any platform",
 * so nothing in here knows about rooms, members, handles-as-identity, the
 * door, or express. It takes a deal-shaped object and returns plain data.
 * Lifting it out is then a new front end and a store, not a rewrite.
 *
 * WHAT THAT RULES OUT, deliberately:
 *   - no `import` from server.js, and none from store.js beyond the code
 *     alphabet, which is a shared format rather than a shared behaviour;
 *   - no reading of `board.people` or `board.groups` — the caller resolves
 *     who the payee is and passes it in;
 *   - no knowledge of devices as the board defines them. A viewer is an
 *     opaque string to this file.
 *
 * THE SECURITY MODEL, said out loud because it is small on purpose.
 *
 * The token is unguessable and the code is the gate — the same split the
 * invite uses, for the same reason: a link forwarded by accident opens
 * nothing. What is different from the invite is that a memo is not spent on
 * arrival. Somebody reads the terms on Tuesday and pays on Friday, and a
 * one-use link would be a dead link by then.
 *
 * So the bound viewers are capped instead. The first two viewers to enter the
 * code are remembered and never asked again; a third is refused. That is the
 * honest bound on a code pasted into a group chat — it stops twelve people
 * reading somebody's fee, and it survives one person changing phones once.
 * It is not a claim that the memo cannot be forwarded on purpose. It can be,
 * by the person it was sent to, and no software written here prevents that.
 */
import { randomBytes } from "node:crypto";

/* THE CODE FORMAT, CARRIED RATHER THAN IMPORTED.
 *
 * These eleven lines are the same as the door's in store.js, and that is on
 * purpose: importing them would point this file back at the board it is
 * supposed to be able to leave, and it would be a cycle besides, because
 * store.js imports `cleanShare` from here.
 *
 * Duplication is the cost and drift is the risk, so store.js asserts the two
 * alphabets are identical at load. A code minted under one and checked under
 * the other would be refused with no error anywhere, which is the kind of bug
 * that takes a day. */
export const MEMO_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const cleanCode = (v) => {
  const t = String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (t.length !== 6) return "";
  for (const ch of t) if (!MEMO_ALPHABET.includes(ch)) return "";
  return t;
};

/* Sixteen hex — 64 bits. The code is what stops a stranger, but a token short
   enough to appear in a log or a shoulder-glance is a token worth widening. */
export const cleanToken = (v) =>
  (/^[a-f0-9]{16}$/.test(String(v ?? "")) ? String(v) : "");

export const newToken = () => randomBytes(8).toString("hex");

/** Six characters, same alphabet as the door's, so a person who has seen one
 *  of these codes recognises the other. */
export function newMemoCode() {
  const bytes = randomBytes(6);
  let out = "";
  for (const b of bytes) out += MEMO_ALPHABET[b % MEMO_ALPHABET.length];
  return out;
}

/* A DAY, AND THE PAGE COUNTS IT DOWN.
 *
 * Same number and same reason as the invite: "good for 24 hours" is true
 * without anybody remembering to make it true. A memo that sat in a chat for
 * a month would be a fee anybody scrolling back could read. */
export const MEMO_HOURS = 24;
/* Two, and the note at the top of this file says why. */
export const MEMO_VIEWERS = 2;

/** What gets written on the deal. `to` is a name for the person minting it to
 *  read back — "did I send this to Sasha or to Ray" — and the page greets
 *  them with it, the way the door says who let you in. */
export function newShare({ to, hours = MEMO_HOURS, at = new Date() }) {
  const t = newToken();
  return {
    t,
    code: newMemoCode(),
    to: String(to ?? "").slice(0, 64).trim(),
    at: at.toISOString(),
    until: new Date(at.getTime() + hours * 3600 * 1000).toISOString(),
    saw: [],
  };
}

/** The stored shape, checked on load the way every other row here is. */
export function cleanShare(raw) {
  if (!raw || typeof raw !== "object") return null;
  const t = cleanToken(raw.t);
  const code = cleanCode(raw.code);
  if (!t || !code) return null;
  const s = (v, n) => String(v ?? "").replace(/[^\P{C}]/gu, "").trim().slice(0, n);
  const until = s(raw.until, 40);
  if (!until) return null;
  return {
    t, code,
    to: s(raw.to, 64),
    at: s(raw.at, 40) || new Date().toISOString(),
    until,
    /* Opaque to this file. The board passes device hashes; a standalone
       version could pass anything it can tell viewers apart by. */
    saw: (Array.isArray(raw.saw) ? raw.saw : [])
      .map((v) => s(v, 64)).filter(Boolean).slice(0, MEMO_VIEWERS),
    ...(raw.off ? { off: true } : {}),
  };
}

export const shareLive = (share, now = new Date()) =>
  Boolean(share && !share.off && new Date(share.until) > now);

/* THE FOUR WAYS IN, AND THE FOUR WAYS IT IS REFUSED.
 *
 * Every refusal is its own reason rather than one "no", because the four are
 * different things to the person holding the link and only one of them is
 * worth trying again: a wrong code is a typo, an expired link needs a new one,
 * a full one needs the sender to know, and a withdrawn one is over.
 *
 * NO PARTIAL CREDIT ON THE CODE, and the comparison comes in from outside.
 * The default is `===`, which is what a standalone copy of this file gets; the
 * board passes its timing-safe compare, the same one the door uses. Six
 * characters is short enough that a timing attack is theory and the throttle
 * upstairs is the real answer — but the door already owns a safe compare and
 * there is no reason for the memo to be the weaker of the two. */
export function openShare(share, { code, viewer, now = new Date(), same }) {
  const eq = typeof same === "function" ? same : (a, b) => a === b;
  if (!share || share.off) return { error: "gone" };
  if (!shareLive(share, now)) return { error: "expired" };
  const who = String(viewer ?? "").slice(0, 64);
  if (!who) return { error: "no" };
  /* Already known: never asked again, and never counted twice. */
  if (share.saw.includes(who)) return { ok: true, saw: share.saw };
  const given = cleanCode(code);
  if (!given || !eq(given, share.code)) return { error: "code" };
  if (share.saw.length >= MEMO_VIEWERS) return { error: "full" };
  return { ok: true, saw: [...share.saw, who] };
}

/* WHAT THE PAGE IS ALLOWED TO SEE.
 *
 * Built as an allowlist and never as "the deal minus a few fields", because
 * the deal grows and a denylist would leak the next thing added to it. What
 * is deliberately not here: `by` and the device hashes behind it, the group
 * id, anybody's handle beyond the two names already printed on the terms, and
 * the payee's account id.
 *
 * `paid` comes through as state rather than as sentences, so the page can
 * draw a chip without being told who said what and when — that record belongs
 * to the two of them, in the room. */
const TERMS = ["what", "where", "when", "fee", "deposit", "covers", "cancel"];

export function memoView(deal, { payeeReady = false, now = new Date() } = {}) {
  if (!deal) return null;
  const said = (i, kind) => (deal.paid || []).some((r) => r.i === i && r.kind === kind);
  const plan = (deal.plan || []).map((row, i) => ({
    i,
    label: row.label || "",
    amount: row.amount || "",
    due: row.due || "",
    /* Three states and no fourth: paid, waiting on the other side, due.
       "Denied" is an argument in progress and is not a thing to hand to
       somebody standing outside the room it is happening in. */
    state: said(i, "confirmed") ? "paid" : said(i, "claimed") ? "waiting" : "due",
  }));
  return {
    title: deal.title || "",
    hires: deal.hires || "",
    provides: deal.provides || "",
    cur: deal.cur || "",
    terms: TERMS.map((k) => [k, deal[k] || ""]).filter(([, v]) => v),
    plan,
    /* Whether the in-app payment can run at all. False and the page says so
       rather than drawing a Pay button that opens a refusal. */
    payeeReady: Boolean(payeeReady),
    now: now.toISOString(),
  };
}
