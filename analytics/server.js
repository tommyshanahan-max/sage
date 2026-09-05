// How many people used it today, how many of them were new, and what they used.
//
// Deliberately small, and deliberately its own service rather than a route on
// the agent: the agent is behind a password and runs a partner's seat, and a
// public collection endpoint has no business sharing a process with either.
//
// What it is not: a general analytics product. There is no cross-site
// identifier, no IP address stored, no user agent stored, and no third party
// involved. One first-party random id per browser, kept in that browser's own
// localStorage, is the whole of the identity model — which is why "users" here
// means devices, and always will.
//
// That id is hashed before it reaches disk and nothing is stored at a finer
// grain than a day, per Study Pal's docs/PRIVACY.md. See lib/store.js, which
// is where those two decisions actually live.

import express from "express";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createStore } from "./lib/store.js";
import { createAppHistory } from "./lib/apphistory.js";

const PORT = process.env.PORT || 3000;
const DIR = process.env.ANALYTICS_DIR || "/data";
const TZ = process.env.ANALYTICS_TZ || "Asia/Shanghai";
const RETAIN = Number(process.env.ANALYTICS_RETAIN_DAYS || 400);
const USER = process.env.ANALYTICS_USER || "";
const PASSWORD = process.env.ANALYTICS_PASSWORD || "";
// No password set means the dashboard is open to anyone who finds the hostname,
// and every hostname is published the moment its certificate issues. That is a
// deliberate choice, not an accident, so it is honoured rather than refused —
// but the page says so on its face, and setting a password closes it again with
// no other change.
const OPEN = !PASSWORD;

// The sites allowed to report. This is the whole of "whose numbers are these":
// an origin not on the list is not recorded, so a page someone else puts your
// snippet on cannot add itself to your dashboard.
// A second way in, for one caller: the agent, showing today's numbers in its
// own masthead. It cannot use the cookie — that is host-only to the stats
// hostname — so it presents a shared token over the Docker network instead.
// The token never reaches a browser, and without it configured this does
// nothing at all.
const INTERNAL_TOKEN = process.env.ANALYTICS_INTERNAL_TOKEN || "";

const SITES = (process.env.ANALYTICS_SITES || "")
  .split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);

const store = createStore({ dir: DIR, tz: TZ, retainDays: RETAIN });
const appHistory = createAppHistory({ dir: DIR, tz: TZ });

// ---------------------------------------------------------------------------
// Sessions — the same shape as the agent's, for the same reasons. iOS drops
// basic credentials the moment it reclaims a tab, and there is no cookie in
// basic auth for the browser to remember.
// ---------------------------------------------------------------------------
const SESSION_DAYS = 30;
const COOKIE = "lx_stats";
const KEY = createHash("sha256")
  .update(USER ? `lx-stats:${USER}:${PASSWORD}` : "lx-stats:" + PASSWORD)
  .digest();

function safeEqual(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
const sign = (p) => createHmac("sha256", KEY).update(p).digest("base64url");
const issue = () => {
  const p = String(Date.now() + SESSION_DAYS * 86400_000);
  return p + "." + sign(p);
};
function valid(token) {
  if (typeof token !== "string") return false;
  const cut = token.lastIndexOf(".");
  if (cut < 1) return false;
  const payload = token.slice(0, cut);
  if (!safeEqual(token.slice(cut + 1), sign(payload))) return false;
  const expires = Number(payload);
  return Number.isFinite(expires) && expires > Date.now();
}
function cookie(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq > -1 && part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

const app = express();
app.disable("x-powered-by");
// Caddy is the only thing in front of this, so the forwarded address is its
// word and can be trusted for the rate limiter below.
app.set("trust proxy", true);

app.get("/healthz", (_req, res) => res.json({ ok: true }));

// ---------------------------------------------------------------------------
// Collection — the only public part
// ---------------------------------------------------------------------------

/** The reporting site, taken from the request rather than the body. A page can
 *  claim anything in a POST; it cannot forge the Origin the browser sends. */
function siteOf(req) {
  const raw = req.get("origin") || req.get("referer") || "";
  let host = "";
  try { host = new URL(raw).hostname.toLowerCase(); } catch { return null; }
  // A configured site covers its subdomains, so www and the apex are one site.
  const match = SITES.find((s) => host === s || host.endsWith("." + s));
  return match || null;
}

// The snippet may be embedded on another of the configured sites, so the
// endpoint answers cross-origin — but only to a site on the list, echoed back
// one at a time rather than with a wildcard.
function cors(req, res) {
  const origin = req.get("origin");
  if (origin) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Headers", "content-type");
    res.set("Access-Control-Max-Age", "86400");
  }
}

// A crude, in-memory ceiling. Not a defence against a determined flood — Caddy
// and the host are the place for that — but enough that one bored visitor with
// a loop cannot invent a thousand page views.
const RATE_MAX = 120;          // events per address per minute
const rate = new Map();
setInterval(() => rate.clear(), 60_000).unref();
function overRate(ip) {
  const n = (rate.get(ip) || 0) + 1;
  rate.set(ip, n);
  return n > RATE_MAX;
}

// Crawlers do not run scripts, so most never reach here at all. The ones that
// do announce themselves, and a name in the user agent is enough — it is only
// used to decide whether to count, and is never stored.
const BOT = /bot|crawl|spider|slurp|headless|preview|monitor|curl|wget|python-requests/i;


/** The host of a referring URL, or "direct" when there was none.
 *
 *  The host and nothing else. A referring address can carry a query string
 *  holding somebody's search terms or a session token, and none of that is
 *  needed to tell WeChat from Google. Anything unparseable is treated as no
 *  referrer rather than guessed at. */
function hostOf(raw) {
  const value = String(raw || "").slice(0, 300);
  if (!value) return "direct";
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    return /^[a-z0-9.\-]{1,60}$/.test(host) ? host : "direct";
  } catch {
    return "direct";
  }
}

// Control characters stripped before anything is written: these names end up in
// a log file and on a dashboard, and a stray newline in one would put a second
// forged record on the next line of a JSONL file.
const clean = (s, max) =>
  String(s ?? "").replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, max);

app.options("/e", (req, res) => {
  if (siteOf(req)) cors(req, res);
  res.status(204).end();
});

app.post("/e", express.json({ limit: "2kb" }), (req, res) => {
  const site = siteOf(req);
  if (!site) return res.status(204).end();       // not a site we count
  cors(req, res);

  if (BOT.test(req.get("user-agent") || "")) return res.status(204).end();
  if (overRate(req.ip)) return res.status(204).end();

  const device = clean(req.body?.d, 40);
  const kind = ["use", "dwell"].includes(req.body?.k) ? req.body.k : "page";
  const name = clean(req.body?.n, 120);

  // Where they are, and how they got here. Both are volunteered by the page,
  // both are coarse, and both are recorded once per device per day rather than
  // per event — see lib/store.js for why each is shaped the way it is.
  //
  // Validated to a shape rather than trusted: these strings are rendered on a
  // dashboard, and "it came from our own snippet" is not a guarantee about
  // what arrives at a public endpoint.
  const place = /^[A-Za-z][A-Za-z0-9_+\-]*(\/[A-Za-z0-9_+\-]+){0,2}$/.test(req.body?.z || "")
    ? String(req.body.z).slice(0, 40)
    : "";
  const source = hostOf(req.body?.r);
  // A share code from the link. Deliberately narrow: it is displayed on a
  // dashboard and typed by hand into links, so letters, digits, dash and
  // underscore only, and short enough to read in a list.
  const via = /^[A-Za-z0-9_-]{1,24}$/.test(req.body?.v || "")
    ? String(req.body.v).toLowerCase()
    : "";
  // A device id shaped like anything else is a client that is not ours.
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(device) || !name) return res.status(204).end();

  try {
    // Counts in memory; the timer below is the only thing that writes. The id
    // is hashed inside the store and is never written in the form it arrived.
    store.record({ device, kind, name, site, place, source, via });
  } catch (err) {
    console.error("record failed:", err.message);
  }
  // Always 204, whatever happened. A page has nothing useful to do with the
  // answer, and a status code that varies is a way to probe what is configured.
  res.status(204).end();
});

const SNIPPET = `/* first-party, one random id in this browser's own storage */
(function () {
  var here = document.currentScript && document.currentScript.src;
  var base = here ? here.replace(/\\/lx\\.js.*$/, "") : "/a";
  var id;
  try {
    id = localStorage.getItem("lx_id");
    if (!id) {
      id = Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
      localStorage.setItem("lx_id", id);
    }
  } catch (e) { return; }   /* storage refused: count nobody rather than guess */

  function send(k, n, z, r, v) {
    try {
      var body = { d: id, k: k, n: String(n).slice(0, 120) };
      if (z) body.z = z;
      if (r) body.r = String(r).slice(0, 300);
      if (v) body.v = String(v).slice(0, 24);
      fetch(base + "/e", {
        method: "POST", keepalive: true, mode: "cors", credentials: "omit",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).catch(function () {});
    } catch (e) {}
  }

  /* Call lx("translate") from anywhere to count a function being used. */
  window.lx = function (name) { send("use", name); };

  /* Where the clock says this browser is, and who linked here. Sent with the
     first event only, since the server counts them once per device per day.

     The timezone rather than the network address: nothing here reads an IP, so
     "no address kept" stays literally true and no database of anybody's
     addresses needs to exist to draw the map. It is also the better answer —
     a student in Manchester behind a Chinese VPN has a London clock, and
     London is the true fact.

     The referrer is passed whole and reduced to a bare host by the server. */
  var place = "";
  try { place = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
  /* Who sent them, from the link they followed: ?via=mia. This is the one
     signal that survives WeChat, which strips referrers — so it is the only
     way to tell one person's share from another's. */
  var via = "";
  try {
    var q = new URLSearchParams(location.search);
    via = q.get("via") || q.get("s") || "";
  } catch (e) {}
  send("page", location.pathname, place, document.referrer, via);

  /* How long this visit lasted, sent once at the end as a single number of
     seconds. Only time the page was actually visible counts — a tab left open
     in the background is not a visit — and nothing about when it happened is
     sent, because the server keeps a running total and a count and never a
     record of one person's evening. */
  var since = Date.now(), visible = 0, done = false;
  function stop() {
    if (document.visibilityState === "hidden" && since) {
      visible += Date.now() - since; since = 0;
    } else if (document.visibilityState === "visible" && !since) {
      since = Date.now();
    }
  }
  document.addEventListener("visibilitychange", stop);
  function finish() {
    if (done) return; done = true;
    if (since) visible += Date.now() - since;
    var seconds = Math.round(visible / 1000);
    if (seconds > 0 && seconds <= 1800) send("dwell", String(seconds));
  }
  addEventListener("pagehide", finish);
})();
`;

// The snippet itself, so a site adds analytics with one script tag and no build
// step. Cached hard: it changes about never.
app.get("/lx.js", (_req, res) => {
  res.type("application/javascript");
  res.set("Cache-Control", "public, max-age=86400");
  res.send(SNIPPET);
});

// ---------------------------------------------------------------------------
// Everything below needs the password
// ---------------------------------------------------------------------------

app.use(express.urlencoded({ extended: false, limit: "16kb" }));


function loginPage(failed) {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Numbers</title>
<style>
  :root{--paper:#f2f0ea;--card:#fbfaf7;--ink:#1a1c1a;--muted:#828b87;
    --rule:#e0ddd3;--jade:#1f6b52;--down:#a8442f;
    --serif:ui-serif,"New York",Georgia,serif;
    --sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  @media(prefers-color-scheme:dark){:root:not([data-theme="light"]){
    --paper:#12140f;--card:#1a1d18;--ink:#eceee6;--muted:#7c857c;
    --rule:#2a2f27;--jade:#5cc39c;--down:#e08a72}}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;padding:1.5rem;
    background:var(--paper);color:var(--ink);font-family:var(--sans);font-size:16px}
  form{width:100%;max-width:20rem;background:var(--card);border:1px solid var(--rule);
    border-radius:12px;padding:1.6rem 1.5rem;display:flex;flex-direction:column;gap:.9rem}
  h1{margin:0;font-family:var(--serif);font-weight:400;font-size:1.8rem;line-height:1}
  p{margin:0;font-size:.85rem;color:var(--muted)}
  p.bad{color:var(--down)}
  input{font:inherit;color:var(--ink);background:var(--paper);
    border:1px solid var(--rule);border-radius:9px;padding:.65rem .8rem;width:100%}
  input:focus{outline:2px solid var(--jade);outline-offset:-1px;border-color:transparent}
  button{font:inherit;font-weight:600;font-size:.9rem;cursor:pointer;color:#fff;
    background:var(--jade);border:0;border-radius:9px;padding:.7rem 1rem}
</style></head><body>
<form method="post" action="/login">
  <h1>Numbers</h1>
  ${failed ? `<p class="bad">That did not match.</p>`
           : "<p>Signed in for 30 days on this device.</p>"}
  ${USER ? `<input type="text" name="username" autocomplete="username"
         placeholder="Username" autofocus required>` : ""}
  <input type="password" name="password" autocomplete="current-password"
         placeholder="Password"${USER ? "" : " autofocus"} required>
  <button type="submit">Sign in</button>
</form></body></html>`;
}

app.get("/login", (req, res) => {
  if (OPEN || valid(cookie(req, COOKIE))) return res.redirect("/");
  res.type("html").send(loginPage(false));
});

app.post("/login", async (req, res) => {
  // With no password configured there is nothing to check and nothing a cookie
  // would prove, so no session is issued rather than one signed with an empty
  // secret — a key derived from "" is a key everybody has.
  if (OPEN) return res.redirect("/");
  const userOk = !USER || safeEqual(String(req.body?.username ?? "").trim(), USER);
  const passOk = safeEqual(String(req.body?.password ?? ""), PASSWORD);
  if (userOk && passOk) {
    res.cookie(COOKIE, issue(), {
      httpOnly: true, secure: true, sameSite: "lax",
      path: "/", maxAge: SESSION_DAYS * 86400_000,
    });
    return res.redirect("/");
  }
  // A short pause on failure. Not a rate limiter, but it turns an unlimited
  // guessing rate into a bounded one at no cost to a correct sign-in.
  await new Promise((r) => setTimeout(r, 600));
  res.status(401).type("html").send(loginPage(true));
});

app.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE, { path: "/" });
  res.redirect("/login");
});

/** The shared token, compared in constant time like every other secret here. */
function internalOk(req) {
  if (!INTERNAL_TOKEN) return false;
  const header = String(req.get("authorization") || "");
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  return given.length > 0 && safeEqual(given, INTERNAL_TOKEN);
}

app.use((req, res, next) => {
  if (OPEN || valid(cookie(req, COOKIE)) || internalOk(req)) return next();
  if (req.path.startsWith("/api/")) return res.status(401).json({ error: "session expired" });
  res.redirect("/login");
});

// ---------------------------------------------------------------------------
// The app's own count
//
// Two products are being counted here and they are not the same product. This
// service counts the brand page, which is a poster: somebody read it. The app
// counts the app, which is the thing people actually use, and it keeps its own
// count on its own box because a page in mainland China cannot reliably reach
// a third-party host — that constraint is why there are two counters rather
// than one, and it is not going away.
//
// So this reads the app's public endpoint rather than trying to merge the two
// stores. The numbers stay separate and stay labelled. Added together they
// would be a figure that describes neither.
//
// Cached, because the dashboard is refreshed by a person clicking, and a page
// that fans out to another service on every click is a page that takes that
// service down on the day it matters. Failure is soft: no app figure is a
// dashboard with one section missing, not a dashboard that will not load.
// ---------------------------------------------------------------------------
/** {name: count} from another service, ranked, cleaned and capped.
 *
 *  Another service's JSON, rendered on this page: taken as a shape rather than
 *  trusted as one. Anything that is not a plain object of name to number comes
 *  back empty, which the panel then reports as "not measured" — the honest
 *  reading, and the same one as a field that was never sent. */
function counts(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out = Object.entries(raw)
    .filter(([k, v]) => typeof k === "string" && k.length <= 60 && Number.isFinite(Number(v)))
    .map(([name, count]) => ({ name: name.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 60), count: Number(count) }))
    .filter((e) => e.name && e.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
  return out.length ? out : null;
}

/** {day: {name: count}} from another service, cleaned the same way.
 *
 *  Days are kept in order and capped: a dashboard showing ninety rows of a
 *  table nobody scrolls is worse than one showing fourteen. */
function byDay(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out = Object.entries(raw)
    .filter(([day]) => /^\d{4}-\d{2}-\d{2}$/.test(day))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)
    .map(([day, m]) => ({ day, uses: counts(m) || [] }))
    .filter((d) => d.uses.length);
  return out.length ? out : null;
}

// ---------------------------------------------------------------------------
// The app's second endpoint: what was actually done in it
//
// /api/count is public and answers "how many people". /api/usage is secret-
// gated and answers "and what did they do" — which features were called, on
// which days, how many distinct devices called them, and how many of the
// people ever came back. It is the richer of the two by a long way, and it is
// the one the app's own dashboard has been showing while this page showed five
// numbers.
//
// Read here rather than by the browser for the usual reason: it wants an
// x-admin-secret header, and a secret that reaches a page is a published
// secret. This service holds the key, the browser holds none.
//
// Soft-failing on its own. A usage read that fails must not lose the count —
// the two are separate requests to separate endpoints and either can have a
// bad minute, so the panels degrade one at a time rather than together.
//
// ---------------------------------------------------------------------------
// Three things this payload will mislead you about if taken at face value
//
//   1. `totals` and `byDay` count CALLS, not people. The app says so in its own
//      `unit` field. Rendered under a heading about people they inflate
//      everything — 350 speaks is not 350 speakers. `devices` is the same
//      breakdown counted in people, so both are carried through and the page
//      shows them side by side rather than picking one and hoping.
//   2. `regular` and `stillAfterWeek` read 0 while the app is younger than the
//      window they measure, and that is arithmetic rather than a finding.
//      `firstFrom` below is the app's first recorded arrival, so the page can
//      tell the difference between "nobody stayed" and "nobody could have yet".
//   3. `devices` is a 14-day window and `people` is lifetime. Divide one by the
//      other and you get a retention rate that quietly drops everyone who
//      arrived a fortnight ago. They are kept apart and labelled with their
//      own spans.
// ---------------------------------------------------------------------------

/** A day-keyed map of plain numbers, in order, plus whatever did not carry a
 *  date. The app reports arrivals it could not date under `unknown`; dropping
 *  that key would quietly shrink the total the same rows are read against, so
 *  it comes back separately rather than being filtered away. */
function dayCounts(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const days = [];
  let undated = 0;
  for (const [key, value] of Object.entries(raw)) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) days.push({ day: key, count: n });
    else undated += n;
  }
  days.sort((a, b) => a.day.localeCompare(b.day));
  if (!days.length && !undated) return null;
  return { days: days.slice(-90), undated };
}

/** The retention block, as numbers or not at all. Every field defaulted: the
 *  two services ship separately, so a field added over there arrives here as a
 *  missing one for as long as it takes to deploy this side. */
function retention(raw, firstFrom) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const total = n(raw.total);
  if (!total) return null;
  return {
    total,
    returned: n(raw.returnedAtLeastOnce),
    onceOnly: n(raw.onceOnly),
    regular: n(raw.regular),
    afterWeek: n(raw.stillAfterWeek),
    afterMonth: n(raw.stillAfterMonth),
    // The earliest arrival the app has on record, so the page can say how old
    // the product is and therefore which of the windows above have had time to
    // fill. Without it a structural zero and a disappointing one look identical.
    firstFrom,
  };
}

const APP_USAGE_URL = process.env.ANALYTICS_APP_USAGE_URL || "";
const APP_USAGE_KEY = process.env.ANALYTICS_APP_USAGE_KEY || "";

async function appUsage() {
  // Told apart on purpose. A missing key is a switch nobody turned on; a
  // rejected one is a secret that was rotated on the other side and not here.
  // Both render as empty panels, and they need opposite work — so the page is
  // told which, rather than the two of us reading a screenshot for it.
  if (!APP_USAGE_KEY) throw Object.assign(new Error("no admin key on this box"), { off: true });
  if (!APP_USAGE_URL) throw Object.assign(new Error("no usage address set"), { off: true });
  const r = await fetch(APP_USAGE_URL, {
    headers: { "x-admin-secret": APP_USAGE_KEY },
    signal: AbortSignal.timeout(6000),
  });
  // Named rather than numbered where the number has an obvious cause. 401 is
  // the one that will actually happen, and "the app refused the key" is the
  // sentence that gets it fixed.
  if (r.status === 401 || r.status === 403) throw new Error("the app refused the key");
  if (!r.ok) throw new Error("the app answered " + r.status);
  const d = await r.json();

  const arrivals = dayCounts(d.people?.firstSeen);
  const firstFrom = arrivals?.days?.[0]?.day || null;

  return {
    // What the app itself calls the unit, quoted rather than assumed. If that
    // sentence ever changes over there, the page repeats the new one.
    unit: typeof d.unit === "string" ? d.unit.slice(0, 80) : "calls, not devices",
    uses: counts(d.totals),
    usesByDay: byDay(d.byDay),
    // The same features counted in people instead of calls, over the window the
    // app keeps them for. Its own span, carried with it, because it is not the
    // span anything else on this page uses.
    devices: counts(d.devices?.totals),
    deviceDays: Number(d.devices?.windowDays) || 0,
    screens: counts(d.screens?.totals),
    people: retention(d.people, firstFrom),
    // When everyone who has ever used it first turned up. This reaches back
    // before the diary in lib/apphistory.js does — that file records what the
    // app said on the days this service was running, while these are the app's
    // own memory of arrivals it saw before anyone here was watching.
    arrivals,
  };
}

const APP_COUNT_URL = process.env.ANALYTICS_APP_COUNT_URL || "";
const APP_CACHE_MS = 60_000;
let appCache = { at: 0, value: null };

async function appCount(force = false) {
  if (!APP_COUNT_URL) return null;
  if (!force && Date.now() - appCache.at < APP_CACHE_MS) return appCache.value;
  // Both endpoints at once, and settled rather than awaited in turn: the count
  // is the one this section cannot do without, so a usage read that hangs must
  // not hold it up and a usage read that fails must not lose it.
  const [gotCount, gotUsage] = await Promise.allSettled([
    (async () => {
      const r = await fetch(APP_COUNT_URL, { signal: AbortSignal.timeout(4000) });
      if (!r.ok) throw new Error("app said " + r.status);
      return r.json();
    })(),
    appUsage(),
  ]);
  const use = gotUsage.status === "fulfilled" ? gotUsage.value : null;
  // Why there is no usage, in a form the page can print. Never the key itself
  // and never the address with it — a diagnostic that leaks the thing it is
  // diagnosing is worse than no diagnostic.
  let usageWhy = null;
  if (gotUsage.status === "rejected") {
    const err = gotUsage.reason;
    usageWhy = { off: Boolean(err?.off), reason: String(err?.message || "could not be read").slice(0, 120) };
    console.error("app usage:", usageWhy.reason);
  }
  try {
    if (gotCount.status === "rejected") throw gotCount.reason;
    const d = gotCount.value;
    // Only the three fields, and only as numbers. This is another service's
    // JSON: taking exactly what is expected keeps a change over there from
    // becoming a surprise in here.
    appCache = {
      at: Date.now(),
      value: {
        count: Number(d.count) || 0,
        today: Number(d.today) || 0,
        week: Number(d.week) || 0,
        // Added on the app's side after this was first written. Absent from an
        // older deployment, which is why every field is defaulted rather than
        // assumed: the two services ship separately and always will.
        activeToday: Number(d.activeToday) || 0,
        returningToday: Number(d.returningToday) || 0,
        // The same three breakdowns the site keeps, if the app reports them.
        //
        // Absent today and the panels say so rather than showing nothing: an
        // empty section reads as a broken feature, and the distinction between
        // "nobody came from there" and "that is not measured on that side" is
        // the whole difference between a finding and a gap.
        //
        // Shape is deliberately the app's own to choose — an object of name to
        // count — because that is what its store already holds and asking it to
        // reshape for us would be asking for a bug.
        places: counts(d.places),
        sources: counts(d.sources),
        vias: counts(d.vias),
        // Which features were used, today and per day. The only figure here
        // that describes what the product is for rather than how many opened
        // it — a count of arrivals cannot tell you that people came to speak
        // rather than to read.
        //
        // Two sources, in that order of preference. The count endpoint was
        // sending these before the usage one existed; usage sends the fuller
        // version. Falling back rather than replacing means a box where the
        // admin key is not set keeps exactly what it had.
        uses: (use && use.uses) || counts(d.uses),
        usesByDay: (use && use.usesByDay) || byDay(d.usesByDay),
        // Everything below comes from the secret-gated endpoint alone, so it is
        // null on a box with no key — which the page reports as a switch that
        // is off, not as a product nobody uses.
        unit: use ? use.unit : null,
        devices: use ? use.devices : null,
        deviceDays: use ? use.deviceDays : 0,
        screens: use ? use.screens : null,
        people: use ? use.people : null,
        arrivals: use ? use.arrivals : null,
        usageWhy,
        url: APP_COUNT_URL,
      },
    };
    // Written down, because this answer has no past in it and the sequence of
    // them is the only place a growth curve can come from.
    appHistory.record(appCache.value);
  } catch {
    // Keep the last good figure for one cache window rather than blinking the
    // section out of existence over a single bad request.
    if (Date.now() - appCache.at > APP_CACHE_MS * 5) appCache = { at: Date.now(), value: null };
  }
  return appCache.value;
}

app.get("/api/stats", async (req, res) => {
  const span = Math.min(Math.max(Number(req.query.days) || 14, 1), 90);
  res.set("Cache-Control", "no-store");
  res.json({
    ...store.report(span), tz: TZ, sites: SITES, open: OPEN, app: await appCount(),
    appSeries: appHistory.series(span),
    // Whether this reached us through a seat rather than off the open
    // hostname. Only the agent holds the internal token, and it only forwards
    // for a signed-in owner — so "no password here" is true of this service
    // and false of the page the person is actually looking at. The banner that
    // says otherwise has to know the difference, or it warns about an exposure
    // that is not there, and a warning that is wrong once is ignored after.
    proxied: internalOk(req),
  });
});

app.use(express.static("public"));

// ---------------------------------------------------------------------------

const loaded = await store.load();
const appDays = await appHistory.load();
if (APP_COUNT_URL) {
  console.log(`app history: ${appDays} days recorded`);
  appCount().catch(() => {});   // one sample at boot, so today has a point
}
console.log(`analytics: ${loaded.days} days, ${loaded.devices} devices known`);
console.log(`counting for: ${SITES.join(", ") || "(nothing — set ANALYTICS_SITES)"}`);
console.log(OPEN
  ? "dashboard: OPEN — no ANALYTICS_PASSWORD set, anyone with the hostname can read it"
  : "dashboard: password required");

// The only thing that writes. Study Pal's docs/PRIVACY.md forbids per-person
// timestamps, so there is no event log to append to — an event updates a day's
// totals in memory, and a day is the finest grain that reaches disk.
// Sampled on a timer as well as on demand. Left to the dashboard's own
// requests, the series would have a gap for every day nobody happened to look
// — which is exactly the quiet week whose shape you would want to see later.
if (APP_COUNT_URL) {
  setInterval(() => {
    appCount(true).catch(() => {});
  }, 3600_000).unref();
}
setInterval(() => appHistory.flush().catch((e) => console.error("app history:", e.message)), 30_000).unref();
setInterval(() => store.flush().catch((e) => console.error("flush:", e.message)), 10_000).unref();
setInterval(() => store.prune().catch((e) => console.error("prune:", e.message)), 6 * 3600_000).unref();

const server = app.listen(PORT, () => console.log(`analytics listening on ${PORT}`));

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    server.close(async () => {
      await store.flush().catch(() => {});
      process.exit(0);
    });
  });
}
