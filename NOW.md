# Where things stand

**Read this first, before proposing anything.** `docs/todo.md` says what needs
doing; this says what is already true, and who is being waited on. It exists
because a session proposed rehearsing a payment flow that had been watched
finish on a phone the day before — written down in `DEALIO.md`, unread.

One screen. Dated lines. Delete what stops being true rather than striking it
through, and add the date to anything that changes.

---

## Waiting on other people

| | |
|---|---|
| **Airwallex — the account** | **REJECTED, 21 Sep.** "Unable to support your account at this time. After careful review, this decision is final." No reason given. Business verification had passed; this is the activation decision, and it came four hours after Ian was told the timing was tight. Stripe declined the same week, 20 Sep, also inside a day, also on risk. |
| **Airwallex — Connected Accounts** | Moot now. Raised in their chat, routed to Ian, then **parked on purpose**: it is the reps-with-storefronts product, and describing it means describing the goods business. Revisit once the base account is live and has volume. |
| **Airwallex — the goods business** | Not disclosed yet. Deliberate. To be raised with Ian **before** anything from the shop runs through the account. |
| **Stripe** | **DECLINED at application, 20 Sep** — "too high risk", inside a day. There was never an account: nothing was onboarded, nothing was terminated, and there is no chargeback history or MATCH listing behind it. This file said "closed the account" and that was wrong; a session repeated it into an email to a prospective partner before Tom caught it. The distinction is the whole thing in payments — a decline is a category judgement on an individual applying for cross-border China, a termination is a verdict on how you traded. |

## Dealio — the payment half, on `paydealio.com`

Its own hostname, same board container behind it (`docker/sites/dealio.caddy`),
and its own words on the door — a payer arriving to get paid has never heard of
the board. Payment links are `paydealio.com/pay/…`. Inert unless
`TOMSCODING_DEALIO_DOMAIN` is set in `.env` on the box.


### The chain

The whole chain was **watched finish on 20 September 2026**: request minted
from a terminal, link opened in WeChat on a phone, PAY, WeChat Pay, a real
Airwallex code long-pressed, paid on Airwallex's side, and the row went green
with nothing of ours looking at it. `make pay-check` counted it.

So the only untested thing is **real money**, and it is one line:
`BOARD_WALLET_AIRWALLEX_SANDBOX=0`, which `make airwallex-keys … LIVE=1`
writes when the live pair exists.

**Airwallex is gone, sandbox included (21 Sep, evening).** `make wallet-why`
on the box:

```
provider: airwallex
base: https://api.sandbox.airwallex.com (sandbox)
FAILED: airwallex login 403: <!doctype html>…<title>403</title>
```

An **HTML** 403, not a JSON one. Their API answers bad credentials with JSON;
a served 403 page means the request never reached the API — the edge turned
it away. So this is not the missing-keys problem it was this morning, and
**a fresh sandbox pair will meet the same page.** Either the termination took
sandbox access with it or the box's IP is blocked. `airwallex.check.mjs` now
says so itself rather than leaving an HTML tag to be interpreted.

**Run, and it settles it.** The same POST from the box with **no credentials
at all** comes back `HTTP 403` and the same HTML page. A request carrying no
keys cannot be refused *for its keys* — so the box is blocked at Airwallex's
edge, and no pair of keys will ever get through from this machine. Airwallex
is finished here in every sense: live, sandbox, and any future application
from this IP.

**So no request draws a code**, and the next real one comes from QFPay,
Pockyt or Adyen rather than from Airwallex. Adyen does self-serve test
accounts (adyen.com/signup, Test Mode, Developers → API Credentials) — but
the lesson of `airwallex.js` is to ask whether they will onboard a payment
facilitator *before* writing the adapter, not after.

Money **out** to other people is not built and refuses on purpose: local CNY
payouts are documented only for goods trade with declarant and order data. See
note 2 at the top of `board/lib/wallet/providers/airwallex.js`.

## The way through, found 21 Sep, and it is Stripe

**Stripe does WeChat Pay and Alipay for Australian merchants**, switched on
from the dashboard, settling AUD to an Australian bank. The collection
problem this box spent a week on was never a technology problem.

**Dealio was already built for Stripe Connect.** `board/DEALIO.md`: Stripe is
merchant of record on a destination charge, `application_fee_amount`, and the
receiving side needs a Stripe account. Airwallex was the workaround after the
decline, not the plan.

**In Connect, Stripe is the regulated party.** So a sponsor does not need a
payment licence at all — the thing a sponsor has to have is a company with a
Stripe account and trading history. That is a far easier yes than the
licensing question, and it is the question to ask.

**One platform, many connected accounts, no entity per country.** A tutor in
Melbourne gets AUD, an agent in Denver gets USD, a designer in Berlin gets
EUR, each into their own bank, each onboarding themselves. The A$36bn slide
is this, not aspiration. Confirm Stripe's cross-border payout country pairs
before committing.

A NEW COMPANY DOES NOT SOLVE IT. Trading history cannot be transferred,
bought or borrowed — it belongs to the account that earned it. A fresh
Luxembourg SARL is a fresh applicant in a high-risk category and gets the
same decline, €12,000 later. Either use a sponsor's existing account, or
trade the shop as ordinary retail for six to twelve months and build a record
of our own.

**Waiting on:** Daniel and Lee at AGT (Luxembourg) — emailed 21 Sep. The
question that matters is not "do you hold a licence" but "does your company
have a Stripe account with trading history, and would you run a Connect
platform on it". Their deck is tax structuring — SA, SARL, SPF, SCSp, RAIF —
and contains no payments authorisation.

## The app

**Submitted and in Apple's queue, 21 Sep.** `make app-state` reads
`1.0 · WAITING_FOR_REVIEW · build 1 VALID` — submitted before today, nobody
has looked at it yet. Nothing to do but wait.

A second build went up on 21 Sep from `make app-ship`, which turned the seven
Xcode steps into one line. It is not the build under review — build 1 is — and
uploading it changed nothing in flight. It is there if a rejection needs a fix.

**A WARNING ABOUT HOW THIS WAS GOT WRONG.** A session concluded the app had
never been submitted because there were no Apple emails about it in Tom's
Gmail. There are none, and it is submitted anyway: the Apple mail in that
inbox is mostly Laonei's, the other product, in another repo. Absence of
email proves nothing about App Store Connect. `make app-state` asks Apple and
is the only answer worth having.

Web-form only and invisible to the API: App Privacy (the nutrition labels) and
EU trader status. `app/store/FILL-IN.md` lists every field in the order the
site asks.

## The shop

Built and live: catalogue with shelves, cart, checkout, orders, 我的订单,
确认收货, reviews, 问大家, 联系店家 threads, 我的小店 with the rep leaderboard
and 提现, commission accounting, hand-payment lists.

Not built: the AI assistant behind the AI REP ON/OFF switch (the switch stays
hidden until it exists), and the 微店 review import.

Its payments are **not** on Airwallex and must not be until the conversation
above has happened. `aozhoubaba.com` is its domain.

**The shop front is not on that name yet (21 Sep).** `aozhoubaba.com` resolves
to `207.207.210.23/36/50` — not to `45.77.8.166`, where `thexchange.app` and
`crowdfundme.app` point. Until the A record moves, Caddy will ask Let's Encrypt
for a certificate it cannot get, silently and for ever. One line does the rest
once it has: `make shop-open WHO="Tom" NAME="澳洲爸爸汤姆"` checks the handle,
the DNS and the site blocks before it writes anything, then names the shop and
prints the address.

## Mail

| | |
|---|---|
| `mo@thexchange.app` | Porkbun **forward** into `tommyshanahan@gmail.com`. The address on the Airwallex application. |
| `tom@thexchange.app` | Porkbun **mailbox**, free trial, 10GB, renews at US$36/yr. Gmail sends as it through `smtp.porkbun.com:587` with reply-to `mo@`. Mail sent *to* it sits in Porkbun webmail — Gmail dropped POP fetching in January 2026, and an address cannot be a mailbox and a forward at once. |
| `tom@globalpeoplesmedia.com` | Send-as removed from Gmail, 21 Sep. Still receives. |
