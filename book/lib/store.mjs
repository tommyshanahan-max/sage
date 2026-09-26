/* The shelf: teachers, the hours they teach, and what has been booked.
 *
 * ONE JSON FILE, READ ON EVERY REQUEST AND WRITTEN WHOLE. A few dozen teachers
 * and a few hundred bookings is kilobytes, and reading it fresh means the
 * command line (cli.mjs, run inside the same container) and the server can
 * never disagree about what is on the shelf. Written to a temporary file and
 * renamed, so a crash half-way leaves the old file, not half of a new one.
 *
 * ALL TIMES ARE BEIJING TIME. The people teaching are in China and so, mostly,
 * are the people booking. China has no daylight saving, so "+08:00" is true
 * all year and nothing here has to know about time zones. The widget shows
 * the reader's own clock beside it when theirs is different.
 */
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";

const DIR = process.env.BOOK_DIR || "/data";
const FILE = path.join(DIR, "book.json");
export const OFFSET_H = 8;
export const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function load() {
  try {
    const raw = JSON.parse(readFileSync(FILE, "utf8"));
    const db = {
      teachers: (Array.isArray(raw.teachers) ? raw.teachers : []).map(cleanTeacher).filter(Boolean),
      bookings: (Array.isArray(raw.bookings) ? raw.bookings : []).map(cleanBooking).filter(Boolean),
      teams: (Array.isArray(raw.teams) ? raw.teams : []).map(cleanTeam).filter(Boolean),
    };
    /* A booking read without room keys was just given some by cleanBooking.
       Written straight back, or the next read would mint different ones and
       the link somebody was sent would stop opening its own room. */
    if ((raw.bookings || []).some((b) => b && (!b.sKey || !b.tKey))
      || (raw.teams || []).some((t) => t && !t.key)) save(db);
    return db;
  } catch {
    return { teachers: [], bookings: [], teams: [] };
  }
}

export function save(db) {
  mkdirSync(DIR, { recursive: true });
  const tmp = FILE + "." + process.pid + ".tmp";
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, FILE);
}

export const newId = () => randomBytes(8).toString("hex");

const s = (v, n) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const URLISH = (v) => (/^https:\/\/[^\s"'<>]+$/.test(String(v || "")) ? String(v).slice(0, 400) : "");

/** A teacher row, or null. Anything missing a name or a shelf is not a teacher. */
export function cleanTeacher(r) {
  if (!r || typeof r !== "object") return null;
  const id = /^[a-f0-9]{16}$/.test(r.id) ? r.id : "";
  const shelf = s(r.shelf, 40).toLowerCase().replace(/[^a-z0-9-]/g, "");
  const name = s(r.name, 60);
  if (!id || !shelf || !name) return null;
  const hours = {};
  for (const d of DAYS) {
    const list = Array.isArray(r.hours?.[d]) ? r.hours[d].filter((t) => TIME.test(t)) : [];
    if (list.length) hours[d] = [...new Set(list)].sort();
  }
  return {
    id, shelf, name,
    zh: s(r.zh, 30),
    line: s(r.line, 90),
    tags: (Array.isArray(r.tags) ? r.tags : []).map((t) => s(t, 24)).filter(Boolean).slice(0, 6),
    price: s(r.price, 20),
    minutes: Math.min(180, Math.max(15, Number.parseInt(r.minutes, 10) || 45)),
    photo: URLISH(r.photo),
    voice: URLISH(r.voice),
    // Where a booking is paid, when it is paid ahead: a Dealio link or any
    // other https page. Empty means "pay the teacher as you arrange it".
    pay: URLISH(r.pay),
    // What the tutor is paid per lesson, in yuan. The price a student sees is
    // worked out from it — see split().
    fee: Math.max(0, Math.round(Number(r.fee) || 0)),
    hours,
    on: r.on !== false,
    // The team this tutor teaches under, if any — see cleanTeam.
    ...(/^[a-f0-9]{16}$/.test(r.lead || "") ? { lead: r.lead } : {}),
  };
}

/* A TEAM: somebody who brings tutors in and takes a share of every lesson
 * they teach. The first is Julia, at 20%.
 *
 * ONE LEVEL, ON PURPOSE. A tutor on Julia's team cannot have a team of their
 * own under hers: Tom decided one level is enough, and a share of a share of a
 * share is how a tutoring business turns into something nobody can explain.
 *
 * `key` is the whole login — the portal's link carries it in its #fragment,
 * the same way the lesson rooms do. `bank` is where her money goes, kept as
 * she typed it; only the last four digits of the card ever go back out.
 * `paid` is every payout Tom has made by hand, so what is owed is always what
 * was earned minus what was paid, never a number somebody has to remember. */
export function cleanTeam(r) {
  if (!r || typeof r !== "object") return null;
  if (!/^[a-f0-9]{16}$/.test(r.id)) return null;
  const name = s(r.name, 60);
  if (!name) return null;
  const cut = Math.min(90, Math.max(0, Number(r.cut)));
  return {
    id: r.id, name,
    cut: Number.isFinite(cut) ? cut : 20,
    key: /^[a-f0-9]{24}$/.test(r.key) ? r.key : randomBytes(12).toString("hex"),
    // Her own teacher row, when she teaches too — those lessons are hers whole.
    ...(/^[a-f0-9]{16}$/.test(r.self || "") ? { self: r.self } : {}),
    bank: r.bank && typeof r.bank === "object" ? {
      bank: s(r.bank.bank, 60), name: s(r.bank.name, 60),
      card: s(r.bank.card, 40).replace(/[^\d ]/g, ""), branch: s(r.bank.branch, 80),
    } : null,
    paid: (Array.isArray(r.paid) ? r.paid : [])
      .map((x) => ({ at: s(x && x.at, 40), amount: Math.max(0, Number(x && x.amount) || 0) }))
      .filter((x) => x.at && x.amount),
  };
}

/* THE SPLIT OF ONE LESSON — AND THE TUTOR'S FEE IS THE FIXED NUMBER.
 *
 * Tom's rule: the tutor is paid their fee (¥100 a class) and the shares go on
 * top of it, not out of it. So the lead's share is her cut OF THE FEE (20% of
 * ¥100 = ¥20), Tom's is his cut of the fee (BOOK_HOUSE_CUT, 10% → ¥10), and
 * the student pays the three added up (¥130). On the lead's own lessons there
 * is no lead share: ¥100 to her, ¥10 to Tom, ¥110 from the student.
 *
 * It was first built the other way round — shares taken out of the price —
 * and changed within the hour, which is why `fee` and `price` are separate:
 * a teacher added with only PRICE= still works, as a price with no split. */
export const HOUSE_CUT = Math.min(50, Math.max(0, Number(process.env.BOOK_HOUSE_CUT ?? 10)));
export function split(fee, leadCut, own) {
  const lead = own || !leadCut ? 0 : Math.round(fee * leadCut / 100);
  const house = Math.round(fee * HOUSE_CUT / 100);
  return { tutor: fee, lead, house, price: fee + lead + house };
}
/** The split for one teacher, knowing their team. */
export function splitFor(db, t) {
  const team = t.lead ? db.teams.find((x) => x.id === t.lead) : null;
  const own = Boolean(team && team.self === t.id);
  if (!t.fee) return { tutor: 0, lead: 0, house: 0, price: Number.parseFloat(String(t.price).replace(/[^\d.]/g, "")) || 0, team, own, legacy: true };
  return { ...split(t.fee, team ? team.cut : 0, own), team, own };
}

export function cleanBooking(r) {
  if (!r || typeof r !== "object") return null;
  if (!/^[a-f0-9]{16}$/.test(r.id) || !/^[a-f0-9]{16}$/.test(r.teacher)) return null;
  const start = s(r.start, 30);
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d\+08:00$/.test(start)) return null;
  return {
    id: r.id, teacher: r.teacher, start,
    name: s(r.name, 60), contact: s(r.contact, 80), note: s(r.note, 200),
    at: s(r.at, 40) || new Date().toISOString(),
    off: Boolean(r.off),
    /* THE TWO KEYS TO THE LESSON'S ROOM — one for the student, one for the
       teacher. The room's address is the booking id, and the key rides in the
       link's #fragment, which a browser never sends in a request or a
       referrer. Holding the key is being in the lesson; there is no other
       login. A booking made before rooms existed gets its keys on first read. */
    /* WHAT THIS LESSON EARNED, fixed when it was booked: the tutor's fee, the
       team lead's share and Tom's, and which team. A fee changed next month
       must not rewrite what last month's lessons paid. */
    ...(r.money && typeof r.money === "object" ? { money: {
      tutor: Math.max(0, Math.round(Number(r.money.tutor) || 0)),
      lead: Math.max(0, Math.round(Number(r.money.lead) || 0)),
      house: Math.max(0, Math.round(Number(r.money.house) || 0)),
      price: Math.max(0, Math.round(Number(r.money.price) || 0)),
      ...(/^[a-f0-9]{16}$/.test(r.money.team || "") ? { team: r.money.team } : {}),
    } } : {}),
    sKey: /^[a-f0-9]{24}$/.test(r.sKey) ? r.sKey : randomBytes(12).toString("hex"),
    tKey: /^[a-f0-9]{24}$/.test(r.tKey) ? r.tKey : randomBytes(12).toString("hex"),
  };
}

/** "2026-09-26T19:00+08:00" for a Beijing date and a "19:00". */
const stamp = (y, m, d, hm) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${hm}+08:00`;

/** The next `days` days of a teacher's slots, each marked free or taken.
 *  Nothing sooner than `leadH` hours from now: a lesson booked for ten
 *  minutes' time is a lesson the teacher never saw coming. */
export function slotsFor(db, t, { days = 7, leadH = 2, now = Date.now() } = {}) {
  const taken = new Set(db.bookings.filter((b) => b.teacher === t.id && !b.off).map((b) => b.start));
  const out = [];
  const bj = new Date(now + OFFSET_H * 3600e3);
  for (let i = 0; i < days; i++) {
    const day = new Date(Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate() + i));
    const y = day.getUTCFullYear(), m = day.getUTCMonth() + 1, d = day.getUTCDate();
    const dow = DAYS[day.getUTCDay()];
    const slots = [];
    for (const hm of t.hours[dow] || []) {
      const start = stamp(y, m, d, hm);
      if (Date.parse(start) < now + leadH * 3600e3) continue;
      slots.push({ start, free: !taken.has(start) });
    }
    out.push({ date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, dow, slots });
  }
  return out;
}

/** The first free slot, for the green "Today 19:00" on a teacher's card. */
export function nextFree(db, t, now = Date.now()) {
  for (const day of slotsFor(db, t, { days: 14, now })) {
    const f = day.slots.find((x) => x.free);
    if (f) return f.start;
  }
  return "";
}

/** What a stranger may see of a teacher. Everything on the row is public
 *  except whether they are switched off, which just hides them. */
export const shown = (db, t) => ({
  id: t.id, name: t.name, zh: t.zh, line: t.line, tags: t.tags,
  // With a fee, the price is the fee plus the shares on top; without, as typed.
  price: t.fee ? "¥" + splitFor(db, t).price : t.price,
  minutes: t.minutes, photo: t.photo, voice: t.voice, next: nextFree(db, t),
});
