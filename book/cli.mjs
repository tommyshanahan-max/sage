/* The shelf from a terminal. Run inside the container by the Makefile:
 *
 *   make book-teacher SHELF=studypal NAME="Li Wei" ZH=李薇 \
 *        LINE="Beginners · speaks English" PRICE=¥120 HOURS="mon-fri 19:00 20:00; sat 10:00"
 *   make book-list                 who is on which shelf, and what is booked
 *   make book-off NAME="Li Wei"    hide a teacher (NAME=… again with book-on)
 *   make book-cancel ID=…          free a booked slot
 *   make book-demo                 four made-up teachers on the "demo" shelf
 *   make book-live NAME=Julia      a live class: her link to go live, and one
 *                                  link for the group to watch
 *
 * Values come in as environment variables, not arguments, so a name with a
 * space or a line with a "·" in it survives make, docker and the shell
 * without anybody having to think about quoting.
 *
 * ADDING A TEACHER WHO IS ALREADY THERE UPDATES THEM — same shelf, same name.
 * Changing somebody's hours is the same command as adding them, with the new
 * hours, which is one thing to remember instead of two.
 */
import { load, save, newId, cleanTeacher, cleanBooking, cleanTeam, DAYS, slotsFor, HOUSE_CUT } from "./lib/store.mjs";
import { teamView } from "./lib/team.mjs";
import { newLive, closeRoom } from "./lib/live.mjs";
import { createHash, randomBytes } from "node:crypto";

const E = process.env;
// Where the booking service is reached from outside, for printing room links.
const PUBLIC = (E.BOOK_PUBLIC || "https://thexchange.app/book").replace(/\/$/, "");
const cmd = process.argv[2] || "list";

/** "mon-fri 19:00 20:00; sat 10:00" → { mon: [...], ..., sat: [...] } */
function parseHours(txt) {
  const out = {};
  for (const part of String(txt || "").split(";")) {
    const [days, ...times] = part.trim().split(/\s+/);
    if (!days || !times.length) continue;
    const pick = [];
    for (const piece of days.toLowerCase().split(",")) {
      const [a, b] = piece.split("-");
      const i = DAYS.indexOf(a), j = b ? DAYS.indexOf(b) : i;
      if (i < 0 || j < 0) { console.error(`Not a day: ${piece} (use mon tue wed thu fri sat sun)`); process.exit(1); }
      for (let k = i; ; k = (k + 1) % 7) { pick.push(DAYS[k]); if (k === j) break; }
    }
    for (const d of pick) out[d] = [...(out[d] || []), ...times];
  }
  return out;
}

/** A team by its lead's name, or stop and say so. */
function teamNamed(db, name) {
  const t = db.teams.find((x) => x.name.toLowerCase() === String(name).toLowerCase());
  if (!t) { console.error(`No team led by ${name}. Make it first: make book-lead NAME="${name}"`); process.exit(1); }
  return t;
}

const when = (iso) => iso.replace("T", " ").replace("+08:00", " Beijing");

if (cmd === "cast-test") {
  const { newTestCast } = await import("./lib/cast.mjs");
  const l = newTestCast(E.NAME || "Tom", E.TITLE || "Live from China");
  console.log(`\n  YOU, on your phone:   ${l.go}\n  EVERYBODY ELSE:       ${l.watch}\n\n  Open for 12 hours.\n`);
} else if (cmd === "shop-import") {
  /* The 微店 reader's JSON on stdin (make shop-sync pipes it here), names
     put into English once. Prints what the shop now shows. */
  const { importItems } = await import("./lib/shop.mjs");
  const { translate } = await import("./lib/speak.mjs");
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  let pulled;
  try { pulled = JSON.parse(raw); } catch { console.error("That was not the reader's JSON. Run make shop-sync SHOP=…"); process.exit(1); }
  const items = await importItems(pulled, (zh) => translate(zh, "en", "shop-import"));
  for (const x of items) console.log(`  ¥${String(x.cny).padEnd(7)} ${x.en || "(not translated)"}  ·  ${x.zh}`);
  console.log(`\n  ${items.length} in the shop: https://call.laonei.co/shop`);
} else if (cmd === "shop-wants") {
  const db = load();
  const name = new Map(db.shop.items.map((x) => [x.id, x.en || x.zh]));
  if (!db.shop.wants.length) console.log("  Nobody has asked for anything yet.");
  for (const w of db.shop.wants.slice(-50)) console.log(`  ${w.at.slice(0, 16).replace("T", " ")}  ${name.get(w.item) || w.item}  ←  ${w.name || "?"} · ${w.reach} · ${w.country || "?"}`);
} else if (cmd === "bench") {
  /* SUBTITLE MODELS, SIDE BY SIDE: make book-bench [A=claude-opus-5] [B=claude-haiku-4-5]
     The same sentences through both, on the box's own key: how long each
     took, and whether it came back in the wrong language or answered
     instead of translating (a reply far longer than what was said). Two
     dozen short calls — cents. Words are printed so the misses can be read. */
  const { once, MODEL } = await import("./lib/speak.mjs");
  const A = (E.A || MODEL).trim(), B = (E.B || "claude-haiku-4-5").trim();
  const HAN = /[\u3400-\u9fff]/;
  const said = [
    ["Hello, can you hear me?", "zh"], ["Where shall we eat tonight?", "zh"],
    ["It costs 120 yuan, is that too much?", "zh"], ["ok", "zh"],
    ["What's the capital of Australia?", "zh"], ["my name is Tom and I live in Beijing", "zh"],
    ["你好，你听得到吗？", "en"], ["我们晚上去哪儿吃饭", "en"],
    ["这个多少钱", "en"], ["哈喽", "en"], ["你觉得我的中文怎么样？", "en"], ["我明天下午三点有空，你呢", "en"],
  ];
  const tally = { [A]: { ms: 0, bad: 0, n: 0 }, [B]: { ms: 0, bad: 0, n: 0 } };
  for (const [text, to] of said) {
    const row = [`${to === "zh" ? "EN→中" : "中→EN"}  ${text}`];
    for (const m of [A, B]) {
      const t0 = Date.now();
      let out = "", note = "";
      try { out = await once(text, to, m); } catch (e) { note = "ERROR " + (e.status || e.message); }
      const ms = Date.now() - t0;
      if (!note && (to === "zh" ? !HAN.test(out) : HAN.test(out))) note = "WRONG LANGUAGE";
      if (!note && out.length > Math.max(40, text.length * 4)) note = "ANSWERED?";
      tally[m].ms += ms; tally[m].n += 1; if (note) tally[m].bad += 1;
      row.push(`   ${m.padEnd(18)} ${String(ms).padStart(5)}ms  ${note || out}`);
    }
    console.log(row.join("\n"));
  }
  console.log("");
  for (const m of [A, B]) console.log(`${m.padEnd(18)} average ${Math.round(tally[m].ms / tally[m].n)}ms   problems ${tally[m].bad}/${tally[m].n}`);
} else if (cmd === "teacher") {
  if (!E.SHELF || !E.NAME) { console.error('Needs SHELF="…" and NAME="…".'); process.exit(1); }
  const db = load();
  const shelf = E.SHELF.toLowerCase();
  const old = db.teachers.find((t) => t.shelf === shelf && t.name.toLowerCase() === E.NAME.toLowerCase());
  const row = cleanTeacher({
    ...(old || { id: newId() }),
    // The name as first written: "li wei" typed in a hurry finds Li Wei and
    // leaves her called Li Wei.
    shelf, name: old ? old.name : E.NAME,
    ...(E.ZH !== undefined && E.ZH !== "" ? { zh: E.ZH } : {}),
    ...(E.LINE ? { line: E.LINE } : {}),
    ...(E.TAGS ? { tags: E.TAGS.split(",") } : {}),
    ...(E.PRICE ? { price: E.PRICE } : {}),
    ...(E.MINUTES ? { minutes: E.MINUTES } : {}),
    ...(E.PHOTO ? { photo: E.PHOTO } : {}),
    ...(E.VOICE ? { voice: E.VOICE } : {}),
    ...(E.PAY ? { pay: E.PAY } : {}),
    ...(E.FEE ? { fee: E.FEE } : {}),
    ...(E.LEAD ? { lead: teamNamed(db, E.LEAD).id } : {}),
    ...(E.HOURS ? { hours: parseHours(E.HOURS) } : {}),
    on: true,
  });
  if (!row) { console.error("That teacher did not come out valid."); process.exit(1); }
  db.teachers = db.teachers.filter((t) => t.id !== row.id).concat(row);
  save(db);
  const n = Object.values(row.hours).reduce((a, x) => a + x.length, 0);
  console.log(`${old ? "Updated" : "Added"} ${row.name} on "${row.shelf}" — ${n} lesson${n === 1 ? "" : "s"} a week.`);
  if (!n) console.log('No hours yet: add HOURS="mon-fri 19:00 20:00" to open some.');
} else if (cmd === "off" || cmd === "on") {
  const db = load();
  const t = db.teachers.find((x) => x.name.toLowerCase() === String(E.NAME || "").toLowerCase());
  if (!t) { console.error(`No teacher called ${E.NAME}.`); process.exit(1); }
  t.on = cmd === "on";
  save(db);
  console.log(`${t.name} is ${t.on ? "back on" : "hidden from"} "${t.shelf}".`);
} else if (cmd === "cancel") {
  const db = load();
  const b = db.bookings.find((x) => x.id === E.ID);
  if (!b) { console.error(`No booking ${E.ID}.`); process.exit(1); }
  b.off = true;
  save(db);
  console.log(`Cancelled — ${when(b.start)} is free again.`);
} else if (cmd === "lead") {
  /* A TEAM AND ITS LEAD. make book-lead NAME=Julia [CUT=20] [FEE=100 SHELF=…]
     With FEE she teaches too: a teacher row on SHELF under her own team, whose
     lessons are hers whole (after Tom's cut). Prints her portal link — the
     key is in it, so it goes to her and nobody else. */
  if (!E.NAME) { console.error('Needs NAME="…".'); process.exit(1); }
  const db = load();
  let t = db.teams.find((x) => x.name.toLowerCase() === E.NAME.toLowerCase());
  const cut = E.CUT !== undefined && E.CUT !== "" ? Number(E.CUT) : t ? t.cut : 20;
  const row = cleanTeam({ ...(t || { id: newId() }), name: t ? t.name : E.NAME, cut });
  db.teams = db.teams.filter((x) => x.id !== row.id).concat(row);
  t = row;
  if (E.FEE) {
    const shelf = (E.SHELF || "studypal").toLowerCase();
    const old = db.teachers.find((x) => x.id === t.self);
    const me = cleanTeacher({ ...(old || { id: newId(), shelf, name: t.name }), fee: E.FEE, lead: t.id,
      ...(E.HOURS ? { hours: parseHours(E.HOURS) } : {}), ...(E.LINE ? { line: E.LINE } : {}), on: true });
    db.teachers = db.teachers.filter((x) => x.id !== me.id).concat(me);
    t.self = me.id;
  }
  save(db);
  console.log(`${t.name}'s team — she gets ${t.cut}% on top of each tutor's fee; you get ${HOUSE_CUT}%.`);
  console.log(`Add tutors: make book-teacher SHELF=studypal NAME="…" FEE=100 LEAD="${t.name}" HOURS="…"`);
  console.log(`\nHer portal — send her this, and only her:\n  ${PUBLIC}/team#${t.key}`);
} else if (cmd === "owed") {
  /* WHAT TOM OWES, AND WHERE TO SEND IT. Every team lead: earned, paid, owed,
     and her bank in full — this is the one place the whole card number is
     printed, because this is where the money is sent from. Then every tutor's
     earnings this month, and Tom's own. Record a payout with book-paid. */
  const db = load();
  if (!db.teams.length) console.log("No teams yet. make book-lead NAME=Julia");
  for (const t of db.teams) {
    const v = teamView(db, t);
    console.log(`\n${t.name} — owed ${"¥" + v.owed} · this month ${"¥" + v.month.total} · pay on ${v.payday}`);
    console.log(t.bank && t.bank.card
      ? `  ${t.bank.bank} · ${t.bank.name} · ${t.bank.card}${t.bank.branch ? " · " + t.bank.branch : ""}`
      : "  no bank yet — she sets it in her portal");
    for (const x of v.tutors) console.log(`  ${x.name}: ${x.lessons} lessons, ${"¥" + x.made} this month (+¥${x.you} to ${t.name})`);
  }
  const mo = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 7);
  const house = db.bookings.filter((b) => !b.off && b.money && Date.parse(b.start) <= Date.now()
    && new Date(Date.parse(b.start) + 8 * 3600e3).toISOString().slice(0, 7) === mo).reduce((n, b) => n + b.money.house, 0);
  console.log(`\nYours this month: ¥${house}`);
} else if (cmd === "paid") {
  // make book-paid NAME=Julia AMOUNT=14000 — after sending it, so owed goes down.
  const db = load();
  const t = teamNamed(db, E.NAME || "");
  const amount = Math.round(Number(String(E.AMOUNT || "").replace(/[^\d.]/g, "")));
  if (!amount) { console.error('Needs AMOUNT=… (yuan).'); process.exit(1); }
  t.paid.push({ at: new Date().toISOString(), amount });
  save(db);
  console.log(`Recorded ¥${amount} paid to ${t.name}. Owed now ¥${teamView(db, t).owed}.`);
} else if (cmd === "live") {
  /* A LIVE CLASS: two links. NAME is the teacher, as the group will see it.
     WHEN is Beijing time and optional — without it the class is open now,
     for the next twelve hours. TITLE is optional too. */
  const made = newLive({ host: E.NAME, title: E.TITLE, when: E.WHEN, max: E.MAX });
  if (made.error) { console.error(made.error.replace("host is", "NAME is").replace("when is", "WHEN is")); process.exit(1); }
  const l = made.live;
  const db = load();
  db.lives.push(l);
  save(db);
  console.log(`Live class — ${l.host}${l.title ? ", " + l.title : ""}, ${when(l.start.slice(0, 16) + "+08:00")}. Up to ${l.max} watching.\n`);
  console.log(`  ${l.host} goes live here (send only to ${l.host}):\n  ${PUBLIC}/live/${l.id}#${l.hKey}\n`);
  console.log(`  Everybody else watches here (send to the group):\n  ${PUBLIC}/live/${l.id}#${l.vKey}\n`);
  console.log(`Open until twelve hours after it starts. Done early: make book-live-off ID=${l.id}`);
} else if (cmd === "live-off") {
  const db = load();
  const l = db.lives.find((x) => x.id === E.ID);
  if (!l) { console.error(`No live class ${E.ID || "(ID=…)"}.`); process.exit(1); }
  l.off = true;
  save(db);
  await closeRoom("live-" + l.id);
  console.log(`Closed. Both links for ${l.host}'s live class now say it is over.`);
} else if (cmd === "app") {
  /* A KEY FOR AN APP THAT STARTS LIVES ITSELF — Laonei first. Printed once
     and kept here only as a hash, so this file cannot give it back; running
     this again for the same NAME makes a new key and the old one stops
     working, which is also how a leaked key is dealt with. OFF=1 removes the
     app's key altogether. */
  const name = String(E.NAME || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!name) { console.error("Needs NAME=laonei — the app the key is for."); process.exit(1); }
  const db = load();
  db.apps = db.apps.filter((a) => a.name !== name);
  if (E.OFF) { save(db); console.log(`${name} has no key now. Its lives stay as they are.`); process.exit(0); }
  const key = "bk_" + randomBytes(24).toString("hex");
  db.apps.push({ name, hash: createHash("sha256").update(key).digest("hex"), at: new Date().toISOString() });
  save(db);
  // RAW=1: the key alone, for `make book-app INTO=…` to write straight into
  // the app's settings file without it ever being on a screen.
  if (E.RAW) { process.stdout.write(key); process.exit(0); }
  console.log(`Key for ${name} — goes in ${name}'s own server settings, never in a page:\n\n  ${key}\n`);
  console.log(`It is shown once. Lost: run this again for a new one (the old one stops).`);
} else if (cmd === "test") {
  /* A REAL BOOKING TO TRY THE VIDEO ON: the first free slot of the first
     teacher on SHELF (default studypal), booked for "Test", and both links
     printed — one for a phone, one for a laptop. The room opens straight
     away, so the call can be tried now rather than at the lesson's time. */
  const shelf = (E.SHELF || "studypal").toLowerCase();
  const db = load();
  const t = db.teachers.find((x) => x.shelf === shelf && x.on);
  if (!t) { console.error(`Nobody on "${shelf}". Try: make book-demo SHELF=${shelf}`); process.exit(1); }
  const slot = slotsFor(db, t, { days: 14 }).flatMap((d) => d.slots).find((x) => x.free);
  if (!slot) { console.error(`${t.name} has no free time in the next two weeks.`); process.exit(1); }
  const b = cleanBooking({ id: newId(), teacher: t.id, start: slot.start, name: "Test", contact: "test",
    note: "made by make book-test", at: new Date().toISOString(), off: false });
  db.bookings.push(b);
  save(db);
  console.log(`Test lesson with ${t.name}. Open one link on your phone and one on the laptop:\n`);
  console.log(`  student:  ${PUBLIC}/room/${b.id}#${b.sKey}`);
  console.log(`  teacher:  ${PUBLIC}/room/${b.id}#${b.tKey}\n`);
  console.log(`Done with it: make book-cancel ID=${b.id}`);
} else if (cmd === "demo") {
  // The "demo" shelf unless told otherwise — SHELF=studypal puts the same four
  // made-up teachers where Study Pal will find them, to test it end to end.
  const shelf = (E.SHELF || "demo").toLowerCase();
  const db = load();
  const demo = [
    ["Li Wei", "李薇", "Beginners · speaks English", "¥120", "mon-sun 09:00 19:00 20:00 21:00", "Beginner,Speaking"],
    ["Zhang Hao", "张浩", "HSK 4–6 · business", "¥160", "mon-fri 12:00 20:00; sat 10:00 11:00", "HSK,Business"],
    ["Chen Yu", "陈雨", "Speaking · slow and patient", "¥100", "mon-sun 18:00 21:00 22:00", "Speaking,Beginner"],
    ["Wang Min", "王敏", "Kids and teens", "¥110", "sat-sun 09:00 10:00 11:00 15:00", "Kids"],
  ];
  for (const [name, zh, line, price, hours, tags] of demo) {
    const old = db.teachers.find((t) => t.shelf === shelf && t.name === name);
    const row = cleanTeacher({ id: old?.id || newId(), shelf, name, zh, line, price,
      tags: tags.split(","), hours: parseHours(hours) });
    db.teachers = db.teachers.filter((t) => t.id !== row.id).concat(row);
  }
  save(db);
  console.log(`Four made-up teachers on the "${shelf}" shelf. See them at /book/?shelf=${shelf}`);
} else {
  const db = load();
  const shelves = [...new Set(db.teachers.map((t) => t.shelf))].sort();
  if (!shelves.length) console.log("Nobody on any shelf yet. Try: make book-demo");
  for (const sh of shelves) {
    console.log(`\n${sh}`);
    for (const t of db.teachers.filter((x) => x.shelf === sh)) {
      const free = slotsFor(db, t).flatMap((d) => d.slots).filter((x) => x.free).length;
      console.log(`  ${t.on ? " " : "×"} ${t.name}${t.zh ? " " + t.zh : ""} · ${t.price || "no price"} · ${free} free this week`);
    }
  }
  const soon = db.bookings.filter((b) => !b.off && Date.parse(b.start) > Date.now() - 3600e3)
    .sort((a, b) => a.start.localeCompare(b.start));
  console.log(`\nBooked (${soon.length})`);
  for (const b of soon) {
    const t = db.teachers.find((x) => x.id === b.teacher);
    console.log(`  ${when(b.start)} · ${t ? t.name : "?"} ← ${b.name} (${b.contact})${b.note ? " — " + b.note : ""}  [${b.id}]`);
    // The two ways into the lesson's video room. The teacher's is the one to
    // send them; the student's was on their screen when they booked.
    console.log(`      teacher: ${PUBLIC}/room/${b.id}#${b.tKey}`);
    console.log(`      student: ${PUBLIC}/room/${b.id}#${b.sKey}`);
  }
}
