/* A BROADCAST — one person on camera, any number watching, subtitles on top.
 *
 * For Laonei's Live tab: its own screen is the camera, recognises speech and
 * translates it; this is the room it goes out through and the page the
 * audience watches it on. Kept apart from the one-to-one call (calls.mjs),
 * which is two people who both talk, and from the shop lives (live.mjs +
 * market.mjs), which carry products and payments. This carries a picture,
 * a voice and subtitles, and nothing comes back.
 *
 *   POST /api/casts            { name?, title? }  → { id, watch, host: { url, token } }
 *   POST /api/casts/<id>/host  a fresh broadcaster ticket (after 6 hours, or a lost one)
 *   GET  /api/casts/<id>       { open, watching }
 *   POST /api/casts/<id>/end   everybody out; the watch link says it is over
 *
 * with `Authorization: Bearer <key>` from the app's SERVER, the same key as
 * /api/lives (make book-app). The app hands `host` to its Live screen, which
 * connects with it and publishes camera, microphone and — as data — the
 * subtitles: {type:"sub", zh, en, pinyin, at}. `watch` is the link for
 * everybody else.
 *
 * THE AUDIENCE CANNOT SPEAK. A viewer's ticket (POST /api/cast/<id>/watch,
 * from the watch page, no key) grants subscribe and nothing else: no camera,
 * no microphone, no data. LiveKit enforces it, not the page.
 *
 * SUBTITLES AS DATA, NOT PIXELS. Burning them into the video on the phone is
 * hot, blurs them, and fixes one language for everyone; sent as data, each
 * viewer's page draws them sharp and in the language that viewer picked.
 *
 * HOW MANY: up to live.mjs's CEIL (200) at once, one box's honest limit.
 */
import { load, save, newId } from "./store.mjs";
import { ticket, ensureRoom, watching, closeRoom, CEIL } from "./live.mjs";

const room = (c) => "cast-" + c.id;
const OPEN_MS = 12 * 3600e3;
const open = (c) => !c.off && Date.now() - Date.parse(c.at) < OPEN_MS;
const WATCH = (process.env.BOOK_CALL_PUBLIC || "https://call.laonei.co").replace(/\/$/, "");
const words = (v, n) => String(v || "").replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, n);

export function cleanCast(r) {
  if (!r || !/^[a-f0-9]{16}$/.test(r.id) || !/^[a-z0-9-]{1,30}$/.test(r.app)) return null;
  if (Number.isNaN(Date.parse(r.at))) return null;
  return { id: r.id, app: r.app, at: r.at, name: words(r.name, 30), title: words(r.title, 80), off: Boolean(r.off) };
}

const hostTicket = (c) => ticket(room(c), "host", c.name || "Live", true);

/** The app's side, with its key — see the top of this file. */
export async function appRoutes(req, res, p, { send, readBody, app }) {
  const m = p.match(/^\/api\/casts(?:\/([a-f0-9]{16})(?:\/(host|end))?)?$/);
  if (!m) return false;
  if (!app) return send(res, 401, { error: "key" }), true;
  const db = load();
  if (!m[1]) {
    if (req.method !== "POST") return send(res, 405, { error: "post" }), true;
    const b = (await readBody(req)) || {};
    const c = { id: newId(), app, at: new Date().toISOString(), name: words(b.name, 30), title: words(b.title, 80), off: false };
    // Finished ones are no use to anybody; dropped as new ones come.
    db.casts = db.casts.filter(open).concat(c);
    save(db);
    await ensureRoom(room(c), CEIL);
    const host = hostTicket(c);
    if (!host) return send(res, 503, { error: "off" }), true;
    console.log(`broadcast started by ${app}: ${c.name || c.id}`);
    return send(res, 201, { id: c.id, watch: `${WATCH}/cast/${c.id}`, host }), true;
  }
  // An app sees only its own, and somebody else's is the same "no" as none.
  const c = db.casts.find((x) => x.id === m[1] && x.app === app);
  if (!c) return send(res, 404, { error: "gone" }), true;
  if (m[2] === "end") {
    if (req.method !== "POST") return send(res, 405, { error: "post" }), true;
    c.off = true;
    save(db);
    await closeRoom(room(c));
    return send(res, 200, { ok: true }), true;
  }
  if (m[2] === "host") {
    if (req.method !== "POST") return send(res, 405, { error: "post" }), true;
    if (!open(c)) return send(res, 410, { error: "over" }), true;
    await ensureRoom(room(c), CEIL);
    return send(res, 200, { host: hostTicket(c) }), true;
  }
  return send(res, 200, { id: c.id, watch: `${WATCH}/cast/${c.id}`, open: open(c), watching: open(c) ? await watching(room(c)) : 0 }), true;
}

/** The audience's side: no key, a ticket that can only watch. */
export async function watchRoutes(req, res, p, { send }) {
  const m = p.match(/^\/api\/cast\/([a-f0-9]{16})\/watch$/);
  if (!m || req.method !== "POST") return false;
  // No per-address limit: a classroom behind one address is forty viewers,
  // and a ticket nobody uses costs nothing. LiveKit's cap is the limit.
  const c = load().casts.find((x) => x.id === m[1]);
  if (!c) return send(res, 404, { error: "gone" }), true;
  if (!open(c)) return send(res, 410, { error: "over" }), true;
  await ensureRoom(room(c), CEIL);
  if ((await watching(room(c))) >= CEIL) return send(res, 409, { error: "full" }), true;
  const t = ticket(room(c), "v-" + newId(), "", false);
  if (!t) return send(res, 503, { error: "off" }), true;
  return send(res, 200, { ...t, name: c.name, title: c.title }), true;
}
