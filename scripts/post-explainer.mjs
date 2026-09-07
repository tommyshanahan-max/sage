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
// The house voice on the feed. The app knows this name and marks anything
// posted under it as admin, in whichever language it is being read.
const ACCOUNT = asIdx >= 0 ? rest[asIdx + 1] : "The Professor";

const EN = [
  "DO THIS TO SAVE YOUR PROFILE",
  "",
  "WeChat's browser and your normal one are two different people here. To be one: Profile \u2192 Show my key \u2192 Copy, then in the other browser Profile \u2192 Been here before? \u2192 paste. No account, no password \u2014 that line is all of it, so keep it and never post it.",
].join("\n");

const ZH = [
  "想保住你的主页，先做这一步",
  "",
  "微信里的浏览器和你平时用的浏览器，在这里算两个人。要变回一个人：「我的」\u2192「显示我的钥匙」\u2192 复制，再到另一个浏览器里「我的」\u2192「以前来过？」\u2192 粘贴。这里没有账号也没有密码，就靠那一行——存好，别发出来。",
].join("\n");

// The same header the rest of the platform uses; not a bearer token.
const head = { "x-admin-secret": key };

async function main() {
  /* Already up? Matched on the phrase every version of this post has had,
   * rather than on its first sentence — the wording has been shortened once
   * and a marker that moves with the copy is a marker that stops working the
   * first time somebody edits it. --again posts anyway, which is how a
   * reworded one replaces an older one on a board that already has it. */
  const mark = "two different browsers";
  // Public, and the only list that has every post on it.
  const board = await fetch(base + "/api/board").then((r) => r.json());
  const already = !rest.includes("--again")
    && (board.posts || []).some((p) => String(p.note || "").includes(mark));
  if (already) {
    console.log("The explanation is already on the feed. Nothing to do.");
    console.log("To put a reworded one up beside it:  make post-explainer AGAIN=1");
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
