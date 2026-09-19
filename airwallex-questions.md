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
