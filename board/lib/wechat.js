/* WeChat as a third door, and the little that goes through it.
 *
 * WHAT THIS IS FOR. The identity on this board is a random number the browser
 * made up; the key is that number shown, and an address is six digits to the
 * same place. Neither survives contact with the way most people in China use a
 * phone: WeChat's browser has its own storage, so the same person opening the
 * same link in WeChat and in Safari is two people here — and telling them to
 * save a key or check an inbox is asking for a habit they do not have.
 *
 * WeChat already knows who they are. 网页授权 hands back one opaque string, the
 * openid, which is the same for that person in that account every time. That
 * is an identity, and it is all we take.
 *
 * snsapi_base AND NEVER snsapi_userinfo. The wider scope shows a consent
 * screen and returns a nickname, an avatar and a country. We want none of it:
 * the board asks for a name and a face on its own terms, and a login that
 * quietly imports somebody's WeChat profile is a different product. Base scope
 * is silent, returns the openid alone, and is the smaller thing to explain on
 * the privacy page.
 *
 * WHERE THIS RUNS, WHICH IS THE WHOLE ARCHITECTURE. WeChat will only call back
 * to a domain that is ICP 备案'd, and a domain can only be 备案'd while it is
 * served from a licensed mainland host. The board is in Tokyo and is staying
 * there. So a small box in Beijing holds a 备案'd domain and does one thing —
 * see scripts/wx-relay.mjs — and hands the openid here signed. The board never
 * moves and nobody browses it through China.
 *
 * The two halves are both here because they are the same three calls: this
 * file works unchanged whether the board is doing its own handshake (a
 * mainland-hosted board one day, or a test) or checking a relay's signature.
 *
 * NOTHING HERE IS TESTED AGAINST THE REAL WECHAT. There is no 服务号 to test
 * against until one exists. It is written from the documented shapes and it is
 * inert without credentials — see configured().
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const APPID = (process.env.BOARD_WX_APPID || "").trim();
const SECRET = (process.env.BOARD_WX_SECRET || "").trim();
/* What the relay and the board share, and the only thing that makes a posted
   openid worth believing. Separate from BOARD_SALT: the relay is a different
   box with a different job, and it has no business holding the salt every
   identity on this board is hashed with. */
const RELAY = (process.env.BOARD_WX_RELAY_SECRET || "").trim();

/** Whether this board can do its own handshake. */
export const configured = () => Boolean(APPID && SECRET);

/** Whether it will believe a relay. Either one is enough to offer the door. */
export const relayReady = () => Boolean(RELAY);

export const ready = () => configured() || relayReady();

/** Where to send somebody's browser. Opened inside WeChat and nowhere else:
 *  outside it this address shows WeChat's own "open in WeChat" page, which is
 *  the right answer and not one we have to write. */
export function authorizeUrl(back, state) {
  if (!configured()) return "";
  const q = new URLSearchParams({
    appid: APPID,
    redirect_uri: String(back),
    response_type: "code",
    scope: "snsapi_base",
    state: String(state || ""),
  });
  // The fragment is required by WeChat and must be last, after the query.
  return "https://open.weixin.qq.com/connect/oauth2/authorize?" + q + "#wechat_redirect";
}

/** A code, spent once, for an openid. Returns "" for anything that is not a
 *  clean answer — a code already used, a wrong appid, a network that was not
 *  there. The caller's only decision is whether it knows who this is. */
export async function openidFor(code) {
  if (!configured() || !code) return "";
  const q = new URLSearchParams({
    appid: APPID, secret: SECRET,
    code: String(code), grant_type: "authorization_code",
  });
  const stop = AbortSignal.timeout ? AbortSignal.timeout(10_000) : undefined;
  try {
    const r = await fetch("https://api.weixin.qq.com/sns/oauth2/access_token?" + q,
      { signal: stop });
    if (!r.ok) return "";
    const d = await r.json();
    /* WeChat answers 200 with an errcode in the body for every failure, so a
       response that "worked" is not a response that worked. The access token
       comes back too and is thrown away here: it opens the userinfo endpoint,
       which is the thing this door exists to not use. */
    return typeof d?.openid === "string" ? d.openid : "";
  } catch {
    return "";
  }
}

/* ---------------------------------------------------------------------------
 * The relay's signature
 *
 * The Beijing box sends an openid and the second it sent it. Signed, because
 * an endpoint that took an openid on trust would let anybody on the internet
 * sign in as anybody whose openid they had guessed or seen.
 *
 * The timestamp is inside the signature and checked for age, so a signed
 * message somebody kept is not a key they can spend next week.
 * ------------------------------------------------------------------------- */
const MINUTES = 5;

export const sign = (openid, at) =>
  createHmac("sha256", RELAY || "unset").update(openid + "." + at).digest("hex");

/** Whether this openid really came from the relay, recently. */
export function relayOk(openid, at, mac) {
  if (!relayReady() || !openid || !at || !mac) return false;
  const age = Math.abs(Date.now() - Number(at));
  if (!Number.isFinite(age) || age > MINUTES * 60_000) return false;
  const a = Buffer.from(String(mac));
  const b = Buffer.from(sign(String(openid), String(at)));
  return a.length === b.length && timingSafeEqual(a, b);
}
