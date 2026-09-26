/* Book — one-to-one lessons, as a widget any of Tom's apps can carry.
 *
 * A shelf is a named list of teachers ("studypal", say). An app drops two
 * lines into a page —
 *
 *   <div data-book="studypal"></div>
 *   <script src="https://<board domain>/book/widget.js" async></script>
 *
 * — and gets the list, a teacher's free hours, and a booking form. Everything
 * the widget needs comes from here; the app hosting it needs no server of its
 * own and no key.
 *
 * WHY A SEPARATE CONTAINER AND NOT A ROUTE ON THE BOARD. The board is one
 * product with its own door; this is meant to be carried by several, including
 * ones that have nothing to do with the board. It lives under the board's
 * hostname only so that it needs no DNS record and no .env line to exist —
 * see docker/sites/board.caddy — and could move to a name of its own without
 * the widget changing, because the widget reads its address off its own
 * <script src>.
 *
 * OPEN TO EVERY ORIGIN, ON PURPOSE. The whole point is to be embedded in pages
 * this box does not serve, and there are no cookies or keys on any request, so
 * `Access-Control-Allow-Origin: *` gives a stranger nothing they could not get
 * by opening the widget themselves. What a stranger can do is book, which is
 * rate-limited per address below.
 *
 * Teachers are added from the command line (`make book-teacher`), never from
 * the web. There is no admin page, so there is no admin password to leak.
 */
import http from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load, save, newId, slotsFor, shown, cleanBooking, splitFor } from "./lib/store.mjs";
import * as room from "./lib/room.mjs";
import { teamView, tutorView } from "./lib/team.mjs";
import * as notify from "./lib/notify.mjs";

// Where the service is reached from outside — for links put in messages.
const PUBLIC = (process.env.BOOK_PUBLIC || "https://thexchange.app/book").replace(/\/$/, "");

room.turnSetup();

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);

const FILES = {
  "/widget.js": ["public/widget.js", "text/javascript; charset=utf-8"],
  "/": ["public/index.html", "text/html; charset=utf-8"],
  "/index.html": ["public/index.html", "text/html; charset=utf-8"],
};

/* A BOOKING BUCKET PER ADDRESS: ten, then one more every six minutes. A
   public form that writes to a file is a form somebody will one day post to
   in a loop. */
const BUCKET = new Map();
function allowed(ip) {
  const now = Date.now();
  const b = BUCKET.get(ip) || { n: 10, t: now };
  b.n = Math.min(10, b.n + (now - b.t) / 360e3);
  b.t = now;
  if (b.n < 1) { BUCKET.set(ip, b); return false; }
  b.n -= 1;
  BUCKET.set(ip, b);
  if (BUCKET.size > 5000) BUCKET.clear();
  return true;
}

function send(res, code, body, type = "application/json; charset=utf-8") {
  res.writeHead(code, {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": type.startsWith("application/json") ? "no-store" : "public, max-age=300",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req, limit = 4096) {
  return new Promise((resolve) => {
    let n = 0; const parts = [];
    req.on("data", (c) => { n += c.length; if (n > limit) req.destroy(); else parts.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(parts).toString("utf8"))); } catch { resolve(null); } });
    req.on("error", () => resolve(null));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const p = url.pathname;
  if (req.method === "OPTIONS") return send(res, 204, "");

  if (req.method === "GET" && FILES[p]) {
    const [f, type] = FILES[p];
    try { return send(res, 200, readFileSync(path.join(HERE, f)), type); }
    catch { return send(res, 404, { error: "missing" }); }
  }

  // THE SHELF: every teacher on it who is switched on, with their next free
  // time. Soonest first, because "who can I have tonight" is the question.
  let m = p.match(/^\/api\/shelf\/([a-z0-9-]{1,40})$/);
  if (req.method === "GET" && m) {
    const db = load();
    const list = db.teachers.filter((t) => t.shelf === m[1] && t.on).map((t) => shown(db, t));
    list.sort((a, b) => (a.next || "~").localeCompare(b.next || "~"));
    return send(res, 200, { teachers: list });
  }

  // ONE TEACHER and the next week of their hours, free or taken.
  m = p.match(/^\/api\/teacher\/([a-f0-9]{16})$/);
  if (req.method === "GET" && m) {
    const db = load();
    const t = db.teachers.find((x) => x.id === m[1] && x.on);
    if (!t) return send(res, 404, { error: "gone" });
    return send(res, 200, { teacher: shown(db, t), days: slotsFor(db, t) });
  }

  // BOOKING. The slot has to exist in their hours and be free at the moment
  // of writing — checked against a fresh read, so two people pressing Book on
  // the same 19:00 cannot both have it.
  if (req.method === "POST" && p === "/api/book") {
    const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
    if (!allowed(ip)) return send(res, 429, { error: "slow" });
    const b = await readBody(req);
    if (!b) return send(res, 400, { error: "bad" });
    const name = String(b.name || "").trim().slice(0, 60);
    const contact = String(b.contact || "").trim().slice(0, 80);
    if (!name) return send(res, 400, { error: "name" });
    if (!contact) return send(res, 400, { error: "contact" });
    const db = load();
    const t = db.teachers.find((x) => x.id === b.teacher && x.on);
    if (!t) return send(res, 404, { error: "gone" });
    const slot = slotsFor(db, t, { days: 14 }).flatMap((d) => d.slots).find((x) => x.start === b.start);
    if (!slot) return send(res, 400, { error: "slot" });
    if (!slot.free) return send(res, 409, { error: "taken" });
    const sp = splitFor(db, t);
    const row = cleanBooking({
      money: t.fee ? { tutor: sp.tutor, lead: sp.lead, house: sp.house, price: sp.price,
        ...(sp.team ? { team: sp.team.id } : {}) } : undefined,
      id: newId(), teacher: t.id, start: slot.start, name, contact,
      note: String(b.note || "").trim().slice(0, 200), at: new Date().toISOString(), off: false,
    });
    db.bookings.push(row);
    save(db);
    console.log(`booked ${t.name} ${slot.start} for ${name}`);
    /* To Tom's WeChat, with the teacher's room link ready to forward — see
       lib/notify.mjs. The time as Beijing reads it: that is where he is. */
    const when = slot.start.slice(5, 10).replace("-", "/") + " " + slot.start.slice(11, 16);
    notify.tell(`Lesson booked · ${t.name} · ${when}`, [
      `**${name}** booked **${t.name}**, ${when} Beijing, ${t.minutes} min.`,
      `WeChat: ${contact}` + (row.note ? `  \nNote: ${row.note}` : ""),
      `Send ${t.name} this room link:  \n${PUBLIC}/room/${row.id}#${row.tKey}`,
    ].join("\n\n"));
    return send(res, 200, {
      ok: true, id: row.id, start: row.start, pay: t.pay || "",
      // The student's way into the lesson. The teacher's is printed by
      // `make book-list`, for Tom to send them.
      room: "/room/" + row.id + "#" + row.sKey,
    });
  }

  /* ---- A TEAM LEAD'S PORTAL — see lib/team.mjs ----------------------------
     /team#<key> is the page. Every call is a POST with the key in the body,
     so it never lands in a proxy's log the way a query string would. */
  if (req.method === "GET" && p === "/team") {
    try { return send(res, 200, readFileSync(path.join(HERE, "public/team.html")), "text/html; charset=utf-8"); }
    catch { return send(res, 404, { error: "missing" }); }
  }
  m = p.match(/^\/api\/team(?:\/(tutor|bank))?$/);
  if (req.method === "POST" && m) {
    const b = await readBody(req, 4096);
    const db = load();
    const team = b && db.teams.find((x) => x.key === String(b.key || ""));
    if (!team) return send(res, 403, { error: "key" });
    if (!m[1]) return send(res, 200, teamView(db, team));
    if (m[1] === "tutor") {
      const v = tutorView(db, team, String(b.id || ""));
      return v ? send(res, 200, v) : send(res, 404, { error: "gone" });
    }
    // The bank. Kept as typed; a card number with fewer than 12 digits is
    // not a card number, and saying so now beats a payout that bounces.
    // "KEEP": the card field left blank on a bank already saved — the page
    // never has the full number to send back, only the last four.
    const card = b.card === "KEEP" && team.bank ? team.bank.card.replace(/\D/g, "") : String(b.card || "").replace(/\D/g, "");
    if (card.length < 12 || card.length > 19) return send(res, 400, { error: "card" });
    if (!String(b.name || "").trim() || !String(b.bank || "").trim()) return send(res, 400, { error: "bank" });
    team.bank = { bank: String(b.bank).trim().slice(0, 60), name: String(b.name).trim().slice(0, 60),
      card: card.replace(/(\d{4})(?=\d)/g, "$1 "), branch: String(b.branch || "").trim().slice(0, 80) };
    save(db);
    return send(res, 200, teamView(db, team));
  }

  /* ---- THE LESSON ROOM — see lib/room.mjs ---------------------------------
     /room/<booking id>#<key> is the page; the key decides who you are. It
     opens from the moment of booking until an hour after the lesson ends —
     early, on purpose, so somebody can try their camera the night before. */
  m = p.match(/^\/room\/([a-f0-9]{16})$/);
  if (req.method === "GET" && m) {
    try { return send(res, 200, readFileSync(path.join(HERE, "public/room.html")), "text/html; charset=utf-8"); }
    catch { return send(res, 404, { error: "missing" }); }
  }
  m = p.match(/^\/api\/room\/([a-f0-9]{16})\/(info|join|poll|send|leave)$/);
  if (m) {
    const [, id, what] = m;
    const b = req.method === "POST" ? await readBody(req, 16384) : null;
    const key = String((b && b.key) || url.searchParams.get("key") || "");
    const db = load();
    const bk = db.bookings.find((x) => x.id === id && !x.off);
    const role = !bk ? "" : key === bk.sKey ? "s" : key === bk.tKey ? "t" : "";
    if (!role) return send(res, 403, { error: "key" });
    const t = db.teachers.find((x) => x.id === bk.teacher) || { name: "", minutes: 45 };
    const ends = Date.parse(bk.start) + (t.minutes + 60) * 60e3;
    if (Date.now() > ends) return send(res, 410, { error: "over" });
    // Who and when, for the page before anybody has joined. Counts as nothing.
    if (what === "info") {
      return send(res, 200, {
        role, me: role === "s" ? bk.name : t.name, them: role === "s" ? t.name : bk.name,
        start: bk.start, minutes: t.minutes,
      });
    }
    if (what === "join") {
      const j = room.join(id, role);
      return send(res, 200, {
        role, since: j.since, here: j.here, ice: room.iceServers(),
        me: role === "s" ? bk.name : t.name, them: role === "s" ? t.name : bk.name,
        start: bk.start, minutes: t.minutes,
      });
    }
    if (what === "send") { room.send(id, role, b && b.m); return send(res, 200, { ok: true }); }
    if (what === "leave") { room.leave(id, role); return send(res, 200, { ok: true }); }
    const since = Number(url.searchParams.get("since")) || 0;
    return send(res, 200, await room.poll(id, role, since));
  }

  send(res, 404, { error: "no" });
});

server.listen(PORT, () => console.log(`book on :${PORT}`));
