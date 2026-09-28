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

## Selling during a live

Whoever is live taps **+**: the phone keeps a still from the camera already
streaming, they type a name and a price (A$), and it joins the row under the
video. Viewers tap an item and pay with Apple Pay, Google Pay or a card, over
the video; the room sees "Amy bought …". 🎁 sends $2, $5 or $20. Chat asks
for a name once. The seller's green pill is the takings, and opens who
bought what with where to send it.

Payments go through Square (Australia), `lib/pay.mjs`:

```
ssh -t root@45.77.8.166 'cd ~/tc && make book-square'
```

asks for three values from Square's Developer Console and turns Apple Pay on
for the domain. Without it a live has no Buy or gift buttons. To try the page
with no account: `BOOK_SQUARE_FAKE=1` (refused when a real token is set).

## Another app starting lives (Laonei)

```
make book-app NAME=laonei      # its key, shown once
```

From that app's server, with `Authorization: Bearer <key>`:
`POST /api/lives {host, title?, when?, max?}` → `{id, seller, viewer, …}`,
`GET /api/lives/<id>` → open, watching, takings, `POST /api/lives/<id>/end`.
Show the seller link to whoever goes live and the viewer link to everybody
else. In a frame: `allow="camera; microphone; autoplay; payment"`.

## Not yet

- Nobody is told when a lesson is booked — `make book-list` shows them.
- Payment is a link the teacher sets; nothing checks it was paid.
