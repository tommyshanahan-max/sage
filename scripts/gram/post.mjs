/* Put one post on Instagram.
 *
 *   node scripts/gram/post.mjs agent-producer          post it
 *   node scripts/gram/post.mjs agent-producer --dry    print what it would do
 *   node scripts/gram/post.mjs --list                  what is ready to go
 *
 * TWO CALLS, NOT ONE. Meta's publishing API makes a container from a URL and
 * then publishes the container. The image must be fetchable by Meta's servers
 * — it cannot be uploaded — which is why make.mjs writes into site/g and the
 * site serves it: thexchange.app is public, has no invitation gate, and is
 * already the address in the caption.
 *
 * WHAT THIS NEEDS BEFORE IT WORKS, and none of it is code:
 *
 *   An Instagram Business or Creator account, linked to a Facebook Page.
 *   A Meta app with instagram_content_publish, through App Review. Days to
 *   weeks, and it is the gate — everything here is finished before it.
 *   GRAM_USER_ID and GRAM_TOKEN in .env on the box. Never in the repo.
 *
 * UNTESTED AGAINST THE LIVE API. There is no app and no token to test with,
 * so this is written from the documented shape and run --dry first. The
 * failure to expect is a permissions error on the second call.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(HERE, "out");
const BASE = process.env.GRAM_BASE || "https://thexchange.app/g";
const USER = process.env.GRAM_USER_ID || "";
const TOKEN = process.env.GRAM_TOKEN || "";
const API = "https://graph.facebook.com/v21.0";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const name = args.find((a) => !a.startsWith("--")) || "";

if (args.includes("--list") || !name) {
  const files = (await readdir(OUT)).filter((f) => f.endsWith(".png"));
  if (!files.length) { console.log("Nothing made yet.  make gram"); process.exit(0); }
  console.log("Ready to post:\n");
  for (const f of files) console.log("  " + f.replace(/\.png$/, ""));
  console.log("\n  node scripts/gram/post.mjs <name> [--dry]");
  process.exit(0);
}

/* A CLIP IF ONE WAS MADE, OTHERWISE THE STILL. Meta wants a different field
   and a different media_type for each, and posting a Reel as an image fails
   with a message about the URL rather than about the type — so the choice is
   made here from what exists on disk, not from a flag somebody has to
   remember. See clip.mjs for which posts get one. */
const mp4 = path.join(OUT, name + ".mp4");
const moving = await readFile(mp4).then(() => true, () => false);
const url = `${BASE}/${name}.${moving ? "mp4" : "png"}`;
/* The English half only. The file carries both languages separated by a rule,
   because the Chinese half goes to a different network entirely — see the note
   in make.mjs about where Instagram does not reach. */
const caption = (await readFile(path.join(OUT, name + ".txt"), "utf8")).split("\n—\n")[0].trim();

if (dry || !USER || !TOKEN) {
  if (!dry) console.log("GRAM_USER_ID / GRAM_TOKEN are not set — printing instead.\n");
  console.log((moving ? "reel     " : "image    ") + url);
  console.log("caption  " + caption.split("\n")[0]);
  console.log("\n1. POST " + API + "/" + (USER || "<user id>") + "/media");
  console.log("2. POST " + API + "/" + (USER || "<user id>") + "/media_publish");
  process.exit(0);
}

const call = async (pathname, body) => {
  const r = await fetch(`${API}/${USER}/${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, access_token: TOKEN }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) {
    console.error(pathname + " failed: " + (d.error?.message || r.status));
    process.exit(1);
  }
  return d;
};

const made = await call("media", moving
  ? { media_type: "REELS", video_url: url, caption }
  : { image_url: url, caption });

/* A REEL IS NOT READY THE MOMENT THE CONTAINER EXISTS. Meta transcodes it,
   and publishing before that finishes fails with an error about the container
   rather than about the video. A still needs none of this. */
if (moving) {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const r = await fetch(`${API}/${made.id}?fields=status_code&access_token=${TOKEN}`);
    const d = await r.json().catch(() => ({}));
    if (d.status_code === "FINISHED") break;
    if (d.status_code === "ERROR") { console.error("Meta could not process the video"); process.exit(1); }
    if (i === 29) { console.error("still transcoding after two and a half minutes"); process.exit(1); }
  }
}
const live = await call("media_publish", { creation_id: made.id });
console.log("posted  " + live.id + "  " + url);
