/* Telling somebody a line arrived, without being able to say what it says.
 *
 * WHY THIS IS THE HARD PART OF THE PROMISE. Everywhere else, "the server
 * cannot read it" costs nothing — the browser encrypts, the disk holds a blob,
 * and the feature works. A notification is where products give it up: the
 * easiest lock screen to build shows the message, and showing the message
 * means the server had it.
 *
 * So the push carries no payload but a room id. The wording lives in sw.js and
 * is always the same: somebody wrote to you. That is a real limitation — you
 * cannot triage from the lock screen — and it is the honest shape. A lock
 * screen is the least private surface a phone has, and a product that CANNOT
 * leak a message there is worth more than one that promises not to.
 *
 * WHAT IS STORED. A subscription is a URL at Apple or Google plus two keys
 * belonging to the browser, kept beside the room under the chair it belongs
 * to. It says a device is in a room. It does not say who, and it cannot be
 * used to read anything. That is a small piece of metadata this box does hold,
 * and it is the price of the phone buzzing; a room with nobody subscribed
 * stores none of it at all.
 *
 * OFF UNLESS A KEYPAIR IS SET, like translation. Nothing here asks a person
 * for permission on a box that cannot send.
 */

import webpush from "web-push";

const PUB = (process.env.FERRY_VAPID_PUBLIC || "").trim();
const KEY = (process.env.FERRY_VAPID_PRIVATE || "").trim();
/* A contact address, which the push services require so they have somebody to
   write to when a sender misbehaves. Theirs, not the user's. */
const WHO = (process.env.FERRY_VAPID_SUBJECT || "mailto:hello@example.com").trim();

export const configured = () => Boolean(PUB && KEY);
export const publicKey = () => PUB;

if (configured()) {
  try { webpush.setVapidDetails(WHO, PUB, KEY); }
  catch (e) { console.error("push keys rejected:", e && e.message); }
}

/** A subscription as it is allowed to be stored. Anything else is refused. */
export function cleanSub(raw) {
  if (!raw || typeof raw !== "object") return null;
  const url = String(raw.endpoint || "");
  // https and nothing else: an endpoint is a URL this server will fetch, and
  // the only thing that should ever appear there is a push service.
  if (!/^https:\/\/[^\s]{10,500}$/.test(url)) return null;
  const k = raw.keys && typeof raw.keys === "object" ? raw.keys : {};
  const p256dh = String(k.p256dh || ""), auth = String(k.auth || "");
  if (!/^[A-Za-z0-9\-_=]{20,200}$/.test(p256dh)) return null;
  if (!/^[A-Za-z0-9\-_=]{8,100}$/.test(auth)) return null;
  return {
    endpoint: url,
    keys: { p256dh, auth },
    side: raw.side === "b" ? "b" : "a",
    at: new Date().toISOString(),
  };
}

/* Everybody in the room who is NOT the person who just wrote. Today that is
 * one other chair, and possibly several of their devices. */
export async function tell(room, id, fromSide) {
  if (!configured() || !room || !Array.isArray(room.subs)) return [];
  const dead = [];
  await Promise.all(room.subs
    .filter((s) => s.side !== fromSide)
    .map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: s.keys },
          JSON.stringify({ room: id }),
          { TTL: 3600 },
        );
      } catch (err) {
        /* 404 and 410 mean the browser threw the subscription away — an
           uninstalled app, a cleared site, a phone reset. Anything else is a
           bad afternoon at the push service and is not a reason to forget
           somebody's phone. */
        const code = err && err.statusCode;
        if (code === 404 || code === 410) dead.push(s.endpoint);
        else console.error("push failed:", code || "unknown");
      }
    }));
  return dead;
}
