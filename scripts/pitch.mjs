/* What to paste into WeChat to get somebody onto the waiting list.
 *
 * WHY A SCRIPT AND NOT A NOTE SOMEWHERE. The link that works is not the
 * obvious one. Sending somebody /enter asks them for a password they do not
 * have; sending them /feed shows them a door with nothing behind it.
 *
 * There are two links worth sending and they are for different people:
 *
 *   /r/film  and its three siblings — a door in the words of the world the
 *            person came from. The count on it is that room's, the question
 *            on it is that room's question, and the join form arrives with
 *            their room already ticked. This is the one to send when you know
 *            what somebody does.
 *
 *   /level   four questions, a result worth screenshotting, and the same
 *            waiting list under it. This is the one to send when you do not
 *            know, or into a group where half the room is a stranger.
 *
 * Both land on the same board. The separation is in the arrival and nowhere
 * else — which is the whole reason there is one product here and not two.
 *
 * Both languages every time, because the person forwarding it does not always
 * know which one the next person reads.
 *
 *   make pitch            every door
 *   make pitch ROOM=film  just that one
 */

const [, , base] = process.argv;
const HOST = (base || "https://thexchange.app").replace(/\/+$/, "");

const rule = (t) => {
  console.log("");
  console.log(t);
  console.log("-".repeat(72));
};

/* One door per room. The English and the Chinese are written separately
   rather than translated: "who writes the first cheque here" and 谁在这儿开第一张支票
   are the same question, and neither is the other one run through a
   dictionary. */
const DOORS = {
  film: {
    name: "Film & TV",
    en: `Shooting in China, or trying to?
${HOST}/r/film

Directors, casting, producers, crew — and the fixers and lawyers who
make a shoot happen. Invite only. There is a list on that page.`,
    zh: `在中国拍片，或者正想拍？
${HOST}/r/film

导演、选角、制片、剧组——还有让片子真能拍成的中间人和律师。邀请制，
那个页面上可以排队。`,
  },
  raise: {
    name: "Raising",
    en: `Raising in China?
${HOST}/r/raise

The people who write the first cheque, and the operators and lawyers you
need after it. Invite only. There is a list on that page.`,
    zh: `在中国融资？
${HOST}/r/raise

开第一张支票的人，以及拿到钱之后你会需要的操盘手和律师。邀请制，
那个页面上可以排队。`,
  },
  invest: {
    name: "Investing",
    en: `Backing people in China?
${HOST}/r/invest

Founders who are actually building, not the ones who post about it.
Invite only. There is a list on that page.`,
    zh: `在中国投人？
${HOST}/r/invest

真正在做事的创始人，不是天天发帖说的那些。邀请制，那个页面上可以排队。`,
  },
  other: {
    name: "Everything else",
    en: `${HOST}/r/other

People connecting in China, and with China. Film, money, hiring,
language — different rooms, one building. Invite only.`,
    zh: `${HOST}/r/other

在中国、以及跟中国打交道的人。影视、资金、招人、语言——不同的房间，
同一栋楼。邀请制。`,
  },
};

const only = (process.argv[3] || "").trim();
const keys = DOORS[only] ? [only] : Object.keys(DOORS);

for (const k of keys) {
  const d = DOORS[k];
  rule("TO SOMEBODY IN " + d.name.toUpperCase() + " \u2014 the door in their own words");
  console.log(d.en);
  console.log("");
  console.log(d.zh);
}

rule("WHEN YOU DO NOT KNOW WHAT THEY DO \u2014 or into a mixed group");
console.log(`Four questions, two minutes \u2014 it tells you your Chinese level out of ten.
${HOST}/level

The board itself is invite only. There is a list under your result.`);
console.log("");
console.log(`四道题，两分钟，测出你的中文水平（满分十级）。
${HOST}/level

板子本身是邀请制的。测试结果下面可以排队。`);

rule("TO SOMEBODY YOU ARE ACTUALLY BRINGING IN");
console.log(`Use your own code from behind the bell, not a link. A code is a vouch
with your name on it, and it is worth more:

  ${HOST}/enter

Write down anybody who asked and did not get one:

  make wait-add NAME="Wei" REACH="wechat weilin88" ROOM=film

And when a room has enough people in it, let them in together:

  make admit ROOM=film`);

console.log("");
console.log("A room door shows its own number once five people are waiting in it.");
console.log("Below that it shows the whole board's, which is true and is not a name.");
console.log("");
