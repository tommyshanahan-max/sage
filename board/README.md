# The Feed

A noticeboard for foreign students in China. Somebody puts up a question or a
find — where to get a SIM without a Chinese bank card, which gate at Renmin,
what a label says, a good meal — and somebody who did it last month answers.

It is read and forwarded inside WeChat, which decides most of how it is built.

## What a person is

There are no accounts. A person is a salted hash of a random id their browser
made up, so there is nothing to sign into, nothing to lose a password to, and
nothing to breach. The cost is real and deliberate: somebody who changes phones
is a new person.

## The rules it rests on

These are decisions rather than defaults, and each is load-bearing.

- **Nothing publishes itself.** Every post and every profile photograph is
  held until a person reads it. No model here can judge a post, and a board
  that publishes everything unread publishes the first thing somebody tests it
  with. `BOARD_AUTO_PUBLISH=1` turns it off and should not be set on anything
  public.
- **Words can be taken back; a face somebody has saved cannot.** A profile's
  words go up when they are saved; the photograph waits for review. Two
  separate states, on purpose.
- **A block never reaches the server.** With no accounts, a block is done to
  your own copy — which is exactly why it cannot be turned into a weapon.
- **Reports are counted by person, not by press.** Two distinct reporters hide
  a post pending review; one person pressing twice is one report. Nothing is
  deleted, and one press puts it back — so a false report costs a post a few
  hours and never its existence.
- **The count is public, the list never is.** How many people follow somebody
  is a fact about them. Who follows whom, among foreign students, is a social
  graph, and it does not leave this box.
- **No contact details, anywhere.** Posts and profiles are filtered for phone
  numbers, WeChat ids, emails and addresses. A filter, not a wall: it is aimed
  at the nineteen-year-old pasting their WeChat id into a public board, not at
  somebody determined to get around it.

## Bilingual, not translated

Every string is an English/Chinese pair on adjacent lines in
`public/i18n.js`, so a half-written one is visible in the same diff. Two things
follow, and both are easy to get wrong:

- **Typography moves with the language.** The serif has no Chinese glyphs and
  falls back per character mid-sentence. Chinese wants a taller line-height, no
  letter-spacing and no uppercase — `text-transform: uppercase` does nothing to
  Chinese, and tracked-out CJK reads as broken.
- **The server returns codes, not prose.** Prose chosen on the server is prose
  in whichever language the server was written in.

There is also a translate button, on any post and on the UI itself, rate-capped
and cached.

No web fonts. `fonts.googleapis.com` does not answer in the mainland, and a
page that waits on it is a page that does not load — so every face named here
is one the device already has, Chinese ones first for Chinese text.

## WeChat is the browser

On Android it is an old Blink fork, not Chrome, and it varies by WeChat
version; on iOS it is whatever WKWebView the phone shipped with. Anything too
new fails silently, which is the worst way to be broken on somebody's phone in
another country. `canvas.toBlob` is missing there, `createImageBitmap` throws
on options Safari does not know, and a share card has to be rendered on the
server because the crawler runs no JavaScript.

## Routes

| Route | Who | What |
| --- | --- | --- |
| `GET /api/board` | anyone | The published feed, with threads and like counts |
| `POST /api/post` | anyone | A post, a reply, or a like |
| `DELETE /api/post?id=` | anyone | Take back your own — matched on the browser's hash |
| `GET /api/public-media?id=` | anyone | A photo, by an id nobody can guess |
| `GET`/`PUT /api/me` | anyone | Your own profile |
| `GET /api/person?handle=` | anyone | Somebody's public profile and recent posts |
| `GET /api/people` | anyone | The study-buddy directory — opt-in only |
| `POST /api/follow` | anyone | Follow or unfollow. Counts out, never lists |
| `POST /api/report` | anyone | Report a post, and optionally block its author locally |
| `POST /api/translate` | anyone | Any text, either direction, capped and cached |
| `GET /api/public?queue=1` | admin | Held, live, refused, removed, and faces waiting |
| `POST /api/feed` | admin | Post as an operated account (multipart) |
| `POST /api/feed/release?id=` | admin | Let a held post through |
| `DELETE /api/feed?id=` | admin | Take one down — marked, not deleted |
| `POST /api/face/release?id=` | admin | A profile photograph, looked at and allowed |
| `DELETE /api/face?id=` | admin | Refuse one. The person stays, the picture goes |
| `GET /api/users` | admin | Every handle that has posted |
| `GET /api/count` | anyone | What this board knows about itself — people, posts, and what is waiting to be read |

## Pages

| | |
| --- | --- |
| `/` | The landing page, or the feed itself when `BOARD_AT_ROOT=1` |
| `/feed` | The feed: your own profile at the top, the posts under it, and a bar with Feed, +, Profile |
| `/p/:handle` | A shareable profile, with its share card rendered on the server |
| `/buddies` | The study-buddy directory. Opt-in, with free days and a safety note |
| `/board` | A 301 to `/feed`, so links sent before the rename still open |

## Settings

| | |
| --- | --- |
| `BOARD_DIR` | Where the feed and its media are written. Default `/data` |
| `BOARD_ADMIN_KEY` | The admin routes refuse everything without it |
| `BOARD_SALT` | Salts the device hash. Unset means an unsalted hash, which is a rainbow table away from the id it came from |
| `BOARD_MAIL_URL` | Where a code is POSTed. Default Resend's address; any provider taking `{from,to,subject,text}` works |
| `BOARD_MAIL_KEY` | The bearer token for it. Unset and signing in by address is off, and says so |
| `BOARD_MAIL_FROM` | The address it comes from, on a domain that provider has verified |
| `BOARD_AT_ROOT` | `1` serves the feed at `/` instead of the landing page |
| `BOARD_CONTACT` | A person a reader can reach who is not this software |
| `BOARD_REPORTS_TO_HIDE` | How many separate people hide a post. Default 2 |
| `BOARD_HOOK_URL` | A panel's webhook, so a held post appears in its queue without a refresh |
| `BOARD_HOOK_SECRET` | What that webhook presents. No secret means every delivery is refused rather than accepted unsigned |
| `BOARD_AUTO_PUBLISH` | `1` publishes without review. Do not |
| `TZ` | Which day "today" means on `/api/count`. Default `Asia/Shanghai` — a UTC boundary in Asia cuts the evening in half |

## What is not built

- **A check that can judge a post.** Everything is held for a person. That is
  correct and it does not scale past a few dozen a day.
- **Any notion of an account.** A handle is a name somebody typed. Two people
  can type the same one.
- **A way to message somebody in the directory.** It is a directory of people
  looking for someone to study with, and there is no way to say hello — which
  is the one thing it exists for.

Each is a deliberate absence rather than an oversight, and each is the next
thing worth doing.

## The door

Invite-only, by one setting: `BOARD_INVITE`.

| value    | what it does                                                          |
|----------|-----------------------------------------------------------------------|
| unset    | off. Anybody reads, anybody posts. What the board did before this.     |
| `post`   | anybody reads; a code is needed to post or make a page.               |
| `read`   | a code is needed to see anything. Every page is the door until then.  |

Set it in `.env` and `make deploy`. Nothing else changes.

    make invite WHO="Mei"        one code, labelled so you know who has it
    make invite WHO="Mei" N=3    three
    make invites                 what is out there, and what became of it
    make invite-off CODE=K7M2QP  take one back

Codes are six characters with no O, no zero, no I and no one in them, good
once, and rate limited to five wrong answers an hour per browser.

**Members hand them out too.** Every admitted person carries one live code in
their header; it comes back the same until somebody spends it, and then they
get another. `make invites` shows whose was whose.

**Admission is a fact about a browser** — the same salted hash everything else
here keys on, held in a signed cookie so the server knows before any script
runs. Which means the recovery key carries admission with it: paste your key on
a second browser and that browser is already in. It is also why the door tells
people to get out of WeChat's browser *before* they spend the code.

It is not encryption. Nothing on the board is encrypted at rest; the pages and
the data behind them are refused to anybody without the cookie, over HTTPS.
That is a lock on the door, not a safe.
