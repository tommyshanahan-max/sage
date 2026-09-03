// Video generation, through ByteDance's Seedance on BytePlus ModelArk.
//
// Why this provider: the Chinese models are trained on the format this is for —
// vertical, fast-cut, close on faces — and cost a fraction of the Western ones
// per second. BytePlus is ByteDance's international arm, so an account and an
// ordinary card are enough; the mainland console (Volcengine) wants a Chinese
// entity and real-name verification.
//
// ---------------------------------------------------------------------------
// A warning about the shape below
//
// docs.byteplus.com is unreachable from the machine this was written on, so the
// request and response shapes here are assembled from secondary sources rather
// than read off the official reference. They are believed right, and they are
// the shape every third-party wrapper agrees on — but "believed right" is not
// "verified", so:
//
//   * the base URL, the model id and the path are all configuration, not
//     constants, and a change on their side is a line in .env rather than a
//     deploy of this file
//   * failures surface the upstream status and body verbatim instead of being
//     folded into a friendly message, so a shape mismatch is diagnosable from
//     one attempt rather than being silently wrong
//
// The first real call is the test. Nothing here pretends otherwise.
// ---------------------------------------------------------------------------
//
// The API is asynchronous, which shapes everything: you post a task, get an id,
// and poll. A generation takes tens of seconds to minutes, so nothing here can
// be a single request/response — and the finished video sits behind a URL on
// their side that expires, which is why it is downloaded rather than linked.

import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

// Trimmed. A .env line with a trailing space is a key that passes a truthiness
// check, draws the button, and fails every call — the door opens onto an error,
// which is worse than the door not being there.
const KEY = (process.env.ARK_API_KEY || "").trim();
// ap-southeast is BytePlus's international region. The mainland equivalent is
// https://ark.cn-beijing.volces.com — same paths, different account system.
const BASE = (process.env.ARK_BASE || "https://ark.ap-southeast.bytepluses.com").replace(/\/+$/, "");
const MODEL = process.env.ARK_VIDEO_MODEL || "seedance-1-0-lite-t2v-250428";

/** Where job records and the day's counter live. Not the videos themselves —
 *  those go into the project they belong to, which is the whole point. */
const STATE_DIR = process.env.AGENT_VIDEO_DIR || "";

export const configured = () => Boolean(KEY && STATE_DIR);
export const model = () => MODEL;

// A ceiling, per day, per seat. Video generation is the one thing here that
// costs real money per press — a loop that retries on failure could spend a
// week's budget before anyone looked at it. Counted rather than priced, because
// a count is a number somebody can reason about without a rate card.
const DAILY = Number(process.env.AGENT_VIDEO_DAILY_LIMIT || 20);

const today = () => new Date().toISOString().slice(0, 10);
const jobsFile = () => path.join(STATE_DIR, "jobs.json");

async function readJobs() {
  try {
    const raw = JSON.parse(await readFile(jobsFile(), "utf8"));
    return Array.isArray(raw.jobs) ? raw : { jobs: [], spent: {} };
  } catch {
    return { jobs: [], spent: {} };
  }
}

async function writeJobs(state) {
  await mkdir(STATE_DIR, { recursive: true });
  // Trimmed rather than grown forever: this is a working record, not an
  // archive, and the videos themselves are the thing worth keeping.
  state.jobs = state.jobs.slice(-200);
  await writeFile(jobsFile(), JSON.stringify(state, null, 1), "utf8");
}

/** How many are left today. Exposed so the page can say so before somebody
 *  writes a prompt they cannot run. */
export async function budget() {
  const state = await readJobs();
  const used = state.spent?.[today()] || 0;
  return { used, limit: DAILY, left: Math.max(0, DAILY - used) };
}

// ---------------------------------------------------------------------------
// Talking to Ark
// ---------------------------------------------------------------------------

async function ark(pathname, init = {}) {
  const res = await fetch(BASE + pathname, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + KEY,
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(init.timeoutMs || 30_000),
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* keep the text */ }
  if (!res.ok) {
    // Verbatim on purpose. A wrong model id and an expired key fail the same
    // way through a friendly message, and differently through this one.
    const why = body?.error?.message || body?.message || text.slice(0, 400) || res.statusText;
    const err = new Error(`Ark ${res.status}: ${why}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

/** The flags Seedance takes on the end of the prompt text rather than as JSON
 *  fields. Kept in one place so the page never builds this string itself. */
function flags({ ratio, seconds, resolution, watermark }) {
  const out = [];
  if (ratio) out.push("--ratio " + ratio);
  if (seconds) out.push("--dur " + seconds);
  if (resolution) out.push("--resolution " + resolution);
  // Explicit either way. China's labelling rules require generated video shown
  // there to carry a visible mark as well as embedded metadata, so leaving this
  // to a provider default is not a decision anyone should make by omission.
  out.push("--watermark " + (watermark ? "true" : "false"));
  return out.join(" ");
}

/**
 * Starts a generation. Returns the local job record, not the video — the video
 * does not exist yet and will not for a minute or more.
 *
 * `firstFrame` is an image URL used as the opening frame, which is how a
 * character stays the same person across shots: generate the face once, then
 * every clip starts from it. Prompt-only consistency drifts by episode three.
 */
export async function start({ prompt, ratio, seconds, resolution, watermark, firstFrame, project, saveTo }) {
  if (!configured()) throw new Error("ARK_API_KEY is not set on this box");

  const state = await readJobs();
  const day = today();
  const used = state.spent?.[day] || 0;
  if (used >= DAILY) {
    // Flagged, because the route has to answer this differently from an
    // upstream failure. Both are "it did not run", and only one of them is
    // worth anybody looking at a provider status page for.
    const err = new Error(`That is ${DAILY} clips today, which is the limit. It resets at midnight UTC.`);
    err.overBudget = true;
    throw err;
  }

  const text = [String(prompt || "").trim(), flags({ ratio, seconds, resolution, watermark })]
    .filter(Boolean)
    .join(" ");

  const content = [{ type: "text", text }];
  if (firstFrame) {
    content.push({ type: "image_url", image_url: { url: firstFrame }, role: "first_frame" });
  }

  const created = await ark("/api/v3/contents/generations/tasks", {
    method: "POST",
    body: JSON.stringify({ model: MODEL, content }),
  });

  const taskId = created?.id || created?.task_id;
  if (!taskId) throw new Error("Ark accepted the request but returned no task id");

  const job = {
    id: randomUUID(),
    taskId,
    model: MODEL,
    prompt: String(prompt || "").trim(),
    ratio, seconds, resolution,
    watermark: Boolean(watermark),
    firstFrame: firstFrame || "",
    project: project || "",
    saveTo: saveTo || "",
    status: "running",
    file: "",
    error: "",
    startedAt: new Date().toISOString(),
    finishedAt: "",
  };

  state.jobs.push(job);
  state.spent = { ...(state.spent || {}), [day]: used + 1 };
  await writeJobs(state);
  return job;
}

/** Asks Ark where a job got to, and on success downloads the video into the
 *  place the job named. Idempotent: a finished job is returned from the record
 *  without another upstream call, so polling is cheap and a page left open
 *  overnight does not hammer them. */
export async function poll(id) {
  const state = await readJobs();
  const job = state.jobs.find((j) => j.id === id);
  if (!job) return null;
  if (job.status === "done" || job.status === "failed") return job;

  let task;
  try {
    task = await ark("/api/v3/contents/generations/tasks/" + encodeURIComponent(job.taskId));
  } catch (err) {
    // A bad minute upstream is not a failed job. Only a definite answer from
    // them ends one; anything else leaves it running to be asked again.
    job.error = err.message;
    await writeJobs(state);
    return job;
  }

  const status = String(task?.status || "").toLowerCase();
  if (status === "succeeded" || status === "success") {
    const url = task?.content?.video_url || task?.video_url || task?.content?.url || "";
    if (!url) {
      job.status = "failed";
      job.error = "finished with no video url in the reply";
    } else {
      try {
        job.file = await download(url, job);
        job.status = "done";
        job.error = "";
      } catch (err) {
        job.status = "failed";
        job.error = "could not save it: " + err.message;
      }
    }
    job.finishedAt = new Date().toISOString();
  } else if (status === "failed" || status === "cancelled" || status === "canceled") {
    job.status = "failed";
    job.error = task?.error?.message || task?.error || "the provider reported a failure";
    job.finishedAt = new Date().toISOString();
  } else {
    job.status = "running";
    if (Number.isFinite(task?.progress)) job.progress = task.progress;
    job.error = "";
  }

  await writeJobs(state);
  return job;
}

/** Saves the finished video where the job said, and returns the absolute path.
 *
 *  Downloaded rather than linked because their URL expires — a page that links
 *  to it works this afternoon and is a dead embed next week, which is the worst
 *  kind of broken because nobody notices for a month. */
async function download(url, job) {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error("download returned " + res.status);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!bytes.length) throw new Error("the download was empty");

  await mkdir(job.saveTo, { recursive: true });
  const name = fileName(job);
  const file = path.join(job.saveTo, name);
  await writeFile(file, bytes);
  return file;
}

/** A name that says what it is. A folder of clip1.mp4 to clip40.mp4 is a folder
 *  nobody can work in. */
function fileName(job) {
  const slug = job.prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "clip";
  const stamp = job.startedAt.slice(0, 19).replace(/[:T]/g, "-");
  return `${stamp}-${slug}.mp4`;
}

/** The recent jobs, newest first, with the sizes of any that landed. */
export async function list(limit = 40) {
  const state = await readJobs();
  const out = [];
  for (const job of state.jobs.slice(-limit).reverse()) {
    let bytes = 0;
    if (job.file) {
      try { bytes = (await stat(job.file)).size; } catch { /* moved or deleted */ }
    }
    out.push({ ...job, bytes });
  }
  return out;
}

export async function find(id) {
  const state = await readJobs();
  return state.jobs.find((j) => j.id === id) || null;
}

/** A stable short id for a file path, so the preview route names a job rather
 *  than taking a path from the browser. */
export const fileKey = (p) => createHash("sha256").update(p).digest("hex").slice(0, 16);
