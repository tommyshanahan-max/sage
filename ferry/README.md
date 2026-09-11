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

## The invite: a link and a code

The key used to be in the link, which made the link the room — forward it by
accident and you have given everything away. The board's invites do not work
that way and this one does not either.

The key is derived from **both halves**: a 256-bit secret that rides in the
fragment, and six characters that do not ride anywhere. Neither opens a room
alone. PBKDF2 at 250,000 rounds ties them together, which costs a phone a
moment once per device and makes guessing the code against a stolen link
expensive rather than instant. The alphabet has no O, no zero, no I and no one
in it — the four that get read back wrong out of a chat window; the same
alphabet the board's invites use, for the same reason.

Pressing **Link** prints the message ready to paste, in the shape the board's
invites go out in: a block between two rules, the link and the code on their
own lines, both languages, and the sentence about WeChat's browser that stops
somebody becoming two people. There is a **Just the code** button for sending
the halves by two different routes, which is the point of having two.

Whoever opens the link is asked for the code. A wrong one is told apart from a
broken link by trying it against a line the room already holds: if nothing
opens, the code is wrong, and saying so is the difference between somebody
re-reading a chat message and somebody giving up.

## Losing the link

The link and the code are each needed **once per device**. After a room is
opened the derived key is kept in that browser and Ferry lists the room by
name — day to day nobody goes hunting for either. The message stays the backup,
and the other person has a copy of it.

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

## On a home screen, and telling you a line arrived

**Installable.** A manifest, three icons and a service worker: added to the
home screen it opens full-screen with its own icon and no address bar, and it
opens instantly with no signal — the shell is cached and the conversation is
already decrypted in that browser's own storage. The service worker caches the
page and the icons and **never** a request to `/api/`: a cache of replies would
be a copy of the room sitting somewhere the promise says nothing about.

**Notifications carry no words.** This box has no key for the room, so it
cannot say what arrived — only that something did. Every push says the same
sentence and opening it brings you to the room. That is a real limitation, you
cannot triage from a lock screen, and it is the honest shape: a lock screen is
the least private surface a phone has, and a product that *cannot* leak a
message there is worth more than one that promises not to.

Off until a keypair is set. `make ferry-keys` prints one; the two lines go in
`.env`. With them unset the page never asks anybody for permission, which
matters — a browser lets you ask once, and a dismissal is permanent.

**Asked after the first line is sent**, never on arrival, for the same reason.

What is stored for it: a URL at Apple or Google and two keys belonging to a
browser, kept beside the room under the chair it belongs to. It says a device
is in a room. It does not say who, and it cannot read anything. A room nobody
subscribed from holds none of it.

**iOS needs the home-screen install first.** Safari will not deliver a push to
a page in a tab. Android and desktop work either way.
