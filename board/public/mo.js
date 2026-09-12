/* MO, ON EVERY PAGE.
 *
 * He lived inside room.html, which is the waiting room — so the one person on
 * this board whose job is answering questions could only be asked them on the
 * one screen where nothing works yet. A member with a real question ("why is
 * it so quiet", "what does this word mean", "what do I write back") had
 * nobody at all.
 *
 * So he is a module. A page imports it, calls mountMo() with the two or three
 * things only that page knows, and gets the same circle in the same corner
 * with the same face — parked where he was left, because where he sits is one
 * key in localStorage and not a per-page setting.
 *
 * WHAT A PAGE TELLS HIM, and it is deliberately almost nothing:
 *
 *   first()    the turns he opens with — the waiting room greets somebody at
 *              a door and the board greets somebody already inside
 *   onKeep     what to do when he proposes a sentence and they keep it, or
 *              left out entirely on pages where there is nothing to propose,
 *              which also removes the Keep button rather than showing a dead
 *              one
 *   onChange   the page's own redraw, for the one case where his answer
 *              changes something outside his panel
 *
 * HE REPAINTS HIMSELF. The first version leaned on the host calling draw()
 * after every turn, which meant any page that wanted him had to rebuild
 * itself to show one new chat bubble — and on index.html that is ten thousand
 * lines of board thrown away to add a sentence. He owns his sheet and
 * repaints that alone.
 */

import { T, lang } from "/i18n.js";
import { device } from "/wait.js";
import { canHear, listen } from "/speak.js";

/* Its own, the way live.js and wait.js and daily.js each have their own. A
   module that has to be handed a DOM helper by four different pages is a
   module four pages can break. */
const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c;
  if (x != null) n.textContent = x; return n; };


/* HIS OWN STYLESHEET, INJECTED ONCE.
 *
 * It lived in room.html's <style>, which is the reason he could only appear
 * there — and index.html and notes.html do not load site.css at all, they
 * each have their own inline stylesheet, so putting it in the shared file
 * would have helped exactly one page. A module that needs a page to be
 * prepared for it is a module that only ends up on one page.
 *
 * MOVED, NOT REWRITTEN. The waiting room is the one place he has been looked
 * at properly, so this is the same CSS to the character; anything that wants
 * changing gets changed after it is proven to look the same in both places.
 *
 * The tokens it leans on — --accent, --ink, --card, --hair, --muted — are
 * defined by every page that has a board on it. Fallbacks where a page might
 * not have one, so he degrades to something readable rather than to
 * transparent-on-transparent.
 */
const MOCSS = `
/* The clock goes UNDER the buttons and stays small. It is the pressure, not
     the instruction — a deadline set in the same size as the thing to do
     makes somebody read the deadline twice and the instruction not at all. *//* ---- THE BUTLER ---------------------------------------------------------
   *
   * A conversation, not a form, and drawn as one: their words on the right,
   * his on the left, the box at the bottom. Everybody has used this screen
   * before, which is the point — the person who most needs it is the one least
   * likely to work out a novel one.
   */
  

  
  .but{margin:1rem 0 0;border:1px solid var(--hair);border-radius:.9rem;
    background:var(--card);overflow:hidden}
  .buthead{display:flex;align-items:center;gap:.6rem;padding:.7rem .9rem;
    border-bottom:1px solid var(--hair)}/* HIS FACE. It was the board's own 交 mark, which is also the app icon and
     also the welcome above — so he read as the software talking rather than
     somebody talking. A cap and shoulders is legible before anybody reads a
     word, and a peaked cap is one of the few uniforms that means the same
     thing in Guangzhou and in Sydney. */
  
  .butface{flex:0 0 auto;width:2.1rem;height:2.1rem;border-radius:50%;
    background:var(--accent-soft);color:var(--accent);display:grid;
    place-items:center;font-style:normal}
  .butface svg{width:1.45rem;height:1.45rem}
  .buthead small{color:var(--muted);font-size:.76rem}
  .buthead b{font-size:.92rem;font-weight:600;color:var(--ink)}
  .butshut{margin:1rem 0 0;text-align:center}
  .butgone{margin:0 0 .5rem;font-size:.82rem;color:var(--muted)}
  .butoff{display:block;margin:.5rem auto 0;border:0;background:none;
    color:var(--muted);font:inherit;font-size:.78rem;padding:.25rem;
    cursor:pointer;text-decoration:underline;text-underline-offset:2px}
  .butshut button{border:1px solid var(--line);background:var(--card);
    border-radius:99px;padding:.45rem 1.1rem;font:inherit;font-size:.85rem;
    color:var(--ink-2)}
  .buthead small{color:var(--muted);font-size:.76rem}/* A word, not a ×. A cross reads as closing a panel that will be back
     tomorrow, and this one will not come back until they ask for it. */
  
  .buthead .x{margin-left:auto;border:0;background:none;color:var(--muted);
    font:inherit;font-size:.78rem;padding:.2rem .1rem;cursor:pointer;
    text-decoration:underline;text-underline-offset:2px}
  .butsay{padding:.8rem .9rem;display:flex;flex-direction:column;gap:.55rem;
    max-height:20rem;overflow-y:auto}
  .bub{max-width:85%;padding:.55rem .8rem;border-radius:1rem;font-size:.9rem;
    line-height:1.5}
  .bub.him{align-self:flex-start;background:var(--raise);color:var(--ink);
    border-bottom-left-radius:.3rem}
  .bub.her{align-self:flex-end;background:var(--accent);color:var(--accent-ink);
    border-bottom-right-radius:.3rem}
  .bub.wait{color:var(--muted)}
  .butform{display:flex;gap:.5rem;align-items:center;padding:.7rem .9rem;
    border-top:1px solid var(--hair)}
  .butform input{flex:1;min-width:0;border:1px solid var(--line);
    background:var(--raise);border-radius:99px;padding:.55rem .9rem;font:inherit;
    font-size:.92rem;color:var(--ink);outline:none}
  .butform button{flex:0 0 auto;border:0;border-radius:99px;
    background:var(--accent);color:var(--accent-ink);font:inherit;font-size:.88rem;
    padding:.55rem 1rem}
  .butform .mic{width:2.3rem;height:2.3rem;border-radius:50%;padding:0;
    border:1px solid var(--line);background:var(--raise);color:var(--ink-2);
    display:grid;place-items:center}
  .butform .mic svg{width:1.05rem;height:1.05rem;fill:none;stroke:currentColor;
    stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
  .butform .mic[aria-pressed="true"]{background:var(--bad,#B3261E);color:#fff;
    border-color:transparent;animation:micon 1.4s ease-in-out infinite}/* WHAT HE IS PROPOSING, shown as the thing itself — the sentence as it will
     read on their card — and not as "me: agent, want: talent". They are
     agreeing to a sentence, so a sentence is what they are shown. */
  
  .butput{margin:0;padding:.8rem .9rem;border-top:1px solid var(--hair);
    background:var(--accent-soft)}
  .butput .line{font-family:var(--serif);font-size:1rem;color:var(--ink);
    line-height:1.4;margin:0 0 .3rem}
  .butput .why{margin:0 0 .7rem;font-size:.86rem;color:var(--ink-2);line-height:1.5}
  .butput .row2{display:flex;gap:.5rem}
  .butput .keep{border:0;border-radius:99px;background:var(--ink);color:var(--paper);
    font:inherit;font-size:.88rem;padding:.5rem 1.1rem}
  .butput .no{border:1px solid var(--line);border-radius:99px;background:none;
    color:var(--ink-2);font:inherit;font-size:.88rem;padding:.5rem 1rem}
  .butno{margin:.5rem .9rem .8rem;font-size:.82rem;color:var(--bad,#B3261E)}/* Before it is opened: one line and a button, so the panel is an offer
     rather than a conversation somebody has to close. */
  
  .butoffer{margin:1rem 0 0;padding:.8rem .9rem;border-radius:.9rem;
    border:1px solid var(--hair);background:var(--card);display:flex;
    align-items:center;gap:.7rem}
  .butoffer p{margin:0;flex:1;font-size:.86rem;line-height:1.45;color:var(--ink-2)}
  .butoffer p b{display:block;color:var(--ink);font-weight:600;font-size:.92rem}
  .butoffer button{flex:0 0 auto;border:0;border-radius:99px;background:var(--accent);
    color:var(--accent-ink);font:inherit;font-size:.88rem;padding:.5rem 1.1rem}/* ---- MO, FLOATING ------------------------------------------------------
     He was a panel in the page, between the two things that can be lost and
     the card. That is a doorman standing in the corridor: always there,
     always in the way, and scrolled past before he is needed. The waiting
     room is the screen this board asks the most of somebody, so everything
     on it that is not the two things is noise.
     So he stands in the corner of the screen instead and is dragged wherever
     they want him. Fixed, so he keeps up with the scroll; moveable, because
     a thing fixed over the one control somebody is reaching for is worse
     than no help at all — and on a 430pt screen there is always something
     under him. */

  
  .modock{position:fixed;z-index:6;width:3.1rem;height:3.1rem;border-radius:50%;
    border:0;background:var(--accent);color:var(--accent-ink);padding:0;
    display:flex;align-items:center;justify-content:center;cursor:grab;
    box-shadow:0 5px 18px rgba(10,14,24,.38);
    /* Pointer events do the dragging, so the browser must not also be
       scrolling the page under the finger. */
    touch-action:none;animation:dockin .35s .2s backwards}
  .modock svg{width:1.85rem;height:1.85rem;pointer-events:none}
  .modock.drag{cursor:grabbing;box-shadow:0 10px 26px rgba(10,14,24,.5);
    transform:scale(1.07)}
  /* HOLDING HIM. He grows and a ring goes round him, so a thumb that is
     already covering most of the circle can still see that it worked —
     the whole affordance has to live at the edges, because the middle of it
     is under a finger. */
  .modock.hear{transform:scale(1.12);
    box-shadow:0 0 0 .34rem rgba(47,107,255,.3), 0 10px 26px rgba(10,14,24,.5)}
  .modock.hear::after{content:"";position:absolute;inset:-.55rem;
    border-radius:50%;border:2px solid var(--accent);
    animation:moping 1.3s ease-out infinite}
  @keyframes moping{from{transform:scale(.86);opacity:.85}
    to{transform:scale(1.18);opacity:0}}
  @media (prefers-reduced-motion:reduce){ .modock.hear::after{animation:none} }/* "PRESS ME", ONCE, THE FIRST TIME HE APPEARS IN THE CORNER.
     The same move as the arrow at the photo chip: a small pointer and the
     reason beside it, because a blue circle that has just faded in at the
     edge of a screen is furniture until somebody says what it is. It says
     it once in a person's life — board:momet in localStorage — because the
     second time it is a thing nagging you about a button you already know.
     Fixed and aimed at his left, since he starts life on the right. */

  
  .mopoint{position:fixed;z-index:7;display:flex;align-items:center;gap:.25rem;
    pointer-events:none;animation:pointin .45s .25s backwards}
  .mopoint span{background:var(--accent);color:var(--accent-ink);
    border-radius:.6rem;padding:.34rem .66rem;font-size:.76rem;font-weight:600;
    line-height:1.25;white-space:nowrap;
    box-shadow:0 3px 12px rgba(10,14,24,.34)}
  .mopoint i{width:0;height:0;
    border-top:.42rem solid transparent;border-bottom:.42rem solid transparent;
    border-left:.46rem solid var(--accent);
    animation:pointnudge 1.7s .9s ease-in-out 3}/* Parked against the left edge: the label goes to his right and the arrow
     turns round, because an arrow pointing off the side of a screen points
     at nothing. */
  
  .mopoint.flip{flex-direction:row-reverse}
  .mopoint.flip i{border-left:0;border-right:.46rem solid var(--accent)}
  .mopoint.flip i{animation-name:pointnudgeL}
  .mopoint.go{opacity:0;transition:opacity .3s}
  @media (prefers-reduced-motion:reduce){
    .mopoint{animation:none}
    .mopoint i{animation:none}
  }/* There is no flying version of him any more — see the note by the
     IntersectionObserver in welcomeOrb. He is left behind by the scroll and
     the small one fades in once he is off the screen. *//* HE OPENS UPWARDS FROM THE BOTTOM, not out of wherever he was parked. A
     panel hung off a draggable button lands half off-screen the moment
     somebody has parked it in a corner, and a conversation is a thing you
     read from the bottom anyway. *//* The veil is gone — see moOpen. A panel that covers the screen in order to
     be asked about the screen is a panel you close, look, remember and
     reopen. The page behind him stays lit and stays scrollable. *//* CLEAR OF THE TAB BAR, which is fixed at the bottom and stays there under
     the veil. Flush to the bottom edge put the kill switch straight across
     "Waiting" and "You" — two sets of words in the same place, one of them
     dimmed, and the eye cannot tell which layer it is reading. ~3.4rem of
     tabs plus a gap. *//* AND NOT THE FULL WIDTH OF A DESKTOP. Left and right at 0 is right on a
     phone and absurd on a 1900px window — a conversation of six-word bubbles
     stretched across a metre of screen. The page's own column is ~34rem, so
     the sheet takes the same and sits under the middle of it. */
  

  
  
  
  
  .mosheet{position:fixed;z-index:7;left:50%;transform:translateX(-50%);
    bottom:0;width:100%;max-width:34rem;
    padding:0 .7rem calc(4.2rem + env(safe-area-inset-bottom));
    animation:sheetin .3s cubic-bezier(.2,.7,.3,1)}/* HIS OWN SHADOW NOW THAT THERE IS NO VEIL BEHIND HIM: without one he would
     sit flat on the page as though he were part of it. */
  
  .mosheet .but{margin:0;box-shadow:0 -6px 34px rgba(8,11,18,.34)}/* SHORTER, because the page behind him is the point. 46vh plus the form and
     the header took two thirds of a phone, which is a veil by another name. */
  
  .mosheet .butsay{max-height:30vh}/* White was for the dark veil, and the veil is gone — so it was white text
     on the lit page, which is the one control here that has to stay legible
     to somebody who came looking for it. Its own plate instead, so it reads
     against whatever the page happens to have under it. */
  
  .mosheet .butoff{margin:.6rem auto 0;color:var(--ink-2);
    background:var(--card);border-radius:99px;padding:.3rem .8rem;
    box-shadow:0 2px 10px rgba(8,11,18,.18)}
  @media (prefers-reduced-motion:reduce){
    .modock{animation:none}
    .mosheet{animation:none}
  }
`;

let dressed = false;
function dress() {
  if (dressed) return;
  dressed = true;
  const tag = document.createElement("style");
  tag.dataset.mo = "1";
  tag.textContent = MOCSS;
  document.head.append(tag);
}

/* The page's side of the arrangement — see the note above. One Mo per page. */
let HOST = null;

let BUT = null;          // { turns: [], put: {...}|null, busy: bool, no: "" }
let BUTMIC = null;

/** Redraw him, and only him.
 *
 *  This used to be the host page's draw(), which is why he could only live on
 *  the page that had one cheap enough to call on every keystroke. Everything
 *  he changes is inside his own sheet, so that is all this touches.
 */
function repaint() {
  moFloat(SHOWN);
}

/* WHETHER HE IS CURRENTLY ON THE SCREEN, which is not the same as whether the
   page asked for him when it mounted him. The waiting room mounts him with
   on:false for the length of the arrival and then reveals him by calling
   moFloat directly — so a repaint that re-read the mount-time flag put him
   away again the moment somebody sent him a message. */
let SHOWN = false;

/* HIS FACE, IN ONE PLACE. Drawn at 20px in the panel head and at 30 in the
   floating button, and the two must never drift apart — the button is how
   somebody recognises him before they have read his name.
   FILLED, NOT DRAWN. The first version was line art at 1.7 stroke inside a
   20px circle, which came out as an arch and a dot — a silhouette is the only
   thing that survives at this size. Brim, crown, shoulders, and the gap
   between them reads as the face without one being drawn. */
export const MOFACE = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">'
  + '<path d="M6.3 8.2c0-2.6 2.5-4.2 5.7-4.2s5.7 1.6 5.7 4.2z"/>'
  + '<rect x="3.6" y="8.4" width="16.8" height="1.9" rx=".95"/>'
  + '<path d="M4.3 20.4c0-3.8 3.5-5.9 7.7-5.9s7.7 2.1 7.7 5.9z"/></svg>';


function butlerPanel() {
  const box = el("div", "but");

  const head = el("div", "buthead");
  /* His face: a cap and shoulders, not the board's 交 mark — see .butface. */
  const face = el("i", "butface");
  face.innerHTML = MOFACE;
  head.append(face);
  const who = document.createElement("div");
  who.append(el("b", null, T("but.name")));
  if (T("but.sub")) who.append(el("small", null, " " + T("but.sub")));
  head.append(who);

  /* A WAY OUT, IN THE HEADER, and it had never been drawn. The CSS for it has
     been sitting in this file the whole time; the only way to shut him was to
     tap the dark behind the sheet, which is a thing you have to already know.
     A word rather than a ×: it closes a panel that comes straight back when
     you press him again, which is not what a cross means. */
  if (MOSHUT) {
    const x = el("button", "x", T("but.close"));
    x.type = "button";
    x.addEventListener("click", () => { if (MOSHUT) MOSHUT(); });
    head.append(x);
  }
  box.append(head);

  const said = el("div", "butsay");
  /* ONE SPEAKER, UNDER THE LAST THING HE SAID.
     It was under every line of his, which on the opening — two of his at once
     — put two identical grey buttons in a panel of four elements. The line
     worth hearing is the one that has just arrived; the ones above it have
     been read. Never under her own: reading somebody their own words back is
     not a feature. */
  /* AND THEN THE HEAR BUTTON WENT. Mo read his line in the browser's own
     voice, which on Chrome/macOS is Google's network voice and sounds like a
     lift announcing a floor. A character with a name and a face, given that
     voice, stops being a character. He is better read than heard until there
     is real TTS behind him. */
  BUT.turns.forEach((t) => {
    said.append(el("div", "bub " + (t.from === "you" ? "him" : "her"), t.text));
  });
  if (BUT.busy) said.append(el("div", "bub him wait", T("but.thinking")));
  box.append(said);
  // Newest at the bottom, which is where a conversation is read from.
  setTimeout(() => { try { said.scrollTop = said.scrollHeight; } catch { /* not yet */ } }, 0);

  /* WHAT HE IS PROPOSING — shown as the sentence it will be, because that is
     what they are agreeing to. "me: agent, want: talent" is a database row and
     nobody can check a database row against themselves. */
  if (BUT.put && HOST.onKeep) {
    const put = el("div", "butput");
    /* The same words the pills under this use — say.iam and role.a.*, which
       carry their own article so "a Director" and "an Agent" and "Crew" all
       read correctly. A second way of writing the sentence would eventually
       disagree with the first. */
    /* Joined with a space in English and with nothing in Chinese. Chinese
       does not put spaces between words, and "我是 经纪人 我在找 制片人" reads
       like a form with the labels left in. */
    put.append(el("p", "line", [T("say.iam"), T("role.a." + BUT.put.me),
      T("say.lookingFor"), T("role.a." + BUT.put.want)].join(lang() === "zh" ? "" : " ")));
    if (BUT.put.why) put.append(el("p", "why", BUT.put.why));
    const row2 = el("div", "row2");
    const keep = el("button", "keep", T("but.keep"));
    keep.type = "button";
    keep.addEventListener("click", async () => {
      keep.disabled = true;
      keep.textContent = T("me.working");
      const ok = await HOST.onKeep({ me: BUT.put.me, want: BUT.put.want,
        ...(BUT.put.why ? { why: BUT.put.why } : {}) });
      if (!ok) { keep.disabled = false; keep.textContent = T("but.keep"); return; }
      BUT.put = null;
      /* Done. The sheet closes itself rather than sitting over the card they
         just filled in — the whole point of the proposal was to get them off
         this conversation and onto the board. */
      if (MOSHUT) MOSHUT();
      if (HOST.onChange) await HOST.onChange();
    });
    const no = el("button", "no", T("but.redo"));
    no.type = "button";
    no.addEventListener("click", () => {
      /* Not a refusal to be argued with — it goes back to the conversation
         with the proposal withdrawn, and he is told why in their own turn. */
      BUT.put = null;
      repaint();
    });
    row2.append(keep, no);
    put.append(row2);
    box.append(put);
  }

  if (BUT.no) box.append(el("p", "butno", BUT.no));

  const form = el("form", "butform");
  const input = el("input");
  input.type = "text";
  input.maxLength = 600;
  input.placeholder = T("but.ph");
  input.autocomplete = "off";
  form.append(input);

  /* THE MIC. Speaking is the point for half these people: the person filling
     this in is on a phone, in their second language, one thumb at a time. Not
     drawn where the browser has no recogniser — see speak.js, and the note
     there about where it does and does not work. */
  if (canHear()) {
    const mic = el("button", "mic");
    mic.type = "button";
    mic.setAttribute("aria-pressed", "false");
    mic.setAttribute("aria-label", T("mic.go"));
    mic.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">'
      + '<path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z"/>'
      + '<path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
    mic.addEventListener("click", () => {
      if (BUTMIC) { BUTMIC.stop(); BUTMIC = null; return; }
      BUT.no = "";
      BUTMIC = listen(input, lang() === "zh" ? "zh-CN" : "en-US", {
        onState(on) {
          mic.setAttribute("aria-pressed", on ? "true" : "false");
          if (!on) BUTMIC = null;
        },
        onError(why) {
          BUT.no = T(why === "not-allowed" ? "mic.no" : "mic.off");
          repaint();
        },
      });
    });
    form.append(mic);
  }

  const go = el("button", null, T("but.send"));
  go.type = "submit";
  form.append(go);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (BUTMIC) { BUTMIC.stop(); BUTMIC = null; }
    const text = input.value.trim();
    if (!text || BUT.busy) return;
    BUT.turns.push({ from: "them", text });
    BUT.busy = true;
    BUT.no = "";
    input.value = "";
    repaint();
    await butlerTurn();
  });
  box.append(form);

  // Focus only once the panel is on the page, and never on the first draw —
  // a keyboard that opens the moment somebody taps "talk to him" covers the
  // line he just said.
  if (BUT.turns.length > 2) setTimeout(() => { try { input.focus(); } catch { /* gone */ } }, 0);

  /* THE KILL SWITCH, SAID LITERALLY, and under the panel rather than as a
     cross in its corner. A × reads as closing something that will be back
     tomorrow, and this one does not come back until they ask for it.
     Naming the thing people object to is what makes the offer believable:
     "Not for me" is a preference, "Don't like AI? Send him away" is an
     answer. A board whose whole pitch is that a person decides cannot also
     be the board that insists a machine talks to you first. */
  const off = el("button", "butoff", T("but.no"));
  off.type = "button";
  off.addEventListener("click", () => {
    if (BUTMIC) BUTMIC.stop();
    try { localStorage.setItem(BUTKEY, "1"); } catch { /* private window */ }
    /* Three halves, now that he is a module. The sheet goes, moFloat keeps
       the button off on every redraw from here because moOff() is true — and
       the PAGE is asked to redraw itself, because the way back to him lives
       in the page and not in anything he owns. Without that last one he
       vanishes with no way to recall him until the next reload. */
    if (MOSHUT) MOSHUT();
    repaint();
    if (HOST && HOST.onChange) HOST.onChange();
  });

  const out = document.createDocumentFragment();
  out.append(box, off);
  return out;
}

/** One round trip. */
async function butlerTurn() {
  try {
    /* A DEFINED WAIT, because the undefined one is what broke him. The first
       turn of a conversation came back and every one after it did not — each
       turn carries the whole conversation back up, so they get slower, and
       somewhere past the browser's own patience the request died with no
       error anywhere and a server that had answered nobody. 25 seconds,
       just past the server's own 20, so his timeout wins and can be logged
       rather than this one silently beating it. */
    const r = await fetch("/api/butler", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-board-device": device() },
      body: JSON.stringify({ turns: BUT.turns }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(25_000) : undefined,
    });
    const d = await r.json().catch(() => ({}));
    BUT.busy = false;
    if (!r.ok || d.error) {
      BUT.no = T(d.error === "slow-down" || d.error === "busy" ? "but.slow" : "but.off");
      repaint();
      return;
    }
    BUT.turns.push({ from: "you", text: d.say });
    /* A proposal is shown only when all of it survived the checks on the way
       back — see clean() in butler.js. Half a sentence is not something to put
       a Keep button under. */
    BUT.put = d.ready ? { me: d.me, want: d.want, why: d.why } : null;
  } catch {
    BUT.busy = false;
    BUT.no = T("but.off");
  }
  repaint();
}

/* ---- MO, FLOATING -------------------------------------------------------
 *
 * The button lives on document.body rather than in the page box, because the
 * page box is emptied and rebuilt on every redraw — a dock inside it would be
 * destroyed and rebuilt mid-drag, and would lose where somebody had just put
 * it. So: drawn once, kept, and told to show or hide itself. moFloat() below
 * is the single thing anything outside this file calls.
 */
const SPOTKEY = "board:mospot";
let MODOCK = null;      // the button, once made
let MOSHUT = null;      // closes the open sheet, or null when none is open

/* WHERE HE IS PARKED, AS FRACTIONS OF THE FREE SPACE rather than pixels. A
   phone turned on its side, or a desktop window dragged narrower, would
   otherwise leave him off the edge of the screen with no way to reach him.
   Default: bottom right, clear of the two tabs. */
function moSpot() {
  try {
    const v = JSON.parse(localStorage.getItem(SPOTKEY) || "");
    if (typeof v.x === "number" && typeof v.y === "number") return v;
  } catch { /* nothing saved, or a private window */ }
  return { x: 1, y: 0.84 };
}

function moPark(btn, fx, fy) {
  const pad = 10;
  const w = btn.offsetWidth || 50;
  const h = btn.offsetHeight || 50;
  /* The tab bar is fixed at the bottom and is about 3.4rem tall. He may be
     parked over it — somebody who drags him there has decided that — but he
     does not START there. That is what the 0.84 default is for. */
  const maxX = Math.max(0, window.innerWidth - w - pad * 2);
  const maxY = Math.max(0, window.innerHeight - h - pad * 2);
  const x = Math.min(1, Math.max(0, fx));
  const y = Math.min(1, Math.max(0, fy));
  btn.style.left = (pad + x * maxX) + "px";
  btn.style.top = (pad + y * maxY) + "px";
  return { x, y };
}

export function moDock() {
  if (MODOCK) return MODOCK;
  const btn = el("button", "modock");
  btn.type = "button";
  btn.innerHTML = MOFACE;
  document.body.append(btn);
  MODOCK = btn;

  let spot = moSpot();
  const replace = () => { spot = moPark(btn, spot.x, spot.y); };
  replace();
  window.addEventListener("resize", replace);

  /* DRAG, AND A TAP IS A DRAG THAT WENT NOWHERE. Pointer events so one path
     covers mouse, touch and pen; setPointerCapture so a finger that slides
     off the button keeps dragging it rather than dropping it where the
     gesture happened to leave the circle. */
  let down = null;
  const MOVED = 6;        // px before a tap becomes a drag
  /* HOLD HIM AND TALK. THREE GESTURES ON ONE CIRCLE, AND THEY HAVE TO BE
   * TELLABLE APART WITHOUT ANYBODY BEING TAUGHT THEM.
   *
   *   tap            open him and type
   *   drag           move him out of the way
   *   press and hold speak, and it sends when you let go
   *
   * The distinction is the same one a person already makes with every other
   * button on a phone, so nothing has to be explained: a tap is short, a drag
   * moves, and a hold is a hold. 400ms before the microphone opens, which is
   * long enough that nobody triggers it by pressing firmly and short enough
   * that it feels like the button responded rather than lagged.
   *
   * WHY IT SENDS ON RELEASE. Holding to talk and letting go to send is the
   * one voice gesture everybody in China already has in their thumbs, because
   * it is how WeChat works. Copying it means the most important control on
   * this screen needs no instruction at all in the market this board is for.
   */
  const HOLD = 400;
  let hold = 0;
  let talking = false;

  const stopTalk = (send) => {
    if (!talking) return;
    talking = false;
    btn.classList.remove("hear");
    if (BUTMIC) { BUTMIC.stop(); BUTMIC = null; }
    if (!send) return;
    /* The words land in the sheet's own box — see moOpen, which is already
       open by now — so releasing sends exactly what is on the screen, and a
       recogniser that heard nothing sends nothing. */
    const form = document.querySelector(".mosheet .butform");
    const box = form && form.querySelector("input[type=text]");
    if (form && box && box.value.trim()) {
      form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    }
  };

  const startTalk = () => {
    if (!canHear()) return;
    /* He opens first: the words have to go somewhere visible, and somebody
       holding a button wants to see that it is listening. */
    moOpen();
    const box = document.querySelector(".mosheet .butform input[type=text]");
    if (!box) return;
    talking = true;
    btn.classList.add("hear");
    BUTMIC = listen(box, lang() === "zh" ? "zh-CN" : "en-US", {
      onState(on) { if (!on) { BUTMIC = null; } },
      /* No microphone, no permission, no network to the recogniser: he stops
         listening and the box is still a box. See speak.js on where this
         genuinely does not work. */
      onError() { stopTalk(false); },
    });
  };

  btn.addEventListener("pointerdown", (e) => {
    down = { x: e.clientX, y: e.clientY, l: btn.offsetLeft, t: btn.offsetTop, moved: false };
    try { btn.setPointerCapture(e.pointerId); } catch { /* older browser */ }
    clearTimeout(hold);
    hold = setTimeout(startTalk, HOLD);
  });
  btn.addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    if (!down.moved) {
      if (Math.abs(dx) + Math.abs(dy) < MOVED) return;
      down.moved = true;
      btn.classList.add("drag");
      /* Moving him is not talking to him. Whichever of the two the hand meant,
         it did not mean both. */
      clearTimeout(hold);
      stopTalk(false);
    }
    const pad = 10;
    const maxX = Math.max(1, window.innerWidth - btn.offsetWidth - pad * 2);
    const maxY = Math.max(1, window.innerHeight - btn.offsetHeight - pad * 2);
    spot = moPark(btn, (down.l + dx - pad) / maxX, (down.t + dy - pad) / maxY);
  });
  const up = () => {
    const was = down;
    down = null;
    clearTimeout(hold);
    btn.classList.remove("drag");
    /* Let go of a hold and it sends. This is checked before the tap, because
       a hold IS a press that was never moved and would otherwise fall through
       to "open him" — which it has already done, on the way in. */
    if (talking) { stopTalk(true); return; }
    if (!was) return;
    if (was.moved) {
      try { localStorage.setItem(SPOTKEY, JSON.stringify(spot)); } catch { /* private window */ }
      return;
    }
    moOpen();
  };
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointercancel", () => {
    down = null;
    clearTimeout(hold);
    /* Cancelled is not released: a call arriving mid-sentence must not send
       half of one. */
    stopTalk(false);
    btn.classList.remove("drag");
  });
  return btn;
}

/* THE SHEET. Its contents are butlerPanel(), the same one that used to sit in
   the page, and it is re-rendered through moFloat below — his reply arrives
   by a repaint, so a sheet a repaint cannot reach would show his question for
   ever and never his answer. */
export function moOpen() {
  if (MOSHUT) return;
  if (!ready()) return;

  /* NO VEIL, AND THE PAGE BEHIND HIM STILL WORKS.
   *
   * He opened as a modal over a dimmed page, which is exactly wrong for what
   * he is for: the questions somebody asks a doorman are about the thing in
   * front of them — this box, that button, what this word means — and a panel
   * that covers the screen to be asked about the screen is a panel you have to
   * close, look, remember, and reopen.
   *
   * So he sits at the bottom and nothing behind him is blocked. Scroll the
   * page with him open, find the thing, ask about it while looking at it.
   * The cost is that tapping away no longer closes him, which is why the
   * header now has a word that does. */
  const sheet = el("div", "mosheet");
  document.body.append(sheet);
  /* MOSHUT before the panel is built: the close button in its header is only
     drawn when there is a sheet to close. */
  MOSHUT = () => {
    sheet.remove();
    document.removeEventListener("keydown", esc);
    MOSHUT = null;
    if (MODOCK && !moOff()) MODOCK.hidden = false;
    if (BUTMIC) { BUTMIC.stop(); BUTMIC = null; }
  };
  const esc = (e) => { if (e.key === "Escape" && MOSHUT) MOSHUT(); };
  document.addEventListener("keydown", esc);
  sheet.append(butlerPanel());
  if (MODOCK) MODOCK.hidden = true;
}

/* THE ONE THING THE OUTSIDE CALLS. Three jobs: put him on the screen when he
   is wanted,
   take him off when he is not, and keep an open sheet in step with the state
   the redraw was called for. */
export function moFloat(wanted) {
  SHOWN = Boolean(wanted);
  if (wanted) ready();
  if (!wanted || moOff()) {
    if (MOSHUT) MOSHUT();
    if (MODOCK) MODOCK.hidden = true;
    return;
  }
  const btn = moDock();
  btn.setAttribute("aria-label", T("but.open"));
  btn.hidden = Boolean(MOSHUT);
  if (MOSHUT) {
    const sheet = document.querySelector(".mosheet");
    if (sheet) { sheet.textContent = ""; sheet.append(butlerPanel()); }
  }
}

/* SAID ONCE IN A PERSON'S LIFE. The second showing of "press me" is a page
   nagging somebody about a button they already know. */
const METKEY = "board:momet";

/** The arrow at the corner, the first time he ever appears there.
 *
 *  A blue circle fading in at the edge of a screen is furniture until
 *  somebody says what it is — the same problem the photo chip had, and the
 *  same answer: point at it and give the reason in four words. Positioned
 *  against his actual rect rather than the corner, because he is draggable
 *  and the arrow has to find him wherever he was left.
 */
export function pointAtMo() {
  if (!MODOCK || MODOCK.hidden) return;
  try { if (localStorage.getItem(METKEY) === "1") return; } catch { /* private window */ }
  if (document.querySelector(".mopoint")) return;

  const p = el("div", "mopoint");
  p.append(el("span", null, T("but.press")), el("i"));
  document.body.append(p);

  const place = () => {
    const r = MODOCK.getBoundingClientRect();
    p.style.top = Math.round(r.top + r.height / 2 - p.offsetHeight / 2) + "px";
    /* To his left, and flipped to his right if he has been parked against the
       left edge — an arrow pointing off the side of the screen points at
       nothing. */
    const w = p.offsetWidth;
    /* 14, not 8: at eight the arrowhead sits under the circle's own shadow
       and the pill's corner disappears behind him. */
    if (r.left - w - 14 >= 6) {
      p.style.left = Math.round(r.left - w - 14) + "px";
      p.classList.remove("flip");
    } else {
      p.style.left = Math.round(r.right + 14) + "px";
      p.classList.add("flip");
    }
  };
  place();
  window.addEventListener("resize", place);

  const gone = () => {
    try { localStorage.setItem(METKEY, "1"); } catch { /* private window */ }
    window.removeEventListener("resize", place);
    p.classList.add("go");
    setTimeout(() => p.remove(), 320);
  };
  /* Pressing him is the point, so pressing him takes it away. Otherwise it
     goes on its own — it has been read by then, or it never will be. */
  MODOCK.addEventListener("pointerdown", gone, { once: true });
  setTimeout(gone, 7000);
}

const BUTKEY = "board:nomo";
export const moOff = () => { try { return localStorage.getItem(BUTKEY) === "1"; } catch { return false; } };

export function butlerShut() {
  const box = el("div", "butshut");
  if (moOff()) box.append(el("p", "butgone", T("but.gone")));
  const go = el("button", null, T(moOff() ? "but.back" : "but.shut"));
  go.type = "button";
  go.addEventListener("click", () => {
    try { localStorage.removeItem(BUTKEY); } catch { /* private window */ }
    /* The repaint puts the button back through moFloat; the page redraws to
       take the way-back row away, since he is no longer away; and the sheet
       opens because that is what they just asked for by pressing this. */
    SHOWN = true;
    repaint();
    if (HOST && HOST.onChange) HOST.onChange();
    moOpen();
  });
  box.append(go);
  return box;
}

/* No `open` any more. Whether he is on the screen is moOff(), and whether the
   sheet is up is MOSHUT — two facts in two places instead of a third copy on
   this object that had to be kept in step with both. */
const butlerStart = () => ({ turns: HOST.first(), put: null, busy: false, no: "" });


/** Is his panel open right now?
 *
 *  A page sometimes needs to know — the waiting room does not yank the page
 *  behind him back to the top on a redraw while he is up, because the card
 *  somebody was reading would be gone when they close him.
 */
export const moIsOpen = () => Boolean(MOSHUT);

/** Put him on this page.
 *
 *  Idempotent: a page that calls it twice gets one Mo, because the second
 *  call only updates who is asking. Called with `on: false` he leaves — which
 *  is how a page that is still loading avoids drawing a doorman who does not
 *  yet know who he is talking to.
 */
export function mountMo(host) {
  dress();
  HOST = host;
  /* His conversation is made as soon as a page claims him, not when he is
     first shown. The waiting room mounts him with on:false for the length of
     the arrival — he is hidden while the big circle is talking — and then
     reveals him by calling moFloat directly, which would have opened an empty
     panel on a conversation that was never started. */
  ready();
  moFloat(host.on !== false);
}

/* One conversation, made once, the moment there is a host to ask for its
   opening lines. Called from everywhere that can put him in front of
   somebody, because every one of those is a place it must already exist. */
function ready() {
  if (!BUT && HOST && typeof HOST.first === "function") BUT = butlerStart();
  return Boolean(BUT);
}

/** The way back, for somebody who sent him away and has no circle to press.
 *  A page that has nowhere sensible to put this simply does not call it. */
export function moGoneRow() {
  ready();
  return butlerShut();
}
