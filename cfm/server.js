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
import * as anchor from "./lib/anchor.js";

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

/* WHOSE CONSOLE THIS IS.
 *
 * The same signed-cookie shape as a held offer, carrying an owner id. The key
 * is spent once at the door; after that the cookie is what identifies them,
 * so the key never sits in a page, a URL or a history entry.
 *
 * Everything below reads the owner from here and never from a request body.
 * That is the whole of the isolation: a founder can name anything about their
 * project except who owns it. */
function setMe(res, id) {
  res.append("Set-Cookie",
    "cfm_me=" + id + "." + sign(id) +
    "; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure");
}
function meId(req) {
  const raw = /(?:^|;\s*)cfm_me=([^;]+)/.exec(req.get("cookie") || "");
  if (!raw) return "";
  const [id, mac] = decodeURIComponent(raw[1]).split(".");
  return id && mac && sign(id) === mac ? id : "";
}

/** Routes that need a founder. Loads the row so nothing downstream trusts an
 *  id that no longer exists — a revoked owner is a cookie pointing at nobody. */
function owner(req, res, next) {
  const id = meId(req);
  if (!id) return res.status(401).json({ error: "who" });
  store.load(FILE).then((data) => {
    const me = data.owners.find((o) => o.id === id);
    if (!me) return res.status(401).json({ error: "who" });
    req.me = me;
    next();
  }).catch(next);
}

/** Everything of theirs, and nothing of anybody else's. */
function mine(data, me) {
  const projects = data.projects.filter((p) => p.owner === me.id);
  const ids = new Set(projects.map((p) => p.id));
  return {
    projects,
    packages: data.packages.filter((k) => ids.has(k.project)),
    offers: data.offers.filter((o) => ids.has(o.project)),
  };
}

/* What a reader is allowed to see of their own offer. Never the whole row:
   `by` is a device hash and nobody else's business, and the code has been
   spent by the time this is drawn. */
function view(data, o) {
  const p = data.projects.find((x) => x.id === o.project) || null;
  const k = data.packages.find((x) => x.id === o.package && x.project === o.project) || null;
  return {
    who: o.who, seat: o.seat, note: o.note, until: o.until,
    taken: Boolean(o.tookAt), signed: o.signed,
    /* goTo is here so the page can tell, before the button is pressed, whether
       accepting ends in a room or in a sentence. Not a secret — it is where
       the button was always going to send them. */
    project: p && { id: p.id, name: p.name, zh: p.zh, line: p.line, seats: p.seats, goTo: p.goTo,
      claim: p.claim, sub: p.sub, goal: p.goal, marks: p.marks,
      from: p.from, holds: p.holds },
    pack: k && { name: k.name, face: k.face, points: k.points, perDay: k.perDay,
      pct: k.pct, years: k.years, cliff: k.cliff, ask: k.ask, why: k.why,
      // The earn-out, and it goes out with the terms it qualifies. A page that
      // showed 5% while the record said 5% plus three more on conditions would
      // be the wrong half of the deal, told to the person it matters to.
      steps: k.steps },
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
  res.set("Cache-Control", "no-store");
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
  const sign = String(req.body?.sign || "").trim().slice(0, 60);
  const out = await change((data) => {
    const o = data.offers.find((x) => x.id === id);
    if (!o) return null;
    /* A stake is not taken by tapping. Checked on this side and not only in
       the page: the page is the convenience, the rule is here. */
    const k = data.packages.find((x) => x.id === o.package && x.project === o.project);
    if (k && k.face === "stake" && !o.tookAt && sign.length < 3) return "unsigned";
    /* Accepting twice is a reload, not a second person. The first time is the
       one on the record. */
    if (!o.tookAt) { o.tookAt = new Date().toISOString(); o.by = me; o.signed = sign; }
    const p = data.projects.find((x) => x.id === o.project);
    return { goTo: (p && p.goTo) || "", seat: o.seat };
  });
  if (out === "unsigned") return res.status(400).json({ error: "sign" });
  if (!out) return res.status(404).json({ error: "no" });
  res.json({ ok: true, ...out });
});

/** The seals, for anybody. Published on purpose: a record nobody can check is
 *  a claim, and the whole point of sealing is that it stops being one. */
app.get("/api/seals", async (_req, res) => {
  const data = await store.load(FILE);
  /* Never cached. Express sends this with no freshness information, so a
     browser is free to keep it — and it did: a seal that had been removed went
     on being shown on the page for as long as the tab lived. On the one block
     whose whole job is saying what the record is right now, a stale copy is
     not a slow page, it is a false statement. */
  res.set("Cache-Control", "no-store");
  res.json({ seals: data.seals });
});

/* ---- the founder's own side, scoped to the founder ---------------------- */

app.get("/f", (req, res, next) => page("founder.html", req, res, next));

/* HOW MANY STRANGERS AT ONCE.
 *
 * Anyone can start a record, which is the point — but the whole ledger is one
 * JSON file, and a script can fill it faster than anybody can read it. A cap
 * on new records per hour is the cheapest thing that keeps the door open to a
 * person and shut to a loop. It is not security; it is a rate. */
const RECENT = () => Date.now() - 60 * 60 * 1000;
const NEW_PER_HOUR = Math.max(1, Number(process.env.CFM_NEW_PER_HOUR || 20));

/** START ONE. No key, no code, no invitation — this is somebody who has just
 *  landed and has a deal to write down.
 *
 *  They get a key on the way out rather than being asked for one on the way
 *  in. It is the same key `make cfm-owner` issues; the difference is only who
 *  decided they should have it, and for a record of your own agreement that
 *  should not have been me. */
app.post("/api/me/new", express.json({ limit: "4kb" }), async (req, res) => {
  const out = await change((data) => {
    const since = new Date(RECENT()).toISOString();
    if (data.owners.filter((o) => o.at > since).length >= NEW_PER_HOUR) return "slow";
    const taken = new Set(data.owners.map((o) => o.key));
    let key = store.newCode(12);
    while (taken.has(key)) key = store.newCode(12);
    const me = store.cleanOwner({ name: req.body?.name, key, projects: 3 });
    if (!me) return null;
    /* The project too, in the same breath. Landing on an empty desk and being
       asked to "create a project" is a second decision for somebody who came
       here with one thing to write down. */
    const want = String(req.body?.project || "").trim();
    if (!want) return null;
    let id = want.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 34);
    if (!id) id = "record";
    /* Their chosen id may be somebody else's already. Theirs is the name; the
       id is plumbing, so it is quietly made unique rather than refused. */
    let uid = id, n = 2;
    while (data.projects.some((x) => x.id === uid)) uid = id + "-" + n++;
    const p = store.cleanProject({
      id: uid, name: want, line: String(req.body?.line || ""),
      owner: me.id, seats: 0,
    });
    if (!p) return null;
    data.owners.push(me);
    data.projects.push(p);
    return { me, p };
  });
  if (out === "slow") return res.status(429).json({ error: "slow" });
  if (!out) return res.status(400).json({ error: "bad" });
  setMe(res, out.me.id);
  res.json({ ok: true, name: out.me.name, key: out.me.key, project: out.p.id });
});

/** Spend an owner key. One person, once — after that the cookie carries them. */
app.post("/api/me/in", express.json({ limit: "1kb" }), async (req, res) => {
  const key = store.cleanCode(req.body?.key);
  if (key.length < 10) return res.status(400).json({ error: "bad" });
  const data = await store.load(FILE);
  const me = data.owners.find((o) => o.key === key);
  if (!me) return res.status(404).json({ error: "no" });
  setMe(res, me.id);
  res.json({ ok: true, name: me.name });
});

app.post("/api/me/out", (_req, res) => {
  res.append("Set-Cookie", "cfm_me=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure");
  res.json({ ok: true });
});

/** The console's whole state in one call. */
app.get("/api/me", owner, async (req, res) => {
  res.set("Cache-Control", "no-store");
  const data = await store.load(FILE);
  const own = mine(data, req.me);
  res.json({
    ok: true,
    /* Their own key, back to them. Issued keys were write-only on purpose —
       I handed those out and losing one meant asking me. A key somebody was
       given by the site itself has no such person to ask, so a lost key would
       mean a lost record the moment the cookie expires. Reading it needs that
       cookie, which already grants everything the key does. */
    me: { name: req.me.name, projects: req.me.projects, key: req.me.key },
    projects: own.projects,
    packages: own.packages,
    /* Codes included: this is the founder's own list and the code is what
       they copy to send. Nobody else's offers are ever in here. */
    offers: own.offers.map((o) => ({
      who: o.who, code: o.code, seat: o.seat, project: o.project,
      package: o.package, at: o.at, openedAt: o.openedAt, tookAt: o.tookAt,
      signed: o.signed,
    })),
  });
});

app.post("/api/me/project", express.json({ limit: "4kb" }), owner, async (req, res) => {
  const out = await change((data) => {
    const own = mine(data, req.me);
    const id = String(req.body?.id || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
    const at = data.projects.findIndex((x) => x.id === id);
    /* Editing somebody else's project by guessing its id is the one thing
       that must not work here, so an existing id that is not theirs is
       refused rather than merged into. */
    if (at >= 0 && data.projects[at].owner !== req.me.id) return "taken";
    if (at < 0 && own.projects.length >= req.me.projects) return "full";
    /* Owner from the session, never from the body. */
    const p = store.cleanProject({ ...req.body, owner: req.me.id });
    if (!p) return null;
    if (at >= 0) data.projects[at] = { ...data.projects[at], ...p };
    else data.projects.push(p);
    return p;
  });
  if (out === "taken") return res.status(409).json({ error: "taken" });
  if (out === "full") return res.status(403).json({ error: "full" });
  if (!out) return res.status(400).json({ error: "bad" });
  res.json({ ok: true, project: out });
});

app.post("/api/me/package", express.json({ limit: "4kb" }), owner, async (req, res) => {
  const out = await change((data) => {
    const own = mine(data, req.me);
    if (!own.projects.some((p) => p.id === String(req.body?.project || ""))) return null;
    const k = store.cleanPackage(req.body);
    if (!k) return null;
    /* Within the project, not across the box — see the note in view(). The
       project is already theirs, checked above, so there is nobody else's row
       this can reach. */
    const at = data.packages.findIndex((x) => x.id === k.id && x.project === k.project);
    if (at >= 0) data.packages[at] = { ...data.packages[at], ...k };
    else data.packages.push(k);
    return k;
  });
  if (out === "taken") return res.status(409).json({ error: "taken" });
  if (!out) return res.status(400).json({ error: "bad" });
  res.json({ ok: true, package: out });
});

app.post("/api/me/offer", express.json({ limit: "4kb" }), owner, async (req, res) => {
  const out = await change((data) => {
    const own = mine(data, req.me);
    const p = own.projects.find((x) => x.id === String(req.body?.project || ""));
    if (!p) return null;
    if (!own.packages.some((k) => k.id === String(req.body?.package || "") &&
      k.project === p.id)) return null;
    const taken = new Set(data.offers.map((x) => x.code));
    let code = store.newCode();
    while (taken.has(code)) code = store.newCode();
    /* A share is not a place in a queue. The project can have both kinds of
       offer on it, so the package decides, not the project. */
    const k = own.packages.find((x) => x.id === String(req.body?.package || "") &&
      x.project === p.id);
    let seat = Number(req.body?.seat) || 0;
    if (!seat && p.seats > 0 && k.face !== "stake") {
      const used = new Set(own.offers.filter((x) => x.project === p.id)
        .map((x) => x.seat).filter(Boolean));
      seat = 1; while (used.has(seat)) seat += 1;
    }
    const o = store.cleanOffer({ ...req.body, code, seat });
    if (!o) return null;
    data.offers.push(o);
    return o;
  });
  if (!out) return res.status(400).json({ error: "bad" });
  res.json({ ok: true, offer: out });
});

/** Reopen or void, on their own offers only. */
app.post("/api/me/undo", express.json({ limit: "1kb" }), owner, async (req, res) => {
  const code = store.cleanCode(req.body?.code);
  const how = req.body?.how === "void" ? "void" : "reopen";
  if (!code) return res.status(400).json({ error: "bad" });
  const out = await change((data) => {
    const own = mine(data, req.me);
    if (!own.offers.some((x) => x.code === code)) return null;
    const at = data.offers.findIndex((x) => x.code === code);
    const o = data.offers[at];
    if (how === "void") { data.offers.splice(at, 1); return { how, who: o.who }; }
    o.tookAt = ""; o.by = ""; o.openedAt = ""; o.signed = "";
    return { how, who: o.who };
  });
  if (!out) return res.status(404).json({ error: "no" });
  res.json({ ok: true, ...out });
});

/* ---- the side only the person running it sees ------------------------- */

/** Make a founder. The key is returned once and never again — it is stored to
 *  be matched, and there is no route that reads it back. Losing it means a new
 *  one, which is the correct amount of ceremony for a key that opens somebody
 *  else's record. */
app.post("/api/owner", express.json({ limit: "2kb" }), admin, async (req, res) => {
  const out = await change((data) => {
    const taken = new Set(data.owners.map((o) => o.key));
    let key = store.newCode(12);
    while (taken.has(key)) key = store.newCode(12);
    const o = store.cleanOwner({ ...req.body, key });
    if (!o) return null;
    data.owners.push(o);
    return o;
  });
  if (!out) return res.status(400).json({ error: "bad" });
  res.json({ ok: true, owner: out });
});

app.get("/api/owners", admin, async (_req, res) => {
  const data = await store.load(FILE);
  /* No keys. There is no reason to list them and every reason not to. */
  res.json({ owners: data.owners.map((o) => ({
    name: o.name, at: o.at, projects: o.projects,
    has: data.projects.filter((p) => p.owner === o.id).length,
  })) });
});

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

/* WHO IS GRANTING IT, AND OUT OF WHAT — on its own route.
 *
 * /api/project above merges what it is sent, but cleanProject fills every
 * field it did not receive, so posting two of them blanks the other eight. A
 * project set up months ago would lose its claim, its goal and its milestones
 * to a call meant to add a name — which is the kind of thing you find out
 * afterwards.
 *
 * These two get their own route because they are the two a project needs the
 * day it makes its first STAKE offer and never needs before it. A share in a
 * company, on a page that does not name the person granting it or say what
 * holding it comes out of, is a screenshot rather than a record — it is the
 * first thing a careful reader stops on, and the reader here is somebody
 * being asked to take a share instead of a salary.
 */
app.post("/api/project/from", express.json({ limit: "2kb" }), admin, async (req, res) => {
  const id = String(req.body?.id || "");
  const out = await change((data) => {
    const p = data.projects.find((x) => x.id === id);
    if (!p) return null;
    if (req.body.from !== undefined) p.from = String(req.body.from).slice(0, 60);
    if (req.body.holds !== undefined) p.holds = String(req.body.holds).slice(0, 160);
    return { id: p.id, name: p.name, from: p.from, holds: p.holds };
  });
  if (!out) return res.status(404).json({ error: "no such project" });
  res.json({ ok: true, project: out });
});

app.post("/api/package", express.json({ limit: "4kb" }), admin, async (req, res) => {
  const out = await change((data) => {
    const k = store.cleanPackage(req.body);
    if (!k) return null;
    const at = data.packages.findIndex((x) => x.id === k.id && x.project === k.project);
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
    const project = String(req.body?.project || "");
    const p = data.projects.find((x) => x.id === project);
    if (!p) return null;
    /* The seat is decided now, not when it is opened. Two people quietly told
       they are third is the one mistake here that cannot be walked back.
       Counted within the project, because seat 3 of The Exchange and seat 3
       of something else are not the same seat — and skipped entirely for a
       project that has no queue, where a seat number would be a number the
       reader is invited to misunderstand. */
    const k = data.packages.find((x) => x.id === String(req.body?.package || "") &&
      x.project === project);
    let seat = Number(req.body?.seat) || 0;
    if (!seat && p.seats > 0 && (!k || k.face !== "stake")) {
      const used = new Set(data.offers.filter((x) => x.project === project)
        .map((x) => x.seat).filter(Boolean));
      seat = 1; while (used.has(seat)) seat += 1;
    }
    const o = store.cleanOffer({ ...req.body, code, seat });
    if (!o) return null;
    data.offers.push(o);
    return o;
  });
  if (!out) return res.status(400).json({ error: "bad" });
  res.json({ ok: true, offer: out });
});

/** Undo, and the two kinds of it.
 *
 * `reopen` clears the acceptance and leaves the code alive — for the offer
 * opened by the wrong person, which on a page you test yourself before
 * sending is the mistake you make first. The alternative is a fresh code and
 * a row on the record saying somebody accepted who never did, which is
 * exactly the thing this is supposed to be better than.
 *
 * `void` removes it. Only honest for an offer that was never sent — a
 * mis-typed name, a placeholder note. An offer somebody has actually read is
 * part of what happened and gets reopened or left alone, not deleted. */
app.post("/api/undo", express.json({ limit: "1kb" }), admin, async (req, res) => {
  const code = store.cleanCode(req.body?.code);
  const how = req.body?.how === "void" ? "void" : "reopen";
  if (!code) return res.status(400).json({ error: "bad" });
  const out = await change((data) => {
    const at = data.offers.findIndex((x) => x.code === code);
    if (at < 0) return null;
    const o = data.offers[at];
    if (how === "void") { data.offers.splice(at, 1); return { how, who: o.who }; }
    o.tookAt = ""; o.by = ""; o.openedAt = "";
    return { how, who: o.who };
  });
  if (!out) return res.status(404).json({ error: "no" });
  res.json({ ok: true, ...out });
});

app.get("/api/offers", admin, async (_req, res) => {
  const data = await store.load(FILE);
  res.json({ offers: data.offers.map((o) => ({
    who: o.who, code: o.code, seat: o.seat, project: o.project, package: o.package,
    at: o.at, openedAt: o.openedAt, tookAt: o.tookAt,
  })) });
});

/** Seal a month. Chained to the last seal, so re-sealing an old month cannot
 *  be done quietly — every seal after it stops matching.
 *
 * ANCHORING, when there is a reason to.
 * A seal proves nothing on its own: the file holding the seals is the same
 * file holding the rows, and whoever can edit one can redo the other. What
 * makes it evidence is publishing the top hash somewhere the publisher cannot
 * rewrite — a Stellar `manage_data` entry costs a fraction of a cent and takes
 * 64 bytes, which is twice what a sha256 needs. That is an option a project
 * turns on, not a thing this claims by default: `ref` is empty until something
 * was actually published, and every page reads it before saying a word about
 * it. An empty ref is the honest state and looks like one. */
app.post("/api/seal", express.json({ limit: "1kb" }), admin, async (req, res) => {
  const d = new Date();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1);
  const month = /^\d{4}-\d{2}$/.test(String(req.body?.month || ""))
    ? String(req.body.month)
    : d.toISOString().slice(0, 7);
  /* A MONTH IS SEALED WHEN IT IS OVER, and not before.
     Sealing the current one looks harmless and is not: every entry made for
     the rest of the month falls outside a seal that claims to be the month,
     and the first ordinary admin afterwards — reopening an offer somebody
     took by accident, voiding one that was never sent — changes a row the
     seal covers. The hash then stops matching and the record reads as
     tampered with, by the person running it, doing their job. */
  if (month >= new Date().toISOString().slice(0, 7)) return res.status(400)
    .json({ error: "early", month });
  const out = await change((data) => {
    /* Re-sealing a month would break the chain after it and hide whatever
       changed. If a month needs a new seal, that is a decision with
       consequences and not a repeated command. */
    if (data.seals.some((x) => x.month === month)) return "already";
    const last = data.seals[data.seals.length - 1];
    const seal = store.sealOf(data, month, last ? last.hash : "");
    data.seals.push(seal);
    return seal;
  });
  if (out === "already") return res.status(409).json({ error: "sealed" });

  /* Sealed first, anchored second, and the seal survives a failed anchor.
     The chain is somebody else's machine: it is slow, it is occasionally
     down, and a month that refused to close because Horizon was busy would
     be the tail wagging the dog. An un-anchored seal is a true statement
     about a record; a month that was never sealed is a hole in one. */
  let put = null, why = anchor.bad() ? anchor.why() : "";
  if (anchor.on()) {
    try { put = await anchor.put(out.month, out.hash); }
    catch (e) { why = String((e && e.message) || e).slice(0, 200); }
    if (put) {
      await change((data) => {
        const x = data.seals.find((z) => z.month === out.month);
        if (!x) return null;
        x.ref = put.ref; x.net = put.net;
        return x;
      });
      out.ref = put.ref; out.net = put.net;
    }
  }
  res.json({ ok: true, seal: out, anchored: Boolean(put), why });
});

/** Anchor a month that is already sealed — the seal it was, not a new one.
 *  For the first anchor after turning it on, and for the one that failed
 *  because the network was busy. */
app.post("/api/anchor", express.json({ limit: "1kb" }), admin, async (req, res) => {
  if (anchor.bad()) return res.status(503).json({ error: "key", why: anchor.why() });
  if (!anchor.on()) return res.status(503).json({ error: "off" });
  const month = String(req.body?.month || "");
  const data = await store.load(FILE);
  const seal = data.seals.find((x) => x.month === month);
  if (!seal) return res.status(404).json({ error: "unsealed" });
  let put;
  try { put = await anchor.put(seal.month, seal.hash); }
  catch (e) { return res.status(502).json({ error: "chain", why: String((e && e.message) || e).slice(0, 300) }); }
  await change((d) => {
    const x = d.seals.find((z) => z.month === month);
    if (!x) return null;
    x.ref = put.ref; x.net = put.net;
    return x;
  });
  res.json({ ok: true, month, ...put });
});

/** Check a month against the chain, reading the chain rather than the file.
 *  A verification that trusts the thing it is verifying is not one. */
app.get("/api/verify", async (req, res) => {
  const month = String(req.query.month || "");
  const data = await store.load(FILE);
  const seal = data.seals.find((x) => x.month === month);
  if (!seal) return res.status(404).json({ error: "unsealed" });
  /* Recomputed from the rows as they stand now, not read from the seal. */
  const prev = data.seals[data.seals.indexOf(seal) - 1];
  const now = store.sealOf(data, month, prev ? prev.hash : "").hash;
  const out = { month, stored: seal.hash, now, matches: now === seal.hash };
  if (!anchor.on() || !seal.ref) return res.json({ ...out, anchored: false });
  try {
    const chain = await anchor.get(month);
    res.json({ ...out, anchored: true, net: seal.net, ref: seal.ref,
      chain, agrees: chain === now });
  } catch (e) {
    res.json({ ...out, anchored: true, net: seal.net, ref: seal.ref,
      why: String((e && e.message) || e).slice(0, 200) });
  }
});

/** Whether anchoring is on at all, and which account is doing it. Public: an
 *  anchor nobody can find the account for is not evidence of anything. */
app.get("/api/anchoring", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    on: anchor.on(), net: anchor.on() ? anchor.net() : "", by: anchor.who(),
    /* Set-but-wrong is its own state. Reported as such, because "off" would
       send somebody to add a key they have already added. */
    bad: anchor.bad(), why: anchor.bad() ? anchor.why() : "",
  });
});

/** Undo the newest seal, and only the newest.
 *
 * Anything earlier is load-bearing: every seal after it hashes its hash, so
 * removing one from the middle silently invalidates the rest. The last one
 * has nothing depending on it yet, which makes it the only one that can go
 * without leaving a lie behind. */
app.post("/api/unseal", express.json({ limit: "1kb" }), admin, async (_req, res) => {
  const out = await change((data) => {
    if (!data.seals.length) return null;
    return data.seals.pop();
  });
  if (!out) return res.status(404).json({ error: "none" });
  res.json({ ok: true, seal: out });
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  if (!KEY) console.error("CFM_ADMIN_KEY is not set — the admin routes refuse everything.");
  if (!SALT) console.error("CFM_SALT is not set — offers cannot be held across a reload.");
  console.log("crowdfundme on :" + PORT + ", data in " + DIR);
});
