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
import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
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
  PARTNER_NAME,
  canWriteStories,
  canSeeNumbers,
  canMakeVideo,
  OWNER_CLEARANCE,
  PARTNER_DENIED,
  PARTNER_VOICE,
  PROSPECT_VOICE,
  isProspect,
} from "./lib/role.js";
import * as studypal from "./lib/studypal.js";
import * as changes from "./lib/changes.js";
import * as numbers from "./lib/numbers.js";
import * as video from "./lib/video.js";
import * as social from "./lib/social.js";
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

// ---------------------------------------------------------------------------
// What Study Pal says happened — the webhook
//
// Mounted here, above the sign-in gate, because the caller is a server and has
// no cookie to present. That is the whole reason this route is different, so
// it carries its own lock instead: a shared secret in x-studypal-secret,
// compared in constant time, and no secret configured means the route refuses
// rather than accepts.
//
// The lock is the only thing standing between this and anyone who finds the
// hostname, so nothing else about the request is trusted: the body is small-
// capped, the shape is normalised in lib/social.js rather than stored as sent,
// and an id that is not an id is dropped rather than written to a filename.
//
// Study Pal posts { event, at, post } where event is published, held or
// removed. Held is the one that is work: the app's own check could not judge
// it either way, so a person here has to look.
// ---------------------------------------------------------------------------
const HOOK_SECRET = process.env.STUDYPAL_WEBHOOK_SECRET || "";

/** Which app's file this belongs to. The same key the panel resolves for the
 *  Study Pal project, so what arrives here is what that project reads back.
 *  Study Pal's own address first: on a seat that has the credentials that is
 *  the definitive answer, and AGENT_APP_URL is the partner seat's version of
 *  the same fact. */
function hookKey() {
  for (const url of [studypal.base(), APP_URL]) {
    if (!url) continue;
    try {
      const host = new URL(url).host.toLowerCase();
      if (/^[a-z0-9.:-]{1,80}$/.test(host)) return host;
    } catch { /* try the next one */ }
  }
  return "";
}

const feedbackPath = () => {
  const key = hookKey();
  return SOCIAL_DIR && key ? path.join(SOCIAL_DIR, key + ".feedback.json") : null;
};

// Deliveries arrive whenever the app decides, and two at once through a
// read-modify-write would leave whichever finished second as the only one
// stored. One chain, so they queue instead.
let hookQueue = Promise.resolve();

app.post("/api/studypal-hook", express.json({ limit: "256kb" }), async (req, res) => {
  if (!HOOK_SECRET) {
    return res.status(503).json({ error: "STUDYPAL_WEBHOOK_SECRET is not set on this server" });
  }
  const sent = String(req.headers["x-studypal-secret"] || "");
  if (!safeEqual(sent, HOOK_SECRET)) {
    // No detail. A wrong secret and a malformed body should not be
    // distinguishable from outside.
    return res.status(401).json({ error: "no" });
  }

  const file = feedbackPath();
  if (!file) {
    return res.status(503).json({ error: "no shared store on this box (AGENT_SOCIAL_DIR)" });
  }

  const report = social.cleanReport(req.body ?? {});
  if (!report) return res.status(400).json({ error: "need { event, post: { id } }" });

  const run = hookQueue.then(async () => {
    let stored = { reports: [] };
    try {
      stored = social.cleanFeedback(JSON.parse(await readFile(file, "utf8")));
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
    const next = social.withReport(stored, report);
    await mkdir(SOCIAL_DIR, { recursive: true });
    const tmp = file + ".tmp";
    await writeFile(tmp, JSON.stringify(next, null, 2) + "\n", "utf8");
    await rename(tmp, file);
    return next.reports.length;
  });
  // The queue must survive a failed delivery, or one bad write stops every
  // later one.
  hookQueue = run.catch(() => {});

  try {
    await run;
    res.json({ ok: true, id: report.id, event: report.event });
  } catch (err) {
    // 500 rather than a quiet ok: the other side should retry.
    res.status(500).json({ error: "could not record it: " + (err.code || err.message) });
  }
});


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
const BIG_BODY = new Set(["/api/chat", "/sp/cover", "/api/social/media"]);
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

// Video's door opens on a different rule from the desk's, deliberately.
//
// For the owner it is drawn whether or not a key is configured, because the
// owner is the person who can add one and being told exactly what is missing is
// how you discover a feature that needs one line of .env. A 404 there just
// looks like the feature does not exist.
//
// For a partner both have to hold. That seat cannot fix a missing key, so a
// page explaining how would be a door opening onto somebody else's problem.
const videoDoor = () => canMakeVideo && (!isPartner || video.configured());

app.get("/video.html", (req, res, next) => {
  if (!videoDoor()) return res.status(404).send("Not found");
  next();
});

// The reel desk, on the same rule as the video page it is built around.
app.get("/reel.html", (req, res, next) => {
  if (!videoDoor()) return res.status(404).send("Not found");
  next();
});

// Social's door.
//
// Open to the owner and to a partner; closed to a prospect. That is a wider
// rule than the story desk's, and deliberately: this panel does not publish to
// readers and cannot change the catalogue. It records who a project shares its
// work with and what went to them, which is exactly the job a partner seat
// exists for.
//
// What it does NOT open is the figures. Arrivals come from the counter, and
// that stays behind canSeeNumbers like everything else — a partner without
// that grant gets the panel, the people and the links, and dashes where the
// numbers would be. One page, two amounts of it, decided by the same flag as
// the rest of the seat.
const socialDoor = () => !isProspect;

app.get("/social.html", (req, res, next) => {
  if (!socialDoor()) return res.status(404).send("Not found");
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

// ---------------------------------------------------------------------------
// What is in the workspace
//
// This exists because of a real failure. Asked to "help me edit the study pal
// app", Sage listed the workspace, found three directories with study in the
// name and none of them the one meant, and said so — correctly, and unhelpfully.
// The person could not see what was there to name it precisely, and neither
// could they see that the thing they wanted was not there at all.
//
// So: the projects, on screen, in the panel that would otherwise be empty. A
// name is a poor identifier for a person and a good one for an agent, which is
// why clicking a project writes its full path into the message box rather than
// its name.
//
// Both seats, different roots. The owner gets the workspace; a partner gets
// their snapshot, which is the list of repositories they were given and nothing
// else. That is worth drawing rather than hiding: a panel showing exactly the
// two projects a partner can see is the boundary made visible, and they can
// already read those directories — the tiles publish nothing new.
//
// What a partner does not get is the buttons. Creating and deleting are owner
// routes and stay owner routes; their snapshot is mounted read-only, so the
// filesystem would refuse anyway, but a control that cannot work should not be
// drawn.
// ---------------------------------------------------------------------------

/** A one-line description, if the project happens to carry one. Best effort:
 *  a project with neither file is listed with no subtitle, which is fine. */
async function describe(dir) {
  try {
    const pkg = JSON.parse(await readFile(path.join(dir, "package.json"), "utf8"));
    const desc = typeof pkg.description === "string" ? pkg.description.trim() : "";
    if (desc) return desc.slice(0, 120);
  } catch { /* no package.json, or not JSON */ }
  try {
    // The first heading of the README, which is what a repository calls itself.
    // Read a slice rather than the file: a README can be the largest thing in
    // the project and only its first line is wanted.
    const handle = await readFile(path.join(dir, "README.md"), "utf8");
    const head = handle.split("\n").find((l) => /^#\s+\S/.test(l));
    if (head) return head.replace(/^#\s+/, "").trim().slice(0, 120);
  } catch { /* no README */ }
  return "";
}

const run = promisify(execFile);

/** A project name that is a single directory and nothing else.
 *
 *  Not a general path check with a `..` test bolted on: this is the only
 *  argument that decides which directory gets created — or moved to the trash —
 *  so it is an allow list of shapes, and everything outside it is refused. */
const okName = (n) =>
  typeof n === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(n) && n !== ".." && !n.includes("/");

/** The absolute path for a project, or null. The name is validated first, so
 *  this is belt and braces — but the thing it guards against is a delete
 *  outside the workspace, and that is worth two checks. */
function projectPath(name) {
  if (!okName(name)) return null;
  const dir = path.resolve(WORKSPACE, name);
  if (dir !== path.join(WORKSPACE, name)) return null;
  if (!dir.startsWith(WORKSPACE + path.sep)) return null;
  return dir;
}

/** What would be lost. Deleting a directory on this box is final — there are no
 *  VPS backups yet — so before anything moves, this asks git what is in there
 *  that is not anywhere else.
 *
 *  Three answers matter, and they are different sizes of loss: no git at all
 *  means nothing has ever been saved elsewhere; commits that are on no remote
 *  mean the work exists only here; uncommitted edits mean it is not even in the
 *  local history. Anything git cannot answer is reported as unknown rather than
 *  as safe. */
async function whatWouldBeLost(dir) {
  const out = { git: false, remote: false, uncommitted: 0, unpushed: 0, unknown: false };
  try {
    await stat(path.join(dir, ".git"));
    out.git = true;
  } catch {
    return out;                       // not a checkout: nothing is anywhere else
  }
  const git = (args) => run("git", ["-C", dir, ...args], { timeout: 5000 });
  try {
    const { stdout } = await git(["remote"]);
    out.remote = Boolean(stdout.trim());
  } catch { out.unknown = true; }
  try {
    const { stdout } = await git(["status", "--porcelain"]);
    out.uncommitted = stdout.split("\n").filter((l) => l.trim()).length;
  } catch { out.unknown = true; }
  try {
    // Commits reachable from a branch and from no remote-tracking branch. With
    // no remote configured every commit qualifies, which is the right answer.
    const { stdout } = await git(["log", "--branches", "--not", "--remotes", "--format=%h"]);
    out.unpushed = stdout.split("\n").filter((l) => l.trim()).length;
  } catch { out.unknown = true; }
  return out;
}

// Where each project can be seen running.
//
// One address per seat was never going to answer "open this project's app" —
// clicking `journey` cannot sensibly show Study Pal. So AGENT_PROJECT_APPS maps
// a project to its own address, and AGENT_APP_URL stays as the fallback for a
// project with no entry.
//
//   AGENT_PROJECT_APPS="study-pal=https://liuxuesheng.help,journey=https://..."
//
// A map rather than a guess. A dev server started inside this container is not
// reachable from a browser — there are no host ports and only Caddy is exposed
// — so inferring an address would produce exactly the plausible wrong URL that
// turns into a bug report.
const PROJECT_APPS = new Map(
  String(process.env.AGENT_PROJECT_APPS || "")
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const at = entry.indexOf("=");
      if (at === -1) return null;
      const name = entry.slice(0, at).trim();
      const url = entry.slice(at + 1).trim();
      return name && /^https?:\/\//i.test(url) ? [name, url] : null;
    })
    .filter(Boolean)
);

app.get("/api/projects", async (_req, res) => {
  // A partner's projects are the repositories in their snapshot, not the
  // contents of their container's working directory — which also holds the
  // mockups folder, and that is not a project.
  const root = isPartner ? DOCS_ROOT : WORKSPACE;
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const dirs = entries
      // Dotfiles are configuration, not projects, and a symlink out of the
      // workspace is not a project either.
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .slice(0, 80);

    const items = await Promise.all(
      dirs.map(async (e) => {
        const dir = path.join(root, e.name);
        let touchedAt = "";
        let git = false;
        try {
          touchedAt = (await stat(dir)).mtime.toISOString();
        } catch { /* raced with a delete */ }
        try {
          git = (await stat(path.join(dir, ".git"))).isDirectory();
        } catch { /* not a checkout */ }
        return {
          name: e.name,
          path: dir,
          git,
          touchedAt,
          what: await describe(dir),
          // Empty when this project has nowhere to be seen running. The page
          // says so rather than showing a blank frame.
          // A partner's seat has one address for one product, so its own app
          // is the right answer for anything in their snapshot. The owner's
          // seat has many projects and one default, which is why only this
          // side falls back.
          app: PROJECT_APPS.get(e.name) || (isPartner ? APP_URL : ""),
        };
      })
    );

    // Alphabetical, not by date. This is a list you look a name up in, and a
    // list that reorders itself between visits is one you have to re-read.
    items.sort((a, b) => a.name.localeCompare(b.name));
    res.set("Cache-Control", "no-store");
    // canEdit says whether to draw New project and the delete buttons. The
    // routes check the seat themselves; this only stops a partner being shown
    // doors that are locked.
    res.json({ root, projects: items, fallbackApp: APP_URL, canEdit: !isPartner });
  } catch (err) {
    if (err.code === "ENOENT") return res.json({ root, projects: [], canEdit: !isPartner });
    console.error("listing projects failed:", err);
    res.status(500).json({ error: "could not read the workspace" });
  }
});

// A new project. A directory in the workspace with a README in it — not a git
// repository, because `git init` on somebody's behalf decides things (a branch
// name, whether this is even meant to be a repository) that are theirs to
// decide, and Sage can do it in one sentence when asked.
app.post("/api/projects", async (req, res) => {
  if (isPartner) return res.status(404).json({ error: "not this seat" });
  const name = String(req.body?.name || "").trim();
  const dir = projectPath(name);
  if (!dir) {
    return res.status(400).json({
      error: "Letters, numbers, dot, dash and underscore; up to 64 characters.",
    });
  }
  try {
    await stat(dir);
    return res.status(409).json({ error: "There is already a project called " + name });
  } catch { /* good: it does not exist */ }
  try {
    await mkdir(dir, { recursive: false });
    await writeFile(
      path.join(dir, "README.md"),
      "# " + name + "\n\nStarted " + new Date().toISOString().slice(0, 10) + " from Sage.\n",
      "utf8"
    );
    res.status(201).json({ name, path: dir });
  } catch (err) {
    console.error("creating a project failed:", err);
    res.status(500).json({ error: "could not create it: " + err.code });
  }
});

// Deleting one.
//
// It moves to `.trash` inside the workspace rather than being removed. The
// rename is atomic and on the same filesystem, the directory is out of the way
// and out of the listing, and it can be moved back by hand — which matters more
// than usual here, because this box has no backups and a delete would otherwise
// be the end of it.
//
// Two things have to be true before it moves: the exact name typed back, and
// either nothing unsaved in there or an explicit second press. The first press
// answers "what would I lose", which is the question somebody deleting a
// directory cannot answer from memory.
app.post("/api/projects/delete", async (req, res) => {
  if (isPartner) return res.status(404).json({ error: "not this seat" });
  const name = String(req.body?.name || "").trim();
  const confirm = String(req.body?.confirm || "").trim();
  const force = Boolean(req.body?.force);

  const dir = projectPath(name);
  if (!dir) return res.status(400).json({ error: "not a project name" });
  if (confirm !== name) {
    return res.status(400).json({ error: "Type the project's name to confirm." });
  }
  try {
    if (!(await stat(dir)).isDirectory()) throw new Error("not a directory");
  } catch {
    return res.status(404).json({ error: "There is no project called " + name });
  }

  const lost = await whatWouldBeLost(dir);
  const risky = !lost.git || lost.unknown || lost.uncommitted > 0 || lost.unpushed > 0;
  if (risky && !force) {
    // 409, with the reasons, so the page can say what is about to be lost
    // instead of asking "are you sure?" about nothing in particular.
    return res.status(409).json({ error: "there is work here that is not anywhere else", lost });
  }

  const trash = path.join(WORKSPACE, ".trash");
  // Colons are legal on Linux but make a directory annoying to type at, and
  // somebody restoring one of these will be typing it.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const to = path.join(trash, name + "-" + stamp);
  try {
    await mkdir(trash, { recursive: true });
    await rename(dir, to);
    res.json({ name, movedTo: to, lost });
  } catch (err) {
    console.error("deleting a project failed:", err);
    res.status(500).json({ error: "could not move it to the trash: " + err.code });
  }
});

// ---------------------------------------------------------------------------
// Video
//
// The point of putting this here rather than leaving it to a browser tab on the
// provider's own site: the finished clip lands **in the project it is for**.
// A video generated somewhere else has to be found, downloaded, renamed and
// carried across, and that is the step where things end up in Downloads and
// never reach the app.
//
// So the owner's clips are written into the selected project — under `public/`
// when the project has one, since that is what a web app serves — and are in
// git with everything else. A partner's go to their mockups folder, which is
// the only place that seat can write.
// ---------------------------------------------------------------------------

/** Where a finished clip belongs. Never a path from the browser: the browser
 *  names a *project*, and this decides the directory. */
async function videoTarget(name) {
  if (isPartner) return { dir: path.join(MOCKUPS_DIR, "video"), label: "your mockups" };

  const dir = projectPath(String(name || ""));
  if (!dir) return { dir: path.join(process.env.AGENT_VIDEO_DIR || WORKSPACE, "clips"), label: "the video folder" };
  try {
    // A web project serves out of public/; anything else gets a folder of its
    // own at the top so it is obvious what it is.
    await stat(path.join(dir, "public"));
    return { dir: path.join(dir, "public", "ai"), label: name + "/public/ai" };
  } catch {
    return { dir: path.join(dir, "ai"), label: name + "/ai" };
  }
}

app.get("/api/video", async (_req, res) => {
  if (!canMakeVideo) return res.status(404).json({ error: "not this seat" });
  if (!video.configured()) {
    return res.json({
      configured: false,
      reason: "ARK_API_KEY and ARK_VIDEO_MODEL (an ep-m-\u2026 endpoint id) must both be set on this box",
    });
  }
  res.set("Cache-Control", "no-store");
  res.json({
    configured: true,
    model: video.model(),
    budget: await video.budget(),
    jobs: await video.list(),
  });
});

app.post("/api/video", async (req, res) => {
  if (!canMakeVideo) return res.status(404).json({ error: "not this seat" });
  if (!video.configured()) {
    return res.status(503).json({ error: "video is not configured on this box" });
  }

  const prompt = String(req.body?.prompt || "").trim();
  if (prompt.length < 4) return res.status(400).json({ error: "say what the shot is" });
  if (prompt.length > 2000) return res.status(400).json({ error: "that prompt is too long" });

  // Constrained here rather than trusted from the page: these end up in a
  // string sent to the provider, and an unexpected value there is somebody
  // else's parser deciding what to do with it.
  const RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"];
  const RESOLUTIONS = ["480p", "720p", "1080p"];
  const ratio = RATIOS.includes(req.body?.ratio) ? req.body.ratio : "9:16";
  const resolution = RESOLUTIONS.includes(req.body?.resolution) ? req.body.resolution : "720p";
  const seconds = Math.min(30, Math.max(4, Number(req.body?.seconds) || 5));
  const watermark = req.body?.watermark !== false;
  const firstFrame = /^https?:\/\//i.test(req.body?.firstFrame || "") ? req.body.firstFrame.trim() : "";

  const target = await videoTarget(req.body?.project);
  try {
    const job = await video.start({
      prompt, ratio, seconds, resolution, watermark, firstFrame,
      project: isPartner ? "" : String(req.body?.project || ""),
      saveTo: target.dir,
    });
    res.status(202).json({ job, where: target.label });
  } catch (err) {
    // Our own ceiling is 429, not 502. A bad gateway sends somebody to the
    // provider's status page for a decision this box made.
    if (err.overBudget) return res.status(429).json({ error: err.message });
    console.error("starting a generation failed:", err);
    res.status(502).json({ error: err.message || "could not start it" });
  }
});

app.get("/api/video/:id", async (req, res) => {
  if (!canMakeVideo) return res.status(404).json({ error: "not this seat" });
  const job = await video.poll(String(req.params.id));
  if (!job) return res.status(404).json({ error: "no such job" });
  res.set("Cache-Control", "no-store");
  res.json({ job });
});

// The clip itself, so it can be watched without leaving the seat. sendFile
// rather than a read: it handles range requests, and a <video> element that
// cannot seek is a video element people think is broken.
app.get("/api/video/:id/file", async (req, res) => {
  if (!canMakeVideo) return res.status(404).send("Not found");
  const job = await video.find(String(req.params.id));
  if (!job?.file) return res.status(404).send("Not found");

  // The path came from this server, but it has been through a JSON file since,
  // so it is checked against the roots this seat may serve from rather than
  // trusted for having been ours once.
  const roots = [WORKSPACE, MOCKUPS_DIR, process.env.AGENT_VIDEO_DIR || ""].filter(Boolean).map((r) => path.resolve(r));
  const file = path.resolve(job.file);
  if (!roots.some((r) => file === r || file.startsWith(r + path.sep))) {
    return res.status(404).send("Not found");
  }
  res.sendFile(file, { headers: { "Cache-Control": "no-store" } }, (err) => {
    if (err && !res.headersSent) res.status(404).send("Not found");
  });
});

// ---------------------------------------------------------------------------
// The reel
//
// The story desk over Study Pal's catalogue, done again for a project that has
// no catalogue — because microdrama does not have a backend, it has a folder.
//
// So the series is a file: `series.json` at the top of the project, next to the
// clips it refers to. That makes the whole thing portable in the way a database
// row is not — the folder holds the structure, the beats and the shots, and it
// goes into git with everything else.
//
// One series per project, deliberately. Study Pal's desk is a shelf because
// Study Pal publishes a catalogue; this is a workbench for the series being
// made. A second series is a second project, which is a directory, which is a
// button that already exists.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Social: who a project shares with, and what has gone to them
//
// Stored beside the code it belongs to, the same call as the reel's
// series.json — a project's relationships travel with the project, and there
// is no global list to keep in step with anything.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Where the file lives, and why it is not beside the code
//
// It was, and that was wrong twice over.
//
// A partner's snapshot is mounted read-only — that is the isolation control,
// not an inconvenience — so a file written into the project directory could
// not be written at all from the seat this panel was built for. It opened,
// looked correct, and failed on the first save.
//
// And the two seats do not agree on what the project is called. The owner has
// study-pal; the partner has the same product mounted as app. Keyed by
// directory they would keep two files about one product and each would look
// complete.
//
// So it lives in a volume both seats share, keyed by the app it is about
// rather than by the folder it is opened from — the host of the project's
// address, which is the one name both seats already agree on. A project with
// no address falls back to its directory name, which is exactly the case where
// there is no second seat to disagree with.
// ---------------------------------------------------------------------------
// What this seat is called on a shared file. The partner's own name where one
// is configured, since that is what the other person will be looking for;
// otherwise the role, which is at least true.
const SEAT_NAME = (PARTNER_NAME || (isPartner ? "Partner" : "Tom")).slice(0, 40);

const SOCIAL_DIR = process.env.AGENT_SOCIAL_DIR || "";
const SOCIAL_FILE = "social.json";

/** A filename that is the same on every seat looking at the same product. */
function socialKey(name) {
  const mapped = PROJECT_APPS.get(String(name || "")) || APP_URL || "";
  if (mapped) {
    try {
      // Host only: a trailing slash or a path would make one product look like
      // two, and a host cannot contain a path separator.
      const host = new URL(mapped).host.toLowerCase();
      if (/^[a-z0-9.:-]{1,80}$/.test(host)) return host;
    } catch { /* fall through to the directory name */ }
  }
  return okName(name) ? String(name) : "";
}

function socialPath(name) {
  if (SOCIAL_DIR) {
    const key = socialKey(name);
    return key ? path.join(SOCIAL_DIR, key + ".json") : null;
  }
  // No shared directory configured: the old behaviour, beside the project.
  // Kept so a deployment that has not added the volume still works, single-seat.
  const dir = projectPath(String(name || ""));
  return dir ? path.join(dir, SOCIAL_FILE) : null;
}

/** Arrivals per code, from the counter, or null when nothing measures them.
 *
 *  Null and zero are different answers and the page renders them differently.
 *  Today this is always null: Study Pal does not keep the ?via= code a visitor
 *  arrives with, so nothing on this box can know. See docs/for-studypal-via.md
 *  — when that lands, this starts returning figures and no page changes.
 *
 *  Open to every seat this panel is open to, rather than gated on the numbers
 *  grant like the dashboard is. This is a deliberate widening and it is a
 *  narrow one: a count of arrivals per share code, for the project already on
 *  screen. It is not the dashboard — /numbers/ and the masthead readout still
 *  check canSeeNumbers, so nothing else about how the product is doing comes
 *  with it.
 *
 *  The reason to widen it is that the figure is the point of the panel. Sent
 *  and passed-on say what you did; arrived is the only one that says whether it
 *  worked, and a collaborator panel that shows somebody their own effort and
 *  withholds the result is a worse tool than no panel.
 *
 *  Note what this does NOT do on its own. The credential is the other lock:
 *  compose passes AGENT_NUMBERS_URL to a partner only while
 *  TOMSCODING_PARTNER_NUMBERS is set, so a seat without that grant has no
 *  address to ask and this returns null however the check reads. That is the
 *  two-lock arrangement working as intended, and the page says which of the
 *  two silences it is looking at. */
async function arrivals() {
  if (!socialDoor() || !NUMBERS_URL) return null;
  try {
    const r = await fetch(NUMBERS_URL + "/api/stats?days=30", {
      headers: NUMBERS_TOKEN ? { authorization: "Bearer " + NUMBERS_TOKEN } : {},
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) throw new Error("counter said " + r.status);
    const d = await r.json();
    const vias = d.app?.vias;
    if (!Array.isArray(vias) || !vias.length) return null;
    return Object.fromEntries(vias.map((v) => [v.name, v.count]));
  } catch {
    // A counter having a bad minute is not a reason to fail the page. The
    // figures go missing for a moment, which is what missing figures look like.
    return null;
  }
}

/** Where a share can send somebody, for the page to offer as a list.
 *
 *  Typed into a box, this field was the least understood thing on the panel:
 *  it asks for a destination inside somebody else's app, and nothing on screen
 *  said which destinations exist. A list answers that by existing.
 *
 *  Two sources, both already reachable, both optional. Episodes come from the
 *  catalogue, which needs the story-desk grant — a seat without it gets the
 *  screens and no episodes rather than an error. Screens and features come from
 *  the counter, and are the app's own names for its parts because they are what
 *  it reports having been used.
 *
 *  Every one of them is a suggestion, never a constraint: the page keeps a way
 *  to type something not on the list, since a destination that exists and is
 *  not yet reported would otherwise be unreachable. */
async function destinations() {
  const out = { episodes: [], screens: [] };

  if (canWriteStories && studypal.configured()) {
    try {
      const r = await studypal.call("/api/series");
      // The payload's shape is the other side's to choose — take the array
      // wherever it is, the same reading the story desk already uses.
      const body = r.body;
      const list = Array.isArray(body) ? body
        : Array.isArray(body?.series) ? body.series
        : Array.isArray(body?.items) ? body.items : [];
      for (const series of list.slice(0, 20)) {
        const eps = Array.isArray(series?.episodes) ? series.episodes : [];
        for (const ep of eps.slice(0, 40)) {
          const n = Number(ep?.n);
          const title = String(ep?.title || "").trim();
          if (!Number.isFinite(n)) continue;
          out.episodes.push({
            // What goes in the link, and what a person reads. Kept apart: the
            // value has to survive a URL and the label has to be recognisable.
            value: "ep " + n,
            label: "Episode " + n + (title ? " · " + title : ""),
            series: String(series?.title || "").slice(0, 60),
          });
        }
      }
    } catch { /* no catalogue is a shorter list, not a failure */ }
  }

  if (NUMBERS_URL) {
    try {
      const r = await fetch(NUMBERS_URL + "/api/stats?days=30", {
        headers: NUMBERS_TOKEN ? { authorization: "Bearer " + NUMBERS_TOKEN } : {},
        signal: AbortSignal.timeout(4000),
      });
      if (r.ok) {
        const d = await r.json();
        const names = new Set();
        for (const row of [...(d.app?.screens || []), ...(d.app?.uses || [])]) {
          const name = String(row?.name || "").trim();
          if (name && name.length <= 40) names.add(name);
        }
        out.screens = [...names].slice(0, 24).map((name) => ({ value: name, label: name }));
      }
    } catch { /* same */ }
  }

  return out;
}

app.get("/api/social", async (req, res) => {
  if (!socialDoor()) return res.status(404).json({ error: "not this seat" });
  const file = socialPath(req.query.project);
  if (!file) return res.status(400).json({ error: "pick a project" });

  let stored = social.blank();
  try {
    stored = social.clean(JSON.parse(await readFile(file, "utf8")));
  } catch (err) {
    // A project with nothing yet is the ordinary case, not an error.
    if (err.code !== "ENOENT") {
      return res.status(500).json({ error: "could not read it: " + (err.code || err.message) });
    }
  }

  res.set("Cache-Control", "no-store");
  res.json({
    ...stored,
    file,
    // Where a share points people: the project's own address if one is mapped,
    // otherwise the seat default. A wrong host here is a link that silently
    // counts nothing, which is the failure that looks most like success.
    base: PROJECT_APPS.get(String(req.query.project || "")) || APP_URL || "",
    // Whether this seat can reach the counter at all. Not the same question as
    // "are there figures": one is a seat without the address, the other is a
    // product that is not recording. The page says which, because they are
    // opposite facts and would otherwise render identically.
    counter: Boolean(NUMBERS_URL),
    arrivals: await arrivals(),
    destinations: await destinations(),
    // Whether the project on screen is the one the Study Pal credentials point
    // at. The catalogue and the user list belong to that app and to no other,
    // and this panel follows whichever project is open — so without this,
    // opening it on a second project shows somebody else's series under that
    // project's name. Compared by host: the same app can be configured with or
    // without a trailing slash, and a string compare would call those two
    // different products.
    sameApp: (() => {
      const mapped = PROJECT_APPS.get(String(req.query.project || "")) || APP_URL || "";
      if (!mapped || !studypal.configured()) return false;
      try { return new URL(mapped).host === new URL(studypal.base()).host; }
      catch { return false; }
    })(),
  });
});

// ---------------------------------------------------------------------------
// The file itself
//
// A share is usually a thing rather than a sentence — a clip, a poster, a
// screenshot — and until now the panel could only name what kind of thing it
// was. Recording "Clip" beside a caption and keeping no clip is a filing
// cabinet with the documents left out.
//
// Stored in the same shared volume as the rest of Social, so both seats see
// one library, and served back through this server rather than from a public
// path: these are unreleased drafts as often as they are anything, and a
// guessable URL on the open internet is not where they belong.
//
// Bounded on purpose. Type is checked against a short list rather than trusted
// from the client, the extension is derived from that list rather than from
// the filename, and the id is generated here — three ways a filename could
// otherwise decide where a file lands.
// ---------------------------------------------------------------------------
const MEDIA_KINDS = new Map([
  ["image/jpeg", "jpg"], ["image/png", "png"], ["image/gif", "gif"],
  ["image/webp", "webp"], ["video/mp4", "mp4"], ["video/quicktime", "mov"],
  ["video/webm", "webm"],
]);
const MEDIA_MAX = 25 * 1024 * 1024;

const mediaDir = (name) => {
  const key = socialKey(name);
  return SOCIAL_DIR && key ? path.join(SOCIAL_DIR, "media", key) : null;
};

app.post("/api/social/media", express.json({ limit: "36mb" }), async (req, res) => {
  if (!socialDoor()) return res.status(404).json({ error: "not this seat" });
  const dir = mediaDir(req.query.project);
  if (!dir) {
    return res.status(400).json({
      error: SOCIAL_DIR ? "pick a project" : "no shared store on this box (AGENT_SOCIAL_DIR)",
    });
  }

  const type = String(req.body?.type || "");
  const ext = MEDIA_KINDS.get(type);
  if (!ext) {
    return res.status(415).json({
      error: "that file type is not accepted — images and mp4, mov or webm video",
    });
  }
  // Base64 with no data-URL prefix, the same shape /sp/cover takes.
  const raw = String(req.body?.data || "");
  if (!raw) return res.status(400).json({ error: "no file" });
  let buf;
  try { buf = Buffer.from(raw, "base64"); }
  catch { return res.status(400).json({ error: "could not read the file" }); }
  if (!buf.length) return res.status(400).json({ error: "the file is empty" });
  if (buf.length > MEDIA_MAX) {
    return res.status(413).json({ error: "too big — 25 MB is the limit" });
  }

  const id = randomUUID().replace(/-/g, "").slice(0, 20) + "." + ext;
  try {
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, id);
    await writeFile(file + ".tmp", buf);
    await rename(file + ".tmp", file);
    res.json({ id, type, bytes: buf.length });
  } catch (err) {
    res.status(500).json({ error: "could not store it: " + (err.code || err.message) });
  }
});

app.get("/api/social/media/:id", async (req, res) => {
  if (!socialDoor()) return res.status(404).send("Not found");
  const dir = mediaDir(req.query.project);
  // The id is generated here and is hex plus one extension, so anything else
  // is not one of ours — checked rather than joined and hoped for, since a
  // path separator in this position is how a media route becomes a file
  // browser.
  const id = String(req.params.id || "");
  if (!dir || !/^[a-f0-9]{20}\.[a-z0-9]{2,4}$/.test(id)) return res.status(404).send("Not found");
  const type = [...MEDIA_KINDS].find(([, e]) => id.endsWith("." + e))?.[0];
  res.sendFile(path.join(dir, id), {
    headers: {
      "Content-Type": type || "application/octet-stream",
      // Private: these are drafts, and a shared cache is not the place for them.
      "Cache-Control": "private, max-age=300",
      // The file is served from this origin and rendered in this page; nothing
      // here should ever be interpreted as a document.
      "X-Content-Type-Options": "nosniff",
    },
  }, (err) => { if (err && !res.headersSent) res.status(404).send("Not found"); });
});

app.put("/api/social", async (req, res) => {
  if (!socialDoor()) return res.status(404).json({ error: "not this seat" });
  const file = socialPath(req.query.project);
  if (!file) return res.status(400).json({ error: "pick a project" });

  const next = social.clean(req.body ?? {});

  // Who recorded each share.
  //
  // Taken from this seat rather than from the page, and only for shares that
  // are new: the page sends the whole list back on every save, so a seat that
  // could set this field freely could rewrite the history of who did what. So
  // an id already on disk keeps the name it was stored with, whatever arrives,
  // and anything new is stamped here.
  let already = new Map();
  try {
    const prior = social.clean(JSON.parse(await readFile(file, "utf8")));
    already = new Map(prior.posts.map((s) => [s.id, s.by]));
  } catch { /* nothing recorded yet */ }
  for (const s of next.posts) {
    s.by = already.has(s.id) ? (already.get(s.id) || "") : SEAT_NAME;
  }
  // Two people on one code means two links that cannot be told apart, which
  // makes every figure downstream wrong in a way nothing would report.
  const codes = new Set();
  for (const p of next.people) {
    if (codes.has(p.code)) {
      return res.status(400).json({ error: `two people share the code "${p.code}"` });
    }
    codes.add(p.code);
  }

  try {
    // The shared directory may not exist on the first write of a fresh volume.
    if (SOCIAL_DIR) await mkdir(SOCIAL_DIR, { recursive: true });
    // Written through a temporary file and renamed, so an interrupted save
    // leaves the previous version rather than half of this one.
    const tmp = file + ".tmp";
    await writeFile(tmp, JSON.stringify(next, null, 2) + "\n", "utf8");
    await rename(tmp, file);
    res.json({ ok: true, file, ...next });
  } catch (err) {
    res.status(500).json({ error: "could not save it: " + (err.code || err.message) });
  }
});

// ---------------------------------------------------------------------------
// The accounts a post is shared from
//
// Kept beside social.json in the same shared, app-keyed store, so both seats
// operating one product see one roster. Separate file rather than a field on
// social.json, because the two are written on different rhythms — a share is
// recorded many times a day, an account is added once — and a save of one
// should never be able to lose the other.
//
// See the note over cleanAccounts in lib/social.js for why a roster lives on
// this side at all while the app serves no user list.
// ---------------------------------------------------------------------------
function accountsPath(name) {
  if (SOCIAL_DIR) {
    const key = socialKey(name);
    return key ? path.join(SOCIAL_DIR, key + ".accounts.json") : null;
  }
  const dir = projectPath(String(name || ""));
  return dir ? path.join(dir, "social-accounts.json") : null;
}

app.get("/api/social/accounts", async (req, res) => {
  if (!socialDoor()) return res.status(404).json({ error: "not this seat" });
  const file = accountsPath(req.query.project);
  if (!file) return res.status(400).json({ error: "pick a project" });

  let stored = null;
  try {
    stored = social.cleanAccounts(JSON.parse(await readFile(file, "utf8")));
  } catch (err) {
    if (err.code !== "ENOENT") {
      return res.status(500).json({ error: "could not read it: " + (err.code || err.message) });
    }
  }
  // Nothing written yet: hand back the seed without saving it. The first edit
  // writes the file, so a box nobody has touched keeps no state, and a roster
  // somebody has emptied on purpose stays empty rather than refilling itself.
  const seeded = stored === null;
  if (seeded) stored = social.seedAccounts();

  res.set("Cache-Control", "no-store");
  res.json({ ...stored, file, seeded });
});

app.put("/api/social/accounts", async (req, res) => {
  if (!socialDoor()) return res.status(404).json({ error: "not this seat" });
  const file = accountsPath(req.query.project);
  if (!file) return res.status(400).json({ error: "pick a project" });

  const next = social.cleanAccounts(req.body ?? {});

  // Who wrote each one down, stamped here for the reason a post's `by` is
  // stamped: the page sends the whole roster back on every save, so an id
  // already on disk keeps what it was stored with, and only new rows take this
  // seat's name.
  let already = new Map();
  try {
    const prior = social.cleanAccounts(JSON.parse(await readFile(file, "utf8")));
    already = new Map(prior.accounts.map((a) => [a.id, a]));
  } catch { /* nothing written yet */ }
  for (const a of next.accounts) {
    const was = already.get(a.id);
    a.addedBy = was ? (was.addedBy || "") : SEAT_NAME;
    a.addedAt = was ? (was.addedAt || a.addedAt) : (a.addedAt || new Date().toISOString());
  }

  try {
    if (SOCIAL_DIR) await mkdir(SOCIAL_DIR, { recursive: true });
    const tmp = file + ".tmp";
    await writeFile(tmp, JSON.stringify(next, null, 2) + "\n", "utf8");
    await rename(tmp, file);
    res.json({ ok: true, file, ...next });
  } catch (err) {
    res.status(500).json({ error: "could not save it: " + (err.code || err.message) });
  }
});

// What the app reported, for the panel to render.
//
// Behind the sign-in gate, unlike the webhook that writes it: the hook is a
// server calling in with a secret, this is a person reading. Same file.
app.get("/api/social/feedback", async (_req, res) => {
  if (!socialDoor()) return res.status(404).json({ error: "not this seat" });
  const file = feedbackPath();
  // No shared store, or no app address to key it by: an empty list with the
  // reason, rather than an error. The panel works without this — it is the
  // app talking back, not the panel's own record.
  if (!file) return res.json({ reports: [], listening: false });

  let stored = { reports: [] };
  try {
    stored = social.cleanFeedback(JSON.parse(await readFile(file, "utf8")));
  } catch (err) {
    if (err.code !== "ENOENT") {
      return res.status(500).json({ error: "could not read it: " + (err.code || err.message) });
    }
  }
  res.set("Cache-Control", "no-store");
  // Whether the hook could accept a delivery at all. Nothing reported and
  // nothing listening are opposite facts and the page says which.
  res.json({ ...stored, listening: Boolean(HOOK_SECRET), file });
});

// Marking a held post as looked at.
//
// Ours to record and not the app's to know: this says a person here read it,
// which is exactly the thing the app asked for when it held the post. It does
// not change anything on that side — releasing a held post is Study Pal's
// call, made in Study Pal.
app.post("/api/social/feedback/reviewed", async (req, res) => {
  if (!socialDoor()) return res.status(404).json({ error: "not this seat" });
  const file = feedbackPath();
  if (!file) return res.status(503).json({ error: "no shared store on this box" });

  const id = String(req.body?.id || "");
  const on = req.body?.reviewed !== false;

  const run = hookQueue.then(async () => {
    let stored = { reports: [] };
    try {
      stored = social.cleanFeedback(JSON.parse(await readFile(file, "utf8")));
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
    if (!stored.reports.some((r) => r.id === id)) return null;
    const next = social.cleanFeedback({
      reports: stored.reports.map((r) => (r.id === id
        ? { ...r, reviewed: on, reviewedBy: on ? SEAT_NAME : "" }
        : r)),
    });
    await mkdir(SOCIAL_DIR, { recursive: true });
    const tmp = file + ".tmp";
    await writeFile(tmp, JSON.stringify(next, null, 2) + "\n", "utf8");
    await rename(tmp, file);
    return next;
  });
  hookQueue = run.catch(() => {});

  try {
    const next = await run;
    if (!next) return res.status(404).json({ error: "no such report" });
    res.json({ ok: true, ...next });
  } catch (err) {
    res.status(500).json({ error: "could not save it: " + (err.code || err.message) });
  }
});

const REEL_FILE = "series.json";

/** The empty twelve, in the shape Study Pal's own series actually use.
 *
 *  Not invented: this is the structure read back off the live catalogue — three
 *  episodes in act one, five in act two, four in act three, with these
 *  functions in this order. A romance pays off in act three, which is why it is
 *  3/5/4 and not an even split.
 *
 *  Kept on this side rather than in the page so a reel created by an agent and
 *  one created by a person come out the same. */
function blankReel() {
  const shape = [
    [1, "inciting incident"], [1, "debate"], [1, "act one turn"],
    [2, "rising"], [2, "pinch"], [2, "midpoint"], [2, "false victory"], [2, "all is lost"],
    [3, "dark night"], [3, "complication"], [3, "climax"], [3, "resolution"],
  ];
  return {
    title: "",
    premise: "",
    look: "",
    seconds: 10,
    episodes: shape.map(([act, fn], i) => ({
      n: i + 1, act, function: fn, title: "", beat: "", hook: "", clip: "", jobId: "",
    })),
  };
}

function reelPath(name) {
  const dir = projectPath(String(name || ""));
  return dir ? path.join(dir, REEL_FILE) : null;
}

app.get("/api/reel", async (req, res) => {
  if (!canMakeVideo) return res.status(404).json({ error: "not this seat" });
  const file = reelPath(req.query.project);
  if (!file) return res.status(400).json({ error: "pick a project" });
  try {
    const reel = JSON.parse(await readFile(file, "utf8"));
    res.set("Cache-Control", "no-store");
    res.json({ reel, file });
  } catch (err) {
    // A project with no series yet is the ordinary case, not an error: it gets
    // the empty twelve and writes the file on the first save.
    if (err.code === "ENOENT") return res.json({ reel: blankReel(), file });
    res.status(500).json({ error: "could not read it: " + (err.code || err.message) });
  }
});

app.put("/api/reel", async (req, res) => {
  if (!canMakeVideo) return res.status(404).json({ error: "not this seat" });
  const file = reelPath(req.body?.project);
  if (!file) return res.status(400).json({ error: "pick a project" });

  const sent = req.body?.reel;
  if (!sent || !Array.isArray(sent.episodes)) {
    return res.status(400).json({ error: "that is not a reel" });
  }
  // Rebuilt field by field rather than written as received. This file is read
  // back by this server and by whatever the project becomes, so it should hold
  // what it is meant to hold and not whatever a page happened to send.
  const reel = {
    title: String(sent.title || "").slice(0, 200),
    premise: String(sent.premise || "").slice(0, 4000),
    look: String(sent.look || "").slice(0, 2000),
    // How long each shot runs. On the series rather than the episode: a run
    // where one beat is five seconds and the next is fifteen reads as a
    // mistake, not a choice.
    seconds: Math.min(30, Math.max(4, Number(sent.seconds) || 5)),
    episodes: sent.episodes.slice(0, 60).map((e, i) => ({
      n: Number(e?.n) || i + 1,
      act: [1, 2, 3].includes(Number(e?.act)) ? Number(e.act) : 1,
      function: String(e?.function || "").slice(0, 60),
      title: String(e?.title || "").slice(0, 200),
      beat: String(e?.beat || "").slice(0, 4000),
      hook: String(e?.hook || "").slice(0, 400),
      clip: String(e?.clip || "").slice(0, 1000),
      // The job the clip came from. Kept because the file path alone cannot be
      // played back — the page streams a clip through /api/video/:id/file, so
      // without this a reloaded reel shows the path and no picture.
      jobId: String(e?.jobId || "").slice(0, 64),
    })),
    savedAt: new Date().toISOString(),
  };
  try {
    await writeFile(file, JSON.stringify(reel, null, 2) + "\n", "utf8");
    res.json({ ok: true, file, episodes: reel.episodes.length });
  } catch (err) {
    res.status(500).json({ error: "could not save it: " + (err.code || err.message) });
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
    // Whether to draw the door. The page is served on the same expression.
    video: videoDoor(),
    // Social. Same expression as the page and the routes, so a seat cannot end
    // up with a tab that opens onto a 404.
    social: socialDoor(),
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
// The owner always; a partner only while AGENT_NUMBERS is granted. See
// canSeeNumbers in lib/role.js — the token is not in that container unless the
// grant is on, so this check and the missing credential have to both fail
// before anything is served.
// ---------------------------------------------------------------------------
const NUMBERS_URL = process.env.AGENT_NUMBERS_URL || "";
const NUMBERS_TOKEN = process.env.AGENT_NUMBERS_TOKEN || "";
const NUMBERS_LINK = process.env.AGENT_NUMBERS_LINK || "";

app.get("/api/numbers", async (_req, res) => {
  if (!canSeeNumbers || !NUMBERS_URL) return res.status(404).json({ error: "not this seat" });
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
  if (!canSeeNumbers || !NUMBERS_URL) return res.status(404).send("Not found");
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

// ---------------------------------------------------------------------------
// The publish word
//
// A partner can write stories; publishing one puts it in front of readers, and
// that is a different act. So a seat that is not the owner's is asked for a
// word before anything reaches the live catalogue.
//
// Checked here and not in the page, and not in a prompt. A check in the browser
// is a check the browser can skip — the route is reachable with a fetch from
// the console — and a check in Sage's instructions is a check that can be
// argued with. This one is neither: no word, no call, whatever the page or the
// agent believes.
//
// What it is and is not, plainly. It stops an unconsidered or unilateral
// publish, which is the thing you actually worry about with a live catalogue
// and someone else's hands. It is not per-publish approval by the owner: it is
// a shared secret, so once the partner knows it they keep it. Real approval
// would mean the partner's publish landing in a queue for the owner to
// release, which is a different feature and a bigger one.
//
// Two write actions are gated, being the two that change what a reader sees on
// purpose: publishing a series, and deleting one. Saving a draft and uploading
// cover art are part of preparing a story, not shipping it, so they are not —
// asking for a word twelve times while somebody writes twelve beats would
// teach them to keep it in the clipboard, which is worse than not asking.
//
// Unset, nothing is asked and the desk behaves exactly as it did.
// ---------------------------------------------------------------------------
const PUBLISH_WORD = (process.env.AGENT_PUBLISH_WORD || "").trim();

const publishGate = (req, res, next) => {
  // The owner is not asked for a word before publishing his own catalogue.
  if (!isPartner) return next();
  if (!PUBLISH_WORD) return next();
  // A draft save comes through the same route as a publish. Only the publish
  // is gated, which is why this reads the body rather than the method.
  if (req.method === "PUT" && !req.body?.published) return next();

  const given = String(req.get("x-publish-word") || "");
  if (given && safeEqual(given, PUBLISH_WORD)) return next();

  // 401 with a flag the desk understands, so it can ask rather than showing
  // somebody a refusal they have no way to act on.
  return res.status(401).json({
    error: "This goes live to readers. Enter the publish word.",
    needWord: true,
  });
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

// The app's own users, for the admin to look up.
//
// Study Pal does not serve this yet — the endpoint is specified in
// docs/for-studypal-users.md and this is written to that shape. Until it
// exists the call comes back 404 and the panel says so plainly, which is a
// better answer than an empty list: nobody can tell an app with no users from
// an app that does not report them.
//
// Proxied like everything else on this side, so the admin key stays on the box
// and no user record passes through a browser that is not already signed in.
app.get("/sp/users", ownerOnly, async (req, res) => {
  const q = String(req.query.q || "").slice(0, 80);
  const path = "/api/users" + (q ? "?q=" + encodeURIComponent(q) : "");
  const r = await studypal.call(path);
  res.status(r.status).json(r.body);
});

app.get("/sp/usage", ownerOnly, async (_req, res) => {
  const r = await studypal.call("/api/usage?app=studypal");
  res.status(r.status).json(r.body);
});

app.put("/sp/series", ownerOnly, publishGate, async (req, res) => {
  const r = await studypal.call("/api/series", { method: "PUT", body: req.body ?? {} });
  res.status(r.status).json(r.body);
});

app.delete("/sp/series", ownerOnly, publishGate, async (req, res) => {
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

  // The figures, for any seat allowed them — the owner always, a partner while
  // the grant is on, a prospect never. Read per turn like the platform digest
  // above, and for the same reason: a number that was true when the container
  // started is not a number, and a conversation outlives a deploy.
  //
  // canSeeNumbers rather than !isPartner: this is the one thing on the seat
  // that a partner can be given deliberately, and gating it on being the owner
  // would hand Brendan a dashboard and a Sage who will not read it to him.
  const numbersBrief = canSeeNumbers ? await numbers.brief() : "";

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
          ? PARTNER_VOICE + numbersBrief
          : SAGE_VOICE + OWNER_CLEARANCE + platformBrief + numbersBrief,
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
