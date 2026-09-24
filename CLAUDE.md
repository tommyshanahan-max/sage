# Working on this box

**`NOW.md` first, every session.** It says what is already true and who is
being waited on — which account is in review, what has already been watched
working, what is broken today. It exists because a session proposed rehearsing
a payment flow that had run end to end on a phone the day before. Reading it
costs a screen; not reading it costs an hour of somebody's morning. Update it
when something in it stops being true.

Two products live in one repo and on one server (`~/tc`, Vultr Tokyo,
`45.77.8.166`):

- **The Exchange** — `board/`, at `thexchange.app`. A private board where one
  sentence — *I am a ___ looking for a ___* — decides who you are shown.
  `liuxuesheng.io` serves the same board and is not a redirect: `board_in`,
  `board_wait` and `board:device` are host-only, so a 301 would sign every
  member out at once. Both names, until nobody arrives on the old one. See
  the domain section of `app/README.md`.
- **crowdfundme** — `cfm/`, at `crowdfundme.app`. The ledger the share offers
  are written on, and where the pitch decks are served from.

`agent/`, `partner/`, `thefeed/` and `analytics/` are the other containers on
the same box. `make up` lists them all.

## Deploying

Claude has no network path to the server. Every deploy is a command handed to
Tom to run himself — never claim something is live until he says it is.

```
cd ~/tc && git fetch origin && git reset --hard origin/<branch> && make deploy
```

`git reset --hard`, not `git pull` — a pull once left a merge commit on the box
and `make deploy` refused with "Diverging branches".

**When `make deploy` says "Not possible to fast-forward", use `make up`.**
`make deploy` does its own `git pull --ff-only` on whatever branch the box is
checked out on. If the box has been reset to a commit from a *different*
branch — which is what happens when somebody deploys another session's work —
the local branch name and the commit disagree, and that pull can never
succeed. `git fetch && git reset --hard origin/<branch> && make up` puts the
right code on disk and builds it without a second pull. This cost most of an
afternoon: the deploy failed, nobody read the error, and the screen it was
meant to ship was reported missing three times.

`make rebuild` rebuilds only the workspace. `make up` and `make deploy` build
everything. Reaching for `rebuild` after a change to `board/` is the mistake.

**A GIT PULL ON THE BOX DOES NOT UPDATE `board/`.** Everything under `board/`
— `server.js`, every page in `public/`, `lib/` — is COPYed into the image at
build time, so a `git reset --hard` leaves the running container serving the
old file and nothing says so. Only `scripts/` is bind-mounted, which is why a
`make` target that runs a script picks up a pull immediately and a change to a
page does not. This cost several rounds in one afternoon, three separate
times: a Chromium path in an image, a new field in `server.js`, and a colour
in `shop.html`. If a change is under `board/`, it needs `make deploy`.

**The names in `.env` are `TOMSCODING_*`; the container sees `BOARD_*`.**
`docker-compose.yml` maps one to the other. So grepping `.env` for a `BOARD_`
name always finds nothing, and a `grep -c` that answers 0 means "not under
that name", not "off". This cost an evening: the demo payment flow was
switched off by deleting a line that did not exist, the check agreed, and the
next payment was still a demo. Ask the container instead —
`docker compose exec -T board printenv BOARD_DEALIO_DEMO` — which cannot
answer for a name nobody set.

## Offers and invites

**`WHO` is a first name, everywhere, on every target.** `make cfm-offer`,
`make peek`, `make handroom`, `make invite`, `make card` — Tom calls people by
their first name and that is what he types. Offering him a command with a full
name in it is a command he has to edit before running, and it has been offered
more than once.

The exception is not an exception to that: on the board, `WHO` is the handle
the person chose, so it is whatever they typed. Usually a first name. When it
is not, `make who` is the only place that knows — read it rather than guessing
from how somebody was described in chat, because a wrong handle fails with
"Not on this board" and looks like the person is missing when they are not.

`make cfm-offer WHO="Ray"` — whatever goes in `WHO` is the name on the ledger
and the name Tom reads back in `make cfm-offers`, so it should be what he calls
the person.

`make invite WHO="Tom" FOR="Ian"` — `WHO` is whoever is *vouching*, and it is
the name the door says out loud ("Tom let you in"). `FOR` is the person the
code is for. Putting the recipient in `WHO` mints a code that credits them
with bringing themselves in.

**The invite is settled — don't redesign it.** Tom likes it as it stands, both
halves. The printed message (`scripts/invite.mjs`) is a block between two rules,
ready to paste into WeChat, with the link and the code on separate lines. The
page it opens (`board/public/enter.html`) greets the person by name, says who
let them in, counts down to the deadline, and takes six characters. What makes
it work, and what any change has to keep:

- **The link alone opens nothing.** The code travels beside it, so a link
  forwarded by accident is not a way in.
- **Named.** "Ray — this is the board I mentioned", and the door says "Tom let
  you in". Not "You have been invited".
- **A visible clock.** The deadline is in the link and the page counts it down,
  so "good for 24 hours" is true without anybody remembering to make it true.
- **One person, once.** Spent on arrival.

`make cfm-project ID=... NAME="..."` before any offer for a project the ledger
has never heard of — otherwise the offer comes back as "bad", which is true
and no help at all.

Decks live in `cfm/deck/<name>.html`, built with
`node scripts/deck-build.mjs <name>`, and their addresses are kept in
`cfm/deck/urls.json` so editing a deck never breaks a link already sent.

## Fewer steps

Tom is visually impaired. Assume the screen is hard and small text is worse.
This is not a preference to accommodate now and then; it decides what counts
as finished work.

- **A command, not a place on a screen.** "Click the blue button top right" is
  an instruction that cannot be followed. Everything that can be done from the
  terminal should be handed over as one line to paste.
- **Ask for output, not screenshots.** Anything needed back is something a
  command can print.
- **One command, not three.** If a thing needs a fetch and then a run, the
  command does the fetch. If it needs a file edited first, the value comes in
  as an argument instead. If it offers a preview run, ask whether the preview
  is worth a step to somebody who has to do the whole thing twice — usually it
  is not.
- **A numbered list is usually unfinished work.** Handing over five steps is
  handing over the part that was not automated. Wrap it in a `make` target and
  hand over the target.
- **Never make him do the same fiddly thing twice.** A step performed by hand,
  once per machine, with no check that it happened, is a step that will be
  wrong. Delete it or make something else do it.

The test: read back what is about to be sent and count the things he has to do.
If it is more than one, the work is not finished.

## Standing rules

- **Laonei / StudyPal code stays out of this repo.** It is a separate product
  in another repo. Its pitch page may be served from crowdfundme, because that
  is the platform Tom does his deals on, but none of its code belongs here.
- **The partner has access to Sage and the repos Tom allows, and to nothing
  else on tomscoding.com.**
- **Secrets live in `.env` on the box.** Never in chat, never in a commit,
  never in a document.
- **The product does not claim to be encrypted.** It is not, and saying so
  would be a lie told to people who are trusting it with who they know.

## Writing

- Answers short. Screens and bullets over paragraphs.
- **Design for somebody who does not want to read.** Not somebody who reads
  fast — somebody who will not read at all. A screen gets four seconds and one
  glance. So: a headline, the thing itself, and the button. Facts belong in a
  row of four-word lines somebody can run their eye down, never in a
  paragraph, and a heading above a paragraph is two things to read instead of
  one. Apple sells a two-thousand-dollar phone with nine words and a picture
  of it. Every time this has been got wrong here it has been got wrong the
  same way, and Tom has said so four times: "very text heavy", "info
  overload", "too much text", "design this for people that dont want to read
  much". If a screen needs a paragraph to make sense, the screen is wrong.
- **Coarse first, finer on a tap.** A screen carries the concepts, not the
  detail: a short line that names a thing, and the explanation behind it for
  whoever wants it. Nothing is lost by moving a paragraph one tap deeper —
  it was not being read where it was. This is the shape of the whole product:
  a list of rows, a row opens, the row's detail opens. Every screen should be
  a level of that tree and never two levels at once.
- **Write for somebody doing something else.** Everybody reading this product
  is half-looking at a phone — in a taxi, in a queue, between two other
  things. They read the bold line and maybe one more. So: the fact first, one
  sentence, and stop. Reassurance, context and the reason it works that way
  are all things to leave out; if a screen needs them, the screen is wrong.
  Three sentences where one does is the commonest fault here and it is worth
  re-reading every new string for it.
- **The Chinese payer already knows how to pay.** They use WeChat Pay and
  Alipay every day, for everything, and they have been doing it longer than
  anybody reading this. So a string that explains their own wallet back to
  them is both wrong and slightly insulting: lead with the gesture they
  already make, and leave the fallback to a second clause.

  The line under a QR code said *"Can't scan your own screen? Screenshot the
  code, then long-press it."* Long-pressing a code to identify it is an
  everyday gesture in both wallets — it is how anybody opens a code sent to
  them in a chat — so that sentence opened with a problem they do not have
  and buried the answer under a step they do not need. It now reads
  `长按二维码识别` first. Tom has said this more than once, and it is the
  actual selling point of the product: Stripe's own page assumes an American
  reading English; this one assumes somebody who is already in WeChat.

  The general rule, for anything that touches the payer: write for fluency,
  not for instruction. If a string is teaching a Chinese user about China, it
  is the wrong string.
- Strings go in `board/public/i18n.js`, in **both** languages, and the Chinese
  is written rather than translated. After every edit:
  `grep -o '^  "[a-zA-Z0-9._]*":' board/public/i18n.js | sort | uniq -d`
- Comments in the code say *why*, including what was tried and what broke.
  That is the house style; match it.

## Testing locally

`make try` is the one for Tom: it stands the board up on whatever machine it is
run on, with a room already in it, opens the browser, and takes everything away
again on Ctrl-C. Nothing it does touches the server. That is what to hand over
when he wants to see something before it is deployed — never the recipe below.

```
make try
```

The recipe it wraps, for working here. `page()` caches file contents, so a
running test server will not pick up an HTML change — restart it.

```
cd board && sed 's/; Secure//g' server.js > server.nosec.mjs
BOARD_DIR=/tmp/bd BOARD_INVITE=off PORT=8391 BOARD_SALT=t node server.nosec.mjs
```

Delete `server.nosec.mjs` afterwards.

A seeded person row that skips `id` is dropped by `cleanPerson` on load, in
silence: the screen renders, the person is simply not there, and whatever
depended on knowing who the reader is says something untrue instead. Twenty
hex characters — and only hex, so a name spelled into the id is a row that
vanishes. Kill servers by matching `PORT=` in
`/proc/*/environ` — never `pkill -f`, which on this box has killed the wrong
node.

Chromium for screenshots is at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, driven by
`playwright-core`, with `serviceWorkers: "block"` and `waitUntil: "load"`.
