/* ONE POST, EVERY PLATFORM, ONE LINE PER PLATFORM.
 *
 * Everything here is reached from the Makefile, never by hand, because the
 * arguments are long and Tom reads the terminal with a screen reader. The
 * contract of the output is: ONE LINE PER PLATFORM, the platform name first,
 * then what happened. Not a progress bar, not a spinner, and never silence —
 * a platform that did nothing still prints, with the reason.
 *
 *   node cli.mjs post --file /in/v.mp4 --say "..." [--zh "..."] [--only a,b]
 *   node cli.mjs status [--id abc] [--n 10]
 *   node cli.mjs waiting --where box --kind browser     (what the runner claims)
 *   node cli.mjs mark --id abc --platform douyin --state done [--url ...] [--why ...]
 */
import { promises as fs } from "node:fs";
import { say } from "./lib/say.js";
import { ALL, PLATFORMS, get, mark, recent, submit, waiting } from "./lib/jobs.js";
import * as youtube from "./lib/youtube.js";

const args = process.argv.slice(2);
const cmd = args[0] || "help";

function opt(name, fallback = "") {
  const i = args.indexOf("--" + name);
  return i === -1 ? fallback : (args[i + 1] ?? "");
}

/* The line a person reads. Padded so the platform names form a column: with a
   screen reader the name is the first thing spoken on every line, and with
   eyes the column is scannable. */
function line(platform, state, tail = "") {
  const label = say("state." + state) || state;
  return `  ${platform.padEnd(13)} ${label}${tail ? "  " + tail : ""}`;
}

/* WHICH POSTERS EXIST. A platform with no entry here is not a failure, it is
   unbuilt, and the difference matters: "not built yet" is a plan, "failed" is a
   thing to go and look at. */
const POSTERS = {
  youtube: {
    ready: youtube.configured,
    async run(job) { return youtube.upload({ file: job.file, say: job.say }); },
  },
};

async function doPost() {
  const file = opt("file");
  const text = opt("say");
  const zh = opt("zh");
  const only = opt("only").split(",").map((s) => s.trim()).filter(Boolean);

  if (!file) { console.error('which file? make post FILE=~/video.mp4 SAY="..."'); process.exit(1); }
  /* Checked here as well as in the Makefile. The Makefile is how Tom runs it,
     but this is the thing that actually posts, and a video that goes out with
     an empty caption cannot be taken back — on YouTube it would be titled
     "Video", which is worse than a command that refuses. */
  if (!text) { console.error('what does it say? make post FILE=~/video.mp4 SAY="caption"'); process.exit(1); }
  for (const name of only) {
    if (!ALL.includes(name)) {
      console.error(`ONLY= does not know "${name}". Known: ${ALL.join(", ")}`);
      process.exit(1);
    }
  }
  try {
    await fs.access(file);
  } catch {
    /* Said plainly and early, because the file is the one argument that comes
       from Tom's own typing and the one most likely to be wrong. */
    console.error(`${say("job.missing")}: ${file}`);
    process.exit(1);
  }

  const { id, job, repeat } = await submit({ file, say: text, zh, only });
  console.log(`${say("job.made")} ${id}${repeat ? " (same video and caption as before — only what has not posted will be tried)" : ""}`);
  console.log(`${say("job.file")}: ${job.file}`);
  console.log("");

  for (const name of ALL) {
    const row = job.targets[name];
    if (!row) continue;

    if (row.state === "done") { console.log(line(name, "already", row.url || "")); continue; }
    if (row.state === "skipped") { console.log(line(name, "skipped", say(row.why))); continue; }

    const p = PLATFORMS[name];
    const poster = POSTERS[name];

    /* The browser half is not run from here. It is claimed by the runner,
       which drives a real browser with a real profile; this command only says
       that it is waiting, so the output is honest about what has actually
       happened by the time the prompt comes back. */
    if (p.kind === "browser") {
      console.log(line(name, "queued", `${p.where === "box" ? "on the box" : "on the Mac"} — make post-run`));
      continue;
    }
    /* The reason is written onto the job, not just printed. Without this,
       `make post` said "not built yet" and `make post-status` said "queued"
       with no reason a minute later — two answers to the same question, and
       the quieter one is the one somebody reads later. */
    if (!poster) {
      await mark(id, name, "queued", { why: "why.notBuilt" });
      console.log(line(name, "skipped", say("why.notBuilt")));
      continue;
    }
    if (!poster.ready()) {
      await mark(id, name, "queued", { why: "why.noKeys" });
      console.log(line(name, "skipped", say("why.noKeys")));
      continue;
    }

    await mark(id, name, "posting");
    try {
      const out = await poster.run(job);
      await mark(id, name, "done", { url: out?.url || "" });
      console.log(line(name, "done", out?.url || ""));
    } catch (err) {
      /* The reason is kept on the job as well as printed. A failure nobody
         wrote down is a failure somebody re-runs blind next week. */
      await mark(id, name, "queued", { why: err.message });
      console.log(line(name, "failed", err.message));
    }
  }
  console.log("");
  console.log(`make post-status ID=${id}`);
}

async function doStatus() {
  const id = opt("id");
  if (id) {
    const job = await get(id);
    if (!job) { console.log(say("job.none")); return; }
    console.log(`${job.id}  ${job.file}`);
    console.log(`  say: ${job.say.slice(0, 70)}`);
    if (job.zh) console.log(`  zh:  ${job.zh.slice(0, 70)}`);
    console.log("");
    for (const name of ALL) {
      const row = job.targets[name];
      if (!row) continue;
      /* A why may be one of our own keys or a message from the platform, so
         say() is asked first and its fallback — returning the key unchanged —
         means a platform's own words print as themselves. */
      let tail = row.url || (row.why ? say(row.why) : "");
      if (!tail && row.state === "queued" && PLATFORMS[name].kind === "browser") tail = "make post-run";
      console.log(line(name, row.state, tail));
    }
    return;
  }
  const jobs = await recent(Number(opt("n", "10")) || 10);
  if (!jobs.length) { console.log(say("job.none")); return; }
  for (const job of jobs) {
    const states = Object.values(job.targets);
    const done = states.filter((s) => s.state === "done").length;
    const left = states.filter((s) => s.state === "queued").length;
    console.log(`${job.id}  ${job.at.slice(0, 16).replace("T", " ")}  ${done} posted, ${left} waiting  ${job.file.split("/").pop()}`);
  }
}

async function doWaiting() {
  const rows = await waiting(opt("where", "box"), opt("kind"));
  /* JSON on purpose: this one is read by the runner, not by a person. */
  console.log(JSON.stringify(rows.map((r) => ({
    id: r.job.id, platform: r.platform, file: r.job.file, say: r.job.say, zh: r.job.zh,
  })), null, 2));
}

async function doMark() {
  const id = opt("id"), platform = opt("platform"), state = opt("state");
  if (!id || !platform || !state) { console.error("mark needs --id --platform --state"); process.exit(1); }
  const out = await mark(id, platform, state, { url: opt("url") || undefined, why: opt("why") || undefined });
  console.log(out ? `${platform} ${state}` : "no such job");
}

const HELP = `post — one video, every platform

  node cli.mjs post --file F --say "..." [--zh "..."] [--only a,b]
  node cli.mjs status [--id ID] [--n 10]
  node cli.mjs waiting --where box|mac [--kind api|browser]
  node cli.mjs mark --id ID --platform P --state queued|done|failed [--url U] [--why W]

Platforms: ${ALL.join(", ")}
Run it through the Makefile rather than by hand: make post FILE=... SAY="..."`;

const RUN = { post: doPost, status: doStatus, waiting: doWaiting, mark: doMark };
const fn = RUN[cmd];
if (!fn) { console.log(HELP); process.exit(cmd === "help" ? 0 : 1); }
await fn();
