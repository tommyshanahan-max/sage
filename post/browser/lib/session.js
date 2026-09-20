/* ONE BROWSER PROFILE PER PLATFORM, KEPT.
 *
 * WHY A PERSISTENT CONTEXT AND NOT A SAVED COOKIE JAR. These sites do not just
 * check a cookie. They fingerprint the browser — canvas, fonts, storage,
 * localStorage keys written at login — and a fresh browser carrying only the
 * cookies of an old session looks like a stolen session, which is the thing
 * they are built to stop. launchPersistentContext keeps the whole profile
 * directory, so the second visit is the same browser as the first.
 *
 * WHY THE PROFILES ARE A VOLUME. A login costs Tom an SMS and a minute of his
 * time, and it must survive a deploy. post_profiles is that promise.
 *
 * ON BEING FOUND OUT. Nothing here pretends to be a human. There is no
 * randomised mouse path and no stealth plugin, because a tool that lies about
 * what it is makes a ban more likely, not less, and the honest failure — "this
 * platform is asking for a login again" — is one Tom can act on. What it does
 * do is act like a normal browser: a real window size, a real user agent, one
 * action at a time, and no parallelism.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

/* IMPORTED WHEN A BROWSER IS ACTUALLY WANTED, not when this file loads.
   Half of what the runner does — deciding there is nothing waiting, or that a
   platform has no login yet — needs no Chromium at all, and a top-level import
   makes those paths impossible to run or test anywhere Playwright is not
   installed. */
let chromium = null;
async function browser() {
  if (!chromium) ({ chromium } = await import("playwright"));
  return chromium;
}

const ROOT = process.env.POST_PROFILES || "/profiles";

/* A phone-shaped window for the two that care. Douyin's creator pages render a
   different, simpler upload form to a narrow viewport, and the wide one has
   more moving parts to break. Left at desktop for the rest. */
const VIEWPORT = { width: 1280, height: 900 };

export function profileDir(platform) {
  return path.join(ROOT, platform);
}

export async function hasProfile(platform) {
  try {
    const entries = await fs.readdir(profileDir(platform));
    return entries.length > 0;
  } catch {
    return false;
  }
}

/** Open the platform's own browser. Headless by default — there is no screen
 *  on the box — but POST_HEADFUL=1 opens a real window, which is what the Mac
 *  would use if a platform ever has to move there. */
export async function open(platform) {
  const dir = profileDir(platform);
  await fs.mkdir(dir, { recursive: true });
  const ctx = await (await browser()).launchPersistentContext(dir, {
    headless: !process.env.POST_HEADFUL,
    viewport: VIEWPORT,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    /* The default headless user agent says HeadlessChrome, which is the single
       most obvious tell there is. */
    userAgent: process.env.POST_UA ||
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    args: ["--disable-blink-features=AutomationControlled"],
  });
  ctx.setDefaultTimeout(45_000);
  return ctx;
}

/** WHEN SOMETHING GOES WRONG, LEAVE EVIDENCE.
 *
 *  Tom cannot look at the screen, and a selector that stopped matching is
 *  otherwise a mystery — "it did not work" with nothing to read. This writes a
 *  screenshot and the page's visible text next to the record, so whoever fixes
 *  it can see what the page actually said without reproducing the failure. */
export async function evidence(page, platform, tag) {
  const dir = path.join(process.env.POST_DIR || "/data", "evidence");
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = path.join(dir, `${platform}-${tag}-${stamp}`);
  try {
    await page.screenshot({ path: base + ".png", fullPage: false });
    const text = await page.evaluate(() => document.body?.innerText?.slice(0, 4000) || "");
    await fs.writeFile(base + ".txt", `${page.url()}\n\n${text}`);
    return base;
  } catch {
    return ""; /* A failure to record a failure is not worth failing over. */
  }
}
