/* PUTTING THE APP ON A PHONE, WITHOUT AN APP STORE.
 *
 * Every page here already carries a manifest, a maskable icon and the iOS
 * meta tags, so "Add to Home Screen" has worked for as long as the board has
 * existed: an icon on the home screen, no browser chrome, its own name under
 * it, and it updates when the box is deployed. Nobody was ever told.
 *
 * That is the whole of this file. It is not a nag — it appears for a member
 * who could install and hasn't, once, with an × that means never again.
 *
 * FOUR BROWSERS, THREE ANSWERS. The audience is on WeChat, and WeChat's
 * in-app browser cannot install anything at all, so a general "tap Add to
 * Home Screen" is wrong for most of the people who will read it:
 *
 *   WeChat        — no install of any kind. The only honest instruction is
 *                   how to leave: ⋯ top right, open in the browser. Said
 *                   without it, the person taps around the share sheet for a
 *                   while and concludes the app is broken.
 *   iOS Safari    — no API. The share sheet, by hand, and the share glyph is
 *                   drawn rather than named because it has no word in either
 *                   language and "the box with the arrow" is not one either.
 *   Chrome-ish    — beforeinstallprompt, which is a real button.
 *   anything else — nothing. A desktop browser and a member who has already
 *                   installed get no strip; there is nothing for them to do.
 *
 * WHY A MODULE AND NOT A BANNER IN A PAGE. Messages is the first tab and where
 * the manifest's start_url points, and Browse/Cards/Profile are a different
 * document. Both need this and the copy has to be identical in both, so it is
 * one file, the same way off.js is one file.
 */
import { T } from "/i18n.js";

const KEY = "board:noinstall";
const WX = /micromessenger/i.test(navigator.userAgent);
/* iPadOS 13+ reports itself as a Mac. The touch point count is the tell, and
   it is the only one that survives — the UA string does not say iPad. */
const IOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

/* ALREADY INSTALLED, TWO WAYS TO ASK, AND BOTH ARE NEEDED. The media query is
   the standard and is what Chrome answers; navigator.standalone is Safari's
   own, older, and still the only true answer on iOS. */
function installed() {
  try { if (window.matchMedia("(display-mode: standalone)").matches) return true; } catch (e) { /* old X5 */ }
  return navigator.standalone === true;
}

/* The event fires once, early, and cannot be asked for again — so it is caught
   at import and kept. Calling prompt() later is allowed; re-showing a strip
   after the event was thrown away is not. */
let waiting = null;
let redraw = () => {};
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  waiting = e;
  redraw();
});
window.addEventListener("appinstalled", () => {
  try { localStorage.setItem(KEY, "1"); } catch (e) { /* private mode */ }
  redraw();
});

/* The iOS share glyph: a box with an arrow leaving the top of it. Drawn,
   because it is what the person is looking for on their own screen and no
   sentence in either language points at it as well as the shape does. */
function shareGlyph() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "insico");
  svg.setAttribute("aria-hidden", "true");
  const box = document.createElementNS(ns, "path");
  box.setAttribute("d", "M7 10.5H5.5v10h13v-10H17");
  const arrow = document.createElementNS(ns, "path");
  arrow.setAttribute("d", "M12 14.5v-12m0 0L8.5 6M12 2.5 15.5 6");
  for (const p of [box, arrow]) {
    p.setAttribute("fill", "none");
    p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", "1.7");
    p.setAttribute("stroke-linecap", "round");
    p.setAttribute("stroke-linejoin", "round");
    svg.appendChild(p);
  }
  return svg;
}

/* One string, one placeholder, the glyph dropped where the sentence puts it.
   Not two half-sentences concatenated — Chinese does not put the icon in the
   same place English does, and a split string takes that choice away from
   whoever writes the Chinese. */
function withGlyph(key, into) {
  const parts = T(key).split("{icon}");
  into.appendChild(document.createTextNode(parts[0]));
  if (parts.length > 1) {
    into.appendChild(shareGlyph());
    into.appendChild(document.createTextNode(parts.slice(1).join("{icon}")));
  }
}

/** Offer the home screen, in `slot`, to somebody who is in and could take it.
 *  `member` false draws nothing: a stranger reading a shared profile is being
 *  asked to join, not to install, and two asks at once is neither. */
export function offerInstall(slot, member) {
  if (!slot) return;
  redraw = () => offerInstall(slot, member);

  let off = false;
  try { off = localStorage.getItem(KEY) === "1"; } catch (e) { /* private mode */ }
  const can = WX || IOS || waiting;
  if (!member || off || installed() || !can) { slot.hidden = true; slot.textContent = ""; return; }

  slot.hidden = false;
  while (slot.firstChild) slot.removeChild(slot.firstChild);

  const say = document.createElement("span");
  if (WX) say.textContent = T("ins.wx");
  else if (waiting) say.textContent = T("ins.can");
  else withGlyph("ins.ios", say);
  slot.appendChild(say);

  /* Only Chrome gets a button, because only Chrome has something for it to do.
     A button beside the iOS instructions would be a button that opens the
     share sheet — which it cannot; no API reaches it. */
  if (waiting) {
    const go = document.createElement("button");
    go.type = "button";
    go.className = "insgo";
    go.textContent = T("ins.go");
    go.addEventListener("click", async () => {
      const e = waiting;
      waiting = null;            // single use: the event cannot be replayed
      try { await e.prompt(); } catch (err) { /* dismissed, or already gone */ }
      offerInstall(slot, member);
    });
    slot.appendChild(go);
  }

  const no = document.createElement("button");
  no.type = "button";
  no.className = "insno";
  no.setAttribute("aria-label", T("ins.no"));
  no.textContent = "×";
  no.addEventListener("click", () => {
    try { localStorage.setItem(KEY, "1"); } catch (e) { /* private mode */ }
    slot.hidden = true;
  });
  slot.appendChild(no);
}
