// What changed on the platform, so Sage knows.
//
// The agent container mounts the workspace volume — your projects — and
// nothing else. The platform's own repository is not in it, which is why Sage
// had no way to answer "what did we change yesterday" and no way to know a
// deploy had happened at all: from inside the container a deploy looks like
// the process starting, with no account of what moved.
//
// Bind-mounting the repository would fix that and cost too much: `.env` sits
// in it, holding every secret on the box. So `make up` writes a digest —
// commit subjects, dates, changed paths, nothing sensitive — and compose
// mounts only the directory that digest is in, read-only. See
// scripts/whats-new.sh.
//
// Unset AGENT_PLATFORM_DIR and every function here returns empty, which is
// exactly how the agent behaved before this existed.

import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const DIR = process.env.AGENT_PLATFORM_DIR || "";
const FILE = DIR ? path.join(DIR, "changes.json") : "";

// The file changes on a deploy and not otherwise, so re-reading it per request
// is pointless. Keyed on mtime rather than a clock: `make up` while the
// container stays running is a real case, and a timer would show the old list
// for however long was left on it.
let cache = { mtime: 0, state: null };

const isCommit = (c) =>
  c &&
  typeof c === "object" &&
  typeof c.short === "string" &&
  typeof c.subject === "string" &&
  typeof c.date === "string";

/** The digest, or null. Never throws: a missing or malformed file means the
 *  agent says nothing about the platform, which is a smaller failure than a
 *  seat that will not start. */
export async function read() {
  if (!FILE) return null;
  try {
    const info = await stat(FILE);
    const mtime = info.mtimeMs;
    if (cache.state && cache.mtime === mtime) return cache.state;

    const raw = JSON.parse(await readFile(FILE, "utf8"));
    if (!raw || typeof raw !== "object") return null;
    const commits = Array.isArray(raw.commits) ? raw.commits.filter(isCommit) : [];
    const state = {
      deployedAt: typeof raw.deployedAt === "string" ? raw.deployedAt : "",
      branch: typeof raw.branch === "string" ? raw.branch : "",
      head: typeof raw.head === "string" ? raw.head : "",
      headShort: typeof raw.headShort === "string" ? raw.headShort : "",
      dirty: Boolean(raw.dirty),
      commits,
    };
    cache = { mtime, state };
    return state;
  } catch {
    return null;
  }
}

/** For the page: the head, the deploy time, and enough of each commit to list.
 *  The full file is not sent — the browser has no use for forty file paths. */
export async function summary(limit = 12) {
  const state = await read();
  if (!state || !state.commits.length) return null;
  return {
    deployedAt: state.deployedAt,
    branch: state.branch,
    head: state.headShort,
    dirty: state.dirty,
    commits: state.commits.slice(0, limit).map((c) => ({
      short: c.short,
      date: c.date,
      subject: c.subject,
      files: Array.isArray(c.files) ? c.files.slice(0, 6) : [],
      fileCount: Number.isFinite(c.fileCount) ? c.fileCount : 0,
    })),
  };
}

const day = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 10);
};

/** The block appended to the system prompt.
 *
 *  Deliberately short. This is context the agent should have to hand, not a
 *  document it should recite — a long changelog in a system prompt turns every
 *  greeting into a release note. Twelve commits is about a week here.
 */
export async function brief(limit = 12) {
  const state = await read();
  if (!state || !state.commits.length) return "";

  const lines = state.commits.slice(0, limit).map((c) => {
    const files = Array.isArray(c.files) ? c.files : [];
    const shown = files.slice(0, 4).join(", ");
    const more = c.fileCount > 4 ? ` +${c.fileCount - 4} more` : "";
    const where = shown ? ` — ${shown}${more}` : "";
    return `- ${day(c.date)} ${c.short} ${c.subject}${where}`;
  });

  return `

# The platform you are running on

You are one service in a Docker Compose deployment called Tom's Coding, on a
single VPS. This is its recent history, as of the last deploy${
    state.deployedAt ? ` (${state.deployedAt})` : ""
  }${state.branch ? `, branch ${state.branch}` : ""}:

${lines.join("\n")}

Two things to know about that list. It is the platform's own repository, not
the projects in your workspace — those have their own git history you can read
directly. And it is stamped at deploy time, so if the person tells you
something was committed since, believe them: you have no way to see it.

Use it the way you would use knowing what someone did yesterday. If a question
is about something in that list, you already know roughly what changed and
where. Do not recite it, do not open a conversation with it, and do not
mention a commit unless it bears on what was asked.`;
}
