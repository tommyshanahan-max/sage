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
       per-head rates and the tree. Two audiences, never the same page. */
    face: ["plain", "reach"].includes(raw.face) ? raw.face : "plain",
    points: Math.max(0, Math.min(100000, Number(raw.points) || 0)),
    perDay: Math.max(0, Math.min(1000, Number(raw.perDay) || 0)),
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
