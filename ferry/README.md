# Ferry

Two people, two languages, one room. You type in yours, they read theirs, and
neither of you does anything about it.

Built out of the board's messaging while working out what that screen should
be — see `docs/mockups/chat.html` for the argument, and `docs/todo.md` for why
none of this is what gets charged for.

## What the server knows

Almost nothing, which is the point and the only reason to use this rather than
WeChat.

A room's key is generated in a browser and lives in the **fragment** of its
link — the part after `#`, which browsers do not send to servers by the
specification rather than by our good manners. Every line is encrypted with it
before it is posted and decrypted after it is fetched, both in the browser.
What is on this disk is a room id, some timestamps, a letter saying which of
the two chairs a line came from, and a base64 blob nothing here has a key for.

Names and languages are inside the blob with the text.

**Translation is the one exception, and it is deliberate rather than hidden.**
Rendering a line in the other language means somebody has to read it, so the
browser sends that one line in the clear to `/api/translate`, gets the sentence
back, and seals it into the same blob. The text is in this process for the
length of one request. It is never written to disk and never logged; the only
place it lingers is a five-minute in-memory cache that dies with the container.

**It is not end-to-end encrypted and this repository will not call it that.**
The translation exception is real, and a room's key is in a link that two
people have. What it protects against: whoever runs this box, a stolen disk, a
subpoena served on the server, and every messenger that reads what passes
through it. What it does not: somebody holding the link, or an unlocked phone.

## Losing the link

The link is needed once per device. After a room is opened, the key is kept in
that browser and Ferry lists the room by name — day to day nobody goes hunting
for a link. The link stays the backup, and the other person has a copy of it.

Still to build: **email me this room**, so a third copy lives in an inbox. The
board's mailer is `board/lib/mail.js` and is the obvious thing to point at.

## Running it

    cd ferry
    FERRY_DIR=/tmp/ferrydata PORT=8460 node server.mjs

Translation is off without a key, and the page says so rather than offering a
button that fails. With one:

    FERRY_KEY=sk-ant-... FERRY_DIR=/tmp/ferrydata PORT=8460 node server.mjs

| Variable | What it does |
|---|---|
| `FERRY_DIR` | where rooms are written. Default `/data` |
| `FERRY_KEY` | the model key for translation. Falls back to `ANTHROPIC_API_KEY` |
| `FERRY_KEEP_DAYS` | a room nobody has opened for this long deletes itself. Default 90 |
| `FERRY_BURST` `FERRY_REFILL` `FERRY_DAY` | what translation may cost, per room and per day |

## Not done yet

- **Not wired into `docker-compose.yml`**, on purpose. A new service on that
  box comes up behind a profile and a Caddy site, and the Caddy rule there is
  unforgiving — one variable per address, and two blocks sharing an address is
  a startup failure that takes every other site down with it. That is a job for
  a clear head, with `scripts/check-sites.py` run before the deploy.
- **Email me this room.**
- **No push.** A browser page gets no notifications on iOS; if that turns out
  to matter, the answer is a home-screen app first and a native one only if
  somebody actually asks.
