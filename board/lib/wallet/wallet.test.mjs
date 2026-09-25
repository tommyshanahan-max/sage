// The wallet's rules, tested end to end against the stand-in provider.
//
//   node --test board/lib/wallet/
//
// The two payments the design was drawn around are here as whole stories —
// Finland to Australia, Finland to mainland China — plus every way money comes
// back, because the refund paths are where a wallet loses money quietly.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { openLedger } from "./ledger.js";
import { createMockProvider } from "./providers/mock.js";
import { createWalletService, WalletError } from "./service.js";
import { toMinor, toMajor, format, convert, bps } from "./money.js";

const PEOPLE = [
  { id: "a".repeat(20), by: "h_finn", handle: "Mikko" },
  { id: "b".repeat(20), by: "h_aus", handle: "Mia" },
  { id: "c".repeat(20), by: "h_cn", handle: "Wei" },
  { id: "d".repeat(20), by: "h_new", handle: "Noor" },
];
const people = { byId: (id) => PEOPLE.find((p) => p.id === id) || null, byHash: (h) => PEOPLE.find((p) => p.by === h) || null };
const [finn, aus, cn, newbie] = PEOPLE;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function world() {
  const dir = await mkdtemp(path.join(tmpdir(), "wallet-"));
  const ledger = openLedger(dir);
  const provider = createMockProvider({ speed: 0.01 });
  let clock = Date.now();
  const svc = createWalletService({ ledger, provider, people, now: () => clock });
  const approveNext = async (url) => { const ref = url.split("/").pop(); await provider.completeSession(ref, true); await wait(30); };
  async function ready(p, region, { verify = true, card = false, bank = null } = {}) {
    await svc.setup(p, { region, acceptedTerms: true });
    if (verify) await approveNext((await svc.startVerify(p, "/wallet")).url);
    if (card) await approveNext((await svc.startConnect(p, "card", "/wallet")).url);
    if (bank) await svc.setPayout(p, { mode: "bank", details: bank });
  }
  return { dir, ledger, provider, svc, approveNext, ready, tick: (ms) => { clock += ms; }, done: () => rm(dir, { recursive: true, force: true }) };
}

test("money is whole cents, and refuses what it cannot read", () => {
  assert.equal(toMinor("12.5", "EUR"), 1250);
  assert.equal(toMinor("0.01", "EUR"), 1);
  assert.equal(toMinor("1,000", "EUR"), null);
  assert.equal(toMinor("1.234", "EUR"), null);
  assert.equal(toMinor("0", "EUR"), null);
  assert.equal(toMajor(123456, "AUD"), "1234.56");
  assert.equal(format(123456, "HKD"), "HK$1,234.56");
  assert.equal(bps(10000, 290), 290);
  assert.equal(convert(999999999900, 7.81, "EUR", "CNY"), 7809999999219);
});

test("Finland to Australia: charged by card with the bank's approval, accepted into the wallet", async () => {
  const w = await world();
  try {
    await w.ready(finn, "FI", { card: true });
    await w.ready(aus, "AU");
    const st = await w.svc.state(finn);
    assert.equal(st.wallet.verified, "verified");
    const card = st.wallet.sources.find((s) => s.kind === "card");
    assert.ok(card, "card connected");

    const q = await w.svc.quote(finn, { toMemberId: aus.id, amount: "200", sourceId: card.id });
    assert.equal(q.send.text, "€200.00");
    assert.equal(q.fee.text, "€5.80");
    assert.equal(q.total.text, "€205.80");
    assert.match(q.receive.text, /^A\$\d/);
    assert.equal(q.reasonRequired, false);

    const sent = await w.svc.send(finn, { quoteId: q.quoteId, note: "Script read-through", returnUrl: "/wallet" });
    assert.equal(sent.state, "charging", "European card asks the bank first");
    assert.ok(sent.next);
    await w.approveNext(sent.next);

    let inbox = await w.svc.state(aus);
    assert.equal(inbox.wallet.incoming.length, 1);
    assert.equal(inbox.wallet.incoming[0].amount.text, q.receive.text);

    await w.svc.accept(aus, sent.id);
    inbox = await w.svc.state(aus);
    assert.equal(inbox.wallet.balance.text, q.receive.text);
    const line = await w.svc.detail(finn, "transfer", sent.id);
    assert.equal(line.state, "completed");
    assert.deepEqual(line.timeline.map((x) => x.state), ["sent", "charged", "accepted", "completed"]);
    assert.equal(await w.ledger.verify(), null, "event log intact");
  } finally { await w.done(); }
});

test("Finland to mainland China: needs a reason, goes to the bank, sits in review, then paid", async () => {
  const w = await world();
  try {
    await w.ready(finn, "FI", { card: true });
    await w.ready(cn, "CN", { bank: { accountName: "Wang Wei", bankName: "China Merchants Bank", accountNumber: "6225 8812 3456 7890" } });
    const cnState = await w.svc.state(cn);
    assert.equal(cnState.wallet.holdsBalance, false);
    assert.equal(cnState.wallet.payout, "bank");
    assert.match(cnState.wallet.payoutLabel, /7890$/);

    const card = (await w.svc.state(finn)).wallet.sources[0];
    const q = await w.svc.quote(finn, { toMemberId: cn.id, amount: "300", sourceId: card.id });
    assert.equal(q.reasonRequired, true);
    await assert.rejects(w.svc.send(finn, { quoteId: q.quoteId, reason: "" }), (e) => e instanceof WalletError && e.code === "reason_required");

    const q2 = await w.svc.quote(finn, { toMemberId: cn.id, amount: "300", sourceId: card.id });
    const sent = await w.svc.send(finn, { quoteId: q2.quoteId, reason: "Consulting fee", returnUrl: "/wallet" });
    await w.approveNext(sent.next);
    await w.svc.accept(cn, sent.id);
    let d = await w.svc.detail(cn, "transfer", sent.id);
    assert.equal(d.state, "paying_out");
    assert.equal(d.timeline.at(-1).state, "in_review");
    await wait(200);
    d = await w.svc.detail(cn, "transfer", sent.id);
    assert.equal(d.state, "completed");
    assert.ok(d.timeline.some((x) => x.state === "in_review"));
  } finally { await w.done(); }
});

test("declined, cancelled and expired payments give back every cent, fee included", async () => {
  const w = await world();
  try {
    await w.ready(aus, "AU");
    await w.ready(finn, "FI", { card: true });
    // Top up Mia's wallet so she can pay from a balance.
    const hk = await w.svc.state(aus);
    await w.approveNext((await w.svc.startConnect(aus, "card", "/wallet")).url);
    const card = (await w.svc.state(aus)).wallet.sources[0];
    const top = await w.svc.topup(aus, { amount: "500", sourceId: card.id, returnUrl: "/wallet" });
    assert.equal(top.state, "completed", "Australian cards don't need the extra approval here");
    assert.equal((await w.svc.state(aus)).wallet.balance.text, "A$500.00");
    assert.ok(hk.wallet);

    const pay = async () => {
      const q = await w.svc.quote(aus, { toMemberId: finn.id, amount: "100", sourceId: "wallet" });
      return w.svc.send(aus, { quoteId: q.quoteId, note: "Dinner" });
    };
    const a = await pay();
    assert.equal((await w.svc.state(aus)).wallet.balance.text, "A$400.00");
    await w.svc.decline(finn, a.id);
    assert.equal((await w.svc.state(aus)).wallet.balance.text, "A$500.00", "declined: back");

    const b = await pay();
    await w.svc.cancel(aus, b.id);
    assert.equal((await w.svc.state(aus)).wallet.balance.text, "A$500.00", "cancelled: back");

    const c = await pay();
    w.tick(25 * 3600 * 1000);
    assert.equal(await w.svc.expireDue(), 1);
    assert.equal((await w.svc.state(aus)).wallet.balance.text, "A$500.00", "expired: back");
    assert.equal((await w.svc.detail(aus, "transfer", c.id)).state, "returned");

    await assert.rejects(w.svc.accept(finn, c.id), (e) => e.code === "not_waiting");
  } finally { await w.done(); }
});

test("a card payment the bank refuses is marked failed and nothing is held", async () => {
  const w = await world();
  try {
    await w.ready(finn, "FI", { card: true });
    await w.ready(aus, "AU");
    const card = (await w.svc.state(finn)).wallet.sources[0];
    const q = await w.svc.quote(finn, { toMemberId: aus.id, amount: "50", sourceId: card.id });
    const sent = await w.svc.send(finn, { quoteId: q.quoteId, returnUrl: "/wallet" });
    await w.provider.completeSession(sent.next.split("/").pop(), false);
    await wait(30);
    const d = await w.svc.activity(finn);
    assert.equal(d.rows.find((r) => r.id === sent.id), undefined, "failed payments don't clutter activity");
    assert.equal((await w.svc.state(aus)).wallet.incoming.length, 0);
  } finally { await w.done(); }
});

test("requests: the requested amount is what arrives, and paying settles the request", async () => {
  const w = await world();
  try {
    await w.ready(aus, "AU");
    await w.ready(finn, "FI", { card: true });
    const r = await w.svc.createRequest(aus, { toMemberId: finn.id, amount: "80", note: "Bond terms read-through", room: "film" });
    const card = (await w.svc.state(finn)).wallet.sources[0];
    const q = await w.svc.quoteRequest(finn, r.id, card.id);
    assert.equal(q.receive.text, "A$80.00");
    const sent = await w.svc.send(finn, { quoteId: q.quoteId, room: "film", returnUrl: "/wallet" });
    await w.approveNext(sent.next);
    const req = (await w.svc.activity(aus)).rows.find((x) => x.kind === "request" && x.id === r.id);
    assert.equal(req.state, "paid");
    const cards = await w.svc.roomCards(finn, "film");
    assert.equal(cards.length, 2, "Mikko sees the request and his payment in the room");
    assert.equal((await w.svc.roomCards(newbie, "film")).length, 0, "nobody else sees them");
  } finally { await w.done(); }
});

test("the rules that say no", async () => {
  const w = await world();
  try {
    await w.ready(finn, "FI", { verify: false });
    await w.ready(aus, "AU");
    await assert.rejects(w.svc.quote(finn, { toMemberId: aus.id, amount: "10" }), (e) => e.code === "not_verified");
    await assert.rejects(w.svc.setup(finn, { region: "FI", acceptedTerms: true }), (e) => e.code === "exists");
    await assert.rejects(w.svc.setup(newbie, { region: "XX", acceptedTerms: true }), (e) => e.code === "bad_region");
    await w.ready(newbie, "HK");
    await assert.rejects(w.svc.quote(aus, { toMemberId: aus.id, amount: "10" }), (e) => e.code === "self");
    await assert.rejects(w.svc.quote(aus, { toMemberId: newbie.id, amount: "10", sourceId: "wallet" }).then((q) => w.svc.send(aus, { quoteId: q.quoteId })), (e) => e.code === "balance");
    /* A FULL AUSTRALIAN WIRE WITH ONE BAD FIELD. It used to send a name, a
       BSB and an account number, which was the whole Australian form back
       when a payout to Australia was treated as a domestic payment. It is a
       wire out of China now, so the bank and the SWIFT are needed too — and
       without them this failed on the missing bank name and never reached
       the assertion it was written for. */
    const auWire = { accountName: "Mia", bankName: "CBA", swift: "CTBAAU2S", bsb: "063000", accountNumber: "12345678", address: "12 Smith St, Melbourne" };
    await assert.rejects(w.svc.setPayout(aus, { mode: "bank", details: { ...auWire, bsb: "12" } }), (e) => e.code === "bank_bsb");
    /* THE SWIFT IS THE ONE THIS WHOLE BRANCH EXISTS FOR. An Australian
       account was once offered no SWIFT field at all, on a payment that
       cannot be sent without one. A test so it cannot quietly come back. */
    await assert.rejects(w.svc.setPayout(aus, { mode: "bank", details: { ...auWire, swift: "" } }), (e) => e.code === "bank_swift");
    /* And the address, which is what a correspondent bank screens on. */
    await assert.rejects(w.svc.setPayout(aus, { mode: "bank", details: { ...auWire, address: "" } }), (e) => e.code === "bank_address");
    await assert.rejects(w.svc.setPayout(cn, { mode: "wallet" }), (e) => e.code === "no_wallet");
    await w.ready(cn, "CN");
    await assert.rejects(w.svc.setPayout(cn, { mode: "wallet" }), (e) => e.code === "no_balance_here");
    await assert.rejects(w.svc.close(aus).then(() => w.svc.close(aus)), (e) => e.code === "no_wallet");
  } finally { await w.done(); }
});

test("a quote cannot be used twice or after it expires", async () => {
  const w = await world();
  try {
    await w.ready(aus, "AU", { card: true });
    await w.ready(newbie, "HK");
    const card = (await w.svc.state(aus)).wallet.sources[0];
    const q = await w.svc.quote(aus, { toMemberId: newbie.id, amount: "10", sourceId: card.id });
    await w.svc.send(aus, { quoteId: q.quoteId });
    await assert.rejects(w.svc.send(aus, { quoteId: q.quoteId }), (e) => e.code === "quote_used");
    const q2 = await w.svc.quote(aus, { toMemberId: newbie.id, amount: "10", sourceId: card.id });
    w.tick(11 * 60 * 1000);
    await assert.rejects(w.svc.send(aus, { quoteId: q2.quoteId }), (e) => e.code === "quote_expired");
  } finally { await w.done(); }
});

/* A CONNECTED STRIPE ACCOUNT IS THE THIRD ANSWER TO "WHERE DOES IT GO".
 *
 * It was the third answer with nowhere to go: the OAuth handshake finished,
 * we learned the acct_, and it went into a cookie. Somebody could authorise
 * us on Stripe's own page and come back to a screen that still said nothing
 * was chosen. These are the rules that make the answer stick.
 *
 * None of this touches the provider. That is the point of it — a connected
 * account needs no beneficiary and no wire, because the charge is raised on
 * the account and the money is already there.
 */
test("a connected Stripe account is remembered, and labelled by its tail", async () => {
  const w = await world();
  try {
    await w.ready(aus, "AU");
    const out = await w.svc.setPayout(aus, { mode: "stripe", details: { account: "acct_1PartnerXYZ" } });
    assert.equal(out.label, "Stripe ···· rXYZ");
    const st = await w.svc.state(aus);
    assert.equal(st.wallet.payout, "stripe");
    assert.equal(st.wallet.payoutLabel, "Stripe ···· rXYZ");
  } finally { await w.done(); }
});

test("anything that is not an account id is refused before it is written", async () => {
  const w = await world();
  try {
    await w.ready(aus, "AU");
    for (const bad of ["", "acct_", "sk_live_nope", "acct_1;DROP", "1PartnerXYZ"]) {
      await assert.rejects(
        () => w.svc.setPayout(aus, { mode: "stripe", details: { account: bad } }),
        (e) => e instanceof WalletError && e.code === "bad_account",
        `should have refused ${JSON.stringify(bad)}`,
      );
    }
    const st = await w.svc.state(aus);
    assert.notEqual(st.wallet.payout, "stripe");
  } finally { await w.done(); }
});

test("connecting Stripe does not throw away a bank account already saved", async () => {
  const w = await world();
  try {
    await w.ready(aus, "AU", { bank: {
      accountName: "Mia Example", bankName: "Big Bank", swift: "BIGBAU2S",
      bsb: "062000", accountNumber: "12345678", address: "1 Test St, Sydney",
    } });
    const before = (await w.svc.state(aus)).wallet.payoutLabel;
    assert.ok(before, "the bank should have a label to begin with");
    await w.svc.setPayout(aus, { mode: "stripe", details: { account: "acct_1PartnerXYZ" } });
    // Switching back must not mean typing the whole wire out again.
    const back = await w.svc.setPayout(aus, { mode: "bank", details: {
      accountName: "Mia Example", bankName: "Big Bank", swift: "BIGBAU2S",
      bsb: "062000", accountNumber: "12345678", address: "1 Test St, Sydney",
    } });
    assert.ok(back.label);
    assert.equal((await w.svc.state(aus)).wallet.payout, "bank");
  } finally { await w.done(); }
});
