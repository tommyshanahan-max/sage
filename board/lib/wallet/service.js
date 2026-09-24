// The wallet's rules: who can send what to whom, and what happens to the money
// at every step. No HTTP here and no provider specifics — routes.js speaks to
// browsers, providers/*.js speak to the payment company, and this file is the
// part that has to be right whichever of those is plugged in.
//
// THE SHAPE OF A PAYMENT, in the order it happens:
//
//   quote      the rate is locked and both amounts are shown before anything
//              moves: what the payer is charged, and what arrives
//   send       money comes in — from the wallet balance, or charged to a card
//              or bank through the provider, sometimes with the bank asking the
//              payer to approve it (Strong Customer Authentication in Europe)
//              — and is converted straight away at the locked rate
//   waiting    held by the platform account at the provider, never by the
//              Exchange, for up to 24 hours
//   accept     into the recipient's balance, or paid straight out to their bank
//              (always, for somebody in mainland China — see REGIONS.balance)
//   or back    declined, cancelled or expired: the payer gets back everything
//              they were charged, fee included. The Exchange absorbs any change
//              in the exchange rate on money returned; a payer who is refunded
//              less than they paid because a stranger said no is a payer who
//              does not use this twice.

import { REGIONS, CURRENCIES, toMinor, format, bps, isRegion } from "./money.js";
import { newId } from "./ledger.js";

export const FEES = { wallet: 0, bank: 0, card: 290, paypal: 340, wechat: 0 };
const HOLD_MS = 24 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

export class WalletError extends Error {
  constructor(code, message, status = 400) { super(message || code); this.code = code; this.status = status; }
}
const fail = (code, message, status) => { throw new WalletError(code, message, status); };

export function createWalletService({ ledger, provider, people, now = () => Date.now(), onChange = () => {} }) {
  const iso = () => new Date(now()).toISOString();

  /* ---- reading ---------------------------------------------------------- */

  const regionOf = (w) => REGIONS[w.region];
  const mask = (w) => w && { region: w.region, currency: w.currency, status: w.status };

  function walletOf(data, by) {
    const w = data.wallets[by];
    return w && w.status !== "closed" ? w : null;
  }
  function needWallet(data, me, { verified = false } = {}) {
    const w = walletOf(data, me.by);
    if (!w) fail("no_wallet", "Set up your wallet first.", 409);
    if (verified && w.verified !== "verified") fail("not_verified", "Confirm your identity first.", 409);
    return w;
  }
  const personById = (id) => people.byId(id) || fail("no_person", "That member isn't on the board.", 404);
  const who = (by) => { const p = people.byHash(by); return p ? { id: p.id, handle: p.handle } : { id: "", handle: "A member" }; };

  function sentToday(data, by) {
    const since = now() - DAY_MS;
    return Object.values(data.transfers)
      .filter((t) => t.from === by && Date.parse(t.createdAt) > since && !["failed"].includes(t.state))
      .reduce((a, t) => a + t.total, 0);
  }

  function publicSource(s) { return { id: s.id, kind: s.kind, label: s.label, default: Boolean(s.default), fee: FEES[s.kind] ?? 0 }; }

  function lineFor(data, me, t) {
    const out = t.from === me.by;
    const other = who(out ? t.to : t.from);
    return {
      kind: "transfer", id: t.id, direction: out ? "out" : "in", with: other, state: t.state, note: t.note, reason: t.reason,
      at: t.createdAt, room: t.room || "",
      amount: out ? { minor: t.total, currency: t.sell.currency, text: format(t.total, t.sell.currency) }
        : { minor: t.buy.minor, currency: t.buy.currency, text: format(t.buy.minor, t.buy.currency) },
      sent: { text: format(t.sell.minor, t.sell.currency) }, received: { text: format(t.buy.minor, t.buy.currency) },
      fee: { text: t.fee ? format(t.fee, t.sell.currency) : "" }, rateText: t.rateText, expiresAt: t.expiresAt,
      timeline: t.timeline, payoutTo: t.payoutTo || "", sourceLabel: out ? t.sourceLabel : "",
      canAccept: !out && t.state === "waiting", canCancel: out && t.state === "waiting",
    };
  }

  async function state(me) {
    return ledger.read((data) => {
      const w = walletOf(data, me.by);
      const base = { regions: Object.fromEntries(Object.entries(REGIONS).map(([k, r]) => [k, { name: r.name, currency: r.currency, balance: r.balance }])), provider: provider.name };
      if (!w) {
        const waiting = Object.values(data.transfers).filter((t) => t.to === me.by && t.state === "waiting");
        return { ...base, wallet: null, waitingForYou: waiting.map((t) => lineFor(data, me, t)) };
      }
      const r = regionOf(w);
      const sources = Object.values(data.sources).filter((s) => s.by === me.by).map(publicSource);
      const ben = w.beneficiaryId ? data.beneficiaries[w.beneficiaryId] : null;
      const incoming = Object.values(data.transfers).filter((t) => t.to === me.by && t.state === "waiting").map((t) => lineFor(data, me, t));
      const requests = Object.values(data.requests).filter((q) => q.state === "open" && (q.to === me.by || q.from === me.by)).map((q) => requestLine(me, q));

      /* EARNED AND STILL TO COME — the only two numbers that are true about a
         wallet that holds nothing.
         A balance was the headline until 24 Sep, and on a board that cannot
         legally hold money it was both a zero and a claim about what this is.
         These two are honest: what has reached you, and what is on its way.
         The same pair the deals card on Profile has used all along, whose own
         note reads "Never a balance, and the card says so in the same breath
         as the number."
         IN ONLY. The other side of a transfer is money spent, and an Earned
         figure that quietly includes it is wrong in the direction that
         flatters. `buy` is what ARRIVES — `sell` is what the payer was
         charged, and the two differ by the fee and the rate, so counting the
         wrong one overstates what somebody actually got. */
      const toMe = Object.values(data.transfers).filter((t) => t.to === me.by && t.buy?.currency === w.currency);
      const sum = (rows) => rows.reduce((n, t) => n + (t.buy?.minor || 0), 0);
      const earnedMinor = sum(toMe.filter((t) => ["accepted", "completed", "paid"].includes(t.state)));
      const pendingMinor = sum(toMe.filter((t) => ["waiting", "charging", "charged", "processing", "sent"].includes(t.state)));
      return {
        ...base,
        wallet: {
          region: w.region, regionName: r.name, currency: w.currency, verified: w.verified, status: w.status,
          holdsBalance: r.balance, reasonRequired: r.reasonRequired,
          balance: { minor: w.balance, text: format(w.balance, w.currency) },
          earned: { minor: earnedMinor, text: format(earnedMinor, w.currency) },
          pending: { minor: pendingMinor, text: format(pendingMinor, w.currency) },
          payout: w.payout, payoutLabel: ben ? ben.label : "",
          limits: { sendDay: { minor: r.send, text: format(r.send, w.currency) }, sentToday: { minor: sentToday(data, me.by), text: format(sentToday(data, me.by), w.currency) }, receiveMonth: { text: format(r.recv, w.currency) } },
          passkeys: (data.credentials[me.by] || []).length,
          sources, incoming, requests,
        },
      };
    });
  }

  function requestLine(me, q) {
    const mine = q.from === me.by;
    return { kind: "request", id: q.id, direction: mine ? "out" : "in", with: who(mine ? q.to : q.from), state: q.state,
      amount: { minor: q.amount, currency: q.currency, text: format(q.amount, q.currency) }, note: q.note, at: q.createdAt, room: q.room || "",
      paidBy: q.transferId || "" };
  }

  /* ---- setup ------------------------------------------------------------ */

  async function setup(me, { region, acceptedTerms }) {
    if (!isRegion(region)) fail("bad_region", "Choose where you live.");
    if (acceptedTerms !== true) fail("terms", "The wallet terms need accepting first.");
    const account = await provider.createAccount({ region });
    return ledger.change((data, log) => {
      const existing = data.wallets[me.by];
      if (existing && existing.status !== "closed") fail("exists", "You already have a wallet.", 409);
      const r = REGIONS[region];
      data.wallets[me.by] = {
        by: me.by, region, currency: r.currency, status: "active", verified: "none", accountId: account.accountId,
        balance: 0, payout: r.balance ? "wallet" : "bank", beneficiaryId: "", termsAt: iso(), createdAt: iso(),
      };
      log("wallet.created", { by: me.by, region, currency: r.currency });
      return mask(data.wallets[me.by]);
    });
  }

  async function startVerify(me, returnUrl) {
    const w = await ledger.read((d) => needWallet(d, me));
    const s = await provider.startOnboarding({ accountId: w.accountId, returnUrl });
    await ledger.change((data, log) => {
      data.sessions[s.ref] = { kind: "kyc", by: me.by, at: iso() };
      data.wallets[me.by].verified = "pending";
      log("verify.started", { by: me.by });
    });
    return { url: s.url };
  }

  async function startConnect(me, kind, returnUrl) {
    if (!["card", "bank", "paypal", "wechat"].includes(kind)) fail("bad_kind", "That can't be connected.");
    const w = await ledger.read((d) => needWallet(d, me));
    if (kind === "wechat" && w.region !== "CN") fail("bad_kind", "WeChat Pay is for members in mainland China.");
    const s = await provider.startSourceConnect({ accountId: w.accountId, kind, returnUrl, country: w.region });
    await ledger.change((data) => { data.sessions[s.ref] = { kind: "source", by: me.by, sourceKind: kind, at: iso() }; });
    return { url: s.url };
  }

  async function removeSource(me, id) {
    return ledger.change((data, log) => {
      const s = data.sources[id];
      if (!s || s.by !== me.by) fail("not_found", "That payment method isn't yours.", 404);
      delete data.sources[id];
      const rest = Object.values(data.sources).filter((x) => x.by === me.by);
      if (s.default && rest[0]) rest[0].default = true;
      log("source.removed", { by: me.by, ref: id, kind: s.kind });
      return true;
    });
  }

  async function setDefaultSource(me, id) {
    return ledger.change((data, log) => {
      const s = data.sources[id];
      if (!s || s.by !== me.by) fail("not_found", "That payment method isn't yours.", 404);
      for (const x of Object.values(data.sources)) if (x.by === me.by) x.default = x.id === id;
      log("source.default", { by: me.by, ref: id });
      return true;
    });
  }

  /* WHERE MONEY SENT TO YOU GOES. Details are handed to the provider, which
     returns an id; the Exchange keeps the id and a label ending in four
     digits, never the account number. */
  async function setPayout(me, { mode, details }) {
    const w = await ledger.read((d) => needWallet(d, me));
    const r = REGIONS[w.region];
    if (mode === "wallet") {
      if (!r.balance) fail("no_balance_here", "In mainland China, money you receive goes straight to your bank.");
      return ledger.change((data, log) => { data.wallets[me.by].payout = "wallet"; log("payout.mode", { by: me.by, mode }); return true; });
    }
    if (mode !== "bank") fail("bad_mode", "Choose where your money goes.");
    const clean = checkBankDetails(w.region, details || {});
    const ben = await provider.createBeneficiary({ accountId: w.accountId, currency: w.currency, country: w.region, details: clean });
    return ledger.change((data, log) => {
      const id = newId("ben");
      data.beneficiaries[id] = { id, by: me.by, providerRef: ben.beneficiaryId, label: ben.label, currency: w.currency, createdAt: iso() };
      data.wallets[me.by].beneficiaryId = id;
      data.wallets[me.by].payout = "bank";
      log("payout.bank", { by: me.by, ref: id, label: ben.label });
      return { label: ben.label };
    });
  }

  /** An IBAN's own checksum: first four characters to the end, letters to
   *  numbers (A=10 … Z=35), and the whole thing mod 97 is 1. Done in chunks
   *  because the number is far too large for a float. */
  function validIban(v) {
    const moved = v.slice(4) + v.slice(0, 4);
    let rest = 0;
    for (const ch of moved) {
      const n = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
      for (const digit of n) rest = (rest * 10 + Number(digit)) % 97;
    }
    return rest === 1;
  }

  /** The ABN's own checksum. Eleven digits, first one less one, weighted,
   *  and the total divides by 89. */
  function validAbn(abn) {
    if (!/^\d{11}$/.test(abn)) return false;
    const w = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    const n = abn.split("").map(Number);
    n[0] -= 1;
    return n.reduce((sum, d2, i) => sum + d2 * w[i], 0) % 89 === 0;
  }

  function checkBankDetails(region, d) {
    const t = (v, n = 80) => String(v ?? "").trim().slice(0, n);
    const digits = (v) => String(v ?? "").replace(/[\s-]/g, "");
    const name = t(d.accountName);
    if (name.length < 2) fail("bank_name", "Enter the name on the account.");
    if (region === "AU") {
      const bsb = digits(d.bsb), acc = digits(d.accountNumber);
      if (!/^\d{6}$/.test(bsb)) fail("bank_bsb", "A BSB is six digits.");
      if (!/^\d{5,10}$/.test(acc)) fail("bank_account", "Enter the account number.");
      /* AN ABN, BECAUSE WITHOUT ONE 47% OF THE PAYMENT IS WITHHELD.
       *
       * Not a preference: no-ABN withholding is the law, and a supplier who
       * leaves this blank is paid 53 cents in the dollar with the rest sent
       * to the ATO. Asked here, once, rather than discovered on the first
       * payment.
       *
       * CHECKED WITHOUT ASKING ANYBODY. An ABN carries its own checksum —
       * subtract 1 from the first digit, weight the eleven digits by
       * 10,1,3,5,7,9,11,13,15,17,19 and the sum divides by 89. So a typo is
       * caught here rather than by a bank three days later, and it needs no
       * key, no network and no third party to do it.
       *
       * GST IS A YES OR NO AND BOTH ARE NORMAL. Registered, they add 10% and
       * we claim it back; not registered — under the $75k threshold — they
       * charge none. A form that assumes one is a form that makes half its
       * users wrong. */
      const abn = digits(d.abn);
      if (!validAbn(abn)) fail("bank_abn", "That ABN does not look right. Eleven digits, from your invoice.");
      return { accountName: name, bsb, accountNumber: acc, abn, gst: Boolean(d.gst),
        bankName: t(d.bankName) || "Bank account" };
    }
    if (region === "CN") {
      const acc = digits(d.accountNumber);
      if (!/^\d{12,19}$/.test(acc)) fail("bank_account", "Enter the bank account or UnionPay card number.");
      if (!t(d.bankName)) fail("bank_bank", "Enter the bank's name.");
      return { accountName: name, accountNumber: acc, bankName: t(d.bankName) };
    }
    /* EVERYWHERE ELSE — AND THIS IS THE BRANCH THAT ACTUALLY WIRES MONEY.
     *
     * It took an IBAN and nothing else, which is not enough to send a payment
     * anywhere. A correspondent bank needs to know WHICH bank, and half the
     * world has no IBAN at all: the United States, Canada, Australia, China,
     * India, Japan, most of south-east Asia. A form that only accepts an IBAN
     * refuses most of the people it was built for.
     *
     * SWIFT/BIC IS THE ONE THAT CANNOT BE MISSED. It is how the money finds
     * the bank; without it a wire is returned days later, minus fees, and the
     * person who did the work is the one who waits. Eight characters or
     * eleven, and the shape is fixed — four for the bank, two for the country,
     * two for the place, and an optional three for the branch — so a typo is
     * caught here.
     *
     * THE ADDRESS IS NOT BUREAUCRACY. Correspondent banks screen payments and
     * a beneficiary with no address is the commonest reason one is held.
     *
     * AN IBAN IS CHECKED IF IT LOOKS LIKE ONE. Two letters, two digits, then
     * the rest: move the first four characters to the end, turn letters into
     * numbers, and the whole thing mod 97 is 1. Offline, like the ABN. If it
     * does not look like an IBAN it is taken as a plain account number, which
     * is what most of the world has. */
    const iban = digits(d.iban || d.accountNumber).toUpperCase();
    if (!iban) fail("bank_account", "Enter the IBAN or account number.");
    if (/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban) && !validIban(iban)) {
      fail("bank_account", "That IBAN does not look right. Check it against your statement.");
    }
    if (!/^[A-Z0-9]{5,34}$/.test(iban)) fail("bank_account", "Enter the IBAN or account number.");
    const swift = String(d.swift ?? "").replace(/\s/g, "").toUpperCase();
    if (!/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swift)) {
      fail("bank_swift", "A SWIFT/BIC is 8 or 11 characters, like CTBAAU2S.");
    }
    const bankName = t(d.bankName);
    if (bankName.length < 2) fail("bank_bank", "Enter the bank's name.");
    const address = t(d.address, 160);
    if (address.length < 6) fail("bank_address", "Enter your address. Banks hold payments without one.");
    const country = t(d.country, 60);
    if (country.length < 2) fail("bank_country", "Which country is the account in?");
    return { accountName: name, iban, swift, bankName, address, country };
  }

  /* ---- quote ------------------------------------------------------------ */

  /** What it costs and what arrives. `amount` is typed in the payer's own
   *  currency, or `receive` in the recipient's when paying a request. */
  async function quote(me, { toMemberId, amount, receive, sourceId, requestId }) {
    const person = personById(toMemberId);
    if (person.by === me.by) fail("self", "You can't send money to yourself.");
    const { w, to, source } = await ledger.read((data) => {
      const w = needWallet(data, me, { verified: true });
      const to = walletOf(data, person.by);
      if (!to) fail("recipient_not_ready", `${person.handle} hasn't set up a wallet yet.`, 409);
      const source = sourceId === "wallet" || !sourceId ? { id: "wallet", kind: "wallet", label: "Wallet balance" } : data.sources[sourceId];
      if (!source || (source.kind !== "wallet" && source.by !== me.by)) fail("bad_source", "Choose how to pay.");
      if (source.kind === "wallet" && !REGIONS[w.region].balance) fail("bad_source", "Pay from a card or bank.");
      return { w, to, source };
    });
    let sellAmount = null, buyAmount = null;
    if (receive != null) buyAmount = typeof receive === "number" ? receive : toMinor(receive, to.currency);
    else sellAmount = toMinor(amount, w.currency);
    if (!(sellAmount > 0) && !(buyAmount > 0)) fail("bad_amount", "Enter an amount.");
    const q = await provider.quote({ sell: w.currency, buy: to.currency, sellAmount, buyAmount });
    const fee = bps(q.sellAmount, FEES[source.kind] ?? 0);
    const rec = {
      id: q.quoteId, by: me.by, to: person.by, sell: { minor: q.sellAmount, currency: w.currency }, buy: { minor: q.buyAmount, currency: to.currency },
      fee, total: q.sellAmount + fee, rate: q.rate, marginBps: q.marginBps, sourceId: source.id, sourceKind: source.kind, requestId: requestId || "",
      expiresAt: q.expiresAt, createdAt: iso(),
    };
    rec.rateText = w.currency === to.currency ? "" : `${CURRENCIES[w.currency].sym}1 = ${CURRENCIES[to.currency].sym}${Number(q.rate).toFixed(4)}`;
    await ledger.change((data) => { data.quotes[rec.id] = rec; });
    return {
      quoteId: rec.id, to: { id: person.id, handle: person.handle, region: to.region, regionName: REGIONS[to.region].name },
      send: { minor: rec.sell.minor, text: format(rec.sell.minor, rec.sell.currency) },
      fee: { minor: fee, text: fee ? format(fee, w.currency) : "No fee" },
      total: { minor: rec.total, text: format(rec.total, w.currency) },
      receive: { minor: rec.buy.minor, text: format(rec.buy.minor, rec.buy.currency), currency: rec.buy.currency },
      rateText: rec.rateText, marginPct: rec.marginBps / 100, expiresAt: rec.expiresAt,
      reasonRequired: REGIONS[to.region].reasonRequired, arrives: arrivesText(to),
      firstTime: !(await ledger.read((d) => Object.values(d.transfers).some((t) => t.from === me.by && t.to === person.by && ["waiting", "completed", "paying_out"].includes(t.state)))),
      overLimit: sentTodayAfter(await ledger.read((d) => sentToday(d, me.by)), rec.total, w.region),
      overBalance: source.kind === "wallet" && rec.total > w.balance,
    };
  }
  const sentTodayAfter = (sent, add, region) => sent + add > REGIONS[region].send;
  function arrivesText(to) {
    if (to.region === "CN") return "After they accept, to their bank · usually within 1–2 days after a check";
    return to.payout === "bank" ? "After they accept, to their bank · usually the same or next day" : "Straight to their wallet when they accept";
  }

  /* ---- send ------------------------------------------------------------- */

  async function send(me, { quoteId, note, reason, room, returnUrl }) {
    const prep = await ledger.change((data, log) => {
      const q = data.quotes[quoteId];
      if (!q || q.by !== me.by) fail("quote_unknown", "That quote has gone. Check the amount again.", 409);
      if (q.used) fail("quote_used", "That payment has already been sent.", 409);
      if (Date.parse(q.expiresAt) < now()) fail("quote_expired", "The rate expired. Check the amount again.", 409);
      const w = needWallet(data, me, { verified: true });
      const to = walletOf(data, q.to);
      if (!to) fail("recipient_not_ready", "They haven't set up a wallet yet.", 409);
      const reasonText = String(reason || "").trim().slice(0, 80);
      if (REGIONS[to.region].reasonRequired && reasonText.length < 3) fail("reason_required", "Payments into China need a reason.");
      if (sentToday(data, me.by) + q.total > REGIONS[w.region].send) fail("limit", `That's over your daily limit of ${format(REGIONS[w.region].send, w.currency)}.`);
      const source = q.sourceKind === "wallet" ? { id: "wallet", kind: "wallet", label: "Wallet balance" } : data.sources[q.sourceId];
      if (!source) fail("bad_source", "That payment method was removed.", 409);
      if (source.kind === "wallet") {
        if (w.balance < q.total) fail("balance", "That's more than your balance.", 409);
        w.balance -= q.total;
      }
      q.used = true;
      const t = {
        id: newId("tr"), from: me.by, to: q.to, sell: q.sell, buy: q.buy, fee: q.fee, total: q.total, rate: q.rate, rateText: q.rateText,
        quoteId: q.id, sourceId: source.id, sourceKind: source.kind, sourceLabel: source.label, note: String(note || "").trim().slice(0, 60),
        reason: reasonText, room: String(room || "").slice(0, 40), requestId: q.requestId || "",
        state: source.kind === "wallet" ? "waiting" : "charging", payin: {}, createdAt: iso(), expiresAt: new Date(now() + HOLD_MS).toISOString(),
        timeline: [{ at: iso(), state: "sent" }],
      };
      data.transfers[t.id] = t;
      log("transfer.created", { by: me.by, ref: t.id, to: t.to, total: t.total, currency: t.sell.currency, source: source.kind });
      if (source.kind === "wallet") log("balance.debit", { by: me.by, ref: t.id, minor: q.total, currency: w.currency });
      return { t: { ...t }, sourceRef: source.providerRef, sca: REGIONS[w.region].sca && source.kind === "card" };
    });

    if (prep.t.sourceKind !== "wallet") {
      let pi;
      try {
        pi = await provider.createPaymentIntent({ amount: prep.t.total, currency: prep.t.sell.currency, sourceRef: prep.sourceRef, requireSca: prep.sca, returnUrl });
      } catch (err) {
        await ledger.change((data, log) => { const t = data.transfers[prep.t.id]; t.state = "failed"; t.timeline.push({ at: iso(), state: "failed" }); log("transfer.failed", { ref: t.id, why: "charge" }); });
        fail("charge_failed", "The payment didn't go through.", 402);
      }
      await ledger.change((data) => { data.transfers[prep.t.id].payin = { intentId: pi.id, status: pi.status }; });
      if (pi.status === "REQUIRES_CUSTOMER_ACTION") {
        await ledger.change((data) => { data.sessions[pi.nextAction.ref] = { kind: "sca", by: me.by, transferId: prep.t.id, intentId: pi.id, at: iso() }; });
        return { id: prep.t.id, state: "charging", next: pi.nextAction.url };
      }
      await charged(prep.t.id, pi.id);
    } else {
      await convertFor(prep.t.id);
    }
    return { id: prep.t.id, state: "waiting" };
  }

  async function charged(transferId, intentId) {
    await ledger.change((data, log) => {
      const t = data.transfers[transferId];
      if (!t || t.state !== "charging") return;
      t.payin.status = "SUCCEEDED";
      t.state = "waiting";
      t.timeline.push({ at: iso(), state: "charged" });
      log("transfer.charged", { ref: t.id, intentId });
      const q = t.requestId && data.requests[t.requestId];
      if (q) { q.state = "paid"; q.transferId = t.id; }
    });
    await convertFor(transferId);
  }

  async function convertFor(transferId) {
    const t = await ledger.read((d) => ({ ...d.transfers[transferId] }));
    if (t.sell.currency !== t.buy.currency) {
      const c = await provider.convert({ quoteId: t.quoteId, sell: t.sell.currency, buy: t.buy.currency });
      await ledger.change((data, log) => { data.transfers[transferId].conversionId = c.conversionId; log("transfer.converted", { ref: transferId, conversionId: c.conversionId }); });
    }
    await ledger.change((data) => {
      const tt = data.transfers[transferId];
      const q = tt.requestId && data.requests[tt.requestId];
      if (q && q.state === "open") { q.state = "paid"; q.transferId = tt.id; }
    });
    onChange({ type: "transfer", id: transferId });
  }

  async function paymentFailed(transferId) {
    await ledger.change((data, log) => {
      const t = data.transfers[transferId];
      if (!t || t.state !== "charging") return;
      t.state = "failed"; t.timeline.push({ at: iso(), state: "failed" });
      log("transfer.failed", { ref: t.id, why: "not approved" });
    });
    onChange({ type: "transfer", id: transferId });
  }

  /* ---- accept, decline, cancel, expire ---------------------------------- */

  async function accept(me, id) {
    const plan = await ledger.change((data, log) => {
      const t = data.transfers[id];
      if (!t || t.to !== me.by) fail("not_found", "That payment isn't for you.", 404);
      if (t.state !== "waiting") fail("not_waiting", "That payment can't be accepted now.", 409);
      const w = walletOf(data, me.by);
      if (!w) fail("no_wallet", "Set up your wallet to accept it.", 409);
      const r = REGIONS[w.region];
      const toBank = !r.balance || w.payout === "bank";
      if (toBank && !w.beneficiaryId) fail("no_payout", "Add the bank account money should go to.", 409);
      if (toBank && w.verified !== "verified") fail("not_verified", "Confirm your identity to be paid to your bank.", 409);
      t.timeline.push({ at: iso(), state: "accepted" });
      if (!toBank) {
        w.balance += t.buy.minor;
        t.state = "completed";
        t.payoutTo = "Your wallet";
        t.timeline.push({ at: iso(), state: "completed" });
        log("transfer.accepted", { by: me.by, ref: t.id, to: "wallet" });
        log("balance.credit", { by: me.by, ref: t.id, minor: t.buy.minor, currency: w.currency });
        return null;
      }
      const ben = data.beneficiaries[w.beneficiaryId];
      t.state = "paying_out";
      t.payoutTo = ben.label;
      log("transfer.accepted", { by: me.by, ref: t.id, to: "bank" });
      return { amount: t.buy.minor, currency: t.buy.currency, beneficiaryRef: ben.providerRef, reason: t.reason || t.note || "Payment for services" };
    });
    if (plan) {
      const po = await provider.payout({ amount: plan.amount, currency: plan.currency, beneficiaryId: plan.beneficiaryRef, reason: plan.reason, reference: id });
      await ledger.change((data, log) => {
        const t = data.transfers[id];
        t.payout = { payoutId: po.payoutId, status: po.status };
        t.timeline.push({ at: iso(), state: po.status === "IN_REVIEW" ? "in_review" : "paying_out" });
        log("payout.created", { ref: id, payoutId: po.payoutId, status: po.status });
      });
    }
    onChange({ type: "transfer", id });
    return true;
  }

  /** Send back everything the payer was charged. */
  async function giveBack(id, finalState, by) {
    const t = await ledger.change((data, log) => {
      const t = data.transfers[id];
      if (!t || t.state !== "waiting") fail("not_waiting", "That payment can't be returned now.", 409);
      t.state = finalState;
      t.timeline.push({ at: iso(), state: finalState });
      if (t.sourceKind === "wallet") {
        const w = data.wallets[t.from];
        w.balance += t.total;
        log("balance.credit", { by: t.from, ref: t.id, minor: t.total, currency: t.sell.currency, why: finalState });
      }
      log(`transfer.${finalState}`, { by, ref: t.id });
      const q = t.requestId && data.requests[t.requestId];
      if (q && q.transferId === t.id) { q.state = "open"; q.transferId = ""; }
      return { ...t };
    });
    if (t.sourceKind !== "wallet" && t.payin.intentId) {
      const rf = await provider.refund({ intentId: t.payin.intentId, amount: t.total, currency: t.sell.currency });
      await ledger.change((data, log) => { data.transfers[id].refund = { refundId: rf.refundId, status: rf.status }; log("transfer.refunded", { ref: id, refundId: rf.refundId }); });
    }
    onChange({ type: "transfer", id });
    return true;
  }

  async function decline(me, id) {
    const t = await ledger.read((d) => d.transfers[id]);
    if (!t || t.to !== me.by) fail("not_found", "That payment isn't for you.", 404);
    return giveBack(id, "declined", me.by);
  }
  async function cancel(me, id) {
    const t = await ledger.read((d) => d.transfers[id]);
    if (!t || t.from !== me.by) fail("not_found", "That payment isn't yours.", 404);
    return giveBack(id, "cancelled", me.by);
  }
  async function expireDue() {
    const due = await ledger.read((d) => Object.values(d.transfers).filter((t) => t.state === "waiting" && Date.parse(t.expiresAt) <= now()).map((t) => t.id));
    for (const id of due) await giveBack(id, "returned", "system").catch(() => {});
    return due.length;
  }

  /* ---- requests --------------------------------------------------------- */

  async function createRequest(me, { toMemberId, amount, note, room }) {
    const person = personById(toMemberId);
    if (person.by === me.by) fail("self", "You can't request money from yourself.");
    return ledger.change((data, log) => {
      const w = needWallet(data, me);
      const minor = toMinor(amount, w.currency);
      if (!minor) fail("bad_amount", "Enter an amount.");
      const noteText = String(note || "").trim().slice(0, 60);
      if (noteText.length < 2) fail("note_required", "Say what it's for.");
      const q = { id: newId("rq"), from: me.by, to: person.by, amount: minor, currency: w.currency, note: noteText, room: String(room || "").slice(0, 40), state: "open", createdAt: iso() };
      data.requests[q.id] = q;
      log("request.created", { by: me.by, ref: q.id, to: person.by, minor, currency: w.currency });
      return requestLine(me, q);
    });
  }
  async function requestAction(me, id, action) {
    return ledger.change((data, log) => {
      const q = data.requests[id];
      if (!q) fail("not_found", "That request has gone.", 404);
      if (action === "decline" && q.to !== me.by) fail("not_found", "That request isn't to you.", 404);
      if (action === "cancel" && q.from !== me.by) fail("not_found", "That request isn't yours.", 404);
      if (q.state !== "open") fail("not_open", "That request is already settled.", 409);
      q.state = action === "decline" ? "declined" : "cancelled";
      log(`request.${q.state}`, { by: me.by, ref: id });
      return requestLine(me, q);
    });
  }
  /** The quote for paying a request: the requested amount is what arrives. */
  async function quoteRequest(me, id, sourceId) {
    const q = await ledger.read((d) => d.requests[id]);
    if (!q || q.to !== me.by) fail("not_found", "That request isn't to you.", 404);
    if (q.state !== "open") fail("not_open", "That request is already settled.", 409);
    const requester = people.byHash(q.from);
    const out = await quote(me, { toMemberId: requester.id, receive: q.amount, sourceId, requestId: q.id });
    return { ...out, note: q.note };
  }

  /* ---- add money and withdraw ------------------------------------------- */

  async function topup(me, { amount, sourceId, returnUrl }) {
    const prep = await ledger.change((data, log) => {
      const w = needWallet(data, me, { verified: true });
      if (!REGIONS[w.region].balance) fail("no_balance_here", "Wallets in mainland China don't hold a balance.");
      const minor = toMinor(amount, w.currency);
      if (!minor) fail("bad_amount", "Enter an amount.");
      const s = data.sources[sourceId];
      if (!s || s.by !== me.by) fail("bad_source", "Choose a card or bank.");
      const fee = bps(minor, FEES[s.kind] ?? 0);
      const t = { id: newId("tu"), by: me.by, amount: minor, fee, total: minor + fee, currency: w.currency, sourceId: s.id, sourceLabel: s.label, state: "charging", createdAt: iso(), timeline: [{ at: iso(), state: "started" }] };
      data.topups[t.id] = t;
      log("topup.created", { by: me.by, ref: t.id, minor, currency: w.currency });
      return { t, sourceRef: s.providerRef, sca: REGIONS[w.region].sca && s.kind === "card" };
    });
    const pi = await provider.createPaymentIntent({ amount: prep.t.total, currency: prep.t.currency, sourceRef: prep.sourceRef, requireSca: prep.sca, returnUrl });
    await ledger.change((data) => { data.topups[prep.t.id].intentId = pi.id; });
    if (pi.status === "REQUIRES_CUSTOMER_ACTION") {
      await ledger.change((data) => { data.sessions[pi.nextAction.ref] = { kind: "sca", by: me.by, topupId: prep.t.id, intentId: pi.id, at: iso() }; });
      return { id: prep.t.id, state: "charging", next: pi.nextAction.url };
    }
    await toppedUp(prep.t.id, true);
    return { id: prep.t.id, state: "completed" };
  }
  async function toppedUp(id, ok) {
    await ledger.change((data, log) => {
      const t = data.topups[id];
      if (!t || t.state !== "charging") return;
      if (!ok) { t.state = "failed"; t.timeline.push({ at: iso(), state: "failed" }); log("topup.failed", { ref: id }); return; }
      t.state = "completed"; t.timeline.push({ at: iso(), state: "completed" });
      data.wallets[t.by].balance += t.amount;
      log("balance.credit", { by: t.by, ref: id, minor: t.amount, currency: t.currency, why: "topup" });
    });
    onChange({ type: "topup", id });
  }

  async function withdraw(me, { amount }) {
    const prep = await ledger.change((data, log) => {
      const w = needWallet(data, me, { verified: true });
      if (!w.beneficiaryId) fail("no_payout", "Add a bank account to withdraw to.", 409);
      const minor = toMinor(amount, w.currency);
      if (!minor) fail("bad_amount", "Enter an amount.");
      if (minor > w.balance) fail("balance", "That's more than your balance.", 409);
      w.balance -= minor;
      const ben = data.beneficiaries[w.beneficiaryId];
      const x = { id: newId("wd"), by: me.by, amount: minor, currency: w.currency, to: ben.label, state: "processing", createdAt: iso(), timeline: [{ at: iso(), state: "started" }] };
      data.withdrawals[x.id] = x;
      log("withdrawal.created", { by: me.by, ref: x.id, minor, currency: w.currency });
      log("balance.debit", { by: me.by, ref: x.id, minor, currency: w.currency, why: "withdraw" });
      return { x, beneficiaryRef: ben.providerRef };
    });
    const po = await provider.payout({ amount: prep.x.amount, currency: prep.x.currency, beneficiaryId: prep.beneficiaryRef, reason: "Withdrawal to own account", reference: prep.x.id });
    await ledger.change((data) => { data.withdrawals[prep.x.id].payout = { payoutId: po.payoutId, status: po.status }; });
    onChange({ type: "withdrawal", id: prep.x.id });
    return { id: prep.x.id, state: "processing" };
  }

  /* ---- provider events -------------------------------------------------- */

  async function onProviderEvent(e) {
    if (e.type === "account.status") {
      await ledger.change((data, log) => {
        const w = Object.values(data.wallets).find((x) => x.accountId === e.accountId);
        if (!w) return;
        w.verified = e.status === "ACTIVE" ? "verified" : e.status === "SUBMITTED" ? "pending" : "none";
        log("verify.status", { by: w.by, status: w.verified });
      });
    } else if (e.type === "source.connected") {
      await ledger.change((data, log) => {
        const w = Object.values(data.wallets).find((x) => x.accountId === e.accountId);
        if (!w) return;
        const mine = Object.values(data.sources).filter((s) => s.by === w.by);
        if (mine.some((s) => s.providerRef === e.source.providerRef)) return;
        const id = newId("src");
        data.sources[id] = { id, by: w.by, kind: e.source.kind, label: e.source.label, providerRef: e.source.providerRef, default: !mine.length, createdAt: iso() };
        log("source.connected", { by: w.by, ref: id, kind: e.source.kind });
      });
    } else if (e.type === "payment.status") {
      const s = await ledger.read((d) => Object.values(d.sessions).find((x) => x.intentId === e.intentId));
      if (!s) return;
      if (s.transferId) { if (e.status === "SUCCEEDED") await charged(s.transferId, e.intentId); else await paymentFailed(s.transferId); }
      if (s.topupId) await toppedUp(s.topupId, e.status === "SUCCEEDED");
    } else if (e.type === "payout.status") {
      await ledger.change((data, log) => {
        const t = Object.values(data.transfers).find((x) => x.payout?.payoutId === e.payoutId);
        const x = t || Object.values(data.withdrawals).find((w) => w.payout?.payoutId === e.payoutId);
        if (!x) return;
        x.payout.status = e.status;
        const step = { IN_REVIEW: "in_review", PROCESSING: "paying_out", PAID: "completed", FAILED: "payout_failed" }[e.status];
        if (step && x.timeline[x.timeline.length - 1].state !== step) x.timeline.push({ at: iso(), state: step });
        if (e.status === "PAID") x.state = "completed";
        if (e.status === "FAILED") x.state = "payout_failed";
        log("payout.status", { ref: x.id, status: e.status });
      });
    }
    onChange({ type: "provider", event: e.type });
  }

  /* ---- lists ------------------------------------------------------------ */

  async function activity(me) {
    return ledger.read((data) => {
      const w = walletOf(data, me.by);
      const rows = [
        ...Object.values(data.transfers).filter((t) => (t.from === me.by || t.to === me.by) && t.state !== "failed").map((t) => lineFor(data, me, t)),
        ...Object.values(data.topups).filter((t) => t.by === me.by && t.state !== "failed").map((t) => ({ kind: "topup", id: t.id, direction: "in", state: t.state, at: t.createdAt,
          amount: { minor: t.amount, currency: t.currency, text: format(t.amount, t.currency) }, sourceLabel: t.sourceLabel, fee: { text: t.fee ? format(t.fee, t.currency) : "" }, timeline: t.timeline })),
        ...Object.values(data.withdrawals).filter((x) => x.by === me.by).map((x) => ({ kind: "withdrawal", id: x.id, direction: "out", state: x.state, at: x.createdAt,
          amount: { minor: x.amount, currency: x.currency, text: format(x.amount, x.currency) }, payoutTo: x.to, timeline: x.timeline })),
        ...Object.values(data.requests).filter((q) => q.from === me.by || q.to === me.by).map((q) => requestLine(me, q)),
      ];
      rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
      return { currency: w?.currency || "", rows };
    });
  }

  async function detail(me, kind, id) {
    const { rows } = await activity(me);
    return rows.find((r) => r.kind === kind && r.id === id) || fail("not_found", "Not found.", 404);
  }

  /** Money cards in one room — only the ones this reader is part of. Two
   *  people's payment is nobody else's business, including in a room of
   *  two hundred. */
  async function roomCards(me, room) {
    const { rows } = await activity(me);
    return rows.filter((r) => r.room === room && (r.kind === "transfer" || r.kind === "request"));
  }

  async function report(me, { ref, reason, text }) {
    return ledger.change((data, log) => {
      const id = newId("rp");
      data.reports[id] = { id, by: me.by, ref: String(ref || "").slice(0, 40), reason: String(reason || "").slice(0, 80), text: String(text || "").slice(0, 600), at: iso(), state: "open" };
      log("report.created", { by: me.by, ref: id, about: data.reports[id].ref });
      return { id };
    });
  }

  async function close(me) {
    return ledger.change((data, log) => {
      const w = needWallet(data, me);
      if (w.balance > 0) fail("balance_left", "Withdraw your balance first.", 409);
      const busy = Object.values(data.transfers).some((t) => (t.from === me.by || t.to === me.by) && ["charging", "waiting", "paying_out"].includes(t.state));
      if (busy) fail("busy", "Wait for payments in progress to finish.", 409);
      w.status = "closed"; w.closedAt = iso();
      for (const s of Object.values(data.sources)) if (s.by === me.by) delete data.sources[s.id];
      log("wallet.closed", { by: me.by });
      return true;
    });
  }

  async function sessionFor(ref) { return ledger.read((d) => d.sessions[ref] || null); }

  provider.onEvent((e) => { onProviderEvent(e).catch((err) => console.error("wallet event", e.type, err.message)); });

  return {
    state, setup, startVerify, startConnect, removeSource, setDefaultSource, setPayout,
    quote, send, accept, decline, cancel, expireDue,
    createRequest, requestAction, quoteRequest, topup, withdraw,
    activity, detail, roomCards, report, close, sessionFor, onProviderEvent,
  };
}
