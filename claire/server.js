/* ClaireTv — vertical micro-drama, and the console a partner runs it from.
 *
 * ---------------------------------------------------------------------------
 * TWO AUDIENCES, ONE SERVER, AND A LINE BETWEEN THEM.
 *
 *   /            the app. Anybody. No account.
 *   /partner     the console. A key in a header, and nothing else gets in.
 *
 * The line is CLAIRE_PARTNER_KEY. Unset, every partner route answers 503 and
 * the console says so — the safe failure, because a catalogue anybody can edit
 * is worse than one nobody can.
 *
 * WHAT IS REAL AND WHAT IS NOT, said here rather than discovered later:
 *   real    the catalogue, the wall, the coin ledger, unlocks, play counts
 *   not     video hosting (episodes carry a URL), payment (coins are granted,
 *           not bought), sign-in (a viewer is a browser)
 * Each of those is a service and a bill, and none of them changes the shape
 * below. --------------------------------------------------------------------
 */
import express from "express";
import { readFile } from "node:fs/promises";
import * as store from "./lib/store.js";

const PORT = Number(process.env.PORT || 8080);
const DIR = process.env.CLAIRE_DIR || "/data";
const SALT = process.env.CLAIRE_SALT || "";
const KEY = process.env.CLAIRE_PARTNER_KEY || "";
const WELCOME = Number(process.env.CLAIRE_WELCOME_COINS || 20);

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));

/* ---- who is asking -------------------------------------------------------
 * The browser sends its own id on a header rather than a cookie: the app is
 * one page talking to its own origin, and a header cannot be sent by a link
 * somebody else wrote. */
const who = (req) => store.hashDevice(req.get("x-claire-device"), SALT);

/* A partner key compared in constant time, because a key compared with === is
 * a key that can be guessed one character at a time by a patient stranger. */
function isPartner(req) {
  if (!KEY) return false;
  const sent = String(req.get("x-claire-key") || "");
  if (sent.length !== KEY.length) return false;
  let diff = 0;
  for (let i = 0; i < KEY.length; i++) diff |= sent.charCodeAt(i) ^ KEY.charCodeAt(i);
  return diff === 0;
}

const partnerOnly = (req, res, next) => {
  if (!KEY) return res.status(503).json({ error: "unconfigured" });
  if (!isPartner(req)) return res.status(401).json({ error: "no" });
  next();
};

/* ---- pages ---------------------------------------------------------------
 * Read once and kept. The board learned this the hard way and wrote it down:
 * a running server will not pick up an HTML change, so restart it. */
const PAGES = new Map();
async function page(file, res) {
  try {
    if (!PAGES.has(file)) PAGES.set(file, await readFile("public/" + file, "utf8"));
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "no-cache");
    res.send(PAGES.get(file));
  } catch { res.status(404).send("not here"); }
}

app.get("/", (req, res) => page("app.html", res));
app.get("/partner", (req, res) => page("partner.html", res));
app.use(express.static("public", { maxAge: "1h", index: false }));

/* ---- the app -------------------------------------------------------------- */

/** What the home screen needs, in one call.
 *
 *  Keep-watching is computed here rather than on the page, because "the
 *  episode you stopped in the middle of" is the most valuable row on the
 *  screen and the page should not be able to get it wrong. */
app.get("/api/home", (req, res) => {
  const me = who(req);
  const b = store.read();
  const live = b.series.filter((s) => s.live);

  const mine = me ? b.plays.filter((p) => p.by === me).sort((a, c) => c.at.localeCompare(a.at)) : [];
  let resume = null;
  for (const p of mine) {
    const ep = b.episodes.find((e) => e.id === p.ep);
    const s = ep && store.seriesById(ep.series);
    if (!s || !s.live) continue;
    resume = { series: card(s), ep: { n: ep.n, title: ep.title, seconds: ep.seconds }, at: p.seconds || 0 };
    break;
  }

  const plays = (id) => b.plays.filter((p) => {
    const ep = b.episodes.find((e) => e.id === p.ep);
    return ep && ep.series === id;
  }).length;

  const top = [...live].sort((a, c) => plays(c.id) - plays(a.id)).slice(0, 6).map(card);
  const featured = live.find((s) => s.id === b.featured) || top[0] || null;

  res.json({
    featured: featured ? card(featured) : null,
    resume,
    top: top.filter((t) => !featured || t.id !== featured.id).slice(0, 3),
    coins: me ? (store.viewer(me)?.coins ?? WELCOME) : WELCOME,
  });
});

/** The public shape of a series. Never the whole row: `bundleCents` and the
 *  coin price belong on it, the partner's notes and timestamps do not. */
const card = (s) => ({
  id: s.id, title: s.title, blurb: s.blurb, genre: s.genre, art: s.art,
  freeThrough: s.freeThrough, coinsPerEpisode: s.coinsPerEpisode,
  bundleCents: s.bundleCents, totalPlanned: s.totalPlanned,
  episodes: store.episodesOf(s.id).length,
});

app.get("/api/series/:id", (req, res) => {
  const me = who(req);
  const s = store.seriesById(req.params.id);
  if (!s || !s.live) return res.status(404).json({ error: "no" });
  const eps = store.episodesOf(s.id).map((e) => ({
    id: e.id, n: e.n, title: e.title, seconds: e.seconds,
    open: me ? store.canWatch(me, s, e) : e.n <= s.freeThrough,
  }));
  res.json({ series: card(s), episodes: eps, coins: me ? (store.viewer(me)?.coins ?? WELCOME) : WELCOME });
});

/** The episode itself, and the only route that decides whether a URL is
 *  handed over. Locked is a 402 with the price in it rather than a 403: the
 *  page needs to draw a sheet, and a sheet without a number on it is a dead
 *  end. */
app.get("/api/watch/:id", (req, res) => {
  const me = who(req);
  const b = store.read();
  const ep = b.episodes.find((e) => e.id === req.params.id);
  const s = ep && store.seriesById(ep.series);
  if (!ep || !s || !s.live) return res.status(404).json({ error: "no" });

  if (!me || !store.canWatch(me, s, ep)) {
    return res.status(402).json({
      /* The series id rides along with the refusal. Without it the page has to
         ask a second time to find out what the bundle it is offering belongs
         to, and a sheet that needs two round trips to draw one button is a
         sheet that flickers. */
      error: "locked", n: ep.n, title: ep.title, series: s.id, art: s.art,
      coins: s.coinsPerEpisode, bundleCents: s.bundleCents,
      /* WELCOME, not 0, for somebody who has no row yet. A viewer row is only
         minted when they watch or spend, so the sheet used to say "you have 0"
         and the unlock then said "20 of 60" — two numbers for the same wallet,
         a second apart. */
      have: me ? (store.viewer(me)?.coins ?? WELCOME) : WELCOME,
    });
  }
  res.json({ id: ep.id, n: ep.n, title: ep.title, hook: ep.hook, url: ep.url, seconds: ep.seconds });
});

/** Where somebody stopped. Written on a timer by the page, so it is the one
 *  route that will be called most and does the least. */
app.post("/api/mark", async (req, res) => {
  const me = who(req);
  if (!me) return res.status(400).json({ error: "no" });
  const id = String(req.body?.ep || "");
  const at = Math.max(0, Math.min(3600, Number(req.body?.seconds) || 0));
  await store.change((b) => {
    if (!b.episodes.some((e) => e.id === id)) return;
    store.ensureViewer(b, me, WELCOME);
    const was = b.plays.find((p) => p.by === me && p.ep === id);
    if (was) { was.seconds = at; was.at = new Date().toISOString(); }
    else b.plays.push({ by: me, ep: id, seconds: at, at: new Date().toISOString() });
  });
  res.json({ ok: true });
});

/** Spend coins. One episode, or the whole series outright.
 *
 *  The balance and the ledger row are written in the same change, because a
 *  balance that disagrees with the ledger is the bug nobody can unpick after
 *  the fact. */
app.post("/api/unlock", async (req, res) => {
  const me = who(req);
  if (!me) return res.status(400).json({ error: "no" });
  const whole = Boolean(req.body?.whole);
  const out = await store.change((b) => {
    const ep = b.episodes.find((e) => e.id === String(req.body?.ep || ""));
    const s = store.seriesById(whole ? String(req.body?.series || "") : ep?.series);
    if (!s || !s.live || (!whole && !ep)) return { error: "no" };

    const v = store.ensureViewer(b, me, WELCOME);
    const price = whole ? Math.ceil(s.bundleCents / 10) : s.coinsPerEpisode;
    if (v.coins < price) return { error: "short", need: price, have: v.coins };

    const already = b.unlocks.some((u) =>
      u.by === me && u.series === s.id && (whole ? u.whole : u.ep === ep.id));
    if (already) return { ok: true, coins: v.coins };

    v.coins -= price;
    b.unlocks.push({
      by: me, series: s.id, ep: whole ? "" : ep.id, whole,
      coins: price, at: new Date().toISOString(),
    });
    return { ok: true, coins: v.coins };
  });
  if (out?.error) return res.status(out.error === "short" ? 402 : 400).json(out);
  res.json(out);
});

/* ---- the partner console -------------------------------------------------- */

app.get("/api/partner/hello", (req, res) => {
  res.json({ configured: Boolean(KEY), ok: isPartner(req) });
});

app.get("/api/partner/catalogue", partnerOnly, (req, res) => {
  const b = store.read();
  const rows = b.series
    .map((s) => {
      const eps = store.episodesOf(s.id);
      const unlocks = b.unlocks.filter((u) => u.series === s.id);
      return {
        ...s,
        episodes: eps,
        made: eps.length,
        /* THE THREE NUMBERS A PARTNER ACTUALLY ASKS FOR, and they are the
           three the wall is judged by: how many got as far as the wall, how
           many paid, and what that came to. */
        reached: b.plays.filter((p) => {
          const e = eps.find((x) => x.id === p.ep);
          return e && e.n === s.freeThrough;
        }).length,
        paid: new Set(unlocks.map((u) => u.by)).size,
        coins: unlocks.reduce((n, u) => n + (u.coins || 0), 0),
      };
    })
    .sort((a, c) => c.at.localeCompare(a.at));
  res.json({ series: rows, featured: b.featured || "", viewers: b.viewers.length });
});

app.post("/api/partner/series", partnerOnly, async (req, res) => {
  const out = await store.change((b) => {
    const was = req.body?.id ? b.series.find((s) => s.id === req.body.id) : null;
    const row = store.cleanSeries(req.body || {}, was);
    if (!row.title) return { error: "title" };
    if (was) Object.assign(was, row); else b.series.push(row);
    return { ok: true, id: row.id };
  });
  if (out?.error) return res.status(400).json(out);
  res.json(out);
});

app.post("/api/partner/episode", partnerOnly, async (req, res) => {
  const out = await store.change((b) => {
    const s = b.series.find((x) => x.id === String(req.body?.series || ""));
    if (!s) return { error: "series" };
    const was = req.body?.id ? b.episodes.find((e) => e.id === req.body.id) : null;
    const row = store.cleanEpisode(req.body || {}, s.id, was);
    if (!row.title) return { error: "title" };
    /* Two episodes numbered 8 is a wall in two places. The number is the
       thing the whole model is ordered by, so it is the one collision that
       is refused rather than tolerated. */
    const clash = b.episodes.some((e) => e.series === s.id && e.n === row.n && e.id !== row.id);
    if (clash) return { error: "taken", n: row.n };
    if (was) Object.assign(was, row); else b.episodes.push(row);
    return { ok: true, id: row.id };
  });
  if (out?.error) return res.status(400).json(out);
  res.json(out);
});

app.post("/api/partner/delete-episode", partnerOnly, async (req, res) => {
  await store.change((b) => {
    const id = String(req.body?.id || "");
    b.episodes = b.episodes.filter((e) => e.id !== id);
    b.unlocks = b.unlocks.filter((u) => u.ep !== id);
    b.plays = b.plays.filter((p) => p.ep !== id);
  });
  res.json({ ok: true });
});

app.post("/api/partner/feature", partnerOnly, async (req, res) => {
  await store.change((b) => { b.featured = String(req.body?.id || ""); });
  res.json({ ok: true });
});

/** Coins granted rather than sold, because there is no payment processor here
 *  and a button labelled Buy that does not take money is a lie in a mockup's
 *  clothing. This is how a partner comps a reviewer, a tester or a refund. */
app.post("/api/partner/grant", partnerOnly, async (req, res) => {
  const out = await store.change((b) => {
    const id = String(req.body?.viewer || "");
    const n = Math.max(-100000, Math.min(100000, Number(req.body?.coins) || 0));
    const v = b.viewers.find((x) => x.by === id);
    if (!v) return { error: "viewer" };
    v.coins = Math.max(0, v.coins + n);
    return { ok: true, coins: v.coins };
  });
  if (out?.error) return res.status(404).json(out);
  res.json(out);
});

/* ---- up ------------------------------------------------------------------ */
app.get("/api/health", (req, res) => res.json({ ok: true, partner: Boolean(KEY) }));

await store.open(DIR);
app.listen(PORT, () => {
  console.log("ClaireTv on " + PORT + (KEY ? "" : "  (no partner key — /partner is closed)"));
});
