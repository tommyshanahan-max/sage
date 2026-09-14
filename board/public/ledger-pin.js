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
  /* THE LEDGER PIN, in the same slot as a deal but not wearing its border.
     A deal is one fact about one thread and gets the accent outline; this sits
     over every visit to the room, and an accent box at the top of a room every
     time somebody opens it is a banner. Quiet card, loud number. */
  .pinwrap.ledgerpin{border-color:var(--line);padding:0;background:transparent}
  /* A group room has no deal slot to borrow, so the pin brings its own gap. */
  .pinslot{margin:0 0 1.2rem}
  .lp{display:block;width:100%;text-align:left;font:inherit;color:inherit;
    background:var(--raise);border:1px solid var(--line);border-radius:.6rem;
    padding:.7rem .75rem;cursor:pointer;display:grid;gap:.45rem}
  .lp:hover{border-color:var(--muted)}
  .lphead{display:flex;align-items:center;justify-content:space-between;gap:.5rem}
  .lpk{font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;
    font-weight:700;color:var(--muted)}
  :root[data-lang="zh"] .lpk{letter-spacing:0;text-transform:none;font-size:.7rem}
  .lpgo{font-style:normal;color:var(--muted)}
  .lpbig{font-size:1.6rem;font-weight:700;line-height:1;letter-spacing:-.02em;
    font-variant-numeric:tabular-nums}
  .lpbits{display:grid;gap:.15rem;font-size:.8rem;color:var(--ink-2)}
  .lpbits div{display:flex;justify-content:space-between;gap:1rem}
  .lpbits b{font-weight:700;font-variant-numeric:tabular-nums}
  .lptow{display:grid;gap:.25rem;font-size:.74rem;color:var(--muted)}
  .lpbar{height:3px;background:var(--hair);border-radius:99px;overflow:hidden}
  .lpbar i{display:block;height:100%;background:var(--accent);border-radius:99px}
  /* The sentence nobody may miss, so it is on the face of the button and not
     behind it. See the note over pin.note in i18n.js. */
  .lpnote{margin:0;padding-top:.45rem;border-top:1px solid var(--hair);
    font-size:.74rem;line-height:1.45;color:var(--ink-2)}
  .lpnone{margin:0;font-size:.82rem;color:var(--muted);line-height:1.5}
  /* The place-to-be reads as a sentence rather than a figure, so the big line
     is words and the number under it is the one that falls. */
  .lp .lpbig:has(+ .lpsoonw){font-size:1.15rem;font-weight:700;line-height:1.3}
  .lpsoonw{margin:0;font-size:.9rem;font-weight:700}
  .lpshut{padding:.6rem .7rem;background:var(--raise);border-radius:.6rem}

  .lpview{background:var(--raise);border:1px solid var(--line);border-radius:.6rem;
    padding:.7rem .75rem;display:grid;gap:.6rem}
  .lptabs{display:flex;gap:.3rem;flex-wrap:wrap}
  .lptab{font:inherit;font-size:.72rem;padding:.25rem .5rem;border-radius:99px;
    border:1px solid var(--line);background:transparent;color:var(--muted);cursor:pointer}
  .lptab.on{background:var(--accent);border-color:var(--accent);color:#fff}
  .lph{margin:0;font-size:1rem;font-weight:700}
  .lph:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
  .lpbody{display:grid;gap:.5rem}
  .lpbody p{margin:0;font-size:.82rem;line-height:1.55;color:var(--ink-2)}
  .lplist{list-style:none;margin:.2rem 0 0;padding:0;display:grid;gap:.25rem}
  .lplist li{display:flex;justify-content:space-between;gap:1rem;font-size:.8rem}
  .lplist b{font-variant-numeric:tabular-nums}
  .lpdo{font:inherit;font-weight:700;padding:.5rem .9rem;border-radius:99px;
    border:0;background:var(--accent);color:#fff;cursor:pointer;justify-self:start}
  .lpyes{margin:0;font-size:.82rem;font-weight:700}
  .lpsay{margin:0;font-size:.78rem;color:var(--muted)}
  .lpshutlab{font-size:.6rem!important;letter-spacing:.12em;text-transform:uppercase;
    font-weight:700;color:var(--muted)}
  .lpno{font-weight:700}
  .lpflip{font:inherit;font-size:.72rem;background:transparent;border:0;
    color:var(--muted);cursor:pointer;padding:.45rem 0 0;text-decoration:underline}
  .lpback{font:inherit;font-size:.78rem;background:transparent;border:0;
    color:var(--accent);cursor:pointer;padding:0;justify-self:start}
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
let VIEW = "over";
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
  box.append(VIEW === "over" ? overview(box, d, device) : view(box, d, device));
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
    VIEW = "over";
    if (LAST) await mountLedgerPin(LAST.box, LAST.room, LAST.device, LAST.group);
  });
  return b;
}

/* ---- the button ---------------------------------------------------------- */

function overview(box, d, device) {
  /* PAST THE LAST PLACE. Said rather than shown as a nought: a zero that never
     moves teaches somebody the thing is broken, and they are right to think so
     because for them it is. */
  if (d.shut) {
    const wrap = el("div", "lp lpshut");
    wrap.append(el("p", "lpnone", T("pin.none")));
    return wrap;
  }

  /* NOT IN YET. The place they would get rather than the place they have, and
     the number under it falls while they read — which is the entire reason
     this is in front of the door instead of behind it. */
  if (!d.place && d.soon) {
    const b = el("button", "lp");
    b.type = "button";
    b.setAttribute("aria-label", T("pin.label",
      { total: num(d.soonPts), n: num(d.soon), goal: num(d.goal) }));
    const head = el("div", "lphead");
    head.append(el("span", "lpk", T("pin.head")));
    head.append(el("i", "lpgo", "\u203A"));
    b.append(head);
    b.append(el("div", "lpbig", T("pin.soon", { n: num(d.soon) })));
    b.append(el("p", "lpsoonw", T("pin.soonWorth", { p: num(d.soonPts) })));
    b.append(el("p", "lpnote", T("pin.soonHow")));
    b.append(el("p", "lpnote", T("pin.note", { goal: num(d.goal) })));
    b.addEventListener("click", () => { VIEW = "rules"; paint(box, d, device); });
    return b;
  }

  if (!d.place) {
    const wrap = el("div", "lp lpshut");
    wrap.append(el("p", "lpnone", T("pin.none")));
    return wrap;
  }

  const b = el("button", "lp");
  b.type = "button";
  /* The whole sentence, once. See the note at the top of this file. */
  b.setAttribute("aria-label", T("pin.label",
    { total: num(d.total), n: num(d.place), goal: num(d.goal) }));

  const head = el("div", "lphead");
  head.append(el("span", "lpk", T("pin.head")));
  head.append(el("i", "lpgo", "›"));
  b.append(head);

  b.append(el("div", "lpbig", num(d.total)));

  const bits = el("div", "lpbits");
  bits.append(bit(T("pin.place", { n: num(d.place) }), d.placePts));
  if (d.acts) bits.append(bit(T("pin.forActs"), d.acts));
  b.append(bits);

  /* HOW FAR THE BOARD IS, not how far they are. The bar is the only thing on
     the pin that moves for a reason outside the reader's own doing, which is
     what makes it worth watching. */
  const on = el("div", "lptow");
  on.append(el("span", null, T("pin.toward", { n: num(d.members), goal: num(d.goal) })));
  const bar = el("div", "lpbar");
  const fill = el("i");
  fill.style.width = Math.max(0.6, Math.min(100, (d.members / d.goal) * 100)) + "%";
  bar.append(fill);
  on.append(bar);
  b.append(on);

  b.append(el("p", "lpnote", T("pin.note", { goal: num(d.goal) })));
  b.addEventListener("click", () => { VIEW = "rules"; paint(box, d, device); });
  return b;
}

const bit = (label, points) => {
  const r = el("div");
  r.append(el("span", null, label));
  r.append(el("b", null, num(points)));
  return r;
};

/* ---- the four screens behind it ------------------------------------------ */

function view(box, d, device) {
  const wrap = el("div", "lpview");

  const top = el("div", "lptabs");
  for (const [key, label] of [
    ["rules", T("pin.vRules")],
    ["join", T("pin.vJoin")],
    ["goal", T("pin.vGoal", { goal: num(d.goal) })],
    ["rec", T("pin.vRec")],
  ]) {
    const t = el("button", "lptab" + (VIEW === key ? " on" : ""), label);
    t.type = "button";
    t.setAttribute("aria-current", VIEW === key ? "true" : "false");
    t.addEventListener("click", () => { VIEW = key; paint(box, d, device); });
    top.append(t);
  }
  wrap.append(top);

  /* THE HEADING TAKES FOCUS. A view that swapped under somebody using a screen
     reader without moving focus has not changed for them — they are still
     somewhere in the old one, reading text that is gone. */
  const h = el("h3", "lph", headOf(d));
  h.tabIndex = -1;
  wrap.append(h);
  wrap.append(body(d, device));

  const back = el("button", "lpback", T("pin.back"));
  back.type = "button";
  back.addEventListener("click", () => { VIEW = "over"; paint(box, d, device); });
  wrap.append(back);

  // After it is in the document, not before — focus on a detached node is lost.
  queueMicrotask(() => { try { h.focus(); } catch { /* not focusable yet */ } });
  return wrap;
}

const headOf = (d) => VIEW === "rules" ? T("pin.vRules")
  : VIEW === "join" ? T("pin.vJoin")
  : VIEW === "goal" ? T("pin.vGoal", { goal: num(d.goal) })
  : T("pin.vRec");

function body(d, device) {
  const box = el("div", "lpbody");

  if (VIEW === "rules") {
    box.append(el("p", null, T("pin.rules")));
    box.append(el("p", null, T("pin.rulesCurve")));
    box.append(el("p", null, T("pin.rulesCap", { n: num(d.cutoff || 10) })));
    /* Their own parts, in the words the founding ledger already uses for the
       same acts — stake.p.* rather than a second set. */
    if (d.parts && d.parts.length) {
      const list = el("ul", "lplist");
      for (const r of d.parts) {
        const k = "stake.p." + r.key + (r.n === 1 ? "1" : "");
        const li = el("li");
        li.append(el("span", null, T(k, { n: num(r.n) })));
        li.append(el("b", null, num(r.points)));
        list.append(li);
      }
      box.append(list);
    }
    return box;
  }

  if (VIEW === "join") {
    box.append(el("p", null, T("pin.joinWhat")));
    if (d.joined) { box.append(el("p", "lpyes", T("pin.joinedYes"))); return box; }
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

  if (VIEW === "goal") {
    /* SHUT, AND IT SAYS SO. A disabled screen that looks like a working one is
       worse than no screen: somebody taps it, nothing happens, and what they
       learn is that the app is broken rather than that the date has not come. */
    box.append(el("p", "lpshutlab", T("pin.goalShut")));
    box.append(el("p", null, T("pin.goalWhat", { goal: num(d.goal) })));
    if (d.split) box.append(el("p", null, T("pin.goalSplit", { what: d.split })));
    return box;
  }

  box.append(el("p", null, T("pin.recWhat")));
  box.append(el("p", "lpno", T("pin.recNo")));
  return box;
}
