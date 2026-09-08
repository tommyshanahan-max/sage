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
 *   make waiting-no ID=abc123    not now
 *   make waiting-rm ID=abc123    delete the row outright
 */

const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error("usage: waiting.mjs <board url> <admin key> [--in ID|--no ID|--rm ID]");
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
async function add(name, reach, why, room) {
  const r = await fetch(base + "/api/waiting/add", {
    method: "POST", headers: head, body: JSON.stringify({ name, reach, why, room }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
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
  console.log("");
  console.log("A code is one use and it does not expire. Their rows are still");
  console.log("on the list until you delete them:  make waiting-rm ID=...");
  console.log("");
  console.log("Say it in their language if you know it:  make pitch");
}

async function main() {
  if (arg("admit")) return admit(arg("admit"), arg("max"));
  if (arg("name")) return add(arg("name"), arg("reach"), arg("why"), arg("room"));
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
  const LABEL = { film: "FILM & TV", invest: "INVESTING",
                  raise: "RAISING", other: "SOMETHING ELSE" };
  const ORDER = ["film", "invest", "raise", "other"];
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
      if (w.why) console.log(pad("", 22) + "  " + w.why.replace(/\n/g, " ").slice(0, 60));
    }
  }

  const open = rows.filter((w) => !w.done).length;
  const rooms = ORDER.filter((k) => (byRoom.get(k) || []).some((w) => !w.done)).length;
  console.log("");
  console.log(open + " waiting across " + rooms + " room" + (rooms === 1 ? "" : "s")
    + ", " + rows.length + " rows in all.");
  console.log("Let somebody in with:  make waiting-in ID=... && make invite WHO=\"their name\"");
  console.log("A row is worth deleting once it is answered:  make waiting-rm ID=...");
}

main().catch((e) => { console.error(e && e.message ? e.message : e); process.exit(1); });
