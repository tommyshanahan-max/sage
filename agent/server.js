// A chat front end for the Claude Agent SDK.
//
// The browser talks only to this server; this server talks to Anthropic using
// an API key. That is the whole point of the shape: the key lives here, the
// request originates here, and the browser never contacts Anthropic at all.
//
// Streaming is Server-Sent Events rather than a websocket. SSE is plain HTTP
// over TCP, which survives this deployment's network conditions better and
// needs no special handling in the reverse proxy.

import express from "express";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  createFileStore,
  ANALYSIS_PROMPT,
  parseAnalysis,
  transcriptForAnalysis,
  fingerprint,
} from "./lib/conversations.js";
import {
  isSpeechConfigured,
  synthesize,
  transcribe,
  MAX_STT_BYTES,
} from "./lib/speech.js";
import {
  ROLE,
  isPartner,
  MOCKUPS_DIR,
  PROJECT_LABEL,
  PARTNER_TOOLS,
  canWriteStories,
  PARTNER_DENIED,
  PARTNER_VOICE,
  PROSPECT_VOICE,
  isProspect,
} from "./lib/role.js";
import * as studypal from "./lib/studypal.js";
import * as changes from "./lib/changes.js";
import { parseDocList, listDocs, readDoc, renderMarkdown } from "./lib/docs.js";

const PORT = process.env.PORT || 3000;
const WORKSPACE = process.env.AGENT_WORKSPACE || "/workspace";
const HOME = process.env.HOME || "/home/coder";

// Past conversations. The store is the only part of this that knows where
// transcripts live; swap it and the rest is unchanged. See lib/conversations.js.
const conversations = createFileStore({ home: HOME, cwd: WORKSPACE });

// Documents a partner may read, named one by one. Resolved once at startup
// against the snapshot root — see lib/docs.js on why this is a list and never a
// directory scan.
const DOCS_ROOT = process.env.AGENT_DOCS_ROOT || "/work/app";
const DOCS = parseDocList(process.env.AGENT_DOCS, DOCS_ROOT);
// The live application, shown beside the conversation. Optional: unset, the
// page is exactly as it was and no preview is offered. It is only ever put in
// an iframe's src, so an address that refuses framing costs a blank pane and
// nothing else — which is why the panel always carries an Open link too.
const APP_URL = /^https?:\/\//i.test(process.env.AGENT_APP_URL || "")
  ? process.env.AGENT_APP_URL.trim()
  : "";
const MODEL = process.env.AGENT_MODEL || undefined;
const PASSWORD = process.env.AGENT_PASSWORD || "";
// Optional. Set it and the form asks for a username too; leave it unset and the
// page is exactly as it was — which is why the owner's seat is unchanged while a
// partner's asks for both.
//
// A username is not much of a secret: it is guessable, and it is not what keeps
// anyone out. It earns its place on a seat held by someone else for two other
// reasons — it reads as an account rather than a shared door, and it leaves
// room for a second partner later without every one of them typing the same
// thing.
const USER = process.env.AGENT_USER || "";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "ANTHROPIC_API_KEY is not set. The agent cannot run without it.\n" +
      "Add it to .env and run `make up` again."
  );
}

// Appended to Claude Code's own system prompt, never in place of it — the
// preset carries the tool-use instructions the agent needs to work at all.
// This adds only identity and manner.
//
// The manner is journey's plain-conversation voice, carried over deliberately
// so the same companion shows up across projects. What is left behind is that
// app's apparatus — archetypes, the Hero's Journey, the therapist framing —
// which has nothing to attach to in a coding session and would get in the way.
const SAGE_VOICE = `You are Sage, here in a coding workspace.

- Be useful first. Match the length of your answer to the question: a sentence
  for a small one, real detail for a real one. Don't pad, don't summarise what
  you just said, and don't end every turn with a question — ask one when you
  actually need something to continue.
- Talk like a person who knows things, not like a brochure.
- Say when you don't know, and say when you're guessing.
- Reply in whatever language the person is using. If they write in Chinese,
  answer in Chinese; if they switch mid-conversation, switch with them.
- The person you are working with does not write code. Say what changed and
  why in plain language, and name the files, but do not assume the diff will
  be read.
- Never invent a file path, command, package version or config key, and never
  report that something works when it has not been run. A plausible-looking
  wrong path will not be caught by someone reading the diff, so it becomes a
  bug discovered at deploy time.
- Before anything destructive — deleting files, rewriting git history,
  force-pushing — say plainly what will be lost, and wait.

No archetype readings, no Hero's Journey framing, none of the journey app's
material. That is a different context and it does not belong here.`;

const app = express();

// ---------------------------------------------------------------------------
// Sessions
//
// This used to be HTTP basic auth, which iOS Safari does not hold on to: put
// the phone down, the tab gets reclaimed, and the dialog is back. There is no
// cookie in basic auth, so there is nothing for the browser to remember.
//
// A signed cookie fixes that. The signing key is derived from the password, so
// there is no second secret to manage — and changing the password invalidates
// every existing session, which is the behaviour you want from a password
// change anyway.
// ---------------------------------------------------------------------------
const SESSION_DAYS = 30;
const COOKIE = "sage_session";
// Derived from both, so changing either signs every device out. The no-username
// form is kept byte-identical to what it was, so adding this feature does not
// quietly sign out a seat that never had a username.
const KEY = createHash("sha256")
  .update(USER ? `sage-session:${USER}:${PASSWORD}` : "sage-session:" + PASSWORD)
  .digest();

function safeEqual(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const sign = (payload) =>
  createHmac("sha256", KEY).update(payload).digest("base64url");

function issue() {
  const expires = Date.now() + SESSION_DAYS * 86400_000;
  const payload = String(expires);
  return payload + "." + sign(payload);
}

function valid(token) {
  if (typeof token !== "string") return false;
  const cut = token.lastIndexOf(".");
  if (cut < 1) return false;
  const payload = token.slice(0, cut);
  const mac = token.slice(cut + 1);
  if (!safeEqual(mac, sign(payload))) return false;
  const expires = Number(payload);
  return Number.isFinite(expires) && expires > Date.now();
}

// express does not parse cookies without another dependency, and one header
// split is cheaper than the dependency.
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

function loginPage(failed) {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sage</title>
<style>
  :root{--paper:#eef1f5;--card:#fbfcfd;--ink:#10192b;--muted:#7d8ba0;
    --rule:#dae0e9;--gold:#a8761f;--down:#a8442f;
    --serif:ui-serif,"New York",Georgia,serif;
    --sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  @media(prefers-color-scheme:dark){:root:not([data-theme="light"]){
    --paper:#0e1219;--card:#161b24;--ink:#e8ecf3;--muted:#77839a;
    --rule:#242b36;--gold:#d9a94e;--down:#e08a72}}
  :root[data-theme="dark"]{--paper:#0e1219;--card:#161b24;--ink:#e8ecf3;
    --muted:#77839a;--rule:#242b36;--gold:#d9a94e;--down:#e08a72}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;padding:1.5rem;
    background:var(--paper);color:var(--ink);font-family:var(--sans);
    font-size:16px;-webkit-font-smoothing:antialiased}
  form{width:100%;max-width:20rem;background:var(--card);border:1px solid var(--rule);
    border-radius:12px;padding:1.6rem 1.5rem;display:flex;flex-direction:column;gap:.9rem}
  h1{margin:0;font-family:var(--serif);font-style:italic;font-weight:400;
    font-size:2rem;line-height:1;color:var(--gold)}
  p{margin:0;font-size:.85rem;color:var(--muted)}
  p.bad{color:var(--down)}
  input{font:inherit;color:var(--ink);background:var(--paper);
    border:1px solid var(--rule);border-radius:9px;padding:.65rem .8rem;width:100%}
  input:focus{outline:2px solid var(--gold);outline-offset:-1px;border-color:transparent}
  button{font:inherit;font-weight:600;font-size:.9rem;cursor:pointer;color:#fff;
    background:var(--gold);border:0;border-radius:9px;padding:.7rem 1rem}
</style></head><body>
<form method="post" action="/login">
  <h1>Sage</h1>
  ${failed ? `<p class="bad">${USER ? "That username and password did not match." : "That password was not right."}</p>`
           : "<p>Signed in for 30 days on this device.</p>"}
  ${USER ? `<input type="text" name="username" autocomplete="username"
         placeholder="Username" autofocus required>` : ""}
  <input type="password" name="password" autocomplete="current-password"
         placeholder="Password"${USER ? "" : " autofocus"} required>
  <button type="submit">Sign in</button>
</form></body></html>`;
}

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.use(express.urlencoded({ extended: false, limit: "16kb" }));

// Without a password this page would hand an agent — and the API key behind
// it — to anyone who found the hostname, which every issued certificate
// publishes. Refusing to serve is the safe failure; `make up` checks for the
// password too, so this should never be what you hit.
app.use((_req, res, next) => {
  if (!PASSWORD) {
    return res.status(503).type("text/plain")
      .send("AGENT_PASSWORD is not set on the server. Refusing to serve.");
  }
  next();
});

app.get("/login", (req, res) => {
  if (valid(cookie(req, COOKIE))) return res.redirect("/");
  res.type("html").send(loginPage(false));
});

app.post("/login", async (req, res) => {
  // Both are checked every time, and both with a timing-safe comparison. A
  // username checked with === would answer "does this account exist?" a little
  // faster than it answers "is this password right?".
  const userOk = !USER || safeEqual(String(req.body?.username ?? "").trim(), USER);
  const passOk = safeEqual(String(req.body?.password ?? ""), PASSWORD);
  if (userOk && passOk) {
    res.cookie(COOKIE, issue(), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DAYS * 86400_000,
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

app.use((req, res, next) => {
  if (valid(cookie(req, COOKIE))) return next();
  // An expired session on a background request should fail loudly rather than
  // hand the page a login form it would try to render as a reply.
  if (req.path.startsWith("/api/")) {
    return res.status(401).json({ error: "session expired" });
  }
  res.redirect("/login");
});

// A screenshot is the one thing sent here that is not text. Everything else
// keeps the small limit — a route that accepts megabytes is a route worth
// aiming at, so only the one that needs it gets them.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;      // what the API accepts per image
const MAX_IMAGES = 4;
// A cover is an image and does not fit the small limit either. Named
// individually rather than raised for everything: a route that accepts
// megabytes is a route worth aiming at, so only the two that need them get them.
const BIG_BODY = new Set(["/api/chat", "/sp/cover"]);
app.use((req, res, next) =>
  BIG_BODY.has(req.path) ? next() : express.json({ limit: "1mb" })(req, res, next));
// The story desk's page, before the static handler that would otherwise serve
// it to anyone signed in. Its routes already refuse a partner seat, but a page
// that loads and then fails every call still tells that seat the feature
// exists and invites the question. A door that is not theirs should not be
// visible, let alone open onto an error.
// One expression decides all three: whether the page is served, whether the
// routes answer, and whether the masthead draws the button. Split them and you
// get the combination where a seat can open a desk it cannot use.
const deskOpen = () => canWriteStories && studypal.configured();

app.get("/stories.html", (req, res, next) => {
  if (!deskOpen()) return res.status(404).send("Not found");
  next();
});

app.use(express.static("public"));

// --------------------------------------------------------------------------
// Documents (partner seats only)
//
// Read-only, from the snapshot, and only the ones named in AGENT_DOCS.
// --------------------------------------------------------------------------

app.get("/api/docs", async (_req, res) => {
  if (!isPartner) return res.status(404).json({ error: "not this seat" });
  try {
    res.json({ docs: await listDocs(DOCS) });
  } catch (err) {
    console.error("listing documents failed:", err);
    res.status(500).json({ error: "could not read the documents" });
  }
});

app.get("/docs/:id", async (req, res) => {
  if (!isPartner) return res.status(404).send("Not found");
  const doc = await readDoc(DOCS, req.params.id);
  if (!doc) return res.status(404).send("Not found");

  const isMarkdown = /\.(md|markdown)$/i.test(doc.rel);
  const body = isMarkdown
    ? renderMarkdown(doc.text)
    // Anything else is shown as-is, escaped, rather than guessed at.
    : `<pre>${doc.text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`;

  res.set("Content-Type", "text/html; charset=utf-8")
    .set(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; " +
        "form-action 'none'; base-uri 'none'; frame-ancestors 'self'"
    )
    .set("Cache-Control", "no-store")
    .send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${doc.title}</title><style>
  :root{--paper:#eef1f5;--card:#fbfcfd;--ink:#10192b;--ink-2:#45536b;--muted:#7d8ba0;
    --rule:#dae0e9;--gold:#a8761f;
    --serif:ui-serif,"New York",Georgia,serif;
    --sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"PingFang SC",sans-serif;
    --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  @media(prefers-color-scheme:dark){:root:not([data-theme="light"]){
    --paper:#0e1219;--card:#161b24;--ink:#e8ecf3;--ink-2:#a6b1c2;--muted:#77839a;
    --rule:#242b36;--gold:#d9a94e}}
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);
    font-size:16px;line-height:1.65;-webkit-font-smoothing:antialiased}
  main{max-width:42rem;margin:0 auto;padding:clamp(1.5rem,5vw,3rem) 1.2rem 5rem}
  .src{font-size:.72rem;color:var(--muted);font-family:var(--mono);margin:0 0 1.6rem}
  h1,h2,h3,h4{font-family:var(--serif);font-weight:500;line-height:1.25;
    letter-spacing:-.01em;margin:2rem 0 .6rem}
  h1{font-size:1.9rem;margin-top:0}h2{font-size:1.4rem}h3{font-size:1.12rem}h4{font-size:1rem}
  p,li{color:var(--ink-2)}
  ul,ol{padding-left:1.3rem}
  li{margin:.25rem 0}
  code{font-family:var(--mono);font-size:.86em;background:var(--card);
    border:1px solid var(--rule);border-radius:4px;padding:.08em .32em}
  pre{background:var(--card);border:1px solid var(--rule);border-radius:9px;
    padding:.85rem 1rem;overflow-x:auto}
  pre code{border:0;background:none;padding:0;font-size:.82rem;line-height:1.55}
  blockquote{margin:1rem 0;padding-left:1rem;border-left:2px solid var(--gold-line,var(--rule));
    color:var(--muted)}
  hr{border:0;border-top:1px solid var(--rule);margin:2rem 0}
  a{color:var(--gold)}
</style></head><body><main>
<p class="src">${doc.rel}</p>
${body}
</main></body></html>`);
});

// --------------------------------------------------------------------------
// Mockups (partner seats only)
//
// Everything a partner produces lands here, and nowhere else, because nowhere
// else is writable. These routes let them list what they have made and open it.
// --------------------------------------------------------------------------

// A mockup name is used to build a path, so it is matched against a shape
// rather than cleaned. A sanitised name that still resolves somewhere is worse
// than a refused one.
const isMockupName = (n) => typeof n === "string" && /^[A-Za-z0-9._-]{1,120}\.html$/.test(n);

app.get("/api/mockups", async (_req, res) => {
  if (!isPartner) return res.status(404).json({ error: "not this seat" });
  try {
    const names = (await readdir(MOCKUPS_DIR)).filter(isMockupName);
    const items = await Promise.all(
      names.map(async (name) => {
        const info = await stat(path.join(MOCKUPS_DIR, name));
        return { name, updatedAt: info.mtime.toISOString(), bytes: info.size };
      })
    );
    items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json({ mockups: items });
  } catch (err) {
    if (err.code === "ENOENT") return res.json({ mockups: [] });
    console.error("listing mockups failed:", err);
    res.status(500).json({ error: "could not read the mockups folder" });
  }
});

app.get("/mockups/:name", async (req, res) => {
  if (!isPartner) return res.status(404).send("Not found");
  const { name } = req.params;
  if (!isMockupName(name)) return res.status(404).send("Not found");
  try {
    const html = await readFile(path.join(MOCKUPS_DIR, name), "utf8");
    res
      .set("Content-Type", "text/html; charset=utf-8")
      // A mockup is a page written by an agent and served from this origin,
      // which would otherwise let it call these APIs with the viewer's own
      // session. It is allowed to be a page and nothing else: no network of
      // any kind, no framing of anything.
      .set(
        "Content-Security-Policy",
        "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; " +
          "font-src data:; script-src 'unsafe-inline'; form-action 'none'; " +
          "base-uri 'none'; frame-ancestors 'self'"
      )
      .set("Cache-Control", "no-store")
      .send(html);
  } catch {
    res.status(404).send("Not found");
  }
});

// --------------------------------------------------------------------------
// Voice
// --------------------------------------------------------------------------

// Whether to offer a microphone at all. The page asks once on load; with no key
// configured it simply does not draw the circle, because an absent key must
// look like a feature that isn't switched on, not one that is broken.
// What kind of seat this is, so the page can dress itself accordingly. Not a
// permission check — nothing is gated on what the browser is told here; the
// routes above check the role themselves.
app.get("/api/seat", (_req, res) =>
  res.json({
    role: ROLE, project: PROJECT_LABEL, hasDocs: DOCS.length > 0, appUrl: APP_URL,
    // Whether to offer the desk. Not the permission — the routes decide that —
    // only whether to draw a door this seat can actually open.
    stories: deskOpen(),
  }));

// ---------------------------------------------------------------------------
// What changed on the platform
//
// The same digest that goes into the system prompt, for the page to list. Owner
// seat only: the platform's commit history is a description of how this box is
// built, including which services exist and what they are for, and a seat held
// by someone else has no business reading it.
//
// 404 rather than 403 when there is nothing to show, matching /api/numbers —
// a seat that cannot have this should not learn that it exists.
// ---------------------------------------------------------------------------
app.get("/api/changes", async (_req, res) => {
  if (isPartner) return res.status(404).json({ error: "not this seat" });
  const state = await changes.summary();
  if (!state) return res.status(404).json({ error: "no digest" });
  res.set("Cache-Control", "no-store");
  res.json(state);
});

// ---------------------------------------------------------------------------
// Today's numbers, in the masthead
//
// Fetched here rather than by the page: the counter lives on its own hostname
// with its own sign-in, and that cookie is host-only, so a browser on this
// origin cannot read it. This server can — the two containers share a Docker
// network — and it presents a shared token the browser never sees.
//
// Owner seat only. A partner is shown the app and their mockups; how the
// business is doing is not theirs.
// ---------------------------------------------------------------------------
const NUMBERS_URL = process.env.AGENT_NUMBERS_URL || "";
const NUMBERS_TOKEN = process.env.AGENT_NUMBERS_TOKEN || "";
const NUMBERS_LINK = process.env.AGENT_NUMBERS_LINK || "";

app.get("/api/numbers", async (_req, res) => {
  if (isPartner || !NUMBERS_URL) return res.status(404).json({ error: "not this seat" });
  try {
    // Short timeout on purpose. This is decoration in a masthead; a counter
    // having a bad minute must not make the chat page feel broken.
    const upstream = await fetch(NUMBERS_URL + "/api/stats?days=14", {
      headers: NUMBERS_TOKEN ? { authorization: "Bearer " + NUMBERS_TOKEN } : {},
      signal: AbortSignal.timeout(4000),
    });
    if (!upstream.ok) throw new Error("counter said " + upstream.status);
    const data = await upstream.json();
    res.json({
      today: data.today,
      // The app's own count, passed through rather than fetched again here.
      // One service reads it, one service caches it; two would eventually
      // disagree about the same number, which is worse than not having it.
      app: data.app || null,
      returnRate: data.returnRate,
      // Just enough for a sparkline. The full picture is a click away.
      series: (data.series || []).map((d) => d.devices),
      // Its own hostname if one is configured, otherwise the proxy above —
      // which is always there when the counter is, so the readout is never a
      // link to nowhere.
      link: NUMBERS_LINK || "/numbers/",
    });
  } catch (err) {
    res.status(502).json({ error: err.message || "could not reach the counter" });
  }
});

// The counter's own dashboard, served through this seat.
//
// The alternative was a public hostname for it, and that turned out to be the
// worse of the two. It needs a DNS record and a certificate before anything
// can be read at all, it needs its own password to not be world-readable, and
// having set one you now have two passwords for one product. None of that buys
// anything: the only person who should see these numbers is already signed in
// here, on a seat that already checks who they are.
//
// So this forwards instead. Same authentication as everything else on this
// origin, owner seat only, GET only — the dashboard reads, it never writes,
// and a proxy that will only forward reads cannot be turned into one that
// writes by asking it differently.
app.get(/^\/numbers(\/.*)?$/, async (req, res) => {
  if (isPartner || !NUMBERS_URL) return res.status(404).send("Not found");
  // Without the trailing slash the page's relative fetches resolve one level
  // too high and the dashboard loads with no data in it.
  if (req.path === "/numbers") return res.redirect(301, "/numbers/");

  const tail = req.path.slice("/numbers".length) || "/";
  const query = req.url.slice(req.path.length);
  try {
    const upstream = await fetch(NUMBERS_URL + tail + query, {
      headers: NUMBERS_TOKEN ? { authorization: "Bearer " + NUMBERS_TOKEN } : {},
      signal: AbortSignal.timeout(10_000),
    });
    res.status(upstream.status);
    const type = upstream.headers.get("content-type");
    if (type) res.set("content-type", type);
    // Forwarding only the content type left the response with no caching
    // headers at all, and a response with none gets heuristically cached —
    // browsers invent a lifetime from Last-Modified. The dashboard then goes
    // stale in a way that survives a deploy AND a reload, which reads as "the
    // new panel never shipped" rather than as a cache. It is a few kilobytes
    // of numbers that are wrong the moment they are old, so never store it.
    res.set("Cache-Control", "no-store, must-revalidate");
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (err) {
    res.status(502).send("The counter could not be reached: " + (err.message || "unknown"));
  }
});

// ---------------------------------------------------------------------------
// Study Pal's story desk
//
// A proxy, because those endpoints are secret-gated and send no CORS headers —
// see agent/lib/studypal.js for why that is right rather than an oversight.
//
// Owner seat only. The spec these implement assumes one login means one class
// of person; here it does not. Three roles sit behind the same sign-in, and a
// bare "is signed in" check would give a business partner and a prospective one
// write and publish rights over a live catalogue. The container is the boundary,
// so whoever holds THIS seat's password is in and the other seats are not,
// whatever anyone types.
// ---------------------------------------------------------------------------
const ownerOnly = (req, res, next) => {
  if (!canWriteStories) return res.status(404).json({ error: "not this seat" });
  if (!studypal.configured()) {
    return res.status(503).json({ error: "STUDYPAL_ADMIN_KEY is not set on this box" });
  }
  next();
};

app.get("/sp/series", ownerOnly, async (_req, res) => {
  const r = await studypal.call("/api/series");
  res.status(r.status).json(r.body);
});

// Where the readers' copy lives, so publishing can show it rather than
// describe it. The front door is what the spec names as live; if a series has
// its own address, this is the one line that would change.
app.get("/sp/where", ownerOnly, (_req, res) =>
  res.json({ base: studypal.base(), shelf: studypal.base() + "/drama" }));

app.get("/sp/usage", ownerOnly, async (_req, res) => {
  const r = await studypal.call("/api/usage?app=studypal");
  res.status(r.status).json(r.body);
});

app.put("/sp/series", ownerOnly, async (req, res) => {
  const r = await studypal.call("/api/series", { method: "PUT", body: req.body ?? {} });
  res.status(r.status).json(r.body);
});

app.delete("/sp/series", ownerOnly, async (req, res) => {
  // The id travels in the query string upstream, so it is encoded here rather
  // than interpolated — an id is user input even when a slug pattern says it
  // should not be.
  const id = String(req.query.id || "");
  if (!id) return res.status(400).json({ error: "id is required" });
  const r = await studypal.call("/api/series?id=" + encodeURIComponent(id), { method: "DELETE" });
  res.status(r.status).json(r.body);
});

// Cover art.
//
// The endpoint on the other side does not exist yet — the spec lists it as the
// missing piece for adding a series end to end. This is written to the shape
// that side should implement: POST /api/cover with { id, image }, where image
// is a base64 JPEG with no data-URL prefix. Until it exists the call fails and
// the page offers the finished file for download instead, so the cropping work
// is not wasted on a round trip that cannot complete.
app.post("/sp/cover", ownerOnly, express.json({ limit: "8mb" }), async (req, res) => {
  const id = String(req.body?.id || "");
  const image = String(req.body?.image || "");
  if (!/^[a-z0-9-]{1,64}$/.test(id)) return res.status(400).json({ error: "bad series id" });
  if (!image) return res.status(400).json({ error: "no image" });
  // Roughly: base64 is four characters per three bytes.
  if (image.length * 0.75 > 6 * 1024 * 1024) return res.status(413).json({ error: "cover too large" });

  const r = await studypal.call("/api/cover", { method: "POST", body: { id, image }, timeoutMs: 30_000 });
  res.status(r.status).json(r.body);
});

app.post("/sp/episode", ownerOnly, async (req, res) => {
  const r = await studypal.call("/api/episode", {
    method: "POST",
    body: req.body ?? {},
    timeoutMs: studypal.GENERATE_TIMEOUT_MS,
  });
  res.status(r.status).json(r.body);
});

app.get("/api/voice", (_req, res) => res.json({ available: isSpeechConfigured() }));

// Sage's own words, spoken. Nothing is passed but the text she already wrote.
app.post("/api/voice/tts", async (req, res) => {
  if (!isSpeechConfigured()) return res.status(503).json({ error: "voice is not configured" });
  const text = req.body?.text;
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text is required" });
  }
  try {
    const audio = await synthesize(text);
    res.set("Content-Type", "audio/mpeg").set("Cache-Control", "no-store").send(audio);
  } catch (err) {
    console.error("tts failed:", err.detail || err);
    // Voice is an enhancement. A failure here should cost the reply nothing —
    // the page keeps the text and stays quiet.
    res.status(err.status || 502).json({ error: err.message || "speech failed" });
  }
});

// Audio arrives as a raw body rather than a multipart form: one content type,
// no parser to add, and the browser is sending a single blob anyway.
app.post(
  "/api/voice/stt",
  express.raw({ type: ["audio/*", "video/webm"], limit: MAX_STT_BYTES }),
  async (req, res) => {
    if (!isSpeechConfigured()) return res.status(503).json({ error: "voice is not configured" });
    if (!Buffer.isBuffer(req.body) || !req.body.length) {
      return res.status(400).json({ error: "no audio received" });
    }
    try {
      const text = await transcribe(req.body, req.get("content-type") || "audio/webm");
      // Empty is a real answer: nothing intelligible was said. The page is
      // expected to do nothing rather than send a blank message.
      res.json({ text });
    } catch (err) {
      console.error("stt failed:", err.detail || err);
      res.status(err.status || 502).json({ error: err.message || "could not transcribe that" });
    }
  }
);

// --------------------------------------------------------------------------
// Past conversations
// --------------------------------------------------------------------------

// The list. Cheap by construction — see lib/conversations.js on why this never
// opens a whole transcript.
app.get("/api/conversations", async (_req, res) => {
  try {
    res.json({ conversations: await conversations.list() });
  } catch (err) {
    console.error("listing conversations failed:", err);
    res.status(500).json({ error: "could not read past conversations" });
  }
});

// One conversation, as turns, for reading back before continuing it.
app.get("/api/conversations/:id", async (req, res) => {
  try {
    const found = await conversations.get(req.params.id);
    if (!found) return res.status(404).json({ error: "no such conversation" });
    res.json(found);
  } catch (err) {
    console.error("reading a conversation failed:", err);
    res.status(500).json({ error: "could not read that conversation" });
  }
});

// Analysis, on request only. It costs a model call, so it is never part of
// loading the list or opening a conversation — the same reason the summary in
// journey is generated on reset rather than mid-turn: nobody should wait on it
// who did not ask for it.
app.post("/api/conversations/:id/analysis", async (req, res) => {
  const { id } = req.params;
  try {
    const found = await conversations.get(id);
    if (!found) return res.status(404).json({ error: "no such conversation" });

    const print = fingerprint(found.turns);

    // Cached unless the conversation has moved on since. Re-reading a
    // conversation should not quietly spend money; continuing one and asking
    // again should not hand back an analysis that predates the new work.
    const cached = await conversations.readAnalysis(id);
    if (cached && cached.fingerprint === print && !req.body?.refresh) {
      return res.json({ analysis: cached, cached: true });
    }

    let text = "";
    for await (const message of query({
      prompt: `${ANALYSIS_PROMPT}\n\n---\n\n${transcriptForAnalysis(found.turns)}`,
      options: {
        cwd: WORKSPACE,
        // No tools and no preset: this reads a transcript and returns JSON. A
        // harness that can edit files is the wrong shape for it, and slower.
        systemPrompt: "You return only the JSON object you were asked for.",
        allowedTools: [],
        ...(MODEL ? { model: MODEL } : {}),
      },
    })) {
      if (message.type === "assistant") {
        for (const block of message.message?.content ?? []) {
          if (block.type === "text") text += block.text;
        }
      }
    }

    const analysis = parseAnalysis(text);
    if (!analysis) {
      // Say so rather than rendering a card with empty rows. A visible failure
      // is recoverable; a blank one looks like the feature is broken.
      return res.status(502).json({ error: "the analysis came back unreadable — try again" });
    }

    const record = { ...analysis, fingerprint: print };
    await conversations.writeAnalysis(id, record);
    res.json({ analysis: record, cached: false });
  } catch (err) {
    console.error("analysis failed:", err);
    res.status(500).json({ error: err?.message || "analysis failed" });
  }
});

app.post("/api/chat", express.json({ limit: "24mb" }), async (req, res) => {
  const { prompt, sessionId } = req.body ?? {};
  if (typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "prompt is required" });
  }

  // A session id is minted on the first turn and echoed back to the browser,
  // which returns it on every later turn. That is what carries the
  // conversation forward — without it each message would start from nothing.
  // Screenshots. The page shrinks them before sending — a phone photograph is
  // several megabytes and none of that resolution survives being read anyway —
  // but a client is not a control, so the sizes are checked again here.
  const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  const images = [];
  for (const item of Array.isArray(req.body?.images) ? req.body.images : []) {
    if (images.length >= MAX_IMAGES) break;
    const mediaType = String(item?.mediaType || "").toLowerCase();
    const data = String(item?.data || "");
    if (!IMAGE_TYPES.includes(mediaType)) continue;
    if (!/^[A-Za-z0-9+/=]+$/.test(data)) continue;
    // Base64 carries four characters for every three bytes.
    if ((data.length * 3) / 4 > MAX_IMAGE_BYTES) continue;
    images.push({ mediaType, data });
  }

  const isNewSession = !sessionId;
  const id = sessionId || randomUUID();

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Tells any proxy in the path not to buffer, which would otherwise hold
    // the whole reply until the turn ended and lose the point of streaming.
    "X-Accel-Buffering": "no",
  });

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // The session id is deliberately NOT sent yet. It is only real once a run
  // has actually created it, and announcing it up front means a turn that
  // fails still leaves the browser holding an id. Every later message then
  // asks to resume a session that was never created, and the run returns
  // nothing at all — a first failure quietly poisoning every turn after it,
  // until someone reloads the page. It goes out with `done` instead.

  // The SDK spawns the Claude Code CLI as a child process. When that child
  // refuses to start, the SDK reports only its exit code — the reason is on
  // the child's stderr, which is discarded unless something asks for it. Keep
  // the last few lines so a failure can say what actually went wrong instead
  // of "exited with code 1".
  const stderrTail = [];
  // A failed run reports itself twice: once as a result message carrying the
  // readable reason, and again as a throw. Show the first and suppress the
  // second rather than putting the same failure on screen twice.
  let reportedError = false;
  // Whether any of the reply has reached the browser. A retry is only safe
  // before the first byte — after that it would draw the answer twice.
  let streamed = false;
  // What the failure said, so the caller can tell one kind from another.
  let lastReason = "";

  // The CLI keeps conversations on disk and refuses to resume one it cannot
  // find. That happens for an ordinary reason: the container was recreated —
  // a password change, a `make up` — while a tab was open, and the tab goes on
  // asking to resume a session that is no longer there. Every later message
  // then fails identically, and the only way out is knowing to press "New
  // conversation", which nobody should have to know.
  const MISSING_SESSION = /No conversation found with session/i;

  // Recent platform history, read fresh per turn so a deploy mid-conversation
  // is picked up without anyone restarting anything. Owner seat only — see
  // /api/changes above on why a partner is not told how this box is built.
  const platformBrief = isPartner || isProspect ? "" : await changes.brief();

  const baseOptions = {
    cwd: WORKSPACE,
    // Appends to Claude Code's preset rather than replacing it: the preset
    // is what makes the tools work, and only the voice is ours.
    systemPrompt: {
      type: "preset",
      preset: "claude_code",
      append: isProspect
        ? PROSPECT_VOICE
        : isPartner
          ? PARTNER_VOICE
          : SAGE_VOICE + platformBrief,
    },
    // Every tool runs without stopping to ask, on the same files the editor
    // opens. Git is what protects them — see the README.
    //
    // bypassPermissions is refused unless allowDangerouslySkipPermissions is
    // set with it. Without the second flag the CLI exits before it does any
    // work, which surfaces as an exit code and nothing else.
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    // A partner seat is restricted by the DENY list, not the allow list.
    // `allowedTools` only says "run these without asking", and this deployment
    // runs in bypassPermissions, so on its own it restricts nothing at all —
    // the seat had Bash until this was fixed, and `env` in that container
    // prints ANTHROPIC_API_KEY. See lib/role.js.
    ...(isPartner ? { allowedTools: PARTNER_TOOLS, disallowedTools: PARTNER_DENIED } : {}),
    stderr: (data) => {
      process.stderr.write(data);
      stderrTail.push(data);
      if (stderrTail.length > 40) stderrTail.shift();
    },
    ...(MODEL ? { model: MODEL } : {}),
  };

  /** One run. Returns "ok", "missing" (the session is gone) or "failed". */
  async function attempt(runId, fresh) {
    reportedError = false;
    lastReason = "";
    const options = {
      ...baseOptions,
      ...(fresh ? { sessionId: runId } : { resume: runId }),
    };

    // The SDK yields transcript messages, not rendered pieces: an assistant
    // turn arrives as one message whose `content` is a list of blocks, and
    // tool output comes back as a *user* message carrying tool_result blocks,
    // because that is how the conversation is recorded. The events this sends
    // on are the flat ones the page knows how to draw.
    // A plain string is the SDK's simple path and stays the simple path. With
    // an image the prompt becomes a one-message stream instead, because that
    // is the only shape that can carry content blocks: an SDKUserMessage whose
    // message is an Anthropic MessageParam, exactly as the Messages API takes
    // them. The picture goes first — a question reads better after the thing
    // it is about.
    const input = images.length
      ? (async function* () {
          yield {
            type: "user",
            parent_tool_use_id: null,
            session_id: runId,
            message: {
              role: "user",
              content: [
                ...images.map((i) => ({
                  type: "image",
                  source: { type: "base64", media_type: i.mediaType, data: i.data },
                })),
                { type: "text", text: prompt },
              ],
            },
          };
        })()
      : prompt;

    try {
      for await (const message of query({ prompt: input, options })) {
        switch (message.type) {
          case "assistant":
            for (const block of message.message?.content ?? []) {
              if (block.type === "text") {
                streamed = true;
                send("text", { text: block.text });
              } else if (block.type === "tool_use") {
                streamed = true;
                send("tool_use", { id: block.id, name: block.name, input: block.input });
              }
            }
            break;
          case "user":
            for (const block of message.message?.content ?? []) {
              if (block.type === "tool_result") {
                streamed = true;
                send("tool_result", {
                  toolUseId: block.tool_use_id,
                  content: block.content,
                });
              }
            }
            break;
          case "result":
            // `subtype: "success"` only means the run completed its own loop —
            // it is still set on a turn that ended in an API error, so is_error
            // is the field that decides. Its `result` text is the readable one
            // ("Authentication error", a rate limit), which is why it is
            // preferred over the exception that follows it.
            if (message.is_error || message.subtype !== "success") {
              reportedError = true;
              lastReason = message.result || `run ended: ${message.subtype}`;
            }
            break;
          default:
            break; // other message types carry nothing this UI renders
        }
      }
    } catch (err) {
      console.error("agent turn failed:", err);
      reportedError = true;
      const detail = stderrTail.join("").trim().split("\n").slice(-8).join("\n");
      const base = err?.message || String(err);
      lastReason = detail ? `${base}\n\n${detail}` : base;
    }

    if (!reportedError) return "ok";
    return MISSING_SESSION.test(lastReason) ? "missing" : "failed";
  }

  try {
    let runId = id;
    let outcome = await attempt(runId, isNewSession);

    // The one retry. Only when the session is genuinely gone and nothing has
    // been drawn yet, so the reader sees a normal reply rather than an error
    // they have to act on. The turn's own words are kept; only the thread it
    // was going to continue is lost, and that thread no longer exists.
    if (outcome === "missing" && !streamed) {
      console.warn(`session ${runId} is gone; starting a fresh one`);
      runId = randomUUID();
      outcome = await attempt(runId, true);
    }

    if (outcome === "ok") {
      // Now it exists, so the browser can safely ask to resume it next time —
      // and if this was a recovery, the id it gets back is the new one.
      send("session", { sessionId: runId });
    } else {
      // The browser shows this verbatim. A real error someone can read beats a
      // spinner that never resolves — and beats an exit code with no cause, so
      // whatever the CLI said on its way out goes with it.
      send("error", { message: lastReason || "the run ended without saying why" });
    }
    send("done", {});
  } finally {
    res.end();
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`agent listening on :${PORT}, workspace ${WORKSPACE}`);
});
