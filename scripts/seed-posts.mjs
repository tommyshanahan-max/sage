/* A history for the demo people.
 *
 * ---------------------------------------------------------------------------
 * READ THIS BEFORE RUNNING IT
 *
 * What gives a seeded board away is not the faces, it is the clock: everybody
 * arrives in the same second and nobody has ever said anything. This writes
 * the missing part — posts spread over three weeks, at hours people are
 * actually awake, with replies and likes between them, so the board reads as
 * somewhere that has been running rather than somewhere that was switched on.
 *
 * It changes nothing about what these people are. They are invented, nobody
 * answers for them, and a convincing history makes that more consequential
 * rather than less. Take them down before real students are relying on the
 * board, or be ready to answer as them.
 *
 * Usage, on the server:
 *   make feed-posts
 *
 * Idempotent: it looks on the board for the first words of a post it would
 * write, and stops if they are already there. Run it twice and the second run
 * does nothing.
 * --------------------------------------------------------------------------- */

import { createHash } from "node:crypto";

const args = process.argv.slice(2);
const BASE = (args[0] || "").replace(/\/+$/, "");
const KEY = args[1] || "";
if (!BASE || !KEY) {
  console.error("usage: node scripts/seed-posts.mjs <board url> <admin key>");
  process.exit(1);
}

// The same derivation the people were made with, so a post lands on the right
// profile rather than on a name that merely matches.
const deviceFor = (name) =>
  createHash("sha256").update("liuxuesheng-seed-v1:" + name).digest("hex").slice(0, 32);

/* The board. `ago` is in hours, so the newest of these sits above the joining
 * announcements the people arrived with — otherwise three "joined" cards share
 * the top of the feed and the whole thing looks switched on this morning.
 *
 * Written as things these three would actually know. A demo board full of
 * "Hello! I am looking for a study partner!" tells a visitor nothing except
 * that nobody real is here. */
const POSTS = [
  { key: "wen-library", who: "Wen", ago: 18 * 24 + 3, topic: "Where to study",
    text: "The old reading room at PKU is open to anyone with a student card from any university. Nobody has ever checked mine and I have been going for two years. Quietest place in Haidian on a Sunday." },

  { key: "hao-order", who: "Haoran", ago: 17 * 24 + 11, topic: "Getting set up",
    text: "Bank card first, then the phone number. Not the other way round. I have watched three exchange students do it backwards and lose a week each time." },

  { key: "xy-cat", who: "Xiaoya", ago: 15 * 24 + 9, topic: "Language swap",
    text: "今天用英文帮阿姨找到了她的猫。她一直说 thank you thank you，我说 no problem。原来我的口语没有我以为的那么差。" },

  { key: "wen-panjiayuan", who: "Wen", ago: 12 * 24 + 2, topic: "Beijing",
    text: "潘家园周末想淘到东西的话，八点前去。人少，摊主愿意讲价，也没有人围着你。十点以后基本上是给游客看的。" },

  { key: "xy-reply-panjiayuan", who: "Xiaoya", ago: 11 * 24 + 20, re: "wen-panjiayuan",
    text: "去年跟朋友去过一次，八点前和十点后真的是两个地方。" },

  { key: "hao-bike", who: "Haoran", ago: 11 * 24 + 6, topic: "Getting set up",
    text: "共享单车莫名其妙扣钱，一般是没停在停车区。App 里可以申诉，写清楚时间和地点，两天左右退回来。别嫌麻烦，我退过四次。" },

  { key: "xy-canteen", who: "Xiaoya", ago: 9 * 24 + 12, topic: "Food",
    text: "The third floor canteen will do a vegetarian version of nearly everything if you ask. It is not written anywhere on the menu. Just say 素的 and point." },

  { key: "hao-sockets", who: "Haoran", ago: 8 * 24 + 1, topic: "Tsinghua",
    text: "The 24-hour room in the west building has a power socket at every seat. The east one does not. I found this out at one in the morning with 4% battery." },

  { key: "wen-reply-sockets", who: "Wen", ago: 7 * 24 + 21, re: "hao-sockets",
    text: "This is why I write everything in the west building. It is not the chairs, they are terrible." },

  { key: "wen-tones", who: "Wen", ago: 6 * 24 + 5, topic: "Language swap",
    text: "If your teacher tells you your tones are fine, they are being kind to you. Ask a stranger for directions and watch their face. That test is free and it is the only honest one." },

  { key: "hao-reply-tones", who: "Haoran", ago: 5 * 24 + 22, re: "wen-tones",
    text: "Harsh. Also completely true — it works the same way for my English." },

  { key: "xy-artlib", who: "Xiaoya", ago: 4 * 24 + 8, topic: "Where to study",
    text: "Art library, second floor, the desks by the window. Almost nobody goes because the door looks locked from outside. It is not locked. Please do not all go at once." },

  { key: "hao-passport", who: "Haoran", ago: 2 * 24 + 14, topic: "Getting set up",
    text: "If an app demands a Chinese ID number and you only have a passport, try the desktop site before giving up. About half of them accept a passport on the website and not in the app. Nobody can tell me why." },

  { key: "xy-outloud", who: "Xiaoya", ago: 9, topic: "Language swap",
    text: "Reading and speaking are not the same skill and it took me a year to work that out. Say things out loud even when there is nobody there. You will feel stupid for a week and then you will not." },

  { key: "wen-cafes", who: "Wen", ago: 4, topic: "Where to study",
    text: "Making a list of hutong cafes that will not move you on after one drink. Four so far, all near Nanluoguxiang. I want to check they are still open before I put it up — two closed over the summer." },
];

/* Who likes what. Cheap, and a board where nothing has ever been liked reads
 * as a board nobody has opened. */
const LIKES = [
  ["Xiaoya", "hao-order"], ["Wen", "hao-order"],
  ["Haoran", "wen-panjiayuan"], ["Xiaoya", "wen-panjiayuan"],
  ["Wen", "xy-cat"], ["Haoran", "xy-cat"],
  ["Xiaoya", "hao-sockets"],
  ["Haoran", "xy-artlib"], ["Wen", "xy-artlib"],
  ["Xiaoya", "wen-tones"], ["Wen", "hao-passport"],
];

const when = (hoursAgo) => new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString();

async function post(p, ids) {
  const form = new FormData();
  form.append("account", p.who);
  form.append("body", p.text);
  form.append("at", when(p.ago));
  form.append("device", deviceFor(p.who));
  if (p.topic) form.append("topic", p.topic);
  if (p.re) {
    const parent = ids.get(p.re);
    if (!parent) throw new Error(`${p.key} replies to ${p.re}, which was not written`);
    form.append("re", parent);
  }
  const r = await fetch(BASE + "/api/feed", {
    method: "POST", headers: { "x-admin-secret": KEY }, body: form,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.id) throw new Error(`${p.key}: ${d.error || r.status}`);
  return d.id;
}

async function main() {
  // Already done? Asked of the board rather than remembered in a file, so this
  // is still true after the script is copied to another box.
  const live = await (await fetch(BASE + "/api/public?secret=" + encodeURIComponent(KEY))).json();
  const seen = new Set((live.posts || []).map((x) => (x.note || "").slice(0, 40)));
  if (POSTS.some((p) => seen.has(p.text.slice(0, 40)))) {
    console.log("these are already on the board — nothing to do");
    return;
  }

  const ids = new Map();
  // Oldest first, so a reply is never written before the thing it answers.
  for (const p of [...POSTS].sort((a, b) => b.ago - a.ago)) {
    ids.set(p.key, await post(p, ids));
    console.log(`${p.who}: ${p.re ? "replied" : "posted"} — ${p.text.slice(0, 46)}…`);
  }

  // The joining announcements were written the moment the people were made, so
  // without this they sit together at the top of the board with the same
  // timestamp — three strangers arriving in the same second, which is the one
  // thing that says "seeded" no matter how good the rest of it is. Spread back
  // through the same three weeks, each a little after the post that person
  // wrote before it.
  const all = await (await fetch(BASE + "/api/public?secret=" + encodeURIComponent(KEY))).json();
  const joinings = (all.posts || []).filter((p) => p.looking);
  const spread = { Wen: 16 * 24, Haoran: 19 * 24, Xiaoya: 13 * 24 };
  for (const j of joinings) {
    const hours = spread[j.handle];
    if (hours === undefined) continue;   // somebody real; leave their clock alone
    const r = await fetch(
      `${BASE}/api/feed/when?id=${encodeURIComponent(j.id)}&at=${encodeURIComponent(when(hours))}`
      + `&secret=${encodeURIComponent(KEY)}`, { method: "POST" });
    if (r.ok) console.log(`moved ${j.handle}'s joining back to when they arrived`);
    else console.error(`could not move ${j.handle}'s joining: ${r.status}`);
  }

  for (const [who, key] of LIKES) {
    const r = await fetch(BASE + "/api/post", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ like: ids.get(key), device: deviceFor(who) }),
    });
    if (!r.ok) console.error(`like ${who} -> ${key}: ${r.status}`);
  }
  console.log(`${LIKES.length} likes`);
}

main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
