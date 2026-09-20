# post — one video, one caption, every platform

```
make post FILE=~/video.mp4 SAY="caption" [ZH="中文文案"] [ONLY=youtube,douyin]
make post-status [ID=...] [N=10]
```

One command. It prints one line per platform saying what happened, and running
it twice does not post twice.

## What is built so far

| | Platform | How | State |
|---|---|---|---|
| ✅ | YouTube | Data API v3, on the box | built, needs keys |
| ✅ | LinkedIn | Versioned API, on the box | built, needs keys |
| ✅ | X | v1.1 upload + v2 post, on the box | built, needs keys |
| ✅ | 抖音 Douyin | browser, on the box | built, needs a login |
| ✅ | 小红书 Xiaohongshu | browser, on the box | built, needs a login |
| | 视频号 Channels | browser | after that |
| | 公众号 | browser — the account has no publish rights | after that |
| | 快手 Kuaishou | browser | later |
| | 哔哩哔哩 Bilibili | browser | later |
| | TikTok | Content Posting API | when app review clears |
| | Instagram, Facebook | Graph API | when app review clears |

A platform that is not built, or whose keys are missing, prints a line saying
so and is skipped. Nothing is ever silently left out.

## The rules this enforces

**No machine translation.** Without `ZH=`, the Chinese platforms do not go out
and every one of them prints "no Chinese caption". A translated caption reads
as foreign to the audience it is for, which costs more than not posting.

**No double posting.** A job is identified by the video's name, size and
modification time plus both captions, and each platform has its own state. Run
the same command again after a failure and only what has not gone out is tried.
The same video with a different caption is a new job, deliberately.

**No silence.** Every platform prints, every time — done, queued, not posted,
or failed with the reason. A failure is also written onto the job, so
`make post-status ID=…` a week later still says what happened.

## Where things run

The API half runs on the box. The browser half runs wherever `where` says in
`lib/jobs.js`, and today that is the box, because that is what Tom asked for.

Worth knowing rather than discovering later: Douyin, Xiaohongshu and 视频号
look at where a session comes from, and a login driven from a Tokyo datacenter
is the shape they challenge. If one starts demanding verification on every
run, change that platform's `where` to `mac` and run `make post-run` there
instead. Same code, same profiles, one word different.

## Switching it on

Add `post` to `COMPOSE_PROFILES` in `.env` on the box, then fill in the keys
for whichever platform you have. Everything is optional and independent.

## YouTube

Needs a Google Cloud project with **YouTube Data API v3** enabled and an OAuth
client of type "Web application". Three values go in `.env`:

```
TOMSCODING_POST_YOUTUBE_CLIENT_ID=
TOMSCODING_POST_YOUTUBE_SECRET=
TOMSCODING_POST_YOUTUBE_REFRESH=
```

The refresh token is Tom's own consent, taken once in a browser. A service
account cannot own a YouTube channel — Google will not let one upload to a
person's channel at all — so that one login cannot be automated away.

Two things that will otherwise waste an afternoon:

- **While the consent screen is in "testing", Google expires refresh tokens
  after seven days.** Publish the app, or expect to re-consent every week. When
  it expires the command says "youtube needs consent again" rather than
  retrying.
- **The default quota is 10,000 units a day and an upload costs 1,600**, so six
  uploads is the ceiling. The seventh says the quota is used up, and tomorrow it
  works again.

## LinkedIn

```
TOMSCODING_POST_LINKEDIN_TOKEN=
TOMSCODING_POST_LINKEDIN_AUTHOR=urn:li:person:xxxxxxxx
TOMSCODING_POST_LINKEDIN_VERSION=202601
```

Needs a LinkedIn app with **w_member_social** granted, and the author URN of
whoever is posting — `urn:li:person:…` for Tom's own feed,
`urn:li:organization:…` for a company page, which needs
`w_organization_social` instead.

- **The token lasts 60 days.** Refreshing it without a human needs LinkedIn's
  approval for your app, so until that exists this is a line to re-paste every
  couple of months. The command says "linkedin token is dead or expired" rather
  than retrying, which is the difference between a five-minute fix and an
  afternoon.
- A missing or stale `LINKEDIN_VERSION` answers **426**, which reads like a
  protocol error rather than an out-of-date header. That is why it is a setting.
- A video is four calls, not one: ask for an upload slot, PUT each part,
  finalize with the ETags in order, then create the post. Out-of-order ETags
  are accepted and produce a corrupt video — the worst kind of success.

## X

```
TOMSCODING_POST_X_KEY=
TOMSCODING_POST_X_SECRET=
TOMSCODING_POST_X_TOKEN=
TOMSCODING_POST_X_TOKEN_SECRET=
```

All four come from the screen where the app is created. Posting needs a user
context, so there is no bearer-token shortcut: this signs every request with
OAuth 1.0a, by hand.

- **Media upload is not on X's free tier.** If the upload answers 403 about
  access level, that is a subscription decision, not a bug, and the command
  says exactly that.
- The upload is chunked because the simple one caps at 5MB, and X transcodes
  before a video can be posted. Posting too early fails with an error about a
  media id that does not exist, which sounds like the upload failed when it did
  not — so this waits for processing to finish.

## 抖音 and 小红书 — the browser half

```
make post-login WHO=douyin PHONE=13800138000
make post-code  WHO=douyin CODE=123456
make post-run
make post-logins
```

`make post` queues these rather than doing them; `make post-run` is what opens
Chromium and posts them.

**The login is by SMS, not by QR code.** Every automation write-up uses the QR,
and a QR is no use to somebody who cannot see the screen — it means pointing a
phone at a monitor. Both platforms also offer phone-and-code, so that is what
this uses: one command sends the code to the phone, a second types it back in.
Two commands rather than one because a command that sits waiting for an SMS is
a command that looks hung.

**The login is kept as a whole Chromium profile**, in the `post_profiles`
volume, not as a cookie jar. These sites fingerprint the browser, and cookies
replayed in a fresh browser look like a stolen session — which is the thing
they are built to catch.

**A session lasts a few weeks and nothing warns you.** When one expires,
`make post-run` says which platform needs a login and leaves the job queued, so
finishing the login and running again picks it up. `make post-logins` answers
the same question before a trip rather than during one.

**A slider puzzle cannot be solved from a terminal.** If one appears during
login, the command says so and stops. That is a real limit, not a bug to work
around, and pretending otherwise would waste an afternoon.

**When a selector misses, the page is kept.** A screenshot and the page's
visible text go into `/data/evidence/`, because "it did not work" with nothing
to read is not something anybody can fix — least of all somebody who cannot
look at the screen.

## What has and has not been tried

Checked against the real endpoints with deliberately wrong keys, which proves
the request shape is parsed rather than the credentials work:

- **X** answers 401 to a signed request — the signature is computed, sent and
  read. The percent-encoding rules are unit-checked (`! * ' ( )` escaped,
  `- _ . ~` not), since one wrong character there is a 401 with no hint.
- **LinkedIn** answers `INVALID_ACCESS_TOKEN` in about a second, and the
  command turns that into "token is dead or expired".
- **Neither has posted anything.** Every call past the first — the uploads, the
  finalize, the post itself — is a reading of the documentation and has never
  run. Expect to fix something on the first real post, and expect the error to
  be specific enough to fix.

The browser half is further from proven than that:

- **Every decision path was tested** without a browser — nothing queued, a job
  waiting with no login, an unknown platform, a missing phone number, a code
  with no login in progress. All of them say the right thing and exit the right
  way.
- **No page has ever been opened.** The selectors in `browser/platforms/` are
  written from Douyin's and Xiaohongshu's creator pages as documented, and both
  sites change them. The first real login will find something wrong; the
  evidence files are there so that finding it takes minutes rather than a
  session of guessing.
- **The image has never been built.** There is no Docker on Tom's Mac, so
  `browser.Dockerfile` — node:22-slim plus `npx playwright install --with-deps
  chromium` — is first built on the box, and that build is the first thing to
  watch when it deploys.

## Files

| | |
|---|---|
| `cli.mjs` | Every command. Run through the Makefile, not by hand. |
| `lib/jobs.js` | What a job is, which platforms it targets, and why one was skipped. |
| `lib/store.js` | `/data/post.json`, written through a rename and serialised. |
| `lib/say.js` | Every line the command prints, in English and Chinese (`POST_LANG=zh`). |
| `lib/youtube.js` | Token refresh and a resumable upload. |

Nothing listens on a port. Every entry point is `docker compose run --rm` from
the Makefile, so there is no service to attack and no port to guard.
