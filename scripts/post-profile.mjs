/* The Professor, on how to finish a page — including where LinkedIn lives.
 *
 * WHY THIS EXISTS. The first member through the door made a page, wanted to
 * put his LinkedIn on it, and could not find the box. It is real and it is one
 * tap away, behind a button whose label has been fixed — but a label fixed
 * today does not reach the people who already gave up looking yesterday, and
 * "somebody will work it out" is how a board fills up with half-made pages
 * nobody can match on.
 *
 * SHORT, because the feed folds a post after its first paragraph. The list is
 * the post; the reasons are one clause each and no more.
 *
 * IDEMPOTENT by the one method that has survived here: the title it matches on
 * IS the title it posts, held in a single constant. Matching a phrase in the
 * body broke twice before, the second time putting a notice up twice.
 *
 *   make post-profile
 */

const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error("usage: post-profile.mjs <board url> <admin key> [--as NAME] [--again]");
  process.exit(2);
}
const asIdx = rest.indexOf("--as");
const ACCOUNT = asIdx >= 0 ? rest[asIdx + 1] : "The Professor";
const TOPIC = "Getting in";

const TITLE = "FINISH YOUR PAGE — IT IS FOUR THINGS";

const EN = [
  TITLE,
  "",
  "Profile, then Edit. Nobody can match with a page that is not finished.",
  "",
  "1. A photo. A page with a face on it gets read; one without mostly does not.",
  "",
  "2. Your name, and leave Show me in Browse on. Off, you are not in the list "
  + "of people at all — you can still post, but nobody can find you.",
  "",
  "3. The sentence. I am a ___ looking for a ___. This is the whole of the "
  + "matching: you come up for people who are what you are looking for and are "
  + "looking for what you are. Nothing else decides it.",
  "",
  "4. Tap \"Add LinkedIn, Instagram and more about you\" near the bottom. "
  + "LinkedIn is in there, along with a line about what you are working on. "
  + "Paste the whole linkedin.com/in/ link — it takes it either way.",
  "",
  "Anybody who opens your page can see what you put there, and only that. Your "
  + "WeChat is never on it: that moves between two people who have each chosen "
  + "to hand it over, and it can be taken back.",
].join("\n");

const ZH = [
  "把主页填完——一共四件事",
  "",
  "点 Profile，再点 Edit。主页没填完，就没法跟人配上。",
  "",
  "1. 一张照片。有脸的主页有人看，没有的基本没人看。",
  "",
  "2. 名字，以及别关掉「在 Browse 里显示我」。关了就完全不在人员列表里——还能发帖，但没人找得到你。",
  "",
  "3. 那句话：我是 ___，在找 ___。配对就靠这一句：你会出现在「他们正是你要找的、而且他们要找的正是你」的人面前。别的都不算数。",
  "",
  "4. 往下拉，点「填 LinkedIn、Instagram，再多写点你自己」。LinkedIn 在里面，旁边还有一栏写你最近在做什么。整条 linkedin.com/in/ 链接直接粘进去就行。",
  "",
  "打开你主页的人只看得到你填的这些，别的看不到。微信号永远不在上面：那是两个人各自同意之后才交换的，而且随时可以收回。",
].join("\n");

const head = { "x-admin-secret": key };

async function main() {
  /* Read through the operator's route, not the public one: with
     BOARD_INVITE=read the reader's route is behind the door and answers 403 to
     a script, which reads as "nothing is up" and posts a second copy. */
  const board = await fetch(base + "/api/public", { headers: head }).then((r) => r.json());
  const HOUSE = ["the professor", "the tutor", "教授", "导师"];
  const mine = (board.posts || []).filter((p) =>
    p.state !== "removed"
    && p.topic === TOPIC
    && HOUSE.includes(String(p.handle || "").toLowerCase())
    && String(p.note || "").trim().startsWith(TITLE));

  if (!rest.includes("--again") && mine.length) {
    console.log("It is already on the feed. Nothing to do.  (--again to replace it)");
    return;
  }

  for (const old of mine) {
    const r = await fetch(
      base + "/api/feed?id=" + encodeURIComponent(old.id)
        + "&why=" + encodeURIComponent("Replaced by a newer notice."),
      { method: "DELETE", headers: head });
    if (!r.ok) { console.error("Could not take the older one down:", r.status); process.exit(1); }
    console.log("Took down an older version (" + old.id + ").");
  }

  const form = new FormData();
  form.set("account", ACCOUNT);
  form.set("body", EN);
  form.set("zh", ZH);
  form.set("topic", TOPIC);

  const r = await fetch(base + "/api/feed", { method: "POST", headers: head, body: form });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("The board refused it:", r.status, d.error || "");
    process.exit(1);
  }
  console.log("Up, in both languages, as " + ACCOUNT + ".");
}

main().catch((e) => { console.error(e && e.message ? e.message : e); process.exit(1); });
