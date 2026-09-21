// QFPay, behind the same calls as the stand-in and Airwallex.
//
// WHY THIS FILE EXISTS. Stripe closed the account on 20 September 2026 and
// Airwallex refused activation on the 21st — "after careful review, this
// decision is final", no reason given, the day after business verification
// passed. Two refusals in two days for the same thing: a sole trader with no
// processing history proposing to move money across the China corridor.
//
// QFPay is not a fourth guess. Putting WeChat Pay and Alipay in front of
// merchants outside China is the whole of what they do, their overseas API is
// published openly (github.com/QFPay/QFPAY_Oversea), and it settles AUD. The
// four calls the board needs map onto it almost one for one:
//
//   qrPay        POST /trade/v1/payment   pay_type 800201 / 800101
//   intentStatus POST /trade/v1/query
//   refund       POST /trade/v1/refund
//   webhook      the callback, signed in X-QF-SIGN
//
// WRITTEN FROM THE DOCS AND NOT YET RUN. No account existed when this was
// written. Every line below is a reading of a document — the same state
// airwallex.js was in on 15 September, and that file's header now records
// which of its guesses were wrong once a sandbox key existed. Expect the same
// here, and `qfpay.check.mjs` is where that stops being theory.
//
// WHAT IT DELIBERATELY DOES NOT DO: payouts. QFPay is an acquirer. Money in
// from a wallet, settled to the merchant's own bank — that is the shop's whole
// problem and half of Dealio's. Paying a third party is a different licence
// and a different company, and this file refuses rather than pretending, the
// same way airwallex.js refuses CNY payouts.

import { createHash, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

class NotYet extends Error {
  constructor(message) { super(message); this.code = "provider_not_ready"; this.status = 501; }
}

/* WHERE THE CALLS GO, OVERRIDABLE, and for the same reason airwallexBase is:
   the host was read from a document rather than reached. QFPay publishes more
   than one name for it depending on which market's documentation you are
   holding, and a wrong guess should be a line in .env
   (BOARD_WALLET_QFPAY_BASE) rather than a code change and a redeploy. */
export function qfpayBase({ base = "", sandbox = true } = {}) {
  const b = String(base || "").trim().replace(/\/+$/, "");
  if (b) return b;
  return sandbox ? "https://test-openapi.qfapi.com" : "https://openapi.qfapi.com";
}

/* THE SIGNATURE, AND IT IS THE ONE THING HERE WITH NO ROOM TO BE NEARLY RIGHT.
 *
 * Their rule: take every parameter whose value is not empty, sort the pairs by
 * key ascending, join them as k=v with &, append the application key to the
 * end of that string — appended, not as another pair — and MD5 the result.
 *
 * NOT JSON. The body is form-encoded, and the string that is signed is the
 * same string that is sent. Signing a JSON body and posting a form is the
 * classic way to spend an afternoon reading "signature error" with no clue
 * which half is wrong, so both are built from one object here, once. */
export function qfpaySign(params, key) {
  const pairs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && String(v) !== "")
    .map(([k, v]) => [k, String(v)])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const base = pairs.map(([k, v]) => `${k}=${v}`).join("&");
  return { sign: createHash("md5").update(base + String(key), "utf8").digest("hex"), base, pairs };
}

export function createQfpayProvider({ appCode, appKey, sandbox = true, base: baseOverride = "", webhookSecret = "" }) {
  const base = qfpayBase({ base: baseOverride, sandbox });
  const events = new EventEmitter();

  async function call(path, params) {
    if (!appCode || !appKey) throw new NotYet("QFPay keys are not set (BOARD_WALLET_QFPAY_APP_CODE / _APP_KEY).");
    const { sign, pairs } = qfpaySign(params, appKey);
    const body = new URLSearchParams(pairs).toString();
    /* A CEILING ON HOW LONG THIS MAY HOLD A REQUEST, the same as mail.js: a
       payer is watching a spinner on a phone, and a provider having a bad
       afternoon must not turn that into a page that never answers. */
    const stop = AbortSignal.timeout ? AbortSignal.timeout(15_000) : undefined;
    const res = await fetch(base + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-QF-APPCODE": appCode,
        "X-QF-SIGN": sign,
      },
      body,
      signal: stop,
    });
    const text = await res.text();
    let d; try { d = text ? JSON.parse(text) : {}; } catch { d = { raw: text }; }
    /* TWO WAYS TO FAIL AND ONLY ONE OF THEM IS AN HTTP ERROR. QFPay answers
       200 with respcd on it: "0000" is done, "1143" is waiting for the payer,
       anything else is a refusal that names itself in resperr. A caller told
       only the HTTP status would read a declined card as a success. */
    if (!res.ok) {
      const err = new Error(`qfpay ${path} ${res.status}: ${String(text).slice(0, 200)}`);
      err.status = res.status;
      throw err;
    }
    return d;
  }

  const ok = (d) => String(d?.respcd || "") === "0000";
  const said = (d) => [d?.respcd, d?.resperr, d?.respmsg].filter(Boolean).join(" ").trim();

  /* THEIR WORDS FOR PAID, IN OURS. The board compares against the one string
     "SUCCEEDED" in three places (settleIfPaid, the order check, the webhook),
     and every provider in this directory is responsible for speaking it. */
  function asStatus(d) {
    const code = String(d?.respcd || "");
    if (code === "0000") return "SUCCEEDED";
    if (code === "1143" || code === "1145") return "PENDING";   // waiting on the payer
    if (code === "1148") return "CANCELLED";
    return code ? "FAILED" : "";
  }

  return {
    name: "qfpay",
    isTest: Boolean(sandbox),

    /* THE FOUR THAT WORK. */

    /** A code on the payer's page. `qr` comes back as the string QFPay wants
     *  encoded; the server turns it into a PNG with lib/qr.js, which is where
     *  that decision already lives — see the note at the top of that file
     *  about WeChat's long-press only reading an <img>. */
    async qrPay({ amount, currency = "CNY", reference = "", method = "wechat" }) {
      /* 800201 IS WECHAT AND 800101 IS ALIPAY, both the dynamic kind: the
         merchant names a price and the payer scans. The barcode types
         (800208, 800108) are the other direction — a shop scanning a phone at
         a counter — and would return nothing a page could draw. */
      const payType = method === "alipay" ? "800101" : "800201";
      const out = String(reference || randomUUID()).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32)
        || randomUUID().replace(/-/g, "").slice(0, 32);
      const d = await call("/trade/v1/payment", {
        /* MINOR UNITS, WHICH IS WHAT THE LEDGER ALREADY HOLDS. money.js keeps
           everything in fen and converts only at the edges; txamt is fen too,
           so this is the one provider where nothing is converted. */
        txamt: String(Math.round(Number(amount))),
        txcurrcd: String(currency).toUpperCase(),
        pay_type: payType,
        out_trade_no: out,
        txdtm: new Date().toISOString().replace("T", " ").slice(0, 19),
      });
      if (!ok(d) && asStatus(d) !== "PENDING") {
        const err = new Error(`qfpay payment refused: ${said(d) || "no reason given"}`);
        err.body = d;
        throw err;
      }
      return {
        id: String(d.syssn || out),
        ref: out,
        status: asStatus(d),
        qr: String(d.qrcode || d.pay_url || ""),
        raw: d,
      };
    },

    /** The only witness there is, and the pages lean on it: a code is paid
     *  inside somebody else's wallet and nothing comes back to this server on
     *  the payer's browser. Same shape as the Airwallex one so settleIfPaid
     *  cannot tell which provider answered. */
    async intentStatus(intentId) {
      const d = await call("/trade/v1/query", { syssn: String(intentId) });
      return {
        id: String(d.syssn || intentId),
        status: asStatus(d),
        amount: d.txamt !== undefined ? Number(d.txamt) : undefined,
        currency: d.txcurrcd || undefined,
      };
    },

    async refund({ intentId, amount, currency }) {
      const d = await call("/trade/v1/refund", {
        syssn: String(intentId),
        out_trade_no: randomUUID().replace(/-/g, "").slice(0, 32),
        txamt: amount === undefined ? "" : String(Math.round(Number(amount))),
        txcurrcd: currency ? String(currency).toUpperCase() : "",
      });
      if (!ok(d)) {
        const err = new Error(`qfpay refund refused: ${said(d) || "no reason given"}`);
        err.body = d;
        throw err;
      }
      return { refundId: String(d.syssn || ""), status: asStatus(d) };
    },

    /** Their callback, verified the same way a request is signed — the rule
     *  runs both directions, so one function does both and there is one place
     *  to be wrong about it.
     *
     *  A FORGED WEBHOOK SETTLES NOTHING even if this were wrong: every route
     *  that acts on an event asks the provider before it writes. That is
     *  deliberate and it is why the signature check here is a first gate
     *  rather than the only one. */
    async handleWebhook({ raw, headers }) {
      const given = String(headers?.["x-qf-sign"] || headers?.["X-QF-SIGN"] || "");
      const params = Object.fromEntries(new URLSearchParams(String(raw || "")));
      const { sign } = qfpaySign(params, webhookSecret || appKey);
      if (!given || given.toLowerCase() !== sign.toLowerCase()) {
        const err = new Error("qfpay webhook signature did not match");
        err.status = 400;
        throw err;
      }
      const event = {
        type: "payment.status",
        status: asStatus(params),
        intentId: String(params.syssn || params.out_trade_no || ""),
        raw: params,
      };
      events.emit("event", event);
      return event;
    },

    onEvent(fn) { events.on("event", fn); },

    /* AND THE ONES THAT REFUSE, each saying which thing it is rather than a
       shared "not implemented" — a refusal that does not name itself is a
       morning spent finding out which of five calls was the one. */

    async payout() {
      throw new NotYet("QFPay is an acquirer: money in from a wallet, settled to the merchant's own bank. Paying a third party is a different licence and a different company — see the header of this file.");
    },
    async createBeneficiary() {
      throw new NotYet("QFPay does not hold beneficiaries. Nothing here can pay somebody else.");
    },
    async createAccount() {
      throw new NotYet("QFPay has no connected accounts. One merchant, one settlement account.");
    },
    async startOnboarding() {
      throw new NotYet("QFPay onboards merchants itself, off this board. There is no hosted flow to send anybody into.");
    },
    async startSourceConnect() {
      throw new NotYet("No saved cards here. The wallets are the payment method.");
    },
    session() { return null; },
    async completeSession() { return null; },
    async quote() {
      throw new NotYet("QFPay settles the merchant's own currency and does not quote FX to a caller. The rate is in the settlement report — see 5_settlement.md in their docs.");
    },
    async convert() {
      throw new NotYet("No conversion to ask for: settlement currency is set on the merchant account.");
    },
    async createPaymentIntent() {
      throw new NotYet("Card payments are not wired for QFPay. The wallets are, through qrPay.");
    },
  };
}
