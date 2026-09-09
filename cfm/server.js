// crowdfundme — the ledger, and the offer.
//
// ---------------------------------------------------------------------------
// Why this is its own service and not a page on the board
//
// The ledger makes the offer, and that is the reason it can say "nothing is
// issued". A product promising you a stake in itself is a pitch; a separate
// register recording who was early is a record. The separation is not a
// branding exercise — it is what makes the sentence believable, and it is the
// same separation that lets a second project exist without rewriting the first.
//
// So this server knows nothing about rooms, cards, WeChat or Chinese levels.
// It knows projects, packages, offers and people. See lib/store.js.
// ---------------------------------------------------------------------------

import express from "express";
import { createHmac } from "node:crypto";
import path from "node:path";
import { readFile } from "node:fs/promises";
import * as store from "./lib/store.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);

const PORT = Number(process.env.PORT || 3000);
const DIR = process.env.CFM_DIR || "/data";
const FILE = path.join(DIR, "cfm.json");
const KEY = (process.env.CFM_ADMIN_KEY || "").trim();
const SALT = (process.env.CFM_SALT || "").trim();

/* Writes are serialised. Two requests reading, changing and writing the same
   file at once leave whichever finished last as the only one stored. */
let queue = Promise.resolve();
function change(fn) {
  const run = queue.then(async () => {
    const data = await store.load(FILE);
    const out = await fn(data);
    if (out !== null) await store.save(FILE, data);
    return out;
  });
  queue = run.catch(() => {});
  return run;
}

function admin(req, res, next) {
  if (!KEY) return res.status(503).json({ error: "CFM_ADMIN_KEY is not set" });
  const given = String(req.get("x-admin-secret") || req.query.secret || "");
  if (given.length !== KEY.length) return res.status(401).json({ error: "no" });
  let same = 0;
  for (let i = 0; i < KEY.length; i++) same |= given.charCodeAt(i) ^ KEY.charCodeAt(i);
  if (same) return res.status(401).json({ error: "no" });
  next();
}

/* WHO IS HOLDING AN OFFER, ACROSS A RELOAD.
 *
 * A signed cookie carrying the offer id — not the code. The code is spent on
 * being typed once; after that the page needs to know whose offer it is
 * showing without the reader having to type it again, and without the id being
 * something a stranger can guess or edit. Same shape as the board's. */
const sign = (v) => createHmac("sha256", SALT).update(v).digest("hex").slice(0, 32);
function setHeld(res, id) {
  res.append("Set-Cookie",
    "cfm_held=" + id + "." + sign(id) +
    "; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure");
}
function held(req) {
  const raw = /(?:^|;\s*)cfm_held=([^;]+)/.exec(req.get("cookie") || "");
  if (!raw) return "";
  const [id, mac] = decodeURIComponent(raw[1]).split(".");
  return id && mac && sign(id) === mac ? id : "";
}

/* What a reader is allowed to see of their own offer. Never the whole row:
   `by` is a device hash and nobody else's business, and the code has been
   spent by the time this is drawn. */
function view(data, o) {
  const p = data.projects.find((x) => x.id === o.project) || null;
  const k = data.packages.find((x) => x.id === o.package) || null;
  return {
    who: o.who, seat: o.seat, note: o.note, until: o.until,
    taken: Boolean(o.tookAt),
    project: p && { id: p.id, name: p.name, zh: p.zh, line: p.line, seats: p.seats },
    pack: k && { name: k.name, face: k.face, points: k.points, perDay: k.perDay },
  };
}

const PAGES = new Map();
async function page(file, req, res, next) {
  try {
    if (!PAGES.has(file)) PAGES.set(file, await readFile("public/" + file, "utf8"));
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "no-cache");
    res.send(PAGES.get(file));
  } catch (e) { next(e); }
}

/* TWO FRONT DOORS, and which is which matters.
 *
 * "/" is the landing page: what this is, for somebody who arrived without a
 * code — a forwarded link, somebody Peter told, a person opening it a week
 * later. It asks for nothing.
 *
 * "/o" is the code door. Sending somebody straight to it is the two-minute
 * path; the landing page carries a way through for everybody else, because a
 * stranger meeting a six-character box and no explanation just closes it. */
app.get("/", (req, res, next) => page("landing.html", req, res, next));
app.get("/o", (req, res, next) => page("index.html", req, res, next));
app.use(express.static("public", { index: false, maxAge: "1h" }));

/** Spend a code. One person, once — after that the cookie carries them. */
app.post("/api/open", express.json({ limit: "2kb" }), async (req, res) => {
  const code = store.cleanCode(req.body?.code);
  if (!code) return res.status(400).json({ error: "bad" });
  const out = await change((data) => {
    const o = data.offers.find((x) => x.code === code);
    if (!o) return null;
    /* Opened is worth recording separately from accepted: an offer that was
       read and not taken is the one to follow up, and the one that says the
       screen is wrong rather than the person. */
    if (!o.openedAt) o.openedAt = new Date().toISOString();
    return { id: o.id, view: view(data, o) };
  });
  if (!out) return res.status(404).json({ error: "no" });
  setHeld(res, out.id);
  res.json({ ok: true, offer: out.view });
});

/** Whatever this browser is already holding. */
app.get("/api/mine", async (req, res) => {
  const id = held(req);
  if (!id) return res.json({ on: false });
  const data = await store.load(FILE);
  const o = data.offers.find((x) => x.id === id);
  if (!o) return res.json({ on: false });
  res.json({ on: true, offer: view(data, o) });
});

/** Take it. Records who and when, and hands them to the project. */
app.post("/api/accept", express.json({ limit: "2kb" }), async (req, res) => {
  const id = held(req);
  if (!id) return res.status(400).json({ error: "who" });
  const me = store.hashDevice(String(req.body?.device || ""), SALT);
  const out = await change((data) => {
    const o = data.offers.find((x) => x.id === id);
    if (!o) return null;
    /* Accepting twice is a reload, not a second person. The first time is the
       one on the record. */
    if (!o.tookAt) { o.tookAt = new Date().toISOString(); o.by = me; }
    const p = data.projects.find((x) => x.id === o.project);
    return { goTo: (p && p.goTo) || "", seat: o.seat };
  });
  if (!out) return res.status(404).json({ error: "no" });
  res.json({ ok: true, ...out });
});

/* ---- the side only the person running it sees ------------------------- */

app.post("/api/project", express.json({ limit: "4kb" }), admin, async (req, res) => {
  const out = await change((data) => {
    const p = store.cleanProject(req.body);
    if (!p) return null;
    const at = data.projects.findIndex((x) => x.id === p.id);
    if (at >= 0) data.projects[at] = { ...data.projects[at], ...p };
    else data.projects.push(p);
    return p;
  });
  if (!out) return res.status(400).json({ error: "bad" });
  res.json({ ok: true, project: out });
});

app.post("/api/package", express.json({ limit: "4kb" }), admin, async (req, res) => {
  const out = await change((data) => {
    const k = store.cleanPackage(req.body);
    if (!k) return null;
    const at = data.packages.findIndex((x) => x.id === k.id);
    if (at >= 0) data.packages[at] = { ...data.packages[at], ...k };
    else data.packages.push(k);
    return k;
  });
  if (!out) return res.status(400).json({ error: "bad" });
  res.json({ ok: true, package: out });
});

/** Make one offer, to one named person. */
app.post("/api/offer", express.json({ limit: "4kb" }), admin, async (req, res) => {
  const out = await change((data) => {
    const taken = new Set(data.offers.map((x) => x.code));
    let code = store.newCode();
    while (taken.has(code)) code = store.newCode();
    /* The seat is decided now, not when it is opened. Two people quietly told
       they are third is the one mistake here that cannot be walked back. */
    const used = new Set(data.offers.map((x) => x.seat).filter(Boolean));
    let seat = Number(req.body?.seat) || 0;
    if (!seat) { seat = 1; while (used.has(seat)) seat += 1; }
    const o = store.cleanOffer({ ...req.body, code, seat });
    if (!o) return null;
    if (!data.projects.some((p) => p.id === o.project)) return null;
    data.offers.push(o);
    return o;
  });
  if (!out) return res.status(400).json({ error: "bad" });
  res.json({ ok: true, offer: out });
});

app.get("/api/offers", admin, async (_req, res) => {
  const data = await store.load(FILE);
  res.json({ offers: data.offers.map((o) => ({
    who: o.who, code: o.code, seat: o.seat, project: o.project, package: o.package,
    at: o.at, openedAt: o.openedAt, tookAt: o.tookAt,
  })) });
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  if (!KEY) console.error("CFM_ADMIN_KEY is not set — the admin routes refuse everything.");
  if (!SALT) console.error("CFM_SALT is not set — offers cannot be held across a reload.");
  console.log("crowdfundme on :" + PORT + ", data in " + DIR);
});
