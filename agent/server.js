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
import { randomUUID, timingSafeEqual } from "node:crypto";
import { query } from "@anthropic-ai/claude-agent-sdk";

const PORT = process.env.PORT || 3000;
const WORKSPACE = process.env.AGENT_WORKSPACE || "/workspace";
const MODEL = process.env.AGENT_MODEL || undefined;
const USER = process.env.AGENT_USER || "tom";
const PASSWORD = process.env.AGENT_PASSWORD || "";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "ANTHROPIC_API_KEY is not set. The agent cannot run without it.\n" +
      "Add it to .env and run `make up` again."
  );
}

const app = express();

// Without a password this page would hand an agent — and the API key behind
// it — to anyone who found the hostname, which every issued certificate
// publishes. Refusing to serve is the safe failure; `make up` checks for the
// password too, so this should never be what you hit.
function safeEqual(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

app.use((req, res, next) => {
  if (req.path === "/healthz") return next();
  if (!PASSWORD) {
    return res.status(503).type("text/plain")
      .send("AGENT_PASSWORD is not set on the server. Refusing to serve.");
  }
  const header = req.headers.authorization || "";
  if (header.startsWith("Basic ")) {
    const [user, ...rest] = Buffer.from(header.slice(6), "base64")
      .toString("utf8").split(":");
    // Compare both halves every time; bailing early on a wrong username
    // would leak which half was wrong.
    const okUser = safeEqual(user || "", USER);
    const okPass = safeEqual(rest.join(":"), PASSWORD);
    if (okUser && okPass) return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="Tom\'s Coding", charset="UTF-8"');
  res.status(401).type("text/plain").send("Authentication required.");
});

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

app.get("/healthz", (_req, res) => res.json({ ok: true }));

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

  try {
    const options = {
      cwd: WORKSPACE,
      // Every tool runs without stopping to ask. The container is the
      // boundary: its own volume, no access to the host, nothing else's
      // files. See the README for what that does and does not cover.
      permissionMode: "bypassPermissions",
      ...(MODEL ? { model: MODEL } : {}),
      ...(isNewSession ? { sessionId: id } : { resume: id }),
    };

    for await (const message of query({ prompt, options })) {
      switch (message.type) {
        case "text":
          send("text", { text: message.text });
          break;
        case "tool_use":
          send("tool_use", { id: message.id, name: message.name, input: message.input });
          break;
        case "tool_result":
          send("tool_result", { toolUseId: message.tool_use_id, content: message.content });
          break;
        default:
          break; // other message types carry nothing this UI renders
      }
    }
    send("done", {});
  } catch (err) {
    console.error("agent turn failed:", err);
    // The browser shows this verbatim. A real error someone can read beats a
    // spinner that never resolves.
    send("error", { message: err?.message || String(err) });
  } finally {
    res.end();
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`agent listening on :${PORT}, workspace ${WORKSPACE}`);
});
