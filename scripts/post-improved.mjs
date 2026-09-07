/* The Professor, naming one person a week whose level moved.
 *
 * WHY NOT "BEST MARKS". Two reasons, and the second is the real one.
 *
 * The first: the grade never leaves anybody's phone. It is worked out from a
 * deck, a streak and a set of counters that live in localStorage, and ranking
 * it would mean uploading a score per person — a thing this board does not
 * hold and has no reason to start holding.
 *
 * The second: nobody wants to be named the most diligent. Being seen to try
 * hard is the least flattering thing a social product can say about somebody,
 * and a leaderboard of effort is a list nobody wants to top. A leaderboard of
 * popularity is worse: it is a hierarchy, published weekly, on a board where
 * everybody knows each other.
 *
 * A LEVEL THAT MOVED IS NEITHER. It rotates on its own — whoever moved this
 * week — it cannot be gamed by being liked, and it creates no losers, because
 * there is no bottom of a list with one name on it.
 *
 * AND IT IS NOT A SUPERLATIVE. "Most improved" says you were bad before, which
 * on a board of twenty people is a backhanded compliment with a name attached.
 * This states the fact — went from three to five — and lets being named be the
 * whole of the award.
 *
 * ONLY PEOPLE WHO MADE THEIR LEVEL PUBLIC. The band is on a profile because
 * they pressed "put this on my page". Nobody is named for a number they kept.
 *
 *   make post-improved
 */

const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error("usage: post-improved.mjs <board url> <admin key> [--as NAME] [--again] [--dry]");
  process.exit(2);
}
const asIdx = rest.indexOf("--as");
const ACCOUNT = asIdx >= 0 ? rest[asIdx + 1] : "The Professor";
const TOPIC = "study";

/* The marker, and the thing it posts, in one constant — the same rule the
   other Professor scripts learned the hard way. */
const TITLE = "A level moved this week";

const head = { "x-admin-secret": key };
const DAYS = 7;

const num = (band) => Number(String(band || "").split(" ")[1] || 0);
const which = (band) => (String(band || "").startsWith("ZH") ? "zh" : "en");

/** What their level was DAYS ago: the last band set on or before the cutoff,
 *  or the first one they ever had if every entry is inside the window. */
function bandBefore(bands, cutoff) {
  const older = bands.filter((b) => b.at && b.at <= cutoff);
  if (older.length) return older[older.length - 1].band;
  return bands.length ? bands[0].band : "";
}

async function main() {
  const d = await fetch(base + "/api/public?queue=1", { headers: head }).then((r) => r.json());
  const people = (d.people || []).filter((q) => q.state === "published" && q.handle && q.levelBand);
  const cutoff = new Date(Date.now() - DAYS * 86400000).toISOString();

  let best = null;
  for (const q of people) {
    const bands = Array.isArray(q.bands) ? q.bands : [];
    // Nothing to compare against: they have had one level since they arrived.
    if (bands.length < 2) continue;
    // Only a move that happened inside the window counts. Somebody who jumped
    // four levels a month ago is not this week's news.
    if (!bands.some((b) => b.at > cutoff)) continue;
    const was = num(bandBefore(bands, cutoff));
    const now = num(q.levelBand);
    if (!was || now <= was) continue;
    if (!best || now - was > best.gain) best = { who: q.handle, was, now, gain: now - was, band: q.levelBand };
  }

  if (!best) {
    console.log("Nobody's level moved in the last " + DAYS + " days. Nothing to post.");
    return;
  }
  if (rest.includes("--dry")) {
    console.log("Would post:", best.who, best.was, "->", best.now);
    return;
  }

  const lang = which(best.band) === "zh" ? "Chinese" : "English";
  const EN = [
    TITLE,
    "",
    best.who + "'s " + lang + " went from level " + best.was + " to level " + best.now + " this week.",
    "",
    "Four questions, one minute, if you want to see where yours is: /level",
  ].join("\n");
  const ZH = [
    "这周有人的水平变了",
    "",
    best.who + "的" + (which(best.band) === "zh" ? "中文" : "英文")
      + "这周从第 " + best.was + " 级到了第 " + best.now + " 级。",
    "",
    "四道题，一分钟，想知道自己在哪一级就去：/level",
  ].join("\n");

  const board = await fetch(base + "/api/public", { headers: head }).then((r) => r.json());
  const HOUSE = ["the professor", "the tutor", "教授", "导师"];
  const mine = (board.posts || []).filter((p) =>
    p.state !== "removed"
    && HOUSE.includes(String(p.handle || "").toLowerCase())
    && String(p.note || "").trim().startsWith(TITLE));

  /* One a week, not one a run. This is meant for a cron and a cron that fires
     twice must not say the same thing twice. */
  const recent = mine.find((p) => (p.at || "") > cutoff);
  if (recent && !rest.includes("--again")) {
    console.log("Already said this week (" + recent.id + "). Nothing to do.  (--again to replace)");
    return;
  }
  for (const old of mine) {
    await fetch(base + "/api/feed?id=" + encodeURIComponent(old.id)
      + "&why=" + encodeURIComponent("Replaced by this week's."),
      { method: "DELETE", headers: head });
  }

  const form = new FormData();
  form.set("account", ACCOUNT);
  form.set("body", EN);
  form.set("zh", ZH);
  form.set("topic", TOPIC);
  const r = await fetch(base + "/api/feed", { method: "POST", headers: head, body: form });
  if (!r.ok) {
    console.error("The board refused it:", r.status, (await r.text()).slice(0, 200));
    process.exit(1);
  }
  console.log("Up: " + best.who + " " + best.was + " → " + best.now + ", as " + ACCOUNT + ".");
}

main().catch((e) => { console.error(e && e.message ? e.message : e); process.exit(1); });
