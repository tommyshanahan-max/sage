/* 小红书 — creator.xiaohongshu.com.
 *
 * UNVERIFIED SELECTORS, same as Douyin's: written from the creator platform as
 * documented and never run against a logged-in account. Failures keep the page.
 *
 * WHAT IS DIFFERENT FROM DOUYIN, and it matters for the caption. Xiaohongshu
 * separates 标题 (a title, ~20 characters) from 正文 (the body), and a note
 * with no title gets a worse reception than one with a bad title. So the first
 * line of the Chinese caption becomes the title and the whole of it the body —
 * the same split YouTube gets, for the same reason: it is the rule that does
 * least damage when it is wrong.
 *
 * XIAOHONGSHU IS PICKIER ABOUT AUTOMATION than Douyin in everybody's telling,
 * and it is also the platform Tom most wants. That is the argument for the
 * profile being persistent and for never running two of these at once.
 */
import { evidence } from "../lib/session.js";

export const name = "xiaohongshu";
export const home = "https://creator.xiaohongshu.com/";
const PUBLISH = "https://creator.xiaohongshu.com/publish/publish";

export async function signedIn(ctx) {
  const page = await ctx.newPage();
  try {
    await page.goto(PUBLISH, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    if (/login|sign/i.test(page.url())) return false;
    return (await page.locator('input[type="file"]').count()) > 0;
  } catch {
    return false;
  } finally {
    await page.close();
  }
}

export async function sendCode(ctx, phone) {
  const page = await ctx.newPage();
  await page.goto(home, { waitUntil: "domcontentloaded" });
  for (const label of ["手机号登录", "验证码登录", "短信登录"]) {
    const tab = page.getByText(label, { exact: false }).first();
    if (await tab.count()) { await tab.click().catch(() => {}); break; }
  }
  const number = page.locator('input[placeholder*="手机号"], input[type="tel"], input[name="phone"]').first();
  if (!(await number.count())) {
    const where = await evidence(page, name, "login-no-phone-field");
    throw new Error(`xiaohongshu: no phone field${where ? ` (see ${where}.png)` : ""}`);
  }
  await number.fill(String(phone));
  const send = page.getByText(/发送验证码|获取验证码/).first();
  if (!(await send.count())) {
    const where = await evidence(page, name, "login-no-send-button");
    throw new Error(`xiaohongshu: no "send code" button${where ? ` (see ${where}.png)` : ""}`);
  }
  await send.click();
  await page.waitForTimeout(2000);
  const puzzle = page.locator('[class*="captcha"], [class*="slider"], iframe[src*="captcha"]');
  if (await puzzle.count()) {
    const where = await evidence(page, name, "login-captcha");
    throw new Error(`xiaohongshu asked for a slider puzzle, which this cannot do${where ? ` (see ${where}.png)` : ""}`);
  }
  return page;
}

export async function enterCode(page, code) {
  const box = page.locator('input[placeholder*="验证码"], input[maxlength="6"], input[name="code"]').first();
  if (!(await box.count())) {
    const where = await evidence(page, name, "login-no-code-field");
    throw new Error(`xiaohongshu: no code field${where ? ` (see ${where}.png)` : ""}`);
  }
  await box.fill(String(code));
  const go = page.getByRole("button", { name: /登录|登 录/ }).first();
  if (await go.count()) await go.click();
  await page.waitForTimeout(5000);
  if (/login/i.test(page.url())) {
    const where = await evidence(page, name, "login-still-on-login");
    throw new Error(`xiaohongshu did not accept the code${where ? ` (see ${where}.png)` : ""}`);
  }
  return true;
}

export async function post(ctx, { file, zh }) {
  const page = await ctx.newPage();
  try {
    await page.goto(PUBLISH, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    /* The publish page opens on 图文 (pictures) or 视频 (video) depending on
       what was used last, and the file input differs between them. Naming the
       tab is cheaper than guessing which one is showing. */
    const videoTab = page.getByText(/上传视频|发布视频/).first();
    if (await videoTab.count()) { await videoTab.click().catch(() => {}); await page.waitForTimeout(1500); }

    const input = page.locator('input[type="file"]').first();
    if (!(await input.count())) {
      const where = await evidence(page, name, "no-file-input");
      throw new Error(`xiaohongshu: no upload field — the session may have expired${where ? ` (see ${where}.png)` : ""}`);
    }
    await input.setInputFiles(file);

    const text = String(zh);
    const title = text.split("\n")[0].slice(0, 20);

    const titleBox = page.locator('input[placeholder*="标题"]').first();
    await titleBox.waitFor({ state: "visible", timeout: 180_000 });
    await titleBox.fill(title);

    const body = page.locator('[contenteditable="true"], textarea[placeholder*="正文"]').first();
    if (await body.count()) { await body.click(); await body.fill(text.slice(0, 1000)); }

    const publish = page.getByRole("button", { name: /发布|发 布/ }).first();
    await publish.waitFor({ state: "visible", timeout: 120_000 });
    for (let i = 0; i < 60 && await publish.isDisabled().catch(() => false); i++) {
      await page.waitForTimeout(5000);
    }
    await publish.click();
    await page.waitForTimeout(8000);

    if (/publish/.test(page.url())) {
      const where = await evidence(page, name, "after-publish");
      throw new Error(`xiaohongshu did not confirm the post${where ? ` (see ${where}.png)` : ""}`);
    }
    return { url: "https://creator.xiaohongshu.com/publish/success" };
  } finally {
    await page.close();
  }
}
