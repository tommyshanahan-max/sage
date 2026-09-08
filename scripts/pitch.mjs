/* What to paste into WeChat to get somebody onto the waiting list.
 *
 * WHY A SCRIPT AND NOT A NOTE SOMEWHERE. The link that works is not the
 * obvious one. Sending somebody /enter asks them for a password they do not
 * have; sending them /feed shows them a door. The one public thing worth
 * opening is the level test: four questions, a result they will screenshot,
 * and the waiting list sitting under that result — which is the only path on
 * this board that turns a stranger into a row in `make waiting`.
 *
 * Both languages every time, because the person forwarding it does not always
 * know which one the next person reads.
 *
 *   make pitch
 */

const [, , base] = process.argv;
const HOST = (base || "https://liuxuesheng.io").replace(/\/+$/, "");

const rule = (t) => {
  console.log("");
  console.log(t);
  console.log("-".repeat(72));
};

rule("TO ONE PERSON — the test, which is the only public thing worth opening");
console.log(`Four questions, two minutes — it tells you your Chinese level out of ten.
${HOST}/level

The board itself is invite only. If you want in, there is a list under
your result.`);
console.log("");
console.log(`四道题，两分钟，测出你的中文水平（满分十级）。
${HOST}/level

板子本身是邀请制的。想进来的话，测试结果下面可以排队。`);

rule("TO A GROUP — nothing about you, so it survives being forwarded");
console.log(`Someone made a Chinese level test — four questions, no sign-up, works
without a VPN. ${HOST}/level`);
console.log("");
console.log(`有人做了个中文水平测试——四道题，不用注册，不用翻墙。${HOST}/level`);

rule("TO SOMEBODY YOU ARE ACTUALLY BRINGING IN");
console.log(`Use your own code from behind the bell, not this. A code is a vouch
with your name on it, and it is worth more than a link:

  ${HOST}/enter

Then write down anybody who asked and did not get a code:

  make wait-add NAME="Wei" REACH="wechat weilin88" WHY="imports ceramics"`);

console.log("");
console.log("The count on the public page appears at five. Below that it is nearly");
console.log("a name, so the page says nothing at all.");
console.log("");
