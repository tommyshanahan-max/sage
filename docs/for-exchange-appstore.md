# The Exchange in an app store

Written 12 Sep 2026, alongside the commit that made the home screen work.
Check the current text of Guidelines 2.1, 4.2, 1.2 and 5.1.1 before building
against any of this: they move.

`for-studypal-appstore.md` is the same question asked about the other product,
and the answers are not the same. Study Pal records speech, uses the camera and
works offline, so it has a native argument. The Exchange is a board, a
messenger and a set of profiles. It has none, and that changes the order of
everything below.

## Already done: the home screen

This is not a consolation prize, it is the distribution that reaches the
audience. `install.js` offers it once, to a member, in whichever of the three
situations their browser is in — and the manifest, the maskable icon and the
iOS meta tags have been in place since the beginning.

What that install actually is: an icon with 交换 under it, no browser chrome, a
worker that keeps the app openable on a bad connection, and — this is the part
an app store cannot match — **it updates when the box is deployed.** No review,
no ninety-nine dollars, no Mac, and it works on a mainland Apple ID, which the
App Store below does not.

What it is not: findable by search. Nobody discovers this. It is for people who
were let in and are coming back, which is every member the board has.

## Three things stand between here and a submission

### 1. The reviewer cannot get in — Guideline 2.1

**Built, 12 Sep.** The rest of this section is how, and what it costs to run.

App Review requires working credentials, and a reviewer who meets a door
rejects the app without reading further. The door here is six characters,
named, spent on arrival, dead in 24 hours. Every one of those is deliberate and
three of them are the reason the board is worth being in — so the reviewer is
not let into this board at all.

**A second board, with nobody real in it.** `board-demo` in docker-compose: the
same image, its own volume, its own salt, its own hostname and therefore its
own cookies, and no door. Nothing in it is a person. Nothing that mounts it can
read `board_data`.

**Reached through the real door, permanently.** The reviewer types the code
from App Store Connect at the real board; `/api/enter` recognises it and
answers with the demo board's address instead of admitting anybody. The code
never spends and never expires — which is what makes it useless as an invite
and exactly what App Review needs — and it is safe because it redeems nothing
and writes nothing.

This is the shape that matters, and the alternative is a rejection: **the app
must point at the real board from the first build to the last.** Shipping the
demo address for review and switching after approval is Guideline 2.3.1, and
every update is re-reviewed, so it is caught the first time a fix ships. Here
nothing switches — the reviewer just has a key to a different room, the same
key, before approval and next year.

**They land as somebody, not as nobody.** `BOARD_DEMO_DEVICE` pins every
browser arriving at the demo board to one identity, so a reviewer opens the app
already in a seat with eight people in Browse, four connections in Cards and
two conversations in Messages. An empty account is not a demonstration of a
messenger, and an empty messenger is what 4.2 looks like from the other side of
the desk. `make demo-board` seeds it; safe to run twice.

**What it costs to keep.** The demo host has to stay up for as long as the app
is listed — every update is re-reviewed against it. Take it down and the next
release is rejected.

**What goes in App Store Connect**, under App Review Information:

- Sign-in required: yes
- User name: the code (the board asks for nothing else)
- Password: the code again — there is no second field
- Notes: say that the app is invite-only, that this code opens a demonstration
  board of sample accounts rather than the live membership, and that it does
  not expire

### 2. There is no reason for it to be an app — Guideline 4.2

A WKWebView pointed at the board is the textbook rejection, and here there is
nothing to argue back with: Study Pal can say "it records your voice and works
in the subway with no signal", and this can say that it shows you people.

The one native thing this product genuinely wants is **push** — *somebody wrote
to you* is the whole of the return loop, and right now nothing tells anybody.
Worth knowing before spending anything on a wrapper for it: **a home-screen
install can already do push on iOS** (16.4 and up, installed only) and on
Android. Push is a reason to finish the web app, not a reason to build a native
one.

**Built, 12 Sep.** The board now tells a phone when a message arrives — a
subscription per device, and a notification that carries nothing but the buzz.
So the honest sentence about this app changed today: it was a website in a
shell this morning, and it is a messenger that reaches your phone tonight.
That is the 4.2 argument, and it is the same argument on both distributions,
which is the test of whether it is a real one.

A native build still needs more than a webview in it. But the thing it needed
most is no longer missing.

### 3. It cannot reach the people it is for

The mainland store needs an ICP filing, which needs a mainland-hosted server
and a Chinese company. The server is in Tokyo. Members inside China would need
a non-China Apple ID to install it at all.

So the App Store is not a way to reach this audience. WeChat is, and the note
that carries the whole app into a chat is already built.

## What it is worth, then

The same thing it is worth for Study Pal, and the doc there says it better: a
shop window, so the thing can be looked up by somebody deciding whether to put
money in. That is a real reason. It is not a growth reason, and it should not
be paid for out of the growth budget.

## What is already in hand — checked against the code, 12 Sep

An earlier draft of this file said the four things Apple asks of anything
carrying other people's words were "mostly built" and called that a fortnight
already saved. Three of the four hold up. One was overstated, and it is the one
a reviewer tests.

**Report — built.** Two server routes, one for a post and one for a message,
and a report puts the thing at the head of the admin queue rather than in a
mailbox. Guideline 1.2 expects action inside a day and that is where it
happens.

**Block — built, 12 Sep, and it was worse than this file first said.**

The browser list was not merely per-browser. It was only ever applied to
POSTS, in the feed's filter, and the feed is off — Browse never consulted it.
So the "also block them" checkbox under a report had been writing to a set
nothing read: a safety control that is present, pressed, and does nothing.

It is a row now. They leave your Browse, they cannot write to you and you
cannot write to them, it follows you to your other phone, and they are never
told. Keyed on the person id rather than the handle, because a block somebody
can rename their way out of is not one. Whatever a browser had blocked before
is handed over once, on the next load, and then forgotten.

Separately, *leaving a conversation* (`shuts`) was already right: mutual,
permanent, server-side.

**Delete the account — built.** `/api/me/forget`, reachable from Profile, and
it takes the photographs and every row with it rather than hiding a
tombstone. 5.1.1(v) wants exactly this and wants it inside the app.

**A published contact — built, but check it is switched on.** `BOARD_CONTACT`
is read by the server and printed in the footer; unset in `.env`, the line
exists in the code and appears nowhere on the page. `grep BOARD_CONTACT .env`
before submitting.

The cost left is a Mac and the developer programme. §1 is done, §2 is done,
and the four things above are now four.

## The order

Not yet. Forty-seven people are standing in the queue and the room they are
waiting for has six people in it. An App Store listing for a room with six
people in it is a shop window onto an empty shop. Clear the queue, get every
member a face, get thirty people into one room — then the listing is worth
what it costs, and the demo room in §1 is easier to build besides, because
there is something real for it to be a copy of.

Related: `for-studypal-appstore.md`, `for-studypal-ios.md`.
