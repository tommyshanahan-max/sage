/* A whole room, on the demo board, with nobody real in it.
 *
 * NOT scripts/demo.mjs. That one puts two invented neighbours beside a REAL
 * member on the REAL board so they can see what a connection looks like, and
 * it is careful never to act as somebody who exists. This one runs against the
 * demo container, where nobody exists at all, and seeds every side of every
 * interaction — which is only safe because of where it points. It refuses to
 * run against a board that has a door on it; see the check below.
 *
 * WHY THE ROOM HAS TO BE FULL. An App Review session is a few minutes of
 * tapping. A reviewer who opens Messages and finds an empty list has been
 * shown an unfinished app, and 4.2 is the rejection that follows. So the seat
 * they land in already has eight people in Browse, four connections in Cards,
 * and two conversations with something in them — including one unread, because
 * a messenger with nothing waiting is a screenshot rather than a product.
 *
 * ONE FILM ROOM, because that is the room the real board has people in, and a
 * demo of a different product is not a demo.
 *
 * THE SENTENCES HAVE TO CROSS THE ROOM, and getting this wrong is silent. The
 * pairing rule is answerTo(): `talent` is answered by `agent` and nothing
 * else, including not by `talent`. The first version of this had Sam saying
 * "producer looking for performer" — which reads right, and puts him in
 * `talent`, the same room as the performers, where he matched nobody. Eight
 * people in Browse, zero in Cards, every conversation refused as `closed`, and
 * no error anywhere to say why.
 *
 * So: Sam is an AGENT looking for a performer, which lands him in `agent`.
 * Everybody else is talent looking for an agent, which lands them in `talent`.
 * Check any change here against roomOfPair() in board/lib/store.js rather than
 * against whether the sentence sounds like a film set.
 *
 *   node demo-board.mjs <base> <key> [--device demoreviewer...0001]
 *
 * Idempotent: it works out who is already there and only adds what is missing,
 * so running it twice does not make sixteen people.
 */
const [, , BASE, KEY, ...rest] = process.argv;
if (!BASE || !KEY) {
  console.error("demo-board.mjs <base> <key> [--device ...]");
  process.exit(1);
}
const arg = (n, d = "") => {
  const i = rest.indexOf("--" + n);
  return i >= 0 && rest[i + 1] !== undefined ? rest[i + 1] : d;
};
/* Must match BOARD_DEMO_DEVICE on the container, which is what every browser
   arriving at the demo board is pinned to. Seed a different one and the
   reviewer lands in an empty seat beside a full room, which is worse than an
   empty board. */
const ME = arg("device", "demoreviewer00000000000000000001");

const H = { "x-admin-secret": KEY, "content-type": "application/json" };
const call = async (path, opts = {}) => {
  const r = await fetch(BASE + path, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, code: r.status, d };
};
const post = (p, body) => call(p, { method: "POST", body: JSON.stringify(body) });
const put = (p, body) => call(p, { method: "PUT", body: JSON.stringify(body) });

/* THE GUARD, AND IT IS THE WHOLE REASON THIS SCRIPT IS ALLOWED TO EXIST.
 *
 * Everything below fabricates both halves of a connection. Pointed at the real
 * board it would write invented people into a room of real ones and follow
 * real members on their behalf. The demo board is the one with no door, so
 * that is what is checked — /api/admitted answers without a cookie there and
 * refuses everywhere else. A wrong --base is a typo anybody can make at
 * midnight; this turns it into a refusal instead of a cleanup. */
/* /api/admitted answers {mode, in}. `mode` is BOARD_INVITE verbatim, so an
   empty string is "there is no door" and anything else — "read", "post" — is a
   board with members behind it. */
const door = await call("/api/admitted");
if (!door.ok || door.d.mode) {
  console.error("");
  console.error("  Refusing: " + BASE + " has a door on it (BOARD_INVITE="
    + JSON.stringify(door.d.mode || "?") + ").");
  console.error("  This script fabricates both sides of every connection and");
  console.error("  belongs only on the demo board, which has BOARD_INVITE empty.");
  console.error("");
  process.exit(1);
}

const ROOM = [
  { dev: "demoperson0000000000000000000001", handle: "Mei", role: "performer",
    campus: "Shanghai", here: "Four years",
    goal: "Stage actor, four years in Shanghai, reads Mandarin and English off the page. Looking for screen work." },
  { dev: "demoperson0000000000000000000002", handle: "Ravi", role: "performer",
    campus: "Beijing", here: "Two years",
    goal: "Did two shorts and a commercial last year. I want a part with more than six lines in it." },
  { dev: "demoperson0000000000000000000003", handle: "Lena", role: "director",
    campus: "Shanghai", here: "Six years",
    goal: "Shooting a half-hour piece in the spring. I need people who can hold a long take." },
  { dev: "demoperson0000000000000000000004", handle: "Tomas", role: "writer",
    campus: "Hangzhou", here: "One year",
    goal: "Writing a two-hander set in a language school. Looking for someone to read it aloud with me." },
  { dev: "demoperson0000000000000000000005", handle: "Yara", role: "crew",
    campus: "Shanghai", here: "Three years",
    goal: "Sound. I own the kit and I have done eleven days on set this year." },
  { dev: "demoperson0000000000000000000006", handle: "Kwame", role: "performer",
    campus: "Guangzhou", here: "Five years",
    goal: "Voice work mostly, and I would like to be in front of a camera instead." },
  { dev: "demoperson0000000000000000000007", handle: "Ana", role: "performer",
    campus: "Chengdu", here: "Two years",
    goal: "Trained in Lisbon, here since 2024. Comfortable in Portuguese, English and enough Mandarin." },
  { dev: "demoperson0000000000000000000008", handle: "Jun", role: "crew",
    campus: "Shanghai", here: "Eight years",
    goal: "Camera operator. I know which building in this city will let you shoot on the roof." },
];

/* WHO CONNECTS BACK, AND WHY NOT EVERYBODY. A room where every single person
   has already matched with you is a room nobody has to do anything in — and
   the first thing a reviewer presses is a button. Four are connected, four are
   not, so Browse has something to press and Cards has something in it. */
const MATCHED = ["Mei", "Ravi", "Lena", "Yara"];

/* TWO CONVERSATIONS, and one of them unread. The second message in each is the
   reviewer's own, so the thread has both sides in it rather than reading as an
   inbox. Kept short and unremarkable: a demo conversation that tries to be
   interesting reads as written, and this is meant to look like a Tuesday. */
const TALK = [
  { who: "Mei", lines: [
    { from: "them", text: "Saw you are casting for the spring. I am in Shanghai and free most weekends." },
    { from: "me", text: "Good — what have you done that I can watch?" },
    { from: "them", text: "Two shorts on Bilibili and a stage run last March. I will send the links." },
  ] },
  { who: "Lena", lines: [
    { from: "them", text: "You produced the thing at the old cotton mill? I am shooting two streets from there." },
    { from: "me", text: "That was us. What are you short of?" },
  ] },
];

const who = async (handle) => {
  const r = await call("/api/people");
  return (r.d.people || []).find(
    (q) => String(q.handle || "").toLowerCase() === handle.toLowerCase()) || null;
};

async function seed() {
  console.log("");
  console.log("  " + BASE);
  console.log("");

  // 1. The seat the reviewer lands in.
  await put("/api/me", {
    device: ME, handle: "Sam", campus: "Shanghai", here: "Three years",
    goal: "Casting a short in Shanghai this spring. Looking for people who can act.",
    looking: true, say: [{ me: "agent", want: "performer" }],
  });
  console.log("  Sam is the seat anybody who opens this board sits in.");

  // 2. The room.
  for (const p of ROOM) {
    const r = await put("/api/me", {
      device: p.dev, handle: p.handle, campus: p.campus, here: p.here, goal: p.goal,
      looking: true, say: [{ me: p.role, want: "agent" }],
    });
    if (!r.ok) { console.log("  " + p.handle + ": " + (r.d.error || r.code)); continue; }
    console.log("  " + p.handle + " — " + p.role);
  }

  const sam = await who("Sam");
  if (!sam) { console.error("  Sam did not save. Nothing else can be hung on that."); process.exit(1); }

  // 3. The connections, both directions, which is what makes a match.
  for (const name of MATCHED) {
    const p = ROOM.find((x) => x.handle === name);
    const row = await who(name);
    if (!row) continue;
    await post("/api/follow", { device: p.dev, who: sam.id, on: true });
    await post("/api/follow", { device: ME, who: row.id, on: true });
    // 4. And the card each of them hands over, which is what Cards is for.
    await put("/api/card", { device: p.dev, wechat: name.toLowerCase() + "-demo",
      line: "Nobody is on the other end of this. It is a demo card." });
    await post("/api/card/give", { device: p.dev, who: sam.id, on: true });
    console.log("  " + name + " is connected, and has handed a card over.");
  }
  await put("/api/card", { device: ME, wechat: "sam-demo",
    line: "Nobody is on the other end of this. It is a demo card." });

  // 5. The conversations.
  for (const t of TALK) {
    const row = await who(t.who);
    if (!row) continue;
    const p = ROOM.find((x) => x.handle === t.who);
    for (const line of t.lines) {
      const r = line.from === "me"
        ? await post("/api/note", { device: ME, who: row.id, text: line.text })
        : await post("/api/note", { device: p.dev, who: sam.id, text: line.text });
      if (!r.ok) console.log("    (" + t.who + ": " + (r.d.error || r.code) + ")");
    }
    console.log("  A conversation with " + t.who + ", " + t.lines.length + " messages.");
  }

  console.log("");
  console.log("  Done. Open it and you are Sam.");
  console.log("");
}

await seed();
