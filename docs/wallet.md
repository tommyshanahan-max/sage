# The Exchange wallet

Members send, request and receive money inside the app: a card on their own
Profile page, a money button and payment cards in rooms, and a full wallet at
`/wallet`. Built on branch `wallet/test-money`, against a **stand-in provider**
— no real money moves anywhere.

## Where it lives

| | |
|---|---|
| `board/lib/wallet/money.js` | Amounts as whole cents; currencies; what each region allows |
| `board/lib/wallet/ledger.js` | `wallet.json` beside `board.json`; serialised writes; hash-chained event log |
| `board/lib/wallet/service.js` | The rules: setup, quotes, send, accept, decline, cancel, expiry, requests, top-up, withdraw |
| `board/lib/wallet/passkeys.js` | Face ID / phone passcode on every money-moving action, bound to that action |
| `board/lib/wallet/routes.js` | The HTTP API; members only; money routes need a passkey signature |
| `board/lib/wallet/providers/mock.js` | The stand-in: hand-off pages, bank approval, CNY review, test rates |
| `board/lib/wallet/providers/airwallex.js` | Airwallex. Exercised against their sandbox; the live account was refused 21 Sep 2026 |
| `board/lib/wallet/providers/qfpay.js` | QFPay. Acquiring only — WeChat Pay and Alipay in, settled to the merchant's own bank |
| `board/lib/wallet/index.js` | Assembly; mounted from `server.js` |
| `board/public/wallet.html` | Every wallet screen |
| `board/public/wallet-card.js` | The Profile card, and money in rooms (`person.html`, `notes.html`) |

## Switching it on

Off unless `BOARD_WALLET` is set.

| Setting | Meaning |
|---|---|
| `BOARD_WALLET=test` | The stand-in provider. Pages say "In development · test money". |
| `BOARD_WALLET_TEST_CONFIRM=1` | With `test` only: allow a test confirmation where a browser can't make passkeys. Ignored with a real provider. |
| `BOARD_WALLET=airwallex` | Airwallex. Needs the three keys below. **Dead: activation refused 21 Sep 2026.** |
| `BOARD_WALLET=qfpay` | QFPay. WeChat Pay and Alipay in, settled to the merchant's own bank. Acquiring only — it refuses every payout call by name. |
| `BOARD_WALLET_QFPAY_APP_CODE`, `_APP_KEY` | From QFPay. Secrets: `.env` on the box only. |
| `BOARD_WALLET_QFPAY_SANDBOX` | `0` for production. Anything else is the test host. |
| `BOARD_WALLET_AIRWALLEX_CLIENT_ID`, `_API_KEY` | From Airwallex. Secrets: `.env` on the box only, and `make airwallex-keys` puts them there without a text editor. |
| `BOARD_WALLET_AIRWALLEX_WEBHOOK_SECRET` | The notification URL's secret. Webhook URL: `/api/wallet/webhooks/provider`. |
| `BOARD_WALLET_AIRWALLEX_SANDBOX` | `0` for production. Anything else is the sandbox. |
| `BOARD_WALLET_PUBLIC_ORIGIN` | e.g. `https://the-board-domain` — where the provider sends people back. |

## Trying it locally

```
cd board
node lib/wallet/dev-seed.mjs /tmp/w/board.json devsalt     # five invented members
PORT=8091 BOARD_DIR=/tmp/w BOARD_SALT=devsalt BOARD_WALLET=test BOARD_WALLET_TEST_CONFIRM=1 \
  BOARD_DEMO_DEVICE=demoreviewer00000000000000000001 node server.js
node --test lib/wallet/wallet.test.mjs                        # the rules
node lib/wallet/smoke.mjs http://localhost:8091               # both routes over HTTP
```

Open `http://localhost:8091/wallet` — you are Tom, with no wallet yet.

## The public demo at crowdfundme.app/wallet

Anybody can try the wallet there without an account. It says "In development ·
a working demo on test money" at the top. Each visitor gets a private sandbox in
memory (a cookie names it; nothing goes to disk; dropped after six hours or when
there are more than 300) with four invented people: **You** (no wallet yet),
**Mikko** in Helsinki (€300, a card), **Mia** in Sydney (A$120, has asked Mikko
for A$80) and **Wei** in Shanghai (paid to his bank in yuan). "Switch person"
lets a visitor send as one and accept as another; "Start the demo again" resets.

It is the board's wallet code, copied into `cfm/lib/wallet` and
`cfm/public/wallet.html` by `node scripts/wallet-demo-sync.mjs`. Edit the board's
copy and re-run the sync; the copies say so at the top. Check it with
`node board/lib/wallet/demo.check.mjs`.

## The decisions built in

- **The Exchange never holds money or card details.** Card numbers, bank logins
  and identity documents are typed on the provider's own pages. The wallet keeps
  a provider reference and the last four digits.
- **Every money-moving action is confirmed with a passkey** — Face ID or the
  phone's passcode — signed over that exact action.
- **Money waits to be accepted**, and goes back after 24 hours. Declined,
  cancelled and expired payments refund everything the payer was charged, fee
  included; the Exchange absorbs any exchange-rate difference on returns.
- **The rate is locked and shown before sending**: what you pay, what they
  receive, the rate, how long it's held.
- **Mainland China is pass-through**: no stored balance, money paid straight to
  the member's bank, a stated reason required, and a review step.
- **Payments in a room are visible only to the two people in them.**
- **Every change to money is in an event log that shows if edited**
  (`ledger.verify()`).

## What's not done, and what needs Tom

0. **A merchant account that exists.** Stripe closed on 20 Sep 2026 and
   Airwallex refused activation on the 21st. QFPay is the adapter written
   against that gap: `node lib/wallet/providers/qfpay.check.mjs` signs their
   own worked example before it needs a key, so the half that can be wrong on
   this machine is checked on this machine.
1. ~~Airwallex account and sandbox keys.~~ Done, and then undone by them.
2. **Individual identity checks.** Airwallex's hosted and embedded checks are for
   businesses only. Choose: submit individual identity through Airwallex's
   Accounts API, or use a separate identity provider (Stripe Identity, Sumsub).
3. **China.** Airwallex documents local CNY payouts only for e-commerce goods
   trade. Paying an individual for a service is not a listed use. Confirm with
   Airwallex in writing, or use another provider (Wise to Alipay is the next to
   check). The adapter refuses CNY until then.
4. **Connecting a card for real** uses Airwallex's browser component
   (Airwallex.js), so card details never reach this server. Not wired in.
5. **Chinese translations** of the wallet screens. English only so far.
6. **A lawyer** on the licensing question: holding balances vs passing money
   through, per country.
7. **Notifications** when money arrives or is accepted (the board's push is ready
   to use; not connected yet).
