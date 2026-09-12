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

This is the blocker, it is specific to this product, and it is not a packaging
problem. App Review requires working credentials in App Store Connect, and a
reviewer who meets a door rejects the app without reading further.

The door is six characters, named, spent on arrival, and dead in 24 hours.
Every one of those properties is deliberate and three of them are the reason
the board is worth being in. A reviewer needs a code that is **not** spent on
arrival and does **not** expire — a permanent hole in the exact mechanism the
product is built on.

The way through it is a room the reviewer is admitted to that contains nobody
real: a demo identity, a handful of invented members, the messenger working
against them. It is a fortnight of work and it is honest — it is what the
reviewer is entitled to see, which is the app functioning, not the membership.
Doing it any other way means a live code sitting in a form at Apple.

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

If a native build happens anyway, it needs more than a webview in it or it
comes back.

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

## What is already in hand, if it goes ahead

The four things Apple asks of anything where people can post are mostly built:
report a post, block a person, delete an account and take the data with it, and
a published privacy page. That is the part that usually takes a fortnight, and
it is done.

The cost is a Mac, the developer programme, the demo room in §1, and whatever
§2 turns out to need.

## The order

Not yet. Forty-seven people are standing in the queue and the room they are
waiting for has six people in it. An App Store listing for a room with six
people in it is a shop window onto an empty shop. Clear the queue, get every
member a face, get thirty people into one room — then the listing is worth
what it costs, and the demo room in §1 is easier to build besides, because
there is something real for it to be a copy of.

Related: `for-studypal-appstore.md`, `for-studypal-ios.md`.
