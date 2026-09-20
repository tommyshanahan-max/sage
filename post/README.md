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
| | LinkedIn | API, on the box | next |
| | X | API, on the box | next |
| | 抖音 Douyin | browser | after that |
| | 小红书 Xiaohongshu | browser | after that |
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
