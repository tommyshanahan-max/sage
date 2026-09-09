// What crowdfundme knows, and deliberately how little of it.
//
// ---------------------------------------------------------------------------
// The boundary that makes this a platform rather than a feature
//
// This file never mentions The Exchange. It holds projects, packages, offers
// and people; it does not know what a room is, what a card is, or that WeChat
// exists. A project is a name, a colour and a place to send somebody when they
// accept — which is the whole of what the ledger needs to know about a product
// in order to keep its record.
//
// Hold that line and the second project is a row. Break it once — one field
// called `room`, one branch on the project id — and the second project is a
// rewrite. Every temptation to break it will look small at the time.
// ---------------------------------------------------------------------------

import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import path from "node:path";

export const newId = () => randomUUID().replace(/-/g, "").slice(0, 20);

/* The same alphabet the board's invite codes use: no O, no zero, no I, no one.
   These get read down a phone to somebody who is already busy. */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newCode(n = 6) {
  let out = "";
  for (let i = 0; i < n; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}
export const cleanCode = (v) => {
  const t = String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  for (const ch of t) if (!CODE_ALPHABET.includes(ch)) return "";
  return t;
};

const s = (v, n) => String(v ?? "").replace(/\r\n?/g, "\n").trim().slice(0, n);

/** A thing people are early to. Not a product — a name and where to send them. */
export function cleanProject(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = s(raw.id, 40).toLowerCase().replace(/[^a-z0-9-]/g, "");
  const name = s(raw.name, 60);
  if (!id || !name) return null;
  return {
    id, name,
    zh: s(raw.zh, 60),
    line: s(raw.line, 200),
    /* Where somebody goes the moment they accept. The ledger hands over and
       stops; what happens on the other side is not its business. */
    goTo: /^https?:\/\/[^\s]{1,200}$/.test(String(raw.goTo || "")) ? String(raw.goTo) : "",
    seats: Math.max(0, Math.min(100000, Number(raw.seats) || 0)),
    /* WHERE THIS GOES, in the project's own words.
       This used to be written into the offer page, which meant the page was
       The Exchange's page wearing the ledger's name. A second project would
       have arrived reading somebody else's pitch. The claim, the one-line
       goal and the three milestones are the project's, and the page just
       draws whatever it is handed. */
    claim: s(raw.claim, 160),
    sub: s(raw.sub, 200),
    goal: s(raw.goal, 240),
    /* Up to three: today, the middle, and the one worth doing this for. The
       page sizes them in that order, so the order is the meaning. */
    marks: (Array.isArray(raw.marks) ? raw.marks : []).slice(0, 3).map((m) => ({
      val: s(m && m.val, 16), when: s(m && m.when, 24),
    })).filter((m) => m.val),
    /* WHO IS ON THE OTHER SIDE OF THIS.
       The name used to be written into the offer page, which meant every
       project on this ledger, forever, said Tom asked you himself. It is the
       project's now — and on a stake offer it is not decoration: a share in a
       company that does not exist yet, from a page that does not name the
       person granting it, is the first thing a careful reader stops on.
       `holds` is the sentence that answers "out of what". */
    from: s(raw.from, 60),
    holds: s(raw.holds, 160),
    at: s(raw.at, 40) || new Date().toISOString(),
  };
}

/** Terms, written once and reused. So "what did I give Keith" has one answer
 *  rather than a memory of a conversation. */
export function cleanPackage(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = s(raw.id, 40).toLowerCase().replace(/[^a-z0-9-]/g, "");
  const name = s(raw.name, 60);
  if (!id || !name) return null;
  return {
    id, name,
    project: s(raw.project, 40),
    /* Which screen this person gets. `plain` is the founding offer — one
       number, one ask, no arithmetic. `reach` is the connector's, with the
       per-head rates and the tree. `stake` is a share of the thing itself,
       for the handful of people who build it rather than join it. Three
       audiences, never the same page. */
    face: ["plain", "reach", "stake"].includes(raw.face) ? raw.face : "plain",
    points: Math.max(0, Math.min(100000, Number(raw.points) || 0)),
    perDay: Math.max(0, Math.min(1000, Number(raw.perDay) || 0)),
    /* THE STAKE, and it is deliberately three numbers and not a paragraph.
       A percentage with no vesting attached is the thing people later
       disagree about, so the schedule is stored beside it and printed on the
       same screen: what share, over how long, and how long before any of it
       is theirs. Tenths, because 12.5% is a real answer and 12.53% is not. */
    pct: Math.max(0, Math.min(100, Math.round((Number(raw.pct) || 0) * 10) / 10)),
    years: Math.max(0, Math.min(10, Number(raw.years) || 0)),
    cliff: Math.max(0, Math.min(48, Number(raw.cliff) || 0)),
    /* The ask, in the words that fit this offer. "Bring one person worth
       having" is right for a founding seat and wrong for everything else,
       and a wrong ask is worse than none — it tells the reader the page was
       not written for them. */
    ask: s(raw.ask, 160),
    why: s(raw.why, 300),
    at: s(raw.at, 40) || new Date().toISOString(),
  };
}

/** One code, one person, one offer. */
export function cleanOffer(raw) {
  if (!raw || typeof raw !== "object") return null;
  const code = cleanCode(raw.code);
  const who = s(raw.who, 60);
  if (!code || !who) return null;
  return {
    id: /^[a-f0-9]{20}$/.test(String(raw.id || "")) ? String(raw.id) : newId(),
    code, who,
    project: s(raw.project, 40),
    package: s(raw.package, 40),
    /* The seat they would take. Written when the offer is made, not when it is
       opened — so what he is shown is what was decided, and two people are
       never quietly told they are third. */
    seat: Math.max(0, Math.min(100000, Number(raw.seat) || 0)),
    /* A line only this person sees. It does more work than any number on the
       page: it is the difference between an invitation and a mailshot. */
    note: s(raw.note, 300),
    until: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.until || "")) ? String(raw.until) : "",
    at: s(raw.at, 40) || new Date().toISOString(),
    /* Opened, then accepted. Both are worth knowing before you follow up. */
    openedAt: s(raw.openedAt, 40),
    tookAt: s(raw.tookAt, 40),
    /* The browser that accepted, hashed. Enough to know it was taken and to
       hand the same person back their own offer; not enough to say who. */
    by: s(raw.by, 64),
  };
}

export const hashDevice = (id, salt) =>
  id ? createHash("sha256").update(salt + ":" + id).digest("hex").slice(0, 32) : "";

const EMPTY = { projects: [], packages: [], offers: [] };

export async function load(file) {
  try {
    const raw = JSON.parse(await readFile(file, "utf8"));
    return {
      projects: (raw.projects || []).map(cleanProject).filter(Boolean),
      packages: (raw.packages || []).map(cleanPackage).filter(Boolean),
      offers: (raw.offers || []).map(cleanOffer).filter(Boolean),
    };
  } catch { return { ...EMPTY }; }
}

/** Written to a temporary name and renamed, so a crash mid-write leaves the
 *  last good file rather than half of a new one. */
export async function save(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  await writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await rename(tmp, file);
}
