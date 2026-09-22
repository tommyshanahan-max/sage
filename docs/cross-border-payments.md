# Cross-border payments: what the board may assume

Researched 18 September 2026 by a second session, against current sources
(links at the end). This is the ground truth for anything The Exchange builds
around money between mainland China and everywhere else. It is general
information, not legal or tax advice, and the numbers marked **unverified**
must be checked before they are shown to a member.

## The rule this all rests on

**The board never holds, routes or forwards members' money.** It records what
two people agreed and what each says has been paid. One member pays the other
directly, on the payee's own payment page or by bank transfer.

The moment the board — or Tom's company — collects a member's money and passes
it on, it is an unlicensed payment business: in China 二清, illegal under State
Council Order 768, in force May 2024. Nothing below changes that.

Who Tom is today: an Australian sole trader with an Australian bank account.
No Chinese company, no mainland bank account, no ICP licence.

## Flow 1 — money into China

Someone overseas pays a mainland person. Legal: service income is an ordinary
receipt for a mainland individual.

| Rail | Per transfer | Per recipient, per year | Notes |
|---|---|---|---|
| Wise → Alipay | ¥50,000 | ¥300k–600k (sources disagree) | Recipient needs a mainland ID. Business senders may only choose "Salary" or "Services" |
| Wise → WeChat | ¥50,000 | ¥500k–800k (sources disagree) | Whether business senders may use it is disputed |
| Wise → UnionPay card | ¥33,000 | US$50,000 (foreigners living in China: ¥400,000) | Several banks refuse inbound: China Merchants, Minsheng, Industrial, SPDB, Bank of Nanjing |
| Bank wire (SWIFT) | no cap | — | 2–3 days; the recipient declares it at their bank |

- The recipient's bank asks what it is for, and needs a declaration above
  US$5,000. Converting more than US$50,000 a year needs a contract and invoice.
- The name must match the ID exactly (Pinyin, surname first).
- **Never split one job into several transfers to fit under a cap.** Banks flag
  it as structuring.
- The recipient self-declares the income (labour remuneration, 1 March–30 June).

## Flow 2 — money out of China

- **WeChat Pay and Alipay cannot send a service fee abroad as a remittance.**
  Their cross-border permission is for purchases from overseas merchants.
- A private person may pay an overseas business for personal use — a wedding
  photographer, a tutor, a private booking — from their own US$50,000 a year
  allowance. Best route: the payee business's own WeChat Pay or Alipay
  checkout, e.g. a Hong Kong business with a Stripe account. That is an
  ordinary cross-border purchase.
- A service bought **for a business** — a producer booking talent or crew —
  should be paid from the payer's company, by bank wire, with a service
  contract and invoice. No size limit.
- A single company payment over US$50,000 also needs a tax filing
  (服务贸易等项目对外支付税务备案表) before the bank sends it.
- Chinese withholding (6% VAT, 10% income tax) applies only when the service is
  performed or consumed in China. **The contract should state where the work is
  done.**
- From 1 January 2026 banks verify identity on outbound transfers of ¥5,000 /
  US$1,000 or more. Anti-money-laundering, not a new limit.

**Illegal, and the board must never suggest it:** using friends' allowances
(借用额度), splitting payments, underground exchange (对敲), or a false purpose.

## Flow 3 — Tom paying someone in China

- Wise from an Australian business profile to Alipay, WeChat or UnionPay,
  purpose "Services", within the caps in Flow 1. Cost roughly 0.3–2%
  (**unverified**).
- Australian bank wires are free online but lose 2–6% on the exchange rate.
- The bank or Wise reports to AUSTRAC, not Tom. No PAYG withholding for a
  non-resident working overseas; no GST reverse charge for a normal business.
  Keep contract, invoice and proof of payment.

## Flow 4 — Tom's own fee

- Stripe Australia accepts sole traders and offers WeChat Pay and Alipay:
  2.9% + A$0.30, plus 2% if currency is converted. Cards: 1.7% + A$0.30
  domestic, 3.5% + A$0.30 international.
- Airwallex also takes sole traders; FX 0.5% over interbank; WeChat Pay /
  Alipay fees not published.
- **Surcharging is not an option.** Australia removes card surcharging from
  1 October 2026 (RBA), Stripe switches it off the same day, and WeChat Pay /
  Alipay never allowed it. Gross the fee up instead:
  - Charged in CNY (4.9% + A$0.30): `charge = (net + 0.30) / 0.951`.
    Net A$100 → A$105.47. Net A$2,000 → A$2,103.36.
  - Charged in AUD (2.9% + A$0.30): `charge = (net + 0.30) / 0.971`.
    Net A$100 → A$103.30. Net A$2,000 → A$2,059.63.
  - So quote the payer **about 2.1%** as one all-in figure.

**Unverified and critical:** whether Stripe or Airwallex will onboard an
Australian sole trader whose representative lives in mainland China.

## What a WFOE would add

**It enables:** a corporate account in China; collecting Tom's fee from Chinese
members in RMB, domestically, through a WeChat Pay merchant account; paying
overseas suppliers properly; employing staff.

**And one more model, for big or awkward deals:** the WFOE sells the service to
the Chinese client (issuing a fapiao) and buys it from the overseas provider
under its own contract, paying from its Chinese corporate account. Legal,
because the WFOE is genuinely the seller — but then the full amount is in its
books and the board is no longer just recording. Use it only when the Chinese
client cannot or will not pay abroad themselves: they need a fapiao, or they
are a private person with a business-sized job.

**It does not give:** a payment licence (none issued since 2015), any right to
hold or forward members' money, or the WeChat/Alipay platform split products
(电商收付通 / 直付通), which need an ICP or EDI licence in the same company's
name. The commercial ICP licence is capped at 50% foreign ownership outside the
2024 pilot cities; EDI has allowed 100% since 2015.

**Cost:** US$8,500–14,000 to set up, 2–4 months to a working bank account;
registered capital paid in within five years; bookkeeping from ¥1,600 a month
plus a statutory audit of ¥5,000–50,000 a year.

### Why a service agreement does not bridge the gap

Asked twice now, and it is the same question both times: the WFOE has WeChat
Pay, so why not send the QR to the Chinese customer, collect into the WFOE,
and have the Australian company pay the money out to the person who did the
work — with a service agreement between the two to paper it?

**It turns entirely on whether the WFOE is the SELLER or the COLLECTOR.**

*Seller* is the model two paragraphs above and it is legal: the WFOE contracts
with the Chinese client, issues the fapiao, and buys delivery from the
overseas provider under its own contract. *Collector* is taking money from a
payer and passing it to an unrelated third party, which is 二清 under Order 768
whatever paperwork sits beside it.

**The agreement cannot help, and the reason is structural.** A contract
between the WFOE and the Australian company binds those two. The money in the
collector case belongs to neither of them — it is the payer's until the
provider has earned it. Two parties cannot contract away a rule that exists to
protect the third, and the rule exists precisely because the third party is
the one who loses when an unlicensed collector fails.

Three separate checks catch it, and they do not depend on each other:

- **Tencent's merchant terms** forbid collecting for third parties, and many
  inbound payments matched by outbound remittances is a pattern they look for
  rather than one they might miss. The account freezes with the balance in it.
- **SAFE and the WFOE's own Chinese bank** want a genuine underlying
  transaction behind every outbound payment, with the contract and the invoice
  to read. "I collected their customers' money" does not document.
- **Transfer pricing.** A related-party outbound service fee has to be arm's
  length for a service actually rendered, and outbound related-party payments
  are looked at closely.

**And the legal version carries a liability that is not optional.** Being the
seller means being on the hook: if the provider does not deliver, the WFOE
owes the client. That exposure is what makes it a sale rather than
settlement — there is no version that keeps the legality and sheds the risk.
Which in turn means, per customer, a contract with every provider, Chinese CIT
and VAT on the *full* revenue rather than on a fee, a fapiao per sale,
documentation for each remittance, and a bank that grows more interested as
volume does.

**So it fits one business and not a platform.** Tom's own goods through
aozhoubaba are the good case — the WFOE buys from the Australian supplier,
sells in China, keeps a margin, and pays the supplier as an ordinary
goods-trade payment. Dealio is the bad case by construction: its first rule is
that the money is never ours, and this route requires it to be ours. They are
opposite structures. Both can be run; not from the same entity.

## What the board should build from this

When terms are pinned, suggest the route, from who pays whom and how much:

- Overseas → mainland person, up to ¥50,000 a payment: *"Pay by Wise to their
  Alipay or UnionPay card, purpose Services."*
- Overseas → mainland person, above that: *"Bank transfer, with this agreement
  as the contract."*
- Mainland person → overseas, personal use: *"Pay the business's WeChat Pay or
  Alipay checkout."*
- Mainland company → overseas: *"Company bank transfer with contract and
  invoice; tax filing if a single payment is over US$50,000."*

And:

- **Ask where the work is performed, and print it on the terms.** The Chinese
  tax treatment turns on it.
- Treat the pinned terms as the contract evidence banks ask for, and make the
  printed receipt carry both parties, the amount, the purpose and the dates.
- **Never suggest splitting a payment**, and never offer "Family support" or
  "Gift" as a purpose for a job.
- Tom's fee is its own payment to Tom, grossed up, never taken out of the
  members' money.

## What is built from this so far

- `feeOf()` in `board/lib/store.js` charges `net / 0.951` — 2% kept, about
  2.1% charged — because surcharging is gone. The fixed A$0.30 is left out:
  the board does not know the settlement currency, and thirty of something
  added to an amount written in Hong Kong dollars is arithmetic that looks
  right and is not. It costs about thirty cents a payment.
- The fee row says "plus processing" rather than showing 2% beside a number
  that is not 2%.

- `routeFor()` picks one of five routes from where the two sides are, whether
  the payer is a person or a company, and the amount. The card shows it
  between the plan and the board's fee, with "never split a payment" under
  every route rather than only the ones with a cap in them — it is the mistake
  with somebody's own name on a bank's report, and a warning that appears only
  sometimes is one people learn to scroll past.
- The ¥50,000 line is only applied when the amount is written in yuan. This
  board has no exchange rate and will not invent one to decide a threshold;
  where it cannot tell, it gives both rules and lets the two of them look at
  the number.
- `doneIn` is on the terms and prints with them, and on the receipt. `payerIs`
  is on the memo because the same producer is a private individual on Saturday
  and a company on Monday, and the two are paid for down different roads.
- The receipt carries what the work was, where it was done, both parties, the
  amount, where it was sent and both statements with their dates.

- The fee is confirmed by Stripe rather than by a person. `POST /api/hook/fee`
  verifies Stripe's signature by hand (HMAC-SHA256 over `t.rawbody`, five
  minutes' tolerance) and marks the fee cleared. Which deal it was travels as
  `client_reference_id` — a group id, twenty hex characters naming a room and
  nothing else. Off unless `BOARD_DEAL_FEE_SECRET` is set.
- **Terms cannot be agreed until the fee has cleared.** It is the only lever
  there is: nothing here holds the money, so there is nothing to deduct from,
  and a fee that is a request on a screen is not a fee. Agreeing is the moment
  both of them want the record, which is the moment it is worth paying for.
  The card says so before the button is pressed rather than after.

Not built: anything that would have this board arrange, check or hold a
payment. Stripe pays Tom directly and tells the board it happened, which is a
sentence and not a settlement.

## Sources

- SAFE, individual FX rules: https://www.safe.gov.cn/tianjin/2024/0430/2464.html
- SAFE, tax filing over US$50,000: https://www.safe.gov.cn/tianjin/2024/0430/2469.html
- 汇发〔2020〕14号 current-account guide: https://www.gov.cn/zhengce/zhengceku/2020-08/31/content_5538828.htm
- 汇发〔2019〕13号 payment institutions' FX business: https://www.gov.cn/zhengce/zhengceku/2019-10/26/content_5445324.htm
- 2026 identity-verification threshold: https://www.21jingji.com/article/20251205/herald/b254b605f3fdb6150d57fa0f25a2312a.html
- SAFE on underground banking (2025): https://www.safe.gov.cn/fujian/2025/0715/2453.html
- Bank of China wire tariff: https://www.boc.cn/cbservice/cb3/cb33/200807/t20080701_852.html
- Wise CNY guide: https://wise.com/help/articles/2955298/guide-to-cny-transfers
- Wise via Alipay: https://wise.com/help/articles/2kTApouGnjRj6JM1yduMIL/sending-cny-via-alipay
- Wise via UnionPay: https://wise.com/help/articles/5rpQjZ2pueSOeIh5s2mh7w/how-to-send-and-receive-cny-via-unionpay
- Wise via WeChat: https://wise.com/help/articles/1bd1dHKW4uB8p0lnFbzgoZ/how-to-send-and-receive-cny-via-wechat
- Payoneer pricing: https://www.payoneer.com/pricing/
- Airwallex payments to China: https://help.airwallex.com/hc/en-gb/articles/4633986370447-Guide-to-making-payments-to-China
- Stripe WeChat Pay: https://docs.stripe.com/payments/wechat-pay
- Stripe AU local payment methods pricing: https://stripe.com/au/pricing/local-payment-methods
- Stripe surcharging: https://docs.stripe.com/payments/cards/surcharge
- RBA surcharging conclusions (2026): https://rba.gov.au/media-releases/2026/mr-26-10.html
- AUSTRAC international transfer reports: https://www.austrac.gov.au/industry-and-business/obligations-and-guidance/your-amlctf-program/reporting-us/international-funds-transfer-reports
- WeChat Pay merchant application: https://pay.weixin.qq.com/static/applyment_guide/applyment_detail_qiye.shtml
- WeChat Pay platform (收付通) requirements: https://pay.weixin.qq.com/doc/v3/partner/4012086891
- Foreign ownership of internet licences: https://www.china-briefing.com/news/china-internet-business-licenses-foreign-companies/
- 2024 VATS pilot: https://www.hsfkramer.com/notes/tmt/2024-05/easing-of-foreign-ownership-limits-in-chinas-value-added-telecom-services-what-you-need-to-know/
- WFOE cost: https://msadvisory.com/wfoe-cost-china/
