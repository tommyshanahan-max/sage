/* Who is waiting, and crossing them off.
 *
 * The only list on this board of people who are not on it. Treat a row as
 * something to act on and then delete: a way of reaching a stranger is not a
 * record worth keeping, and the page they typed it into says so.
 *
 *   make waiting                 who is waiting, oldest first
 *   make wait-add NAME=.. REACH=.. [ROOM=film|invest|raise|other]
 *   make admit ROOM=film         let that whole room in, one code each
 *   make waiting-in ID=abc123    let in — hand them a code with `make invite`
 *   make waiting-back ID=abc123  put one back on the list, undoing an admit
 *   make waiting-no ID=abc123    not now
 *   make waiting-rm ID=abc123    delete the row outright
 */

const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error("usage: waiting.mjs <board url> <admin key> [--in ID|--no ID|--rm ID|--key ID]");
  process.exit(2);
}
const head = { "x-admin-secret": key, "Content-Type": "application/json" };
const arg = (n) => { const i = rest.indexOf("--" + n); return i >= 0 ? rest[i + 1] : ""; };

/* ADDING SOMEBODY. The list could only be joined through the public form,
   which meant the people most likely to be waiting — the ones who asked in a
   WeChat thread or in person — were the ones who could not be on it.

   Every row is still somebody who actually asked. The public page says "N
   people are waiting" and that number has to be true; this writes down an ask
   that arrived somewhere else, it does not invent a queue. */
/* THE ROOMS THIS LIST USES, WHICH ARE NOT THE ROOMS THE BOARD USES.
 *
 * WAITROOMS is film/invest/raise/trade/other; the member rooms are talent,
 * agent, hire, raise and the rest. They overlap on one word and mean different
 * things, and cleanWait falls back to "other" for anything it does not know —
 * silently, which is how ROOM=talent and ROOM=agent both filed two film people
 * under "Something else" with nothing on any screen to say so.
 *
 * Refused here rather than corrected: "did you mean film" is a guess, and a
 * guess about which room somebody belongs in is the one thing this list is
 * for. */
const WAITROOMS = ["film", "invest", "raise", "trade", "other"];

async function add(name, reach, why, room) {
  if (room && !WAITROOMS.includes(room)) {
    console.error("");
    console.error("  There is no waiting room called \"" + room + "\".");
    console.error("  This list has five:  " + WAITROOMS.join("  "));
    console.error("");
    console.error("  They are not the board's rooms. talent, agent and the rest");
    console.error("  belong on a member's sentence, not here \u2014 film is where");
    console.error("  actors, agents and producers all wait.");
    console.error("");
    process.exit(1);
  }
  const r = await fetch(base + "/api/waiting/add", {
    method: "POST", headers: head, body: JSON.stringify({ name, reach, why, room }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (d.error === "taken") {
      console.error("");
      console.error("  \"" + reach + "\" is already how " + d.who + " is reached.");
      console.error("  Rows are deduplicated on that, so adding " + name + " under it");
      console.error("  would have replaced " + d.who + " and said nothing.");
      console.error("");
      console.error("  Give them one of their own \u2014 a WeChat id, an address,");
      console.error("  an Instagram handle, or \"ask Tom - " + String(name).split(" ")[0].toLowerCase() + "\".");
      console.error("");
      process.exit(1);
    }
    console.error(d.error === "both" ? "A name and a way to reach them, both." : "It did not save.");
    process.exit(1);
  }
  console.log(d.again ? "Already on the list — that row is updated." : "On the list.");
  console.log("");
  console.log("The count on the public page appears at five. Below that it is");
  console.log("nearly a name, so it says nothing at all.");
}
const when = (iso) => String(iso || "").slice(0, 10);
const pad = (s, n) => String(s).padEnd(n).slice(0, n);

async function backKey(id) {
  const r = await fetch(base + "/api/waiting/key?id=" + encodeURIComponent(id), {
    method: "POST", headers: head,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { console.error("No row with that id."); process.exit(1); }
  console.log("");
  console.log("  " + d.name + " types this at the door:");
  console.log("");
  console.log("      " + d.code);
  console.log("");
  console.log("  It gives back their place on the list and the card they filled");
  console.log("  in. It does not let anybody in. It works once, and asking for");
  console.log("  another stops this one working.");
  console.log("");
}

async function mark(id, body) {
  const r = await fetch(base + "/api/waiting", {
    method: "POST", headers: head, body: JSON.stringify({ id, ...body }),
  });
  if (!r.ok) { console.error("No row with that id."); process.exit(1); }
  console.log("Done.");
}

/* LETTING A ROOM IN.
 *
 * The whole reason the join form asks which room. Admitting one name at a time
 * means each person arrives to a feed with nothing in it for them, decides the
 * place is empty, and does not come back — and each of those is somebody you
 * had already persuaded. A room let in together is warm on the morning they
 * get there.
 *
 * What this prints is the work: one line per person, a way to reach them and
 * the code to send. Nothing is delivered for you — a code handed over by the
 * person who runs the board is the last human moment before somebody is in,
 * and it should stay one. */
async function admit(room, max) {
  const r = await fetch(base + "/api/waiting/admit", {
    method: "POST", headers: head, body: JSON.stringify({ room, max: Number(max) || undefined }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error(d.error === "room"
      ? "Which room? film, invest, raise or other." : "It did not go through.");
    process.exit(1);
  }
  const rows = d.admitted || [];
  if (!rows.length) {
    console.log("Nobody is waiting in that room.");
    return;
  }
  console.log(rows.length + " let in. Send each of them their code:");
  console.log("");
  console.log(pad("name", 16) + pad("reach", 26) + "code");
  console.log("-".repeat(52));
  for (const w of rows) console.log(pad(w.name, 16) + pad(w.reach, 26) + w.code);

  /* AND THE MESSAGE ITSELF, one per person, ready to copy.
   *
   * The table above is the record. This is the work: twenty people admitted
   * is twenty WeChat messages typed by hand, and typing the same four lines
   * twenty times is how a code ends up sent to the wrong person, or sent
   * without its link, or not sent at all because it was late.
   *
   * Each one is addressed, carries the greet link with their name in it, and
   * carries their code underneath. Nothing sends: a code handed over by the
   * person who runs the board is the last human moment before somebody is in,
   * and it should stay one. */
  console.log("");
  console.log("=".repeat(64));
  console.log("ONE MESSAGE EACH — copy from below the line to the next one.");
  console.log("=".repeat(64));
  for (const w of rows) console.log(draft(w));

  console.log("");
  console.log("A code is one use and it does not expire. Their rows are still");
  console.log("on the list until you delete them:  make waiting-rm ID=...");
}

/* THE ADDRESS PEOPLE TYPE, which is not the one this script talks to: the
   board answers on its own hostname over the compose network. --public first
   so the Makefile can read it off .env, then the environment, then the name
   it has had all along. */
const PUBLIC = (arg("public") || process.env.BOARD_PUBLIC_URL || "https://thexchange.app")
  .replace(/\/+$/, "");

/* WHICH LANGUAGE TO WRITE IT IN.
 *
 * Nobody asked them, and asking on the join form would be a fifth field on a
 * form whose whole virtue is that it has three. So: a name written in Chinese
 * characters gets the Chinese message. It is right nearly every time and the
 * failure is mild — somebody bilingual reads a language they also read.
 *
 * Everyone else gets both, English first, because a wrong guess about a
 * stranger is worse than four extra lines. */
const isZh = (s) => /[\u4e00-\u9fff]/.test(String(s || ""));

function draft(w) {
  const link = PUBLIC + "/enter?for=" + encodeURIComponent(w.name)
    + (w.via ? "&from=" + encodeURIComponent(w.via) : "");

  /* Written as two messages, not one translated. "你在名单上了" is what a
     person says; "you are on the list" run through a dictionary is not. */
  const en = [
    w.via ? `${w.name} — you joined the list off ${w.via}. You are in.`
          : `${w.name} — you are in.`,
    "",
    link,
    w.code,
    "",
    "Tap the link and it will say hello. The code goes in on the same screen.",
    "One use, and it does not expire. Open it in Safari or Chrome rather than",
    "inside WeChat — WeChat keeps its own storage and you would end up with",
    "two of you.",
  ].join("\n");

  const zh = [
    w.via ? `${w.name}，你是从 ${w.via} 那儿排上队的。可以进来了。`
          : `${w.name}，可以进来了。`,
    "",
    link,
    w.code,
    "",
    "点开链接会先跟你打个招呼，口令就在同一个页面上输。",
    "只能用一次，不过不会过期。请用 Safari 或 Chrome 打开，别在微信里打开——",
    "微信的浏览器自己存一份，会变成两个你。",
  ].join("\n");

  const body = isZh(w.name) ? zh : en + "\n\n" + "-".repeat(30) + "\n\n" + zh;
  return "\n" + "-".repeat(64) + "\n"
    + "TO: " + w.name + "   (" + (w.reach || "no way to reach them") + ")\n\n"
    + body + "\n";
}

/* THE MESSAGE THAT ACTUALLY REACHES THEM, because nothing here does.
 *
 * A reach on this list is a WeChat id far more often than an address, and no
 * server sends to one of those. So the board does not pretend: it writes the
 * message and somebody pastes it into a chat, the same way make invite does.
 *
 * Between two rules so it can be selected in one gesture on a phone, and short
 * because it is going into a chat window and a paragraph in a chat window is
 * not read. Their name, what changed, what to do, and the link.
 */
async function tell(id) {
  const r = await fetch(base + "/api/waiting", { headers: head });
  const d = await r.json().catch(() => ({}));
  const w = (d.waits || []).find((x) => x.id === id);
  if (!w) { console.error("  no row with that id"); process.exit(1); }
  const zh = isZh(w.name) || isZh(w.why);
  /* THREE PARAGRAPHS AND THE LINK, AND THE SECOND ONE IS NOT HOUSEKEEPING.
   *
   * Their place lives in the browser they open this in and nowhere else, and
   * the ordinary way to open a WeChat link is WeChat's own browser — whose
   * storage is the most fragile there is and which cannot put anything on a
   * home screen. So somebody who does the whole thing in there can lose the
   * photograph and the card they just spent twenty minutes on, and the board
   * has no way to tell them afterwards because the row is what held the way
   * to reach them.
   *
   * Said here rather than only on the page, because by the time they are ON
   * the page they are already in the wrong browser. The page says it too —
   * see loseBox in room.html — and that one is the safety net, not the plan.
   *
   * Short, because this is pasted into a chat. Two sentences each, no
   * numbered steps, and the reason before the instruction in both. */
  const line = zh
    ? [
        w.name + "，轮到你了。",
        "",
        "你现在可以进去看看里面有些什么人了。先把自己的那页填好——一张照片，和一句话说你是谁、在找什么。填好了我这边才好放你进来。",
        "",
        "打开的时候用 Safari（或者手机自带的浏览器），别在微信里面填：微信里存不住，换个地方打开你填的东西就没了。填的时候留一个邮箱，那是唯一能把你的位置找回来的办法。",
        "",
        "在 Safari 里打开之后，点一下「分享」再选「添加到主屏幕」，用起来就跟一个 App 一样了。",
        "",
        PUBLIC + "/room",
      ]
    : [
        w.name + " — your turn came up.",
        "",
        "You can see who is in there now. Finish your own page first: a photo, and one line saying what you are and what you are looking for. That is what I read before letting anybody in.",
        "",
        "Open it in Safari rather than inside WeChat — WeChat forgets, and everything you fill in goes with it. Put an email in when it asks: that is the only way to get your place back.",
        "",
        "Once it is open in Safari, tap Share and Add to Home Screen. Then it works like an app.",
        "",
        PUBLIC + "/room",
      ];
  console.log("");
  console.log("  Send this to " + w.name + " on " + (w.reach || "\u2014") + ":");
  console.log("");
  console.log("  ---------------------------------------------------------");
  for (const l of line) console.log("  " + l);
  console.log("  ---------------------------------------------------------");
  console.log("");
  console.log("  The three-day clock starts when they OPEN it, not now \u2014 so");
  console.log("  there is no hurry on your side and none wasted on theirs.");
  console.log("");
}

async function lift(id, on) {
  /* `base` and `head`, which is what this file calls them — I wrote BASE and
     KEY from the other script in this directory and it threw a ReferenceError
     with the id already typed out on the command line. */
  const r = await fetch(base + "/api/waiting/up", {
    method: "POST",
    headers: head,
    body: JSON.stringify({ id, on }),
  });
  const d = await r.json().catch(() => ({}));
  console.log("");
  if (!r.ok) { console.log("  " + (d.error === "gone" ? "no row with that id" : d.error || r.status)); }
  else if (on) {
    console.log("  " + (d.name || "They") + " is in the waiting room.");
    console.log("  They can read the app and finish their page. Nothing works for them yet.");
    console.log("  Let them in with:  make waiting-in ID=" + id + "  && make invite WHO=\"their name\"");
  } else {
    console.log("  " + (d.name || "They") + " is back on the list.");
  }
  console.log("");
}

async function main() {
  if (arg("admit")) return admit(arg("admit"), arg("max"));
  if (arg("name")) return add(arg("name"), arg("reach"), arg("why"), arg("room"));
  /* BACK ON THE LIST. The one way out of "let in" that is not a deletion —
     for an admit that went out to a room wider than intended, or a person
     admitted before somebody had decided. Their code is a separate thing and
     stays live until it is taken back: make invite-off CODE=... */
  /* A WAY BACK FOR SOMEBODY WHOSE BROWSER FORGOT THEM. Rows are found by
     device hash and nothing else, so a cleared cache or a new phone left a
     person permanently separated from their own card. This mints one code
     against one row; they type it at the same box a member uses, and it hands
     back their place and their card rather than opening the door. */
  if (arg("key")) return backKey(arg("key"));
  /* THE WAITING ROOM. Not admission and not a `done` — see the note on `up`
     in lib/store.js. They can read the app and finish their page; letting them
     in is still --in and still a separate decision. */
  if (arg("tell")) return tell(arg("tell"));
  if (arg("up")) return lift(arg("up"), true);
  if (arg("down")) return lift(arg("down"), false);
  if (arg("back")) return mark(arg("back"), { done: "" });
  if (arg("in")) return mark(arg("in"), { done: "in" });
  if (arg("no")) return mark(arg("no"), { done: "no" });
  if (arg("rm")) return mark(arg("rm"), { remove: true });

  const d = await fetch(base + "/api/waiting", { headers: head }).then((r) => r.json());
  const rows = (d.waits || []).sort((a, b) => (a.at || "").localeCompare(b.at || ""));
  if (!rows.length) {
    console.log("Nobody is waiting.");
    return;
  }

  /* GROUPED BY ROOM, because that is the decision this list exists to serve.
     Read one name at a time you let people in one at a time, and each of them
     arrives to an empty feed. Read a room at a time you can let a room in
     together, and it is warm on the morning they get there. */
  const LABEL = { film: "FILM & TV", invest: "INVESTING", raise: "RAISING",
                  trade: "FACTORIES & BUYERS", other: "SOMETHING ELSE" };
  const ORDER = ["film", "invest", "raise", "trade", "other"];
  const byRoom = new Map(ORDER.map((k) => [k, []]));
  for (const w of rows) (byRoom.get(w.room) || byRoom.get("other")).push(w);

  for (const key of ORDER) {
    const some = byRoom.get(key) || [];
    if (!some.length) continue;
    const open = some.filter((w) => !w.done).length;
    console.log("");
    console.log(LABEL[key] + "  " + (open ? open + " waiting" : "none waiting")
      + (some.length > open ? ", " + (some.length - open) + " answered" : ""));
    console.log("-".repeat(88));
    for (const w of some) {
      console.log(pad(w.id, 22) + pad(when(w.at), 12) + pad(w.name, 16)
        + pad(w.reach, 24)
        + (w.done === "in" ? "let in" : w.done === "no" ? "turned down" : "waiting"));
      /* WHO SENT THEM, when a member's share link did. It is the difference
         between a stranger and somebody a member will vouch for, and it is
         the only thing on this list that tells them apart. */
      if (w.viaName) console.log(pad("", 22) + "  sent by " + w.viaName);
      /* AND WHO INSIDE SPOKE FOR THEM. Named rather than counted — see the
         note on /api/waiting. It is the difference between a row that moved
         up on its own and a row a member put their name to, and it is the
         answer to "who vouched for her", which is asked about people who were
         let in weeks ago. */
      if ((w.vouchedBy || []).length) {
        console.log(pad("", 22) + "  vouched by " + w.vouchedBy.join(", "));
      }
      if (w.why) console.log(pad("", 22) + "  " + w.why.replace(/\n/g, " ").slice(0, 60));
      /* WHAT THEY FILLED IN WHILE THEY WAITED, and whether a photograph is
         sitting in the queue.
         This list is the answer to "did that save" from a terminal, and it
         could not answer it: somebody uploads a picture, the panel is a
         browser away, and the only other way to look was to read the board
         file by hand. A held photograph is the one row here that needs
         somebody to do something, so it says so in those words. */
      const card = [
        w.levelBand ? w.levelBand.replace("ZH", "Chinese").replace("EN", "English") : "",
        w.type || "",
        w.want ? "wants " + w.want : "",
      ].filter(Boolean).join(" · ");
      if (card) console.log(pad("", 22) + "  " + card);
      if (w.photo) {
        console.log(pad("", 22) + "  photo " + (w.photoState === "published"
          ? "shown"
          : w.photoState === "refused" ? "refused" : "WAITING FOR YOU TO LOOK"));
      }
    }
  }

  const open = rows.filter((w) => !w.done).length;
  const rooms = ORDER.filter((k) => (byRoom.get(k) || []).some((w) => !w.done)).length;
  console.log("");
  console.log(open + " waiting across " + rooms + " room" + (rooms === 1 ? "" : "s")
    + ", " + rows.length + " rows in all.");
  const held = rows.filter((w) => w.photo && w.photoState !== "published"
    && w.photoState !== "refused").length;
  if (held) {
    console.log(held + " photograph" + (held === 1 ? " is" : "s are") + " waiting to be"
      + " looked at. Let them through in the panel, Waiting tab.");
  }
  console.log("Let somebody in with:  make waiting-in ID=... && make invite WHO=\"their name\"");
  console.log("A row is worth deleting once it is answered:  make waiting-rm ID=...");
}

main().catch((e) => { console.error(e && e.message ? e.message : e); process.exit(1); });
