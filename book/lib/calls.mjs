/* A TRANSLATED CALL — two people, two languages, subtitles both ways.
 *
 * Somebody opens /call, presses Start, and sends the link; whoever opens it
 * is in the call. Each phone listens to its own speaker with the browser's
 * built-in dictation (see call.html) and sends each finished sentence here as
 * text; this translates it (lib/speak.mjs) and says it into the room, where
 * the other phone shows it under the video. Words appear on the other screen
 * as they are spoken, in the speaker's language, and the translation replaces
 * them a second after the sentence ends.
 *
 * THE VIDEO IS LIVEKIT's, the same server as the live classes (live.mjs):
 * it already answers from Tokyo to phones in China and outside it, through
 * the relay when a network needs one. A call is a LiveKit room of two.
 *
 * TWO PEOPLE, ONE LINK. The link is the whole key, like a lesson room's: no
 * accounts, nothing to sign up for, which is what makes it something to hand
 * somebody in China. Open for a day from when it was made.
 *
 * FREE, SO CAPPED: making a call is limited per address (server.mjs's
 * bucket), and translating per call and per day (speak.mjs).
 */
import { randomBytes } from "node:crypto";
import { load, save, newId } from "./store.mjs";
import { ticket, ensureRoom, watching, tell } from "./live.mjs";
import * as speak from "./speak.mjs";

const room = (c) => "call-" + c.id;
const OPEN_MS = 24 * 3600e3;
const open = (c) => Date.now() - Date.parse(c.at) < OPEN_MS;

// Who is in which call, speaking what — memory only; a phone that rejoins
// after a restart says so again.
const PEOPLE = new Map();
const langOf = (v) => (v === "zh" ? "zh" : "en");

export function cleanCall(r) {
  if (!r || !/^[a-f0-9]{16}$/.test(r.id) || !/^[a-f0-9]{24}$/.test(r.key)) return null;
  if (Number.isNaN(Date.parse(r.at))) return null;
  return { id: r.id, key: r.key, at: r.at };
}

export async function routes(req, res, p, { send, readBody, allowed, ip }) {
  if (p === "/api/call" && req.method === "POST") {
    if (!allowed(ip)) return send(res, 429, { error: "slow" }), true;
    const db = load();
    const c = { id: newId(), key: randomBytes(12).toString("hex"), at: new Date().toISOString() };
    // Calls older than a day are no use to anybody; drop them as new ones come.
    db.calls = db.calls.filter(open).concat(c);
    save(db);
    return send(res, 201, { id: c.id, key: c.key }), true;
  }
  const m = p.match(/^\/api\/call\/([a-f0-9]{16})\/(join|say)$/);
  if (!m || req.method !== "POST") return false;
  const b = (await readBody(req)) || {};
  const c = load().calls.find((x) => x.id === m[1]);
  if (!c || String(b.key || "") !== c.key) return send(res, 403, { error: "key" }), true;
  if (!open(c)) return send(res, 410, { error: "over" }), true;
  const people = PEOPLE.get(c.id) || new Map();
  PEOPLE.set(c.id, people);

  if (m[2] === "join") {
    await ensureRoom(room(c), 1);
    if ((await watching(room(c))) >= 2) return send(res, 409, { error: "full" }), true;
    const me = "p-" + newId();
    const name = String(b.name || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 30);
    people.set(me, { lang: langOf(b.lang), name });
    const t = ticket(room(c), me, name, true);
    if (!t) return send(res, 503, { error: "off" }), true;
    return send(res, 200, { ...t, me, subtitles: speak.on() }), true;
  }

  // SAY: one finished sentence, as the speaker's phone heard it.
  const text = String(b.text || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 300);
  const who = String(b.me || "");
  if (!/^p-[a-f0-9]{16}$/.test(who)) return send(res, 400, { error: "empty" }), true;
  /* WHAT WAS SAID IS READ FROM THE WORDS, not from the button. The button is
     what this person reads (and what their dictation listens for); picked
     wrong, it used to label English as Chinese, and the other phone was sent
     English "translated" into English — nothing, as far as anybody could see.
     Han characters mean Chinese; anything else is English. */
  const reads = langOf(b.lang);
  if (people.has(who)) people.get(who).lang = reads; else people.set(who, { lang: reads, name: "" });
  // A language changed mid-call arrives with no words: noted, nothing said.
  if (!text) return send(res, b.lang ? 200 : 400, b.lang ? { ok: true } : { error: "empty" }), true;
  const from = /[\u3400-\u9fff\uf900-\ufaff]/.test(text) ? "zh" : "en";
  // Into every language somebody else in the call speaks; when nobody else
  // has said, into the other one of the two.
  const others = [...people.entries()].filter(([k]) => k !== who).map(([, v]) => v.lang);
  const targets = [...new Set(others.length ? others : [from === "zh" ? "en" : "zh"])].filter((l) => l !== from);
  const tr = {};
  for (const to of targets) {
    try { tr[to] = await speak.translate(text, to, c.id); }
    catch (e) { tr[to] = ""; if (e.message === "busy") return send(res, 429, { error: "busy" }), true; }
  }
  await tell(room(c), { t: "cap", who, lang: from, text, tr });
  return send(res, 200, { ok: true, tr }), true;
}
