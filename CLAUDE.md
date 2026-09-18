# Working on this box

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

`make rebuild` rebuilds only the workspace. `make up` and `make deploy` build
everything. Reaching for `rebuild` after a change to `board/` is the mistake.

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
- **Write for somebody doing something else.** Everybody reading this product
  is half-looking at a phone — in a taxi, in a queue, between two other
  things. They read the bold line and maybe one more. So: the fact first, one
  sentence, and stop. Reassurance, context and the reason it works that way
  are all things to leave out; if a screen needs them, the screen is wrong.
  Three sentences where one does is the commonest fault here and it is worth
  re-reading every new string for it.
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
