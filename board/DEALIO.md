# Dealio — the finished design

> Two people are chatting. One of them sends the other a request to pay.
>
> That is the whole product. Everything below is that sentence, drawn.

This file is the design. It is written to be built from — screen by screen,
state by state, string by string. Where something is already built it says
so and names the file; where it is not it says what to build and why it is
shaped that way.

Step one of three: **a page on the board** (`/dealio`), then its own domain,
then an app if it ever earns one. That is why it carries its own palette,
its own layout and its own name rather than the board's chrome — a page
wearing the board's chrome is a page that cannot leave.

---

## The rules that decide everything else

**1. The money never touches us.** Not held, not routed, not forwarded.
Stripe is merchant of record on a destination charge: `application_fee_amount`
plus `transfer_data[destination]`. Anything that puts a member's money in a
balance we control is 二清 under State Council Order 768, and it is not a
grey area.

**2. The person paying needs no account.** No app, no sign-in, no code, no
Dealio. They get a link, they see a number and a name, they pay. Every time
this design has gone wrong it is because something crept in front of that.

**3. The person asking does need an account** — somewhere for the money to
land. That asymmetry is not a flaw to be smoothed out; it is the product.

**4. There is no chat in Dealio, ever.** The conversation already exists and
it is WeChat. A fourth chat means asking two people to move a conversation
they are already having, which nobody does. Dealio writes the message; the
person pastes it where they are already talking.

**5. Direction is not symmetric.** The *receiving* side needs a Stripe
account we can transfer to — Australia is proven, mainland China is
impossible. The *paying* side can be anywhere. So:

| | Payer | Payee | Works today |
|---|---|---|---|
| Ask for money | China (WeChat Pay / Alipay / card) | Australia | **Yes** |
| Send money | Australia | China | **No** — needs the HK company + Airwallex |

`way: "out"` is built and the screens are right, but it lands only where a
Stripe account exists. The page says so rather than failing at the end.

---

## The vocabulary

Every word on these screens was picked after a word was thrown out.

| Say | Never say | Why |
|---|---|---|
| Ask for money | Request, Invoice, + | "Do you really think people know what ＋ means" |
| Send money | Transfer, Payout | Same sentence, other direction |
| Paid | Settled, Complete | It is the word people use |
| Waiting | Pending, In progress | Waiting on a person, not a system |
| Called off | Cancelled, Void | A person did it, not a system |
| — | Open a room | 开房 is Chinese slang for taking a hotel room |
| — | Both sides have agreed | Summarises two lines you have just read |

---

## The screens

### Home — signed out  `dealio.html · signedOut()` — **built**

A door has one handle. Nothing else on the screen.

```
  ● DEALIO                                    [EN/中]

                      Dealio
        Ask anyone to pay you. They need no
        account, no app and no card on file.
                      ────
              This phone is not signed in.
        Dealio uses your Exchange sign-in.

            [ CONTINUE WITH GOOGLE ]

             I have an invite code          ← a link, not a button
```

It used to be a single `SIGN IN` button to `/enter`, the board's invite door,
which asks for six characters — and Tom, who had never been told about a
code, asked "what 6 digits". The code is for somebody arriving for the first
time. Everybody meeting this screen is already a member on a phone that has
forgotten them, and for *them* the Google account is what finds the person
again: the callback moves their row onto whatever browser pressed it.

Dealio also mints its own device id now if there is none. Without one there
is nothing to hand to the sign-in, and the sign-in refuses a browser it
cannot name — which is why the home-screen app could not get back in.

### Home — nothing yet  `dealio.html · empty()` — **built**

An invitation, not an apology. The buttons sit in the middle of the page
where the eye already is, not at the bottom of a tall black nothing.

```
                      Dealio
              Ask somebody to pay you.
                      ────
                 Nothing here yet
        Ask somebody to pay you and it shows
        up here until they do.

            [   ASK FOR MONEY   ]   ← solid, accent
            [   SEND MONEY      ]   ← outlined
```

Asking is solid because it is what most people open this for. Sending is
outlined *beside* it — not behind a menu — because it is half the cases.
Stacked, not side by side: at 390px two uppercase labels in one row crush to
two lines each.

If there is nowhere for the money to land, the payout box appears under the
buttons (see below).

### Home — the list  `dealio.html · list()` — **built**

```
  ● DEALIO                                    [EN/中]

  Money                                     ← dl.head
  Asked for and owed.                       ← dl.sub

  ┌──────────────────────────────────┐
  │ Mei                      ¥2,400  │  ← serif, tabular
  │ → you asked · 12 lessons  WAITING│
  └──────────────────────────────────┘
  ┌──────────────────────────────────┐
  │ Sasha                      A$180 │
  │ ← you are sending · design  PAID │  ← green chip
  └──────────────────────────────────┘

  ┌ pinned ─────────────────────────┐
  │ [   ASK FOR MONEY   ]           │
  │ [   SEND MONEY      ]           │
  └─────────────────────────────────┘
```

Direction comes **first** in the second line, because a list holding both
needs it before anything else. Amount right, in the serif, tabular — that is
what the eye runs down the list looking for.

The buttons pin to the bottom once there is a list to scroll past. They are
the only thing the page is for; they do not scroll away.

### Nowhere for it to land  `dealio.html · payoutLine()` — **built**

```
  ┌──────────────────────────────────┐
  │ Nobody can pay you yet           │
  │ You have not said where the      │
  │ money should land.               │
  │ [      SET THIS UP       ]       │
  └──────────────────────────────────┘
```

Said with the button that fixes it, not as a line of red text. Twice this
screen has been a dead end — an instruction about a thing that was not on
the screen. Each refusal names itself: a mainland payee cannot be onboarded
at all, and being told so beats four Stripe pages ending in no.

### Making one  `dealio.html · form(way)` — **built**

```
  ASK FOR MONEY
  Ask somebody to pay you

  [ ● Say it ]                        ← only when the server can hear
  ────── or type it ──────

  Amount      ┌──────────────┐
              │ ¥2,400       │        ← serif, 2.1rem
  Who         ┌──────────────┐
  What for    ┌──────────────┐
  When        ┌──────────────┐        ← optional

  [        ASK        ]  [ Cancel ]
```

Amount first and large: it is the one field that cannot be blank. The
microphone sits **above** the fields and full width, because it fills all of
them — a microphone inside the first field would say it fills that one.

### Have I got this right  `dealio.html · heardSheet()` — **built**

```
  HAVE I GOT THIS RIGHT?

  You are asking Mei for ¥2,400 for
  twelve lessons, starting Tuesday.      ← serif, 1.35rem

  How much is each lesson?               ← the one question, if something is missing

  ─────────────────────────────────
  "twelve lessons with mei at two
   hundred each starting tuesday"        ← their own words, quieter

  [        YES        ]  [ No ]
```

**Nothing is written until they say yes**, and that is not a nicety to drop
once the extraction gets good — it is the whole safety of the feature. A
model pulling money terms out of speech will be wrong eventually, and it is
money. The server transcribes, not the browser: in a standalone iPhone app
`webkitSpeechRecognition` is defined and does nothing, and Chrome's
recogniser is Google's, which is not reachable from inside China. Both are
exactly the people this is for.

`lib/terms.js` is forbidden from inventing an amount — *empty is always
better than plausible*.

### The message  `dealio.html · sent()` — **built**

One press made the request; this is the other half of that press. Nobody
makes one and then goes looking for what to do next.

```
  READY TO SEND
  To Mei

  ┌────────────────────────────────┐
  │ Mei — ¥2,400 for 12 lessons.   │
  │                                │
  │ https://thexchange.app/pay/…   │
  │                                │
  │ Tap it to pay. Nothing to      │
  │ install.                       │
  └────────────────────────────────┘

  [       COPY       ]  [ Done ]

  Nothing is owed until they pay.
```

Copy uses the old `execCommand` trick first: the async clipboard is refused
by phones outside a gesture and by WeChat's browser entirely.

### One request, opened  `dealio.html · one()` — **built**

What it says, the message again, and a way to take it back. Settled ones
cannot be withdrawn — the money moved.

---

## The paying half — `/pay/:id`  `request.html` — **built**

No account, no app, no code. This page is the product.

```
  Christopher is asking for ¥1        ← the name and the number, first
  for a test

  [        PAY ¥1        ]

  WeChat Pay · Alipay · Card
```

Direction-aware throughout: `rq.asking` / `rq.sending`, `rq.straight` /
`rq.straightOut`, and the chip reads `rq.needsYou` when `state === "asking"`
— never "Waiting on them" to the person who *is* them.

Every refusal is its own sentence, because "That did not open — try again"
three times in a row is what a missing currency looked like for a day:

| Refusal | Means |
|---|---|
| No currency on this one | Minted wrong — `curOf()` could not read the sign |
| Already paid | It went through |
| Nowhere for it to land yet | The receiving side has no Stripe account |

### A code instead of a checkout — **built, sandbox only**

On the box with Airwallex keys, WeChat Pay and Alipay draw a **QR on this
page** rather than handing the payer to anybody. They long-press it, pay in
the wallet they already had open, and the row settles itself.

```
  12 lessons  ¥2,400              [ Back ]

        ███ ▄▄ █ ▀▄ ███
        █ █ ▀█▄▀▄▀▄ █ █          ← drawn from rows of 1s and 0s
        ███ ▄ ▀█ ▀▄ ███            the server sends. Nothing fetched.

  长按二维码识别。或者截屏，再长按那张图。
```

**One person, because the money has one destination.** Every payment those
keys confirm lands in the single Airwallex account they belong to. Paying
anybody else that way needs connected accounts, which Airwallex has not
approved. So `BOARD_DEALIO_OWNER` names the one board handle whose own
requests may use it — `make dealio-me WHO="Tom"` — and `dealioWays()` in
server.js is the whole gate:

| Must be true | Or the page falls through to Stripe, unchanged |
|---|---|
| The provider can draw a code **and** ask about it later | no `qrPay`/`intentStatus`, no code |
| The asker's handle is `BOARD_DEALIO_OWNER` | somebody else's client would be paying the wrong person |
| `way: "in"` | money coming in, not a promise to send |
| `cur: "cny"` | what these two wallets take |

**Nobody comes back, so both sides ask.** The payer leaves for their wallet
and may never return to this page. `GET /api/request/:id/check` asks the
provider and writes both halves of `said` with `auto: true` — the payer's
page polls it every three seconds while the code is up, and `/api/requests`
asks about up to three of the asker's own unsettled codes when they open
their list. One live call per request per four seconds, whoever is asking.
A webhook would be better and is next: it needs a public address registered
in Airwallex's dashboard and its secret in `.env`, and asking needs neither.

**`ready` is not about Stripe here.** A code needs nowhere for the money to
land, and that was the whole of why this page said "{who} has not said where
the money should land" under a perfectly good amount on the box that has
Airwallex and no Stripe. `ways` comes back with the read now, and the sheet
draws only the buttons that can work — two, not three with a dead one.

### States  `lib/request.js · requestState()`

| State | Chip | Means |
|---|---|---|
| `due` | DUE | Asked for, not paid |
| `asking` | NEEDS YOU | `way:"out"` and no account to land in yet |
| `waiting` | WAITING | Payment claimed, webhook not in |
| `paid` | PAID | Confirmed |
| `off` | CALLED OFF | Withdrawn by the asker |

`requestView` is an **allowlist**, never the row minus fields. `acct`, `by`
and `toWho` never leave the server.

---

## The screens, continued

### Sign-in — what it is and is not

Browser storage is per-origin and iOS gives a home-screen app its own, so
saving Dealio to the home screen makes it a stranger: `board:device` is
empty there and the sign-in is gone. Tom hit exactly this — *"when i saved
to homescreen and opened, the ASK FOR MONEY button was gone."*

For step one, the fix is the screen above: say it uses the Exchange
sign-in, and lead with Continue with Google so there is no code to type.
For step two it needs its own door, and that is a decision about who Dealio
is for — the board is invite-only and Dealio, on its own domain, probably
is not. **Do not build step two without asking.**

### Paid — the history  `dealio.html · paid()` — **built**

The list shows what is still open. Paid answers "has this person ever
actually paid me" — the question that decides whether you say yes to the
next job.

```
  ● DEALIO                                    [EN/中]

  Paid
  Everything that settled.

  ── This month ────────────────────
  Mei                          ¥2,400
  12 lessons · 14 Sep · → in

  Sasha                         A$180
  design · 2 Sep · ← out

  ── August ────────────────────────
  Mei                          ¥1,800
  9 lessons · 28 Aug · → in
```

Both directions, grouped by month, newest first, no chips — everything here
is paid, so a chip saying so on every row is noise. One line per row, month
rules instead of cards. Reached from the list header, not a tab bar: two
screens do not earn a tab bar, and a bar across the bottom would sit exactly
where the two buttons are.

No new route: `/api/requests` already carries every request in both
directions with its state on it.

**Settled rows came off the live list when this was built.** They were on it
under a green chip, so the home screen grew by one line for every job ever
done and never shrank — the thing still owed sat further down the page each
month.

## Not built

### The Cards line  **design below, not built**

On the board's Cards page, under each contact:

```
  Mei
  ¥4,200 paid · 2 jobs
```

Money is the only fact on a card that is not somebody's opinion. It goes
under the name, quiet, in the board's own type — this is the board's screen,
not Dealio's, and it does not get Dealio's palette.

> Server: sum confirmed requests per counterparty. Never show a total to
> anyone but the two people in it.

---

## What has never been watched finish

**Real money.** On 20 September 2026 the whole chain ran on the live box on
sandbox keys, on a phone, for ¥1: request made from a terminal, link opened
in WeChat, PAY, WeChat Pay, a real Airwallex code long-pressed, Airwallex's
own page, paid — and the row went green with nobody pressing anything on
this side. `make pay-check` counted it. That is the step that had never been
watched finish, and it has now.

What is still theory is the money. Sandbox keys mean Airwallex simulated the
wallet; no yuan left anybody's phone. The live account is still in review,
and until it is out, `BOARD_WALLET_AIRWALLEX_SANDBOX=0` is the one line
between this and a real payment.

**A card.** On the Airwallex box there is no card path at all: Stripe is not
configured and Airwallex's card component is a browser hand-off nobody has
wired. The sheet draws two buttons and says nothing about a third, which is
right, but "Card" is a thing people ask for.

---

## Testing it

Three commands, no phone needed for the first two:

```
make pay-check                                      # can this box take a payment
make ask WHO="Christopher" AMOUNT="¥1" FOR="a test" # mint one, print the link
make hear TEXT="twelve lessons at 200, Tuesdays at seven"   # what it makes of speech
make dealio-me WHO="Tom"                            # codes on, and a ¥1 link
```

`make ask` must print `https://thexchange.app/pay/…`. If it prints
`http://board:8080/…` the box is on old code — that address is real and
exists only inside the compose network, and a phone gets nothing.

Stripe is in test mode: card `4242 4242 4242 4242`, any future expiry, any
CVC.

Locally, `make try` stands the whole thing up and takes it away again on
Ctrl-C.

---

## For whoever builds this

Branch: `claude/coding-platform-vpn-alternative-i06xoc`. One screen is left
under **Not built** — the Cards line. Everything else on this page is
standing and has been looked at in both languages.

Strings go in `board/public/i18n.js` in **both** languages, the Chinese
written rather than translated, then:

```
grep -o '^  "[a-zA-Z0-9._]*":' board/public/i18n.js | sort | uniq -d
```

Then deploy and prove the one step nobody has watched finish — a ¥1 payment
going all the way to PAID:

```
cd ~/tc && git fetch origin && git reset --hard origin/<branch> && make deploy
```

`git reset --hard`, never `git pull` — a pull once left a merge commit on
the box and `make deploy` refused with "Diverging branches". Then
`make pay-check`, then `make ask WHO="Christopher" AMOUNT="¥1" FOR="a test"`,
open the link, pay with `4242 4242 4242 4242`, and watch the row flip.

**Rules.** Never paste an API key or a Stripe account id into chat — they
live in `.env` on the box. `WHO` is a first name everywhere. Tom is
visually impaired: hand him one line at a time to run, never a numbered
list, and never "click the button top right".
