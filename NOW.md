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

## THE MOCK WAS DRAWING REAL-LOOKING DEAD CODES — 25 Sep, never deployed

**`providers/mock.js` answers `qrPay` with `https://qr.alipay.com/int_<id>`.**
A real domain, an invented path. It exists so every screen after the code can
be built on a laptop with no keys and no money, and it pays itself after six
seconds. It was never meant to face the Alipay app.

**`BOARD_WALLET=test` on the box, so it did.** Alipay scanned the code, went
to its own server, and answered **404 Not Found** — on the shop, over a ¥91
Aveeno order, to somebody who had got all the way to paying. The 404 page
named the payload exactly: `/int_2d5ba2b7a17e3d75_Aveeno baby`.

**It was first blamed on the VPN**, and turning the VPN off is what let it get
far enough to fail properly. A round lost to that.

`dealioQr()` now refuses a provider named `test` unless `BOARD_PAY_DEMO` or
`BOARD_DEALIO_DEMO` is on. One place, and both callers — the shop and Dealio —
go through it. Walked: on the box's shape Alipay reaches Stripe; under
`make try` and the demo rail the code still draws, which is the whole point of
the mock.

**AND A DEMO NOW CANNOT RUN ON A BOX THAT TAKES REAL MONEY.** `BOARD_PAY_DEMO`
and `BOARD_DEALIO_DEMO` are ignored whenever the Stripe key is `sk_live_`, and
the refusal prints at boot:

```
demo: REFUSED — this box has a live Stripe key. BOARD_PAY_DEMO and BOARD_DEALIO_DEMO are ignored.
```

Neither flag was set when the 404 happened — that was `BOARD_WALLET=test`, a
third switch — but an env var that can be set once can be set again, and the
key is a fact about the box rather than a thing somebody remembered. Three
switches could put a stand-in in front of a payer; now the live key closes two
of them and `dealioQr()` closes the third.

**A dead code is worse than no code.** The payer cannot tell whether the shop
is broken or they are, and the shop is the thing they were deciding whether to
trust.

## Tax came out of the supplier side — 25 Sep, never deployed

**"Tax is really none of our business. We are in China."** And that undid the
reasoning the whole thing was built on. The payout screen collected an ABN and
a GST registration because *without an ABN the payer must withhold 47% and
send it to the ATO* — which is true **of an Australian payer**. The WFOE is a
Chinese company. A WFOE wiring money to an Australian supplier has no ATO
withholding obligation, so we never had a reason to hold their ABN, and none
at all for the VAT and EIN that had started to follow it by analogy.

Out: the ABN and its checksum, the GST question, the "what your invoice needs"
row, and a half-built table of tax identifiers for six territories. What a
supplier owes their own revenue office is between them and it.

**What stays is `public/territory.js` — bank fields only, per territory.**
That part is real and it is ours: Australia uses a BSB, the United States a
routing number, Europe an IBAN, and the rest of the world needs a SWIFT/BIC
before anything can be sent at all. It lives in `public/` so the screen and
the server read the same table and cannot drift — the arrangement
`public/off.js` already uses.

| | |
|---|---|
| AU | name · BSB · account |
| CN | name · bank · account |
| HK | name · bank · account · SWIFT |
| US | name · bank · routing · account |
| FI | name · bank · IBAN · SWIFT |
| Anywhere else | name · bank · SWIFT · IBAN or account · country · address |

All six walked on a real board: each draws its own fields, none shows a tax
word, and the server accepts each shape and refuses a short routing number
and a one-digit IBAN typo.

**AND NO IDENTITY CHECK AT THIS LEVEL.** Finishing setup used to hand somebody
straight to *"Confirm it's you"* — photograph your passport, take a selfie —
when all they had done was ask where their money should go. Nothing there
needs it: `setPayout` takes no `verified` flag, so the bank details save
without one. Identity is still a row in Settings and still what the send flow
asks for when it genuinely needs it.

**AND THE SUPPLIER MAY BE CHINESE, WHICH IS THE ONE CASE WHERE THEIR TAX IS
OURS.** "Tax is none of our business" holds for a supplier abroad. It does not
hold when the WFOE pays a supplier **inside China**: that is a domestic
transaction between two Chinese entities, and **the WFOE needs a fapiao from
them to deduct the cost**. Not their obligation to us — our own deduction. The
books already track it as the "supplier invoice received" tick, which is
exactly the right mechanism; nothing new is needed, but nobody should read the
line above and conclude we can pay a Chinese supplier without chasing the
fapiao.

**THE SAVE BUTTON SAT UNDER THE iOS KEYBOARD BAR, on every form in the
wallet.** Reported from a phone: the up/down arrows and Done drawn on top of
it, the word showing through. Not a wallet bug — iOS does not shrink the
layout viewport when the keyboard opens, it draws over it, so `100dvh` stays
full height and anything pinned to the bottom of it is behind the keyboard by
construction. `visualViewport` is the only thing that knows the overlap;
`main` now pads itself by it, so a bottom-pinned button rises to just above
the keyboard. Zero when no keyboard is up, so nothing else changes.

**YOU COULD NOT ENTER A SWIFT IF YOUR PHONE SAID CHINA.** The payout fields
followed the wallet's region, which is guessed from the phone's clock at setup
and which **nothing could change** — there was no screen and no route, and the
code comment claiming Settings could was simply false. So a member in Shanghai
being paid into an Australian account got the Chinese form and no way out of
it. Where somebody lives and where their account is are different facts and
this screen only needs the second.

The account now carries its own country: the fields and the server's checks
both follow it, and it is stored on the beneficiary so the screen reopens on
what was chosen. **The picker is behind one quiet line** — the guess is right
most of the time and a country dropdown above the short Chinese form is one
more thing to read past. What is typed survives the switch, or changing
country reads as the app having eaten it.

**AND THEN THE TABLE ITSELF WAS WRONG.** It was written as if each payment
were domestic to its own country: Australia got a BSB and an account number,
the United States a routing number, and **neither was asked for a SWIFT**.
Right for an Australian paying an Australian. Wrong for us — **the payer is
always the WFOE, in China**, so every payout except a Chinese one is a
cross-border wire and needs a SWIFT/BIC whatever country it lands in. Reported
the moment somebody tried to add an Australian account and found no SWIFT
field anywhere.

The local number stays and the SWIFT sits above it: a BSB or a routing number
is what gets the money the last step to the branch, once the SWIFT has got it
to the bank. Both, not either. The beneficiary address comes with them, for
the reason it was always on the international branch — correspondent banks
screen, and no address is the commonest reason a payment is held. Mainland
China is the one exception, and it is the WFOE paying inside its own country.

**The same wrong assumption had put the wrong currency on the account** — the
wallet's, so an Australian account on a CNY wallet was stored as CNY. Fixed
with it: the currency follows the account's country. Verified: AUD stored, the
wallet still CNY.

**Two things on the Chinese payout branch:**

- **Fixed: it asked for the bank and not the branch** — and the label said
  "Bank" while the line under it asked for the branch, two instructions three
  inches apart disagreeing. The label now asks for what is wanted. The hint read "e.g.
  The hint read "e.g. China Merchants Bank", which is the bank; a domestic CNY
  transfer routes on the 开户行支行, and "招商银行" alone is where an interbank
  payment stalls and comes back.
- **Fixed: the China timing line.** It said *"Payments into China are checked
  first, usually 1–2 days"* — true of money arriving from abroad, and the
  payer is the WFOE, in China, so this is a **domestic transfer** and
  same-or-next-day like anywhere else. Every region now reads the same line.
  The string is kept rather than deleted: it will be wanted again the day
  anything outside China pays a Chinese member directly.
- **Fixed: a chooser with one choice.** *"When someone sends you money, where
  should it go?"* sat over a single row with a tick beside it. The other
  answer was "keep it in your wallet", which is the float this board cannot
  hold and which went months ago. It is a statement now.
- **Fixed: "your account details go to the provider."** The wallet's own
  plumbing, and the wrong subject on a screen about being wired money. The
  fact somebody wants there is what **we** keep, which is true whoever moves
  it: only the last four digits.

**THE PAYER'S HALF IS NOT AFFECTED.** The 开票信息 in `lib/fapiao.js` stays:
that is not somebody's tax affairs, it is the invoice **we** issue **them**,
in the country we are registered in.

## The two invoices — built 24 Sep, never deployed

A deal through the WFOE is **two invoices and one of them is ours**. The payer
is invoiced by the company they paid; the supplier invoices that same company.
Nobody is paid across a border in either direction. What is left between the
two numbers is the margin, and it is trading profit rather than a cut held on
somebody else's behalf — which is the line that keeps this out of 二清.

**The supplier's half was already there** (the payout screen in the wallet:
ABN, GST, and since today SWIFT/BIC, IBAN with its own checksum, bank, country
and beneficiary address). **The payer's half is new.**

| | |
|---|---|
| **开票信息** | On the payer's own pay page, as **one paste box**. Every Chinese company keeps its invoicing block as text and hands it over by long-press-copy-paste; six labelled fields would ask a finance clerk to retype an eighteen-character tax number on a phone. `board/lib/fapiao.js` reads it and shows back what it read. |
| **The tax number is checksummed offline** | 统一社会信用代码, GB 32100-2015, mod 31. Verified against two real codes and rejects any single-character typo. The 15- and 20-character old-style numbers have no check digit at all, so they are accepted on shape and said to be — never pretended to have been checked. |
| **The supplier's row is made from the payer's** | One press on the deal, and the number is **not typed**: `BOARD_MARGIN_PCT` (5) decides it once. Typing 1,900 beside 2,000 is how a deal quietly ends up at 4.7%. |
| **The books** | `Deals` in Dealio, and `make books` in a terminal. Both invoices on one line, the margin between them, the yuan actually banked, and what is owed on paper. `/api/books.csv` is the same thing for the accountant, with a BOM so Excel does not mangle the Chinese company names. |

**The margin is never stored.** It is one row minus the other, worked out
fresh every time. A stored percentage is a third number that can disagree with
the two invoices under it, and on the day it does nothing can say which of the
three is lying.

**And it only counts deals that have both sides.** The first version summed
every row, and a book with three jobs paid in and no supplier attached yet
reported a **32.4% margin** — every number in that sentence individually true.
Money in on a one-sided deal is now carried separately and named for what it
is: a job that has not been paid out.

**`BOARD_MARGIN_PCT` is not `store.FEE_PCT`.** That one is 2 and is the
processing fee on a straight Dealio payment. This one is 5 and is the gap
between two invoices on a WFOE deal. Different product, different path. If
they ever get confused the books are out by 3% on every deal and every
individual figure looks plausible.

**Two ticks are by hand and cannot be otherwise.** A fapiao is issued in the
tax bureau's own system and a supplier's invoice arrives as a PDF in somebody's
email. Neither event touches this board, so neither can be worked out here —
and a books screen that guessed would be worse than one that asks.

**THE WFOE CAN ISSUE FAPIAO — confirmed by Tom, 24 Sep.** So the payer's half
of a deal is a real 发票 and not a commercial invoice with a tax number
stapled to it, and `开票信息` is being collected because it is genuinely
needed rather than as paperwork.

**Two things that follows from, and neither is built:**

- **一般纳税人 or 小规模纳税人 is not recorded anywhere, and it decides a
  promise on the payer's screen.** The paste box offers a 增值税专用发票
  checkbox. Only a 一般纳税人 issues one itself; a 小规模纳税人 has to ask
  the bureau to 代开, and cannot always. So if the WFOE is 小规模, that
  checkbox is a promise made to a finance clerk before they pay and broken
  after. Nothing in the code knows which it is.
- **VAT is not modelled at all, and it is larger than the margin.** Every
  figure in the books is the amount as written. On a 6% services fapiao the
  output VAT inside a ¥100 invoice is about ¥5.66 — more than the 5% gap the
  screen calls the margin. Some of it comes back as input credit against the
  VAT withheld on the payment out, but that is an accountant's question and
  not one to answer in a comment. **What matters for reading the screen: the
  margin shown is gross, before any tax.** Nobody should be planning off it
  as though it were profit.

## The wallet IS the deals column now — built 24 Sep, never deployed

Tom's sketch (`/tmp` mock, Scenario 1): a phone showing **Earned here**, a big
number, **Still to come**, **Straight to · <bank>**, two pills, and the deal
underneath. Then: *"even the high level deal summaries the deals could be a
column that drops down."*

So `/wallet` home is now that. What changed:

| | |
|---|---|
| **The hero and the list come off ONE call** | `/api/books`. It read its figure from the provider ledger and its list from somewhere else, and on a board whose provider is `test` that is a headline of **A$0.00 over real money**. The figure is now the sum of the column under it by construction. |
| **A column of deals that drop down** | Native `<details>`, one line each: the two names and what came in. Open: invoiced, banked in yuan, paid out, margin, and the paperwork marks. Coarse first, finer on a tap — opening in place so a column can be read down. |
| **Gone from the hero** | `Australia · AUD · identity not confirmed yet` — a country nobody needs reminding of, a currency already on the front of the number above it, and an identity state the warning row below says properly and with something to press. |
| **Gone from home** | Recent / See all / Payment methods / Help. Methods and Help were already in Settings; the full payment history is now a Settings row so it did not simply stop existing. |

**Two things caught by looking at it rather than reading it:**

- **A second currency was silently dropped.** A$32,700 earned and ¥30,000
  still to come showed the first only. Now shown — **below the bank line, not
  above it**, because directly under the hero it lands where "Still to come"
  sits and a reader binds the two in the four seconds this screen gets. They
  are currencies that must never be added.
- **Long names wrapped** and shoved the figure down, so the column stopped
  being a column. One line each now (`min-width:0` is the half that is always
  forgotten — without it a grid track will not shrink below its content and
  the ellipsis never fires).

**What has NOT moved.** Send and Request still write to the wallet's own
provider ledger, which the hero no longer reads from. On a `test` provider
that ledger is empty so nothing disagrees today — but it is the seam, and it
is what the section below is about.

## Dealio absorbed the wallet's face — built 24 Sep, never deployed

**One money screen, at `/dealio?in=1`, which is where the Money tab already
points.** Tom's sketch, in his order: what you have earned, the deals under it
as a column that drops down, then the pad.

- **The hero** — Earned here, the number, Still to come, and where it lands.
  The payout warning was a row across the screen shouting the same sentence
  on every open, which is how a warning becomes furniture; it is now the
  third line of the hero, next to the money it is about, and it is a button.
- **The deals column** — native `<details>`, one line each (the two names and
  what came in), opening in place. Inside: invoiced, banked in yuan, paid
  out, margin, the invoice head, the paperwork marks and the two ticks.
- **The pad is gone.** Moving it down the page was wrong twice over: a huge
  faint ¥0 with no label reads as a broken element, and a number pad, a
  currency dropdown and one blue button is three mismatched controls where
  the drawing has two matching ones — in a second blue fighting the warning
  line above it. Both verbs open the sheet that has always asked for the
  amount when none was typed, so nothing is lost and the screen stops
  shouting in two colours.
- **Two folds, both shut.** The screen used to end in every open row as a
  wall of cards headed "Still to settle". Now: **Pending** with its figure,
  and **Deals** with its count — each a small window that opens. The two
  numbers agree with the two lists by construction, which is why the split
  falls where it does: Pending counts money still coming *to* you and opens
  on exactly those rows; money going *out* is the supplier half of a deal, so
  it lives under Deals where both halves are shown side by side. A "pending"
  figure that quietly included it would be wrong in the direction that
  flatters. "Still to come" left the hero — the same figure printed twice,
  inches apart, with nothing to say which was live.
- **The top runs the page's opposite palette**, not a shade of it: dark panel
  on the light skin, light panel on the dark one, each with its own text,
  muted, accent and buttons. Two surfaces four points of lightness apart do
  not divide a page, they look like a printing fault.
- **The top block sits on the page rather than running to its edges.** It
  used to bleed to both sides with only its bottom corners rounded, which
  reads as a band the page is wearing — while the shadow under it was already
  saying "an object lying on the page". A margin of page all the way round
  and four corners settles that argument in the shadow's favour.
- **The top is its own surface** — the money and the two verbs on a raised
  block, the deals on the page below it, so the glance this screen gets can
  tell "how am I doing" from "what is outstanding" without a heading to read.
  It needed a **shadow**, not just a shade: `--card` on `--bg` is four points
  of lightness apart, a difference you can measure and not one you can see.
- **`Deals` in the header became `Totals`** — the column is for reading, that
  screen is for reconciling and exporting, and they are different jobs.

**Three things only looking at it found:**

- **`.q` was already taken.** The hero's
quiet lines used a class the request card on the same page uses, declared a
hundred lines further down, so every one of them came out wearing a grey
  card. Renamed `.hq`. A class name that reads well on its own is not a free
  choice on a page that already has one.
- **One verb is not half a pair.** Sending is Stripe's half and was hidden
  on a board whose Connect is off, which left a single dark pill in the left
  half of the screen with a hole beside it. Send is now always drawn and only
  ever **disabled** — nobody walks into the dead end, and nobody meets a
  screen that looks like it lost a button. On the box Connect is on, so it is
  simply live. Wiring it properly is a later job.
- **The payout warning was the second loudest thing on the screen** — bold
  accent directly under the figure, in the slot the drawing gives to "Still
  to come". Still accent, now at the weight of the line it sits in.

**"WHERE DO WE SEND YOUR MONEY" IS A BUTTON NOW, AND IT GOES TO THE BANK.**
It was a quiet underlined link at the foot called "Where your money lands",
and it opened a sheet about a **Stripe connected account**. Two things wrong
with that: it looked like a footnote when it is the difference between being
paid and not, and what it opened was the rail rather than the answer. Nobody
thinks *"I must complete my Connect onboarding"*; they think *"where does the
money actually come to"*. The hero's bank line goes to the same screen — it
used to open the Stripe sheet, so one line meant the payout rail and the
button under it meant the bank.

**AND THE BUTTON LANDED ON THE WRONG SCREEN UNTIL IT DIDN'T.** The bank
details hang off a wallet record, so with none the central guard sent people
to the wallet's own sign-up — a wall about a provider that holds money, what
happens when a payment cannot be reversed, and card and PayPal fees. All true
of the wallet; none of it an answer to the question they pressed a button to
ask. Reported from a phone at 2am. `#payout` now has its own first screen:
the question as the heading, one sentence, the terms on one line, and the
bank fields straight after.

**THE STRIPE ONBOARDING STEP IS NOW OFF THIS SCREEN, AND THAT NEEDS A
DECISION.** `payoutRow()` has no callers left and `whereSheet()` is reachable
only through the `?a=where` deep link. Nothing is deleted, but for **any
member who is not Tom** that step is how they become payable at all — the
owner's own requests are a plain charge into the platform account
(`dealioMine`) and need no connected account, which is why taking it off the
screen costs Tom nothing and could cost somebody else everything. Either it
finds a home inside `/wallet#payout` beside the bank fields, or it goes for
good on purpose.

**ONE PAGE NOW.** `/wallet` no longer draws a home — it forwards to
`/dealio?in=1`. It had kept a near-duplicate home a version behind, and the
cards that say "Open wallet" (`money-card.js`, `wallet-card.js`) pointed at
it, so the tab showed the new screen and the card showed the old one and
which you got depended on the door. That was reported as *"I still see the
old money page"* and it was true. Everything behind a hash stays: `#payout`
(bank, ABN, GST, SWIFT, IBAN), `#setup`, `#verify`, `#settings`, `#limits`,
`#methods`, `#send`, `#request`, `#activity`.

**And a hash is now the only way in, so the hash screens had to be safe.**
Every one of them opens `const w = W.wallet` and reads a field off it on the
next line — fine while home sent anybody without a wallet to setup, and not
fine once home forwards. `/wallet#settings` for somebody who never set one up
threw on `w.passkeys` and answered *"Couldn't reach the Exchange"*, which is a
lie about the network. Guarded in one place in `paint()`, with setup, help and
home exempt.

**THE OLD LOOSE END, KEPT FOR THE RECORD:** `/wallet` keeps its own home,
which is now a near-duplicate of this one. It was not deleted because the
screens behind it are the only way to reach **setup, identity, limits and the
bank details** — including the ABN/GST and SWIFT/IBAN work from today. Two
things follow and neither is done:

- ~~The SWIFT and ABN fields are reachable only by typing `/wallet`.~~
  **Fixed.** The payout sheet now carries a link to `/wallet#payout`, and
  that screen no longer throws when it is opened by somebody with no wallet —
  it fell straight through to `w.region` and answered with a blank screen and
  an error toast.
- Send and Request on `/wallet` still write to the provider ledger. On a
  `test` provider it is empty so nothing disagrees today.

## Next: Dealio absorbs the wallet

**The problem.** Two money screens, both with Send, Request and a list of
what is owed, and only one of them can take money.

- **Dealio** — a link to somebody with **no account**. They open a URL and
  pay. Stripe. This is the product, and it is the half that works.
- **The wallet** — member to member, both sides needing a wallet, on a
  provider that is not connected. Nothing links to `/wallet`; the code in
  index.html says so in as many words, *"the wallet page nothing links to"*.

So the wallet is the better-made half of a product nobody can reach. Dealio
takes its screens; `/wallet` stops being a page.

**What moves across.** All of this was built or cut on 24 Sep and is worth
keeping:

- **Earned here / Still to come** as the hero, never a balance
- **Ink**, no coloured slab — the number is the loudest thing by size
- **Two verbs**, full-width pills, no icon-over-label tiles
- **Three-screen setup**, region guessed from the phone's clock
- **Identity on the provider's page**, which is where it belongs

**What goes.** The balance, Add and Withdraw are already gone — the board
cannot hold money and must not look as though it does. The second setup
flow goes with the page.

**What stays Dealio's.** The link to a stranger is the whole point. So is
`?in=1` — the plain address paints the sales page on purpose, and a member
pressing a tab called Money must not get the pitch. The currency picker
stays.

**Decide before writing any of it:**

- Does a member paying a member also go through a link? Simplest answer is
  yes, and then there is one flow rather than two.
- `board/lib/wallet/` is not the page. The eleven-call provider interface and
  the ledger are the good part and should survive whatever happens to the
  screens — `qfpay.js` and `airwallex.js` are written against it.
- The Money tab keeps its name and its address. Only what it draws changes.

**Three traps found tonight, all of which will bite this work:**

- **The wallet only knows PUBLISHED members** (`q.state !== "published"` in
  `lib/wallet/index.js`), and Dealio does not — it matches the device on the
  request. So one browser is Tom to Dealio and a stranger to the wallet, and
  the wallet says *"once your page is up on the board"* to somebody whose
  page is up. Whatever absorbs which, there must be one rule.
- **`IN_APP` hides the Money tab completely** — the payments product was kept
  out of Apple's build on purpose. That decision has to be re-made
  deliberately, not inherited.
- **`BOARD_WALLET` must name a provider or `/wallet` 404s.** Taking Airwallex
  out of `.env` tonight turned the entire wallet off, tab and all, and that
  took a round to notice. It is `test` on the box now: every screen works,
  no money moves.

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

### A partner on his own name, paid into his own Stripe — built 25 Sep, not deployed

`make partner`. My server, my code, his domain, his colour, his Stripe.
Three halves, and the third is the one that was actually the mockup:

- **his name** — a hostname on this same board container
  (`docker/sites/board-partner.caddy`), the third copy of `board-also`'s shape
- **his face** — the money screen in his navy, his name in the tab and over
  the figure, no board bar, and none of Dealio's front page. `data-skin` on
  `<html>`, a palette block built in `server.js` from validated hex, the same
  mechanism `data-dealio` has used since there were two products
- **his Stripe** — the OAuth pair in `board/lib/stripe.js`
  (`linkUrl`/`linkFinish`, which connects an account somebody ALREADY has)

Looked at on all three skins before it was committed: his, Dealio's dark one
and the board's light one. One bug found that way — `.bigwhere` was
`var(--ink)` on `var(--bg)`, which is the same near-black as the top block on
both of our own skins and is two different darks fighting on his. It is
`var(--top)` now, which is the deep colour by definition.

**The face is one colour, and that is from reading the mockup rather than
guessing.** It declared a navy and a gold; the gold appears twice, on his logo
and his nav underline, both of which live on HIS site. The money screen in it
was navy, white and the neutrals it already had. A partner asked for ten hex
codes is a partner who does not reply.

**He never sends a secret key, and that is structural rather than polite.**
One `BOARD_STRIPE_KEY` serves this whole container — the board, both its
names and Dealio — so a partner's key written here would take every payment
on the box, his and ours together. Tom asked why a friend cannot just send
one; this is the answer.

**The direction is the opposite of the 21 Sep question above.** That asked
Daniel to be the PLATFORM and us the connected account, because we had no
Stripe. We have one now (Aozhou Baba, live, took a real payment 24 Sep), so
this makes him the connected account and us the platform. Both are Daniel and
Stripe and Luxembourg; they are not the same deal, and which way round it is
decides who is merchant of record for a European transaction. Worth settling
out loud before it is offered to him.

**Not established:** whether Connect is switched on for `acct_1UIVjEJItwOUeslJ`
at all. `make partner` with no arguments asks Stripe and says. Also unasked:
whether an Australian platform may link a Luxembourg account — Stripe has no
endpoint for it, and the authorise screen is what settles it.

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
