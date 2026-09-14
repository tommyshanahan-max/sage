/* Telling the list that the room is open.
 *
 * Forty-seven people joined a queue. The queue is a room they can talk in now
 * and not one of them knows, because nothing on this board can reach into
 * WeChat. Somebody has to tell them, one at a time, and the only job worse
 * than that is doing it twice to the same person.
 *
 * SO THE ROW REMEMBERS. Printed or sent, it is marked, and a second run shows
 * only whoever has arrived since. `--again` includes everybody.
 *
 * WHAT GOES BY MAIL AND WHAT GOES BY HAND. An address is sent to. Everything
 * else — a WeChat id, a phone number, a sentence — is printed as a block to
 * paste. And a warning worth reading before trusting the first: 163, QQ and
 * 126 are most of the Chinese addresses on this list and all three are unkind
 * to a young sending domain, so mail to them is a coin toss. See lib/mail.js.
 *
 * NOTHING IS SENT WITHOUT --send. The default prints everything, including
 * what WOULD be mailed, and marks nobody — so the first run is always a look.
 *
 *   make tell-rooms              see the list, mark nobody
 *   make tell-rooms SEND=1       send the mail, print the rest, mark them told
 *   make tell-rooms AGAIN=1      include people already told
 */

const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error("usage: tell-rooms.mjs <board url> <admin key> [--send] [--again] [--public URL]");
  process.exit(2);
}
const arg = (n) => { const i = rest.indexOf("--" + n); return i < 0 ? "" : (rest[i + 1] || ""); };
const SEND = rest.includes("--send");
const AGAIN = rest.includes("--again");
const SITE = (arg("public") || "https://thexchange.app").replace(/\/+$/, "");
const head = { "x-admin-secret": key };

const ROOMS = {
  film: ["Film & TV", "影视"],
  invest: ["Investing", "投资"],
  raise: ["Raising", "融资"],
  trade: ["Factories & buyers", "工厂和买家"],
  other: ["Something else", "其他"],
};

/* WHICH LANGUAGE TO WRITE IN, and it is a guess made from what they typed.
   A Chinese character anywhere in their name or their line means they read
   Chinese; there is nothing better to go on and asking would be another
   message. Wrong occasionally, and an English speaker reading one Chinese
   sentence is a smaller cost than the reverse. */
const zh = (s) => /[一-鿿]/.test(String(s || ""));

const words = (r) => {
  const key2 = ROOMS[r.room] ? r.room : "other";
  const url = SITE + "/r/" + key2;
  if (zh(r.name) || zh(r.why)) {
    return `${r.name}，你在 The Exchange 的名单上。\n\n现在名单变成房间了 —— ${ROOMS[key2][1]}这屋里的人已经在说话，你也可以直接说。\n\n${url}\n\n写个名字就进去了。存到桌面，不然下次还得翻链接。`;
  }
  return `${r.name} — you are on the list at The Exchange.\n\nThe list is a room now: the ${ROOMS[key2][0]} room is talking and you can talk in it, today, without waiting to be let in.\n\n${url}\n\nPut your name in and you are in. Keep it on your home screen or you will be hunting for this link tomorrow.`;
};

const r = await fetch(base + "/api/tell-rooms" + (AGAIN ? "?again=1" : ""), { headers: head });
if (!r.ok) { console.error("That did not go through."); process.exit(1); }
const d = await r.json();
const rows = d.rows || [];

console.log("");
console.log(`  ${d.waiting} waiting · ${d.told} already told · ${rows.length} to go`);
console.log("");

if (!rows.length) {
  console.log("  Everybody has been told. `make tell-rooms AGAIN=1` to see them anyway.");
  console.log("");
  process.exit(0);
}

const byHand = [];
const byMail = [];
for (const row of rows) (row.mail ? byMail : byHand).push(row);

/* BY HAND FIRST, because that is the job. The mail half sends itself. */
if (byHand.length) {
  console.log("  " + "─".repeat(64));
  console.log(`  BY HAND — ${byHand.length} to paste into WeChat`);
  console.log("  " + "─".repeat(64));
  for (const row of byHand) {
    console.log("");
    console.log(`  ${row.name}   (${row.reach || "no way to reach them"})`);
    console.log("  " + "─".repeat(64));
    console.log(words(row).split("\n").map((l) => "  " + l).join("\n"));
    console.log("  " + "─".repeat(64));
  }
  console.log("");
}

if (byMail.length) {
  console.log(`  BY MAIL — ${byMail.length} with an address`);
  for (const row of byMail) console.log(`    ${row.name}  ${row.reach}`);
  console.log("");
  /* THE WARNING, HERE RATHER THAN IN A COMMENT NOBODY READS. */
  if (byMail.some((x) => /@(163|qq|126)\./i.test(x.reach))) {
    console.log("  Some of those are 163, QQ or 126. Mail to them from a young");
    console.log("  sending domain lands in spam as often as not — see lib/mail.js.");
    console.log("");
  }
}

if (!SEND) {
  console.log("  Nobody has been marked and no mail has gone out.");
  console.log("  make tell-rooms SEND=1   to send the mail and mark them all told");
  console.log("");
  process.exit(0);
}

/* SENDING IS A SEPARATE CALL PER HALF, and the marking follows the sending
   rather than leading it: a run that dies halfway has told the people it told
   and nobody else. */
if (byMail.length) {
  const sent = [];
  for (const row of byMail) {
    const s = await fetch(base + "/api/tell-mail", {
      method: "POST", headers: { ...head, "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, text: words(row) }),
    }).then((x) => x.json()).catch(() => ({}));
    if (s && s.ok) sent.push(row.id);
    else console.log(`    ${row.name}: did not go`);
  }
  console.log(`  Sent ${sent.length} of ${byMail.length}.`);
}

if (byHand.length) {
  await fetch(base + "/api/tell-rooms", {
    method: "POST", headers: { ...head, "Content-Type": "application/json" },
    body: JSON.stringify({ ids: byHand.map((x) => x.id), how: "hand" }),
  }).catch(() => {});
  console.log(`  Marked ${byHand.length} as told by hand. Paste the blocks above.`);
}
console.log("");
