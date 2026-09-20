/* 抖音 — creator.douyin.com.
 *
 * UNVERIFIED SELECTORS. Nobody has run this against a logged-in account: the
 * page below is Douyin's creator upload as documented and as it appears in
 * public write-ups, and Douyin changes it. Every selector therefore has more
 * than one way to match, and a failure writes a screenshot and the page's text
 * into /data/evidence rather than saying "failed" — Tom cannot look at the
 * screen, so the screen has to be kept.
 *
 * LOGIN IS BY SMS, NOT BY QR. Douyin offers both. The QR is the one every
 * automation guide uses and it is useless here: scanning a code means pointing
 * a phone at a screen, and Tom is blind. Phone number, then a six-digit code
 * he reads off his own phone, is the accessible path and it is a first-class
 * part of this file rather than a fallback.
 */
import { evidence } from "../lib/session.js";

export const name = "douyin";
export const home = "https://creator.douyin.com/";
const UPLOAD = "https://creator.douyin.com/creator-micro/content/upload";

/** Is this profile still logged in? Asked before every post, because a session
 *  that expired three weeks ago looks exactly like a working one until the
 *  upload page redirects to a login form. */
export async function signedIn(ctx) {
  const page = await ctx.newPage();
  try {
    await page.goto(UPLOAD, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const url = page.url();
    if (/login|passport|signin/i.test(url)) return false;
    /* The upload page has a file input even before anything is chosen. A login
       wall does not. */
    return (await page.locator('input[type="file"]').count()) > 0;
  } catch {
    return false;
  } finally {
    await page.close();
  }
}

/** Step one of a login: ask Douyin to send a code to this number. The page is
 *  left open in the returned context so the code can be typed into the same
 *  form — a second browser would be a second session and the code would not
 *  belong to it. */
export async function sendCode(ctx, phone) {
  const page = await ctx.newPage();
  await page.goto(home, { waitUntil: "domcontentloaded" });
  /* Douyin opens on the QR tab. The text switches it to the SMS one, and the
     wording has been both of these. */
  for (const label of ["验证码登录", "手机号登录", "短信登录"]) {
    const tab = page.getByText(label, { exact: false }).first();
    if (await tab.count()) { await tab.click().catch(() => {}); break; }
  }
  const number = page.locator('input[placeholder*="手机号"], input[name="mobile"], input[type="tel"]').first();
  if (!(await number.count())) {
    const where = await evidence(page, name, "login-no-phone-field");
    throw new Error(`douyin: no phone field on the login page${where ? ` (see ${where}.png)` : ""}`);
  }
  await number.fill(String(phone));
  const send = page.getByText(/获取验证码|发送验证码/).first();
  if (!(await send.count())) {
    const where = await evidence(page, name, "login-no-send-button");
    throw new Error(`douyin: no "get code" button${where ? ` (see ${where}.png)` : ""}`);
  }
  await send.click();
  await page.waitForTimeout(2000);
  /* A slider or a picture puzzle can appear here. It cannot be solved from a
     terminal and pretending otherwise wastes Tom's time, so it is named. */
  const puzzle = page.locator('[class*="captcha"], [class*="verify"], iframe[src*="captcha"]');
  if (await puzzle.count()) {
    const where = await evidence(page, name, "login-captcha");
    throw new Error(`douyin asked for a slider puzzle, which this cannot do${where ? ` (see ${where}.png)` : ""}`);
  }
  return page;
}

/** Step two: the six digits from the SMS, typed into the page sendCode left
 *  open. */
export async function enterCode(page, code) {
  const box = page.locator('input[placeholder*="验证码"], input[name="code"], input[maxlength="6"]').first();
  if (!(await box.count())) {
    const where = await evidence(page, name, "login-no-code-field");
    throw new Error(`douyin: no code field${where ? ` (see ${where}.png)` : ""}`);
  }
  await box.fill(String(code));
  const go = page.getByRole("button", { name: /登录|登 录/ }).first();
  if (await go.count()) await go.click();
  await page.waitForTimeout(5000);
  if (/login|passport/i.test(page.url())) {
    const where = await evidence(page, name, "login-still-on-login");
    throw new Error(`douyin did not accept the code${where ? ` (see ${where}.png)` : ""}`);
  }
  return true;
}

/** Post one video. `zh` is the caption; the English one is never used here —
 *  see the no-machine-translation rule in post/lib/jobs.js. */
export async function post(ctx, { file, zh }) {
  const page = await ctx.newPage();
  try {
    await page.goto(UPLOAD, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const input = page.locator('input[type="file"]').first();
    if (!(await input.count())) {
      const where = await evidence(page, name, "no-file-input");
      throw new Error(`douyin: no upload field — the session may have expired${where ? ` (see ${where}.png)` : ""}`);
    }
    await input.setInputFiles(file);

    /* Douyin transcodes before the form is usable, and the caption box does not
       exist until it has. Waiting for the box rather than a fixed sleep is the
       difference between working on a 20MB clip and a 300MB one. */
    const caption = page.locator('[contenteditable="true"], textarea[placeholder*="作品描述"], input[placeholder*="标题"]').first();
    await caption.waitFor({ state: "visible", timeout: 180_000 });
    await caption.click();
    await caption.fill(String(zh).slice(0, 1000));

    const publish = page.getByRole("button", { name: /发布|发 布/ }).first();
    await publish.waitFor({ state: "visible", timeout: 120_000 });
    /* The button exists while the upload is still running and is disabled
       until it finishes; clicking it early does nothing and looks like a
       success to anything not checking. */
    for (let i = 0; i < 60 && await publish.isDisabled().catch(() => false); i++) {
      await page.waitForTimeout(5000);
    }
    await publish.click();
    await page.waitForTimeout(8000);

    /* Douyin leaves the upload page for the work list on success. Staying put
       means something refused, and what it says is worth keeping. */
    if (/upload/.test(page.url())) {
      const where = await evidence(page, name, "after-publish");
      throw new Error(`douyin did not confirm the post${where ? ` (see ${where}.png)` : ""}`);
    }
    return { url: "https://creator.douyin.com/creator-micro/content/manage" };
  } finally {
    await page.close();
  }
}
