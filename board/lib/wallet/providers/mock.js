// A stand-in for the payment provider, shaped like Airwallex, moving no money.
//
// WHY A STAND-IN AND NOT THE PROVIDER'S OWN SANDBOX. The sandbox needs an
// account and keys that only Tom can open and hold, and the whole wallet — the
// screens, the states, the refunds, a payout sitting in review for a day — can
// be built and tested before either exists. Everything the service asks of a
// provider goes through the eight calls below, which are the calls the
// Airwallex adapter makes too, so replacing this file with that one is a
// setting and not a rewrite.
//
// WHAT IT PRETENDS, deliberately:
// - identity checks and connecting a card, bank or PayPal happen on a "page
//   of its own" (see pages.js), the way the real ones do;
// - a card from a country with Strong Customer Authentication asks the bank
//   to approve the payment, on another of those pages;
// - a payout in yuan sits "in review" before it is paid, as payments into
//   China do;
// - rates are fixed test rates with a visible margin, never live prices.

import { randomBytes } from "node:crypto";
import { EventEmitter } from "node:events";
import { convert, bps } from "../money.js";

const id = (p) => `${p}_${randomBytes(8).toString("hex")}`;

/* Test rates, in US dollars per unit. Not prices; stable so tests are too. */
const USD_PER = { USD: 1, EUR: 1.08, AUD: 0.66, CNY: 0.138, HKD: 0.128 };

export function createMockProvider({ speed = 1, marginBps = 50 } = {}) {
  const events = new EventEmitter();
  const sessions = new Map();   // ref -> { kind, data, done }
  const intents = new Map();
  const payouts = new Map();
  const quotes = new Map();
  const later = (ms, fn) => setTimeout(fn, Math.max(1, ms * speed)).unref?.();

  const emit = (e) => events.emit("event", e);

  function rate(sell, buy) {
    if (sell === buy) return { mid: 1, rate: 1 };
    const mid = USD_PER[sell] / USD_PER[buy];
    return { mid, rate: mid * (1 - marginBps / 10000) };
  }

  return {
    name: "test",
    isTest: true,

    async createAccount({ region }) {
      return { accountId: id("acct"), status: "ACTION_REQUIRED", region };
    },

    /* The hosted identity check. The member leaves for the provider's page and
       comes back to returnUrl; the result arrives as an event, the way a real
       provider reports it by webhook rather than on the redirect. */
    async startOnboarding({ accountId, returnUrl }) {
      const ref = id("kyc");
      sessions.set(ref, { kind: "kyc", data: { accountId, returnUrl } });
      return { ref, url: `/wallet/test-provider/${ref}` };
    },

    async startSourceConnect({ accountId, kind, returnUrl, country }) {
      const ref = id("conn");
      sessions.set(ref, { kind: "source", data: { accountId, kind, returnUrl, country } });
      return { ref, url: `/wallet/test-provider/${ref}` };
    },

    /** What a hand-off page needs to draw itself: which flow, and for a
        connection which kind of payment method. */
    session(ref) {
      const s = sessions.get(ref);
      if (!s || s.done) return null;
      return { flow: s.kind, sourceKind: s.data.kind || "", amount: s.data.amount, currency: s.data.currency };
    },

    /** What the provider's own page does when the person presses a button. */
    async completeSession(ref, approved) {
      const s = sessions.get(ref);
      if (!s || s.done) return null;
      s.done = true;
      if (s.kind === "kyc") {
        emit({ type: "account.status", accountId: s.data.accountId, status: approved ? "ACTIVE" : "ACTION_REQUIRED" });
        return { returnUrl: s.data.returnUrl };
      }
      if (s.kind === "source") {
        if (!approved) return { returnUrl: s.data.returnUrl };
        const labels = {
          card: s.data.country === "FI" ? "Visa ···· 4242" : s.data.country === "CN" ? "UnionPay ···· 8810" : "Visa ···· 4242",
          bank: s.data.country === "AU" ? "Bank account ···· 6789" : s.data.country === "FI" ? "Nordea ···· 1105" : "Bank account ···· 6789",
          paypal: "PayPal · t•••@example.com",
          wechat: "WeChat Pay",
        };
        emit({ type: "source.connected", ref, accountId: s.data.accountId, source: { providerRef: id("pm"), kind: s.data.kind, label: labels[s.data.kind] || "Payment method" } });
        return { returnUrl: s.data.returnUrl };
      }
      if (s.kind === "sca") {
        const pi = intents.get(s.data.intentId);
        pi.status = approved ? "SUCCEEDED" : "FAILED";
        emit({ type: "payment.status", intentId: pi.id, status: pi.status });
        return { returnUrl: s.data.returnUrl };
      }
      return null;
    },

    /* A quote locks a rate for a while. Either side can be the fixed one: a
       payer types what they send, a request fixes what arrives. */
    async quote({ sell, buy, sellAmount, buyAmount, validSeconds = 600 }) {
      const { rate: r, mid } = rate(sell, buy);
      let s = sellAmount, b = buyAmount;
      if (s != null) b = convert(s, r, sell, buy);
      else s = Math.ceil(convert(b, 1 / r, buy, sell) * 1.0000001) + 1;
      if (b == null || s == null) throw new Error("quote needs one amount");
      if (buyAmount != null) {
        // Nudge the sell side up until it really produces the fixed amount.
        while (convert(s, r, sell, buy) < buyAmount) s += 1;
        while (s > 1 && convert(s - 1, r, sell, buy) >= buyAmount) s -= 1;
        b = buyAmount;
      }
      const q = { quoteId: id("quote"), sell, buy, sellAmount: s, buyAmount: b, rate: r, mid, marginBps: sell === buy ? 0 : marginBps,
        expiresAt: new Date(Date.now() + validSeconds * 1000).toISOString() };
      quotes.set(q.quoteId, q);
      return q;
    },

    async convert({ quoteId }) {
      const q = quotes.get(quoteId);
      if (!q) throw Object.assign(new Error("unknown quote"), { code: "quote_unknown" });
      if (Date.parse(q.expiresAt) < Date.now()) throw Object.assign(new Error("quote expired"), { code: "quote_expired" });
      return { conversionId: id("conv"), status: "SETTLED" };
    },

    async createPaymentIntent({ amount, currency, sourceRef, requireSca, returnUrl }) {
      const pi = { id: id("int"), amount, currency, sourceRef, status: "SUCCEEDED", refunded: 0 };
      intents.set(pi.id, pi);
      if (requireSca) {
        pi.status = "REQUIRES_CUSTOMER_ACTION";
        const ref = id("sca");
        sessions.set(ref, { kind: "sca", data: { intentId: pi.id, returnUrl, amount, currency } });
        return { id: pi.id, status: pi.status, nextAction: { ref, url: `/wallet/test-provider/${ref}` } };
      }
      return { id: pi.id, status: pi.status };
    },

    async refund({ intentId, amount }) {
      const pi = intents.get(intentId);
      if (!pi) throw new Error("unknown payment");
      if (pi.refunded + amount > pi.amount) throw new Error("refund larger than payment");
      pi.refunded += amount;
      return { refundId: id("ref"), status: "SUCCEEDED" };
    },

    async createBeneficiary({ details }) {
      const tail = String(details.accountNumber || details.cardNumber || details.iban || "").replace(/\s+/g, "").slice(-4);
      return { beneficiaryId: id("ben"), label: `${details.bankName || "Bank account"} ···· ${tail}` };
    },

    /* A payout. Yuan goes through review first; everything else is simply
       on its way and then paid. */
    async payout({ amount, currency, beneficiaryId, reason }) {
      const p = { id: id("po"), amount, currency, beneficiaryId, reason, status: currency === "CNY" ? "IN_REVIEW" : "PROCESSING" };
      payouts.set(p.id, p);
      if (currency === "CNY") {
        later(4000, () => { p.status = "PROCESSING"; emit({ type: "payout.status", payoutId: p.id, status: p.status }); });
        later(9000, () => { p.status = "PAID"; emit({ type: "payout.status", payoutId: p.id, status: p.status }); });
      } else {
        later(3000, () => { p.status = "PAID"; emit({ type: "payout.status", payoutId: p.id, status: p.status }); });
      }
      return { payoutId: p.id, status: p.status };
    },

    onEvent(fn) { events.on("event", fn); },
  };
}

export { bps };
