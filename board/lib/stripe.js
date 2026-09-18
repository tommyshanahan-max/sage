/* Stripe, by hand.
 *
 * ---------------------------------------------------------------------------
 * WHY NOT THE SDK. Everything this board asks Stripe for is four calls and a
 * form-encoded body. The official package brings a dependency tree onto a box
 * that has deliberately kept one, and its value is types and retries — neither
 * of which is worth a tree here. The webhook next door already verifies
 * signatures with node's own crypto for the same reason.
 *
 * THE BOARD NEVER HOLDS THE MONEY, and this file is where that is either true
 * or a lie. Every charge it creates is a DESTINATION CHARGE: the payer's money
 * goes to the payee's own Stripe account, and the board's 2% is taken as an
 * application fee by Stripe, on the way past. Stripe is the licensed party.
 * Nothing is ever paid to this platform and forwarded — that is money
 * transmission, and in China it is 二清 and illegal outright. See
 * docs/cross-border-payments.md.
 *
 * SO THE PAYEE HAS AN ACCOUNT OF THEIR OWN. Express: Stripe collects their
 * name, bank and identity on their own pages, holds the risk, and hands back
 * an id. This board never sees a bank number.
 *
 * OFF UNLESS BOARD_STRIPE_KEY IS SET. Unset, every function here returns null
 * and the card falls back to the payee's own payment link, which is what the
 * board did before any of this and still does wherever Connect cannot reach —
 * mainland payees above all, whom Stripe does not support.
 * ------------------------------------------------------------------------ */
const API = "https://api.stripe.com/v1";
const KEY = (process.env.BOARD_STRIPE_KEY || "").trim();

export const configured = () => Boolean(KEY);

/* Stripe takes application/x-www-form-urlencoded with bracket notation for
   anything nested — payment_intent_data[transfer_data][destination]. Written
   out rather than guessed at, because a key one bracket wrong is not an error,
   it is a field silently ignored and a charge that keeps the fee. */
/* Exported only so it can be tested. A bracket in the wrong place does not
   raise anything — Stripe ignores the field, the charge goes through, and the
   fee it was supposed to carry is simply not taken. That is not a bug anybody
   notices on the day. */
export function form(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => form({ [i]: x }, key, out));
    else if (typeof v === "object") form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function call(path, body, extra = {}) {
  if (!KEY) throw new Error("stripe is not configured");
  const res = await fetch(API + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + KEY,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...extra,
    },
    body: body ? form(body).toString() : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* Stripe sent prose */ }
  if (!res.ok) {
    /* Stripe's message names the field it disliked, and a thrower that keeps
       only the status has thrown away the answer. */
    throw new Error(`${path} -> ${res.status}: ${json?.error?.message || text.slice(0, 300)}`);
  }
  return json;
}

/** A connected account for somebody being paid. Express, so Stripe collects
 *  and holds their bank details and identity rather than this board. */
export async function makePayee({ country, email }) {
  return call("/accounts", {
    type: "express",
    country: country || undefined,
    email: email || undefined,
    capabilities: { transfers: { requested: true } },
    business_type: "individual",
  });
}

/** Where the payee goes to finish setting up, and where they come back to.
 *  The link is single-use and expires — it is minted per press, never stored. */
export async function onboardLink({ account, refresh, done }) {
  return call("/account_links", {
    account, refresh_url: refresh, return_url: done,
    type: "account_onboarding",
  });
}

/** Can this account actually be paid yet? Onboarding is not one screen and
 *  somebody who abandoned it halfway has an id and no ability to take money. */
export async function payeeReady(account) {
  const a = await call("/accounts/" + encodeURIComponent(account));
  return Boolean(a?.charges_enabled && a?.payouts_enabled);
}

/** THE CHARGE ITSELF.
 *
 *  `amount` is in the currency's smallest unit — 5000 CNY is 500000. `fee` is
 *  the board's cut in the same unit, taken by Stripe from the charge and never
 *  held by this board. `method` is one of the three the card offers.
 *
 *  WHY payment_method_types AND NOT AUTOMATIC. The card asked the payer which
 *  way they wanted to pay before they ever left, and a checkout that then
 *  offers all three again has thrown away the answer and the reason for
 *  asking. */
export async function checkout({ amount, currency, fee, destination, method, ref, done, label }) {
  const kinds = { wechat: "wechat_pay", alipay: "alipay", card: "card" };
  const kind = kinds[method] || "card";
  const body = {
    mode: "payment",
    /* EMBEDDED, SO THE PAYER NEVER LEAVES THE ROOM. The alternative — a hosted
       session — is a redirect to checkout.stripe.com, a domain nobody in
       mainland China has any reason to trust and every reason to be unable to
       reach. Embedded renders the same form inside a frame on this board, so
       the address bar still says the board. Stripe's domains still have to
       resolve for the frame to load; what changes is that a person paying does
       not watch their app hand them to a foreign company mid-deal.

       Why Stripe's own form and not our fields: WeChat Pay is not one flow. On
       a desktop it is a QR code, on a phone it is a handoff into the WeChat app
       and back, and Alipay is a third thing again. That is Stripe's code to get
       right on three platforms, not ours to reimplement untested. */
    ui_mode: "embedded",
    client_reference_id: ref,
    /* Embedded takes one return_url in place of success and cancel. Stripe
       fills in the session id; the room reads it only to know it should look
       again, never as proof — proof is the webhook, which cannot be forged by
       somebody editing a query string. */
    return_url: done,
    payment_method_types: [kind],
    line_items: [{
      quantity: 1,
      price_data: {
        currency,
        unit_amount: amount,
        product_data: { name: label || "Payment" },
      },
    }],
    payment_intent_data: {
      application_fee_amount: fee > 0 ? fee : undefined,
      transfer_data: { destination },
    },
  };
  /* WeChat Pay wants to know where the payer is standing — its flow differs
     between a phone browser and a desktop showing a QR code. "web" is the one
     that works in both: Stripe shows the QR on a desktop and hands off to the
     app on a phone. */
  if (kind === "wechat_pay") {
    body.payment_method_options = { wechat_pay: { client: "web" } };
  }
  return call("/checkout/sessions", body);
}
