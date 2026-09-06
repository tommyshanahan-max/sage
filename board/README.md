# The Board

A noticeboard for foreigners in China. Study Pal's feed with nothing else
attached: somewhere to ask "where do I get a phone contract without a Chinese
bank card" and be answered by somebody who did it last month.

**It starts empty.** No posts are copied from anywhere. The ones on Study Pal
were written by people who signed up to that app, and moving their words and
photographs into a different product is not a migration — it is a decision
about somebody else's content, and not one this repository makes quietly.

## What it is

- Anyone can read. Anyone can post. No account, and nothing about a person is
  stored but a random number their browser made up, hashed before it is
  written down.
- Everything new is **held** until somebody reads it. There is no model here
  that can judge a post — Study Pal has one and it is theirs — so the honest
  default is a person. `BOARD_AUTO_PUBLISH=1` turns that off, and should not
  be set on anything public.
- No web fonts. `fonts.googleapis.com` is blocked in the mainland, which is
  the whole reason this is worth running at all; the page carries nothing it
  has to fetch from outside the firewall.

## It answers the admin panel's API exactly

The panel at `partner.tomscoding.com` already governs a board — reading
`/api/public?queue=1`, sending to `/api/feed`, releasing and deleting. Those
routes are implemented here to the same contract, so pointing that panel's
`STUDYPAL_BASE` at this service makes it govern this board **with no change to
a line of it**.

That is not luck. The contract was written down in `docs/for-studypal-*.md`
before either side was finished, which is why a second implementation of it
took an evening.

| Route | Who | What |
| --- | --- | --- |
| `GET /api/board` | anyone | The published board, with threads and like counts |
| `POST /api/post` | anyone | A post, a reply, or a like |
| `GET /api/public-media?id=` | anyone | A photo, by an id nobody can guess |
| `GET /api/public?queue=1` | admin | Held, live, refused and removed |
| `POST /api/feed` | admin | Post as an operated account (multipart) |
| `POST /api/feed/release?id=` | admin | Let a held post through |
| `DELETE /api/feed?id=` | admin | Take one down |
| `GET /api/users` | admin | Every handle that has posted |

## Settings

| | |
| --- | --- |
| `BOARD_DIR` | Where the board and its media are written. Default `/data` |
| `BOARD_ADMIN_KEY` | The admin routes refuse everything without it |
| `BOARD_SALT` | Salts the device hash. Unset means an unsalted hash, which is a rainbow table away from the id it came from |
| `BOARD_HOOK_URL` | The admin panel's webhook, so a held post appears in its queue without a refresh |
| `BOARD_HOOK_SECRET` | What that webhook expects in `x-studypal-secret` |
| `BOARD_AUTO_PUBLISH` | `1` publishes without review. Do not |

## What is not built

- **Report and block.** Required by the App Store for anything with a public
  feed, and worth having regardless. See `docs/for-studypal-appstore.md`.
- **A check that can judge a post.** Everything is held for a person. That is
  correct and it does not scale past a few dozen a day.
- **Any notion of an account.** A handle is a name somebody typed. Two people
  can type the same one.

Each of those is a deliberate absence rather than an oversight, and each is
the next thing if this becomes real.
