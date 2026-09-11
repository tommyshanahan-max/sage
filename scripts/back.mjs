/* A member's way back in, when they are locked out of their own page.
 *
 * WHY THIS EXISTS. Everything a member is hangs off `by` — a hash of a random
 * number kept in one browser's storage. There is no account and no password,
 * which is the point, and it means there are exactly three ways back:
 *
 *   1. their key, if they wrote it down
 *   2. an email code, if their row carries an address and the box can send
 *   3. this
 *
 * The first person for whom none of the first two were true was the operator,
 * the night the board moved to a new domain and every browser on the old one
 * became a stranger. A product with no way back for the person who runs it has
 * no way back for anybody.
 *
 * WHAT IT IS. Six characters typed at the same door as everything else. It
 * opens nothing new: it moves an existing person onto the browser that types
 * it. Spent the moment it is used, and minting a second one for the same
 * person replaces the first, so there is never a drawer of live codes behind
 * somebody's name.
 *
 *   make back WHO="Tom"
 */

const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error("usage: back.mjs <board url> <admin key> --who NAME");
  process.exit(2);
}
const arg = (name) => {
  const i = rest.indexOf("--" + name);
  return i >= 0 ? rest[i + 1] : "";
};

/* The public address, for the line that gets sent. Handed in by the Makefile
 * off .env — the board answers on its own hostname inside the compose network
 * and that is not a name anybody can type. */
const PUBLIC = (process.env.BOARD_PUBLIC_URL || "https://thexchange.app").replace(/\/+$/, "");

const who = arg("who").trim();
if (!who) {
  console.error('make back WHO="their name"');
  process.exit(2);
}

const r = await fetch(base + "/api/admin/back", {
  method: "POST",
  headers: { "x-admin-secret": key, "Content-Type": "application/json" },
  body: JSON.stringify({ who }),
});
const d = await r.json().catch(() => ({}));

if (r.status === 404) {
  console.error(`No member here called "${who}". Names are as they appear on the board.`);
  process.exit(1);
}
if (!r.ok || !d.code) {
  console.error("Refused: " + (d.error || r.status));
  process.exit(1);
}

/* THE MESSAGE, NOT THE FACTS. Printed ready to send, between two rules, the
 * way `make invite` prints one — because what happens next is a person pasting
 * this into a chat at one in the morning, not reading a field called `code`.
 *
 * The link and the code travel separately in the same message for the same
 * reason they do on an invite: the link on its own opens nothing, so a link
 * forwarded by accident is not a way into somebody's account. */
const line = "─".repeat(60);
const en = [
  `${d.handle} — this puts your page back on the phone or browser you are`,
  `holding. Open the link, type the code.`,
  "",
  `${PUBLIC}/enter`,
  d.code,
  "",
  "Open it in Safari or Chrome rather than inside WeChat — WeChat keeps its",
  "own storage and you would end up with two of you.",
].join("\n");

const zh = [
  `${d.handle} —— 这个能把你的主页放回你手上这台手机或浏览器。`,
  `打开链接，输入口令就行。`,
  "",
  `${PUBLIC}/enter`,
  d.code,
  "",
  "请用 Safari 或 Chrome 打开，别在微信里打开——微信的浏览器自己存一份，",
  "会变成两个你。",
].join("\n");

// A name written in characters gets the Chinese half on its own.
const zhName = /[\u4e00-\u9fff]/.test(String(d.handle || ""));
console.log("\n" + line);
console.log(zhName ? zh : en + "\n\n" + "-".repeat(30) + "\n\n" + zh);
console.log(line);
console.log("\nEverything between the rules is the message. It works once and then");
console.log("stops. Nothing about who they are changes — the same page, the same");
console.log("people they follow, the same cards.\n");
