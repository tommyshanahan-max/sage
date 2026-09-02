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
  const kind = req.body?.k === "use" ? "use" : "page";
  const name = clean(req.body?.n, 120);
  // A device id shaped like anything else is a client that is not ours.
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(device) || !name) return res.status(204).end();

  try {
    // Counts in memory; the timer below is the only thing that writes. The id
    // is hashed inside the store and is never written in the form it arrived.
    store.record({ device, kind, name, site });
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

  function send(k, n) {
    try {
      fetch(base + "/e", {
        method: "POST", keepalive: true, mode: "cors", credentials: "omit",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ d: id, k: k, n: String(n).slice(0, 120) }),
      }).catch(function () {});
    } catch (e) {}
  }

  /* Call lx("translate") from anywhere to count a function being used. */
  window.lx = function (name) { send("use", name); };
  send("page", location.pathname);
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

app.get("/api/stats", (req, res) => {
  const span = Math.min(Math.max(Number(req.query.days) || 14, 1), 90);
  res.set("Cache-Control", "no-store");
  res.json({ ...store.report(span), tz: TZ, sites: SITES, open: OPEN });
});

app.use(express.static("public"));

// ---------------------------------------------------------------------------

const loaded = await store.load();
console.log(`analytics: ${loaded.days} days, ${loaded.devices} devices known`);
console.log(`counting for: ${SITES.join(", ") || "(nothing — set ANALYTICS_SITES)"}`);
console.log(OPEN
  ? "dashboard: OPEN — no ANALYTICS_PASSWORD set, anyone with the hostname can read it"
  : "dashboard: password required");

// The only thing that writes. Study Pal's docs/PRIVACY.md forbids per-person
// timestamps, so there is no event log to append to — an event updates a day's
// totals in memory, and a day is the finest grain that reaches disk.
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
