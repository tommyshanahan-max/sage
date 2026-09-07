/* The Professor, telling everybody the door is shut and they are holding a key.
 *
 * Short on purpose. The board folds a long post after its first paragraph, so
 * the title line is what most people read and the rest is for whoever taps.
 *
 * IDEMPOTENT, and by the one method that has survived: the title it matches on
 * IS the title it posts, held in a single constant. Two earlier versions of a
 * script like this matched a phrase in the body, and both stopped working the
 * moment the copy was shortened — the second time putting the notice up twice.
 * If somebody edits TITLE, the worst that happens is an old post stays up. A
 * duplicate is the failure that matters and this cannot produce one.
 *
 *   make post-door
 */

const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error("usage: post-door.mjs <board url> <admin key> [--as NAME] [--again]");
  process.exit(2);
}
const asIdx = rest.indexOf("--as");
const ACCOUNT = asIdx >= 0 ? rest[asIdx + 1] : "The Professor";
const TOPIC = "Getting in";

/* The first line, and the only thing most people will read. Also the marker:
   see the note above on why it is one constant and not two. */
const TITLE = "THIS PLACE IS PRIVATE NOW";

const EN = [
  TITLE,
  "",
  "Nobody can open it without a password — not a stranger with the link, not a "
  + "search engine, nobody.",
  "",
  "Yours is behind the bell at the top of this page. It changes every day and it "
  + "lets one person in. Send it to somebody worth having here.",
  "",
  "Tell them to open the link in Safari rather than inside WeChat. WeChat's browser "
  + "forgets who they are, and they would have to start again.",
].join("\n");

const ZH = [
  "这里从今天起是私密的",
  "",
  "没有口令谁也打不开——拿到链接的陌生人不行，搜索引擎也不行。",
  "",
  "你的口令在页面上面那个铃铛里，每天都换，一个口令进一个人。想让谁来，就发给谁。",
  "",
  "记得告诉他别在微信里打开，用 Safari。微信的浏览器记不住他是谁，到时候还得从头再来。",
].join("\n");

const head = { "x-admin-secret": key };

async function main() {
  /* READ THROUGH THE OPERATOR'S OWN ROUTE, not the public one.
   *
   * /api/board is what a reader's browser fetches, and with BOARD_INVITE=read it
   * is behind the door like everything else — it answers 403 to anything without
   * an admitted cookie. A script that read it there got an object with no posts
   * in it, decided nothing was up, and posted a second copy. /api/public is the
   * admin route, carries the same secret this script already holds, and is
   * exempt from the door for exactly this reason.
   */
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

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
