/* What the server can and cannot read, in one file.
 *
 * IT CANNOT READ THE MESSAGES. A room's key is generated in a browser and
 * lives in the fragment of its link — the part after `#`, which browsers do
 * not send to servers, by the rule rather than by our good manners. Every line
 * is encrypted with it before it is posted and decrypted after it is fetched,
 * both in the browser. What arrives here is a base64 blob, a timestamp, and
 * which side of the room it came from.
 *
 * THE ONE EXCEPTION IS TRANSLATION, and it is deliberate rather than hidden.
 * Rendering a line in the other language means somebody has to read it. So the
 * browser sends that one line, in the clear, to /api/translate, gets the
 * sentence back, and encrypts that too before storing it. The text exists here
 * for the length of one request and is never written to disk or to a log.
 *
 * WHAT THIS IS NOT. It is not end to end encrypted and this repository will
 * not call it that: the translation exception is real, and a room's key is in
 * a link that two people have. It protects against the operator of this box, a
 * stolen disk, a subpoena served on the server, and every messenger that reads
 * what passes through it. It does not protect against somebody holding the
 * link or holding an unlocked phone.
 *
 * THIS FILE HOLDS NO KEYS. It exists to keep the server honest — the shapes
 * below are the only things a room may contain, and the checks refuse anything
 * that looks like plaintext arriving by accident.
 */

/** A room id: the public half, in the path. Never the key. */
export const ROOM = /^[a-z0-9]{10}$/;

/** A line as it is allowed to be stored. Anything else is refused. */
export function cleanLine(raw) {
  if (!raw || typeof raw !== "object") return null;
  const s = (v, n) => String(v ?? "").slice(0, n);

  /* Base64 and nothing else. A caller who posts readable text here has a bug
     in their page, and storing it would quietly turn the whole promise off for
     that room — so it is refused loudly instead. */
  const box = s(raw.box, 20000);
  if (!box || !/^[A-Za-z0-9+/=]+$/.test(box)) return null;

  const id = s(raw.id, 32);
  if (!/^[a-z0-9]{12}$/.test(id)) return null;

  return {
    id,
    at: new Date().toISOString(),
    /* WHICH SIDE, NOT WHO. A room has two chairs. The name a person typed is
       inside the encrypted blob with everything else; the server needs to know
       only that these two lines came from different people, so that a page can
       lay them out left and right before it has decrypted anything. */
    side: raw.side === "b" ? "b" : "a",
    box,
    /* Spoken, and it is outside the encryption on purpose: it changes how a
       line is laid out, and a page that must decrypt before it can draw a
       skeleton is a page that flashes. It says nothing about the content. */
    said: Boolean(raw.said),
  };
}

/** A room, as stored. No key, no names, no text. */
export function cleanRoom(raw, cleanSub) {
  const r = raw && typeof raw === "object" ? raw : {};
  const lines = Array.isArray(r.lines) ? r.lines.map(cleanLine).filter(Boolean) : [];
  /* WHICH PHONES TO BUZZ, and nothing more about them. A push subscription is
     a URL at Apple or Google and two keys belonging to a browser. It says a
     device is in this room; it does not say who, and it cannot read a word.
     That is the one piece of metadata a room holds beyond its timestamps, and
     it is the price of a phone buzzing — a room nobody subscribed from stores
     none of it. Cleaned by the push module, passed in so this file keeps
     knowing nothing about how a notification is sent. */
  const subs = (Array.isArray(r.subs) && cleanSub)
    ? r.subs.map(cleanSub).filter(Boolean).slice(0, 8) : [];
  return {
    subs,
    at: typeof r.at === "string" ? r.at : new Date().toISOString(),
    /* Touched on every read as well as every write, because a room somebody is
       still reading is not idle — see the sweep in server.mjs. */
    seen: typeof r.seen === "string" ? r.seen : new Date().toISOString(),
    lines,
  };
}
