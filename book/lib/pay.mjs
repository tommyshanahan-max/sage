/* TAKING MONEY DURING A LIVE — Square, Australia.
 *
 * WHY SQUARE. What Tom asked for is "Apple Pay, double-click and it's over",
 * over the video, for viewers anywhere. That needs a processor that takes
 * Apple Pay from a web page: Stripe or Square. Tom has no Stripe account for
 * this, Wise only takes Apple Pay on its own page (a tab switch and a tick
 * by hand), and Square is built for exactly this — somebody selling at a
 * market. Registered in Australia, so it charges AUD; prices are dollars.
 *
 * HOW IT GOES. The page draws Square's own Apple Pay, Google Pay and card
 * buttons (Square's script, web.squarecdn.com). A double-click there gives
 * the page a one-time token, never a card number; the page sends the token
 * here, and this charges it with one call. Square answers COMPLETED or not
 * on the spot — so, unlike a redirect, there is nothing to wait for or poll,
 * and "Amy bought the scarf" can be said the moment it is true.
 *
 * THE MONEY IS TOM'S. He sells his own things and is given his own gifts, on
 * his own Square account. Selling for somebody else would be a different
 * thing — a licence question before a code question.
 *
 * THREE VALUES, ALL IN .env, via `make book-square`:
 *   BOOK_SQUARE_TOKEN     the access token — secret, server only
 *   BOOK_SQUARE_APP       the application id — public, the page needs it
 *   BOOK_SQUARE_LOCATION  where sales are recorded — public
 *
 * BOOK_SQUARE_FAKE=1 is for trying the page without an account: every
 * payment "succeeds" with no money moving. Refused outright when a real
 * token is set, so it cannot be left on by mistake on a box that takes money.
 */
import { randomUUID } from "node:crypto";

const TOKEN = (process.env.BOOK_SQUARE_TOKEN || "").trim();
const APP = (process.env.BOOK_SQUARE_APP || "").trim();
const LOCATION = (process.env.BOOK_SQUARE_LOCATION || "").trim();
const VERSION = (process.env.BOOK_SQUARE_VERSION || "").trim();
// A sandbox app id starts "sandbox-"; its calls and its script live elsewhere.
const SANDBOX = APP.startsWith("sandbox-");
const API = SANDBOX ? "https://connect.squareupsandbox.com/v2" : "https://connect.squareup.com/v2";
export const FAKE = process.env.BOOK_SQUARE_FAKE === "1" && !TOKEN;
export const CURRENCY = "AUD";

export const on = () => FAKE || Boolean(TOKEN && APP && LOCATION);

/** What the page needs to draw the buttons — none of it secret. */
export const client = () => on() ? {
  fake: FAKE, app: APP, location: LOCATION, currency: CURRENCY, country: "AU",
  script: SANDBOX ? "https://sandbox.web.squarecdn.com/v1/square.js" : "https://web.squarecdn.com/v1/square.js",
} : null;

/** Charge one token. `cents` is what the viewer saw; `note` is what Tom sees
 *  against it in Square. Resolves to Square's payment id, or throws with
 *  Square's own reason (a declined card says so). */
export async function charge({ token, cents, note }) {
  if (FAKE) {
    if (token !== "fake-ok") throw new Error("declined");
    return "fake-" + randomUUID().slice(0, 8);
  }
  const res = await fetch(API + "/payments", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + TOKEN, "Content-Type": "application/json",
      ...(VERSION ? { "Square-Version": VERSION } : {}),
    },
    body: JSON.stringify({
      source_id: token,
      // A retry of the same press must not charge twice; a new press is new.
      idempotency_key: randomUUID(),
      amount_money: { amount: cents, currency: CURRENCY },
      location_id: LOCATION,
      note: String(note || "").slice(0, 500),
      autocomplete: true,
    }),
    signal: AbortSignal.timeout(20e3),
  });
  const j = await res.json().catch(() => null);
  const p = j && j.payment;
  if (!res.ok || !p || p.status !== "COMPLETED") {
    throw new Error((j && j.errors && j.errors[0] && (j.errors[0].code + ": " + j.errors[0].detail)) || "square " + res.status);
  }
  return p.id;
}
