# Europay — payments, Stripe, and connected accounts

For another session picking this up. Written 26 Sep 2026 from `NOW.md`,
`board/lib/stripe.js` and `board/server.js`. Where something is unverified it
says so — the unverified lines are the expensive ones.

**No secrets here.** Keys live in `.env` on the box and nowhere else. Account
ids and the OAuth client id are not secrets (the client id rides in the
authorize URL by design) and are already in `NOW.md`.

---

## 1. What Europay is

A white label of the board's payment screens, served on a partner's own
hostname. `europay.paydealio.com` is the demo instance.

| | |
|---|---|
| **Sells** | a Chinese client can pay a foreign business in the wallet they already use |
| **Why anybody needs it** | Stripe, Shopify and a bespoke portal all fail the same way: no WeChat Pay or Alipay from a payer inside China |
| **Who it was drawn for** | Daniel (Algotech). See §11 — `NOW.md` recommends that portal NOT be built, and the software outlives the deal |
| **What it is not** | a wallet, a custodian, or anything holding money. Money never passes through us |

The same hostname serves the board's code with a different skin. There is no
separate application.

---

## 2. Two revenue models, and they are not the same product

| | **Raise the charge** | **Read only** |
|---|---|---|
| We take | **0.5%** of each charge, automatically | a subscription |
| Mechanism | `application_fee_amount` on a direct charge | `scope=read_only` OAuth, we read their charges |
| Needs | the payment to go through our checkout | nothing but the connect |
| Honest scope | `read_write` (see §6) | `read_only` |

**The 0.5% only exists where we raise the charge.** A merchant who keeps their
own checkout and just wants commission reporting is the read-only product, and
taking a percentage there would mean money we never touched. Do not blur these.

---

## 3. The words. This is a payments risk, not a style note

**Do not describe this product as multi-level, as a network with people
beneath you, or as anything paid on recruitment.** Two reasons, and either one
alone is enough:

| **Stripe** | its prohibited businesses list names *"multilevel marketing services offering commission or recruitment-based sales"*. Everything here settles through Stripe Connect on the platform account in §4 |
|---|---|
| **China** | in the mainland, where every reader of the page is, that same vocabulary (传销 / 多层级) describes a **criminal offence**, not a business model |

Fixed in `ae122c9` — the strapline, the caption under the blocks and four
phone-screen labels. The current wording:

| was | now |
|---|---|
| multi-level agent networks | agents and the clients they invoice |
| one person **under you** | one person **you introduced** |
| everyone **beneath you** | everyone **you introduced** |
| their people | they introduced |

**Nothing about the mechanics changed.** The tree shows what it showed; it is
described as introducing rather than as depth. Key names and code comments
keep the old words because nobody reads those — so `ep.beneath` and
`ep.pyrWhat` are still the keys, and grepping for the old vocabulary will
find them.

**This applies to anything new.** A commission that pays on a second or third
tier is the thing to be careful about describing, whatever it is called. If a
page needs to show more than one tier, describe each person by what they
**invoiced**, never by their depth under somebody.

---

## 4. The Stripe accounts, and which key is which

| | |
|---|---|
| **Platform account** | Aozhou Baba, `acct_1UIVjEJItwOUeslJ`, AU |
| Charges | on |
| Payouts | on |
| Bank account | present |
| Connect | **approved 25 Sep 2026** — may create live accounts and charges |

**Payment methods on that account, read 24 Sep:**

| Alipay | **on** |
|---|---|
| Card | **on** |
| **WeChat Pay** | **INELIGIBLE** — not pending, not queued |

WeChat Pay being ineligible while Alipay is on rules out country and currency
(Stripe's WeChat Pay supports AUD). What is left is the business category:
WeChat Pay applies its own restricted list on top of Stripe's. Unresolved.

### The key trap, and it cost an evening

**The box has run on a TEST key.** `make pay-check` prints it — *Stripe key
set · test*. Test mode is identical on screen: same buttons, same Alipay, same
refusals. A session called three sandbox links "a real ¥1" because it checked
the demo flag and never checked the key.

- **Check the key, not the demo flag.** They are different switches.
- The live account's figures above were read with a key typed at a prompt
  (`make wallets ASK=1`). That never touched the box's configuration.
- `NOW.md` says roll the live key before it goes on the box. **Tom has
  decided not to.** Do not raise it again.

---

## 5. Direct vs destination charges — the whole decision

`board/lib/stripe.js` → `checkout()`. The two are one question with two
answers; sending both throws before Stripe sees it.

| | **Destination charge** | **Direct charge** |
|---|---|---|
| Raised on | our platform account | **the partner's own account** |
| Mechanism | `transfer_data.destination` | **`Stripe-Account: acct_…` header** |
| Merchant of record | us | **them** |
| Statement shows | us | **their name** |
| Chargeback comes out of | **us** | **them** |
| Our 0.5% | `application_fee_amount` | `application_fee_amount` — **works on both** |

**Use direct for every white-label partner.** A partner is a business we did
not onboard, in a country we do not trade in, whose clients pay by card — the
one method that does have chargebacks. A destination charge makes this
platform liable for a company nobody has audited.

That `application_fee_amount` works on both is what makes this a real choice
rather than a trade: nothing is given up by putting the liability where the
business is.

**A plain charge has neither key.** A shop selling its own goods has nobody to
transfer to, and `transfer_data: {}` makes Stripe refuse the whole session —
the key must be absent, not empty.

**Webhooks change, but not in code.** A direct charge's events belong to the
connected account, so the endpoint must be listening to connected accounts —
a dashboard setting. Same URL, same signature, same `client_reference_id`,
plus an `account` field naming whose it was.

---

## 6. Connecting an account somebody already has

`board/lib/stripe.js` → `canLink()`, the authorize URL builder.

| | |
|---|---|
| Mechanism | Stripe Connect **OAuth**, Standard accounts |
| Client id | `BOARD_STRIPE_CLIENT_ID` in `.env`; set with `make whitelabel ID="ca_…"` |
| Redirect URI | `https://europay.paydealio.com/china/linked` — registered |
| Scope | **`read_write`** |
| Door | `/china/connect` |
| Landing | `/china/linked` → `setPayout(..., "stripe")` stores the `acct_…` on the wallet |

### `read_write` is broader than the screen says

The connect screen tells the partner:

> We can — pass on your charge and see if it clears
> We cannot — move your money or see your balance

**`read_write` does not enforce the second line.** It grants refunds, balance
and payouts. The code carries a comment saying so. The screen is a statement
of intent, not a technical guarantee, and anybody changing that wording should
know which it is. `read_only` is the honest scope for the analytics product
and cannot create a charge.

### Three profile answers nobody has read back since approval

Whatever the approved Connect profile says is what the integration actually
behaves like. Two of these would quietly undo built work:

| **Account type** | must be **Standard** — Daniel has his own Stripe login; anything else and OAuth is not the mechanism |
|---|---|
| **Loss liability** | must be **the connected account** — this is the direct-charge choice. "Platform" puts his chargebacks back on us by ticking a box |
| **Connected account countries** | must include **Luxembourg** |

**Check these before a partner connects, not after.**

---

## 7. The fee

| | |
|---|---|
| Variable | `BOARD_STRIPE_DIRECT_PCT`, default **0.5** |
| Applies to | any account listed in `BOARD_STRIPE_DIRECT` |
| Set with | `make whitelabel PCT="0.5"` — refuses anything that is not a sensible percentage |
| Board's own fee | `store.FEE_PCT` = 2, and that is right for the board — a member paying a member on rails that cost real money |

**Why 0.5 and not 2.** A partner's business is volume, and 2% at the door is
more than the trade is worth. Tom cut it from 5% on 25 Sep.

---

## 8. Environment variables — the naming trap

**`.env` holds `TOMSCODING_*`. The container sees `BOARD_*`.**
`docker-compose.yml` maps one to the other.

So grepping `.env` for a `BOARD_` name always finds nothing, and a `grep -c`
returning 0 means "not under that name", **not** "off". This cost an evening:
the demo payment flow was switched off by deleting a line that did not exist,
the check agreed, and the next payment was still a demo.

**Ask the container instead** — it cannot answer for a name nobody set:

```
docker compose exec -T board printenv BOARD_DEALIO_DEMO
```

Names that matter here:

| `BOARD_STRIPE_CLIENT_ID` | the OAuth client id; `canLink()` is false without it |
|---|---|
| `BOARD_STRIPE_DIRECT` | accounts that get direct charges |
| `BOARD_STRIPE_DIRECT_PCT` | the 0.5 |
| `BOARD_WHITELABEL_DOMAIN` | the partner hostname |
| `BOARD_WHITELABEL_FRONT` | `off` puts `/` back on the money screen |
| `BOARD_DEALIO_DEMO` | the demo payment flow |

---

## 9. The white label

| | |
|---|---|
| Skin | `LABEL_CSS` in `server.js`, built from the partner's two hex values — a deep ink and an optional paper |
| Template tokens | `{{SKIN}}`, `{{SKINCSS}}`, `{{LABEL}}`, substituted in `page()` |
| Front page | `/` on the partner hostname → `europay.html` (the landing page), or `dealio.html` when `BOARD_WHITELABEL_FRONT=off` |
| Get started | `/start` → `https://<dealio domain>/china/connect` |

**The skin makes the palette LIGHT.** `LABEL_CSS` sets `--bg:#EEF0F4`,
`--ink:#151B28`. Anything on a white-label page that paints a colour the skin
does not define will sit dark-on-dark, or invisible, the moment a partner sets
a paper. The rule, learned twice:

> **Anything the skin does not define must not sit behind anything it does.**

`/start` exists because Get started went to a blank screen — `/dealio` renders
a name and a Sign in button to somebody who has agreed to nothing.

---

## 10. Deploying

**Claude has no network path to the server.** Every deploy is a command handed
to Tom. Never claim something is live until he says it is.

```
ssh -t root@45.77.8.166 'cd ~/tc && git fetch origin && git reset --hard origin/<branch> && make up'
```

- **`-t` always.** Without it the output block-buffers and a working build
  looks frozen.
- **`git reset --hard`, not `git pull`** — a pull once left a merge commit and
  `make deploy` refused with "Diverging branches".
- **`make up`, not `make deploy`,** when the box has been reset to a commit
  from a different branch. `make deploy` does its own `git pull --ff-only` and
  that pull can never succeed when the branch name and the commit disagree.
- **A git pull on the box does not update `board/`.** Everything under
  `board/` is COPYed into the image at build time; only `scripts/` is
  bind-mounted. A change to a page needs a full build, and nothing says so if
  you skip it.

---

## 11. What is NOT settled

These are the lines that decide whether any of this ships. None of them is a
code question.

| **Algotech should not be built** | `NOW.md`'s recommendation. Vantage Markets holds custody; Daniel is PAMM manager 983/dfidj and holds nothing |
|---|---|
| **This is a capital account transaction** | not a current account one. China's $50,000 individual quota **explicitly excludes** overseas securities and investment. The failure mode is a frozen account, not a declined payment |
| **Both wallets prohibit it by name** | WeChat Pay's and Alipay's merchant terms exclude funding investment or trading accounts |
| **The blocker is on the payer's side** | and is independent of Daniel's legality. He is not doing anything illegal — the brokerage takes custody, not him |
| **Nobody has asked** | Stripe, WeChat or Alipay about any of this |
| **WeChat Pay ineligibility** | unexplained; check Settings → Business details for the filed industry |
| **The three Connect profile answers** | §6 — unread since approval |
| **Our 0.5% comes out of principal** | a percentage of a deposit, taken from the client's own capital before a single trade. Different to disclose than a cut of revenue |

---

## 12. Where the code is

| `board/lib/stripe.js` | `checkout()`, `canLink()`, the OAuth URL, `makePayee` |
|---|---|
| `board/server.js` | `orderWays()`, `/api/order/:id/pay`, `/start`, `page()` and the template tokens, `LABEL_CSS` |
| `board/public/europay.html` | the white-label landing page and the affiliate pyramid |
| `board/public/order.html` | the pay screen — wechat / alipay / card |
| `board/china/connect.html` | the connect door and its "We can / We cannot" wording |
| `board/public/i18n.js` | every string, both languages, `ep.*` and `od.*` |
| `scripts/whitelabel.sh` | `make whitelabel` — reads and sets the partner config |
| `scripts/connect-check.mjs` | lists connected accounts |
| `docs/prototypes/` | the pyramid, standalone, invented numbers |

## 13. House rules that apply to anything written here

- Strings go in `i18n.js` in **both** languages, Chinese written rather than
  translated. After every edit:
  `grep -o '^  "[a-zA-Z0-9._]*":' board/public/i18n.js | sort | uniq -d`
- **The product does not claim to be encrypted.** It is not.
- **The Chinese payer already knows how to pay.** Lead with the gesture they
  make (`长按二维码识别`), not an explanation of their own wallet.
- Comments say *why*, including what was tried and what broke.
- Tom is visually impaired. Hand over one command, never a numbered list.
