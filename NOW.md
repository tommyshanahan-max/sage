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
| **Stripe** | **A LIVE ACCOUNT EXISTS AND TOOK A REAL PAYMENT, 24 Sep.** See the Stripe section below — Aozhou Baba, `acct_1UIVjEJItwOUeslJ`, charges and payouts enabled, Alipay on, ¥1 paid through Dealio from a phone. Everything after this sentence is the 20 Sep application that was declined, and it is kept because the wording matters, not because it is the current state. **DECLINED at application, 20 Sep** — "too high risk", inside a day. There was never an account: nothing was onboarded, nothing was terminated, and there is no chargeback history or MATCH listing behind it. This file said "closed the account" and that was wrong; a session repeated it into an email to a prospective partner before Tom caught it. The distinction is the whole thing in payments — a decline is a category judgement on an individual applying for cross-border China, a termination is a verdict on how you traded. |

## Dealio — the payment half, on `paydealio.com`

Its own hostname, same board container behind it (`docker/sites/dealio.caddy`),
and its own words on the door — a payer arriving to get paid has never heard of
the board. Payment links are `paydealio.com/pay/…`. Inert unless
`TOMSCODING_DEALIO_DOMAIN` is set in `.env` on the box.


**APPLE REJECTED IT, THE REPLY IS WRITTEN, AND IT IS NOT SENT.** Submission
`9c9fce5f-6b14-406c-b857-23122b6607d3`, The Exchange 交换 1.0, submitted
17 Sep, rejected 22 Sep 06:42. The notice email carries the submission id and
the item and **no reason at all** — Apple keeps the findings on the App Review
page — so it reads like news every time somebody opens the inbox. It is not
news. It is the rejection `app/store/APPLE-REPLY.md` was written for, and that
file is headed with this same submission id.

**What is blocking it is three screen recordings, on a physical iPhone.**
Apple will not take the reply without them, however true the reply is. They
are listed at the bottom of APPLE-REPLY.md:

1. Terms before sign-in
2. Flagging and blocking
3. Account deletion, end to end

**So the order is: `make app-ship` on the Mac, the three videos, then paste
the reply.** Nothing in Stripe or QFPay is waiting on this and it is not
waiting on them.

### The chain

The whole chain was **watched finish on 20 September 2026**: request minted
from a terminal, link opened in WeChat on a phone, PAY, WeChat Pay, a real
Airwallex code long-pressed, paid on Airwallex's side, and the row went green
with nothing of ours looking at it. `make pay-check` counted it.

So the only untested thing is **real money**, and it is one line:
`BOARD_WALLET_AIRWALLEX_SANDBOX=0`, which `make airwallex-keys … LIVE=1`
writes when the live pair exists.

**The whole widget walks on a laptop now: `make try-china` (23 Sep).** One
command, no Stripe key, no docker, nothing touching the box. It stands
`board/china` up with `BOARD_PAY_DEMO=1`, so where Stripe's own pages go
there is a stand-in that says on itself that it is one and offers the three
real returns — finished, finished with the wallets on, closed the tab. Both
doors, all six screens, the ask, and the page the payer opens. It takes no
money and can take none: no key behind it and no account to take money into.
`board/china-demo/` is not copied into the image, so it cannot exist on the
box.

It found one thing on the first walk: **`/china` was still serving the
deleted fork.** The fork became the two buttons on `home.html` a day ago,
every link was repointed, and the one nobody links — the bare address Tom
hands people — was missed. `index.html` is gone and the mount serves
`home.html`.

**WECHAT WILL NOT LET YOU PAY A CODE IT IS SHOWING YOU (24 Sep, watched).**
Three runs on a phone, all of them looked at rather than read:

| the code | where | long-press |
|---|---|---|
| a URL | the board's page, inside WeChat | **opens** |
| `wxp://f2f0…`, a real 收款码 | the board's page, inside WeChat | **refused** |
| the same `wxp://` | WeChat's own 扫一扫 | **pays** |

So the block is deliberate and it is specifically about paying: WeChat
recognises a code on our page perfectly well, and declines when the code is a
payment. The "自己扫自己" guard.

**It also settles the contradiction this file has carried since 20 Sep.** The
Airwallex code long-pressed and paid that night must have been an https link,
not a raw `wxp://`. Both observations are now true and neither has to be
explained away.

**The workaround exists and it costs six taps:** long-press, 保存图片, out to
WeChat, 扫一扫, 相册, pick, pay. That is not a payment flow, it is a puzzle.

**AND IT IS THE ARGUMENT FOR THE ICP FILING, ARRIVED AT FROM THE OTHER
DIRECTION.** A payer already inside WeChat should never be shown a code at
all — JSAPI opens WeChat's own payment sheet on the page, one tap. JSAPI needs
the openid, which needs 网页授权, which needs a 备案'd domain. Every route into
this ends at `thexchange.cn` being filed; this one ends there from the payer's
thumb rather than from a form.

**The machinery, built overnight and now proven end to end:** a line in a room
can carry a code (`qr` on a say), the board draws it at
`/api/say/<id>/qr.png`, and both room pages render it as an `<img>` — the only
thing a long-press menu reads. Members cannot attach one; `/api/mo/say` is
behind the admin key. A line can also carry a payment request (`pay`), drawn
as a card whose figure and paid state are read fresh on every load.

**MOST OF THE BLOCKAGE BELOW IS GONE, 24 Sep 17:28.** Asked of the live
account with its own key — `make wallets ASK=1`, which now answers the payout
half too — `acct_1UIVjEJItwOUeslJ`, Aozhou Baba, live:

- **Charges and payouts are both enabled.** Not frozen. The paragraph below
  saying they are was true on 23 Sep and is not true now.
- **Stripe is waiting for nothing.** No requirements outstanding, so the
  identity document is no longer what is holding this account.
- **Alipay and card are on. WeChat Pay is INELIGIBLE** — Settings → Payment
  methods, 24 Sep. Not pending. Nothing is in a queue and waiting changes
  nothing.

  **Alipay being on is the clue.** Same account, same country, same currency —
  and Stripe's WeChat Pay supports AUD. So it is not Australia and not the
  currency. What is left is the business category: WeChat Pay applies its own
  restricted list on top of Stripe's. Check Settings → Business details for
  the industry this account is filed under. If that is accurate and it is
  still ineligible, WeChat Pay through Stripe is closed to this business and
  the WFOE's own merchant account is the route — which is what the ICP work
  below was for.
- **There IS a bank account on it.** This said `lands in NOWHERE` and that
  was the command lying, not the account: `external_accounts` is not on
  Stripe's `/v1/account` unless it is expanded, so a missing field was read
  as an empty list — the worst shape of wrong, because it does not look like
  a failure, it looks like an answer. `make wallets` now asks for the bank
  separately and says so when it cannot read it. Money can be taken and can
  leave.

**THE BOX IS ON A TEST STRIPE KEY. 24 Sep, and it is the answer to the whole
evening.** `make pay-check` prints it in its second line — *Stripe key set ·
test*, under *PAYMENTS ARE ON — in test mode, so no real money moves*.

So nothing on that server has ever been able to charge anybody. Every link
minted tonight was a sandbox link, demo flag or no demo flag, and a session
called three of them "a real ¥1" because it checked the demo switch and never
checked the key. Test mode is identical on the screen — same buttons, same
Alipay, same refusals — which is exactly why it went unnoticed for four
hours.

**The live account is a different key.** Aozhou Baba,
`acct_1UIVjEJItwOUeslJ`, charges and payouts enabled, Alipay on, bank account
present — all of that was read by `make wallets ASK=1` with a key typed at
the prompt. It never touched the box's configuration.

**Before anybody puts the live key on the box: roll it.** It went into zsh
history and into a screenshot on 24 Sep. A leaked live key on a public server
is a likelier route to a terminated account than anything in this repo.

## Where Alipay actually stands, 24 Sep 18:51 — read this first

The box went live at 18:36 (`make go-live`, live key, live publishable, its
own webhook, every stale payout account cleared).

**The shop's checkout works up to the last step.** On a phone, on
aozhoubaba.com: cart, address, order, one 支付宝支付 button, and then
**Stripe's own live payment sheet, CN¥31.00, Alipay on it**. That is the
whole integration, running. Everything fought over on 24 Sep — the dead
Airwallex rail, the Connect destination, the test key — is behind this.

**The attempt itself fails**, twice, and `make pay-last` says how:

```
31.00 CNY   alipay
  requires_payment_method
  The payment failed.
  payment_intent_payment_attempt_failed · invalid_request_error
```

`invalid_request_error` is Stripe saying the request was wrong, not a payer
being declined.

**TWO THINGS TO DO, AND NEITHER IS BUILT YET.**

## FOUND IT: the account has no Alipay capability, 24 Sep 19:30

Stripe support read the account's `capabilities` list and `alipay_payments`
is **not in it at all**. Active on the account: Afterpay, Bancontact, BLIK,
card, EPS, Klarna, MB WAY, Pay by Bank, Pix, Satispay, Scalapay, transfers,
Zip; Cartes Bancaires pending. No Alipay.

**A toggle and a capability are different things, and only one of them is
checked at the moment that matters.** Settings → Payment methods can show
Alipay ON without the capability being active. Checkout creates the session
without looking. Stripe only asks whether the account can really process the
method when the payer confirms — so the first thing in the whole chain to
find out is the payer, as
`payment_intent_payment_attempt_failed · invalid_request_error`. Independent
of currency, which is why AUD failed identically.

**WHAT TO DO:** Settings → Payment methods → Alipay → run the activation
flow, and wait for the capability to go active. It is account-level
verification, so not instant.

**`make wallets` was reading the wrong field and said so confidently.** It
asked `payment_method_configurations` — the display preference — and printed
"BOTH WALLETS ARE ON" about an account with no Alipay capability. It now
prints the capability beside the switch and names the disagreement:

```
⚠  Alipay is switched ON with no live capability behind it.
   The payment sheet will offer it and the payment will fail when somebody
   presses it: payment_intent_payment_attempt_failed · invalid_request_error.
```

and its verdict requires the capability, not the switch. **This is the third
time in two days that a command here answered from a field next to the one
that decides** — `external_accounts` off an account object that does not
carry it, `BOARD_*` grepped out of a `.env` full of `TOMSCODING_*`, and now
this. The pattern is a confident answer from the wrong field, and it is worth
one minute of suspicion whenever a check says what you hoped.

An evening went on the four faults in front of it. All four were real and all
four are fixed — the dead Airwallex rail, the Connect destination, the test
key, the currency — and none of them was this.

---

**AUD FAILS IDENTICALLY. 24 Sep 19:15, and it settled the currency question.**

```
11:15   6.51 AUD   alipay   requires_payment_method
                            payment_intent_payment_attempt_failed · invalid_request_error
11:02  31.00 CNY   alipay   (the same)
10:49  31.00 CNY   alipay   (the same)
```

So the currency was not it, and neither were the two guesses before it. Three
theories, three wrong, each one costing a round of somebody's evening. **The
next session should not offer a fourth.** Everything in this repo that can be
checked has been checked: the rail, the destination, the keys, the mode, the
currency. What is left is an Alipay payment that this Stripe account will not
complete, in either currency, on Stripe's own hosted form.

**This is Stripe support's question now, not a code question.** Ready to
paste:

> Live Australian account. Alipay is enabled and appears on the payment
> sheet. Checkout Sessions with `payment_method_types: ["alipay"]` create
> normally, but every attempt fails on submission with
> `payment_intent_payment_attempt_failed` / `invalid_request_error`.
> Reproduced 24 Sep in CNY (31.00) and AUD (6.51), same result. What makes
> the attempt invalid?

**The AUD change stays.** Stripe's own currency table says CNY is not a
presentment currency for an Australian account, so it would have bitten later
even though it is not biting now. Stripe's adaptive pricing offers the payer
both currencies on the sheet regardless; ours decides the base the sheet is
built from.

---

### The currency theory, kept because it was reasoned well and still wrong

1. **The currency, which Stripe's documentation supports and the box does
   not.** Alipay's presentment currencies are AUD, CAD, CNY, EUR, GBP,
   HKD, JPY, MYR, NZD, SGD and USD — *depending on business location* — and
   **AUD is the one listed for Australia**. Taking a currency at all requires
   being able to settle it, which means a bank account per settlement
   currency; this account settles AUD. Both failed attempts were CNY, and the
   shop is priced in yuan and charges in yuan.

   **So the shop has to charge in AUD.** The payer still sees RMB inside
   Alipay — it converts on their side, which is the ordinary cross-border
   flow and the reason the ¥ price on the shelf can stay as it is.

   **BUILT, 24 Sep 19:10, and not yet run on the box.** The shelf stays in
   yuan; the till converts. `make rate RATE=0.21` writes
   `TOMSCODING_BOARD_AUD_PER_CNY` into `.env`, `make up`, and the shop's
   Stripe charge is AUD — rounded up, so a stale rate is never the seller's
   loss. Nothing set means nothing changes: it charges yuan and fails exactly
   as before, which is a visible wrong rather than a silent one.

   The payer is told before she presses, because the shelf says ¥31 and
   Stripe's sheet will say A$6.51: *支付宝按澳元扣款，汇率以支付宝当日为准。*

   **A fixed rate is the small honest version, not the right one.** A quote
   per order is right and needs a source now that Airwallex is gone. Until
   then somebody has to remember to move it.

   This took an evening because three sessions guessed instead of reading
   Stripe's currency table. It is two searches.

   (`AMOUNT="A$1"` does not survive ssh → make → shell; the `$` is eaten
   twice. Use `CUR="aud"`.)
2. **Dealio's page cannot mount the form at all** while the shop's can — same
   keys, same account, different route. It says *Nothing to do with your
   phone* and reports itself, so the reason is sitting in `make pay-why`,
   unread as of 18:51.

**If the currency is not it, this stops being a code question.** The message
for Stripe support, ready to paste: *Live Australian account, Alipay enabled.
Checkout Sessions with `payment_method_types: ["alipay"]` create fine and the
payment sheet renders, but every attempt fails on submission with
`payment_intent_payment_attempt_failed` / `invalid_request_error`. 24 Sep.
What makes the attempt invalid?*

**ALIPAY HAS NOT TAKEN A REAL PAYMENT. A SESSION CLAIMED IT HAD, 24 Sep, AND
WAS WRONG.**

What happened: `make ask` minted a link, Tom opened it on his phone, chose
Alipay, and the screen said it worked. It was `BOARD_DEALIO_DEMO=1` serving
`/pay/:id/wallet` — `wallet-demo.html`, the stand-in, which says
*演示 · 不会真实扣款* across the top and *这是付款流程的演示页面，不会扣款，
也没有真实资金* at the bottom. No Stripe call. No money.

The evidence was on screen the whole time and was read the wrong way round:
the URL in the Alipay warning was `/pay/…/wallet`, which is the demo route
and nothing else. It was taken for a Stripe return.

**The demo is off, 24 Sep 18:02, confirmed from inside the container.**
`docker compose exec -T board printenv BOARD_DEALIO_DEMO` prints nothing, and
`make ask` prints no ⚠ beside the link. So a `make ask` link is a real charge.

This took two goes and the first one is the lesson. The names in `.env` are
`TOMSCODING_*` and the container sees `BOARD_*` — `docker-compose.yml` maps
them. The command that was supposed to switch the demo off deleted
`BOARD_DEALIO_DEMO=` from `.env`, a line that had never existed; `grep -c`
answered 0, which is the number you want for entirely the wrong reason; and
this file was updated to say it was off while the next payment was still a
demo. Ask the container, which cannot answer for a name nobody set. In
CLAUDE.md now.

**And `make ask` now says which it is, beside the link.** A banner on the
page was not enough: the link is what gets carried off and pasted into a
chat, so what the link is has to travel with it. With the demo on it prints
`⚠ DEMO — THIS LINK CANNOT TAKE MONEY`; with it off it says nothing, because
a line that appears every time is furniture by the time it matters.

**Still unproven until somebody pays one.** Nobody should say a Chinese payer
can pay until that has happened with no orange banner on the screen — that is
the claim this file exists to stop being made twice.

WHAT IS STILL TRUE, because it came from Stripe's own API rather than a
screen: Alipay is available on the live account, charges and payouts are
enabled, WeChat Pay is ineligible, and there is a bank account. The Alipay
interstitial is real too — Alipay did open `paydealio.com` from a scan.

**ONE WRINKLE, AND IT IS FIXABLE.** Alipay shows *您即将离开支付宝* — "you are
about to leave Alipay" — before the payer reaches `paydealio.com`, with a
`继续访问` button under it. It is Alipay's standard notice for any external
domain, not a flag on this merchant, and it costs one tap. But it is an orange
warning about 资金安全 in front of somebody sending money abroad for the first
time, which is the worst possible moment for one.

Alipay whitelists domains on request: email `techservices@alipay.com` with the
company name, the PID, the domain, the reason and a contact. The
`我要申请恢复` link at the foot of that page is the same appeal. Not done yet.

**DECIDED, 24 Sep: ship on Alipay, add WeChat through the WFOE later if it
is needed.** Alipay works today and the WFOE route stays open — the ICP
filing, the bank's merchant account, all of it below is still true and still
available. It is not being abandoned, it is being deferred until there is a
payer who could not pay.

Cheap to defer, and that is why: the checkout takes the wallet as an argument
(`wechat` / `alipay` / `card` — see `kinds` in `board/lib/stripe.js`) and the
shop's payment record already carries `how`. Adding WeChat later is plugging
in a provider, not unpicking a decision.

What would change the answer: a real share of this money needing to be spent
in China rather than landing in Australia. Then the WFOE stops being a second
wallet and becomes the shorter path.

**WeChat Pay is a second door, not the door** — on the assumption Alipay
works, which is the thing not yet shown.

The two open questions are now WeChat Pay and a bank account — money can be
taken and, with nothing for it to land in, sits in the Stripe balance. What
follows is kept because the passkey is still Zhu's and that still decides who
can sign in — but it is no longer blocking the money.

**THE ACCOUNT IS IN SOMEBODY ELSE'S NAME (23 Sep, 23:00 — see above).** Not a login problem. The live account's representative is
**Zhu Liyuan**, the two-step passkey is **"Zhu's passkey"**, and Stripe
refused the identity document with, in Tom's words, *"the identity was
wrong"* — the document did not match the name on the account.

So three things are all one thing:

- Tom cannot sign in. Touch ID on his Mac does nothing, because the passkey
  is not his.
- The document keeps being refused, because Stripe wants the representative's
  and the representative is Zhu.
- Charges, payouts and both wallets are frozen behind that refusal.

Stripe's own way out of the passkey — *Remove two-step authentication → take a
photo of your identity document* — is the same trap with a different label: it
asks for a document that has to match a name that is not Tom's.

**ONE QUESTION DECIDES IT, AND IT IS NOT A TASK.** Is Zhu the representative
this account should have?

- **Yes** → Zhu sends Zhu's document and Zhu signs in. Tom is a user on the
  account, not its holder, and every future identity request goes to Zhu.
- **No** → change the representative to Tom first, then send Tom's document.
  The passkey stops mattering the moment the name changes.

Nothing on Stripe moves until the name and the document are the same person.
**Do not upload a document before that is decided** — a third refusal on an
account that already carries one rejection is not free.

**AND PAUSED THEM AGAIN EIGHT HOURS LATER (23 Sep, 13:05).** Email to
`stripe@aozhoubaba.com`, subject *"[Action required] Provide information about
Aozhou Baba"*:

> Provide a valid ID document
> Due: **Overdue**
> Incoming charges are paused as of 23 Sept 2026 until the requested
> information is reviewed.
> Payouts to your bank are paused as of 23 Sept 2026 until the requested
> information is reviewed.

**"A valid ID document"** — the one already submitted for Zhu Liyuan was not
accepted. So the "In review" seen on the status page at 13:29 is not the whole
story, and **charges are off**, not merely payouts.

**THE ORDER MATTERS AND IS EASY TO GET WRONG.** In one day Stripe said, about
the same account: charges on (05:18), a document in review (13:29 status
page), charges and payouts paused, overdue (13:05 — *before* that status
page). Reading any one of them alone gives the wrong answer, which happened
twice today. The account is paused until a valid document is accepted.

**This is the blocker under everything else Stripe.** The two wallets will not
move while the account is paused, and neither will the live keys be worth
putting on the box.

```
dashboard.stripe.com/acct_1UIVjEJItwOUeslJ/account/status
```

**STRIPE TURNED CHARGES ON THIS MORNING (23 Sep, 05:18).** Email to
`stripe@aozhoubaba.com`, about `acct_1UIVjEJItwOUeslJ`, subject *"You can now
accept payments with Stripe"*:

> Thanks for providing information about your business. You can start
> accepting payments while we review your information. Payouts to your bank
> account will be enabled when our review is successfully completed.

So **charges yes, payouts not yet** — the review is still running, which is
the identity document. The "Payments paused soon" warning seen at 13:29 is
about that same review, not a separate thing.

It does not move the wallets: they were still Pending approval on the live
account at 13:39, hours after this email.

**THERE ARE TWO ACCOUNTS AND THEY DISAGREE (23 Sep, 14:18).** A live account
and its own sandbox, both called Aozhou Baba:

| | acct | WeChat Pay · Alipay |
|---|---|---|
| Live | `acct_1UIVjEJItwOUeslJ` | Pending approval |
| Sandbox | `acct_1UIVjqJ1hAPEyck7` | **Enabled** |

A sandbox lets you switch anything on — Stripe says so in its own banner — so
Enabled there is worth nothing as a prediction about live. What it IS worth:
**the whole flow can be walked against real Stripe**, with real WeChat Pay
test codes, using that sandbox's test key. Nothing else on this box can do
that today.

**`make wallets` could not have told you which one it asked, and now says.**
It printed "Default (the default) · test" and no account name or id. Two
accounts, one name between them, and an answer about money wearing neither.
It now leads with the display name, the `acct_` and the mode, and prints the
`pmc_` beside each configuration — because an account and its sandbox each
have a "Default".

**BOTH WALLETS ARE APPLIED FOR AND PENDING (23 Sep, 13:39).** Settings →
Payment methods, the Default configuration on the platform account
(`pmc_1UIVjkJItwOUeslJr1As0u9C`):

```
  Alipay        Pending approval    Digital wallet   China
  WeChat Pay    Pending approval    Digital wallet   China
  Card          Enabled
```

**Nothing to do in Stripe.** The application is in. It is waiting on them.

**`make wallets` HAS BEEN ANSWERING ABOUT THE SANDBOX ALL DAY.** The box's
`BOARD_STRIPE_KEY` belongs to `acct_1UIVjqJ1hAPEyck7` — the **sandbox** — and
nothing in this session ever changed it. Three readings, all of the sandbox,
all read as though they were live:

| time | it said | what was actually true |
|---|---|---|
| 13:36 | NOT AVAILABLE, both wallets | the sandbox, before they were switched on |
| 14:18 | — | Tom clicked Enable in the sandbox |
| 14:35 | both wallets on | the sandbox, after |

So *"Stripe withholds the wallets from this account"*, written down at 13:40,
was about an account nobody was asking about. **Nothing in this repo has ever
read the live account's wallet status.** The only reading of it is the
dashboard at 13:39: Pending approval.

Two fixes, both in: the command now names the account and the `pmc_` before
anything else, and **`make wallets ASK=1`** reads a key from the terminal and
answers about whatever account that key belongs to, keeping nothing:

```
ssh -t root@45.77.8.166 'cd ~/tc && make wallets ASK=1'
```

That is the one that can answer whether the approval has come through, because
the box does not hold a key for the account it is on.

It also said *"NOT AVAILABLE — Stripe will not give this account the method"*,
which is a refusal, when the dashboard for that same account said **Pending
approval**. `available: false` does not separate pending from refused; only
that page does. It now says "NOT YET" and names the page.

**Three providers deep and none of them has said yes yet.** Airwallex gone,
Stripe's two wallets pending. Door two — the Beijing WFOE, where we are the
merchant of record and nobody has to grant us a wallet — is still the only
route that does not wait on somebody's permission. Not a reason to abandon
door one, which is now one approval away.

**The merchant was being told to switch on something that is not theirs
(23 Sep).** `switch.html` read "One switch left — WeChat Pay is off on your
account", with two steps: in Stripe, Settings → Payment methods, turn the two
wallets on. Every word aimed at the wrong account.

- The charge is a **destination charge** — `lib/stripe.js` builds it on the
  platform with `transfer_data.destination`. Stripe: *charges use your
  platform's payment method configurations when they're destination charges.*
  So **this platform's wallets decide every payment the product will ever
  take**, and no merchant's settings ever come into it.
- They could not have done it anyway. `makePayee` opens `dashboard: "express"`
  with one capability, `recipient` / `stripe_transfers`. An Express account is
  a payout destination; there is no Settings → Payment methods in it.
- What is really being waited on is that capability going from *requested* to
  *active*, when Stripe accepts their identity and bank. `payeeReady` has read
  exactly that all along and was right; the screen over it described a
  different product.

The screen is now a waiting screen with nothing to do on it, and the panel
saying the same thing on `connect.html` is gone.

**So the Active list on Aozhou Baba is the whole answer**, and it is not
something to read off a dashboard any more:

```
ssh root@45.77.8.166 'cd ~/tc && make wallets'
```

It asks Stripe for this platform's payment method configurations and says, for
WeChat Pay, Alipay and Card: on, off but available, or **NOT AVAILABLE** —
which is Stripe refusing the method to this account, a different day's work
from a switch nobody has flipped. `make pay-check` names it.

**The live account has one open task and a clock on it (23 Sep, 13:29).**
`/account/status` on the Aozhou Baba account:

- **Provide an identity document for an account representative (Zhu Liyuan)**
  — *In review*, paused 22 Sep, "impacts payments and payouts". Submitted
  already. Nothing to press; it is waiting on Stripe.
- **Paused:** Cartes Bancaires. **Paused soon:** Payments. That second one is
  the clock on the task above.
- **Active** lists Afterpay, Bancontact, BLIK, EPS, Klarna, Link, MB WAY,
  Pix and more behind "View more". **WeChat Pay and Alipay are not in the
  part that is visible**, and they are the only two this product needs.
  Not checked, not assumed: `make pay-try ID=…` asks Stripe per method and
  prints its reason.

**A second Stripe account, and Connect works on it (23 Sep, 00:15).**
Opened as **Aozhou Baba**, `acct_1UIVjqJ1hAPEyck7`, AUD. Connect switched on
through the dashboard wizard as a **platform, destination charges** — the
shape `board/lib/stripe.js` already builds. Pressed the button on
`/china/connect` and Stripe's onboarding opened. That is the premise of the
whole thing standing up, and it had not been seen working before tonight.

Its address is **stripe@aozhoubaba.com**, forwarded free at Porkbun into
`tommyshanahan@gmail.com`. Both of the obvious addresses were refused — the
iCloud one is on the rejected account, and Stripe answered "already in use"
for the Gmail. `tom@aozhoubaba.com` is a *hosted mailbox* that never
provisioned (`#pending-setup`), cannot be logged into and cannot be given a
forward while it exists; a different local part was the way round it.

**What is not settled, and it decides the shape of the product.** Door one
says "I have a Stripe account". `makePayee` OPENS one — so Daniel or Brendan
would have been handed a second empty account to onboard from scratch while
the screen said "same as it does today". OAuth (`linkUrl`/`linkFinish` in
stripe.js, `/china/api/link`) is written for it and inert: the dashboard
shows no client ID for this account, on either the Connect settings page or
`/settings/applications`. New platforms on Accounts v2 may simply not get
one. **Two minutes settles it**: press the button, take Express onboarding
through with Stripe's "Use test data", and see whether it lets somebody sign
in to an account they already have. If it does, only the wording changes.

**Nobody has timed Express onboarding**, and four claims were written onto
the screens as facts without one: a minute, ten minutes, an hour, and "asks
again even if you already have an account". The single run (23 Sep) used an
address with no Stripe account behind it — ordinary onboarding, settling
nothing.

**Stripe documents the opposite of the pessimistic one.** Networked
onboarding (`docs.stripe.com/connect/networked-onboarding`) lets somebody
creating a new connected account pick an existing legal entity and reuse
verified information instead of resubmitting KYC, with shared fields staying
in sync afterwards. Conditions: `controller.requirement_collection = stripe`
(what Express accounts are), authentication through Stripe-hosted onboarding
(what `onboardLink` does), and API version 2019-02-19 or later. On by
default for platforms.

So Daniel, who has an account, should be offered his existing entity rather
than a blank form — **read from the docs, not watched happening**. The
screens now say that and quote no duration. Somebody with a real Stripe
account pressing the button is still what settles it. If that holds, nobody does it for a supplier who has
not paid them yet — which makes door two (the WFOE, no merchant onboarding
at all) the main door rather than the fallback, and the fork on
`/china` the wrong way round. That is a decision, not a task.

**Stripe Connect is gone too, test mode included (22 Sep, night).** The
rejection of 20 Sep is on the platform account, not on a mode, so it answers
every attempt to open a connected account — under `sk_test_` keys as readily
as live:

```
china connect: /v2/core/accounts -> 400:
You cannot create new accounts because your account has been rejected.
```

Found by pressing the button on `/china/connect` with sandbox keys loaded.
`make go-test` worked, `make pay-check` read `Stripe key: set · test`, and
the refusal was identical. So "switch Connect on in the dashboard" is not the
blocker and never was: there is nothing to switch on. **No connected account
can be opened from this Stripe account in either mode.**

What that leaves: door two of `/china` — the Beijing WFOE, where we are the
merchant of record and no connected account exists to be refused. Door one
needs a different platform account or a different provider, and the lesson
from `airwallex.js` applies to both: ask whether they will onboard a payment
facilitator *before* writing the adapter.

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

## And a second way through, found 22 Sep, which is domestic

**A WFOE can take a WeChat Pay collection code without an ICP.** Confirmed by
Tom's Beijing agent (胡, 公司注册 / 代理记账), in writing, in the group chat:

> 如果就是只是做一个那个二维码儿收款码儿完了想收款的话，这个是不需要 ICP 的，
> 这个您直接联系一下银行或者是微信、支付宝，那商户完了看看是怎么申请。

That matters because two things had been conflated, here and by every session
that touched this:

- **Taking payment from strangers on a website** — ICP备案, a verified 服务号
  or 小程序, then 微信支付商户号. Months. This is the one that is hard.
- **A 经营收款码 / 线下场所 merchant number** — business licence, corporate
  bank account, legal rep's ID, photographs of the premises. Days. No ICP,
  no website, no 服务号.

The three-employees-with-社保 and ¥1,000,000 registered capital Tom was quoted
belong to the **ICP经营许可证** — the commercial licence, which is for running
a platform other people sell through. Not needed for a company collecting for
its own goods.

**Which makes Dealio work domestically, today, with no acquirer.** Both ends in
China, RMB, a code the payer long-presses: that is the whole product, and the
cross-border licence that Stripe and Airwallex both refused is not in the path
at all. `lib/wallet/providers/` already holds the abstraction; qfpay.js is
written and unrun; a wechat.js is one more branch on `createWallet()`.

**The shape it serves.** Reps in China each take their own end-customer money
(their own Weidian, or their own code). They restock from the WFOE by
long-pressing its code — domestic RMB, no US$50,000 quota, no internet
banking for a part-time seller. The WFOE pays Australia once a month as an
ordinary goods-trade payment. Nobody settles for anybody: every link is a
sale with title passing.

**The line not to cross.** The 经营场景 on that merchant number is 线下场所,
and it is what the number is licensed for. Collecting from a dozen known
wholesale reps is that scene. A public consumer checkout on aozhoubaba.com is
not, whoever forwards the code, and using an offline number for it is how
accounts get frozen. Consumers keep going through Weidian until there is a
服务号 or 小程序 with an ICP behind it.

**Next, and in this order:** apply for the merchant number (the WFOE's own
bank is likely the easiest door — banks act as 服务商 and hold the KYC
already), then the adapter. Not before — the lesson from airwallex.js is
three paragraphs down and cost a week.

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

## Voice messages — live 24 Sep, watched working on Tom's phone

Hold the round button beside Send, speak, let go. No calls: Tom asked for
calls, then said voice messages only, twice.

**In all three places two people talk**, which took two goes. It shipped in
group rooms first, and the screen Tom actually opens from Messages is
`notes.html` — a one-to-one thread — so he pressed the tab and there was no
microphone on it. Rooms are `groups.html`, threads and door rooms are
`notes.html`, and the two pages draw the same kind of message from different
stores. A change to one of them is not a change to the other.

**And it shipped broken once more the same morning**, for a reason worth
keeping: the timer takes the message box's place while a thumb is down, which
takes the box out of the document, so a `$("tbox")` lookup afterwards answers
null — the word "null" appeared where the box had been and the next press
left the button stuck red. Hold the element in a variable; a reference
survives being detached and a lookup does not. It passed a test because the
test held the button once and never looked at the composer afterwards. The
test now holds it twice and reads the composer between.

The audio is gated on being in the room, so the page **fetches the bytes with
the device header and plays a blob** — it is not an `<audio src>`. A plain src
cannot carry a header and the device lives in localStorage rather than a
cookie, so every one of those GETs is a 400 and every note is a button that
does nothing. That was shipped that way for about an hour on 24 Sep and caught
by reading the route, not by a phone. Do not "simplify" it back, and do not
put the device in the query string instead — that writes it into every access
log.

## Money on your own page — live 24 Sep, watched working

A **Wallet** row near the foot of Profile, the shape of the rows around it.
Shut it says what you are owed; tapped it opens to Ask for money and the list
still to settle. Web only — the app keeps the old wallet card, because
/dealio is web-only and these buttons would bounce there. So it is
thexchange.app in Safari, not the home-screen app.

## The app

**Rejected 22 Sep — this section said "nothing to do but wait" for a day
after that stopped being true.** It read `1.0 · WAITING_FOR_REVIEW · build 1
VALID` on 21 Sep, which was right then. See the entry at the top: the reply is
written, unsent, and blocked on three recordings. `make app-state` is still the
only honest reading of where the submission is.

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

**The checkout button is Alipay, one button, 24 Sep.** 待付款 drew 微信支付
and 支付宝 side by side from the day it was written, and the WeChat one has
never been able to take a fen — no bank behind the native rail, and Stripe
marks WeChat Pay ineligible on this account. Every press answered `off` and
the screen said *再试一次* to somebody whose second try would fail the same
way. The server now says which wallets can actually mint something
(`orderWays()` in `server.js`, sent with the order) and the page draws only
those: one full-width 支付宝支付 today, both the day the bank connects or
Stripe's category review turns WeChat on, and a sentence instead of a button
when neither can. Money for a shop sale is a plain charge into the platform's
own Stripe account — no `transfer_data`, no fee — because the shop sells its
own goods. **The day it settles for somebody else that is a 二清 licence
question before it is a code question.**

**Not yet proven with a real order.** The Stripe rail has taken a real ¥1
through Dealio; nobody has bought a product through the shop's own button.

## Airwallex is out of the payment path, 24 Sep

`TOMSCODING_BOARD_WALLET` still said `airwallex` on the box months after
Airwallex refused the account, and that one stale line was the whole of this
evening. The code rail is tried BEFORE Stripe in `/api/request/:id/pay` and
in the shop's pay route, so every press of Alipay went to a provider whose
every call comes back

```
airwallex login 403: <!doctype html>… 403 Forbidden (host https://api.sandbox.airwallex.com)
```

— an HTML page from the edge, not even an API error — and the payer was told
*Alipay would not take this one* while Stripe, which had taken a real payment
that afternoon, was never asked. A dead provider that is still named in
`.env` outranks a live one and looks exactly like a wallet declining.

**Two fixes, and both were needed.** The variable is gone from `.env`. And
both pay routes now treat a code rail that cannot draw as a rail with no
opinion: it stands aside and the payment carries on to Stripe, which is what
would have happened had the variable never been set. The refusal still
survives where there is nothing to fall through to.

`make wallet-why` is the command that answered this in one line. Reach for it
the moment a pay button says a wallet said no.

**And behind it was a second one: Dealio charged itself through Connect.**
With Airwallex out of the way Alipay reached Stripe and Stripe refused —
*THEY HAVE NOT FINISHED SETTING UP YET*. Every charge this route made was a
DESTINATION charge, transferred on to the asker's `payee`: a connected
account minted by `/china/connect` at some point and never onboarded, so its
transfers capability is not active. But Dealio's money never goes through
it. **The keys are Aozhou Baba's** — the money is in the right account the
moment it is charged. It was asking Stripe to transfer Tom's money to Tom.

A plain charge now for the Dealio owner's own incoming requests — no
`transfer_data`, and so no application fee, which is right because there is
no cut to take off yourself. **Everybody else keeps the destination**, and
that is the line rather than a tidiness: collecting your own money is a shop,
holding somebody else's on the way past is 二清.

Its payments are **not** on Airwallex and must not be until the conversation
above has happened. `aozhoubaba.com` is its domain.

**The shop front is on that name (23 Sep).** `aozhoubaba.com` resolves to
`45.77.8.166` and serves the shopfront over TLS; `/` is rewritten to
`/shop/Tom`, and the API answers there with 澳洲爸爸汤姆. The A record moved
at some point after 21 Sep.

This paragraph said the opposite until today, and a session spent an hour on
the wrong answer because of it — told that the domain did not point here, it
went looking for a DNS problem while the real one was a deploy that had been
run on the MacBook instead of the box. A line in this file that has stopped
being true costs more than a line that was never written.

## Mail

| | |
|---|---|
| `mo@thexchange.app` | Porkbun **forward** into `tommyshanahan@gmail.com`. The address on the Airwallex application. |
| `tom@thexchange.app` | Porkbun **mailbox**, free trial, 10GB, renews at US$36/yr. Gmail sends as it through `smtp.porkbun.com:587` with reply-to `mo@`. Mail sent *to* it sits in Porkbun webmail — Gmail dropped POP fetching in January 2026, and an address cannot be a mailbox and a forward at once. |
| `tom@globalpeoplesmedia.com` | Send-as removed from Gmail, 21 Sep. Still receives. |
