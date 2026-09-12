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
  // Already on, on this device. Nothing to say — a switch that is already
  // thrown is a row that only takes up space.
  if (await reg.pushManager.getSubscription()) return hide();

  slot.hidden = false;
  while (slot.firstChild) slot.removeChild(slot.firstChild);

  const say = document.createElement("span");
  say.textContent = T("push.ask");
  slot.appendChild(say);

  const go = document.createElement("button");
  go.type = "button";
  go.className = "insgo";
  go.textContent = T("push.on");
  go.addEventListener("click", async () => {
    go.disabled = true;
    go.textContent = T("push.wait");
    try {
      /* THE PROMPT, and it must be inside this handler. Safari only allows it
         from a user gesture, and an await before it can end the gesture — so
         the key was fetched above, before the switch was ever drawn. */
      const ok = await Notification.requestPermission();
      if (ok !== "granted") return hide();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,               // required, and true here anyway
        applicationServerKey: keyBytes(KEY),
      });
      const r = await fetch("/api/push/on", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-board-device": device() },
        body: JSON.stringify({ device: device(), sub: sub.toJSON() }),
      });
      if (!r.ok) throw new Error("refused");
      hide();
    } catch (e) {
      /* Put the switch back rather than leaving a dead button. Whatever went
         wrong — a push service down, the board saying no — is worth one more
         tap later and is not worth a sentence explaining it. */
      go.disabled = false;
      go.textContent = T("push.on");
    }
  });
  slot.appendChild(go);
}
