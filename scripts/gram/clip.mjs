/* Turn one still into a short clip, with Seedance on BytePlus ARK.
 *
 *   node scripts/gram/clip.mjs agent-producer         make it
 *   node scripts/gram/clip.mjs agent-producer --dry   print what it would send
 *   node scripts/gram/clip.mjs --all                  every still marked for one
 *
 * IT STARTS ON THE STILL. ARK takes a first frame as an image URL, so the clip
 * opens on exactly the card that would have been posted and moves from there.
 * That is the whole reason every fifth post can be a video without the account
 * looking like two accounts: it is the same post, moving.
 *
 * The image has to be fetchable by ARK, same as by Meta — make.mjs already
 * writes into site/g for that reason, so the still must be deployed before
 * this runs. A 404 here is usually a missing deploy and not a missing key.
 *
 * Ark shapes are copied from agent/lib/video.js, which is the one that has
 * been run against the live API. Not imported: that module lives in another
 * container, keeps its own job ledger and enforces the agent seat's daily
 * budget, and none of those belong to a marketing script.
 */
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(HERE, "out");
const WEB = path.join(HERE, "..", "..", "site", "g");
const BASE = (process.env.ARK_BASE || "https://ark.ap-southeast.bytepluses.com").replace(/\/+$/, "");
const KEY = (process.env.ARK_API_KEY || "").trim();
const MODEL = (process.env.ARK_VIDEO_MODEL || "").trim();
const PUBLIC = process.env.GRAM_BASE || "https://thexchange.app/g";

/* WATERMARK ON, AND NOT BY DEFAULT. China requires generated video shown there
   to carry a visible mark. These clips are made for an audience that is partly
   in China and the file will be forwarded out of any account it is posted to,
   so the mark travels with it. */
const FLAGS = "--ratio 1:1 --dur 5 --resolution 720p --watermark true";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const all = args.includes("--all");
const one = args.find((a) => !a.startsWith("--")) || "";

const ark = async (pathname, init = {}) => {
  const res = await fetch(BASE + pathname, {
    ...init,
    headers: { "content-type": "application/json", authorization: "Bearer " + KEY,
               ...(init.headers || {}) },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* keep the text */ }
  if (!res.ok) {
    // Verbatim: a wrong model id and an expired key fail the same way through
    // a friendly message and differently through this one.
    throw new Error(`Ark ${res.status}: ${body?.error?.message || text.slice(0, 300)}`);
  }
  return body;
};

async function makeOne(name) {
  const spec = JSON.parse(await readFile(path.join(OUT, name + ".clip.json"), "utf8"));
  const first = `${PUBLIC}/${name}.png`;
  const prompt = spec.prompt + " " + FLAGS;

  if (dry || !KEY || !MODEL) {
    if (!dry) console.log("ARK_API_KEY / ARK_VIDEO_MODEL are not set — printing instead.\n");
    console.log(name);
    console.log("  first frame  " + first);
    console.log("  prompt       " + spec.prompt);
    console.log("  flags        " + FLAGS);
    return;
  }

  const made = await ark("/api/v3/contents/generations/tasks", {
    method: "POST",
    body: JSON.stringify({ model: MODEL, content: [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: first }, role: "first_frame" },
    ] }),
  });
  const task = made?.id || made?.task_id;
  if (!task) throw new Error("Ark took the request and returned no task id");
  console.log(name + "  task " + task);

  /* A clip takes a minute or more and there is no callback, so this waits.
     Capped rather than open-ended: a job that is still running after ten
     minutes is a job to go and look at, not one to keep polling from a
     script somebody has walked away from. */
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 10_000));
    const got = await ark("/api/v3/contents/generations/tasks/" + task);
    const state = got?.status || got?.state || "";
    if (state === "succeeded" || got?.content?.video_url) {
      const url = got?.content?.video_url || got?.video_url;
      const bin = Buffer.from(await (await fetch(url)).arrayBuffer());
      await writeFile(path.join(OUT, name + ".mp4"), bin);
      await writeFile(path.join(WEB, name + ".mp4"), bin);
      console.log("  " + (bin.length / 1e6).toFixed(1) + "mb  →  " + PUBLIC + "/" + name + ".mp4");
      return;
    }
    if (state === "failed" || state === "cancelled") {
      throw new Error(name + ": " + (got?.error?.message || state));
    }
  }
  throw new Error(name + ": still running after ten minutes — check the ARK console");
}

await mkdir(WEB, { recursive: true });
const names = all
  ? (await readdir(OUT)).filter((f) => f.endsWith(".clip.json")).map((f) => f.replace(/\.clip\.json$/, ""))
  : one ? [one] : [];

if (!names.length) {
  console.log("Which one? Stills marked for a clip:\n");
  const marked = (await readdir(OUT)).filter((f) => f.endsWith(".clip.json"));
  for (const f of marked) console.log("  " + f.replace(/\.clip\.json$/, ""));
  console.log("\n  node scripts/gram/clip.mjs <name> [--dry]   or   --all");
  process.exit(0);
}
for (const n of names) await makeOne(n);
