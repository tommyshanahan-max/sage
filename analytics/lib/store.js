// Counting, and where the counts live.
//
// The whole of the storage decision is in this file, the same way the history
// panel's is in agent/lib/conversations.js: a handful of operations, no
// database, and a swap here changes nothing else.
//
// ---------------------------------------------------------------------------
// What is written, and what deliberately is not
//
// Study Pal's docs/PRIVACY.md settles this, and it is a settled decision
// rather than a preference:
//
//   "The count stores hashes and day totals, never per-person timestamps. The
//    id is random and made up by the browser, so it identifies a browser
//    rather than a human, and it is SHA-256'd before it touches disk. A
//    per-person timestamp would answer the same question and would also,
//    joined to anything else, begin to describe somebody's evening."
//
// So there is no event log here. Two things are written per day:
//
//   2026-09-02.day.json   that day's totals, and the hashed ids seen in it
//   devices.json          hashed id -> [first day seen, last day seen]
//
// The finest grain anywhere on disk is a day. Nothing records that a given
// browser was here at 23:41, because nothing needs to, and because a file that
// did would describe somebody's evening the moment it met any other file.
//
// The id is hashed even though the browser invented it and it means nothing on
// its own: it means the value in somebody's localStorage cannot be used to
// find their rows in these files. Unsalted is sufficient — the id carries far
// too much entropy to enumerate, so a salt would buy nothing here.
//
// The cost of all this is real and worth naming: without an event log, a
// question nobody thought to ask in advance cannot be answered later. That is
// the trade the rule above already made on purpose.
// ---------------------------------------------------------------------------

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/** The day a timestamp falls in, in the deployment's timezone.
 *
 *  Not UTC. "How many today" is a question about the owner's day, and a UTC
 *  boundary in Asia cuts the evening in half — the busiest part of it. */
export function dayKey(ts, tz) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(ts));
}

/** Days back from a day key, oldest first. */
export function daysBack(from, n, tz) {
  const out = [];
  const base = new Date(from + "T12:00:00Z").getTime();
  for (let i = n - 1; i >= 0; i--) out.push(dayKey(base - i * 86400_000, tz));
  return out;
}

/** 128 bits of SHA-256, hex. Still SHA-256; half of it is far more than enough
 *  to keep these distinct, and the file is half the size. */
export const hashId = (id) =>
  createHash("sha256").update(String(id)).digest("hex").slice(0, 32);

const emptyDay = () => ({
  ids: new Set(),     // hashed, day-granularity, dropped when the day ages out
  n: 0,               // how many that was, kept forever
  fresh: 0,           // of those, how many had never been seen before
  events: 0,
  pages: new Map(),
  uses: new Map(),
});

const bump = (map, key, by = 1) => map.set(key, (map.get(key) || 0) + by);

export function createStore({ dir, tz = "Asia/Shanghai", retainDays = 400 }) {
  /** day key -> that day's totals */
  const days = new Map();
  /** hashed id -> [first day, last day] */
  const devices = new Map();
  let dirtyDays = new Set();
  let dirtyDevices = false;

  const dayFile = (day) => path.join(dir, day + ".day.json");
  const devicesFile = path.join(dir, "devices.json");

  const dayOf = (key) => {
    let d = days.get(key);
    if (!d) days.set(key, (d = emptyDay()));
    return d;
  };

  async function writeAtomic(file, value) {
    // Written beside and renamed. These files are read at boot, and a half
    // written one silently loses a day.
    const tmp = file + ".tmp";
    await writeFile(tmp, JSON.stringify(value));
    await rename(tmp, file);
  }

  async function load() {
    await mkdir(dir, { recursive: true });

    try {
      const raw = JSON.parse(await readFile(devicesFile, "utf8"));
      for (const [id, seen] of Object.entries(raw)) devices.set(id, seen);
    } catch { /* first run */ }

    for (const name of await readdir(dir)) {
      const m = name.match(/^(\d{4}-\d{2}-\d{2})\.day\.json$/);
      if (!m) continue;
      try {
        const saved = JSON.parse(await readFile(path.join(dir, name), "utf8"));
        days.set(m[1], {
          ids: new Set(saved.ids || []),
          n: saved.n || (saved.ids ? saved.ids.length : 0),
          fresh: saved.fresh || 0,
          events: saved.events || 0,
          pages: new Map(Object.entries(saved.pages || {})),
          uses: new Map(Object.entries(saved.uses || {})),
        });
      } catch { /* unreadable day: leave it out rather than guess at it */ }
    }

    // "How many were new" is a fact about every day at once, so it is derived
    // from the device index rather than trusted from each day's own file. The
    // two can otherwise drift — a pruned index against a kept day file — and
    // the number that drifts is the one somebody is looking at. Days whose ids
    // have aged out keep the count they were written with, which is all that
    // is left to know about them.
    for (const [day, d] of days) {
      if (!d.ids.size) continue;
      d.fresh = [...d.ids].filter((id) => devices.get(id)?.[0] === day).length;
    }

    return { days: days.size, devices: devices.size };
  }

  /** Records one event. `device` is the browser's own id and is hashed here —
   *  it is not stored, passed on, or logged in the form it arrived in. */
  function record({ device, kind, name, site, at = Date.now() }) {
    const id = hashId(device);
    const day = dayKey(at, tz);
    const d = dayOf(day);

    const seen = devices.get(id);
    if (!seen) {
      devices.set(id, [day, day]);
      d.fresh++;
      dirtyDevices = true;
    } else if (seen[1] !== day) {
      seen[1] = day;
      dirtyDevices = true;
    }

    if (!d.ids.has(id)) {
      d.ids.add(id);
      d.n = d.ids.size;
    }
    d.events++;
    if (kind === "page") bump(d.pages, name);
    else bump(d.uses, name);
    // `site` decided whether this was counted at all; it is not kept. One
    // dimension nobody asked for is one more thing to justify later.
    dirtyDays.add(day);
    return day;
  }

  /** The dashboard's whole data set: per-day uniques, and totals over a range. */
  function report(span) {
    const today = dayKey(Date.now(), tz);
    const keys = daysBack(today, span, tz);

    const pages = new Map();
    const uses = new Map();
    let events = 0;
    const series = keys.map((key) => {
      const d = days.get(key);
      if (!d) return { day: key, devices: 0, fresh: 0, events: 0 };
      for (const [k, v] of d.pages) bump(pages, k, v);
      for (const [k, v] of d.uses) bump(uses, k, v);
      events += d.events;
      return { day: key, devices: d.n, fresh: d.fresh, events: d.events };
    });

    const top = (m) =>
      [...m].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, count]) => ({ name, count }));

    const t = days.get(today);
    return {
      today: {
        day: today,
        devices: t ? t.n : 0,
        fresh: t ? t.fresh : 0,
        events: t ? t.events : 0,
      },
      span,
      series,
      events,
      pages: top(pages),
      uses: top(uses),
      knownDevices: devices.size,
    };
  }

  /** Writes what has changed. Cheap enough to call on a timer, and the only
   *  thing that touches disk — an event on its own writes nothing, which is
   *  the difference between counting people and logging them. */
  async function flush() {
    for (const day of dirtyDays) {
      const d = days.get(day);
      if (!d) continue;
      await writeAtomic(dayFile(day), {
        ids: [...d.ids],
        n: d.n,
        fresh: d.fresh,
        events: d.events,
        pages: Object.fromEntries(d.pages),
        uses: Object.fromEntries(d.uses),
      });
    }
    dirtyDays = new Set();

    if (dirtyDevices) {
      await writeAtomic(devicesFile, Object.fromEntries(devices));
      dirtyDevices = false;
    }
  }

  /** Ages out the identifiers and keeps the counts.
   *
   *  Past the retention window a day keeps how many came and what they used,
   *  and loses which browsers they were. The history of a product's growth is
   *  worth keeping forever; a list of who was there in March is not. */
  async function prune() {
    const cutoff = daysBack(dayKey(Date.now(), tz), retainDays, tz)[0];
    let dropped = 0;

    for (const [day, d] of days) {
      if (day < cutoff && d.ids.size) {
        d.ids = new Set();
        dirtyDays.add(day);
        dropped++;
      }
    }
    for (const [id, seen] of devices) {
      if (seen[1] < cutoff) { devices.delete(id); dirtyDevices = true; }
    }
    if (dropped) await flush();
    return dropped;
  }

  return { load, record, report, flush, prune };
}
