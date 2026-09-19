1. Can a platform open connected accounts for private individuals — not businesses — in Australia, and in which other countries?

2. For an individual, which fields and documents does the Accounts API require, and who is responsible for verifying them: Airwallex, or the platform?

3. Will you accept an identity check done by a separate provider (for example Stripe Identity or Sumsub) in place of your own, or must identity be submitted to you field by field?

4. Can a platform pay a private individual in mainland China, into their own Chinese bank account, for a service (tutoring, consulting, freelance work) where there are no goods and no order record?

5. If yes: which transfer method, which purpose code, and which supporting documents are needed for each payout?

6. What per-payout and annual limits apply per recipient in mainland China, and must the payer or the payee be a business?

7. Which of your browser components (Airwallex.js, Drop-in or Elements) can save a card as a reusable payment method for an individual's connected account, without taking a payment at that moment?

8. Can that saved payment method then be charged from our server by confirming a payment intent with its id, and does 3-D Secure still come back as a next action we can show in a frame on our own page?

---

Once sandbox keys exist, put them in `.env` on the box as `TOMSCODING_BOARD_WALLET_AIRWALLEX_CLIENT_ID` and `TOMSCODING_BOARD_WALLET_AIRWALLEX_API_KEY`, then run:

```
ssh root@45.77.8.166 'cd ~/tc && make deploy && docker compose exec board node lib/wallet/providers/airwallex.check.mjs'
```

---

## What Airwallex support answered, 20 September 2026, 02:00–02:20

**All of this came from AirAI, the support chat in the dashboard. It is a bot.
It quotes their documentation and it reads like it knows, and none of it is a
contract or a quote from a person. Every line below is a thing to have
confirmed in writing before it is built on.**

**Connected accounts can be individuals.** "Individual accounts are for
platforms onboarding: sole traders or freelancers, gig economy workers,
service providers operating as individuals." All three onboarding routes —
embedded KYC component, hosted flow, Native API — take Individual as well as
Business. That contradicts the first refusal at the top of
`board/lib/wallet/providers/airwallex.js`, which was written from the docs in
September and says hosted and embedded are business-only. One of the two is
out of date. The refusal stays until a person says otherwise.

**The FX answer is two numbers and only one of them is ours by default.**

| | |
|---|---|
| Payment acceptance, transaction currency ≠ settlement currency | **2.00%** |
| Business account conversion you initiate yourself | **0.50%** |
| Gateway fee | **$0.30 per attempted or actual transaction** |
| WeChat Pay / Alipay acceptance | not in the fee schedule — blended, quoted per method |

Charge in CNY and settle in AUD and it is the 2.00%, which is Stripe's number
and no reason to move.

**So the shape of the integration is decided by the fee table, not by taste:
settle CNY into a CNY Global Account, and convert CNY→AUD separately at the
0.50% margin.** Support says this is allowed, and that the same applies to a
connected account — settlement configured to the connected account's CNY
Global Account, conversion handled separately. That is a 1.5 point saving on
every payment and it is the whole reason to be here.

Two things that are still unknown and both matter:

- **The WeChat Pay and Alipay acceptance rate.** The one number left. Without
  it the stack cannot be compared to Stripe's ~2.2% + ~2%.
- **What a CNY balance actually is** for an Australian sole trader. Offshore
  CNH and onshore CNY are not the same thing and the settle-then-convert plan
  rests on holding one of them. Nobody has asked yet.

**Still open from the list above:** everything about paying a person *inside*
mainland China (4, 5, 6). Support has not been asked. The refusal in the code
stands.
