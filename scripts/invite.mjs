/* Invites: make them, list them, take one back.
 *
 * A code is six characters somebody types on a phone, in a hurry, out of a
 * WeChat message — so the alphabet has no O, no zero, no I and no one in it.
 * Those are the four that get read back wrong, and a code that cannot be
 * mistyped is worth more than one with two extra bits of entropy.
 *
 * THE LABEL IS FOR YOU. It never reaches the person spending the code: it is
 * how you know who did not turn up, and how one invite is taken back without
 * touching the others.
 *
 *   make invite WHO="Mei"        one code for Mei
 *   make invite WHO="Mei" N=3    three
 *   make invites                 what is out there, and what became of it
 *   make invite-off CODE=K7M2QP  take one back
 */

const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error("usage: invite.mjs <board url> <admin key> [--who NAME] [--n 3] [--list] [--off CODE]");
  process.exit(2);
}
const arg = (name) => {
  const i = rest.indexOf("--" + name);
  return i >= 0 ? rest[i + 1] : "";
};
const head = { "x-admin-secret": key, "Content-Type": "application/json" };

/* The public address, for the line you paste into a chat. BOARD_PUBLIC_URL if
 * it is set, because the board answers on its own hostname and is reached over
 * the compose network by another name entirely.
 *
 * THE FALLBACK IS NOT THE OLD NAME ANY MORE. It was liuxuesheng.io, and
 * `make invite` did not pass BOARD_PUBLIC_URL, so every code minted after the
 * move printed a link on a domain that now 301s. It still worked — that is
 * what the redirect is for — but the first thing a stranger sees of this board
 * is the address in the message, and sending them the name we just left is a
 * link that looks forwarded from somebody else. The Makefile passes the real
 * one off .env now; this is what is left if it ever does not. */
const PUBLIC = (process.env.BOARD_PUBLIC_URL || "https://thexchange.app").replace(/\/+$/, "");

const when = (iso) => (iso ? String(iso).slice(0, 10) : "");

async function list() {
  const d = await fetch(base + "/api/invite", { headers: head }).then((r) => r.json());
  const rows = d.invites || [];
  if (!rows.length) {
    console.log("No invites yet.  make invite WHO=\"their name\"");
    return;
  }
  console.log("code".padEnd(8) + "  " + "from".padEnd(16) + "  " + "made".padEnd(11) + "  state");
  for (const v of rows) {
    /* WHO WALKED IN ON IT, and it is the whole point of reading this list.
       The row has always known — see the note on /api/invite — and the line
       said "used 2026-09-10" and stopped, which answers a question nobody
       asks. A code was used; the name is what you wanted. */
    /* RUN OUT COMES BEFORE WAITING, because a row that says "waiting" about a
       code nobody can spend is the list lying quietly. A live one says when it
       stops, in hours while that is the useful unit and in days after. */
    const left = v.until ? Date.parse(v.until) - Date.now() : 0;
    const inWords = !v.until ? ""
      : left <= 0 ? "expired"
      : left < 36 * 3600e3 ? "expires in " + Math.max(1, Math.round(left / 3600e3)) + "h"
      : "expires in " + Math.round(left / 86400e3) + "d";
    const state = v.off ? "taken back"
      : v.used ? "used " + when(v.usedAt) + (v.usedName ? " by " + v.usedName : "")
      : inWords || "waiting";
    /* `who` is the label typed when it was minted. A member making one out of
       their own header types nothing, so that column was blank on exactly the
       rows where somebody inside did the vouching. Their name stands in. */
    console.log(v.code.padEnd(8) + "  " + (v.who || v.fromName || "—").padEnd(16).slice(0, 16)
      + "  " + when(v.at).padEnd(11) + "  " + state);
  }
  const spare = rows.filter((v) => !v.used && !v.off).length;
  console.log("");
  console.log(spare + " still to give out.");
}

async function main() {
  if (rest.includes("--list")) return list();

  const off = arg("off");
  if (off) {
    const r = await fetch(base + "/api/invite?code=" + encodeURIComponent(off),
      { method: "DELETE", headers: head });
    if (!r.ok) { console.error("No invite with that code."); process.exit(1); }
    console.log(off + " will not let anybody in now. The row stays, so who had it stays.");
    return;
  }

  const who = arg("who");
  const n = Number(arg("n")) || 1;
  /* HOW LONG IT LASTS. Nothing by default — see the note on /api/invite — and
     a number of hours when this code is for one person tonight. */
  const hours = Number(arg("hours")) || 0;
  /* WHO IT IS FOR, which is not the same as WHO. `who` is the label on the
     invite row — whoever vouched — and it is what the door says on the way
     in. This is the name of the person receiving it, and it goes in the link
     rather than in the board: it greets them and nothing else, so it is never
     stored, never checked, and opens nothing. */
  const forWhom = arg("for");
  /* AN INVITE FOR SOMEBODY WHO ARRIVES REPRESENTING OTHER PEOPLE.
   *
   * THE MECHANICS DO NOT CHANGE, and that is deliberate — the invite is
   * settled. Same block between two rules, same link and code on separate
   * lines, same named greeting, same clock, same one person once, same line
   * about WeChat's browser. What changes is two sentences of what it is for,
   * and where the door puts them down: an agent lands on the console that
   * takes their folder rather than on a deck of strangers. */
  const agent = rest.includes("--agent");
  const r = await fetch(base + "/api/invite", {
    method: "POST", headers: head,
    body: JSON.stringify({ who, n, hours, kind: agent ? "agent" : "" }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("The board refused it:", r.status, d.error || "");
    process.exit(1);
  }

  /* Printed as the message you actually send, because the failure mode of a
     bare code is somebody pasting it with no link and the person on the other
     end having nowhere to type it. */
  /* The link carries the two names when there are two names. A door that
     opens with "Welcome, Christopher — Keith asked me to let you in" is a
     different arrival from a password box, and it costs nothing but a query
     string. Neither name is a credential; the code still is. */
  /* THE DEADLINE TRAVELS IN THE LINK, AND THE CODE NEVER DOES.
   *
   * See the note in enter.html: a code in the address is a code that lets
   * anybody in who was forwarded the link, so the six characters arrive
   * separately and are typed on purpose. A deadline is the opposite — it opens
   * nothing, it only draws a clock, and it is the one thing somebody holding
   * this link actually wants to know without typing anything.
   *
   * NOT AUTHORITY. Edit it and you get a wrong clock; the row is what the door
   * checks and it stops on time either way. The only person who could fool
   * themselves with it is the person holding it. */
  /* SECONDS SINCE 1970, NOT AN ISO STRING. This link is pasted into a WeChat
     message by a person; `until=2026-09-14T16%3A14%3A04.562Z` on the end of it
     is ten characters of meaning and thirty of noise, and a link that looks
     like a tracking parameter is a link people hesitate over. `t=1789574044`
     is the same instant. */
  const t = hours ? Math.round((Date.now() + hours * 3600e3) / 1000) : 0;
  const q = [
    forWhom ? "for=" + encodeURIComponent(forWhom) : "",
    who ? "from=" + encodeURIComponent(who) : "",
    t ? "t=" + t : "",
  ].filter(Boolean).join("&");
  const link = PUBLIC + "/enter" + (q ? "?" + q : "");

  /* ONE BLOCK, WRITTEN THE WAY IT IS ACTUALLY SENT.
   *
   * This printed a heading, a link and a code on three lines, and what happens
   * next is somebody copying them one at a time into WeChat at midnight —
   * which on a bad night means pasting them into the terminal instead. The
   * message is the thing being made here, so the tool makes the message.
   *
   * The lines below the rule are not part of it. Everything between the rules
   * is what goes in the chat. */
  /* WHAT IT IS, BEFORE WHAT IT DOES. The message opened with the mechanics —
   * invite only, works for a day, one person — to somebody who had not been
   * told what they were being let into. A private club for doing business
   * through who you know, cross-border investment and entertainment: that is
   * the sentence Tom says out loud when he explains it, so it goes first and
   * the rules go after it.
   * 人脉 rather than a translation of "social network": in a mainland ear the
   * English phrase means Facebook, and 人脉 means exactly the thing this board
   * is about — the people you can actually call. */
  /* WRAPPED FOR A CHAT WINDOW, not for a terminal. These lines are pasted into
   * WeChat and read on a phone, where a sixty-character line breaks once and a
   * ninety-character one breaks somewhere different on every screen. Done here
   * rather than by hand so the sentence about hours can be any length. */
  const wrap = (t, n = 62) => {
    const out = [];
    let line = "";
    for (const w of t.split(" ")) {
      if (line && (line + " " + w).length > n) { out.push(line); line = w; }
      else line = line ? line + " " + w : w;
    }
    if (line) out.push(line);
    return out.join("\n");
  };

  const lasts = hours
    ? " It works for " + hours + (hours === 1 ? " hour" : " hours") + " and lets one person in, once."
    : " It lets one person in, once.";
  const lastsZh = hours
    ? "有效期 " + hours + " 小时，只能一个人用一次。"
    : "只能一个人用一次。";

  /* BOTH LANGUAGES, the way `make admit` has always printed them — and not one
   * of them translated. Most of the people these go to read Chinese first, and
   * a name written in characters gets the Chinese half on its own, because
   * sending somebody an English paragraph they did not need is its own small
   * insult.
   *
   * AND THE LINE ABOUT WECHAT, which the admit drafts carried and this did not.
   * WeChat's own browser keeps its own storage: a code opened inside the chat
   * makes a person who exists nowhere else, and then the same human opening the
   * board properly a day later is a stranger with an empty page and a spent
   * code. It is the single most expensive mistake somebody can make with one of
   * these messages, and it costs one sentence to prevent. */
  const zhName = /[\u4e00-\u9fff]/.test(String(forWhom || ""));
  for (const v of d.made) {
    const en = [
      forWhom ? wrap(forWhom + " — this is the board I mentioned. A private club"
        + " for doing business through who you know: cross-border investment"
        + " and entertainment, mostly.") : "",
      forWhom ? "" : "",
      /* THE OBJECTION, ANSWERED IN THE MESSAGE RATHER THAN ON A PAGE.
         An agent's whole hesitation is "I am not putting my list somewhere a
         producer can go round me", and they will decide that before they open
         anything. So the answer goes here, where it is read. */
      forWhom && agent ? wrap("You would not be handing over your list."
        + " Everybody you represent gets their own page, you run all of them"
        + " from one login, and when somebody wants one of them they are"
        + " talking to you.") : "",
      forWhom && agent ? "" : "",
      forWhom && agent ? wrap("Do it on a laptop and you can drag the whole"
        + " folder in — headshots, CVs, all of it — and it does the typing.") : "",
      forWhom && agent ? "" : "",
      forWhom ? wrap("Invite only, so here is your way in." + lasts) : "",
      forWhom ? "" : "",
      link,
      v.code,
      "",
      "Open it in Safari or Chrome rather than inside WeChat — WeChat keeps its",
      "own storage and you would end up with two of you.",
    ].filter((x, i, a) => !(x === "" && a[i - 1] === "")).join("\n");

    const zh = [
      forWhom ? forWhom + " —— 就是我跟你说的那个板子。一个靠人脉做生意的私人圈子，" : "",
      forWhom ? "主要是跨境投资和影视娱乐。" : "",
      forWhom ? "" : "",
      // 写的，不是翻的。经纪人最先想的是「我的人名单凭什么给你」，
      // 所以先把这句说清楚，再说怎么进。
      forWhom && agent ? "不是让你把名单交出去。你带的每个人都有自己的主页，" : "",
      forWhom && agent ? "你一个账号全管；谁看上了你的人，联系的还是你。" : "",
      forWhom && agent ? "" : "",
      forWhom && agent ? "用电脑打开的话，整个文件夹拖进去就行——定妆照、简历，" : "",
      forWhom && agent ? "都不用你打字。" : "",
      forWhom && agent ? "" : "",
      forWhom ? "只能被邀请进来，这是你的入口。" + lastsZh : "",
      forWhom ? "" : "",
      link,
      v.code,
      "",
      "请用 Safari 或 Chrome 打开，别在微信里打开——微信的浏览器自己存一份，",
      "会变成两个你。",
    ].filter((x, i, a) => !(x === "" && a[i - 1] === "")).join("\n");

    console.log("");
    console.log("─".repeat(60));
    console.log(zhName ? zh : en + "\n\n" + "-".repeat(30) + "\n\n" + zh);
    console.log("─".repeat(60));
  }
  console.log("");
  console.log("Everything between the rules is the message. Send the code with the"
    + " link — the link on its own opens nothing.");
  if (hours) {
    console.log("It stops working on its own at "
      + new Date(Date.now() + hours * 3600e3).toISOString().slice(0, 16).replace("T", " ")
      + " UTC. Nothing to remember.");
  }
  if (!forWhom) {
    console.log("");
    console.log('Name them and the door greets them by it:  make invite WHO="you" FOR="their name"');
  }
  if (!hours) {
    console.log('Give it a life:  make invite WHO="you" FOR="them" HOURS=24');
  }
}

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
