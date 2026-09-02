// The app's totals, remembered day by day.
//
// ---------------------------------------------------------------------------
// Why this file exists at all
//
// The app reports three numbers and no history: how many browsers have ever
// opened it, and how many of those were new today and this week. That is the
// whole endpoint. A growth curve cannot be derived from it, because the past
// is simply not in the answer.
//
// It is, however, in the *sequence* of answers. Asked once an hour and written
// down, those three numbers become a series — and from tomorrow the chart is
// as real as the site's. So this keeps a diary rather than inventing one: what
// the app said, on the day it said it.
//
// Two consequences, and both are stated on the page rather than hidden here:
//
//   - History starts the day this shipped. Nothing before it can be recovered,
//     because nothing recorded it. The first point is a total, not a day's
//     arrivals — 39 people had already used the app before anyone was
//     counting the days.
//   - A day nobody sampled has no bar. The line carries the last known total
//     across it, since a total cannot fall; the bars do not, because "we did
//     not look" and "nobody came" are different facts and a bar cannot say
//     which one it means.
//
// `fresh` comes from the app's own `today` field rather than from subtracting
// yesterday's total. Differencing looks equivalent and is not: it silently
// attributes three days of arrivals to the morning the service came back up.
// ---------------------------------------------------------------------------

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { dayKey, daysBack } from "./store.js";

export function createAppHistory({ dir, tz = "Asia/Shanghai" }) {
  /** day -> { count, fresh } */
  const days = new Map();
  const file = path.join(dir, "app-history.json");
  let dirty = false;

  async function load() {
    await mkdir(dir, { recursive: true });
    try {
      const raw = JSON.parse(await readFile(file, "utf8"));
      for (const [day, v] of Object.entries(raw)) days.set(day, v);
    } catch { /* first run */ }
    return days.size;
  }

  /** One sample. Called on every successful read of the app's endpoint; the
   *  highest figure seen in a day wins, since the count only ever rises and a
   *  later sample is simply a better one. */
  function record({ count, today }) {
    const day = dayKey(Date.now(), tz);
    const prev = days.get(day);
    const next = {
      count: Math.max(count || 0, prev?.count || 0),
      fresh: Math.max(today || 0, prev?.fresh || 0),
    };
    if (prev && prev.count === next.count && prev.fresh === next.fresh) return;
    days.set(day, next);
    dirty = true;
  }

  /** The last `span` days, oldest first, with the total carried across gaps. */
  function series(span) {
    const keys = daysBack(dayKey(Date.now(), tz), span, tz);

    // The last total known before the window opens, so a chart that starts
    // mid-history starts at the right height instead of at zero.
    let carried = 0;
    for (const [day, v] of [...days].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (day < keys[0]) carried = v.count; else break;
    }

    return keys.map((day) => {
      const v = days.get(day);
      if (v) carried = v.count;
      return { day, count: carried, fresh: v ? v.fresh : 0, sampled: !!v };
    });
  }

  async function flush() {
    if (!dirty) return;
    const tmp = file + ".tmp";
    await writeFile(tmp, JSON.stringify(Object.fromEntries(days)));
    await rename(tmp, file);
    dirty = false;
  }

  return { load, record, series, flush, get size() { return days.size; } };
}
