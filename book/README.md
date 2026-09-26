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

## Not yet

- Nobody is told when a lesson is booked — `make book-list` shows them.
- Payment is a link the teacher sets; nothing checks it was paid.
