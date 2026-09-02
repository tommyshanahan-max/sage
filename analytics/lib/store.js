// Counting, and where the counts live.
//
// The whole of the storage decision is in this file, the same way the history
// panel's is in agent/lib/conversations.js: four operations, no database, and
// a swap here changes nothing else.
//
// Three things are written per day:
//
//   2026-09-02.jsonl        every event, appended, the durable record
//   2026-09-02.summary.json the day's totals, so a restart does not re-read it
//   devices.json            id -> [first day seen, last day seen]
//
// The raw log is the record and the summaries are the index. On boot only
// today's log is replayed; earlier days come back from their summaries, which
// is what keeps start-up flat as the log grows.
//
// `devices.json` is the only thing that spans days, and it exists for one
// question: is this device new? That cannot be answered from a day in
// isolation, and answering it from the retained logs would call a visitor who
// came back after the retention window "new", which is the failure worth
// avoiding.

import { appendFile, mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
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

const emptyDay = () => ({
  devices: new Set(),
  fresh: 0,          // devices whose first-ever day is this one
  events: 0,
  pages: new Map(),
  uses: new Map(),
});

const bump = (map, key, by = 1) => map.set(key, (map.get(key) || 0) + by);

// A summary holds counts, not the device set — a set is the same size as the
// data it summarises. The consequence is deliberate and shows up in the
// dashboard: unique visitors are reported per day and never summed across a
// range, because the same person on two days is one person and no stored count
// can tell you that.
const toSummary = (d) => ({
  devices: d.devices.size,
  fresh: d.fresh,
  events: d.events,
  pages: Object.fromEntries(d.pages),
  uses: Object.fromEntries(d.uses),
});

const fromSummary = (s) => ({
  devices: { size: s.devices || 0 },   // count only; the set is gone
  fresh: s.fresh || 0,
  events: s.events || 0,
  pages: new Map(Object.entries(s.pages || {})),
  uses: new Map(Object.entries(s.uses || {})),
});

export function createStore({ dir, tz = "Asia/Shanghai", retainDays = 400 }) {
  /** day key -> day totals */
  const days = new Map();
  /** device id -> [first day, last day] */
  const devices = new Map();
  let dirtyDays = new Set();
  let dirtyDevices = false;

  const file = (day) => path.join(dir, day + ".jsonl");
  const summaryFile = (day) => path.join(dir, day + ".summary.json");

  const dayOf = (key) => {
    let d = days.get(key);
    if (!d) days.set(key, (d = emptyDay()));
    return d;
  };

  async function load() {
    await mkdir(dir, { recursive: true });

    try {
      const raw = JSON.parse(await readFile(path.join(dir, "devices.json"), "utf8"));
      for (const [id, seen] of Object.entries(raw)) devices.set(id, seen);
    } catch { /* first run */ }

    const today = dayKey(Date.now(), tz);
    for (const name of await readdir(dir)) {
      const m = name.match(/^(\d{4}-\d{2}-\d{2})\.summary\.json$/);
      if (!m || m[1] === today) continue;
      try {
        days.set(m[1], fromSummary(JSON.parse(await readFile(path.join(dir, name), "utf8"))));
      } catch { /* unreadable summary: the raw log still has it */ }
    }

    // Today is replayed from the raw log so a restart mid-day does not lose the
    // device set, which is the one thing a summary cannot carry.
    try {
      const text = await readFile(file(today), "utf8");
      const d = dayOf(today);
      for (const line of text.split("\n")) {
        if (!line) continue;
        try {
          const e = JSON.parse(line);
          d.devices.add(e.d);
          d.events++;
          if (e.k === "page") bump(d.pages, e.n);
          else if (e.k === "use") bump(d.uses, e.n);
        } catch { /* a torn last line after a hard kill */ }
      }
      // Counted once at the end, from the device index rather than the log:
      // "new" is a fact about every day, and today's log cannot see the others.
      d.fresh = [...d.devices].filter((id) => devices.get(id)?.[0] === today).length;
    } catch { /* nothing today yet */ }

    return { days: days.size, devices: devices.size };
  }

  /** Records one event. Returns the day it landed in. */
  async function record({ device, kind, name, site, at = Date.now() }) {
    const day = dayKey(at, tz);
    const d = dayOf(day);

    const seen = devices.get(device);
    if (!seen) {
      devices.set(device, [day, day]);
      d.fresh++;
      dirtyDevices = true;
    } else if (seen[1] !== day) {
      seen[1] = day;
      dirtyDevices = true;
    }

    d.devices.add(device);
    d.events++;
    if (kind === "page") bump(d.pages, name);
    else bump(d.uses, name);
    dirtyDays.add(day);

    await appendFile(file(day),
      JSON.stringify({ t: at, d: device, s: site, k: kind, n: name }) + "\n");
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
      return { day: key, devices: d.devices.size, fresh: d.fresh, events: d.events };
    });

    const top = (m) =>
      [...m].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, count]) => ({ name, count }));

    const t = days.get(today);
    return {
      today: {
        day: today,
        devices: t ? t.devices.size : 0,
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

  /** Writes what has changed. Cheap enough to call on a timer. */
  async function flush() {
    for (const day of dirtyDays) {
      const d = days.get(day);
      if (!d || !(d.devices instanceof Set)) continue;
      // Written beside and renamed: a summary is read at boot, and a half
      // written one would silently lose a day.
      const tmp = summaryFile(day) + ".tmp";
      await writeFile(tmp, JSON.stringify(toSummary(d)));
      await rename(tmp, summaryFile(day));
    }
    dirtyDays = new Set();

    if (dirtyDevices) {
      const tmp = path.join(dir, "devices.json.tmp");
      await writeFile(tmp, JSON.stringify(Object.fromEntries(devices)));
      await rename(tmp, path.join(dir, "devices.json"));
      dirtyDevices = false;
    }
  }

  /** Drops raw logs past the retention window, and devices last seen before it.
   *
   *  Summaries are kept: they are a few hundred bytes a day, and throwing away
   *  the history of how many people came is not a storage decision anyone would
   *  make on purpose. */
  async function prune() {
    const cutoff = daysBack(dayKey(Date.now(), tz), retainDays, tz)[0];
    for (const name of await readdir(dir)) {
      const m = name.match(/^(\d{4}-\d{2}-\d{2})\.jsonl$/);
      if (m && m[1] < cutoff) await unlink(path.join(dir, name)).catch(() => {});
    }
    let dropped = 0;
    for (const [id, seen] of devices) {
      if (seen[1] < cutoff) { devices.delete(id); dropped++; }
    }
    if (dropped) dirtyDevices = true;
    return dropped;
  }

  return { load, record, report, flush, prune };
}
