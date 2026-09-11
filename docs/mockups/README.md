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

**Voice, which is three different things.**

- **Speak instead of typing.** Hold the mic, talk, and it lands as text on both
  sides in both languages. Typing a second language on a phone keyboard is the
  slowest thing anybody does here, and the people who most need to say
  something are the ones doing it. A line that was spoken says `SPOKEN` under
  it — not to charge for it twice, but because the register is different:
  "send me the numbers" typed is an instruction and spoken is a conversation,
  and somebody reading it in their second language has no other way to tell.
- **Listen to a line**, in the tools under it. `speechSynthesis` is on every
  phone here and speaks Chinese; `level.html` has used it for months. It costs
  nothing and it is the difference between a board somebody uses on a train and
  one they put off until they are at a desk.
- **Sending audio: no.** A voice note is the ordinary way to talk in China and
  it is the wrong thing on this board — a Chinese voice note is a wall to
  somebody who reads English, with nothing to tap through. The voice is the way
  in, not the thing that travels, and no audio is stored or sent anywhere.

All three are free, including speaking. It was briefly the candidate for the
subscription — it is the only thing here with a real bill attached — and that
did not survive ten minutes of thinking: every phone already dictates for
nothing, so what is left to sell is dictation *plus* translation in one press,
and translation is free here for everybody. A saved tap is not a subscription.
The full argument is in `docs/todo.md`.

Two decisions worth keeping whatever gets built:

- **Connect is never in the composer.** Sending somebody your WeChat is a
  different kind of act from sending them a sentence, and a button beside the
  send key gets pressed by accident once and cannot be unpressed.
- **The board speaks in its own voice** — centred, small, no bubble — and only
  for the two facts a person cannot work out from the messages themselves: that
  they matched, and that nobody has anybody's contact yet.

## agent.html

An agent, and the people they represent, on one login.

The problem it answers is Andy's: an agent with exclusive talent will not put
that talent on a board where a producer can reach them directly. That is the
leverage and the network given away in one move. And most of the talent will
never sign up for themselves — on the film side that is not a stage, it is the
business.

So the people he represents get **ordinary accounts, and he runs them**.
Nothing is forwarded and nothing is redirected: he is the party in every
conversation and the actor is the subject of it, which is what actually happens
when a producer wants one of his people. If a performer later wants their own
account, they can have it, and it is the same account.

Five phones, in the order he meets them:

1. **Adding them** — one textarea, one name a line. He is doing this in a taxi
   or he is not doing it. Everything inherits from his own row (Performer
   looking for a Producer, Film & TV, Sydney) and is editable after.
2. **His profile** — a rail of faces along the top to switch who he is, and
   under it the list, where he edits them and chooses which five the room sees.
3. **Being one of them** — the same rail with the ring moved, plus an orange
   bar across the top: *You are Mia Chen. Everything you write is hers.*
4. **What a producer sees** — his public page, with his whole roster on it.
5. **Cards** — every match across everybody he runs, in one list.

What it asserts, so it can be argued with:

- **Switching is a rail of faces, not a menu.** He will do it twenty times a
  day, and the question he most needs answered — *who am I right now* — should
  be answerable by glancing. The ring is the answer. It goes orange when the
  answer is not him.
- **The orange bar is the whole safety story.** The one risk this feature
  carries is writing as the wrong person. So it is a state you can see across a
  room and have to leave on purpose, never a dropdown you forget you are in.
- **A cap, and it is on the room, not on him.** Five of his nine show in
  Browse; his own page shows all nine. An agent with forty people could
  otherwise be most of what anybody sees, and Browse is shared. Somebody who
  has found Andy has chosen to look.
- **One inbox, not nine.** Cards merge across everybody he runs, because he is
  the party in every one of them. Tapping one opens the conversation already
  switched to the right person, so a reply is never sent as the wrong one.
- **"Represented by Andy" is on the performer's card**, before anybody presses
  Follow — not a surprise discovered after a match. His WeChat is the one that
  crosses; that is the arrangement, said out loud.

What it needs that does not exist: everything. `board/server.js` assumes one
browser is one person — `.by === me` appears seventy-six times — so running
several rows from one login is the first real change to that assumption since
the board was written. The shapes considered and why this one won are in
`docs/todo.md`.
