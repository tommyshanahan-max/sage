# The Beijing box

Written 13 Sep 2026, the afternoon a WFOE turned out to exist. Nothing here is
built yet. It is waiting on one thing: a 对公账户 for 澳斯达（北京）经济贸易有限公司,
without which Aliyun will not verify the account, and without that there is no
备案 and none of this can start.

## Parked, 17 Sep 2026 — and what un-parks it

**None of this blocks a booking.** The deal memo, the payment plan and the
receipt need no company and no bank account, because the board never holds the
money: one person pays another on the payee's own link and the board writes
down what both of them said. Claire can hire Sasha the day it deploys.

So what is below is not the critical path. It buys two things and only two:
links that stop showing WeChat's 未完成ICP备案 warning, and WeChat login. Both
are worth having when there are people arriving through WeChat. Neither is
worth a fortnight of Beijing admin before there is anybody to arrive.

Tom's call, and it is the right one: **the WFOE waits until the platform has
users.** What un-parks it is traffic coming through WeChat, not a date.

`china/` is built and committed — five pages in two languages, generated from
the board's own strings by `make china`. It costs nothing to leave sitting
there, and the day a domain exists it is a copy, not a project.

The entity comes back for its own reasons, not this one: taking a cut,
switching the wallet on, or selling anything through the app. All three mean
handling money, which is the licence the agent has already ruled out.

## Confirmed by the filing agent, 17 Sep 2026

于海超, in WeChat, unprompted and in two lines:

> 基于你目前的情况，是无法办理ICP许可证的。
> 第一步，您需要在中国建一个网站（有域名）并办理ICP备案，而不是ICP许可证。
> ICP备案在你的域名服务商那里就能直接做。

So the warning at the bottom of this file is not a caution any more, it is a
fact: the commercial 许可证 is out, the 备案 is the route, and it is filed
through the registrar / host rather than through him. **Nothing that takes
money can live on this domain**, and nothing said to a filing agent should
suggest that it will — a second stage that sells services is a different
filing, and mentioning it invites the wrong one.

The first thing the domain has to serve is `china/index.html`: a login page
that says what the site is, stores nothing, and hands the person to the board.
It is written and waiting for a domain to sit on.

## Two problems, one filing

**A link shared in WeChat shows a warning page.** WeChat checks the domain of
anything opened in its browser. `thexchange.app` has no ICP 备案, so every link
into a group chat — a poster, an invite, a shared profile — lands on
「该网站未完成ICP备案，无法确认其安全性」and a 继续访问 button. It does open. It
also tells a room full of strangers that the thing Tom just recommended could
not be checked.

**WeChat login is not available at all.** 网页授权 only calls back to a 备案'd
domain. `board/lib/wechat.js` is written and has been unusable since the day it
was written, which is why its header describes a box that does not exist.

Both are the same requirement: a domain filed under a Chinese company, served
from a licensed mainland host. One filing answers both.

`.app` cannot be filed — it is a Google TLD and MIIT has never approved it, so
mainland registrars cannot even sell it. The China-facing domain is a separate
one. `thexchange.cn`, bought at Aliyun under the WFOE, was free as of today.

## The rule, and everything below follows from it

**The Beijing box stores nothing.**

Not a row, not a photograph, not a message, not a device hash. It receives a
request, asks Tokyo, and hands the answer back. Its disk holds a certificate, a
configuration file and two secrets.

This is not caution for its own sake. The board asks people to write down who
they know and who they are looking for, in an industry where that is the whole
asset, and the answer to "what of this is in China" has to be "nothing" —
said plainly, and true. A cache is a store. A log of request bodies is a store.
Neither is worth what it costs to have to qualify that sentence.

## What Beijing serves

Only the paths a stranger can reach before they are anybody. They are already
enumerated: `OPEN_PATHS` in `board/server.js` is that list, and it exists
because the board already had to know which pages have no door on them.

    /a/:code            a poster, and the join form on it
    /i/:code            an invite
    /enter              the door
    /w/:code            somebody a member wrote to
    /r/:room            a room's landing page
    /p/:handle          a shared profile — redirects to /r/, never renders
    /join               the list
    /about /rules /privacy
    /api/wait           the join form's POST
    /api/enter /api/signin /api/admitted /api/hello
    /api/announce-media the poster's picture
    /api/counts /api/tally
    the static files those pages need

Plus one route that does not exist yet:

    /wx/back            WeChat's OAuth callback — see the relay below

## What never goes to Beijing

Everything else. Browse, Messages, Cards, Profile, the butler, the photos,
`/api/people`, `/api/notes`, `/api/person`, the admin routes. A member opening
the app is talking to Tokyo, as they do now, on `thexchange.app`.

A member who taps a `thexchange.cn` link lands on a public page and moves to
`thexchange.app` from there. Two domains, and the join of them is a link.

## How it works

A reverse proxy and nothing else. Caddy in Beijing holds `thexchange.cn`,
terminates TLS, and forwards the paths above to Tokyo over TLS with the real
client address in a header. Tokyo already reads `x-forwarded-proto` and `host`
in `page()` and in `/a/:code`, which is what makes the og: tags come out with
the right origin; those want checking against the new arrangement rather than
assuming.

Caddy is chosen because the box already runs it — `tomscoding-caddy` — so it is
the same configuration language and the same certificate story, and there is
one fewer thing to learn at the point where something is broken at midnight.

Anything not on the list is refused by the proxy, not by Tokyo. A prefix that
matches too much is exactly the bug this repo has already had once, in
`OPEN_PATHS`, where one loose letter opened the board. Anchor every path.

## The relay

`board/lib/wechat.js` is written and waiting. It already accepts either half:
its own handshake, or a signed openid from somewhere else — `relayOk()`, five
minutes, HMAC over `openid + "." + at`.

`scripts/wx-relay.mjs` is a comment describing a file. What it has to do:

1. Hold `BOARD_WX_APPID` and `BOARD_WX_SECRET`. **They stay in Beijing.** The
   appsecret opens the account; Tokyo never needs it and should never hold it.
2. Serve `/wx/back`, which WeChat redirects to with a `code`.
3. Spend the code for an openid — `openidFor()` in `lib/wechat.js`, unchanged,
   which is why that file works on either box.
4. Sign it: `sign(openid, Date.now())` with `BOARD_WX_RELAY_SECRET`.
5. Send the browser on to Tokyo carrying openid, timestamp and signature.

`BOARD_WX_RELAY_SECRET` is shared with Tokyo and is **not** `BOARD_SALT`. The
relay has no business holding the salt every identity on this board is hashed
with — the note in `lib/wechat.js` says so already.

snsapi_base and never snsapi_userinfo. The scope that returns a nickname and an
avatar is a different product and it is not this one.

## What has to change in the board

Less than it sounds.

- Tokyo learns that `thexchange.cn` is a legitimate `Host` — cookies, the
  origin computed in `/a/:code`, and anything that compares a host.
- The poster composer mints `https://thexchange.cn/a/CODE` rather than the
  origin it happens to be served from, because the poster is for WeChat and
  that is the whole reason this exists.
- The invite in `scripts/invite.mjs` likewise, for the same reason: it is
  pasted into WeChat. **The invite is settled and this changes one URL in it,
  nothing else.**
- A route that accepts the relay's signed openid. `relayOk()` is written; the
  route that calls it is not.
- The 备案 number in the footer of the pages Beijing serves. Required, and it
  is checked.

## What it costs

An Aliyun ECS small enough to be embarrassing — this proxies text — plus the
domain at ¥38 a year. The filing itself is free. The real cost is the fortnight
of 备案 review and the bank account that gates it.

## Order

0. **Replace the company documents.** 17 Sep 2026: Tom cannot find them. No bank
   will open a 对公账户 without the 营业执照 and the chops, so this now sits in
   front of the step that already blocked everything else.

   Two different problems wearing one name:

   - **The 营业执照** is a reprint. The AMR that issued it reissues it, in
     Beijing largely through e窗通, usually after a published 遗失声明. Annoying,
     not serious — the company's record is the registry's, not the paper's.
   - **The chops — 公章, 财务专用章, 法人章 — are the serious one**, and not
     because they are hard to replace. A company chop in somebody else's hand
     signs contracts in the company's name, and the loss declaration is what
     ends that exposure. If they are lost rather than mislaid, the declaration
     is worth doing for its own sake and before anything else, whatever it
     costs in time. Re-carving is a 公安局 matter and a PSB-approved engraver.

   于海超 does company services and is already in the chat — this is his trade,
   and asking him what he needs is one message rather than a week of counters.
   What he will ask for is which documents are gone and who the 法人 is.

1. 对公账户 for the WFOE. **Blocks everything else.** 法人 in person, most banks.
2. Aliyun 企业实名认证 — 企业银行卡收款认证, the third option.
3. Buy `thexchange.cn` with an 企业 information template. Do the domain's own
   实名认证 the same day: `.cn` is suspended after five days without it.
4. Wait three working days. Aliyun's rule, not skippable.
5. Buy the mainland ECS and file 备案 through them. Site name 交换; the filing
   carries the Chinese name and the domain carries the brand.
6. 公安备案 within 30 days after.
7. Then, and only then, the code above. A day's work, most of it in Caddy.
8. 服务号 + 微信认证 for the login. Needs the same bank account.

## What to check before trusting any of this

- That `.app` is still unfiled — MIIT adds TLDs: <https://domain.miit.gov.cn/>
- That a 100% foreign-owned WFOE can hold the filing you are applying for. 备案
  yes. The commercial 许可证 is a different document and foreign ownership in
  value-added telecom is capped; assume you cannot have it, and keep anything
  that takes money off this domain.
- Whether the 集群注册 address in 怀柔区 satisfies the reviewer. Usually. Not
  always.

## WeChat Pay as the WFOE's rail, and whether the platform can mint the codes

Researched 23 September 2026, against WeChat Pay's own merchant documentation.
Not legal or tax advice, and none of it is watched working.

**The idea it answers.** Each supplier's job gets its own QR code under the
WFOE's WeChat merchant account; the client scans and pays in RMB; the WFOE
then buys the service from the supplier and pays them abroad. Tom's sketch,
23 Sep.

**A per-job code is an ordinary API call, not a thing generated by hand.**
Native pay: the server posts an order carrying **your own reference**
(`out_trade_no`) and the amount, and WeChat returns a `code_url` to draw as a
QR. The amount is baked in, nothing is typed by the payer, and the reference
comes back on the payment notification — so who earned what reconciles itself.
This is the same shape `/china/ask` already builds; only the rail underneath
changes.

**API access is the merchant's own, not the bank's to withhold.** The APIv3
key is set by the merchant at 商户平台 → 账户中心 → API安全, with the operator
password and a phone code. A bank being the acquirer does not remove that.

**So there is exactly one question for the bank**, and everything rests on it:

> Does the WFOE get its own 商户平台 login for its 商户号?

If the bank holds the login and mints codes in the console for you, there is
no API, and a code per job means somebody typing each one.

**NOT the service-provider model, and this is the trap.** WeChat has a
服务商 / 特约商户 structure — sub-merchants under a partner, each with a
`sub_mchid` — and it looks like what "sub-codes under my account" means. It is
not: it settles the money **to each sub-merchant**, and every sub-merchant
needs its own Chinese merchant account. The suppliers here are Australian
professionals. So the route is **one merchant account, many orders**, never
many merchants.

**The ICP question here, stated correctly the second time.** The first version
of this said a payment page behind WeChat's warning screen is not a payment
page. That is an overstatement, and this same document says so twenty lines
up: the 「该网站未完成ICP备案」page has a 继续访问 button and **the link does
open**. `thexchange.app` opens in WeChat today.

So it is a judgement, not a blocker: one extra tap and a sentence about not
being able to confirm the site is safe, shown to somebody who is about to hand
over money. Worse there than on an ordinary link, and still not a wall.

What IS a hard block on this page is different and is about login, not
payment: 网页授权 only calls back to a 备案'd domain.

**Unchecked, and it matters more than either:** whether WeChat Pay's own
merchant application requires the merchant's site to be 备案'd. Nobody has
asked. `thexchange.cn` under the WFOE is bought and would settle it.

## The payer is already inside WeChat, and that changes which flow is right

Tom's question, 23 Sep, and it is the one that decides the design: the payer
opens the board's link *in WeChat*, sees a code on the page — can they
long-press it and pay without leaving?

**It worked once, watched, and that is the strongest evidence here.** 20 Sep:
the link opened in WeChat on a phone, a real Airwallex code was long-pressed,
and Airwallex recorded it paid. See the chain in `NOW.md`. So "no" is wrong.

**But it is not the flow the rail is built for, and the adapter already says
so.** `board/lib/wallet/providers/airwallex.js` picks `flow: "qrcode"` and
the comment beside it names the alternatives — `official_account`,
`mini_program`, `mobile_app`, `mobile_web` — as *"handoffs inside WeChat
itself"*. WeChat Pay's own position is the same: a payment code is for 扫一扫
with the camera, from another screen, and payment by long-press recognition is
not supported.

So the code-on-a-page flow is built for a payer looking at a **desktop** or a
**second device**. It happens to survive a long-press today. That is a thing
to depend on carefully, not a thing to design around.

**The right flow for a payer already in WeChat has no QR in it at all.**
JSAPI — `official_account` at Airwallex, 公众号支付 direct — opens WeChat's own
payment sheet on the page. One tap, no code, no leaving. It is what every
Chinese site does to somebody arriving from a chat.

**And it needs the openid, which needs 网页授权, which needs a 备案'd domain.**

That is the finding. The ICP filing is not cosmetic for payments and it is not
about the warning screen: it is the difference between showing a Chinese payer
a QR code to long-press at their own phone, and handing them the payment sheet
they expect. `thexchange.cn` under the WFOE is already bought.


**And it does not answer the structural objection.**
`docs/cross-border-payments.md` examined this same WFOE-buys-and-resells route
on 18 September and concluded it fits one business and not a platform — the
WFOE owns the liability, pays CIT and VAT on the full sale rather than a
margin, and issues a 发票 per sale. Minting the codes is the easy half.

Sources: <https://pay.weixin.qq.com/doc/v3/merchant/4012072195> (APIv3 key),
<https://pay.weixin.qq.com/doc/global/v3/en/4012356795> (Native order).

## H5支付: what switching it on actually needs

Researched 23 September 2026 against WeChat Pay's merchant documentation.
This is the product behind step two → three of the flow above: the payer is in
an ordinary mobile browser, the page hands them to WeChat, they pay, they come
back.

**It is a separate application, after the merchant account exists.** Not on by
default. Review is quoted at 1–5 working days, within 7.

**What it asks for**, and most of it the WFOE has by existing: business
licence, the 法人 or operator's ID, a corporate bank account, a description of
what is being sold and where.

**And one thing that is not free: a 备案'd top-level domain.** The application
takes the H5 payment domain *and a screenshot of its ICP 备案*, and the paying
domain has to match the authorised one. `thexchange.app` cannot be that
domain. `thexchange.cn` under the WFOE can, once filed.

**AND IT IS NOT AN H5 THING, WHICH IS WHERE THIS WAS FIRST WRITTEN WRONG.**
The obvious dodge is to skip H5 and use a scanned code instead. It does not
work: Native 支付 is applied for as a **PC 网站** scenario and asks for the
site's domain, its 授权函 and the 公众号 APPID, and an unfiled domain does not
pass WeChat's risk review for the merchant account at all. The filing is a
precondition of the 商户号, not of one product on it.

So there is no WeChat route — QR or handoff — without `thexchange.cn` filed.
Everything in "What to do, in order" earlier on this page is on the critical
path to taking a single payment.

Sources: <https://pay.weixin.qq.com/doc/v3/merchant/4012791841> (H5),
<https://pay.weixin.qq.com/doc/v3/merchant/4012791875> (Native).
