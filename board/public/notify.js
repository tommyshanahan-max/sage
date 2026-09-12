/* THE SWITCH THAT MAKES THE MESSENGER WORTH HAVING.
 *
 * Somebody writes, the other person is not looking at the tab, and nothing
 * tells them. Every conversation on this board has ended that way.
 *
 * ---------------------------------------------------------------------------
 * WHEN IT ASKS, AND WHY THAT IS THE WHOLE DESIGN
 *
 * NEVER ON LOAD. A browser remembers a refusal for ever and will not ask
 * again — so one prompt fired at somebody who has not yet seen a single
 * message costs the real prompt permanently, on that device, with no way back
 * except clearing site data. The prompt follows a tap on a switch that says
 * what it is for, and nothing else ever triggers it.
 *
 * ON iOS IT IS HIDDEN UNTIL THE APP IS ON THE HOME SCREEN. Safari supports web
 * push only for an installed app; asking in a browser tab there is a prompt
 * that cannot succeed, which is the expensive mistake above with extra steps.
 * install.js is already asking those people to install, and this appears once
 * they have — one ask at a time, in the order that works.
 *
 * AND NOT AT ALL WITHOUT KEYS ON THE BOX. /api/push/key answers with an empty
 * string when BOARD_VAPID_* is unset, and then there is no switch. A board
 * that cannot send must not ask.
 */
import { T } from "/i18n.js";

const IOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

function standalone() {
  try { if (window.matchMedia("(display-mode: standalone)").matches) return true; } catch (e) { /* old X5 */ }
  return navigator.standalone === true;
}

/** The VAPID public key, as the browser wants it: raw bytes, not base64url. */
function keyBytes(s) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const device = () => {
  try { return localStorage.getItem("board:device") || ""; } catch (e) { return ""; }
};

let KEY = null;   // null = not asked yet, "" = the board cannot send

/** Subscribe this browser and tell the board. Used by the silent path above
 *  and by the button below — one copy, because two would drift and the one
 *  that drifted would be the one nobody ever watches happen. */
async function subscribe(reg, key) {
  try {
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,                 // required, and true here anyway
      applicationServerKey: keyBytes(key),
    });
    const r = await fetch("/api/push/on", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-board-device": device() },
      body: JSON.stringify({ device: device(), sub: sub.toJSON() }),
    });
    return r.ok;
  } catch (e) { return false; }
}

/** Draw the switch in `slot`, if there is anything to offer this browser.
 *  `member` false draws nothing — somebody on the waiting list has no
 *  conversations to be told about. */
export async function offerNotify(slot, member) {
  if (!slot) return;
  const hide = () => { slot.hidden = true; while (slot.firstChild) slot.removeChild(slot.firstChild); };

  if (!member) return hide();
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return hide();
  /* DENIED IS FINAL AND SILENT. There is no way to ask again from here, and a
     row saying "turn this on in your browser settings" is a row nobody acts on
     and everybody has to look at. */
  if (Notification.permission === "denied") return hide();
  /* They pressed "not now" on the card. The browser's permission is untouched,
     so this is the only record of it — and it is deliberately this side of the
     prompt, where it can be changed its mind about. */
  try { if (localStorage.getItem("board:nobell") === "1") return hide(); } catch (e) { /* private mode */ }
  if (IOS && !standalone()) return hide();

  if (KEY === null) {
    try {
      const r = await fetch("/api/push/key");
      KEY = String((await r.json()).key || "");
    } catch (e) { KEY = ""; }
  }
  if (!KEY) return hide();

  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return hide();

  /* ALREADY SAID YES — SO DO NOT ASK AGAIN.
   *
   * A browser remembers the grant, not the subscription. Somebody who turned
   * this on, then cleared site data, reinstalled to the home screen, or opened
   * the app on a second tab that never had one, arrives with permission
   * GRANTED and no subscription — and the first version of this drew them a
   * button saying "Turn on" for a thing they had already turned on.
   *
   * Nothing is asked here and nothing can be: the prompt is what needs a
   * gesture, and there is no prompt when the answer is already yes. So it
   * subscribes quietly and the strip never appears. This is the closest thing
   * to "on by default" the web allows, and it is the whole of it. */
  if (Notification.permission === "granted") {
    if (!(await reg.pushManager.getSubscription())) await subscribe(reg, KEY);
    return hide();
  }
  // Already on, on this device. Nothing to say — a switch that is already
  // thrown is a row that only takes up space.
  if (await reg.pushManager.getSubscription()) return hide();

  slot.hidden = false;
  while (slot.firstChild) slot.removeChild(slot.firstChild);

  /* A CARD, NOT A LINE. This was a tinted one-liner in a list, which is the
     shape of a cookie banner and was read as one. It is the return loop of
     the whole product — somebody wrote to you and nothing tells you — so it
     is allowed to take up room, and it says what it does rather than naming
     the mechanism. */
  const ns = "http://www.w3.org/2000/svg";
  const ico = document.createElement("div");
  ico.className = "ico";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  for (const d of ["M18 8a6 6 0 1 0-12 0c0 7-2 8-2 8h16s-2-1-2-8",
                   "M13.7 21a2 2 0 0 1-3.4 0"]) {
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  }
  ico.appendChild(svg);
  slot.appendChild(ico);

  const words = document.createElement("div");
  words.className = "words";
  const head = document.createElement("b");
  head.textContent = T("push.head");
  const body = document.createElement("p");
  body.textContent = T("push.ask");
  words.append(head, body);

  const row = document.createElement("div");
  row.className = "row";
  const go = document.createElement("button");
  go.type = "button";
  go.className = "on";
  go.textContent = T("push.on");
  go.addEventListener("click", async () => {
    go.disabled = true;
    go.textContent = T("push.wait");
    try {
      /* THE PROMPT, and it must be inside this handler. Safari only allows it
         from a user gesture, and an await before it can end the gesture — so
         the key was fetched above, before the card was ever drawn. */
      const ok = await Notification.requestPermission();
      if (ok !== "granted") return hide();
      if (!await subscribe(reg, KEY)) throw new Error("refused");
      hide();
    } catch (e) {
      go.disabled = false;
      go.textContent = T("push.on");
    }
  });

  /* A WAY TO SAY NO THAT IS NOT THE BROWSER'S. Pressing "Turn on" and then
     refusing the browser's own prompt is a refusal that can never be undone
     from here — so there is a quieter door out, and taking it leaves the real
     permission untouched for a better moment. */
  const no = document.createElement("button");
  no.type = "button";
  no.className = "no";
  no.textContent = T("push.later");
  no.addEventListener("click", () => {
    try { localStorage.setItem("board:nobell", "1"); } catch (e) { /* private mode */ }
    hide();
  });
  row.append(go, no);
  words.appendChild(row);
  slot.appendChild(words);
}
