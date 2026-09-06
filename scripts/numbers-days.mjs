/* What happened on which day, printed rather than drawn.
 *
 * The dashboard draws a growth curve, which answers "is it going up" and not
 * "what happened on Tuesday". This is for the second question — the one you
 * ask when a week's figures are almost all from one afternoon and you want to
 * know which afternoon, and what those people looked at.
 *
 * Runs inside the analytics container, which is where the token already is:
 *   make numbers-days
 *   make numbers-days DAYS=30
 * -------------------------------------------------------------------------- */

/* Reached by service name over the compose network, not on localhost: this
 * runs in a container of its own, and localhost there is a server that was
 * never started. The token comes from the environment the image already
 * carries, so it is never typed or pasted anywhere. */
const BASE = (process.env.STATS_BASE || "http://analytics:3000").replace(/\/+$/, "");
const TOKEN = process.env.ANALYTICS_INTERNAL_TOKEN || "";
const DAYS = Math.min(Math.max(Number(process.argv[2]) || 14, 1), 90);

const pad = (s, n) => String(s ?? "").padEnd(n);
const num = (s, n) => String(s ?? "").padStart(n);

const r = await fetch(`${BASE}/api/stats?days=${DAYS}`,
  { headers: TOKEN ? { authorization: "Bearer " + TOKEN } : {} });
if (!r.ok) {
  console.error(`the counter said ${r.status}` +
    (r.status === 401 ? " — ANALYTICS_INTERNAL_TOKEN is not set in this container" : ""));
  process.exit(1);
}
const d = await r.json();

console.log(`\nSites counted together: ${(d.sites || []).join(", ") || "(none)"}`);
console.log(`Timezone: ${d.tz}`);

// The figure worth reading first, because it is the only one that can fall.
const known = d.knownDevices || 0;
console.log(`\nREGULARS: ${d.regular ?? "—"} of ${known} browsers ever counted`);
console.log(`  on at least two different days, and here since ${d.regularFrom || "—"}`);
console.log(`  (${d.returned ?? "—"} have ever come back at all, whenever that was)`);
console.log("  It cannot say twice from twenty times — only a first and a last");
console.log("  day are kept per browser, so those are the same record.\n");

// ---- the site, day by day -------------------------------------------------
console.log("SITE VISITS — every site above pooled, they are not stored apart");
console.log(pad("day", 12) + num("people", 8) + num("new", 6) + num("events", 8)
  + "  " + "where they came from / what they opened");
for (const day of d.series || []) {
  const from = (day.sources || []).slice(0, 2).map((s) => `${s.name}:${s.count}`).join(" ");
  const via = (day.vias || []).slice(0, 2).map((s) => `${s.name}:${s.count}`).join(" ");
  console.log(pad(day.day, 12) + num(day.devices, 8) + num(day.fresh, 6) + num(day.events, 8)
    + "  " + [from, via].filter(Boolean).join(" | "));
}

// ---- what was used on the sites, day by day -------------------------------
{
  const names = (d.uses || []).map((u) => u.name).slice(0, 6);
  console.log("\nWHAT WAS USED ON THE SITES, BY DAY");
  if (!names.length) {
    console.log("  nothing — no `use` events have been recorded on these sites.");
  } else {
    console.log(pad("day", 12) + names.map((n) => num(n.slice(0, 11), 13)).join(""));
    for (const day of d.series || []) {
      const by = Object.fromEntries((day.uses || []).map((u) => [u.name, u.count]));
      // A day with nothing at all is a row of dashes rather than a gap: the
      // absence is the finding as often as the number is.
      console.log(pad(day.day, 12) + names.map((n) => num(by[n] || "—", 13)).join(""));
    }
  }
}

// ---- the app, day by day --------------------------------------------------
const app = d.app;
console.log(`\nSTUDY PAL — its own counter at ${app?.url ? new URL(app.url).hostname : "(not set)"}`);
if (!app) {
  console.log("  nothing: ANALYTICS_APP_COUNT_URL is not set");
} else {
  console.log(`  ${app.count} people ever · ${app.today} new today · ${app.activeToday} used it today`);
  const first = app.people?.firstFrom;
  if (first) console.log(`  arrivals recorded since ${first}`);

  // The arrivals diary — which day the people actually turned up on. This is
  // the one that answers "was that week one afternoon".
  const arrivals = app.people?.byDay || app.arrivals || null;
  if (Array.isArray(arrivals) && arrivals.length) {
    console.log("\n  ARRIVALS BY DAY");
    for (const a of arrivals.slice(-DAYS)) {
      console.log("  " + pad(a.day, 12) + num(a.count, 6));
    }
  }

  // Features, day by day. Already drawn on the numbers page when the app
  // sends it; printed here so its absence is visible rather than an empty
  // panel that could mean three different things.
  const byDay = app.usesByDay;
  console.log("\n  WHAT WAS USED, BY DAY");
  if (!Array.isArray(byDay) || !byDay.length) {
    console.log("  nothing — Study Pal's /api/usage is not sending a `byDay` block.");
    console.log("  The totals below are all it sends, so the daily table on the");
    console.log("  numbers page has nothing to draw and stays hidden.");
    const totals = app.uses || [];
    if (totals.length) {
      console.log("\n  TOTALS ONLY");
      for (const u of totals) console.log("  " + pad(u.name, 24) + num(u.count, 8));
    }
  } else {
    const names = (app.uses || []).map((u) => u.name).slice(0, 6);
    console.log("  " + pad("day", 12) + names.map((n) => num(n.slice(0, 10), 12)).join(""));
    for (const day of byDay) {
      const by = Object.fromEntries((day.uses || []).map((u) => [u.name, u.count]));
      console.log("  " + pad(day.day, 12) + names.map((n) => num(by[n] || "—", 12)).join(""));
    }
  }
}
console.log("");
