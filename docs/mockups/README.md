# Mockups

Not built yet, and not wired to anything. Open the file.

Each of these is a single self-contained HTML file with no build step and no
external requests, for the same reason everything else here is: a page that
cannot reach a CDN from mainland China is a page that arrives unstyled. They
carry their own fake data so they open and look right on their own.

The point of keeping them in the repository rather than in a chat is that a
mockup is a decision written down. When the thing gets built, the argument for
why it looks like that is in here, in the file, next to the thing it argues
about.

## social.html

The Social panel, from the Jrend Tap deck, pointed at the catalogue Study Pal
already has rather than at third-party merchandise.

Three views, deep-linkable — `#home`, `#feed`, `#people`.

What it asserts, so it can be argued with:

- **A share is for a named person, and carries their code.** `?via=mia&to=ep3`
  says who shared it and what it points at. WeChat strips referrers, so this is
  the only signal that survives being forwarded.
- **Sent → reshared → arrived.** The engine in the deck is not that you post,
  it is that somebody else does, to an audience you do not have. Only the last
  of those three figures is flattering.
- **Tag the catalogue, not merchandise.** The deck tags handbags, which needs
  merchants, inventory and a payments business first. The series on the shelf
  and the features in the app are already yours.
- **No wallet.** The deck withdraws in foreign currencies and bitcoin. Moving
  money across the Chinese border is a licensed business, not a feature.
- **Channel credentials stay out of the platform.** Posting to WeChat needs
  WeChat's token, and this box should not hold tokens for someone else's
  accounts — the same call already made for Seedance, which reaches Sage
  through the microdrama project rather than living here.

What it needs that does not exist:

- Study Pal has to record `via` on first arrival and report it. Nothing
  generates those codes and nothing reads them, which is why the dashboard's
  "Who sent them" panel still says *not reported by the app yet*. Until that
  lands, every arrival figure in the mockup is invented.
- Somewhere to keep a person — name, channel, code, what has been sent. A file
  beside `series.json`, in the project that owns the relationship.
- The Sharing / Slowing / Stalled states are a guess. Real thresholds need real
  reshare data, which is the same blocker as above.

## chat.html

The conversation, as a conversation.

Messages today is a list of rows: every line of a thread is its own card with
its own buttons, newest first, so a thread reads backwards and a reply sits
above the thing it answers. That was the right shape while a message was an
introduction — one thing said, once. It is the wrong shape the moment two
people can keep talking, which is what the pricing note in `docs/todo.md`
proposes selling.

Three phones, side by side, because the argument is about what happens between
the states rather than about any one of them:

- **Open** — they matched, both can talk. One thread, oldest at the top, the
  name once in the bar and never again. Under it, in one line, why these two
  came up for each other.
- **Free** — one thing each, then the thread rests. The wall is a sentence
  rather than a locked door, and it says what happened, what is still possible,
  and what the other thing costs, in that order.
- **After Connect** — the WeChat id has been sent, by a person, on purpose.

**Crossing the language, which is the whole board.** Half the members do not
share a language with the other half — cross-border is the word in the invite —
so translation is not a setting in a menu and not a button pressed on every
line. It cannot be, because one of the two people is reading their second
language and the other is not, and it is always the same one doing the
pressing.

So every bubble is already in the reader's language. One types English, the
other sees Chinese, and neither does anything about it. What the other person
actually typed is one tap underneath — never above and never instead: a
translated line is a machine's opinion of what somebody said, and when the
sentence is about money the person who can half-read the original is entitled
to check it.

The pair is set once at the top of the thread and shown as **EN ⇄ 中**. Not
flags: a flag names a country and a language is not one — English would have to
choose between two of them and Chinese has more than one home, and this board
has members on both sides of that.

Nothing new is needed to build it. The board has its own translator already —
`board/lib/translate.js` behind `POST /api/translate`, rate-limited per device
and per day because a public endpoint that calls a model is a bill anybody can
run up. Study Pal's translation code stays in Study Pal's repository.

The mic beside the composer is the browser's own speech recognition, the same
way the door already uses the browser's own voice to read a welcome aloud: no
vendor, no key, nothing leaves the phone until send is pressed. Hidden where
the browser has none rather than offered and broken. Typing a second language
on a phone keyboard is the slowest thing anybody does here, and the people who
most need to say something are the ones doing it.

Two decisions worth keeping whatever gets built:

- **Connect is never in the composer.** Sending somebody your WeChat is a
  different kind of act from sending them a sentence, and a button beside the
  send key gets pressed by accident once and cannot be unpressed.
- **The board speaks in its own voice** — centred, small, no bubble — and only
  for the two facts a person cannot work out from the messages themselves: that
  they matched, and that nobody has anybody's contact yet.
