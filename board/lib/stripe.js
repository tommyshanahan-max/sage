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
 * name, bank and identity on their own pages and hands back an id. This board
 * never sees a bank number.
 *
 * THIS LINE USED TO SAY STRIPE "HOLDS THE RISK". It does not, and that was a
 * misleading thing to have written next to the code that moves the money.
 * What Stripe holds is the identity work — collecting documents, verifying
 * who somebody is, deciding whether to onboard them at all. The FINANCIAL
 * risk on a destination charge sits with the platform: this board is the
 * merchant of record, so a refund or a chargeback is taken from the platform,
 * and if a connected account goes negative and cannot be recovered from,
 * Stripe takes that from the platform too. Accepting Connect means accepting
 * exactly that, in writing, and it is why those acknowledgements are read and
 * ticked by a person rather than by anything automated.
 *
 * WHICH IS SMALLER THAN IT SOUNDS FOR THIS CORRIDOR, and worth knowing rather
 * than worth fearing: WeChat Pay and Alipay are push payments authorised by
 * the payer in their own app, with no chargeback mechanism of the kind cards
 * have. The exposure is essentially the card path.
 *
 * OFF UNLESS BOARD_STRIPE_KEY IS SET, and `configured()` is how everything
 * else asks. The calls themselves THROW when there is no key — they do not
 * return null, whatever an earlier version of this note claimed — so a caller
 * that skipped configured() and hoped for a null got an exception instead.
 * Every route here checks first; the note was simply wrong.
 *
 * With it off the card falls back to the payee's own payment link, which is
 * what the board did before any of this and still does wherever Connect cannot
 * reach — mainland payees above all, whom Stripe does not onboard.
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

/* PIN THE API VERSION, OR STRIPE MOVES UNDER YOU.
 *
 * Without this header an account is served whatever version its dashboard is
 * set to, and that changes without anybody touching this repo. It is not
 * theoretical: ui_mode: "embedded" was accepted when it was written and
 * refused later, with no commit in between. A payment path that can break
 * while nobody is looking is worse than one that breaks loudly on deploy.
 *
 * SET BY ENV RATHER THAN BAKED IN, because the right value is whatever the
 * account is actually on, and this box has no way to ask Stripe. Unset, the
 * old behaviour stands — the account default — which is at least what it was
 * doing before. Put the version the dashboard shows into BOARD_STRIPE_VERSION
 * and the shape of every call is fixed until somebody changes that line. */
const VERSION = (process.env.BOARD_STRIPE_VERSION || "").trim();

/* A CEILING ON EVERY CALL. Without one, a request that stalls is a Pay press
   that never answers: in the sandbox run one request from node sat for more
   than two minutes while the same request by curl came back in three seconds,
   and Stripe had created the session all along. Twenty seconds is far past
   any honest answer and short enough that the room can say something. */
const PATIENCE = 20_000;

async function call(path, body, extra = {}, { json: asJson = false } = {}) {
  if (!KEY) throw new Error("stripe is not configured");
  /* A path that names its own API version ("/v2/...") is taken as written;
     everything else is v1, which is still where most of Stripe lives. */
  const url = path.startsWith("/v2/") ? "https://api.stripe.com" + path : API + path;
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + KEY,
      ...(VERSION ? { "Stripe-Version": VERSION } : {}),
      ...(body ? { "Content-Type": asJson ? "application/json" : "application/x-www-form-urlencoded" } : {}),
      ...extra,
    },
    body: body ? (asJson ? JSON.stringify(body) : form(body).toString()) : undefined,
    signal: AbortSignal.timeout(PATIENCE),
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
 *  and holds their bank details and identity rather than this board.
 *
 *  THROUGH ACCOUNTS V2, BECAUSE V1 IS SHUT. This was POST /v1/accounts, and on
 *  an account opened in 2026 Stripe refuses it under every API version tried
 *  (dahlia, clover, 2024-06-20): "Stripe no longer recommends Accounts v1 for
 *  new Connect integrations." It is an account setting, not a version, so the
 *  pin above does not bring it back. The v2 id is an ordinary acct_ id and
 *  every v1 call below — account links, GET /v1/accounts — still takes it.
 *
 *  v2 is JSON, not a form, and it refuses any request without a Stripe-Version
 *  ("You need to provide an API version header"), so BOARD_STRIPE_VERSION is
 *  required here rather than optional.
 *
 *  `recipient` is v2's name for the transfers capability — the only thing a
 *  destination charge needs from a payee. Fees and losses sit with the
 *  application because that is where a destination charge puts them anyway
 *  (see the risk note at the top); saying otherwise here would be the same
 *  wrong sentence in a new place.
 *
 *  AU when no country is given: an AU platform can transfer to AU accounts
 *  only (country_specs/AU, supported_transfer_countries), so any other
 *  country is an account that can never be paid from here. */
export async function makePayee({ country, email }) {
  if (!VERSION) throw new Error("BOARD_STRIPE_VERSION is not set; Accounts v2 requires it");
  return call("/v2/core/accounts", {
    contact_email: email || undefined,
    dashboard: "express",
    identity: { country: (country || "au").toLowerCase(), entity_type: "individual" },
    configuration: {
      recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
    },
    defaults: { responsibilities: { fees_collector: "application", losses_collector: "application" } },
  }, {}, { json: true });
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
  /* ASK V2 FIRST, BECAUSE THE ACCOUNT IS A V2 ACCOUNT.
   *
   * makePayee opens these through /v2/core/accounts and asks for
   * configuration.recipient.capabilities.stripe_balance.stripe_transfers.
   * That is the capability a destination charge actually needs, and it is
   * the one Stripe names when it refuses:
   *
   *   Your destination account needs to have at least one of the following
   *   capabilities enabled: transfers, crypto_transfers, or legacy_payments.
   *
   * The v1 read below does not see it. So this said a payee was ready on the
   * strength of payouts_enabled alone, Dealio drew a home screen with no
   * warning on it, and every payment to that person was refused before the
   * payer saw a card form — three methods, one cause, and nothing on any
   * screen naming it.
   *
   * REQUESTED IS NOT ACTIVE. The capability is requested the moment the
   * account is created and only becomes active once Stripe has accepted the
   * identity and the bank. Reading "requested" as "ready" is exactly the
   * mistake that made the board disagree with Stripe.
   *
   * Falls through to v1 rather than failing: an account opened before this,
   * or by some other route, still answers there. */
  if (VERSION) {
    try {
      const v2 = await call(
        "/v2/core/accounts/" + encodeURIComponent(account)
          + "?include=configuration.recipient",
        null, {}, { json: true });
      const st = v2?.configuration?.recipient?.capabilities
        ?.stripe_balance?.stripe_transfers?.status;
      if (st) return st === "active";
    } catch { /* not a v2 account, or v2 is unhappy — ask v1 below */ }
  }
  const a = await call("/accounts/" + encodeURIComponent(account));
  /* TRANSFERS AND PAYOUTS, NOT CHARGES.
   *
   * This asked for charges_enabled, which is whether the account can take a
   * payment from a customer of its own. A payee here never does that: the
   * charge is made on the platform and the money is transferred across. An
   * account requesting only the transfers capability — which is all makePayee
   * asks for — is never given charges_enabled, so this returned false for
   * every payee who had in fact finished, for ever, and the room went on
   * saying they had not set up. */
  const transfers = a?.capabilities?.transfers;
  return Boolean(a?.payouts_enabled
    && (transfers === "active" || a?.charges_enabled));
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
       right on three platforms, not ours to reimplement untested.

       "embedded_page", not "embedded": the old name is refused from dahlia
       on ("no longer supported. Use `embedded_page` instead"). The page has
       to mount it with createEmbeddedCheckoutPage — see payFrame. */
    ui_mode: "embedded_page",
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
    /* NO DESTINATION IS A PLAIN CHARGE INTO THIS ACCOUNT, and it has to be
       left out rather than sent empty. Every charge this file made until now
       was a destination charge — money passing through to somebody else's
       account — because every one of them was between two members. A shop
       selling its own goods is not that: the money is the seller's from the
       start and there is nobody to transfer it to. Sent as
       `transfer_data: {}` Stripe refuses the whole session, so the key is
       absent entirely. */
    ...(destination ? {
      payment_intent_data: {
        application_fee_amount: fee > 0 ? fee : undefined,
        transfer_data: { destination },
      },
    } : {}),
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

/* ---------------------------------------------------------------------------
 * CONNECTING AN ACCOUNT SOMEBODY ALREADY HAS, which is a different thing
 * from makePayee and was missing entirely.
 *
 * THE BUG THIS FIXES. Door one of /china says "I have a Stripe or Airwallex
 * account" and under it "One button. Money lands in your own account, same as
 * it does today." Pressed, it called makePayee — which OPENS A NEW ACCOUNT.
 * Somebody with a working Stripe account, WeChat Pay already switched on and
 * two years of history, would have been handed a second empty one to onboard
 * from scratch, with the screen telling him it was his own. Not a cosmetic
 * gap: the person it was written for is the one it would have misled.
 *
 * TWO MECHANISMS, AND THE SCREEN NOW ASKS WHICH.
 *   OAuth    they log in to THEIR Stripe and authorise us. Nothing is
 *            created; we are given the id of the account they already have.
 *   Express  we open one for them and Stripe collects the identity and the
 *            bank. Right only for somebody who has none.
 *
 * `scope=read_write` because a destination charge is created BY the platform
 * against the connected account; read_only can see an account and cannot be
 * charged on. `stripe_landing=login` because these people have an account —
 * showing them a sign-up form is asking them to make the second account this
 * whole change exists to prevent.
 *
 * THE TOKEN EXCHANGE GOES THROUGH call() like everything else. Stripe answers
 * it at api.stripe.com/v1/oauth/token as well as the older
 * connect.stripe.com/oauth/token; the first keeps one code path, one place
 * that knows how this file encodes a form, and one place that turns a refusal
 * into Stripe's own sentence.
 * ------------------------------------------------------------------------ */
const CLIENT_ID = (process.env.BOARD_STRIPE_CLIENT_ID || "").trim();

/** Whether the "connect the one I have" half can work at all. Its own check,
 *  because a board with a key but no client id can open accounts and cannot
 *  link them, and a screen that offers both should say which is off. */
export const canLink = () => Boolean(KEY && CLIENT_ID);

/** Where to send somebody to authorise us on the account they already have.
 *  `state` is minted and checked by the caller — it is the only thing
 *  standing between this and somebody being walked onto a stranger's
 *  account by a link in a message. */
export function linkUrl({ redirect, state, email }) {
  if (!CLIENT_ID) throw new Error("BOARD_STRIPE_CLIENT_ID is not set");
  const q = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope: "read_write",
    redirect_uri: redirect,
    state,
    stripe_landing: "login",
  });
  if (email) q.set("stripe_user[email]", email);
  return "https://connect.stripe.com/oauth/authorize?" + q.toString();
}

/** The code Stripe hands back, exchanged for the id of THEIR account.
 *  Returns acct_… — the same shape makePayee returns, so everything
 *  downstream (payeeReady, checkout's destination) is unchanged. */
export async function linkFinish(code) {
  const out = await call("/oauth/token", {
    grant_type: "authorization_code",
    code,
    /* The secret key doubles as the OAuth client secret. Sent in the body
       because that is what this endpoint reads; the Authorization header
       call() also sets is ignored here and harmless. */
    client_secret: KEY,
  });
  const id = String(out?.stripe_user_id || "");
  if (!id) throw new Error("/oauth/token gave no stripe_user_id");
  return id;
}
