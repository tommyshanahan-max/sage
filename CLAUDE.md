# Working on this box

Two products live in one repo and on one server (`~/tc`, Vultr Tokyo,
`45.77.8.166`):

- **The Exchange** — `board/`, at `liuxuesheng.io`. A private board where one
  sentence — *I am a ___ looking for a ___* — decides who you are shown.
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

`make cfm-offer WHO="Ray"` — **first names**. Whatever goes in `WHO` is the
name on the ledger and the name Tom reads back in `make cfm-offers`, so it
should be what he calls the person, not their full name.

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

`page()` caches file contents, so a running test server will not pick up an
HTML change — restart it.

```
cd board && sed 's/; Secure//g' server.js > server.nosec.mjs
BOARD_DIR=/tmp/bd BOARD_INVITE=off PORT=8391 BOARD_SALT=t node server.nosec.mjs
```

Delete `server.nosec.mjs` afterwards. Kill servers by matching `PORT=` in
`/proc/*/environ` — never `pkill -f`, which on this box has killed the wrong
node.

Chromium for screenshots is at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, driven by
`playwright-core`, with `serviceWorkers: "block"` and `waitUntil: "load"`.
