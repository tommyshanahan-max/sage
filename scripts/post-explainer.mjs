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
// What this notice is filed under, and how the script finds an older one of
// itself. Structural, so it survives the copy being rewritten.
const TOPIC = "Getting in";

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
  /* WHAT IS ALREADY THERE, and what to do about it.
   *
   * FOUND BY WHO POSTED IT AND UNDER WHAT, not by a phrase in it. Two earlier
   * versions of this script matched on words in the copy, and both stopped
   * working the moment the copy was shortened — the second time producing two
   * copies of the notice on the feed, which is the thing the check exists to
   * prevent. The account and the topic do not move when somebody edits a
   * sentence.
   *
   * Same text already up: nothing to do. Different text: the old ones come
   * down and the new one goes up. Taking down is the admin's own route, which
   * marks a post removed rather than deleting it — the record stays, the
   * readers stop seeing it.
   */
  const HOUSE = ["the professor", "the tutor", "教授", "导师"];
  const isMine = (p) =>
    p.topic === TOPIC
    && HOUSE.includes(String(p.handle || "").toLowerCase())
    && p.state !== "removed";

  // Public, and the only list with every post on it.
  const board = await fetch(base + "/api/board").then((r) => r.json());
  const mine = (board.posts || []).filter(isMine);

  if (!rest.includes("--again") && mine.some((p) => String(p.note || "").trim() === EN.trim())) {
    console.log("The current notice is already on the feed. Nothing to do.");
    return;
  }

  for (const old of mine) {
    const r = await fetch(
      base + "/api/feed?id=" + encodeURIComponent(old.id)
        + "&why=" + encodeURIComponent("Replaced by a newer notice."),
      { method: "DELETE", headers: head });
    if (!r.ok) {
      console.error("Could not take down the older notice:", r.status);
      process.exit(1);
    }
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

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
