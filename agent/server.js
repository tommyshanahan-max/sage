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
import { query } from "@anthropic-ai/claude-agent-sdk";

const PORT = process.env.PORT || 3000;
const WORKSPACE = process.env.AGENT_WORKSPACE || "/workspace";
const MODEL = process.env.AGENT_MODEL || undefined;
const PASSWORD = process.env.AGENT_PASSWORD || "";

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
const KEY = createHash("sha256").update("sage-session:" + PASSWORD).digest();

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
  ${failed ? '<p class="bad">That password was not right.</p>'
           : "<p>Signed in for 30 days on this device.</p>"}
  <input type="password" name="password" autocomplete="current-password"
         placeholder="Password" autofocus required>
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
  if (safeEqual(String(req.body?.password ?? ""), PASSWORD)) {
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

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

app.post("/api/chat", async (req, res) => {
  const { prompt, sessionId } = req.body ?? {};
  if (typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "prompt is required" });
  }

  // A session id is minted on the first turn and echoed back to the browser,
  // which returns it on every later turn. That is what carries the
  // conversation forward — without it each message would start from nothing.
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

  send("session", { sessionId: id });

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

  try {
    const options = {
      cwd: WORKSPACE,
      // Appends to Claude Code's preset rather than replacing it: the preset
      // is what makes the tools work, and only the voice is ours.
      systemPrompt: { type: "preset", preset: "claude_code", append: SAGE_VOICE },
      // Every tool runs without stopping to ask, on the same files the editor
      // opens. Git is what protects them — see the README.
      //
      // bypassPermissions is refused unless allowDangerouslySkipPermissions is
      // set with it. Without the second flag the CLI exits before it does any
      // work, which surfaces as an exit code and nothing else.
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      stderr: (data) => {
        process.stderr.write(data);
        stderrTail.push(data);
        if (stderrTail.length > 40) stderrTail.shift();
      },
      ...(MODEL ? { model: MODEL } : {}),
      ...(isNewSession ? { sessionId: id } : { resume: id }),
    };

    // The SDK yields transcript messages, not rendered pieces: an assistant
    // turn arrives as one message whose `content` is a list of blocks, and
    // tool output comes back as a *user* message carrying tool_result blocks,
    // because that is how the conversation is recorded. The events this sends
    // on are the flat ones the page knows how to draw.
    for await (const message of query({ prompt, options })) {
      switch (message.type) {
        case "assistant":
          for (const block of message.message?.content ?? []) {
            if (block.type === "text") {
              send("text", { text: block.text });
            } else if (block.type === "tool_use") {
              send("tool_use", { id: block.id, name: block.name, input: block.input });
            }
          }
          break;
        case "user":
          for (const block of message.message?.content ?? []) {
            if (block.type === "tool_result") {
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
            send("error", { message: message.result || `run ended: ${message.subtype}` });
          }
          break;
        default:
          break; // other message types carry nothing this UI renders
      }
    }
    send("done", {});
  } catch (err) {
    console.error("agent turn failed:", err);
    // The browser shows this verbatim. A real error someone can read beats a
    // spinner that never resolves — and beats an exit code with no cause, so
    // whatever the CLI said on its way out goes with it.
    if (!reportedError) {
      const detail = stderrTail.join("").trim().split("\n").slice(-8).join("\n");
      const base = err?.message || String(err);
      send("error", { message: detail ? `${base}\n\n${detail}` : base });
    }
  } finally {
    res.end();
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`agent listening on :${PORT}, workspace ${WORKSPACE}`);
});
