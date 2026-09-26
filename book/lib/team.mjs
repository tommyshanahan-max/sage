/* WHAT A TEAM LEAD SEES — Julia's portal, as numbers.
 *
 * Everything is worked out from the lessons, never stored as a running total:
 * a lesson counts once its start time has passed and it was not cancelled,
 * and what it earned is what was fixed on the booking when it was made (see
 * `money` in store.mjs). A total kept separately would one day disagree with
 * the lessons it claims to add up, and nobody would know which to believe.
 *
 * "This month" is Beijing's month — that is where Julia and her tutors are.
 */
import { split } from "./store.mjs";

const bjMonth = (ms) => new Date(ms + 8 * 3600e3).toISOString().slice(0, 7);

/** What one lesson earned: from the booking if it was fixed there, otherwise
 *  worked out from the teacher as they are now (lessons booked before fees
 *  existed). */
function moneyOf(db, b) {
  if (b.money) return b.money;
  const t = db.teachers.find((x) => x.id === b.teacher);
  if (!t || !t.fee) return { tutor: 0, lead: 0, house: 0, price: 0 };
  const team = t.lead ? db.teams.find((x) => x.id === t.lead) : null;
  return { ...split(t.fee, team ? team.cut : 0, Boolean(team && team.self === t.id)), ...(team ? { team: team.id } : {}) };
}

/** The lessons that belong to this team and have happened. */
function taught(db, team, now) {
  const mine = new Set(db.teachers.filter((t) => t.lead === team.id).map((t) => t.id));
  return db.bookings.filter((b) => !b.off && Date.parse(b.start) <= now
    && (b.money ? b.money.team === team.id : mine.has(b.teacher)))
    .map((b) => ({ b, m: moneyOf(db, b) }));
}

/** Friday, Beijing — when payouts go. Today if it is Friday. */
function nextFriday(now) {
  const bj = new Date(now + 8 * 3600e3);
  const add = (5 - bj.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate() + add)).toISOString().slice(0, 10);
}

/** Julia's home and team screens. */
export function teamView(db, team, now = Date.now()) {
  const month = bjMonth(now);
  const all = taught(db, team, now);
  const thisMonth = all.filter(({ b }) => bjMonth(Date.parse(b.start)) === month);
  // Hers: her own lessons whole (the tutor part), and the lead share of the rest.
  const earn = (rows) => rows.reduce((a, { b, m }) => {
    if (b.teacher === team.self) a.own += m.tutor; else a.team += m.lead;
    return a;
  }, { own: 0, team: 0 });
  const mo = earn(thisMonth);
  const ever = earn(all);
  const paid = team.paid.reduce((n, p) => n + p.amount, 0);

  const tutors = db.teachers.filter((t) => t.lead === team.id && t.id !== team.self).map((t) => {
    const rows = thisMonth.filter(({ b }) => b.teacher === t.id);
    const week = all.filter(({ b }) => b.teacher === t.id && Date.parse(b.start) > now - 7 * 86400e3);
    return {
      id: t.id, name: t.name, zh: t.zh, on: t.on,
      lessons: rows.length, made: rows.reduce((n, r) => n + r.m.tutor, 0), you: rows.reduce((n, r) => n + r.m.lead, 0),
      weekLessons: week.length, weekMade: week.reduce((n, r) => n + r.m.tutor, 0), weekYou: week.reduce((n, r) => n + r.m.lead, 0),
    };
  }).sort((a, b) => b.made - a.made || a.name.localeCompare(b.name));

  return {
    name: team.name, cut: team.cut,
    month: { own: mo.own, team: mo.team, total: mo.own + mo.team },
    owed: Math.max(0, ever.own + ever.team - paid),
    payday: nextFriday(now),
    bank: team.bank && team.bank.card ? {
      bank: team.bank.bank, name: team.bank.name, branch: team.bank.branch,
      last4: team.bank.card.replace(/\D/g, "").slice(-4),
    } : null,
    tutors,
  };
}

/** One tutor, for the lead: this month and the latest lessons. */
export function tutorView(db, team, id, now = Date.now()) {
  const t = db.teachers.find((x) => x.id === id && x.lead === team.id);
  if (!t) return null;
  const month = bjMonth(now);
  const rows = taught(db, team, now).filter(({ b }) => b.teacher === t.id)
    .sort((a, b) => b.b.start.localeCompare(a.b.start));
  const mo = rows.filter(({ b }) => bjMonth(Date.parse(b.start)) === month);
  return {
    id: t.id, name: t.name, zh: t.zh, line: t.line, fee: t.fee, cut: team.cut,
    lessons: mo.length, made: mo.reduce((n, r) => n + r.m.tutor, 0), you: mo.reduce((n, r) => n + r.m.lead, 0),
    // First name of the student only: Julia runs the team, she does not need
    // the student's WeChat to see that a lesson happened.
    latest: rows.slice(0, 12).map(({ b, m }) => ({
      start: b.start, student: String(b.name || "").split(/\s+/)[0], made: m.tutor, you: m.lead,
    })),
  };
}

/** For Tom: every team, what it is owed, and where to send it. */
export function owedAll(db, now = Date.now()) {
  return db.teams.map((team) => {
    const v = teamView(db, team, now);
    return { name: team.name, owed: v.owed, month: v.month.total, bank: team.bank, payday: v.payday };
  });
}
