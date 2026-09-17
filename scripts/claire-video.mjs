/* Shoot the episodes. Vertical, ninety seconds of story in ten of footage.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS AND WHY IT IS SEPARATE FROM THE APP. A demo with a play
 * button and no film is a slideshow with extra steps; the wall only lands if
 * there is something to be walled off from. But generation is slow, costs
 * money per second, and fails in ways a request cannot wait for — so it is a
 * command somebody runs deliberately, not something the console does when
 * nobody is looking at it.
 *
 * SEEDANCE, through BytePlus ModelArk — the same provider agent/lib/video.js
 * uses and for the reason written there: the Chinese models are trained on
 * this exact format, vertical and close on faces, and cost a fraction per
 * second of the Western ones.
 *
 * NOT A COPY OF agent/lib/video.js. That file carries a budget, a job store
 * and a day counter, all of which belong to the agent's desk. This one has a
 * catalogue and ten prompts. What is shared is the shape of the API, which is
 * ByteDance's rather than ours.
 *
 * COSTS MONEY. It refuses to run without --go, and it prints what it is about
 * to spend first.
 *
 *   make claire-video          says what it would shoot
 *   make claire-video GO=1     shoots it
 * ---------------------------------------------------------------------------
 */
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";

const STORE = process.env.CLAIRE_STORE || "/data/claire.json";
const OUT = process.env.CLAIRE_VIDEO_DIR || "/data/v";
const KEY = (process.env.ARK_API_KEY || "").trim();
const BASE = (process.env.ARK_BASE || "https://ark.ap-southeast.bytepluses.com").replace(/\/+$/, "");
const MODEL = (process.env.ARK_VIDEO_MODEL || "").trim();
const GO = process.argv.includes("--go");
const SECONDS = Number(process.env.CLAIRE_CLIP_SECONDS || 10);

/** The look, said once. Every prompt is this plus the beat, because a series
 *  whose episodes were each described from scratch looks like ten series. */
const LOOK = [
  "Vertical 9:16 micro-drama, cinematic, shallow depth of field,",
  "warm practical lighting, close on faces, modern city wealth,",
  "restrained performances, no on-screen text, no subtitles, no logos.",
].join(" ");

const load = async () => JSON.parse(await readFile(STORE, "utf8"));

async function save(b) {
  const tmp = STORE + ".tmp";
  await writeFile(tmp, JSON.stringify(b, null, 2));
  await rename(tmp, STORE);
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

const b = await load();
const series = b.series.find((s) => s.title === (process.argv[2] || "The Wife He Hired"))
  || b.series[0];
if (!series) { console.log("\n  No series in the catalogue. Run make claire-seed first.\n"); process.exit(0); }

const eps = b.episodes.filter((e) => e.series === series.id && !e.url).sort((a, c) => a.n - c.n);

console.log("");
console.log("  " + series.title);
console.log("  " + eps.length + " episodes without film, " + SECONDS + "s each");
console.log("");

if (!eps.length) { console.log("  Every episode already has a clip.\n"); process.exit(0); }
if (!KEY || !MODEL) {
  console.log("  ARK_API_KEY or ARK_VIDEO_MODEL is not set on this container.");
  console.log("  They are in .env as TOMSCODING_ARK_API_KEY and TOMSCODING_ARK_VIDEO_MODEL;");
  console.log("  the claire service has to be given them before this can run.\n");
  process.exit(1);
}
if (!GO) {
  for (const e of eps) console.log("  " + String(e.n).padStart(2) + "  " + e.title);
  console.log("");
  console.log("  Nothing shot. This spends real money — add GO=1 when you mean it.\n");
  process.exit(0);
}

await mkdir(OUT, { recursive: true });

for (const e of eps) {
  /* `shot` wins where it exists. Three of the first ten beats were refused by
     the generator with no reason given, and the answer to that is a sentence
     written for the camera rather than a beat bent to fit a filter. */
  const prompt = LOOK + " " + (e.shot || e.beat || e.title)
    + (e.shot ? "" : " The shot ends on: " + (e.hook || e.title));
  process.stdout.write("  " + String(e.n).padStart(2) + "  " + e.title + " ... ");
  try {
    const task = await ark("/api/v3/contents/generations/tasks", {
      model: MODEL,
      content: [{ type: "text", text: prompt + " --ratio 9:16 --dur " + SECONDS }],
    });
    const id = task?.id || task?.data?.id;
    if (!id) throw new Error("no task id in: " + JSON.stringify(task).slice(0, 300));

    /* Tens of seconds to minutes, so this polls rather than waits on one
       request. Ten minutes is the give-up point: a task still queued after
       that is a queue problem and not a slow render. */
    let url = "";
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const got = await ark("/api/v3/contents/generations/tasks/" + id);
      const st = got?.status || got?.data?.status;
      if (st === "succeeded") { url = got?.content?.video_url || got?.data?.content?.video_url || ""; break; }
      if (st === "failed" || st === "cancelled") throw new Error("task " + st + ": " + JSON.stringify(got).slice(0, 300));
    }
    if (!url) throw new Error("timed out waiting for the render");

    /* Downloaded rather than linked: their URL expires, and a catalogue full
       of dead links is worse than one with no film in it. */
    const res = await fetch(url);
    if (!res.ok) throw new Error("download -> " + res.status);
    const name = series.id + "-" + String(e.n).padStart(2, "0") + ".mp4";
    await writeFile(OUT + "/" + name, Buffer.from(await res.arrayBuffer()));

    const fresh = await load();
    const row = fresh.episodes.find((x) => x.id === e.id);
    if (row) { row.url = "/v/" + name; await save(fresh); }
    console.log("shot");
  } catch (err) {
    console.log("failed");
    console.log("      " + String(err.message).split("\n").join("\n      "));
  }
}

console.log("");
console.log("  Done. Anything that failed still has no url, so running this");
console.log("  again picks up exactly those and leaves the rest alone.");
console.log("");
