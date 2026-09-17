/* Build the site the filed domain serves.
 *
 * ---------------------------------------------------------------------------
 * WHY IT IS BUILT AND NOT WRITTEN. The filing describes a website, and the
 * website has to be the one the filing describes — for as long as the filing
 * lasts, not just on the day it is reviewed. The nine house rules and what the
 * board keeps are already written, in Chinese, in board/public/i18n.js. Copying
 * them into a second set of files would mean two documents that say the same
 * thing until the day one of them is edited.
 *
 * WHAT IS DELIBERATELY NOT HERE, and it is most of the product: the messenger,
 * Browse, Cards, profiles, the feed. None of them are served from this domain
 * — docs/beijing.md has always said so — and a site whose pages advertise
 * features the domain does not serve is describing a different website to the
 * one filed. It also happens to be the quieter filing, which is Tom's read and
 * is right: 即时通讯 between strangers is the part that draws questions.
 *
 * NOT "LINKEDIN × TINDER" EITHER. It is in i18n.js and it is a good line in
 * English to a founder. It is the wrong line here and it is not picked up.
 *
 * WHERE THINGS LIVE IS SAID PLAINLY, in 隐私. The mainland server holds these
 * pages; what members write is on a server outside the mainland. That sentence
 * was the one thing worth getting wrong-footed on: hiding it would be both a
 * lie and, under PIPL, the wrong way round — cross-border handling is a thing
 * to disclose, not to leave out.
 *
 * NO EXTERNAL ANYTHING. One same-origin stylesheet, no fonts, no CDN, no
 * analytics, no beacon. Google Fonts does not resolve from the mainland and a
 * blocked stylesheet leaves a visitor on an unstyled page.
 *
 *   make china        builds china/, serves it, and opens the browser
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { STRINGS } from "../board/public/i18n.js";

const OUT = new URL("../china/", import.meta.url);

/** The Chinese half of a key, which is index 1 everywhere in i18n.js. */
const zh = (k) => {
  const row = STRINGS[k];
  if (!row) throw new Error("no string for " + k + " — it moved or was renamed");
  return row[1];
};

/* THE STRINGS THAT ARE NOT IN i18n.js, AND WHY. These describe the China site
   itself — a site the board does not have and has no key for. Putting them in
   i18n.js would add English the board would never show and a second language
   nobody would maintain. They live here, beside the only thing that uses
   them. */
const CN = {
  name: "交换",
  lede: "写下你是做什么的、在找什么样的人。剩下的交给我们。",
  signin: "登录",
  invite: "交换是邀请制的，登录需要邀请码。",
  company: "澳斯达（北京）经济贸易有限公司",

  aboutTitle: "这是什么",
  aboutLede: "一个会员制的介绍平台。你说一句话，它把说了另一半的人找给你。",
  aboutNo: "这里没有公开名录，也不能随便加人。两边都愿意，联系方式才打开。",

  joinTitle: "怎么进来",
  joinLede: "只能被邀请。已经在里面的人给你一个邀请码，码和链接分开发给你，一个人只能用一次。",
  joinNo: "没有注册入口，也没有申请表能让你直接进来。",

  pvTitle: "我们保留什么",
  pvThis: "这个网站本身不保存任何东西。没有表单，没有 cookie，没有统计代码，也没有第三方脚本。你打开它、看完、离开，这边什么都没留下。",
  pvBoard: "登录之后进入的是交换的正式站点。那边没有账号，不要邮箱、手机号和密码：浏览器会生成一个随机数字存在你自己的设备上，我们只保存它加盐后的哈希值，刚好够你删掉自己发的内容，不足以说明你是谁。",
  pvWhereH: "存在哪里",
  pvWhere: "这些页面放在中国境内的服务器上。会员写下的内容存在我们自己租用的、位于中国境外的服务器上，由我们自己运行，不是接了一堆第三方工具的云平台。登录即表示你知道并同意这一点。",
  pvAgeH: "未成年人",
  pvContactH: "如果这里有问题",
  pvContact: "请写信给我们，每一封都由人来看。",
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* THE HANDOVER, IN ONE PLACE. The board's address has moved once already
   (docs/beijing.md still says thexchange.app, CLAUDE.md says liuxuesheng.io),
   and a domain written into four pages is a domain that gets changed in
   three. */
const BOARD = process.env.CHINA_BOARD || "https://liuxuesheng.io";

/** Every page is this, so the chrome cannot drift between them. `here` marks
 *  the current page in the footer nav, which is the only navigation there is:
 *  four pages do not need a menu. */
const PAGES = [
  ["index.html", CN.name],
  ["about.html", CN.aboutTitle],
  ["rules.html", zh("rules.title")],
  ["join.html", CN.joinTitle],
  ["privacy.html", CN.pvTitle],
];

const shell = (file, title, body, { wide = false } = {}) => `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title === CN.name ? CN.name : title + " — " + CN.name)}</title>
<meta name="theme-color" content="#0B0D13">
<!-- Built by scripts/china-build.mjs from board/public/i18n.js. Do not edit
     these files by hand: the next build overwrites them, and the point of
     building them is that this site and the board cannot say different
     things. -->
<link rel="stylesheet" href="/style.css">
</head>
<body${wide ? ' class="doc"' : ""}>
${body}
<footer>
  <nav>${PAGES.filter(([f]) => f !== file)
    .map(([f, t]) => `<a href="/${f === "index.html" ? "" : f}">${esc(t)}</a>`).join("\n    ")}
  </nav>
  <!-- 备案号 goes here the day the filing clears, linked to beian.miit.gov.cn
       as required. 公安备案号 follows within 30 days, on its own line. -->
  <div class="who">${esc(CN.company)}</div>
</footer>
</body>
</html>
`;

const home = shell("index.html", CN.name, `<main class="hero">
  <h1>${esc(CN.name)}</h1>
  <p class="what">${esc(CN.lede)}</p>
  <!-- Written out rather than built in script, so it works with JavaScript
       off — which is how a reviewer's browser sometimes arrives. -->
  <a class="go" href="${esc(BOARD)}/enter">${esc(CN.signin)}</a>
  <p class="note">${esc(CN.invite)}</p>
</main>`);

const about = shell("about.html", CN.aboutTitle, `<main>
  <h1>${esc(CN.aboutTitle)}</h1>
  <p class="lede">${esc(CN.aboutLede)}</p>
  <ol class="steps">
    <li><b>${esc(zh("land.step1"))}</b><span>${esc(zh("land.say2"))}</span></li>
    <li><b>${esc(zh("land.step2"))}</b><span>${esc(zh("land.one"))}</span></li>
    <li><b>${esc(zh("land.step3"))}</b><span>${esc(CN.aboutNo)}</span></li>
  </ol>
</main>`, { wide: true });

const rules = shell("rules.html", zh("rules.title"), `<main>
  <h1>${esc(zh("rules.title"))}</h1>
  <p class="lede">${esc(zh("rules.lede"))}</p>
  <ol class="nine">
${["bring", "reply", "pitch", "screenshot", "owe", "guess", "photo", "report", "leave"]
  .map((k) => `    <li><b>${esc(zh("rules." + k))}</b><span>${esc(zh("rules." + k + ".why"))}</span></li>`)
  .join("\n")}
  </ol>
  <p class="end">${esc(zh("rules.end"))}</p>
</main>`, { wide: true });

/* joinPage rather than join: node:path's join is imported above for the
   server, and a page named after it took the whole build down with
   "Identifier 'join' has already been declared" — at parse time, so nothing
   ran at all. */
const joinPage = shell("join.html", CN.joinTitle, `<main>
  <h1>${esc(CN.joinTitle)}</h1>
  <p class="lede">${esc(CN.joinLede)}</p>
  <p>${esc(CN.joinNo)}</p>
  <a class="go" href="${esc(BOARD)}/enter">${esc(CN.signin)}</a>
</main>`, { wide: true });

const privacy = shell("privacy.html", CN.pvTitle, `<main>
  <h1>${esc(CN.pvTitle)}</h1>
  <p class="lede">${esc(CN.pvThis)}</p>
  <p>${esc(CN.pvBoard)}</p>

  <h2>${esc(CN.pvWhereH)}</h2>
  <p>${esc(CN.pvWhere)}</p>

  <h2>${esc(zh("pv.h3"))}</h2>
  <p>${esc(zh("pv.p3"))}</p>

  <h2>${esc(CN.pvAgeH)}</h2>
  <p>${esc(zh("pv.p7"))}</p>

  <h2>${esc(zh("pv.hsafe"))}</h2>
  <p>${esc(zh("pv.psafe1"))}</p>

  <h2>${esc(CN.pvContactH)}</h2>
  <p>${esc(CN.pvContact)}</p>
</main>`, { wide: true });

const css = `/* One stylesheet, same origin. See the note in china-build.mjs:
   nothing on this site is fetched from another host, because most of them do
   not resolve from the mainland and a blocked stylesheet is an unstyled page. */
:root{
  --paper:#0B0D13;
  --ink:#F2F4F8;
  --ink-2:#A8B0C2;
  --muted:#6F788C;
  --hair:#232838;
  --gold:#D9A94E;
  --serif:ui-serif,"Songti SC","Noto Serif CJK SC",Georgia,serif;
  --sans:ui-sans-serif,system-ui,-apple-system,"PingFang SC",
         "Hiragino Sans GB","Microsoft YaHei",sans-serif;
}
@media (prefers-color-scheme:light){
  :root:not([data-theme="dark"]){
    --paper:#EFF1F5;
    --ink:#161A22;
    --ink-2:#4A5262;
    --muted:#7B8496;
    --hair:#DDE2EA;
  }
}
*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0;padding:0 20px;
  background:var(--paper);color:var(--ink);
  font-family:var(--sans);font-size:17px;line-height:1.8;
  display:flex;flex-direction:column;align-items:center;
}
main{width:100%;max-width:26rem;margin-block:auto;padding:40px 0}
/* A document is read rather than glanced at, so it starts at the top and is
   given a wider measure than the one-line home page. */
body.doc main{margin-block:0;max-width:34rem;padding:44px 0 32px}
.hero{text-align:center}
h1{
  font-family:var(--serif);font-weight:600;
  font-size:2rem;line-height:1.3;margin:0 0 16px;text-wrap:balance;
}
.hero h1{font-size:2.6rem;letter-spacing:.18em;margin-bottom:18px}
h2{font-family:var(--serif);font-weight:600;font-size:1.15rem;
   margin:2.2rem 0 .4rem;line-height:1.5}
p{margin:0 0 1rem}
.lede{color:var(--ink-2)}
.hero .what{color:var(--ink-2);margin:0 auto 34px;max-width:20rem}
a.go{
  display:block;padding:16px 20px;border-radius:12px;margin-top:1.6rem;
  background:var(--gold);color:#1A1405;text-align:center;
  font-size:1.05rem;font-weight:600;letter-spacing:.06em;text-decoration:none;
}
.hero a.go{margin-top:0}
a.go:focus-visible{outline:3px solid var(--ink);outline-offset:3px}
.note{color:var(--muted);font-size:.9rem;margin:20px 0 0;text-align:center}
ol{margin:2rem 0 0;padding:0;list-style:none;counter-reset:r}
ol li{counter-increment:r;padding:1.1rem 0 1.1rem 2.8rem;position:relative;
  border-top:1px solid var(--hair)}
ol li:last-child{border-bottom:1px solid var(--hair)}
ol li::before{content:counter(r);position:absolute;left:0;top:1.15rem;
  font-family:var(--serif);font-size:1.3rem;color:var(--gold);line-height:1}
ol li b{display:block;font-weight:600;line-height:1.5}
ol li span{display:block;margin:.3rem 0 0;font-size:.93rem;color:var(--ink-2)}
.end{margin-top:2rem;font-size:.93rem;color:var(--muted)}
footer{
  width:100%;max-width:34rem;margin-top:auto;
  color:var(--muted);font-size:.85rem;line-height:2.2;
  padding:32px 0;text-align:center;
}
footer nav{display:flex;flex-wrap:wrap;gap:0 1.4rem;justify-content:center}
footer a{color:var(--muted)}
footer .who{margin-top:.8rem;font-size:.8rem}
`;

await mkdir(OUT, { recursive: true });
const wrote = [
  ["index.html", home], ["about.html", about], ["rules.html", rules],
  ["join.html", joinPage], ["privacy.html", privacy], ["style.css", css],
];
for (const [f, body] of wrote) await writeFile(new URL(f, OUT), body);

console.log("");
console.log("  china/ — the site the filed domain serves");
for (const [f] of wrote) console.log("    " + f);
console.log("");
console.log("  登录 hands over to " + BOARD + "/enter");
console.log("  No messenger, no browse, no profiles: none of it is on this domain.");
console.log("");

/* LOOKING AT IT IS PART OF BUILDING IT. Nothing consumes china/ yet — there is
   no container and no box — so a build with no way to see the result is a
   build nobody checks. The pages ask for /style.css at the root, which a
   file:// open cannot answer, so it is served rather than opened off disk. */
if (process.argv.includes("--look")) {
  const dir = fileURLToPath(OUT);
  const port = Number(process.env.PORT || 8390);
  const TYPE = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8" };
  createServer(async (req, res) => {
    let path = decodeURIComponent(String(req.url).split("?")[0]);
    if (path.endsWith("/")) path += "index.html";
    try {
      const body = await readFile(join(dir, path));
      res.writeHead(200, { "content-type": TYPE[extname(path)] || "text/plain" });
      res.end(body);
    } catch { res.writeHead(404); res.end("not here"); }
  }).listen(port, () => {
    console.log("  http://127.0.0.1:" + port + "/");
    console.log("");
    console.log("  Ctrl-C here when you have seen enough.");
    console.log("");
  });
}
