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
  /* DARK, IN BOTH THEMES, AND THAT IS THE DECISION.
   *
   * Everything else on this board follows the reader's theme. This does not,
   * because it is not the conversation — it is one object sitting over it, and
   * an object that keeps its own ground reads as a thing rather than as a
   * paragraph with a border. It is also how the panel gets its contrast for
   * free: near-white on near-black is 15:1 everywhere, where the light version
   * spent a morning failing to clear 4.5.
   *
   * The shape is a stack of cards with a coloured spine down the left, which
   * is what a phone uses for a figure somebody is meant to take in at a
   * glance. Label small and quiet, number large and bright, the line under it
   * small again. Three of those, then the detail. */
  .pinwrap.ledgerpin{border-color:transparent;padding:0;background:transparent}
  .pinslot{margin:0 0 1.1rem}

  .lp{--d-bg:#10141C; --d-card:#1A1F2B; --d-line:#262D3B;
      --d-ink:#F2F5FA; --d-ink2:#AFBACB; --d-mute:#8A97AB; --d-key:#5C8DFF;
      background:var(--d-bg);border-radius:1rem;overflow:hidden;
      color:var(--d-ink);
      box-shadow:0 1px 2px rgba(6,9,15,.5),0 14px 34px -18px rgba(6,9,15,.7)}

  .lphead{display:flex;align-items:flex-start;gap:.9rem;width:100%;text-align:left;
    font:inherit;color:inherit;background:transparent;border:0;cursor:pointer;
    padding:1.05rem 1.1rem}
  .lpleft{flex:1;min-width:0}
  .lpeyebrow{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;
    font-size:.84rem;letter-spacing:.06em;text-transform:uppercase;
    color:var(--d-mute);font-weight:700}
  :root[data-lang="zh"] .lpeyebrow{letter-spacing:0;text-transform:none;font-size:.92rem}
  .lptag{font-style:normal;letter-spacing:.04em;border:1px solid var(--d-line);
    border-radius:99px;padding:.12rem .45rem;color:var(--d-mute);font-size:.78rem}
  .lpunit{font-style:normal;font-size:1.05rem;font-weight:600;color:var(--d-mute);
    margin-left:.4rem;letter-spacing:0}
  .lpbig{font-size:2.3rem;font-weight:700;line-height:1.05;letter-spacing:-.025em;
    margin:.35rem 0 0;font-variant-numeric:tabular-nums}
  .lpon{display:flex;align-items:flex-start;gap:.45rem;margin:.35rem 0 0;
    font-size:.98rem;color:var(--d-ink2)}
  .lpon2{margin:.3rem 0 0;font-size:1.02rem;font-weight:700;color:var(--d-ink2)}
  .lpdot{width:.5rem;height:.5rem;margin-top:.42em;border-radius:50%;
    background:#35D08A;flex:0 0 auto}
  .lpright{text-align:right;flex:0 0 auto}
  .lpright b{display:block;font-size:1.25rem;font-weight:700;
    font-variant-numeric:tabular-nums}
  .lpright span{display:block;font-size:.86rem;color:var(--d-mute);line-height:1.35}
  .lpchev{font-style:normal;color:var(--d-mute);flex:0 0 auto;font-size:1.1rem;
    transition:transform .15s}
  .lpchev.up{transform:rotate(180deg)}

  .lpbody{padding:0 1.1rem 1.1rem;display:grid;gap:.6rem}

  /* THE THREE FIGURES, AS CARDS WITH A SPINE. The one thing somebody takes in
     without reading: a coloured edge, a quiet label, a loud number. */
  .lpstats{display:grid;gap:.5rem;margin-top:.2rem}
  .lpstat{position:relative;background:var(--d-card);border-radius:.7rem;
    padding:.75rem .85rem .75rem 1rem;overflow:hidden}
  .lpstat::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;
    background:var(--d-key)}
  .lpstat.green::before{background:#35D08A}
  .lpstat .k{display:block;font-size:.88rem;color:var(--d-mute)}
  .lpstat .v{display:block;font-size:1.6rem;font-weight:700;line-height:1.15;
    margin-top:.1rem;font-variant-numeric:tabular-nums}
  .lpstat .u{display:block;font-size:.9rem;color:var(--d-ink2);margin-top:.15rem}

  .lph{margin:.9rem 0 .1rem;font-size:1.22rem;font-weight:700}
  .lpk{margin:.8rem 0 0;font-size:.84rem;letter-spacing:.06em;text-transform:uppercase;
    color:var(--d-mute);font-weight:700}
  :root[data-lang="zh"] .lpk{letter-spacing:0;text-transform:none;font-size:.92rem}

  .lprows{display:grid;background:var(--d-card);border-radius:.7rem;
    padding:.2rem .85rem;margin-top:.15rem}
  .lprow{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;
    padding:.65rem 0;border-bottom:1px solid var(--d-line);font-size:1.04rem}
  .lprow:last-child{border-bottom:0}
  .lprow small{display:block;color:var(--d-mute);font-size:.9rem;margin-top:.1rem}
  .lprow b{font-weight:700;font-variant-numeric:tabular-nums;flex:0 0 auto}
  .lprow.sum b{color:var(--d-key)}

  .lpscale{display:flex;gap:.4rem;overflow-x:auto;padding:.2rem 0 .3rem}
  .lpcell{flex:1 0 auto;min-width:4.1rem;border-radius:.6rem;padding:.5rem .55rem;
    background:var(--d-card)}
  .lpcell.on{background:#1E2A45;box-shadow:inset 0 0 0 1.5px var(--d-key)}
  .lpcell span{display:block;font-size:.86rem;color:var(--d-mute)}
  .lpcell b{display:block;font-size:1.22rem;font-weight:700;margin-top:.1rem;
    font-variant-numeric:tabular-nums}

  .lpshare,.lptoward{margin:.15rem 0 0;font-size:1.04rem;color:var(--d-ink2)}
  .lpshare b,.lptoward b{font-size:1.25rem;font-weight:700;color:var(--d-ink);
    font-variant-numeric:tabular-nums}
  .lpbar{height:5px;background:var(--d-line);border-radius:99px;overflow:hidden;
    margin-top:.3rem}
  .lpbar i{display:block;height:100%;background:var(--d-key);border-radius:99px}
  .lpsmall{margin:.15rem 0 0;font-size:.94rem;color:var(--d-mute);line-height:1.55}

  /* ONE COLUMN, ALWAYS. Two cards side by side on a phone is two columns of
     four-word lines; the room this panel sits in is a phone by default. */
  .lptwo{display:grid;gap:.55rem;margin-top:.9rem}
  .lpcard{background:var(--d-card);border-radius:.7rem;padding:.75rem .8rem}
  .lpcard b{display:block;font-size:1.04rem;margin-bottom:.3rem}
  .lpcard p{margin:0;font-size:.96rem;line-height:1.55;color:var(--d-ink2)}

  .lprules{margin-top:.9rem;width:100%;font:inherit;font-weight:700;font-size:1.08rem;
    padding:.85rem;border-radius:.7rem;border:0;background:var(--d-key);color:#0B0E15;
    cursor:pointer}
  .lprulesbox{display:grid;gap:.5rem;padding-top:.7rem}
  .lprulesbox p{margin:0;font-size:.98rem;line-height:1.6;color:var(--d-ink2)}
  .lpjoin{display:grid;gap:.45rem;margin-top:.9rem;padding-top:.9rem;
    border-top:1px solid var(--d-line)}
  .lpdo{font:inherit;font-weight:700;font-size:1.04rem;padding:.65rem 1.2rem;
    border-radius:99px;border:0;background:var(--d-key);color:#0B0E15;
    cursor:pointer;justify-self:start}
  .lpyes{margin:0;font-size:1.02rem;font-weight:700;color:#35D08A}
  .lpsay{margin:0;font-size:.94rem;color:var(--d-mute)}
  .lpflip{font:inherit;font-size:.9rem;background:transparent;border:0;
    color:var(--d-mute);cursor:pointer;padding:.6rem 1.1rem 0;text-decoration:underline}
  .lpnone{margin:0;font-size:1rem;color:var(--d-ink2);line-height:1.55}
  .lpshut{padding:1rem 1.1rem}
  .lp :focus-visible{outline:2px solid var(--d-key);outline-offset:2px;border-radius:.4rem}
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
  /* THE SLOT IS PART OF WHAT A REDRAW WOULD CHANGE, and leaving it out was the
     bug that made the panel vanish. SHOWN lives in the module, so going from
     one room to another with the same numbers made the guard say there was
     nothing to do — and there was: the old slot had gone from the page with
     the old room and the new one was still empty. Third time tonight that a
     guard against needless redraws did not know everything a redraw changes;
     the others were the language and the preview. */
  const moved = !LAST || LAST.box !== box;
  LAST = { box, room, device, group };
  d.lang = lang();
  d.preview = PREVIEW;
  if (!moved && same(SHOWN, d)) return true;
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
  head.setAttribute("aria-controls", "lpin-body");

  const left = el("div", "lpleft");
  const eye = el("div", "lpeyebrow");
  eye.append(el("span", null, T("pin.head")));
  eye.append(el("i", "lptag", T("pin.proto")));
  left.append(eye);

  /* THE NUMBER, AS BIG AS THE NAME AT THE TOP OF THE ROOM. It is the whole
     reason anybody looks at this, so it is the largest thing in it. */
  /* THE NUMBER ALONE, WITH THE UNIT BESIDE IT AT A QUARTER THE SIZE.
     "1,000 points" as one string at this size wraps to two lines on a phone
     and the number stops being the thing you see first. */
  const big = el("div", "lpbig");
  if (d.place) {
    big.append(el("span", null, num(d.total)));
    big.append(el("i", "lpunit", T("pin.pointsWord")));
  } else if (d.soon) {
    big.append(el("span", null, T("pin.soon", { n: num(d.soon) })));
  } else {
    big.append(el("span", null, T("pin.none")));
  }
  left.append(big);
  if (d.place) {
    const on = el("p", "lpon");
    on.append(el("i", "lpdot"));
    on.append(document.createTextNode(T("pin.place", { n: num(d.place) })
      + " · " + T(d.joined ? "pin.onIt" : "pin.notOn")));
    left.append(on);
  } else if (d.soon) {
    left.append(el("p", "lpon2", T("pin.soonWorth", { p: num(d.soonPts) })));
  }
  head.append(left);

  /* NO SECOND COLUMN. "40 of 50,000 members" sat on the right of the header
     and wrapped to two lines, squeezing the left column until the eyebrow took
     three. The same count is already under Toward 50,000 a few rows down,
     where it is a fact about the board rather than something competing with
     the reader's own number for the top of the screen. */
  head.append(el("i", "lpchev" + (OPEN ? " up" : ""), "⌄"));

  head.setAttribute("aria-label", T("pin.label",
    { total: num(d.place ? d.total : d.soonPts || 0),
      n: num(d.place || d.soon || 0), goal: num(d.goal) }));
  /* THE LABEL IS THE WHOLE BUTTON, so its insides are hidden from the reader
     that uses it. Without this a screen reader announces the label and then
     reads the same figures again out of the spans underneath, which is the
     sentence twice and neither time as a sentence. Taken from the other
     session's build, which had it and mine did not. */
  for (const n of head.children) n.setAttribute("aria-hidden", "true");
  head.addEventListener("click", () => {
    OPEN = !OPEN;
    paint(box, d, device);
    /* FOCUS FOLLOWS THE OPENING, but without yanking the room. preventScroll
       and then scrollIntoView on the nearest edge: a reader who opened this
       from halfway down a conversation should not lose their place in it. */
    if (OPEN) {
      const h = box.querySelector(".lph, .lpk");
      if (h) {
        h.tabIndex = -1;
        try { h.focus({ preventScroll: true }); } catch { h.focus(); }
        h.scrollIntoView({ block: "nearest" });
      }
    }
  });
  wrap.append(head);

  if (OPEN && !d.shut) wrap.append(body(d, device));
  return wrap;
}

/* ---- everything under the chevron ---------------------------------------- */

function body(d, device) {
  const w = el("div", "lpbody");
  w.id = "lpin-body";

  /* WHERE THE POINTS CAME FROM, itemised. A total nobody can take apart is a
     number somebody has to trust; a total with its rows under it is one they
     can check, and checking it is what makes it theirs. */
  /* THE THREE FIGURES FIRST, each on its own card with a spine. What somebody
     takes in without reading — a quiet label, a loud number, a line under it —
     before any table. The table is for the person who wants to check it. */
  if (d.place) {
    const stats = el("div", "lpstats");
    stats.append(stat(T("pin.forPlace"), num(d.placePts),
      T("pin.place", { n: num(d.place) }) + " · " + T("pin.placeWhen")));
    if (d.acts) stats.append(stat(T("pin.forActs"), num(d.acts),
      T("pin.until", { date: d.until ? theDay(d.until) : "" }), true));
    stats.append(stat(T("pin.total"), num(d.total), ""));
    w.append(stats);
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
    /* A LIST, SAID AS A LIST. Five boxes of two numbers read out as ten loose
       numbers unless each cell carries its own sentence — "#100: 200 points",
       and the one you are in says so. Their build had this and mine did not. */
    sc.setAttribute("role", "list");
    for (const m of d.scale) {
      const cell = el("div", "lpcell" + (m.at === d.band ? " on" : ""));
      cell.setAttribute("role", "listitem");
      cell.setAttribute("aria-label", "#" + num(m.at) + ": " + T("pin.points", { n: num(m.pts) })
        + (m.at === d.band ? " — " + T("pin.yours") : ""));
      cell.append(el("span", null, "#" + num(m.at)));
      cell.append(el("b", null, num(m.pts)));
      for (const n of cell.children) n.setAttribute("aria-hidden", "true");
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
  const pctDone = Math.min(100, (d.members / d.goal) * 100);
  fill.style.width = Math.max(0.6, pctDone) + "%";
  /* A BAR WITH NO VALUE IS A DECORATION. Given one, it is the fact it draws. */
  bar.setAttribute("role", "img");
  bar.setAttribute("aria-label", pct(pctDone));
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

function stat(label, value, under, green) {
  const c = el("div", "lpstat" + (green ? " green" : ""));
  c.append(el("span", "k", label));
  c.append(el("span", "v", value));
  if (under) c.append(el("span", "u", under));
  return c;
}

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
