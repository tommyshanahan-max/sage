# The hello page's question box, landing in a chat

For the session that looks after `liuxuesheng.help`. The board half is in this
repo; the page half is not. This says what each side does and why it is shaped
this way, so neither of us invents the other's half.

## What a person does

On `liuxuesheng.help/hello` they tap **Doing business with China**, pick one of
three, write one sentence, and press send.

    Sell something into China        → the question goes to Tom
    Find someone credible in China   → the rooms on the board, no message at all
    Check if something is true       → the question goes to Tom

Two of the three need Tom's judgement. The middle one does not — a board of
vouched people IS the answer to "who can I trust", and sending somebody to a
message box to ask for a name is slower than letting them look.

## Where the question lands, and why not email

It lands as a **one-to-one chat with Tom on the Exchange**. Not a mailbox.

- He answers where he already is, on his phone, with the buzz that now works.
- Voice and video are in that thread already.
- The person becomes a row on the board rather than a line in an inbox, which
  is the funnel this whole page exists to fill.
- **No contact detail is asked for.** The thread is the way to answer, so the
  form has no "your WeChat id" field — which is one less box, and one less
  reason to close the tab. Asking a stranger for a contact detail before you
  have said anything is the thing the board refuses everywhere else.

## The machinery that already exists

Nothing here is new. Walked end to end on 27 Sep:

- `POST /api/write` mints a six-character code for a note from a member.
  `to` and `line` are both optional — a bare link is the ordinary case.
- `/join/chat/<code>` opens that note for somebody the board has never heard
  of. Outside the door on purpose.
- `POST /api/write/reply` takes their name and their answer. It puts them on
  the waiting list with the answer as the reason AND writes the thread's first
  messages, so they land in Messages with the conversation open.
- `notePermit` then lets the two of them write to each other, because Tom
  wrote first — pair-wise, not a door left open. Second tier still cannot
  message tier one in general.

## What the board side needs (this repo)

One route, so the page never holds the admin key:

    POST /api/admin/ask   { who: "Tom", need: "sell"|"check", line: "<sentence>" }
    → 201 { code, till, url }

It mints the write on Tom's behalf, with `line` carrying the sentence and the
`need` in front of it so he can see at a glance which of the three it is. The
page is handed back the `/join/chat/<code>` address and sends the browser
there. `admin`-authenticated like every other operator route.

Not written yet. Say the word and it is a small change.

## What the page side needs (the other repo)

- The form posts to its OWN server, never to the board from the browser: the
  admin key stays on the box.
- That server calls `POST /api/admin/ask` and redirects the person to the
  `url` it gets back.
- Nothing is stored on the page side. The board is the record.
- The middle choice never calls anything: it draws the five rooms and links
  each to `https://thexchange.app/r/<key>` — `trade`, `film`, `invest`,
  `raise`, `other`. Those addresses are already public and already work.

## The mockup

`Hello Page — Two Buttons` on the canvas — three boards: the page as it is,
the page with two buttons, and the screen behind the red one, with the room
branch working. Ask Tom for the link.
