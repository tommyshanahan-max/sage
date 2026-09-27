/* TAKING MONEY DURING A LIVE — Stripe, by hand, the way the board does it.
 *
 * The board's own Stripe file (board/lib/stripe.js) is where every lesson
 * below was learned, one evening at a time; this is the three calls a live
 * needs, carrying those lessons rather than rediscovering them:
 *
 *  - EMBEDDED, NOT A REDIRECT. The form draws inside the live page, over the
 *    video, so the payer never watches their phone hand them to a foreign
 *    domain mid-sale. `embedded_page`, the dahlia name; `embedded` is refused.
 *  - AUD, NOT YUAN. Tom's Stripe account is Australian, and Alipay on an
 *    Australian account presents in AUD — every CNY charge came back
 *    invalid_request_error from inside Stripe's own sheet on 24 Sep. Prices
 *    stay in yuan everywhere a person reads them; the conversion happens here,
 *    at the rate set by `make rate`, and nowhere else. No rate, no sale: a
 *    made-up rate would be making up what somebody is charged.
 *  - THE MONEY IS TOM'S FROM THE START. He is selling his own things and
 *    being given his own gifts, so there is no destination and no fee, exactly
 *    like the board's shop. If a live ever sells on somebody else's behalf,
 *    this is wrong and it is a licence question (二清) before a code one.
 *
 * NO WEBHOOK. Every session a payment can come from was created here, so
 * this service simply asks Stripe about each one it is still waiting on (see
 * `settle` in server.mjs). Nothing to register in Stripe's dashboard, and a
 * payer who pays and closes the phone is still counted.
 */
const API = (process.env.BOOK_STRIPE_API || "https://api.stripe.com/v1").replace(/\/$/, "");
const KEY = (process.env.BOOK_STRIPE_KEY || "").trim();
export const PK = (process.env.BOOK_STRIPE_PK || "").trim();
const VERSION = (process.env.BOOK_STRIPE_VERSION || "").trim();
const RATE = Number(process.env.BOOK_AUD_PER_CNY);

/** Whether a live can take money at all right now. */
export const on = () => Boolean(KEY && PK && RATE > 0);

/** Yuan (whole) → Australian cents, rounded up: a rate a week old is wrong
 *  by a little, and the little should not come out of Tom. */
export const audCents = (yuan) => Math.ceil(yuan * RATE * 100);

function form(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => form({ [i]: x }, key, out));
    else if (typeof v === "object") form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function call(path, body) {
  const res = await fetch(API + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + KEY,
      ...(VERSION ? { "Stripe-Version": VERSION } : {}),
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: body ? form(body).toString() : undefined,
    signal: AbortSignal.timeout(20e3),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* prose */ }
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${json?.error?.message || text.slice(0, 200)}`);
  return json;
}

/** A payment form for one sale. `yuan` is the price as the viewer saw it. */
export function checkout({ yuan, method, label, ref, back }) {
  return call("/checkout/sessions", {
    mode: "payment",
    ui_mode: "embedded_page",
    client_reference_id: ref,
    return_url: back,
    // The one they pressed, not all of them again: they already chose.
    payment_method_types: [method === "card" ? "card" : "alipay"],
    line_items: [{
      quantity: 1,
      price_data: { currency: "aud", unit_amount: audCents(yuan), product_data: { name: label } },
    }],
    // Half an hour, Stripe's shortest: a sale nobody finished stops being
    // asked about soon after.
    expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
  });
}

/** Paid, open or expired — Stripe's word for one session. */
export async function status(session) {
  const s = await call("/checkout/sessions/" + encodeURIComponent(session));
  if (s?.payment_status === "paid") return "paid";
  return s?.status === "expired" ? "expired" : "open";
}
