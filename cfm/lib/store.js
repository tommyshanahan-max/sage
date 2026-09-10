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

import { mkdir, readFile, writeFile, rename, readdir, unlink, access } from "node:fs/promises";
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

/** WHOSE PROJECT IT IS.
 *
 * A person who keeps a record here. Not an account: a name and a key they
 * were handed, which is the same idiom as everything else on this site — no
 * password to forget, nothing to reset, and nothing stored that could be
 * stolen and reused elsewhere.
 *
 * It exists because the alternative was handing a second founder the master
 * key, which opens every project and every offer on the box. One key per
 * person, scoped to their own rows, is the difference between a platform and
 * a shared login.
 */
export function cleanOwner(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = s(raw.name, 60);
  const key = cleanCode(raw.key);
  if (!name || key.length < 10) return null;
  return {
    id: /^[a-f0-9]{20}$/.test(String(raw.id || "")) ? String(raw.id) : newId(),
    name, key,
    at: s(raw.at, 40) || new Date().toISOString(),
    /* How many projects they may keep. Nought is not "unlimited" — it is the
       honest default for somebody who has been made and not yet let in. */
    projects: Math.max(0, Math.min(50, Number(raw.projects) || 0)),
  };
}

/** A thing people are early to. Not a product — a name and where to send them. */
export function cleanProject(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = s(raw.id, 40).toLowerCase().replace(/[^a-z0-9-]/g, "");
  const name = s(raw.name, 60);
  if (!id || !name) return null;
  return {
    id, name,
    /* The owner id, and it is never read from a request body — the server
       takes it from whoever is signed in. A project that could name its own
       owner is a project anybody could reassign to themselves. */
    owner: /^[a-f0-9]{20}$/.test(String(raw.owner || "")) ? String(raw.owner) : "",
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
    /* THEIR ACTUAL SIGNATURE, if they have put one there.
     *
     * A file in public/, named here rather than embedded: an image on a page
     * is a few kilobytes and a data URI in the record is a few kilobytes in
     * every backup, every seal and every diff of a file that is meant to be
     * readable by a person.
     *
     * A FILENAME AND NOTHING ELSE. No slashes, no dots beyond the extension,
     * nothing that can climb out of the directory — this value is written by
     * whoever runs the box and read straight into an img src, and the day it
     * is settable from anywhere else is the day it would matter.
     *
     * Optional, and the page is correct without it: a typed name and a date
     * is a signature. This is the same thing with a pen behind it.
     */
    sig: /^[a-z0-9][a-z0-9._-]{0,48}\.(png|jpg|jpeg|svg|webp)$/i.test(String(raw.sig || ""))
      ? String(raw.sig) : "",
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
    /* MORE, IF SOMETHING HAPPENS — and this is the field the whole ledger is
     * for.
     *
     * "Five percent now, more depending on milestones" is how these deals are
     * actually made, and it is exactly the half nobody writes down. The
     * percentage gets recorded because it is a number; the earn-out stays in
     * a conversation, and two years later the two people remember two
     * different sentences. That is the napkin this product exists to replace,
     * and until now the only place to put it here was a free-text note — which
     * is the napkin with a nicer font.
     *
     * So: up to four steps, each an extra share and the thing that has to
     * happen for it. Both halves required — a percentage with no condition is
     * not a milestone, and a condition with no percentage is a hope.
     *
     * THE CONDITION IS THEIR WORDS AND THE LEDGER DOES NOT JUDGE IT. It has
     * no idea whether "ships v1" has happened and never will: no dates to
     * compare, no box to tick, nothing here that pays out. What it does is
     * hold what was agreed, in the words both of them used, on a record that
     * says when it was written and cannot be quietly changed afterwards. Who
     * decides it happened is a conversation between two people and their
     * lawyers, which is where it belongs.
     *
     * `pct` is on top of the base, not instead of it. The page says so in as
     * many words, because it is the one thing here somebody could read the
     * wrong way round and it is expensive to read wrong.
     */
    steps: (Array.isArray(raw.steps) ? raw.steps : []).slice(0, 4).map((m) => ({
      pct: Math.max(0, Math.min(100, Math.round((Number(m && m.pct) || 0) * 10) / 10)),
      on: s(m && m.on, 120),
    })).filter((m) => m.pct > 0 && m.on),
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
    /* WHAT THEY TYPED, and why a button was not enough.
       A tap records that a device pressed Accept. A name typed by the person
       whose offer it is records that a person did — it is the difference
       between an event log and something anybody would act on later. Asked
       for on a stake and nowhere else: a founding seat that demands a legal
       name at the door is a founding seat nobody takes. */
    signed: s(raw.signed, 60),
    /* The browser that accepted, hashed. Enough to know it was taken and to
       hand the same person back their own offer; not enough to say who. */
    by: s(raw.by, 64),
  };
}

/* SEALING A MONTH.
 *
 * The claim the whole product rests on is that a number written in October is
 * still that number in a year. Nothing enforced that: the file is JSON on a
 * disk, and an edit leaves no trace. A seal is the trace — the month's rows,
 * serialised the same way every time, hashed, and chained to the seal before
 * it so that changing anything old invalidates every seal since.
 *
 * Chained rather than a list of independent hashes: independent hashes let
 * somebody re-seal one month quietly. A chain means the only way to hide an
 * edit is to redo every seal after it, which is exactly the work anchoring a
 * seal publicly is meant to make impossible.
 *
 * No chain is involved here and none is needed for this part. Publishing a
 * seal somewhere it cannot be rewritten is a separate, optional step on top —
 * see the anchor notes in server.js. Until that is configured, this is a
 * tamper-EVIDENT record, not a tamper-PROOF one, and nothing says otherwise.
 */
const canon = (v) => {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v).sort()
      .map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  }
  return JSON.stringify(v ?? null);
};

/** One month of the record, exactly as it stood. */
export function sealOf(data, month, prev) {
  /* Everything dated inside the month, whatever it is about — an offer made,
     opened or accepted in September belongs to September's seal. */
  const rows = data.offers
    .filter((o) => String(o.at).slice(0, 7) === month)
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const body = canon({ month, prev: prev || "", rows });
  return {
    month,
    /* The chain link. An empty prev means this is the first seal. */
    prev: prev || "",
    hash: createHash("sha256").update(body).digest("hex"),
    count: rows.length,
    at: new Date().toISOString(),
    /* Where it was published, if it ever was. Empty is the honest default and
       the page reads it: no reference, no claim. */
    ref: "", net: "",
  };
}

export function cleanSeal(raw) {
  if (!raw || typeof raw !== "object") return null;
  const month = /^\d{4}-\d{2}$/.test(String(raw.month || "")) ? String(raw.month) : "";
  const hash = /^[a-f0-9]{64}$/.test(String(raw.hash || "")) ? String(raw.hash) : "";
  if (!month || !hash) return null;
  return {
    month, hash,
    prev: /^[a-f0-9]{64}$/.test(String(raw.prev || "")) ? String(raw.prev) : "",
    count: Math.max(0, Number(raw.count) || 0),
    at: s(raw.at, 40) || new Date().toISOString(),
    ref: s(raw.ref, 200),
    /* Which network the ref is on. Without it a page cannot build a link that
       goes anywhere, and a testnet anchor read as a public one is a claim
       nobody can check — worse than no claim. */
    net: ["test", "public"].includes(raw.net) ? raw.net : "",
  };
}

export const hashDevice = (id, salt) =>
  id ? createHash("sha256").update(salt + ":" + id).digest("hex").slice(0, 32) : "";

const EMPTY = { owners: [], projects: [], packages: [], offers: [], seals: [] };

export async function load(file) {
  try {
    const raw = JSON.parse(await readFile(file, "utf8"));
    return {
      owners: (raw.owners || []).map(cleanOwner).filter(Boolean),
      projects: (raw.projects || []).map(cleanProject).filter(Boolean),
      packages: (raw.packages || []).map(cleanPackage).filter(Boolean),
      offers: (raw.offers || []).map(cleanOffer).filter(Boolean),
      seals: (raw.seals || []).map(cleanSeal).filter(Boolean),
    };
  } catch { return { ...EMPTY }; }
}

/** Written to a temporary name and renamed, so a crash mid-write leaves the
 *  last good file rather than half of a new one. */
export async function save(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  await writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  const keep = (await needsDay(file)) ? await readFile(file, "utf8").catch(() => "") : "";
  await rename(tmp, file);
  if (keep) keepADay(file, keep).catch(() => {});
}

/* ---------------------------------------------------------------------------
 * ONE COPY A DAY, KEPT BESIDE THE FILE
 *
 * The same thirty-day history the board keeps, and here it matters more. This
 * file is the record: who was offered what, who accepted, and the seals that
 * say the months before this one have not moved. A row lost from a board is a
 * post; a row lost from here is somebody's share in something.
 *
 * The first write of each day sets aside what was on disk before it — the
 * state at the end of the previous day, untouched by anything today has done.
 * Names are dates, so `ls` answers "what did the ledger say on the 8th".
 *
 * This is not what makes the record trustworthy. The seals and the chain are
 * — see anchor.js. This is what means a mistake is recoverable rather than
 * only detectable.
 */
const KEEP_DAYS = 30;
const dayOf = (d = new Date()) => d.toISOString().slice(0, 10);
const daysDir = (file) => path.join(path.dirname(file), "days");
const dayFile = (file, day) =>
  path.join(daysDir(file), path.basename(file, ".json") + "-" + day + ".json");

async function needsDay(file) {
  try { await access(dayFile(file, dayOf())); return false; } catch { return true; }
}

async function keepADay(file, text) {
  const dir = daysDir(file);
  await mkdir(dir, { recursive: true });
  const at = dayFile(file, dayOf());
  const tmp = at + ".tmp";
  await writeFile(tmp, text, "utf8");
  await rename(tmp, at);
  const base = path.basename(file, ".json") + "-";
  const all = (await readdir(dir))
    .filter((n) => n.startsWith(base) && n.endsWith(".json"))
    .sort();
  for (const n of all.slice(0, Math.max(0, all.length - KEEP_DAYS))) {
    await unlink(path.join(dir, n)).catch(() => {});
  }
}
