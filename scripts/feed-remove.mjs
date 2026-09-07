/* Take a post off the feed, by id.
 *
 * The panel can do this and so can the person who wrote it. This is for the
 * third case: something posted by hand from an account nobody is sitting at
 * any more, on a box somebody is already ssh'd into.
 *
 * Removing marks a post removed rather than deleting it — the same thing the
 * panel's button does. The row stays in the file with a reason on it, and
 * readers stop seeing it. Nothing here can delete anything.
 *
 *   make feed-list              what is up, with ids
 *   make feed-remove ID=abc123  take that one down
 */

const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error("usage: feed-remove.mjs <board url> <admin key> [--id <id>] [--why <reason>]");
  process.exit(2);
}
const arg = (name) => {
  const i = rest.indexOf("--" + name);
  return i >= 0 ? rest[i + 1] : "";
};

const head = { "x-admin-secret": key };
const ID = arg("id");
const WHY = arg("why") || "Taken down from the box.";

const one = (p) => {
  const words = String(p.note || "").replace(/\s+/g, " ").trim();
  return [
    p.id,
    (p.handle || "—").padEnd(14).slice(0, 14),
    (p.topic || "").padEnd(12).slice(0, 12),
    words.slice(0, 54) + (words.length > 54 ? "…" : ""),
  ].join("  ");
};

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
  const posts = board.posts || [];

  if (!ID) {
    if (!posts.length) { console.log("Nothing on the feed."); return; }
    console.log("id".padEnd(20) + "  " + "who".padEnd(14) + "  " + "topic".padEnd(12) + "  words");
    for (const p of posts) console.log(one(p));
    console.log("");
    console.log("Take one down with:  make feed-remove ID=<id>");
    return;
  }

  const post = posts.find((p) => p.id === ID);
  if (!post) {
    // It may already be down — /api/board only carries what readers can see.
    console.error("No post with that id is on the feed. It may already be down.");
    process.exit(1);
  }
  console.log("Taking down:");
  console.log(one(post));

  const r = await fetch(
    base + "/api/feed?id=" + encodeURIComponent(ID) + "&why=" + encodeURIComponent(WHY),
    { method: "DELETE", headers: head });
  if (!r.ok) {
    console.error("The board refused it:", r.status);
    process.exit(1);
  }
  console.log("");
  console.log("Down. Nobody sees it; the row stays in the file with the reason on it.");
}

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
