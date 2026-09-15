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
      --d-ink:#F2F5FA; --d-ink2:#D6DEEA; --d-mute:#B4C1D2; --d-key:#5C8DFF;
      background:var(--d-bg);border-radius:1rem;overflow:hidden;
      color:var(--d-ink);
      /* LIGHT ON DARK LOSES APPARENT STROKE. Every ratio in here clears 5:1
         and it still read as faint, which is the eye and not the arithmetic:
         a light glyph on a dark ground blooms and thins. Antialiased rather
         than the browser's subpixel default keeps the stems where they were
         drawn, and the small text carries one more weight step than it would
         on white for the same reason. */
      -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
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
    font-size:.98rem;font-weight:500;color:var(--d-ink2)}
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
  /* THE THREE ACROSS THE TOP. Short numbers side by side, which is how a
     phone reads three of them — stacked they become a list to scroll. */
  .lp3{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin-top:.2rem;
    background:var(--d-card);border-radius:.7rem;padding:.85rem .7rem}
  .lp3c{min-width:0;text-align:center}
  .lp3c .k{display:block;font-size:.8rem;font-weight:600;color:var(--d-mute);
    line-height:1.3}
  .lp3c .v{display:block;font-size:1.3rem;font-weight:700;margin-top:.2rem;
    letter-spacing:-.01em;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
  .lp3c .u{display:block;font-size:.78rem;font-weight:500;color:var(--d-ink2);
    margin-top:.1rem;line-height:1.35}

  /* The curve. One series, so the label over it is the legend. */
  .lpspark{margin-top:.7rem}
  .lpspark svg{display:block;width:100%;height:76px;margin-top:.2rem}
  .lpends{display:flex;justify-content:space-between;font-size:.78rem;
    font-weight:500;color:var(--d-mute);margin-top:.1rem}

  .lpstats{display:grid;gap:.5rem;margin-top:.2rem}
  .lpstat{position:relative;background:var(--d-card);border-radius:.7rem;
    padding:.75rem .85rem .75rem 1rem;overflow:hidden}
  .lpstat::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;
    background:var(--d-key)}
  .lpstat.green::before{background:#35D08A}
  .lpstat .k{display:block;font-size:.88rem;font-weight:600;color:var(--d-mute)}
  .lpstat .v{display:block;font-size:1.6rem;font-weight:700;line-height:1.15;
    margin-top:.1rem;font-variant-numeric:tabular-nums}
  .lpstat .u{display:block;font-size:.9rem;font-weight:500;color:var(--d-ink2);margin-top:.15rem}

  .lph{margin:.9rem 0 .1rem;font-size:1.22rem;font-weight:700}
  .lpk{margin:.8rem 0 0;font-size:.84rem;letter-spacing:.06em;text-transform:uppercase;
    color:var(--d-mute);font-weight:700}
  :root[data-lang="zh"] .lpk{letter-spacing:0;text-transform:none;font-size:.92rem}

  .lprows{display:grid;background:var(--d-card);border-radius:.7rem;
    padding:.2rem .85rem;margin-top:.15rem}
  .lprow{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;
    padding:.65rem 0;border-bottom:1px solid var(--d-line);font-size:1.04rem;font-weight:500}
  .lprow:last-child{border-bottom:0}
  .lprow small{display:block;color:var(--d-mute);font-size:.9rem;font-weight:500;margin-top:.1rem}
  .lprow b{font-weight:700;font-variant-numeric:tabular-nums;flex:0 0 auto}
  .lprow.sum b{color:var(--d-key)}

  .lpscale{display:flex;gap:.4rem;overflow-x:auto;padding:.2rem 0 .3rem}
  .lpcell{flex:1 0 auto;min-width:4.1rem;border-radius:.6rem;padding:.5rem .55rem;
    background:var(--d-card)}
  .lpcell.on{background:#1E2A45;box-shadow:inset 0 0 0 1.5px var(--d-key)}
  .lpcell span{display:block;font-size:.86rem;font-weight:600;color:var(--d-mute)}
  .lpcell b{display:block;font-size:1.22rem;font-weight:700;margin-top:.1rem;
    font-variant-numeric:tabular-nums}

  /* THE FUNNEL, AND IT IS NOT BEHIND THE CHEVRON.
   *
   * A cone lying on its side: four slices, rising left to right, each filling
   * from the bottom. The first ten is the tip and the first ten thousand is
   * the mouth. It replaced four stacked rows, which said the same thing down
   * the length of a phone screen; this says it in one picture the height of
   * two lines of text, which is what somebody reading in a taxi gets.
   *
   * THE HEIGHTS ARE A SCALE, NOT A SHAPE. A tier holds 10, 90, 900 or 9,000
   * places — four decades — so the top edge rises by an even quarter per
   * slice and the slice heights come out 12 / 36 / 60 / 84 per cent. A cone
   * drawn because a cone looks good would be a chart of nothing, which is
   * worse than no chart at all.
   *
   * CLIP-PATH RATHER THAN SVG. Each slice is a plain box carved to a trapezoid
   * by its own two top corners, and the fill inside it is carved by the same
   * path — so a slice that is a third full is a third of that slice's own
   * wedge, not a third of the strip. An SVG would need its own viewBox and
   * would fight the panel's width; this is four divs.
   *
   * ALWAYS DRAWN. It replaced the five-box sliding scale, which said the same
   * fact from behind a tap and a second tap after that. */
  .lpfun{padding:.2rem 1.1rem 0}
  .lpfunbox{background:var(--d-card);border-radius:.8rem;padding:.85rem .85rem .7rem}
  .lpcone{display:flex;align-items:stretch;gap:3px;height:74px}
  /* THE EMPTY CONE HAS TO BE VISIBLE OR THERE IS NO CONE. On --d-line it was
     a shape you could only find by knowing it was there, and then the filled
     part read as a flat bar with nothing above it. */
  .lpsl{position:relative;flex:1;min-width:0;background:#333C4E;
    clip-path:polygon(0 var(--a),100% var(--b),100% 100%,0 100%)}
  /* IT IS A LEVEL, AND THE LEVEL RISES ALONG THE ROOF.
   *
   * Two wrong answers came before this one. Filled bottom-up by each slice's
   * own fraction, the first ten (FULL) and the first hundred (a third full)
   * drew blue to the same height, because the second wedge is three times the
   * first — one flat bar across two tiers in completely different states.
   * Filled left to right, a full tier was at least a wholly coloured wedge,
   * but the blue in the tier still filling stood TALLER than the tier before
   * it had ever reached, which is not what a thing filling up does.
   *
   * So the waterline tracks the cone's own roof. A tier starts filling at the
   * height of its left-hand corner — which is exactly where the tier before it
   * finished — and reaches its right-hand corner when it is full. The blue
   * surface therefore only ever rises, it is continuous across the joins, and
   * a full tier is a wedge filled to its own highest point. */
  .lpsl i{position:absolute;left:0;right:0;bottom:0;background:var(--d-key)}
  /* A TIER THAT IS GONE IS GREY — unless it is the reader's own, where full
     means got in rather than missed, and one colour for both says the wrong
     one of them. */
  .lpsl.rdone i{background:var(--d-mute)}
  .lpsl.on i{background:var(--d-key)}
  /* NO RING ON THE READER'S OWN SLICE. An inset shadow is clipped away by the
     clip-path that makes the wedge, so it drew nothing; and the head above
     already says "Place #1 · First ten", which is the same fact in words. */
  /* The four labels, on the same grid as the slices so each sits under its
     own. Two lines: the edge, and what is happening in it. */
  .lpkeys{display:flex;gap:3px;margin-top:.4rem}
  .lpkey{flex:1;min-width:0;text-align:center}
  .lpkey b{display:block;font-size:.88rem;font-weight:700;color:var(--d-ink2);
    font-variant-numeric:tabular-nums}
  .lpkey span{display:block;font-size:.76rem;font-weight:600;color:var(--d-mute);
    line-height:1.3;margin-top:.05rem;overflow-wrap:anywhere}
  .lpkey.on b{color:var(--d-ink)}
  .lpkey.now span{color:var(--d-key)}
  /* THE SENTENCE THE PICTURE IS THERE TO MAKE, said in words underneath it
     because a picture nobody can quote is not a thing anybody repeats. */
  .lpnow{margin:.75rem 0 0;font-size:1.12rem;font-weight:700;line-height:1.35}
  .lpnow b{color:var(--d-key);font-variant-numeric:tabular-nums}
  .lpnow2{margin:.2rem 0 0;font-size:.9rem;font-weight:500;color:var(--d-ink2)}
  /* WHAT IT COMES TO IF THE TARGET IS REACHED, which is the question the whole
     panel is read to answer and was four taps down. One box, one figure, and
     the two numbers it stands on named underneath it. */
  .lpat{padding:0 1.1rem 1.05rem}
  .lpatbox{background:var(--d-card);border-radius:.7rem;padding:.85rem .9rem;
    box-shadow:inset 0 0 0 1.5px var(--d-key)}
  .lpatbox .k{display:block;font-size:.84rem;letter-spacing:.06em;font-weight:700;
    text-transform:uppercase;color:var(--d-mute);line-height:1.3}
  :root[data-lang="zh"] .lpatbox .k{letter-spacing:0;text-transform:none;font-size:.92rem}
  .lpatbox .v{display:block;font-size:1.9rem;font-weight:700;margin-top:.15rem;
    letter-spacing:-.02em;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
  .lpatbox .u{display:block;font-size:.84rem;font-weight:500;color:var(--d-ink2);
    margin-top:.2rem;line-height:1.4}
  .lpshare,.lptoward{margin:.15rem 0 0;font-size:1.04rem;font-weight:500;color:var(--d-ink2)}
  .lpshare b,.lptoward b{font-size:1.25rem;font-weight:700;color:var(--d-ink);
    font-variant-numeric:tabular-nums}
  .lpbar{height:5px;background:var(--d-line);border-radius:99px;overflow:hidden;
    margin-top:.3rem}
  .lpbar i{display:block;height:100%;background:var(--d-key);border-radius:99px}
  /* THE TWO FIGURES, SIDE BY SIDE. Same size, same weight: one is not the
     promise and the other the small print. The second carries the accent
     because it is the one that depends on something not having happened yet. */
  .lppair{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-top:.5rem}
  .lpworth{background:var(--d-card);border-radius:.7rem;padding:.8rem .75rem;
    min-width:0}
  .lpworth.key{box-shadow:inset 0 0 0 1.5px var(--d-key)}
  .lpworth .k{display:block;font-size:.82rem;font-weight:600;color:var(--d-mute);
    line-height:1.3}
  .lpworth .v{display:block;font-size:1.55rem;font-weight:700;margin-top:.2rem;
    letter-spacing:-.02em;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
  .lpworth .u{display:block;font-size:.8rem;font-weight:500;color:var(--d-ink2);
    margin-top:.15rem;line-height:1.35}
  .lpmoney{margin:.4rem 0 0;font-size:1.04rem;font-weight:500;color:var(--d-ink2)}
  .lpmoney b{display:block;font-size:1.8rem;font-weight:700;color:var(--d-ink);
    letter-spacing:-.02em;font-variant-numeric:tabular-nums}
  .lpsmall{margin:.15rem 0 0;font-size:.94rem;font-weight:500;color:var(--d-mute);line-height:1.55}

  /* ONE COLUMN, ALWAYS. Two cards side by side on a phone is two columns of
     four-word lines; the room this panel sits in is a phone by default. */
  .lptwo{display:grid;gap:.55rem;margin-top:.9rem}
  .lpcard{background:var(--d-card);border-radius:.7rem;padding:.75rem .8rem}
  .lpcard b{display:block;font-size:1.04rem;margin-bottom:.3rem}
  .lpcard p{margin:0;font-size:.96rem;font-weight:500;line-height:1.55;color:var(--d-ink2)}

  .lprules{margin-top:.9rem;width:100%;font:inherit;font-weight:700;font-size:1.08rem;
    padding:.85rem;border-radius:.7rem;border:0;background:var(--d-key);color:#0B0E15;
    cursor:pointer}
  .lprulesbox{display:grid;gap:.5rem;padding-top:.7rem}
  .lprulesbox p{margin:0;font-size:.98rem;font-weight:500;line-height:1.6;color:var(--d-ink2)}
  .lpjoin{display:grid;gap:.45rem;margin-top:.9rem;padding-top:.9rem;
    border-top:1px solid var(--d-line)}
  .lpdo{font:inherit;font-weight:700;font-size:1.04rem;padding:.65rem 1.2rem;
    border-radius:99px;border:0;background:var(--d-key);color:#0B0E15;
    cursor:pointer;justify-self:start}
  .lpyes{margin:0;font-size:1.02rem;font-weight:700;color:#35D08A}
  .lpsay{margin:0;font-size:.94rem;color:var(--d-mute)}
  /* The way out, at the end of the way in. Quiet — it is not a thing to do,
     it is a thing to stop doing — but full width, because a small control at
     the foot of a long dark card is a control nobody finds. */
  .lpclose{margin-top:.9rem;width:100%;font:inherit;font-weight:600;font-size:.94rem;
    padding:.7rem;border-radius:.7rem;border:1px solid var(--d-line);
    background:transparent;color:var(--d-mute);cursor:pointer}
  .lpclose:hover{color:var(--d-ink);border-color:var(--d-mute)}
  /* And the chevron reads as a control rather than a mark: a target the size
     of a thumb, with a ring it can show when it has focus. */
  .lpchev{padding:.15rem .3rem;border-radius:.4rem}
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
  && a.lang === b.lang && a.preview === b.preview && a.soon === b.soon
  /* THE LADDER AND THE FIGURE AT THE GOAL, both of which are now on screen
     without a tap. Fourth time a guard against needless redraws did not know
     everything a redraw changes; the others are named above. */
  && (a.tier || {}).left === (b.tier || {}).left
  && (a.tier || {}).key === (b.tier || {}).key
  && a.moneyAt === b.moneyAt;

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
  /* THE TIER IS THE HALF THEY REPEAT. "Place #41" is a receipt; "in the first
     hundred" is what somebody tells a friend, so both are on the line and the
     tier is the half that survives being read at a glance. Whether they have
     pressed Join is a different fact and gets its own quiet line — it used to
     sit here in the tier's place, which spent the loudest line on the screen
     saying nothing anybody wanted to know. */
  if (d.place) {
    const on = el("p", "lpon");
    on.append(el("i", "lpdot"));
    on.append(document.createTextNode(T("pin.place", { n: num(d.place) })
      + (d.yourTier ? " · " + T("layer." + d.yourTier.key) : "")));
    left.append(on);
    if (!d.joined) left.append(el("p", "lpsmall", T("pin.notOn")));
  } else if (d.soon) {
    left.append(el("p", "lpon2", T("pin.soonWorth", { p: num(d.soonPts) })));
    if (d.soonTier) left.append(el("p", "lpsmall",
      T("pin.soonTier", { tier: T("layer." + d.soonTier.key) })));
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

  /* BOTH OF THESE SIT OUTSIDE THE CHEVRON ON PURPOSE. They are the two things
     somebody opened this to find out — which tier is filling, and what it
     comes to if the target is reached — and everything that was behind a tap
     was read by nobody. */
  if (!d.shut) {
    const lad = ladder(d);
    if (lad) wrap.append(lad);
    const at = atGoal(d);
    if (at) wrap.append(at);
  }

  if (OPEN && !d.shut) wrap.append(body(d, device));
  return wrap;
}

/** THE FUNNEL: four slices of a cone on its side, and the sentence under it.
 *
 *  The tip is the first ten and the mouth is the first ten thousand, because
 *  that is the order they fill in and the order somebody loses them in. Each
 *  slice fills from the bottom by how much of its own tier is taken.
 *
 *  See the note over .lpfun for why the heights are a scale rather than a
 *  shape, and why it is clip-path and not an SVG.
 */
function ladder(d) {
  if (!d.tiers || !d.tiers.length) return null;
  const mine = (d.yourTier || d.soonTier || {}).key || "";
  const wrap = el("div", "lpfun");
  const box = el("div", "lpfunbox");

  const cone = el("div", "lpcone");
  const keys = el("div", "lpkeys");
  /* THE TOP EDGE, AS ONE STRAIGHT LINE ACROSS ALL FOUR. Worked out per slice
     from its two ends rather than given as four heights, so the slices join
     into one cone instead of four boxes standing in a row. It starts at the
     floor — the first ten is a triangle, which is what a tenth of a decade
     looks like and is the honest size of it. */
  const topAt = (i) => 100 - (i * 96) / d.tiers.length;
  let now = null;
  d.tiers.forEach((t, i) => {
    const taken = Math.min(t.size, Math.max(0, d.members - t.from + 1));
    const full = taken >= t.size;
    const open = taken > 0;
    if (open && !full) now = { t, taken };

    const sl = el("div", "lpsl"
      + (t.key === mine ? " on" : "") + (full ? " rdone" : ""));
    sl.style.setProperty("--a", topAt(i) + "%");
    sl.style.setProperty("--b", topAt(i + 1) + "%");
    /* THE WATERLINE, WHICH IS THIS SLICE'S TWO TOP CORNERS INTERPOLATED BY HOW
       full the tier is — see the note over .lpsl i. Empty sits on the floor at
       the left corner's height, full reaches the right corner, and the clip
       path carves whatever is under it to the wedge. */
    const line = topAt(i) + (topAt(i + 1) - topAt(i)) * (taken / t.size);
    const fill = el("i");
    fill.style.height = (open ? 100 - line : 0) + "%";
    sl.append(fill);
    cone.append(sl);

    const k = el("div", "lpkey"
      + (t.key === mine ? " on" : "") + (open && !full ? " now" : ""));
    k.append(el("b", null, num(t.upto)));
    k.append(el("span", null, full ? T("pin.tFull")
      : open ? T(t.size - taken === 1 ? "pin.tOne" : "pin.tLeft", { n: num(t.size - taken) })
      : T("pin.tShut")));
    keys.append(k);
  });

  /* ONE PICTURE, ONE SENTENCE, SAID ONCE. Four slices and four labels read out
     as eight loose numbers; the cone is a picture and carries the sentence
     underneath it as its label. */
  cone.setAttribute("role", "img");
  cone.setAttribute("aria-label", d.tiers.map((t) => {
    const taken = Math.min(t.size, Math.max(0, d.members - t.from + 1));
    return T("layer." + t.key) + ": " + (taken >= t.size ? T("pin.tFull")
      : taken > 0 ? T("pin.tLeft", { n: num(t.size - taken) }) : T("pin.tShut"));
  }).join(". "));
  for (const n of keys.children) n.setAttribute("aria-hidden", "true");
  box.append(cone, keys);

  /* THE NUMBER THAT FALLS WHILE SOMEBODY READS IT. It is the whole argument
     for joining this afternoon rather than in March, so it is words and not
     only a bar — a picture nobody can quote is not a thing anybody repeats. */
  if (now) {
    const line = el("p", "lpnow");
    line.append(el("b", null, num(now.t.size - now.taken)));
    /* THE MID-SENTENCE NAME, not the label. See layer.il1 in i18n.js. */
    line.append(document.createTextNode(" " + T("pin.tNow",
      { tier: T("layer.i" + now.t.key) })));
    box.append(line);
    box.append(el("p", "lpnow2", now.t.pts && d.tier && d.tier.nextPts
      ? T("pin.tThen", { now: num(now.t.pts), next: num(d.tier.nextPts) })
      : T("pin.tEach", { n: num(now.t.pts) })));
  }
  wrap.append(box);
  return wrap;
}

/** WHAT THE READER'S SHARE COMES TO IF THE TARGET IS REACHED.
 *
 *  Off entirely unless the operator has typed both numbers — see pinMoneyOn.
 *  The two it stands on are named under the figure in the same breath, because
 *  a sum about somebody's own stake with no account of where it came from is
 *  the thing that reads as a promise rather than as arithmetic.
 */
function atGoal(d) {
  if (typeof d.moneyAt !== "number" || !d.goal) return null;
  const wrap = el("div", "lpat");
  const box = el("div", "lpatbox");
  box.append(el("span", "k", T("pin.atGoal", { goal: num(d.goal) })));
  box.append(el("b", "v", money(d.moneyAt)));
  box.append(el("span", "u", T("pin.atGoalHow",
    { sale: money(d.saleAt), share: pct(d.share) })));
  wrap.append(box);
  /* ONE LINE HERE, THE WHOLE OF IT UNDER THE CHEVRON. The full note is four
     sentences and it was the tallest thing on a panel whose job is to be read
     in a taxi. What has to be beside the figure, always, is that nobody has
     valued this — the rest is for whoever opens the panel. */
  wrap.append(el("p", "lpsmall", T("pin.moneyShort")));
  return wrap;
}

/* ---- everything under the chevron ---------------------------------------- */

function body(d, device) {
  const w = el("div", "lpbody");
  w.id = "lpin-body";

  /* WHERE THE POINTS CAME FROM, itemised. A total nobody can take apart is a
     number somebody has to trust; a total with its rows under it is one they
     can check, and checking it is what makes it theirs. */
  /* THE BOARD ACROSS THE TOP, IN THREE FIGURES AND A LINE.
     Members, the reader's share of the pool, and the places still open —
     one that rises, one that is theirs and fixed, one that falls. Three
     columns rather than three stacked cards because they are short numbers
     and a phone reads them side by side in one glance. */
  w.append(three(d));
  if (d.trend && d.trend.length > 1) w.append(spark(d));

  /* THEN THEIR OWN POINTS, each on its own card with a spine. What somebody
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

  /* THE FIVE-BOX SLIDING SCALE IS GONE. It sampled a curve at five places to
     answer "how much better would it have been to be early" — which the ladder
     at the top of the panel now answers outright, in the tiers' own names and
     without a tap. Two pictures of one fact is one of them saying it wrong,
     and this was the one behind two taps. */

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
    /* WHERE THE FIGURE CAME FROM, in the same breath as the figure. Two
       numbers the operator typed and the arithmetic between them, said
       plainly — a sum on a screen about somebody's own stake with no account
       of where it came from is the thing that reads as a promise. */
    if (typeof d.money === "number") {
      /* NOW AND AT THE GOAL, SIDE BY SIDE, which is the comparison anybody
         actually wants and the one the sliding scale was failing to make.
         Only the sale figure differs between the two — the share is divided
         by every place there will ever be, so it does not move — and the
         label on each says which figure it is standing on. */
      /* ONLY TODAY'S. The figure at the goal is the box above the chevron —
         see atGoal — and printing it again down here made the panel look like
         it was making the case twice. This is the other half of that
         comparison and the half that is small. */
      const pair = el("div", "lppair");
      pair.append(worth(T("pin.wNow"), money(d.money),
        T("pin.wAtSale", { sale: money(d.sale) })));
      w.append(pair);
      w.append(el("p", "lpsmall", T("pin.moneyNot")));
    }
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
  go.addEventListener("click", () => {
    RULES = !RULES;
    if (LAST && LAST.box) paint(LAST.box, SHOWN, LAST.device);
  });
  w.append(go);
  const rw = el("div", "lprulesbox");
  rw.hidden = !RULES;
  w.append(rw);
  if (RULES) paintRules(w, d, go, rw);

  if (!d.joined && d.place) w.append(joinRow(d, device));

  /* A WAY OUT AT THE BOTTOM, because the way in is at the top.
   *
   * The header is the toggle and tapping it again shuts the panel — which is
   * no use once it is open, because by then the header is a screen and a half
   * above and the reader is looking at the end of a long card with no control
   * on it. A thing that opens downward needs its close where the opening ends.
   *
   * It scrolls the panel back into view as it shuts, so the room does not jump
   * to wherever the foot of the card used to be. */
  const shut = el("button", "lpclose", T("pin.close"));
  shut.type = "button";
  shut.addEventListener("click", () => {
    OPEN = false;
    const box = LAST && LAST.box;
    if (box) {
      paint(box, SHOWN, LAST.device);
      box.scrollIntoView({ block: "nearest" });
      const head = box.querySelector(".lphead");
      if (head) { try { head.focus({ preventScroll: true }); } catch { /* older */ } }
    }
  });
  w.append(shut);
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

/** The three figures about the board, side by side. */
function three(d) {
  const row = el("div", "lp3");
  const one = (k, v, u) => {
    const c = el("div", "lp3c");
    c.append(el("span", "k", k));
    c.append(el("span", "v", v));
    if (u) c.append(el("span", "u", u));
    row.append(c);
  };
  one(T("pin.sMembers"), num(d.members), T("pin.sMembersU", { goal: num(d.goal) }));
  /* THE MIDDLE FIGURE BECOMES MONEY WHEN THE OPERATOR HAS SET BOTH NUMBERS,
     and the percentage moves underneath it — the same fact, priced. Unset,
     the percentage is the figure and no currency appears anywhere. */
  if (typeof d.money === "number") {
    one(T("pin.sWorth"), money(d.money), pct(d.share) + " " + T("pin.sShareU"));
  } else {
    one(T("pin.sShare"), typeof d.share === "number" ? pct(d.share) : "—", T("pin.sShareU"));
  }
  one(T("pin.sLeft"), num(d.left), T("pin.sLeftU"));
  return row;
}

/* THE GROWTH CURVE.
 *
 * One series, so no legend: the label over it names it. An area under a 2px
 * line, the last point marked and labelled — the only number on the chart,
 * because a value on every point is a table drawn badly.
 *
 * The scale runs from zero to the highest point the line reaches, and the two
 * labels name the first date and the last: every label on it is a value the
 * chart actually gets to. The viewBox is taller and wider than the plot so the
 * end dot and its label cannot be clipped by their own stroke.
 *
 * Text takes the panel's ink tokens rather than the line's colour — the line
 * carries the identity, the words do not need to repeat it.
 */
function spark(d) {
  const pts = d.trend;
  const W = 300, H = 76, PL = 4, PR = 34, PT = 10, PB = 18;
  const hi = Math.max(...pts.map((p) => p.n), 1);
  const x = (i) => PL + (i * (W - PL - PR)) / (pts.length - 1);
  const y = (n) => PT + (H - PT - PB) * (1 - n / hi);

  const box = el("div", "lpspark");
  const head = el("p", "lpk", T("pin.trend"));
  box.append(head);

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", T("pin.trendAlt",
    { n: num(pts[pts.length - 1].n), from: theDay(pts[0].t), to: theDay(pts[pts.length - 1].t) }));
  svg.setAttribute("preserveAspectRatio", "none");

  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.n).toFixed(1)}`).join("");
  const area = document.createElementNS(ns, "path");
  area.setAttribute("d", line + `L${x(pts.length - 1).toFixed(1)},${y(0)}L${x(0)},${y(0)}Z`);
  area.setAttribute("fill", "rgba(92,141,255,.16)");
  area.setAttribute("stroke", "none");
  svg.append(area);

  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", line);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#5C8DFF");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("vector-effect", "non-scaling-stroke");
  svg.append(path);

  const dot = document.createElementNS(ns, "circle");
  dot.setAttribute("cx", x(pts.length - 1));
  dot.setAttribute("cy", y(pts[pts.length - 1].n));
  dot.setAttribute("r", "3.5");
  dot.setAttribute("fill", "#5C8DFF");
  svg.append(dot);

  const cap = document.createElementNS(ns, "text");
  cap.setAttribute("x", x(pts.length - 1) + 7);
  cap.setAttribute("y", y(pts[pts.length - 1].n) + 4);
  cap.setAttribute("fill", "#D6DEEA");
  cap.setAttribute("font-size", "12");
  cap.setAttribute("font-weight", "700");
  cap.textContent = num(pts[pts.length - 1].n);
  svg.append(cap);
  box.append(svg);

  /* Month and year on the axis, not the full date. An axis label is a
     position, and "January 1, 2026" under a 76-pixel chart is a sentence. */
  const ends = el("div", "lpends");
  ends.append(el("span", null, theMonth(pts[0].t)));
  ends.append(el("span", null, theMonth(pts[pts.length - 1].t)));
  box.append(ends);
  return box;
}

/** One of the two worth cards: what it comes to, and at which sale figure. */
function worth(label, value, under, key) {
  const c = el("div", "lpworth" + (key ? " key" : ""));
  c.append(el("span", "k", label));
  c.append(el("span", "v", value));
  c.append(el("span", "u", under));
  return c;
}

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

/* Whole units. A figure this soft printed to the cent is a precision nobody
   has earned, and the trailing ".00" is the half that makes it look audited. */
const money = (v) => "$" + Number(v || 0).toLocaleString(
  lang() === "zh" ? "zh-CN" : "en", { maximumFractionDigits: 0 });

/** A month and a year, for an axis end. */
function theMonth(iso) {
  const d = new Date(String(iso) + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return String(iso);
  return lang() === "zh"
    ? d.getUTCFullYear() + "\u5e74" + (d.getUTCMonth() + 1) + "\u6708"
    : d.toLocaleDateString("en", { month: "short", year: "numeric", timeZone: "UTC" });
}

/* A day, said the way the language says days. Not a format string away from
   English — see `when` in i18n.js, which this follows. */
function theDay(iso) {
  const d = new Date(String(iso) + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return String(iso);
  return lang() === "zh"
    ? d.getUTCFullYear() + "年" + (d.getUTCMonth() + 1) + "月" + d.getUTCDate() + "日"
    : d.toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
