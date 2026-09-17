/* Shoot the episodes. Vertical, ninety seconds, nine shots cut together.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS AND WHY IT IS SEPARATE FROM THE APP. A demo with a play
 * button and no film is a slideshow with extra steps; the wall only lands if
 * there is something to be walled off from. But generation is slow, costs
 * money per second, and fails in ways a request cannot wait for — so it is a
 * command somebody runs deliberately, not something the console does when
 * nobody is looking at it.
 *
 * NINE SHOTS, NOT ONE CLIP. The first version shot one ten-second clip per
 * episode and called it ninety seconds of story. Tom watched episode 1, found
 * ten seconds of it, and asked for ten full episodes. A generator makes ten
 * seconds at a time, so an episode is `shots` — nine camera setups written in
 * the seed — shot one by one and joined with ffmpeg. An episode without
 * `shots` still gets its single `shot` or `beat`, as before.
 *
 * RESUMABLE BY CONTENT, NOT BY POSITION. Each shot's file is named after a
 * hash of its prompt, so a run that dies halfway picks up the shots that are
 * missing, and a shot whose words were changed is shot again while the rest
 * are kept. The joined episode is named after the hash of its parts for the
 * same reason: /v is cached for a week, and a new cut must be a new name.
 *
 * A STILL FOR EVERY EPISODE, FREE. One frame from the episode's own film is
 * its picture on every screen. Made from what is already on disk, so it costs
 * nothing and runs even without GO=1.
 *
 * SEEDANCE, through BytePlus ModelArk — the same provider agent/lib/video.js
 * uses and for the reason written there: the Chinese models are trained on
 * this exact format, vertical and close on faces, and cost a fraction per
 * second of the Western ones.
 *
 * NOT A COPY OF agent/lib/video.js. That file carries a budget, a job store
 * and a day counter, all of which belong to the agent's desk. This one has a
 * catalogue and a shot list. What is shared is the shape of the API, which is
 * ByteDance's rather than ours.
 *
 * THE SERVER HOLDS THE CATALOGUE IN MEMORY (lib/store.js), so what this
 * writes is not on screen until the container restarts. `make claire-video`
 * restarts it afterwards.
 *
 * COSTS MONEY. It refuses to shoot without --go, and it prints what it is
 * about to spend first.
 *
 *   make claire-video          says what it would shoot, makes stills
 *   make claire-video GO=1     shoots it
 * ---------------------------------------------------------------------------
 */
import { readFile, writeFile, rename, mkdir, access, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const STORE = process.env.CLAIRE_STORE || "/data/claire.json";
const OUT = process.env.CLAIRE_VIDEO_DIR || "/data/v";
const PARTS = OUT + "/parts";
const KEY = (process.env.ARK_API_KEY || "").trim();
const BASE = (process.env.ARK_BASE || "https://ark.ap-southeast.bytepluses.com").replace(/\/+$/, "");
const MODEL = (process.env.ARK_VIDEO_MODEL || "").trim();
const GO = process.argv.includes("--go");
const SECONDS = Number(process.env.CLAIRE_CLIP_SECONDS || 10);
/* Four at once. One at a time was three to seven hours for ninety shots; the
   account's concurrency limit is not written down anywhere we have found, and
   four is few enough that a refusal for it would be a surprise. */
const AT_ONCE = Math.max(1, Number(process.env.CLAIRE_SHOTS_AT_ONCE || 4));
/* THREE TRIES A SHOT. The "copyright restrictions" refusal is on the output,
   not the prompt, and it is not consistent: shots 2.1 and 2.3 came back on
   one run and were refused on the next with nothing changed but the cast.
   So a refusal is asked again rather than given up on. */
const TRIES = Math.max(1, Number(process.env.CLAIRE_SHOT_TRIES || 3));
/* GAPS=1 joins an episode that is one shot short. For a demo, an episode
   that skips one ten-second setup plays better than a ten-second clip; left
   off by default, because in a real release the gap is a jump nobody chose. */
const GAPS = process.argv.includes("--gaps");

/** The look, said once. Every prompt is this plus the cast plus the shot,
 *  because a series whose shots were each described from scratch looks like
 *  ninety series. */
const LOOK = [
  "Vertical 9:16 micro-drama, cinematic, shallow depth of field,",
  "warm practical lighting, close on faces, modern city wealth,",
  "restrained performances, no on-screen text, no subtitles, no logos.",
].join(" ");

const load = async () => JSON.parse(await readFile(STORE, "utf8"));
const exists = (f) => access(f).then(() => true, () => false);
const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 10);

/* Every write re-reads first. The catalogue can be changed by the console
   while a run is going, and a run that saved its own stale copy at the end
   would undo whatever the partner did in the meantime. */
let saving = Promise.resolve();
function patch(id, fields) {
  saving = saving.then(async () => {
    const b = await load();
    const row = b.episodes.find((x) => x.id === id);
    if (!row) return;
    Object.assign(row, fields);
    const tmp = STORE + ".tmp";
    await writeFile(tmp, JSON.stringify(b, null, 2));
    await rename(tmp, STORE);
  });
  return saving;
}

const ark = async (path, body) => {
  const r = await fetch(BASE + path, {
    method: body ? "POST" : "GET",
    headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  /* The upstream status and body verbatim, for the reason agent/lib/video.js
     gives: a shape mismatch has to be diagnosable from one attempt rather than
     folded into a friendly message and guessed at twice. */
  if (!r.ok) throw new Error(path + " -> " + r.status + "\n    " + text.slice(0, 500));
  return json;
};

async function shoot(prompt, file) {
  const task = await ark("/api/v3/contents/generations/tasks", {
    model: MODEL,
    content: [{ type: "text", text: prompt + " --ratio 9:16 --dur " + SECONDS }],
  });
  const id = task?.id || task?.data?.id;
  if (!id) throw new Error("no task id in: " + JSON.stringify(task).slice(0, 300));

  /* Tens of seconds to minutes, so this polls rather than waits on one
     request. Fifteen minutes is the give-up point: with four at once a task
     can sit queued behind its siblings, but not for longer than that. */
  let url = "";
  for (let i = 0; i < 180; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const got = await ark("/api/v3/contents/generations/tasks/" + id);
    const st = got?.status || got?.data?.status;
    if (st === "succeeded") { url = got?.content?.video_url || got?.data?.content?.video_url || ""; break; }
    if (st === "failed" || st === "cancelled") {
      const err = got?.error || got?.data?.error || {};
      throw new Error((err.code || "task " + st) + (err.message ? ": " + err.message.slice(0, 120) : ""));
    }
  }
  if (!url) throw new Error("timed out waiting for the render");

  /* Downloaded rather than linked: their URL expires, and a catalogue full
     of dead links is worse than one with no film in it. Written by rename so
     a half-downloaded file is never mistaken for a finished shot. */
  const res = await fetch(url);
  if (!res.ok) throw new Error("download -> " + res.status);
  await writeFile(file + ".tmp", Buffer.from(await res.arrayBuffer()));
  await rename(file + ".tmp", file);
}

/* Joined without re-encoding when the parts agree, which Seedance's always
   have (720x1280, h264, aac). Re-encoded when they do not, rather than
   producing a file that plays the first shot and then freezes. */
async function join(parts, file) {
  const list = file + ".txt";
  await writeFile(list, parts.map((p) => "file '" + p + "'").join("\n") + "\n");
  try {
    await run("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list,
      "-c", "copy", "-movflags", "+faststart", file]);
  } catch {
    await run("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-c:a", "aac",
      "-movflags", "+faststart", file]);
  } finally {
    await unlink(list).catch(() => {});
  }
}

/* Two seconds in: the first frame of a generated shot is often still
   resolving, and a still of a blur is worse than the coloured ground. */
async function still(video, file) {
  await run("ffmpeg", ["-y", "-v", "error", "-ss", "2", "-i", video,
    "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "4", file]);
}

const b = await load();
const series = b.series.find((s) => s.title === (process.argv[2] || "The Wife He Hired"))
  || b.series[0];
if (!series) { console.log("\n  No series in the catalogue. Run make claire-seed first.\n"); process.exit(0); }

/* The cast is described per person, and a shot carries only the people it
   names. One line describing everybody put the grandmother into diner shots,
   and a generic description of the man is the likeliest reason seven of nine
   shots with him in were refused as "copyright". A plain string still works. */
const castFor = (line) => {
  const c = series.cast;
  if (!c) return "";
  if (typeof c === "string") return c.trim();
  const low = " " + line.toLowerCase();
  const who = Object.entries(c).filter(([k]) => new RegExp("\\b" + k.toLowerCase() + "\\b").test(low)).map(([, v]) => v);
  return who.length ? "The people in this shot look like this: " + who.join("; ") + ". Nobody else appears." : "";
};
const cast = series.cast;
/* ONLY=2,5 shoots just those episodes — a test of a reworded episode should
   cost that episode, not the whole run. Joins and stills still cover all. */
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? new Set(onlyArg.slice(7).split(",").map(Number).filter(Boolean)) : null;
const eps = b.episodes.filter((e) => e.series === series.id).sort((a, c) => a.n - c.n);
await mkdir(PARTS, { recursive: true });

/* What each episode is made of, and what of it is already on disk. */
const plan = [];
for (const e of eps) {
  const lines = Array.isArray(e.shots) && e.shots.length
    ? e.shots
    : [(e.shot || e.beat || e.title) + (e.shot ? "" : " The shot ends on: " + (e.hook || e.title))];
  const shots = [];
  for (const [i, line] of lines.entries()) {
    const prompt = [LOOK, castFor(line), line].filter(Boolean).join(" ");
    const h = hash(prompt);
    const file = PARTS + "/" + series.id + "-" + String(e.n).padStart(2, "0") + "-" + (i + 1) + "-" + h + ".mp4";
    shots.push({ i: i + 1, prompt, h, file, have: await exists(file) });
  }
  const name = series.id + "-" + String(e.n).padStart(2, "0") + "-" + hash(shots.map((s) => s.h).join()) + ".mp4";
  plan.push({ e, shots, name, done: e.url === "/v/" + name });
}

const missing = plan.filter((p) => !ONLY || ONLY.has(p.e.n))
  .flatMap((p) => p.shots.filter((s) => !s.have).map((s) => ({ p, s })));
const scope = plan.filter((p) => !ONLY || ONLY.has(p.e.n));
const total = scope.reduce((n, p) => n + p.shots.length, 0);

console.log("");
console.log("  " + series.title);
console.log("  " + scope.length + " episodes · " + total + " shots · " + (total - missing.length)
  + " already shot · " + missing.length + " to shoot, " + SECONDS + "s each");
if (!cast) console.log("  (no cast line on the series — faces will drift from shot to shot)");
console.log("");

/* Stills first, from whatever film each episode already has: free, and the
   app's screens stop being empty grounds even before anything new is shot. */
async function stillFor(p) {
  const src = p.e.url && p.e.url.startsWith("/v/") ? OUT + "/" + p.e.url.slice(3) : "";
  if (!src || !(await exists(src))) return;
  const jpg = p.e.url.slice(3).replace(/\.mp4$/, ".jpg");
  if (p.e.poster === "/v/" + jpg && await exists(OUT + "/" + jpg)) return;
  try {
    await still(src, OUT + "/" + jpg);
    await patch(p.e.id, { poster: "/v/" + jpg });
    p.e.poster = "/v/" + jpg;
  } catch (err) {
    console.log("  still for " + p.e.n + " failed: " + String(err.message).split("\n")[0]);
  }
}
for (const p of plan) await stillFor(p);

if (!missing.length) console.log("  Every shot is on disk.");
else if (!KEY || !MODEL) {
  console.log("  ARK_API_KEY or ARK_VIDEO_MODEL is not set on this container.");
  console.log("  They are in .env as TOMSCODING_ARK_API_KEY and TOMSCODING_ARK_VIDEO_MODEL;");
  console.log("  the claire service has to be given them before this can run.\n");
  process.exit(1);
} else if (!GO) {
  for (const p of plan) {
    if (ONLY && !ONLY.has(p.e.n)) continue;
    const n = p.shots.filter((s) => !s.have).length;
    if (n) console.log("  " + String(p.e.n).padStart(2) + "  " + p.e.title + " — " + n + " of " + p.shots.length + " shots to go");
  }
  console.log("");
  console.log("  Nothing shot. " + missing.length + " shots × " + SECONDS + "s = "
    + missing.length * SECONDS + "s of generation.");
  console.log("  This spends real money — add GO=1 when you mean it.\n");
} else {
  /* Four workers over one queue. Each prints one line per shot as it lands,
     so a long run is readable in the log while it is still going. */
  const queue = [...missing];
  const refused = [];
  let shot = 0;
  await Promise.all(Array.from({ length: AT_ONCE }, async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const tag = "  " + String(job.p.e.n).padStart(2) + "." + job.s.i;
      let last = null;
      for (let t = 1; t <= TRIES && !job.s.have; t++) {
        try {
          await shoot(job.s.prompt, job.s.file);
          job.s.have = true; shot++;
          console.log(tag + "  shot" + (t > 1 ? " (try " + t + ")" : ""));
        } catch (err) {
          last = err;
          /* Only a refusal is worth asking again. A timeout or a bad key
             will fail the same way three times, at three times the cost. */
          if (!/PolicyViolation|SensitiveContent/.test(String(err.message))) break;
        }
      }
      if (!job.s.have) {
        refused.push(job);
        console.log(tag + "  failed — " + String(last?.message).split("\n")[0].slice(0, 120));
      }
    }
  }));
  console.log("");
  console.log("  " + shot + " of " + missing.length + " shots came back.");
  if (refused.length) {
    console.log("  Refused or failed — reword these in the seed, reseed, and run again:");
    for (const j of refused) console.log("    episode " + j.p.e.n + ", shot " + j.s.i);
  }
  console.log("");
}

/* Join every episode whose shots are all on disk and whose cut is not the one
   already published. An episode with a shot missing keeps the film it had —
   a partial cut would jump across the gap without saying so. */
let joined = 0;
const whole = [];
for (const p of plan) {
  const got = p.shots.filter((s) => s.have);
  if (got.length === p.shots.length || (GAPS && got.length >= p.shots.length - 1 && got.length > 1)) {
    const name = got.length === p.shots.length ? p.name
      : p.name.replace(/\.mp4$/, "-" + hash(got.map((s) => s.h).join()) + ".mp4");
    p.done = p.e.url === "/v/" + name;
    p.name = name;
    if (!p.done) {
      try {
        await join(got.map((s) => s.file), OUT + "/" + p.name);
        const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration",
          "-of", "csv=p=0", OUT + "/" + p.name]);
        await patch(p.e.id, { url: "/v/" + p.name, seconds: Math.round(Number(stdout) || 0) });
        p.e.url = "/v/" + p.name;
        joined++;
      } catch (err) {
        console.log("  joining episode " + p.e.n + " failed: " + String(err.message).split("\n")[0]);
        continue;
      }
    }
    whole.push(p.e.n);
    await stillFor(p);
  }
}
if (joined) console.log("  Joined " + joined + " episode" + (joined === 1 ? "" : "s") + ".");
console.log("  Full episodes: " + whole.length + " of " + eps.length
  + (whole.length ? " (" + whole.join(", ") + ")" : ""));
console.log("");
