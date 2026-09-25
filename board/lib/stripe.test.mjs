// WHICH CHARGE GETS RAISED, AND THEREFORE WHO CARRIES THE LOSS.
//
//   node --test lib/stripe.test.mjs
//
// The difference between a destination charge and a direct one is a header
// and a block of body — small enough to get wrong in a merge and large
// enough that getting it wrong makes this platform liable for a company it
// has never audited, or takes the partner's name off his own client's
// statement. Neither failure shows up on a screen.
//
// NOTHING REACHES STRIPE. fetch is replaced, so these read what the request
// WOULD have been. That is the whole question here: the answer Stripe gives
// is not in doubt, the request is.
//
// The key is set before the import because lib/stripe.js reads it once at
// module load — see KEY there.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.BOARD_STRIPE_KEY = "sk_test_forthetest";
const stripe = await import("./stripe.js");

/** Run one checkout against a stubbed fetch and hand back what it sent. */
async function sent(opts) {
  let seen = null;
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    seen = { url, headers: init.headers, body: new URLSearchParams(String(init.body)) };
    return { ok: true, status: 200, text: async () => JSON.stringify({ client_secret: "cs_test" }) };
  };
  try {
    await stripe.checkout({
      amount: 40000, currency: "eur", fee: 800, method: "card",
      ref: "g:1", done: "https://example.test/done", label: "Fee",
      ...opts,
    });
  } finally { globalThis.fetch = real; }
  return seen;
}

test("a destination charge transfers on, and is raised on our own account", async () => {
  const r = await sent({ destination: "acct_member" });
  assert.equal(r.body.get("payment_intent_data[transfer_data][destination]"), "acct_member");
  assert.equal(r.body.get("payment_intent_data[application_fee_amount]"), "800");
  // No Stripe-Account: the charge belongs to the platform, which is exactly
  // what makes the platform the merchant of record.
  assert.equal(r.headers["Stripe-Account"], undefined);
});

test("a direct charge is raised on their account and transfers nothing", async () => {
  const r = await sent({ direct: "acct_partner" });
  assert.equal(r.headers["Stripe-Account"], "acct_partner");
  // The fee still comes off the top — this is the whole reason direct
  // charges are a choice here rather than a sacrifice.
  assert.equal(r.body.get("payment_intent_data[application_fee_amount]"), "800");
  // And nothing is transferred, because the money never left their account.
  assert.equal(r.body.get("payment_intent_data[transfer_data][destination]"), null);
});

test("no fee means no application_fee_amount on a direct charge", async () => {
  const r = await sent({ direct: "acct_partner", fee: 0 });
  assert.equal(r.headers["Stripe-Account"], "acct_partner");
  assert.equal(r.body.get("payment_intent_data[application_fee_amount]"), null);
});

test("the shop's own sale is neither, and carries no fee block at all", async () => {
  const r = await sent({ fee: 0 });
  assert.equal(r.headers["Stripe-Account"], undefined);
  assert.equal(r.body.get("payment_intent_data[transfer_data][destination]"), null);
  assert.equal(r.body.get("payment_intent_data[application_fee_amount]"), null);
});

test("both at once is refused here rather than by Stripe later", async () => {
  await assert.rejects(
    () => stripe.checkout({
      amount: 100, currency: "eur", fee: 0, method: "card", ref: "x", done: "https://x.test",
      destination: "acct_a", direct: "acct_b",
    }),
    /two answers to one question/,
  );
});

test("the amount, the currency and the reference are untouched by the choice", async () => {
  for (const opts of [{ destination: "acct_a" }, { direct: "acct_b" }]) {
    const r = await sent(opts);
    assert.equal(r.body.get("line_items[0][price_data][unit_amount]"), "40000");
    assert.equal(r.body.get("line_items[0][price_data][currency]"), "eur");
    assert.equal(r.body.get("client_reference_id"), "g:1");
  }
});
