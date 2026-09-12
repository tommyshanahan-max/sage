/* Telling somebody a message arrived, with no npm package and no payload.
 *
 * WHY IT MATTERS MORE THAN IT LOOKS. Every conversation on this board ends the
 * same way: somebody writes, the other person is not looking at the tab, and
 * nothing ever tells them. The messenger works and nobody comes back to it.
 * This is the return loop, and there has not been one.
 *
 * ---------------------------------------------------------------------------
 * NO DEPENDENCY, AND HOW THAT IS POSSIBLE
 *
 * Ferry does this with `web-push`, which is the right call there. The board
 * has two dependencies and that number is deliberate — every one of them is
 * code running on the box that holds what members write.
 *
 * The whole reason web push normally needs a library is the PAYLOAD: a message
 * body has to be encrypted to the browser's own keys, which is ECDH plus
 * HKDF plus AES128GCM and not something to hand-roll. A push with NO payload
 * skips all of it. What is left is one signed token and an empty POST, and the
 * signing is ES256, which node's crypto does.
 *
 * SO NOTHING IS SENT BUT THE BUZZ. The wording lives in sw.js and is always
 * the same. That is a real limitation — you cannot tell from the lock screen
 * who wrote or what they said — and it is also the honest shape for this
 * board, the same argument Ferry makes: a lock screen is the least private
 * surface a phone has, and a notification that CANNOT leak a name is worth
 * more than one that promises not to. It is also exactly what the product's
 * own privacy page can go on saying without a new sentence.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS STORED. A URL at Apple, Google or Mozilla, and the two keys the
 * browser generated, against a member's device hash. It says a device wants to
 * be told. It carries no address, no name, and it cannot be used to read
 * anything. A member who never turns this on stores none of it.
 *
 * OFF UNLESS A KEYPAIR IS SET, like translation and like mail. Nothing here
 * asks anybody for permission on a box that cannot send — a permission prompt
 * that leads nowhere is worse than no feature, because the browser remembers
 * the refusal and will not ask twice.
 *
 * `make board-keys` mints the pair.
 */
import { createPrivateKey, sign as cryptoSign, randomBytes } from "node:crypto";

const PUB = (process.env.BOARD_VAPID_PUBLIC || "").trim();
const PRIV = (process.env.BOARD_VAPID_PRIVATE || "").trim();
/* The push services require a contact for whoever is sending, so they have
   somebody to write to when a sender misbehaves. Theirs, never a member's. */
const SUB = (process.env.BOARD_VAPID_SUBJECT || "").trim();

const b64url = (buf) => Buffer.from(buf).toString("base64")
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");

/* THE PRIVATE KEY, REBUILT FROM THE TWO STRINGS IN .env.
 *
 * They are stored the way the whole web-push world stores them — raw base64url
 * — because that is what a browser needs for applicationServerKey and what
 * every other tool will expect if this is ever swapped for a library. Node
 * cannot import that directly, but it can import a JWK, and a JWK is those
 * same bytes in three labelled fields: the public key is one uncompressed
 * point, 0x04 then x then y, 32 bytes each.
 *
 * Built once at startup. A bad pair is a bad pair every time, and finding out
 * on the first push of the evening is finding out in the wrong place. */
let KEY = null;
let KEYERR = "";
if (PUB && PRIV) {
  try {
    const p = unb64url(PUB);
    if (p.length !== 65 || p[0] !== 4) throw new Error("public key is not an uncompressed P-256 point");
    const d = unb64url(PRIV);
    if (d.length !== 32) throw new Error("private key is not 32 bytes");
    KEY = createPrivateKey({
      format: "jwk",
      key: {
        kty: "EC", crv: "P-256",
        x: b64url(p.subarray(1, 33)),
        y: b64url(p.subarray(33, 65)),
        d: b64url(d),
      },
    });
  } catch (e) {
    KEYERR = (e && e.message) || "unreadable";
    KEY = null;
  }
}
if (KEYERR) console.error("push keys rejected:", KEYERR);

/** Whether a push can go out at all. The routes ask before they offer anybody
 *  the switch, so a board with no keys shows nothing rather than asking for a
 *  permission it cannot use. */
export const configured = () => Boolean(KEY && SUB);
/** What the browser needs to subscribe. Public by definition. */
export const publicKey = () => (configured() ? PUB : "");

/** A subscription as it is allowed to be stored. Anything else is refused —
 *  the endpoint is a URL this server will later POST to, so it is the one
 *  field here that has to be treated as an instruction and not as data. */
export function cleanSub(raw) {
  if (!raw || typeof raw !== "object") return null;
  const url = String(raw.endpoint || "");
  if (!/^https:\/\/[^\s]{10,500}$/.test(url)) return null;
  const k = raw.keys && typeof raw.keys === "object" ? raw.keys : {};
  const p256dh = String(k.p256dh || ""), auth = String(k.auth || "");
  /* Kept even though nothing here encrypts: they are what a payload would need
     if this ever grows one, and a subscription stored without them is a
     subscription that has to be asked for again. */
  if (!/^[A-Za-z0-9\-_=]{20,200}$/.test(p256dh)) return null;
  if (!/^[A-Za-z0-9\-_=]{8,100}$/.test(auth)) return null;
  return { endpoint: url, keys: { p256dh, auth } };
}

/* One VAPID token per push service, cached until it is nearly out.
 *
 * `aud` is the ORIGIN of the endpoint, not the endpoint — a token minted for
 * one device works for every device at the same service, and minting one per
 * device would be an EC signature per phone per message for nothing.
 *
 * Twelve hours is the ceiling the spec allows and the services enforce; asking
 * for the maximum and re-minting at eleven leaves an hour of slack for a box
 * whose clock has drifted. */
const TOKENS = new Map();
function token(aud) {
  const now = Math.floor(Date.now() / 1000);
  const have = TOKENS.get(aud);
  if (have && have.exp - now > 3600) return have.jwt;
  const head = b64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const exp = now + 12 * 3600;
  const body = b64url(JSON.stringify({ aud, exp, sub: SUB }));
  const data = Buffer.from(head + "." + body);
  /* ieee-p1363, NOT der. A JOSE signature is r and s as 64 raw bytes; node's
     default for EC is DER, which the push services reject with a 401 that says
     nothing about why. */
  const sig = cryptoSign("sha256", data, { key: KEY, dsaEncoding: "ieee-p1363" });
  const jwt = head + "." + body + "." + b64url(sig);
  TOKENS.set(aud, { jwt, exp });
  return jwt;
}

/** Tell one device. Resolves to "gone" when the browser has thrown the
 *  subscription away, "" on success, and "fail" for anything else — a bad
 *  afternoon at a push service is not a reason to forget somebody's phone. */
async function one(sub) {
  let aud;
  try { aud = new URL(sub.endpoint).origin; } catch { return "gone"; }
  /* A CEILING ON HOW LONG THIS MAY HOLD ANYTHING. Nobody is watching a spinner
     — this runs after the reply has already gone back — but a hung fetch holds
     a socket and a slot, and there are as many of these as there are devices. */
  const stop = AbortSignal.timeout ? AbortSignal.timeout(10_000) : undefined;
  try {
    const r = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: "vapid t=" + token(aud) + ", k=" + PUB,
        TTL: "86400",
        // No body, so no Content-Encoding and no Content-Length beyond zero.
        // A push service reading an encryption header it then finds nothing to
        // decrypt answers 400.
        "Content-Length": "0",
        /* Wake the phone. Without this Apple holds a low-priority push until
           the device is next up anyway, which for a message is the whole
           point missed. */
        Urgency: "high",
      },
      signal: stop,
    });
    if (r.status === 404 || r.status === 410) return "gone";
    if (!r.ok) return "fail";
    return "";
  } catch { return "fail"; }
}

/** Tell every device on `subs`, and hand back the endpoints that are dead so
 *  the caller can drop them. Never throws: a notification that fails is a
 *  notification that did not arrive, and nothing upstream should care. */
export async function tell(subs) {
  if (!configured() || !Array.isArray(subs) || !subs.length) return [];
  const dead = [];
  await Promise.all(subs.map(async (s) => {
    if (await one(s) === "gone") dead.push(s.endpoint);
  }));
  return dead;
}
