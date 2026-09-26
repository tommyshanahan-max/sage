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
    return {
      teachers: (Array.isArray(raw.teachers) ? raw.teachers : []).map(cleanTeacher).filter(Boolean),
      bookings: (Array.isArray(raw.bookings) ? raw.bookings : []).map(cleanBooking).filter(Boolean),
    };
  } catch {
    return { teachers: [], bookings: [] };
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
    hours,
    on: r.on !== false,
  };
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
  id: t.id, name: t.name, zh: t.zh, line: t.line, tags: t.tags, price: t.price,
  minutes: t.minutes, photo: t.photo, voice: t.voice, next: nextFree(db, t),
});
