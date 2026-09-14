/* THE PIN OVER A DOOR ROOM.
 *
 * One button across the top of a room, showing the reader their own line and
 * nobody else's, and opening five screens behind it. The server half is
 * GET /api/ledger/pin and POST /api/ledger/join, and the whole feature is dark
 * unless BOARD_LEDGER_GOAL is set on the box — see the note over pinOn().
 *
 * WHY A BUTTON RATHER THAN A PANEL. A panel at the top of a room says the same
 * thing every visit in the place people came to read a conversation, which is
 * the mistake the fourth state of drawMine was removed for. A button is one
 * line, and everything that would have been a paragraph is behind it.
 *
 * THE SCREEN READER IS THE REASON THIS FILE IS SHAPED THE WAY IT IS.
 *
 *  - The button carries its whole meaning in one aria-label: a control that
 *    announces "Your ledger" and leaves the figures to two spans beside it
 *    reads out as three unrelated fragments.
 *  - The door refreshes every twenty seconds. Rebuilding the pin on each pass
 *    moves focus and restarts whatever is being read aloud, so this redraws
 *    only when a number has actually changed — `same()` is the whole guard.
 *  - Opening a view moves focus to its heading, because a screen that changes
 *    under somebody without moving focus has not changed for them at all.
 */

import { T, lang } from "/i18n.js";

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const num = (v) => Number(v || 0).toLocaleString(lang() === "zh" ? "zh-CN" : "en");

/* THE PIN'S OWN STYLES, CARRIED BY THE MODULE.
 *
 * They started in notes.html. Then the pin went into a hand-kept room too, and
 * groups.html does not load site.css — so the choice was a second copy of this
 * block in a second page, or one copy that travels with the thing it styles.
 * A second copy is how two rooms end up looking different by a fortnight.
 *
 * Injected once, guarded by id: every page that imports this gets the styling
 * and no page gets it twice. Tokens only, so it follows whatever theme the
 * page it lands in is wearing.
 */
const CSS = `
  /* THE LEDGER PANEL. It opens in place under a chevron rather than replacing
     the room, which is what every expandable thing on this phone does — and
     the first version, four tab screens behind a button, answered every
     question and was dead on the page. */
  .pinwrap.ledgerpin{border-color:transparent;padding:0;background:transparent}
  .pinslot{margin:0 0 1.1rem}
  .lp{background:var(--card);border:1px solid var(--line);border-radius:.9rem;
    overflow:hidden}
  .lphead{display:flex;align-items:flex-start;gap:.8rem;width:100%;text-align:left;
    font:inherit;color:inherit;background:transparent;border:0;cursor:pointer;
    padding:.95rem 1rem}
  .lpleft{flex:1;min-width:0}
  .lpeyebrow{display:flex;align-items:center;gap:.45rem;flex-wrap:wrap;
    font-size:.64rem;letter-spacing:.13em;text-transform:uppercase;
    color:var(--muted);font-weight:700}
  :root[data-lang="zh"] .lpeyebrow{letter-spacing:0;text-transform:none;font-size:.74rem}
  .lptag{font-style:normal;letter-spacing:.1em;border:1px solid var(--line);
    border-radius:99px;padding:.1rem .4rem;color:var(--muted)}
  /* The number is the reason anybody looks, so it is the biggest thing here —
     and in the serif, like the name at the top of the room. */
  .lpbig{font-family:var(--serif,Georgia,serif);font-size:1.75rem;line-height:1.1;
    letter-spacing:-.02em;margin:.3rem 0 0}
  .lpon{display:flex;align-items:center;gap:.4rem;margin:.3rem 0 0;
    font-size:.82rem;color:var(--ink-2)}
  .lpon2{margin:.25rem 0 0;font-size:.86rem;font-weight:700}
  .lpdot{width:.5rem;height:.5rem;border-radius:50%;background:#2E9E5B;flex:0 0 auto}
  .lpright{text-align:right;flex:0 0 auto}
  .lpright b{display:block;font-size:1.05rem;font-weight:700;
    font-variant-numeric:tabular-nums}
  .lpright span{display:block;font-size:.72rem;color:var(--muted);line-height:1.3}
  .lpchev{font-style:normal;color:var(--muted);flex:0 0 auto;transition:transform .15s}
  .lpchev.up{transform:rotate(180deg)}

  .lpbody{padding:0 1rem 1rem;display:grid;gap:.5rem;border-top:1px solid var(--hair)}
  .lph{margin:.8rem 0 .1rem;font-family:var(--serif,Georgia,serif);
    font-size:1.1rem;font-weight:600}
  .lpk{margin:.7rem 0 0;font-size:.64rem;letter-spacing:.13em;text-transform:uppercase;
    color:var(--muted);font-weight:700}
  :root[data-lang="zh"] .lpk{letter-spacing:0;text-transform:none;font-size:.74rem}

  .lprows{display:grid}
  .lprow{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;
    padding:.6rem 0;border-bottom:1px solid var(--hair);font-size:.88rem}
  .lprow small{display:block;color:var(--muted);font-size:.76rem;margin-top:.1rem}
  .lprow b{font-weight:700;font-variant-numeric:tabular-nums;flex:0 0 auto}
  .lprow.sum{border-bottom:0;font-weight:700}

  /* Five boxes, the one you are in lit. A line chart of a power law on a phone
     is a picture of nothing. */
  .lpscale{display:flex;gap:.35rem;overflow-x:auto;padding:.15rem 0 .25rem}
  .lpcell{flex:1 0 auto;min-width:3.9rem;border:1px solid var(--line);
    border-radius:.5rem;padding:.4rem .5rem;background:var(--raise)}
  .lpcell.on{border-color:var(--accent);border-width:2px;background:var(--card)}
  .lpcell span{display:block;font-size:.66rem;color:var(--muted)}
  .lpcell b{display:block;font-family:var(--serif,Georgia,serif);font-size:1.05rem;
    font-weight:600;font-variant-numeric:tabular-nums}

  .lpshare{margin:.1rem 0 0;font-size:.92rem;color:var(--ink-2)}
  .lpshare b{font-size:1.05rem;font-weight:700;color:var(--ink)}
  .lptoward{margin:.1rem 0 0;font-size:.92rem;color:var(--ink-2)}
  .lptoward b{font-size:1.05rem;font-weight:700;color:var(--ink);
    font-variant-numeric:tabular-nums}
  .lpbar{height:4px;background:var(--hair);border-radius:99px;overflow:hidden;
    margin-top:.15rem}
  .lpbar i{display:block;height:100%;background:var(--accent);border-radius:99px}
  .lpsmall{margin:.1rem 0 0;font-size:.78rem;color:var(--muted);line-height:1.5}

  /* Both endings, the same size. The second card is what makes the first
     believable. */
  .lptwo{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-top:.7rem}
  @media (max-width:420px){ .lptwo{grid-template-columns:1fr} }
  .lpcard{border:1px solid var(--line);border-radius:.6rem;padding:.65rem .7rem;
    background:var(--raise)}
  .lpcard b{display:block;font-size:.88rem;margin-bottom:.25rem}
  .lpcard p{margin:0;font-size:.8rem;line-height:1.5;color:var(--ink-2)}

  .lprules{margin-top:.8rem;width:100%;font:inherit;font-weight:700;font-size:.92rem;
    padding:.75rem;border-radius:.6rem;border:0;background:var(--accent);color:#fff;
    cursor:pointer}
  .lprulesbox{display:grid;gap:.45rem;padding-top:.6rem}
  .lprulesbox p{margin:0;font-size:.82rem;line-height:1.55;color:var(--ink-2)}
  .lpjoin{display:grid;gap:.4rem;margin-top:.8rem;padding-top:.8rem;
    border-top:1px solid var(--hair)}
  .lpdo{font:inherit;font-weight:700;padding:.55rem 1rem;border-radius:99px;border:0;
    background:var(--accent);color:#fff;cursor:pointer;justify-self:start}
  .lpyes{margin:0;font-size:.86rem;font-weight:700}
  .lpsay{margin:0;font-size:.78rem;color:var(--muted)}
  .lpflip{font:inherit;font-size:.72rem;background:transparent;border:0;
    color:var(--muted);cursor:pointer;padding:.5rem 1rem 0;text-decoration:underline}
`;

let styled = false;
function style() {
  if (styled || document.getElementById("ledgerpin-css")) { styled = true; return; }
  const tag = document.createElement("style");
  tag.id = "ledgerpin-css";
  tag.textContent = CSS;
  document.head.append(tag);
  styled = true;
}

/* What is on screen now, so a refresh that changes nothing does nothing. The
   view is in here too: a redraw that reset somebody to the overview while they
   were reading the rules would be the same bug wearing a different hat. */
let SHOWN = null;
let BUSY = false;
/* THE OPERATOR LOOKING AT THE ARRIVAL SCREEN. They are a member, so they can
   never see it any other way — the alternative is a second phone and a spare
   invite code. Staff only, and the server decides that, not this flag. */
let PREVIEW = false;
let LAST = null;

/* THE LANGUAGE IS IN HERE, and leaving it out was a real bug rather than a
   theoretical one: the toggle redraws the room, no number has changed, the
   guard says nothing to do, and the pin sits there in English on a Chinese
   screen while every view behind it is in Chinese. A guard against needless
   redraws has to know everything a redraw would change. */
const same = (a, b) =>
  a && b && a.place === b.place && a.total === b.total
  && a.members === b.members && a.joined === b.joined && a.goal === b.goal
  && a.lang === b.lang && a.preview === b.preview && a.soon === b.soon;

/** Take the pin out of the room. */
export function hideLedgerPin(box) {
  if (!box) return;
  box.hidden = true;
  box.classList.remove("ledgerpin");
  SHOWN = null;
}

/**
 * Draw it, or leave the room alone.
 *
 * `box` is the room's existing pin slot. `room` is the door. `device` is the
 * browser's own id, sent as a header the same way every other read here does.
 */
export async function mountLedgerPin(box, room, device, group) {
  if (!box) return false;
  let d = null;
  try {
    /* A door by its key, or a hand-kept room by its id. One endpoint because
       what it answers is the same either way — the reader's own line — and two
       would be two places for the access rule to disagree. */
    const q = (group ? "group=" + encodeURIComponent(group)
      : "room=" + encodeURIComponent(room)) + (PREVIEW ? "&preview=1" : "");
    d = await fetch("/api/ledger/pin?" + q,
      { cache: "no-store", headers: device ? { "x-board-device": device } : {} })
      .then((r) => (r.ok ? r.json() : null));
  } catch { d = null; }

  /* OFF IS OFF AND IT IS SILENT. No placeholder, no "coming soon" — the room
     is exactly what it was before this file existed. The answer goes back to
     the caller so a room with something else to put there can. */
  if (!d || !d.on) { hideLedgerPin(box); return false; }
  LAST = { box, room, device, group };
  d.lang = lang();
  d.preview = PREVIEW;
  if (same(SHOWN, d)) return true;
  SHOWN = d;

  style();
  box.hidden = false;
  box.classList.add("ledgerpin");
  paint(box, d, device);
  return true;
}

function paint(box, d, device) {
  box.textContent = "";
  box.append(overview(box, d, device));
  if (d.staff) box.append(flip(d));
}

/* THE TOGGLE, AND IT SAYS WHICH WAY IT WILL GO rather than which way it is.
   A control labelled with the state you are already in is the one nobody
   presses — the same reason the language button says the language it switches
   to. Drawn only where the server said staff, so this is not a client-side
   rule anybody can turn on by editing a flag in their own browser. */
function flip(d) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "lpflip";
  b.textContent = T(PREVIEW ? "pin.seeMine" : "pin.seeNew");
  b.addEventListener("click", async () => {
    PREVIEW = !PREVIEW;
    SHOWN = null;              // the shape changed, so the guard must not hold
    OPEN = false;
    if (LAST) await mountLedgerPin(LAST.box, LAST.room, LAST.device, LAST.group);
  });
  return b;
}

/* ---- the panel ----------------------------------------------------------- */

/* OPEN AND SHUT IN PLACE, rather than four screens behind a button.
 *
 * The first version was a button that replaced the room with a tab bar. It
 * answered every question and it was dead on the page: one number, and
 * everything that made the number interesting was behind a tap nobody takes in
 * a chat room. This opens downward under a chevron and the room stays where it
 * is — which is also what every expandable thing on the phone this is read on
 * does. */
let OPEN = false;

function overview(box, d, device) {
  const wrap = el("div", "lp");

  /* THE HEAD, AND IT IS A BUTTON WHETHER OR NOT IT IS OPEN. Tapping the
     numbers is the gesture; a chevron that is the only hit target is a
     four-millimetre target on a phone. */
  const head = el("button", "lphead");
  head.type = "button";
  head.setAttribute("aria-expanded", OPEN ? "true" : "false");

  const left = el("div", "lpleft");
  const eye = el("div", "lpeyebrow");
  eye.append(el("span", null, T("pin.head")
    + (d.place ? " · " + T("pin.place", { n: num(d.place) }) : "")));
  eye.append(el("i", "lptag", T("pin.proto")));
  left.append(eye);

  /* THE NUMBER, AS BIG AS THE NAME AT THE TOP OF THE ROOM. It is the whole
     reason anybody looks at this, so it is the largest thing in it. */
  left.append(el("div", "lpbig", d.place
    ? T("pin.points", { n: num(d.total) })
    : d.soon ? T("pin.soon", { n: num(d.soon) }) : T("pin.none")));
  if (d.place) {
    const on = el("p", "lpon");
    on.append(el("i", "lpdot"));
    on.append(document.createTextNode(T(d.joined ? "pin.onIt" : "pin.notOn")));
    left.append(on);
  } else if (d.soon) {
    left.append(el("p", "lpon2", T("pin.soonWorth", { p: num(d.soonPts) })));
  }
  head.append(left);

  const right = el("div", "lpright");
  right.append(el("b", null, num(d.members)));
  right.append(el("span", null, T("pin.ofGoal", { goal: num(d.goal) })));
  head.append(right);
  head.append(el("i", "lpchev" + (OPEN ? " up" : ""), "⌄"));

  head.setAttribute("aria-label", T("pin.label",
    { total: num(d.place ? d.total : d.soonPts || 0),
      n: num(d.place || d.soon || 0), goal: num(d.goal) }));
  head.addEventListener("click", () => { OPEN = !OPEN; paint(box, d, device); });
  wrap.append(head);

  if (OPEN && !d.shut) wrap.append(body(d, device));
  return wrap;
}

/* ---- everything under the chevron ---------------------------------------- */

function body(d, device) {
  const w = el("div", "lpbody");

  /* WHERE THE POINTS CAME FROM, itemised. A total nobody can take apart is a
     number somebody has to trust; a total with its rows under it is one they
     can check, and checking it is what makes it theirs. */
  if (d.place) {
    w.append(el("h3", "lph", T("pin.yourPlace")));
    const rows = el("div", "lprows");
    rows.append(row(T("pin.place", { n: num(d.place) }), d.placePts, T("pin.placeWhen")));
    for (const r of d.parts || []) {
      rows.append(row(T("stake.p." + r.key + (r.n === 1 ? "1" : ""), { n: num(r.n) }),
        r.points));
    }
    rows.append(row(T("pin.total"), d.total, "", true));
    w.append(rows);
    if (d.until) w.append(el("p", "lpsmall", T("pin.until", { date: theDay(d.until) })));
  }

  /* THE CURVE, AS FIVE BOXES WITH YOURS LIT. A line chart of a power law on a
     phone is a picture of nothing; this is the same fact and it is read at a
     glance — and it answers the question everybody actually has, which is not
     "what is my number" but "how much better would it have been to be early". */
  if (d.scale && d.scale.length) {
    w.append(el("p", "lpk", T("pin.scale")));
    const sc = el("div", "lpscale");
    for (const m of d.scale) {
      const cell = el("div", "lpcell" + (m.at === d.band ? " on" : ""));
      cell.append(el("span", null, "#" + num(m.at)));
      cell.append(el("b", null, num(m.pts)));
      sc.append(cell);
    }
    w.append(sc);
    w.append(el("p", "lpsmall", T("pin.scaleHow")));
  }

  /* THE SHARE, AND THE ONLY PROMISE ON THE SCREEN THAT IS ARITHMETIC RATHER
     THAN INTENTION: this half is fixed the day somebody joins and cannot fall,
     because the pool it is divided by is every place there will ever be rather
     than the places taken so far. */
  if (typeof d.share === "number" && d.share > 0) {
    w.append(el("p", "lpk", T("pin.pool")));
    const sh = el("p", "lpshare");
    sh.append(el("b", null, pct(d.share)));
    sh.append(document.createTextNode(" " + T("pin.shareNever")));
    w.append(sh);
    w.append(el("p", "lpsmall", T("pin.shareRest", {
      rest: num(d.rest), date: d.until ? theDay(d.until) : "",
    })));
  }

  w.append(el("p", "lpk", T("pin.toward", { goal: num(d.goal) })));
  const tw = el("p", "lptoward");
  tw.append(el("b", null, num(d.members)));
  tw.append(document.createTextNode(" " + T("pin.members")
    + (d.by ? " · " + T("pin.byDate", { date: theDay(d.by) }) : "")));
  w.append(tw);
  const bar = el("div", "lpbar");
  const fill = el("i");
  fill.style.width = Math.max(0.6, Math.min(100, (d.members / d.goal) * 100)) + "%";
  bar.append(fill);
  w.append(bar);

  /* BOTH OUTCOMES, SIDE BY SIDE AND THE SAME SIZE.
   *
   * The second card is the one that makes the first believable. A screen that
   * only describes the good ending is an advertisement; one that says plainly
   * what happens if the number is never reached is a record, and a person can
   * tell the difference in a second even if they could not say why. */
  const two = el("div", "lptwo");
  two.append(card(T("pin.ifYes", { goal: num(d.goal) }), T("pin.ifYesBody", { goal: num(d.goal) })));
  two.append(card(T("pin.ifNo"), T("pin.ifNoBody")));
  w.append(two);

  const go = el("button", "lprules");
  go.type = "button";
  go.textContent = T("pin.rulesGo");
  go.addEventListener("click", () => { RULES = !RULES; paintRules(w, d, go); });
  w.append(go);
  const rw = el("div", "lprulesbox");
  rw.hidden = !RULES;
  w.append(rw);
  if (RULES) paintRules(w, d, go, rw);

  if (!d.joined && d.place) w.append(joinRow(d, device));
  return w;
}

let RULES = false;

function paintRules(w, d, go, box) {
  const rw = box || w.querySelector(".lprulesbox");
  if (!rw) return;
  rw.hidden = !RULES;
  go.textContent = T(RULES ? "pin.rulesHide" : "pin.rulesGo");
  if (!RULES) { rw.textContent = ""; return; }
  rw.textContent = "";
  for (const k of ["pin.rules", "pin.rulesCurve", "pin.recWhat", "pin.recNo"]) {
    rw.append(el("p", null, T(k, { n: num(d.guests || 10) })));
  }
  rw.append(el("p", null, T("pin.rulesCap", { n: num(d.guests || 10) })));
}

function joinRow(d, device) {
  const box = el("div", "lpjoin");
  box.append(el("p", "lpsmall", T("pin.joinWhat")));
  const go = el("button", "lpdo", T("pin.joinDo"));
  go.type = "button";
  const say = el("p", "lpsay");
  say.hidden = true;
  go.addEventListener("click", async () => {
    if (BUSY) return;
    BUSY = true; go.disabled = true;
    try {
      const r = await fetch("/api/ledger/join", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device }),
      });
      const g = await r.json().catch(() => ({}));
      if (r.ok && g.ok) {
        d.joined = true;
        if (SHOWN) SHOWN.joined = true;
        go.replaceWith(el("p", "lpyes", T("pin.joinedYes")));
      } else {
        say.hidden = false;
        say.textContent = T(g.error === "profile" ? "pin.needPage" : "err.general");
        go.disabled = false;
      }
    } catch {
      say.hidden = false; say.textContent = T("err.general"); go.disabled = false;
    }
    BUSY = false;
  });
  box.append(go, say);
  return box;
}

/* ---- small pieces -------------------------------------------------------- */

function row(label, points, under, big) {
  const r = el("div", "lprow" + (big ? " sum" : ""));
  const l = el("div");
  l.append(el("span", null, label));
  if (under) l.append(el("small", null, under));
  r.append(l);
  r.append(el("b", null, num(points)));
  return r;
}

function card(head, bodyText) {
  const c = el("div", "lpcard");
  c.append(el("b", null, head));
  c.append(el("p", null, bodyText));
  return c;
}

/* A percentage with enough places to be a number rather than a nought. Four
   decimals because at fifty thousand places two of them are always zero. */
const pct = (v) => (v >= 1 ? v.toFixed(2) : v.toFixed(4)) + "%";

/* A day, said the way the language says days. Not a format string away from
   English — see `when` in i18n.js, which this follows. */
function theDay(iso) {
  const d = new Date(String(iso) + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return String(iso);
  return lang() === "zh"
    ? d.getUTCFullYear() + "年" + (d.getUTCMonth() + 1) + "月" + d.getUTCDate() + "日"
    : d.toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
