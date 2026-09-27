/* LIVES STARTED BY ANOTHER APP — Laonei first.
 *
 * `make book-live` is Tom at a terminal. An app starts a live the same way
 * from its own server, with the key `make book-app NAME=laonei` printed:
 *
 *   POST /api/lives          { host, title?, when?, max? }  → the two links
 *   GET  /api/lives/<id>     how it is going: open, watching, takings
 *   POST /api/lives/<id>/end everybody out, both links say it is over
 *
 * with `Authorization: Bearer <key>`. From the app's SERVER, never its pages:
 * the key starts lives, and a key in a page is a key anybody can read. (A
 * browser could not send it anyway: the CORS headers in server.mjs do not
 * allow an Authorization header, so the preflight fails.) The
 * links it gets back are the ones to show — the seller's to whoever is going
 * live, the viewers' to everybody else.
 *
 * AN APP SEES ONLY ITS OWN. Every live it starts is marked with its name,
 * and asking about somebody else's is the same "no" as one that never was.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { load, save } from "./store.mjs";
import { newLive, links, liveOpen, watching, closeRoom } from "./live.mjs";

/** Which app this request is from, or "" — by the hash of its key. */
function whose(req, db) {
  const m = /^Bearer\s+(bk_[a-f0-9]{48})$/.exec(String(req.headers.authorization || ""));
  if (!m) return "";
  const h = createHash("sha256").update(m[1]).digest();
  const a = db.apps.find((x) => timingSafeEqual(Buffer.from(x.hash, "hex"), h));
  return a ? a.name : "";
}

export async function routes(req, res, p, { send, readBody }) {
  const m = p.match(/^\/api\/lives(?:\/([a-f0-9]{16})(\/end)?)?$/);
  if (!m) return false;
  const db = load();
  const app = whose(req, db);
  if (!app) return send(res, 401, { error: "key" }), true;

  if (!m[1]) {
    if (req.method !== "POST") return send(res, 405, { error: "post" }), true;
    const b = await readBody(req);
    if (!b) return send(res, 400, { error: "json" }), true;
    const made = newLive({ host: b.host, title: b.title, when: b.when, max: b.max, app });
    if (made.error) return send(res, 400, { error: made.error }), true;
    db.lives.push(made.live);
    save(db);
    console.log(`live started by ${app}: ${made.live.host}`);
    return send(res, 201, links(made.live)), true;
  }

  const l = db.lives.find((x) => x.id === m[1] && x.app === app);
  if (!l) return send(res, 404, { error: "gone" }), true;

  if (m[2]) {
    if (req.method !== "POST") return send(res, 405, { error: "post" }), true;
    l.off = true;
    save(db);
    await closeRoom("live-" + l.id);
    return send(res, 200, { ok: true }), true;
  }

  const open = liveOpen(l);
  const paid = l.sales.filter((x) => x.paid);
  return send(res, 200, {
    ...links(l), host: l.host, title: l.title, open,
    watching: open ? await watching("live-" + l.id) : 0,
    takings: { yuan: paid.reduce((n, x) => n + x.yuan, 0), sold: paid.filter((x) => x.kind === "item").length, gifts: paid.filter((x) => x.kind === "gift").length },
  }), true;
}
