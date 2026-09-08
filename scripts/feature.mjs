/* The one post shown outside the door.
 *
 * WHAT MAY BE FEATURED, AND WHAT HAS TO BE ASKED ABOUT FIRST. A house post —
 * anything The Professor wrote — was written to be read by whoever finds it,
 * so featuring one costs nobody anything. A member's post was written for the
 * people behind the password, and putting it on a public page changes its
 * audience without asking. So this refuses to feature a member's post unless
 * you say you have asked them, and it prints that as the reason rather than a
 * flag name.
 *
 *   make featured                 what is out there now
 *   make feature ID=abc123        put one up (house post)
 *   make feature ID=abc123 ASKED=1   a member's, having asked them
 *   make feature-off              take it down
 */

const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error("usage: feature.mjs <board url> <admin key> [--id ID] [--asked] [--off] [--list]");
  process.exit(2);
}
const head = { "x-admin-secret": key, "Content-Type": "application/json" };
const arg = (n) => { const i = rest.indexOf("--" + n); return i >= 0 ? rest[i + 1] : ""; };
const HOUSE = ["the professor", "the tutor", "教授", "导师"];

async function main() {
  const board = await fetch(base + "/api/public", { headers: head }).then((r) => r.json());
  const posts = board.posts || [];

  if (rest.includes("--list") || (!arg("id") && !rest.includes("--off"))) {
    const now = posts.filter((p) => p.featured);
    if (!now.length) console.log("Nothing is featured. The public page shows the waiting list only.");
    for (const p of now) {
      console.log("Featured: " + p.id + "  (" + p.handle + ")");
      console.log("  " + String(p.note || "").split("\n")[0].slice(0, 70));
    }
    console.log("");
    console.log("The five newest, to choose from:");
    for (const p of posts.filter((p) => p.state === "published" && !p.re).slice(0, 5)) {
      console.log("  " + p.id + "  " + (p.handle || "—").padEnd(14).slice(0, 14)
        + String(p.note || "").split("\n")[0].slice(0, 46));
    }
    return;
  }

  if (rest.includes("--off")) {
    await fetch(base + "/api/feature", { method: "POST", headers: head, body: JSON.stringify({ on: false }) });
    console.log("Taken down. The public page shows the waiting list only.");
    return;
  }

  const id = arg("id");
  const p = posts.find((x) => x.id === id);
  if (!p) { console.error("No published post with that id."); process.exit(1); }
  const house = HOUSE.includes(String(p.handle || "").toLowerCase());
  if (!house && !rest.includes("--asked")) {
    console.error("That post is " + p.handle + "'s, and it was written for the people behind");
    console.error("the password. Featuring it puts it on a page anybody can read.");
    console.error("");
    console.error("Ask them first. Then:  make feature ID=" + id + " ASKED=1");
    process.exit(1);
  }
  const r = await fetch(base + "/api/feature", { method: "POST", headers: head, body: JSON.stringify({ id }) });
  if (!r.ok) { console.error("The board refused it:", r.status); process.exit(1); }
  console.log("Up on the public page: " + String(p.note || "").split("\n")[0].slice(0, 60));
}

main().catch((e) => { console.error(e && e.message ? e.message : e); process.exit(1); });
