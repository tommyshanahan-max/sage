/* The Professor, saying where the whole place has got to.
 *
 * WHY THE NUMBERS ONLY EVER GO UP. A daily "3 posts today, nobody new" is a
 * notice, in public, every morning, that nothing is happening here — the same
 * mistake as a personal panel full of zeros, except this one is permanent and
 * everybody reads it. So these are TOTALS, not a day's activity: people,
 * things posted, levels tested. A total cannot read backwards, and on a board
 * that is growing at all it always says the true encouraging thing.
 *
 * AND IT ONLY SPEAKS WHEN SOMETHING MOVED. Run it every morning if you like:
 * it works out what the totals were when it last posted, and if they are the
 * same it says nothing. A daily post that sometimes does not appear is a
 * board that is alive; a daily post that says the same numbers is furniture.
 *
 * NOTHING HERE IDENTIFIES ANYBODY. Room counts are only named at three or
 * more: "one person is raising money" on a board of twelve is a name with a
 * number in front of it, and anybody can open Browse and work out whose.
 *
 *   make post-numbers          say it, if anything moved
 *   make post-numbers DRY=1    what it would say
 */

const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error("usage: post-numbers.mjs <board url> <admin key> [--as NAME] [--again] [--dry]");
  process.exit(2);
}
const asIdx = rest.indexOf("--as");
const ACCOUNT = asIdx >= 0 ? rest[asIdx + 1] : "The Professor";
const TOPIC = "ask";
const TITLE = "Where this has got to";
const FLOOR = 3;               // below this, a room count names a person

const head = { "x-admin-secret": key };
const own = (p) => !p.re && !p.like && !p.report;

const ROOMS = {
  lang: ["a language exchange", "语伴"],
  study: ["somebody to study with", "一起学习的人"],
  new: ["somebody who knows the city", "熟悉这座城市的人"],
  host: ["to show people around", "带人转转"],
  job: ["work or an internship", "工作或实习"],
  hire: ["somebody to hire", "要招的人"],
  cofound: ["a co-founder", "合伙人"],
  raise: ["to raise money", "融资"],
  invest: ["to invest", "投资"],
  buy: ["to buy from China", "从中国采购"],
  sell: ["to sell from China", "从中国供货"],
};

/** The totals as they stood at a moment. Passing no cutoff gives today's. */
function totals(people, posts, cutoff) {
  const before = (x) => !cutoff || (x.at || "") <= cutoff;
  const live = people.filter((q) => q.state === "published" && q.handle && before(q));
  return {
    people: live.length,
    posts: posts.filter((p) => p.state === "published" && own(p) && before(p)).length,
    tested: live.filter((q) => q.levelBand).length,
    rooms: live.reduce((m, q) => {
      for (const r of (q.rooms || [])) m[r] = (m[r] || 0) + 1;
      return m;
    }, {}),
  };
}

async function main() {
  const q = await fetch(base + "/api/public?queue=1", { headers: head }).then((r) => r.json());
  const pub = await fetch(base + "/api/public", { headers: head }).then((r) => r.json());
  const people = q.people || [];
  const posts = pub.posts || [];

  const HOUSE = ["the professor", "the tutor", "教授", "导师"];
  const mine = posts.filter((p) => p.state !== "removed"
    && HOUSE.includes(String(p.handle || "").toLowerCase())
    && String(p.note || "").trim().startsWith(TITLE))
    .sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  const last = mine[0];

  const now = totals(people, posts);
  /* WHAT THE NUMBERS WERE WHEN IT LAST SPOKE, worked out from the dates rather
     than remembered: this runs in a container with a read-only mount and
     nothing to write state into, and a script that needs a file to be correct
     is a script that is wrong after the first restart. */
  const then = last ? totals(people, posts, last.at) : null;
  const moved = !then || now.people !== then.people || now.posts !== then.posts
    || now.tested !== then.tested;

  if (!moved && !rest.includes("--again")) {
    console.log("Nothing has moved since the last one. Saying nothing.");
    return;
  }

  // The busiest room, and only if enough people are in it to hide anybody.
  const top = Object.entries(now.rooms).filter(([, n]) => n >= FLOOR)
    .sort((a, b) => b[1] - a[1])[0];

  const en = [
    TITLE, "",
    now.people + " people. " + now.posts + " things posted. "
      + now.tested + " have tested their Chinese or English.",
  ];
  const zh = [
    "这里到哪一步了", "",
    now.people + " 个人，" + now.posts + " 条内容，" + now.tested + " 个人测过自己的中文或英文。",
  ];
  if (top) {
    en.push("", top[1] + " of them are looking for " + ROOMS[top[0]][0] + ".");
    zh.push("", "其中 " + top[1] + " 个人在找" + ROOMS[top[0]][1] + "。");
  }
  en.push("", "Invite somebody you would actually want to sit next to. Your password is behind the bell.");
  zh.push("", "邀请一个你真愿意坐在旁边的人。你的口令在铃铛里。");

  if (rest.includes("--dry")) {
    console.log(en.join("\n"));
    console.log("");
    console.log("(was: " + (then ? JSON.stringify(then).slice(0, 80) : "never posted") + ")");
    return;
  }

  /* The old one comes down. Two of these on a feed is a chart nobody asked
     for, and the older numbers are the less true ones. */
  for (const old of mine) {
    await fetch(base + "/api/feed?id=" + encodeURIComponent(old.id)
      + "&why=" + encodeURIComponent("Replaced by newer numbers."),
      { method: "DELETE", headers: head });
  }

  const form = new FormData();
  form.set("account", ACCOUNT);
  form.set("body", en.join("\n"));
  form.set("zh", zh.join("\n"));
  form.set("topic", TOPIC);
  const r = await fetch(base + "/api/feed", { method: "POST", headers: head, body: form });
  if (!r.ok) {
    console.error("The board refused it:", r.status, (await r.text()).slice(0, 200));
    process.exit(1);
  }
  console.log("Up: " + now.people + " people, " + now.posts + " posts, "
    + now.tested + " tested.");
}

main().catch((e) => { console.error(e && e.message ? e.message : e); process.exit(1); });
