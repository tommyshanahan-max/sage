/* Square posts: the sentence, and nothing else.
 *
 * WHY ONE FORMAT AND NOT FOUR CLEVER ONES. Three or four posts a day is a
 * hundred a month, and a hundred different ideas is a hundred chances to look
 * like a different account. One repeating frame with a changing pair is
 * recognisable at thumbnail size after a week, and the thing it repeats is the
 * product itself — somebody who has seen six of these knows what the app does
 * without having opened it.
 *
 *   node scripts/gram/make.mjs            the built-in set
 *   node scripts/gram/make.mjs pairs.json a file of {me, want} pairs
 *
 * Writes 1080×1080 PNGs into scripts/gram/out, with the caption beside each
 * in a .txt, in both languages. Nothing is uploaded — see the note about
 * Meta's app review before wiring this to anything.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "/tmp/claude-0/node_modules/playwright-core/index.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(HERE, "out");
/* AND A SECOND COPY WHERE META CAN FETCH IT. The publishing API takes a URL
   and will not accept an upload, so the picture has to be on the open web
   before it can be posted. site/ is served by Caddy off disk at
   thexchange.app with no container and no invitation gate — see post.mjs. */
const WEB = path.join(HERE, "..", "..", "site", "g");

/* The pairs. Each one is a real sentence somebody could say in the app — the
   roles come from ROLES in board/lib/store.js, so a pair that could never
   match is a pair that should not be advertised. */
const BUILTIN = [
  { me: "an Agent",        want: "a Producer",     zh: ["经纪人", "制片人"] },
  { me: "a Director",      want: "a Writer",       zh: ["导演", "编剧"] },
  { me: "a Founder",       want: "an Investor",    zh: ["创始人", "投资人"] },
  { me: "a Performer",     want: "an Agent",       zh: ["演员", "经纪人"] },
  { me: "a Brand",         want: "a Performer",    zh: ["品牌方", "演员"] },
  { me: "a Manufacturer",  want: "a Buyer",        zh: ["工厂", "采购方"] },
];

const font = await readFile(path.join(HERE, "..", "..", "cfm", "deck", "instrument.woff2"));
const FONT64 = font.toString("base64");

const page = (p) => `<!doctype html><meta charset="utf-8">
<style>
@font-face{font-family:'Instrument Serif';font-style:normal;font-weight:400;
  font-display:block;src:url(data:font/woff2;base64,${FONT64}) format('woff2')}
*{box-sizing:border-box;margin:0}
html,body{width:1080px;height:1080px}
body{background:#080C0A;color:#ECEAE4;
  font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC",Helvetica,Arial,sans-serif;
  display:flex;flex-direction:column;justify-content:space-between;
  padding:74px 78px}
.mark{display:flex;align-items:center;gap:18px}
.mark i{width:62px;height:62px;border-radius:17px;background:#0E1512;
  border:1px solid #1E2A25;display:grid;place-items:center;font-style:normal;
  font:400 31px/1 'Instrument Serif',Georgia,serif;color:#3FBF8F}
.mark b{font:400 30px/1 'Instrument Serif',Georgia,serif;font-weight:400;color:#939C96}

/* THE SENTENCE IS THE PICTURE. Set at the size of the only thing on the page,
   and broken across lines the way it is said rather than the way it fits. */
.say{font:400 78px/1.28 'Instrument Serif',Georgia,serif;color:#939C96;
  letter-spacing:-.01em}
.say em{font-style:normal;color:#04120C;background:#3FBF8F;
  border-radius:999px;padding:6px 30px 12px;
  display:inline-block;line-height:1.06}

.foot{display:flex;align-items:baseline;justify-content:space-between}
.foot span{font-size:25px;color:#4E5B54;letter-spacing:.02em}
.foot b{font-size:25px;color:#D9A94A;font-weight:650;letter-spacing:.02em}
</style>
<div class="mark"><i>换</i><b>The Exchange · 交换</b></div>
<p class="say">I am <em>${p.me}</em><br>looking for <em>${p.want}</em></p>
<div class="foot"><span>Invite only · 邀请制</span><b>thexchange.app</b></div>`;

const slug = (s) => s.replace(/^(a|an)\s+/i, "").toLowerCase().replace(/\W+/g, "");

const pairs = process.argv[2]
  ? JSON.parse(await readFile(process.argv[2], "utf8"))
  : BUILTIN;

await mkdir(OUT, { recursive: true });
await mkdir(WEB, { recursive: true });
const b = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();

/* EVERY FIFTH ONE IS A CLIP.
 *
 * Not every one: a feed of nothing but video is a feed nobody scrolls, and a
 * clip costs a minute of somebody else's GPU where a still costs nothing. One
 * in five is often enough to be a pattern and rare enough to be a change of
 * pace — and because the clip opens on the still it would have replaced, the
 * two read as one account rather than two.
 *
 * The still is made either way. It is the first frame. */
let n = 0;
for (const one of pairs) {
  const name = `${slug(one.me)}-${slug(one.want)}`;
  const moving = (++n) % 5 === 0;
  await p.setContent(page(one), { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  const shot = await p.screenshot({ path: path.join(OUT, name + ".png") });
  await writeFile(path.join(WEB, name + ".png"), shot);

  /* THE CAPTION, ONCE PER PLACE IT IS GOING.
   *
   * Three blocks, separated by a rule, because the same words do not work in
   * all three and the differences are not stylistic:
   *
   *   Instagram — English, and "link in bio", which is the only way a link
   *   travels there. post.mjs reads this block and no other.
   *
   *   小红书 — Chinese, same shape. The mainland network, which is where
   *   Instagram does not reach at all.
   *
   *   WhatsApp and WeChat — forwarded into a chat by hand, so "link in bio"
   *   means nothing and the address has to be in the message. Short, because
   *   a long paste into a group is read as an advertisement and a short one
   *   is read as a person. Both languages, one after the other, so the same
   *   block works whichever chat it lands in.
   */
  const [zme, zwant] = one.zh || ["", ""];
  await writeFile(path.join(OUT, name + ".txt"),
`I am ${one.me} looking for ${one.want}.

Say that one line and it finds the people who said the other half.
Nobody gets your WeChat until you both say yes.

Invite only. Link in bio.

—

我是${zme}，我在找${zwant}。

说一句话，它就把说了另一半的人找出来。
双方都点了头，微信才互相可见。

邀请制。主页链接。

—

WhatsApp / WeChat — paste with the picture:

I am ${one.me} looking for ${one.want}.
Someone writes the other half and you are put in front of each other.
Invite only, still small.
thexchange.app

我是${zme}，我在找${zwant}。
有人写了另一半，你们就直接对上。
邀请制，人还不多。
thexchange.app
`, "utf8");
  if (moving) {
    /* WHAT THE CAMERA DOES, AND NOTHING ELSE. The frame already says the whole
       thing; a prompt that describes a scene would replace it with a different
       picture. So the instruction is a move, not a subject — the card stays
       the card and the type stays legible, which is the only thing this clip
       has to do. */
    await writeFile(path.join(OUT, name + ".clip.json"), JSON.stringify({
      prompt: "Hold on this exact dark card. A very slow push in, barely moving. "
        + "The two green pills pulse once, gently, one after the other. "
        + "Fine grain, no camera shake, no new objects, no text changes.",
    }, null, 2) + "\n", "utf8");
  }
  console.log("  " + name + (moving ? "  · clip" : ""));
}
await b.close();
console.log(`\n${pairs.length} posts in scripts/gram/out`);
