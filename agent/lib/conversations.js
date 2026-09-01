// Past conversations: listing them, reading one back, and caching what is
// expensive to produce.
//
// Deliberately free of Express, of this app's UI, and of any framework. The
// only thing it knows is a store — four operations — so the same logic can sit
// behind a different one elsewhere. On this server that store is the transcript
// files Claude Code already writes; in a browser app it would be localStorage;
// in a hosted one, a table. The rules about what counts as a conversation, how
// a title is chosen and when an analysis is regenerated live here and are the
// part worth sharing.
//
//   list()                → newest first, cheap: never opens a whole transcript
//   get(id)               → the full conversation, as turns
//   readAnalysis(id)      → cached analysis, or null
//   writeAnalysis(id, x)  → cache one
//
// Storage adapters implement those. This module implements everything above
// them.

import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { open } from "node:fs/promises";
import path from "node:path";

// ---------------------------------------------------------------------------
// Reading transcripts
// ---------------------------------------------------------------------------

// A transcript is one JSON object per line. Several kinds of line are not
// conversation at all — queue bookkeeping, mode changes, attachments — and two
// kinds masquerade as it:
//
//   * tool results arrive as `user` records, because that is how the model is
//     shown them. They have no promptSource and their content is a list of
//     tool_result blocks. Counting them as things the person said would put
//     "[tool output]" at the top of the list.
//   * subagent traffic is marked isSidechain. It belongs to a turn, not to the
//     conversation.
//
// Both are excluded everywhere below.
const isHumanTurn = (rec) => {
  if (rec?.type !== "user" || rec.isSidechain) return false;
  const content = rec.message?.content;
  if (typeof content === "string") return content.trim().length > 0;
  if (!Array.isArray(content)) return false;
  return content.some((b) => b?.type === "text" && String(b.text || "").trim());
};

const isAssistantTurn = (rec) => rec?.type === "assistant" && !rec.isSidechain;

/** The readable text of a turn, with tool traffic left out. */
const textOf = (rec) => {
  const content = rec?.message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b?.type === "text")
    .map((b) => b.text || "")
    .join("")
    .trim();
};

const parseLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    // A transcript being appended to can end mid-line. Skipping is right;
    // failing the whole listing over one torn line is not.
    return null;
  }
};

/**
 * Reads the last `bytes` of a file and returns whole lines from it.
 *
 * Transcripts reach tens of megabytes, and a listing that read each one end to
 * end would take seconds and grow worse with use. Everything the list needs —
 * the current title, when it was last touched — is near the end, so only the
 * end is read. The first partial line is dropped because it is a fragment.
 */
async function readTail(file, bytes = 64 * 1024) {
  const handle = await open(file, "r");
  try {
    const { size } = await handle.stat();
    const start = Math.max(0, size - bytes);
    const buf = Buffer.alloc(Math.min(bytes, size));
    await handle.read(buf, 0, buf.length, start);
    const lines = buf.toString("utf8").split("\n");
    if (start > 0) lines.shift();
    return lines;
  } finally {
    await handle.close();
  }
}

/** Reads whole lines from the start of a file, stopping once it has enough. */
async function readHead(file, bytes = 256 * 1024) {
  const handle = await open(file, "r");
  try {
    const { size } = await handle.stat();
    const buf = Buffer.alloc(Math.min(bytes, size));
    await handle.read(buf, 0, buf.length, 0);
    const lines = buf.toString("utf8").split("\n");
    // The last line may be cut off unless we read the whole file.
    if (size > buf.length) lines.pop();
    return lines;
  } finally {
    await handle.close();
  }
}

const firstSentence = (text, max = 90) => {
  const flat = String(text).replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return flat.slice(0, max - 1).trimEnd() + "…";
};

// ---------------------------------------------------------------------------
// The file store
// ---------------------------------------------------------------------------

/**
 * Claude Code writes one transcript per session, into a directory named after
 * the working directory with every separator replaced by a dash. Nothing here
 * writes those files — they are a record this app reads, which is why history
 * exists for conversations that happened before this feature did.
 */
export function encodeProjectDir(cwd) {
  return String(cwd).replace(/\//g, "-");
}

export function createFileStore({ home, cwd }) {
  const projectDir = path.join(home, ".claude", "projects", encodeProjectDir(cwd));
  // Analyses are ours, not Claude Code's, so they live beside the transcripts
  // rather than among them — nothing else writes or reads this directory.
  const analysisDir = path.join(home, ".claude", "sage-analysis", encodeProjectDir(cwd));

  const transcriptPath = (id) => path.join(projectDir, `${id}.jsonl`);

  // Ids come in over HTTP and are used to build a path. Session ids are uuids;
  // anything else is refused rather than sanitised, because a "cleaned" id that
  // still resolves somewhere is worse than a rejected one.
  const isSessionId = (id) =>
    typeof id === "string" && /^[0-9a-fA-F-]{36}$/.test(id);

  return {
    isSessionId,

    async list() {
      let names;
      try {
        names = await readdir(projectDir);
      } catch {
        // No transcripts yet — an empty history, not an error.
        return [];
      }

      const ids = names
        .filter((n) => n.endsWith(".jsonl"))
        .map((n) => n.slice(0, -".jsonl".length))
        .filter(isSessionId);

      const entries = await Promise.all(
        ids.map(async (id) => {
          const file = transcriptPath(id);
          try {
            const info = await stat(file);
            if (info.size === 0) return null;

            // Title and recency from the end; the opening line from the start.
            const [tail, head] = await Promise.all([readTail(file), readHead(file)]);

            let title = null;
            let lastAt = null;
            for (const line of tail) {
              const rec = parseLine(line);
              if (!rec) continue;
              // The most recent title wins — it can be set more than once.
              if (rec.type === "custom-title" && rec.customTitle) title = rec.customTitle;
              if (rec.timestamp) lastAt = rec.timestamp;
            }

            let opening = null;
            let startedAt = null;
            for (const line of head) {
              const rec = parseLine(line);
              if (!rec) continue;
              if (!startedAt && rec.timestamp) startedAt = rec.timestamp;
              if (!opening && isHumanTurn(rec)) opening = firstSentence(textOf(rec));
              if (opening && startedAt) break;
            }

            // A conversation nobody spoke in is a session that failed to start.
            // Listing it offers a door onto nothing.
            if (!opening) return null;

            return {
              id,
              title: title || opening,
              // Kept separate even when the title came from it, so a caller can
              // show both without having to guess whether they differ.
              opening,
              startedAt,
              updatedAt: lastAt || info.mtime.toISOString(),
              bytes: info.size,
            };
          } catch {
            return null;
          }
        })
      );

      return entries
        .filter(Boolean)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    },

    async get(id) {
      if (!isSessionId(id)) return null;
      let raw;
      try {
        raw = await readFile(transcriptPath(id), "utf8");
      } catch {
        return null;
      }

      const turns = [];
      for (const line of raw.split("\n")) {
        const rec = parseLine(line);
        if (!rec) continue;
        if (isHumanTurn(rec)) {
          turns.push({ role: "user", text: textOf(rec), at: rec.timestamp });
        } else if (isAssistantTurn(rec)) {
          const text = textOf(rec);
          // An assistant record carrying only tool calls has no text. It is
          // part of the work, not part of the reading.
          if (text) turns.push({ role: "assistant", text, at: rec.timestamp });
        }
      }
      return turns.length ? { id, turns } : null;
    },

    async readAnalysis(id) {
      if (!isSessionId(id)) return null;
      try {
        return JSON.parse(await readFile(path.join(analysisDir, `${id}.json`), "utf8"));
      } catch {
        return null;
      }
    },

    async writeAnalysis(id, analysis) {
      if (!isSessionId(id)) return;
      await mkdir(analysisDir, { recursive: true });
      await writeFile(
        path.join(analysisDir, `${id}.json`),
        JSON.stringify({ ...analysis, generatedAt: new Date().toISOString() }, null, 2)
      );
    },
  };
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

// Four sections, because an unstructured paragraph gets skimmed and a
// twelve-point breakdown does not get read at all.
//
// The headings are this workspace's, not a port of another app's: what was
// done, what is still open, and what someone coming back cold would need. An
// analysis that names loose ends is worth reading; one that recaps the
// conversation is not, since the conversation is right there.
export const ANALYSIS_SECTIONS = ["summary", "changed", "open", "worthNoting"];

export const ANALYSIS_PROMPT = `You are summarising a past working session for the person who had it, so they can pick it back up later.

Reply with JSON only — no prose around it, no markdown fence — with exactly these keys:

{
  "summary": "2-3 sentences: what this session was about and where it got to.",
  "changed": "What actually changed — files, commands run, decisions made. Concrete. If nothing changed, say so.",
  "open": "What was left unfinished or unresolved, and what the next step would be. If nothing, say so plainly.",
  "worthNoting": "One thing worth remembering: a gotcha hit, a wrong turn taken, a constraint discovered. Skip the obvious."
}

Be specific and plain. Name files and commands where they matter. Do not pad, do not repeat the conversation back, and do not invent anything that is not in it.`;

/** Pulls the JSON object out of a model reply that may be fenced or padded. */
export function parseAnalysis(raw) {
  const cleaned = String(raw)
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Some replies carry a sentence before the object. Take the outermost
    // braces rather than giving up on an answer that is present but wrapped.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  // Every section must be a real string. A partial object rendered as a card
  // with blank rows looks like the feature is broken.
  for (const key of ANALYSIS_SECTIONS) {
    if (typeof parsed[key] !== "string" || !parsed[key].trim()) return null;
  }
  return Object.fromEntries(ANALYSIS_SECTIONS.map((k) => [k, parsed[k].trim()]));
}

/** A transcript flattened into something short enough to analyse. */
export function transcriptForAnalysis(turns, maxChars = 60000) {
  const lines = turns.map((t) => `${t.role === "user" ? "Person" : "Sage"}: ${t.text}`);
  const joined = lines.join("\n\n");
  if (joined.length <= maxChars) return joined;
  // Keep the start and the end: the beginning says what this was for, the end
  // says where it got to. The middle is the part a summary can afford to lose.
  const half = Math.floor(maxChars / 2);
  return (
    joined.slice(0, half) +
    "\n\n[…middle of the conversation omitted for length…]\n\n" +
    joined.slice(-half)
  );
}

/** A stable fingerprint of a conversation, so a cached analysis can be known
 *  to be stale when the conversation has moved on since. */
export function fingerprint(turns) {
  const h = createHash("sha256");
  h.update(String(turns.length));
  for (const t of turns) h.update(t.role).update(t.text);
  return h.digest("hex").slice(0, 16);
}
