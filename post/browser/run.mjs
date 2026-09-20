/* THE BROWSER HALF: claim what is waiting, post it, write down what happened.
 *
 *   node browser/run.mjs run [--where box] [--only douyin]
 *   node browser/run.mjs login --who douyin --phone 13800138000
 *   node browser/run.mjs code  --who douyin --code 123456
 *   node browser/run.mjs check [--who douyin]
 *
 * ONE PLATFORM AT A TIME, ONE POST AT A TIME. No parallelism anywhere in here.
 * Two Chromium instances on a 256MB container is one thing; two logins from
 * one address inside a second is another, and the second is how an account
 * gets a closer look than anybody wants.
 *
 * THE LOGIN IS TWO COMMANDS BECAUSE AN SMS TAKES TIME. `login` asks for the
 * code and leaves the browser open in the background, holding the page that
 * will accept it; `code` types it in. A single command would have to sit
 * waiting for Tom to read his phone, and a command that hangs is a command
 * nobody trusts.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { mark, waiting } from "../lib/jobs.js";
import { say } from "../lib/say.js";
import { evidence, hasProfile, open } from "./lib/session.js";
import * as douyin from "./platforms/douyin.js";
import * as xiaohongshu from "./platforms/xiaohongshu.js";

const PLATFORMS = { douyin, xiaohongshu };

const args = process.argv.slice(2);
const cmd = args[0] || "help";
const opt = (n, d = "") => { const i = args.indexOf("--" + n); return i === -1 ? d : (args[i + 1] ?? ""); };

const line = (platform, state, tail = "") => `  ${platform.padEnd(13)} ${say("state." + state) || state}${tail ? "  " + tail : ""}`;

/* WHERE A HALF-FINISHED LOGIN LIVES.
 *
 * `login` cannot hand a live browser to `code`, because they are two runs of
 * the process. What it can leave behind is the profile directory — the SMS
 * form's state is in it — plus a note saying which platform is mid-login, so
 * `code` knows what it is finishing and can say something useful when the
 * answer is "nothing". */
const PENDING = path.join(process.env.POST_DIR || "/data", "login-pending.json");

async function pending() {
  try { return JSON.parse(await fs.readFile(PENDING, "utf8")); } catch { return {}; }
}
async function setPending(who, value) {
  const all = await pending();
  if (value) all[who] = value; else delete all[who];
  await fs.writeFile(PENDING, JSON.stringify(all, null, 2));
}

async function doRun() {
  const where = opt("where", "box");
  const only = opt("only");
  const rows = await waiting(where, "browser");
  const todo = only ? rows.filter((r) => r.platform === only) : rows;
  if (!todo.length) { console.log(say("run.nothingToDo")); return; }

  /* Grouped by platform so one browser does every job waiting for it, rather
     than a launch and a teardown per video. */
  const byPlatform = new Map();
  for (const row of todo) {
    if (!byPlatform.has(row.platform)) byPlatform.set(row.platform, []);
    byPlatform.get(row.platform).push(row);
  }

  for (const [platform, jobs] of byPlatform) {
    const mod = PLATFORMS[platform];
    if (!mod) { console.log(line(platform, "skipped", say("why.notBuilt"))); continue; }
    if (!(await hasProfile(platform))) {
      console.log(line(platform, "skipped", `no login yet — make post-login WHO=${platform} PHONE=…`));
      continue;
    }

    const ctx = await open(platform);
    try {
      if (!(await mod.signedIn(ctx))) {
        /* THE SESSION EXPIRED, AND THAT IS THE ONE THING THE COMMAND MUST SAY
           LOUDLY. Silence here is a video nobody posted and nobody knew about
           for a week. The job stays queued, so finishing the login and running
           again picks it up. */
        for (const { job } of jobs) await mark(job.id, platform, "queued", { why: "why.relogin" });
        console.log(line(platform, "skipped", `${say("why.relogin")} — make post-login WHO=${platform} PHONE=…`));
        continue;
      }
      for (const { job } of jobs) {
        await mark(job.id, platform, "posting");
        try {
          const out = await mod.post(ctx, { file: job.file, zh: job.zh });
          await mark(job.id, platform, "done", { url: out?.url || "" });
          console.log(line(platform, "done", out?.url || ""));
        } catch (err) {
          await mark(job.id, platform, "queued", { why: err.message });
          console.log(line(platform, "failed", err.message));
        }
      }
    } finally {
      await ctx.close();
    }
  }
}

async function doLogin() {
  const who = opt("who"), phone = opt("phone");
  const mod = PLATFORMS[who];
  if (!mod) { console.error(`which platform? one of: ${Object.keys(PLATFORMS).join(", ")}`); process.exit(1); }
  if (!phone) { console.error(`which number? make post-login WHO=${who} PHONE=13800138000`); process.exit(1); }

  const ctx = await open(who);
  try {
    await mod.sendCode(ctx, phone);
    await setPending(who, { phone, at: new Date().toISOString() });
    console.log(`${who}: code sent to ${String(phone).slice(0, 3)}…${String(phone).slice(-2)}`);
    console.log(`when it arrives:  make post-code WHO=${who} CODE=123456`);
  } catch (err) {
    console.error(`${who}: ${err.message}`);
    process.exitCode = 1;
  } finally {
    /* The context is closed even mid-login. The profile directory holds what
       matters, and a Chromium left running on the box for however long Tom
       takes to read an SMS is a worse trade than re-opening the page. */
    await ctx.close();
  }
}

async function doCode() {
  const who = opt("who"), code = opt("code");
  const mod = PLATFORMS[who];
  if (!mod) { console.error(`which platform? one of: ${Object.keys(PLATFORMS).join(", ")}`); process.exit(1); }
  if (!code) { console.error(`which code? make post-code WHO=${who} CODE=123456`); process.exit(1); }
  const waitingFor = (await pending())[who];
  if (!waitingFor) { console.error(`${who}: nothing is waiting for a code — make post-login WHO=${who} PHONE=… first`); process.exit(1); }

  const ctx = await open(who);
  try {
    /* The SMS form is reopened rather than kept: same profile, same session,
       and the number is filled again so the page is in the state the code
       belongs to. */
    const page = await mod.sendCode(ctx, waitingFor.phone);
    await mod.enterCode(page, code);
    const ok = await mod.signedIn(ctx);
    await setPending(who, null);
    console.log(ok ? `${who}: logged in` : `${who}: the code was accepted but the session still looks logged out`);
  } catch (err) {
    console.error(`${who}: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await ctx.close();
  }
}

async function doCheck() {
  const who = opt("who");
  const names = who ? [who] : Object.keys(PLATFORMS);
  for (const platform of names) {
    const mod = PLATFORMS[platform];
    if (!mod) { console.log(line(platform, "skipped", say("why.notBuilt"))); continue; }
    if (!(await hasProfile(platform))) { console.log(`  ${platform.padEnd(13)} no login yet`); continue; }
    const ctx = await open(platform);
    try {
      console.log(`  ${platform.padEnd(13)} ${await mod.signedIn(ctx) ? "logged in" : say("why.relogin")}`);
    } finally {
      await ctx.close();
    }
  }
}

const HELP = `post, the browser half — 抖音 and 小红书 in a real browser

  node browser/run.mjs run [--where box] [--only douyin]
  node browser/run.mjs login --who douyin --phone 13800138000
  node browser/run.mjs code  --who douyin --code 123456
  node browser/run.mjs check [--who douyin]

Run it through the Makefile: make post-run, make post-login, make post-code.`;

const RUN = { run: doRun, login: doLogin, code: doCode, check: doCheck };
const fn = RUN[cmd];
if (!fn) { console.log(HELP); process.exit(cmd === "help" || cmd === "--help" ? 0 : 1); }
await fn();
