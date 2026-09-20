/* A JOB IS ONE POST, AND IT REMEMBERS EVERY PLATFORM SEPARATELY.
 *
 * THE POINT OF THIS FILE IS THAT RUNNING `make post` TWICE DOES NOT POST
 * TWICE. So a job is not "done" or "not done" — it is a row per platform, each
 * with its own state, and a platform that has succeeded is never attempted
 * again, whatever happens to the others. The first shape of this had one status
 * on the job; the first half-failure showed why that is useless, because the
 * only safe thing to do with it is nothing.
 *
 * WHY THE FILE'S FINGERPRINT AND NOT ITS NAME. Tom records on a phone and the
 * file arrives as video.mp4 every time. Keyed by name, the second post of the
 * month would be refused as a duplicate of the first. Keyed by size and mtime
 * and the caption, two genuinely identical submissions are the same job and
 * two different videos are two jobs, which is the behaviour anybody would
 * expect from a thing that says it will not double-post.
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { change, load } from "./store.js";

/** Where each platform is posted from. The Chinese platforms have no API worth
 *  the name, so they are a browser being driven; the rest are HTTP.
 *
 *  `where` is deliberately data rather than a hard-coded machine: Tom wants
 *  everything on the box, and the browser half may have to move to his Mac if
 *  a platform starts challenging a Tokyo datacenter login. When it moves, this
 *  column changes and nothing else does. */
export const PLATFORMS = {
  youtube: { kind: "api", where: "box", lang: "en" },
  linkedin: { kind: "api", where: "box", lang: "en" },
  x: { kind: "api", where: "box", lang: "en" },
  tiktok: { kind: "api", where: "box", lang: "en" },
  instagram: { kind: "api", where: "box", lang: "en" },
  facebook: { kind: "api", where: "box", lang: "en" },
  douyin: { kind: "browser", where: "box", lang: "zh" },
  xiaohongshu: { kind: "browser", where: "box", lang: "zh" },
  channels: { kind: "browser", where: "box", lang: "zh" },
  gongzhonghao: { kind: "browser", where: "box", lang: "zh" },
  kuaishou: { kind: "browser", where: "box", lang: "zh" },
  bilibili: { kind: "browser", where: "box", lang: "zh" },
};

export const ALL = Object.keys(PLATFORMS);

/** Size, mtime and the captions. Not the bytes: a 300MB video hashed on every
 *  invocation would make the command feel broken, and the point here is only to
 *  tell one submission from another, not to prove a file is unaltered. */
export async function fingerprint(file, say, zh) {
  const st = await fs.stat(file);
  const h = createHash("sha256");
  h.update(path.basename(file));
  h.update(String(st.size));
  h.update(String(Math.floor(st.mtimeMs)));
  h.update(say || "");
  h.update(zh || "");
  return h.digest("hex").slice(0, 16);
}

/** The platforms this job should attempt, and the ones it should not, with a
 *  reason for every exclusion. Nothing is silently dropped: a platform left out
 *  prints a line saying why, because "it did not appear in the output" is the
 *  failure mode that loses a post for a week without anybody noticing. */
export function plan({ only, zh }) {
  const wanted = only && only.length ? only : ALL;
  const rows = {};
  for (const name of ALL) {
    const p = PLATFORMS[name];
    if (!wanted.includes(name)) {
      rows[name] = { state: "skipped", why: "why.onlyFilter" };
      continue;
    }
    /* NO MACHINE TRANSLATION. A Chinese platform with an English caption run
       through a translator reads as foreign, and that costs the audience the
       whole exercise is for. No Chinese caption means those platforms do not
       go out, and the command says so rather than posting something worse. */
    if (p.lang === "zh" && !zh) {
      rows[name] = { state: "skipped", why: "why.noZh" };
      continue;
    }
    rows[name] = { state: "queued" };
  }
  return rows;
}

export async function submit({ file, say, zh, only }) {
  const id = await fingerprint(file, say, zh);
  return change((d) => {
    const found = d.jobs.find((j) => j.id === id);
    if (found) {
      /* THE SAME SUBMISSION AGAIN IS NOT AN ERROR, and it is not a new job
         either. It is somebody re-running the command after a platform failed,
         which is exactly the case this tool exists to make safe: the platforms
         that succeeded keep their state, the ones that did not are tried
         again. */
      for (const [name, row] of Object.entries(plan({ only, zh }))) {
        const was = found.targets[name];
        if (was && (was.state === "done" || was.state === "posting")) continue;
        found.targets[name] = row;
      }
      found.seen = new Date().toISOString();
      return { id, job: found, repeat: true };
    }
    const job = {
      id,
      file,
      say: say || "",
      zh: zh || "",
      at: new Date().toISOString(),
      seen: new Date().toISOString(),
      targets: plan({ only, zh }),
    };
    d.jobs.push(job);
    return { id, job, repeat: false };
  });
}

/** One platform's row, moved. Every state change in the tool comes through
 *  here so there is one place to read when a job ends up somewhere odd. */
export function mark(id, platform, state, extra = {}) {
  return change((d) => {
    const job = d.jobs.find((j) => j.id === id);
    if (!job) return null;
    const row = job.targets[platform] || {};
    job.targets[platform] = { ...row, ...extra, state, at: new Date().toISOString() };
    return job.targets[platform];
  });
}

/** What a given machine still has to do. `where` is "box" or "mac"; the caller
 *  passes its own, so the same command works in both places. */
export async function waiting(where, kind) {
  const d = await load();
  const out = [];
  for (const job of d.jobs) {
    for (const [name, row] of Object.entries(job.targets)) {
      const p = PLATFORMS[name];
      if (!p || row.state !== "queued") continue;
      if (where && p.where !== where) continue;
      if (kind && p.kind !== kind) continue;
      out.push({ job, platform: name });
    }
  }
  return out;
}

export async function get(id) {
  const d = await load();
  return d.jobs.find((j) => j.id === id) || null;
}

export async function recent(n = 10) {
  const d = await load();
  return d.jobs.slice(-n).reverse();
}
