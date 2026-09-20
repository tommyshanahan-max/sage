// Airwallex, behind the same eight calls as the stand-in.
//
// WRITTEN FROM THE DOCS (version 2026-08-21, read 2026-09-15) before any
// account or key existed, and since then partly exercised. Against the
// sandbox, 2026-09-20: login works, FX quotes work in both directions —
// and cost 0.88%, not the 0.50% support quoted — and the WeChat Pay call
// below returns a real code, once "webqr" was corrected to "qrcode". The
// payouts, the beneficiaries and the card path are still only a reading of
// the docs, and say so where they are.
//
// `node lib/wallet/providers/airwallex.check.mjs` is the script that asks,
// and airwallex.wechat.mjs prints the whole of what comes back rather than
// the field this file expects — which is how the flow name was found.
//
// THREE THINGS THE DOCS SAY THAT CHANGE THE PLAN, and this file refuses rather
// than pretending:
//
// 1. Airwallex's hosted and embedded identity checks are for BUSINESS accounts
//    only. An individual's identity has to be submitted through the Accounts
//    API field by field, or checked by a separate identity provider first.
//    startOnboarding throws until that choice is made.
//
// 2. Local payouts in yuan are documented only for e-commerce goods trade,
//    backed by declarant and order information. Paying a person in mainland
//    China for a service is not a listed use. createBeneficiary and payout
//    refuse CNY until Airwallex confirms in writing what the Exchange may do.
//
// 3. Card details are typed into Airwallex's own browser components, never
//    sent to this server. Connecting a card is a client-side hand-off
//    (Airwallex.js), not a server call; startSourceConnect says so.

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { EventEmitter } from "node:events";
import { toMajor, toMinor } from "../money.js";

class NotYet extends Error {
  constructor(message) { super(message); this.code = "provider_not_ready"; this.status = 501; }
}

/* WHERE THE CALLS GO, OVERRIDABLE. The sandbox host was written from docs that
   could not be reached from here, and two names are in circulation for it —
   api.sandbox.airwallex.com and api-demo.airwallex.com. Both resolve, to the
   same address, and both answer. A wrong guess should be a line in .env
   (BOARD_WALLET_AIRWALLEX_BASE), not a code change and a redeploy. */
export function airwallexBase({ base = "", sandbox = true } = {}) {
  const b = String(base || "").trim().replace(/\/+$/, "");
  if (b) return b;
  return sandbox ? "https://api.sandbox.airwallex.com" : "https://api.airwallex.com";
}

export function createAirwallexProvider({ clientId, apiKey, webhookSecret, sandbox = true, publicOrigin = "", base: baseOverride = "" }) {
  const base = airwallexBase({ base: baseOverride, sandbox });
  const events = new EventEmitter();
  let token = null, tokenExp = 0;

  async function auth() {
    if (token && Date.now() < tokenExp - 60_000) return token;
    if (!clientId || !apiKey) throw new NotYet("Airwallex keys are not set (BOARD_WALLET_AIRWALLEX_CLIENT_ID / _API_KEY).");
    const res = await fetch(`${base}/api/v1/authentication/login`, { method: "POST", headers: { "x-client-id": clientId, "x-api-key": apiKey } });
    if (!res.ok) throw new Error(`airwallex login ${res.status}`);
    const d = await res.json();
    token = d.token;
    tokenExp = Date.parse(d.expires_at) || Date.now() + 25 * 60_000; // tokens last 30 minutes
    return token;
  }

  async function call(method, path, body, { onBehalfOf } = {}) {
    const headers = { Authorization: `Bearer ${await auth()}`, "Content-Type": "application/json" };
    if (onBehalfOf) headers["x-on-behalf-of"] = onBehalfOf;
    const res = await fetch(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let d; try { d = text ? JSON.parse(text) : {}; } catch { d = { raw: text }; }
    if (!res.ok) {
      const err = new Error(`airwallex ${method} ${path} ${res.status}: ${d.code || ""} ${d.message || ""}`.trim());
      err.status = res.status; err.body = d;
      throw err;
    }
    return d;
  }

  const VALIDITY = [[60, "MIN_1"], [900, "MIN_15"], [1800, "MIN_30"], [3600, "HR_1"], [14400, "HR_4"], [28800, "HR_8"], [86400, "HR_24"]];
  const validityFor = (seconds) => (VALIDITY.find(([s]) => s >= seconds) || VALIDITY[VALIDITY.length - 1])[1];

  return {
    name: "airwallex",
    isTest: false,

    async createAccount({ region }) {
      // Individual accounts need first and last name, date of birth and a
      // residential address before they can be created (Accounts API). The
      // wallet does not collect those yet — see note 1 above.
      throw new NotYet(`Creating an individual Airwallex account for ${region} needs identity fields the wallet doesn't collect yet.`);
    },

    async startOnboarding() {
      throw new NotYet("Airwallex's hosted identity check is for business accounts only. Choose how individuals are verified first.");
    },

    async startSourceConnect() {
      throw new NotYet("Cards are connected in the browser with Airwallex.js, so card details never reach this server. That component isn't wired in yet.");
    },

    session() { return null; },
    async completeSession() { return null; },

    /* POST /api/v1/fx/quotes/create — the rate is guaranteed, amounts indicative. */
    async quote({ sell, buy, sellAmount, buyAmount, validSeconds = 600 }) {
      if (sell === buy) {
        const amt = sellAmount ?? buyAmount;
        return { quoteId: `same_${randomUUID()}`, sell, buy, sellAmount: amt, buyAmount: amt, rate: 1, mid: 1, marginBps: 0, expiresAt: new Date(Date.now() + validSeconds * 1000).toISOString() };
      }
      const d = await call("POST", "/api/v1/fx/quotes/create", {
        sell_currency: sell, buy_currency: buy, validity: validityFor(validSeconds),
        ...(sellAmount != null ? { sell_amount: Number(toMajor(sellAmount, sell)) } : { buy_amount: Number(toMajor(buyAmount, buy)) }),
      });
      return {
        quoteId: d.quote_id, sell, buy,
        sellAmount: toMinor(String(d.sell_amount), sell), buyAmount: toMinor(String(d.buy_amount), buy),
        rate: Number(d.client_rate), mid: Number(d.mid_rate),
        /* HOW FAR OFF MID, ALWAYS AS A COST. Both directions of a pair come
           back quoted the same way round — AUD/CNY is CNY per AUD whether you
           are selling AUD or selling CNY — so on one of them the client rate
           is ABOVE mid and the old subtraction reported a negative margin,
           i.e. a discount the customer was not getting. Sandbox, 2026-09-20:
           AUD->CNY 4.724763 against mid 4.76687 read as 0.88%, and CNY->AUD
           4.809117 against the same mid read as -0.89%. Both are 0.88% of the
           customer's money; the distance is what matters, not the sign. */
        marginBps: d.mid_rate ? Math.round(Math.abs(1 - Number(d.client_rate) / Number(d.mid_rate)) * 10000) : 0,
        expiresAt: d.valid_to_at,
      };
    },

    /* POST /api/v1/fx/conversions/create with the locked quote. */
    async convert({ quoteId, sell, buy }) {
      if (String(quoteId).startsWith("same_")) return { conversionId: "", status: "SETTLED" };
      const d = await call("POST", "/api/v1/fx/conversions/create", { request_id: randomUUID(), quote_id: quoteId, sell_currency: sell, buy_currency: buy });
      return { conversionId: d.conversion_id, status: d.status };
    },

    /* POST /api/v1/pa/payment_intents/create, then /confirm with a saved
       payment method. 3-D Secure comes back as next_action redirect_iframe. */
    async createPaymentIntent({ amount, currency, sourceRef, returnUrl, metadata = {} }) {
      const pi = await call("POST", "/api/v1/pa/payment_intents/create", {
        request_id: randomUUID(), amount: Number(toMajor(amount, currency)), currency, merchant_order_id: `ex_${randomUUID().slice(0, 24)}`,
        return_url: publicOrigin + returnUrl, metadata,
      });
      const c = await call("POST", `/api/v1/pa/payment_intents/${pi.id}/confirm`, {
        request_id: randomUUID(), payment_method: { id: sourceRef }, return_url: publicOrigin + returnUrl,
      });
      if (c.status === "REQUIRES_CUSTOMER_ACTION" && c.next_action?.url) {
        return { id: pi.id, status: "REQUIRES_CUSTOMER_ACTION", nextAction: { ref: pi.id, url: c.next_action.url, frame: c.next_action.type === "redirect_iframe" } };
      }
      return { id: pi.id, status: c.status === "SUCCEEDED" ? "SUCCEEDED" : c.status };
    },

    /* THE ONE CALL THIS WHOLE PRODUCT IS ABOUT: a code somebody long-presses.
     *
     * Not the card path above. A Chinese payer does not have a saved payment
     * method here and is not going to make one — they open a link, see a
     * code, and pay in the wallet they already have open. So: create the
     * intent in CNY, confirm it with wechatpay in "webqr" flow, and what
     * comes back in next_action is a string to draw a QR from.
     *
     * WRITTEN FROM THE DOCS AND NOT YET RUN. The request shape here is a
     * reading of Airwallex's WeChat Pay reference, and the last time this
     * file was written that way it was wrong about a sign and right about
     * nothing it could not check. So the script beside it prints the whole
     * response rather than the field this expects — one real call teaches
     * more than another careful reading. */
    async qrPay({ amount, currency = "CNY", reference = "", method = "wechat" }) {
      /* WHAT EACH WALLET IS CALLED HERE. Mainland Alipay is "alipaycn" and
         not "alipay", which is the international one and refuses a CNY
         intent from an Australian merchant. */
      const kind = method === "alipay" ? "alipaycn" : "wechatpay";
      const pi = await call("POST", "/api/v1/pa/payment_intents/create", {
        request_id: randomUUID(),
        amount: Number(toMajor(amount, currency)),
        currency,
        merchant_order_id: `ex_${randomUUID().slice(0, 24)}`,
        ...(reference ? { descriptor: String(reference).slice(0, 32) } : {}),
      });
      const c = await call("POST", `/api/v1/pa/payment_intents/${pi.id}/confirm`, {
        request_id: randomUUID(),
        /* "qrcode", not "webqr". The sandbox names the whole set when it
           refuses: qrcode, official_account, mini_program, mobile_app,
           mobile_web. A code on a screen that somebody long-presses is
           qrcode; the rest are handoffs inside WeChat itself. */
        payment_method: { type: kind, [kind]: { flow: "qrcode", os_type: "web" } },
      });
      /* next_action.qrcode is what the docs name. Kept alongside the raw
         action so a caller that finds it somewhere else can say so. */
      return {
        id: pi.id,
        status: c.status,
        qr: c.next_action?.qrcode || c.next_action?.url || "",
        raw: c.next_action || null,
      };
    },

    /** The same call the walkthrough makes, kept by its old name. */
    async wechatQr(opts) { return this.qrPay({ ...opts, method: "wechat" }); },

    /* GET /api/v1/pa/payment_intents/{id} — the only witness there is.
     *
     * A code on a wall is paid inside somebody else's wallet app. Nothing
     * comes back to this server on the payer's browser, and a webhook needs a
     * public address registered in Airwallex's dashboard and a secret in
     * .env — both worth doing and neither done yet. Asking is one call and
     * needs nothing set up, so asking is what the pages do. */
    async intentStatus(intentId) {
      const d = await call("GET", `/api/v1/pa/payment_intents/${encodeURIComponent(intentId)}`);
      return { id: d.id, status: String(d.status || ""), amount: d.amount, currency: d.currency };
    },

    /* POST /api/v1/pa/refunds/create */
    async refund({ intentId, amount, currency }) {
      const d = await call("POST", "/api/v1/pa/refunds/create", { request_id: randomUUID(), payment_intent_id: intentId, ...(amount && currency ? { amount: Number(toMajor(amount, currency)) } : {}) });
      return { refundId: d.id, status: d.status };
    },

    /* POST /api/v1/beneficiaries/create — Australia by BSB over local clearing. */
    async createBeneficiary({ currency, country, details }) {
      if (currency === "CNY") throw new NotYet("Yuan payouts to individuals aren't confirmed with Airwallex — see note 2.");
      if (country !== "AU") throw new NotYet(`Bank details for ${country} aren't mapped to Airwallex's schema yet.`);
      const [first, ...rest] = String(details.accountName).split(/\s+/);
      const d = await call("POST", "/api/v1/beneficiaries/create", {
        transfer_methods: ["LOCAL"],
        beneficiary: {
          type: "BANK_ACCOUNT", entity_type: "PERSONAL", first_name: first, last_name: rest.join(" ") || first,
          bank_details: { account_currency: "AUD", account_name: details.accountName, account_number: details.accountNumber, account_routing_type1: "bsb", account_routing_value1: details.bsb, bank_country_code: "AU", local_clearing_system: "BANK_TRANSFER" },
        },
      });
      return { beneficiaryId: d.id || d.beneficiary_id, label: `Bank account ···· ${String(details.accountNumber).slice(-4)}` };
    },

    /* POST /api/v1/transfers/create */
    async payout({ amount, currency, beneficiaryId, reference }) {
      if (currency === "CNY") throw new NotYet("Yuan payouts to individuals aren't confirmed with Airwallex — see note 2.");
      const d = await call("POST", "/api/v1/transfers/create", {
        request_id: randomUUID(), beneficiary_id: beneficiaryId, transfer_currency: currency, transfer_amount: toMajor(amount, currency),
        source_currency: currency, transfer_method: "LOCAL", reason: "professional_business_services", reference: String(reference).slice(0, 140),
      });
      return { payoutId: d.id, status: d.status };
    },

    /* Webhooks: HMAC-SHA256 (hex) of x-timestamp + raw body, keyed by the
       notification URL's secret. Verified before the JSON is parsed. */
    async handleWebhook({ raw, headers }) {
      const ts = String(headers["x-timestamp"] || "");
      const sig = String(headers["x-signature"] || "");
      if (!webhookSecret || !ts || !sig) return false;
      if (Math.abs(Date.now() - Number(ts)) > 5 * 60_000) return false;
      const want = createHmac("sha256", webhookSecret).update(ts).update(raw).digest("hex");
      const a = Buffer.from(want), b = Buffer.from(sig);
      if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
      const e = JSON.parse(raw.toString("utf8"));
      const o = e.data?.object || {};
      const map = {
        "account.active": () => ({ type: "account.status", accountId: o.id, status: "ACTIVE" }),
        "account.action_required": () => ({ type: "account.status", accountId: o.id, status: "ACTION_REQUIRED" }),
        "account.submitted": () => ({ type: "account.status", accountId: o.id, status: "SUBMITTED" }),
        "payment_intent.succeeded": () => ({ type: "payment.status", intentId: o.id, status: "SUCCEEDED" }),
        "payment_intent.payment_failed": () => ({ type: "payment.status", intentId: o.id, status: "FAILED" }),
        "payment_intent.cancelled": () => ({ type: "payment.status", intentId: o.id, status: "FAILED" }),
        "payout.transfer.processing": () => ({ type: "payout.status", payoutId: o.id, status: "PROCESSING" }),
        "payout.transfer.sent": () => ({ type: "payout.status", payoutId: o.id, status: "PROCESSING" }),
        "payout.transfer.paid": () => ({ type: "payout.status", payoutId: o.id, status: "PAID" }),
        "payout.transfer.failed": () => ({ type: "payout.status", payoutId: o.id, status: "FAILED" }),
      };
      const out = map[e.name]?.();
      if (out) events.emit("event", { ...out, providerEventId: e.id });
      return true;
    },

    onEvent(fn) { events.on("event", fn); },
  };
}
