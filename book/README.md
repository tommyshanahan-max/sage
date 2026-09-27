# Book

One-to-one lessons as a widget any app can carry: a shelf of teachers, their
free hours, and a booking form, served from the Tokyo box at
`https://<board domain>/book/`.

## Putting it in an app

```html
<div data-book="studypal"></div>
<script src="https://<board domain>/book/widget.js" async></script>
```

`data-book` is the shelf. Optional: `data-accent="#c8261e"` for the button
colour, `data-lang="en"` or `"zh"`.

## Teachers

```
make book-teacher SHELF=studypal NAME="Li Wei" ZH=李薇 LINE="Beginners · speaks English" TAGS=Beginner,Speaking PRICE=¥120 HOURS="mon-fri 19:00 20:00; sat 10:00"
make book-list
make book-off NAME="Li Wei"       # and book-on
make book-cancel ID=…             # id from book-list
make book-demo                    # made-up teachers on the "demo" shelf
```

Also: `MINUTES=45`, `PHOTO=https://…`, `VOICE=https://…` (a short clip),
`PAY=https://…` (a Dealio link, shown after booking). All times are Beijing.

## Live class

One teacher on camera, up to ten watching — through LiveKit on the box
(`livekit` in docker-compose.yml; see `lib/live.mjs` for why not phone to
phone).

```
make book-live NAME=Julia TITLE="HSK 4 speaking" WHEN="2026-10-03 19:00"
make book-live-off ID=…
```

Prints her link (goes live) and one link for the group (watches). Without
`WHEN` it is open now; either way, until twelve hours after the start.
`MAX=100` for a live more than ten may watch (a market stall).

## Not yet

- Nobody is told when a lesson is booked — `make book-list` shows them.
- Payment is a link the teacher sets; nothing checks it was paid.
