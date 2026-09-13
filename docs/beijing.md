# The Beijing box

Written 13 Sep 2026, the afternoon a WFOE turned out to exist. Nothing here is
built yet. It is waiting on one thing: a 对公账户 for 澳斯达（北京）经济贸易有限公司,
without which Aliyun will not verify the account, and without that there is no
备案 and none of this can start.

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

1. 对公账户 for the WFOE. **Blocks everything.** 法人 in person, most banks.
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
