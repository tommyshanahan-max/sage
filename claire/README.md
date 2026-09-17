# ClaireTv

Vertical micro-drama. Ninety-second episodes, eighty to a series, watched
one-handed — and a console a business partner runs the catalogue from without
touching this repository.

The product is not the video. It is **where the wall falls**: free through
episode seven, locked at eight, on the line where she reads her own name on the
contract. Everything below exists to make that one setting easy to change and
honest to measure.

---

## What is real, and what is not

Said here rather than discovered later.

| | |
|---|---|
| **Real** | The catalogue, the wall, the coin ledger, unlocks, play positions, the partner console, the three numbers the wall is judged by |
| **Not** | Video hosting — an episode carries a URL, not a file |
| **Not** | Payment — coins are granted by a partner, not bought |
| **Not** | Sign-in — a viewer is a browser, exactly as on the board |

Each of those three is a service and a bill rather than a data model, and none
of them changes the shape of what is here. A `Buy coins` button that took no
money would be a mockup wearing a product's clothes, so there isn't one.

---

## Two doors

```
/          the app        anybody, no account
/partner   the console    a key in a header, and nothing else gets in
```

`CLAIRE_PARTNER_KEY` is the whole line. Unset, every partner route answers 503
and the console says so on its own front page — the safe failure, because a
catalogue anybody can edit is worse than one nobody can.

The key is compared in constant time. A key compared with `===` is a key a
patient stranger can guess one character at a time.

---

## Running it

On the box, once the vars below are in `.env`:

```
cd ~/tc && git fetch origin && git reset --hard origin/<branch> && make deploy
```

It stays off until `claire` is in `COMPOSE_PROFILES`, like every other optional
service here.

Locally:

```
cd claire
CLAIRE_DIR=/tmp/cl CLAIRE_SALT=t CLAIRE_PARTNER_KEY=testkey PORT=8501 node server.js
```

Then `http://127.0.0.1:8501/` for the app and `/partner` for the console.
`page()` caches HTML, so **restart the server after an HTML change** — the same
trap the board documents.

---

## Settings

| Variable | What it decides |
|---|---|
| `TOMSCODING_CLAIRE_SALT` | Salts the device hash. Without it the stored hash is a rainbow table away from the id the browser sent. |
| `TOMSCODING_CLAIRE_PARTNER_KEY` | The console's door. Unset means closed. |
| `TOMSCODING_CLAIRE_WELCOME_COINS` | What a new browser starts with. Default 20 — **deliberately fewer than one episode costs**. A welcome balance that opens the first locked episode teaches people that walls open by themselves. |

---

## The three numbers

The console shows them per series, in this order, because the ratio between the
first two is the only feedback the `free through` setting ever gets:

- **reached the wall** — played the last free episode
- **paid** — distinct viewers who unlocked anything in that series
- **coins taken**

Move `free through` from 7 to 5 and both of the first two move. That is the
experiment the whole business is.

---

## Where the data lives

One JSON file in a Docker volume, the same call `board/lib/store.js` makes for
the same reasons: legible with `cat`, copied with `cp`, backed up by anything
that can copy a directory. A catalogue of eighty series is four hundred
kilobytes. The day it stops being enough is a day with a number attached to it,
and the shape stored is deliberately the shape a row would take.

Writes are serialised and land by rename. A half-written catalogue is the one
failure that loses everything at once.

---

## What comes next, in the order it will hurt

1. **Video.** A URL per episode works for a pilot and not for a hundred
   viewers. Transcoding to HLS and a CDN in front of it is the first real bill.
2. **Payment.** Coins have a ledger already; what they do not have is a way in.
   Apple takes 30% of an in-app purchase, which is the number that decides
   whether this is an app or a web app people pay for in a browser.
3. **Somebody else's catalogue.** The console assumes one partner. A second one
   needs a key each and a column saying whose series is whose.
