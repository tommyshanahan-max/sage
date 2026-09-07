/* The one post this board writes for itself: how to be the same person twice.
 *
 * WeChat's webview and Safari do not share storage, so a student who opens the
 * link in a chat and again in their browser is two people here. The key is the
 * answer, and a key nobody has been told about is not an answer — so it is
 * explained on the feed, in both languages, where everybody already is.
 *
 * Posted through the operator's route rather than written into the file: the
 * board is running, its writes go through a queue, and a script that edits the
 * same file underneath it will one day drop somebody's post.
 *
 * IDEMPOTENT. It looks for its own first line before posting, so running it
 * twice does not put the explanation up twice — the board is deployed by
 * people typing commands, and a command that is only safe once is a command
 * somebody will run twice.
 *
 *   make post-explainer
 */

const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error("usage: post-explainer.mjs <board url> <admin key> [--as <name>]");
  process.exit(2);
}
const asIdx = rest.indexOf("--as");
const ACCOUNT = asIdx >= 0 ? rest[asIdx + 1] : "The Tutor";

const EN = [
  "Reading this in WeChat and also in your browser? They are two different browsers, so this board sees two different people — your page will be on one of them and not the other.",
  "",
  "The way across: open your own page — the Profile tab — and tap Show my key. Copy the line. Then in the other browser, open Profile there and tap Been here before?, and paste it in. That browser becomes you: your page, your posts, the people who follow you.",
  "",
  "There is no account here and no password, so that line is the whole of it. Keep it somewhere you will still have it in a year. Anyone who has it is you, so do not put it in a post.",
].join("\n");

const ZH = [
  "你是不是在微信里看这个，也在浏览器里看过？那是两个不同的浏览器，所以在这里就是两个不同的人——你的主页只会在其中一个上面。",
  "",
  "怎么把它们变成一个人：打开你自己的主页——点底部的「我的」——再点「显示我的钥匙」，把那一行复制下来。然后在另一个浏览器里点「我的」，点「以前来过？」，粘贴进去。那个浏览器就变成你了——你的主页、你发的内容、关注你的人，都在。",
  "",
  "这里没有账号，也没有密码，所以就靠那一行。存在一个一年以后你还找得到的地方。谁拿到它谁就是你，所以别把它发出来。",
].join("\n");

// The same header the rest of the platform uses; not a bearer token.
const head = { "x-admin-secret": key };

async function main() {
  // Already up? The first sentence is distinctive enough to find and short
  // enough not to break if the rest is ever reworded.
  const mark = "Reading this in WeChat";
  // Public, and the only list that has every post on it.
  const board = await fetch(base + "/api/board").then((r) => r.json());
  const already = (board.posts || []).some((p) => String(p.note || "").startsWith(mark));
  if (already) {
    console.log("The explanation is already on the feed. Nothing to do.");
    return;
  }

  const form = new FormData();
  form.set("account", ACCOUNT);
  form.set("body", EN);
  form.set("zh", ZH);
  form.set("topic", "Getting in");

  const r = await fetch(base + "/api/feed", { method: "POST", headers: head, body: form });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("The board refused it:", r.status, d.error || "");
    process.exit(1);
  }
  console.log("Up, in both languages, as " + ACCOUNT + ".");
}

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
