/* Two people who are not real, so somebody can see what a full room does.
 *
 * WHY THIS EXISTS AND WHAT IT REFUSES TO DO. "Show me what it looks like when
 * I have connections" is a fair question and there was no way to answer it: a
 * match needs two people to have each of them pressed something, and the
 * operator cannot press for a member — follows carry that member's own device
 * hash, which is the whole point of them.
 *
 * So this makes members who are nobody. They are named, they have sentences
 * that answer yours, and they are removable in one command. What it will not
 * do is act as somebody who exists: a row saying Hugo connected with you, when
 * Hugo did not, is the one thing that would make the Cards tab worth nothing —
 * including to the person who asked for it, who then cannot trust their own
 * screen.
 *
 *   node demo.mjs <base> <key> add   --for Tom [--n 2]
 *   node demo.mjs <base> <key> cards --for Tom      (once you have connected back)
 *   node demo.mjs <base> <key> rm
 *
 * The two halves are two commands because the middle step is yours: they
 * connect to you, you press Connect on each of them in Browse, and only then
 * can a card be handed over — which is the rule this board runs on and not a
 * rule this script gets to skip.
 */
/* THE REAL TABLES, NOT A COPY OF THEM.
 *
 * This runs inside the board's own container, where lib/store.js is the file
 * the server is using — so the roles, the rooms and which room answers which
 * are read from it rather than restated here. A second copy of the matching
 * rules in a demo script is a second copy that drifts, and the first thing it
 * does when it drifts is make demo people who cannot match anybody, which is
 * the one job this has. */
let ROLES = null, answerTo = (r) => r;
for (const where of ["/app/lib/store.js",
                     new URL("../board/lib/store.js", import.meta.url).href]) {
  try {
    const store = await import(where);
    ROLES = store.ROLES; answerTo = store.answerTo;
    break;
  } catch { /* the other path, or neither — see the fallback below */ }
}

const [, , BASE, KEY, CMD, ...rest] = process.argv;
if (!BASE || !KEY || !CMD) {
  console.error("demo.mjs <base> <key> add|cards|rm [--for NAME] [--n 2]");
  process.exit(1);
}
const arg = (n, d = "") => {
  const i = rest.indexOf("--" + n);
  return i >= 0 && rest[i + 1] !== undefined ? rest[i + 1] : d;
};
const A = { "x-admin-secret": KEY, "content-type": "application/json" };

/* The device string is fixed and obvious, so `rm` can find them again and
   nobody wonders later which rows were real. */
const DEMOS = [
  { dev: "demo0000000000000000000000000001", handle: "Marco",
    goal: "Not a real person — a demo row Tom made to see how this looks.",
    campus: "Shanghai", here: "Two years" },
  { dev: "demo0000000000000000000000000002", handle: "Ivy",
    goal: "Not a real person — a demo row Tom made to see how this looks.",
    campus: "Beijing", here: "Three years" },
  { dev: "demo0000000000000000000000000003", handle: "Bruno",
    goal: "Not a real person — a demo row Tom made to see how this looks.",
    campus: "Shenzhen", here: "One year" },
];

const call = async (path, opts = {}) => {
  const r = await fetch(BASE + path, { ...opts, headers: { ...A, ...(opts.headers || {}) } });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, code: r.status, d };
};

/** Your row, whole — the sentence and the rooms it put you in. */
async function rowOf(handle) {
  const r = await call("/api/people");
  return (r.d.people || []).find(
    (q) => String(q.handle || "").toLowerCase() === handle.toLowerCase()) || null;
}

/* WHAT THEY HAVE TO SAY TO ANSWER YOU.
 *
 * The obvious version — your sentence backwards — is right until somebody is
 * looking for ANYONE, which is most people who have not thought about it. That
 * is not a role: "anyone" on the left of a sentence is dropped by the server,
 * so the demo person lands in no room, matches nobody, and the whole exercise
 * quietly produces two strangers who cannot see each other.
 *
 * So the rooms decide it. Whatever rooms you are in, they need a role standing
 * in the room that answers one of them — which is the same test the board runs
 * to decide who comes up on your screen. */
function answering(you) {
  const say = (you.say || []).filter((s) => s.me && s.want);
  const plain = say.find((s) => s.want && s.want !== "anyone");

  /* THE ROOMS FIRST, AND YOUR SENTENCE ONLY AS A FALLBACK.
   *
   * Reversing the sentence looks obviously right and is wrong whenever the two
   * halves of it do not share a room. "I am an Agent looking for an Investor"
   * is a real thing to want and puts you in the agent room; an investor
   * looking for an agent lands in invest. Neither answers the other, so the
   * demo produced two people who could not see each other and no explanation
   * on any screen.
   *
   * What decides who comes up is the room, so that is what this reads. */
  const rooms = Array.isArray(you.rooms) ? you.rooms : [];
  if (ROLES) {
    for (const room of rooms) {
      const need = answerTo(room);
      for (const [role, def] of Object.entries(ROLES)) {
        if (!def.rooms.includes(need)) continue;
        // Their half is the role you said you are, when you said one.
        const back = (say[0] && ROLES[say[0].me]) ? say[0].me : "anyone";
        return { me: role, want: back };
      }
    }
  }
  return plain ? { me: plain.want, want: plain.me } : null;
}

async function add() {
  const forWho = arg("for");
  if (!forWho) { console.error('  --for your handle, so their sentence answers yours'); process.exit(1); }
  const you = await rowOf(forWho);
  if (!you) { console.error("  no page called " + forWho); process.exit(1); }
  const mine = answering(you);
  if (!mine) {
    console.error("  " + forWho + " has no sentence yet — nothing for them to answer.");
    console.error("  Put one up first: Profile, under your name.");
    process.exit(1);
  }
  console.log("");
  console.log("  " + forWho + " is in " + ((you.rooms || []).join(", ") || "no room")
    + "; they will say " + mine.me + " looking for " + mine.want + ".");
  const n = Math.max(1, Math.min(DEMOS.length, Number(arg("n", "2")) || 2));
  for (const one of DEMOS.slice(0, n)) {
    const inv = await call("/api/invite", { method: "POST", body: JSON.stringify({ n: 1, who: "demo" }) });
    const code = inv.d.made[0].code;
    await call("/api/enter", { method: "POST", body: JSON.stringify({ code, device: one.dev }) });
    await call("/api/me", { method: "PUT", body: JSON.stringify({
      device: one.dev, handle: one.handle, goal: one.goal,
      campus: one.campus, here: one.here, looking: true,
      // Yours, in reverse. They are what you are looking for, and they are
      // looking for what you are — which is the whole of the match rule.
      say: [{ me: mine.me, want: mine.want }],
    }) });
    // Find you, and connect.
    const ppl = await call("/api/people");
    const you = (ppl.d.people || []).find(
      (q) => String(q.handle || "").toLowerCase() === forWho.toLowerCase());
    if (you) {
      await call("/api/follow", { method: "POST", body: JSON.stringify({
        device: one.dev, who: you.id, on: true }) });
    }
    console.log("  " + one.handle + " is in, and has connected with " + forWho + ".");
  }
  console.log("");
  console.log("  Now open Browse and press Connect on each of them.");
  console.log("  Then:  make demo-cards WHO=\"" + forWho + "\"");
  console.log("");
}

async function cards() {
  const forWho = arg("for");
  if (!forWho) { console.error('  --for your handle'); process.exit(1); }
  const ppl = await call("/api/people");
  const you = (ppl.d.people || []).find(
    (q) => String(q.handle || "").toLowerCase() === forWho.toLowerCase());
  if (!you) { console.error("  no page called " + forWho); process.exit(1); }
  console.log("");
  let gave = 0;
  for (const one of DEMOS) {
    const mine = (ppl.d.people || []).find(
      (q) => String(q.handle || "").toLowerCase() === one.handle.toLowerCase());
    if (!mine) continue;
    await call("/api/card", { method: "PUT", body: JSON.stringify({
      device: one.dev, wechat: one.handle.toLowerCase() + "_demo",
      line: "A demo card. Nothing on the other end of it." }) });
    const out = await call("/api/card/give", { method: "POST", body: JSON.stringify({
      device: one.dev, who: you.id, on: true }) });
    if (out.ok) { gave++; console.log("  " + one.handle + " handed you their card."); }
    else if (out.d.error === "nomatch") {
      console.log("  " + one.handle + ": not matched yet — press Connect on them first.");
    } else console.log("  " + one.handle + ": " + (out.d.error || out.code));
  }
  console.log("");
  console.log(gave ? "  Open Cards. That is what a connection looks like.\n"
                   : "  Nothing handed over yet.\n");
}

async function rm() {
  const ppl = await call("/api/people");
  console.log("");
  for (const one of DEMOS) {
    const row = (ppl.d.people || []).find(
      (q) => String(q.handle || "").toLowerCase() === one.handle.toLowerCase());
    if (!row) continue;
    // Their card first: an empty card is a deleted card, and it takes every
    // grant with it.
    await call("/api/card", { method: "PUT", body: JSON.stringify({ device: one.dev, wechat: "", line: "" }) });
    // Held rather than deleted, the same as anybody else taken out of the
    // room: the row stays, and nothing that pointed at it becomes a dangling
    // reference. It is out of Browse and out of everybody's matches.
    const out = await call("/api/person/out", { method: "POST", body: JSON.stringify({ handle: one.handle }) });
    console.log("  " + one.handle + (out.ok ? " is gone." : ": " + (out.d.error || out.code)));
  }
  console.log("");
}

if (CMD === "add") await add();
else if (CMD === "cards") await cards();
else if (CMD === "rm") await rm();
else { console.error("  unknown: " + CMD); process.exit(1); }
