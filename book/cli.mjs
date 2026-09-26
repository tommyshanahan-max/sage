/* The shelf from a terminal. Run inside the container by the Makefile:
 *
 *   make book-teacher SHELF=studypal NAME="Li Wei" ZH=李薇 \
 *        LINE="Beginners · speaks English" PRICE=¥120 HOURS="mon-fri 19:00 20:00; sat 10:00"
 *   make book-list                 who is on which shelf, and what is booked
 *   make book-off NAME="Li Wei"    hide a teacher (NAME=… again with book-on)
 *   make book-cancel ID=…          free a booked slot
 *   make book-demo                 four made-up teachers on the "demo" shelf
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

if (cmd === "teacher") {
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
