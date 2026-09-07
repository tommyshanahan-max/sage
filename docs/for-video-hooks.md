# Hook videos for The Tutor — a brief for whoever can call ByteDance

Hand this to the person or repo with working BytePlus ModelArk access. It says
what to make and, more usefully, what not to bother making.

## Why this brief exists

`agent/lib/video.js` in this repo already speaks to Seedance on BytePlus: post a
task, poll, download the file before their URL expires. There is a page at
`/video.html` on the seat and four routes behind it. It is inert only because
two lines are commented out in `env.tomscoding`:

    TOMSCODING_ARK_API_KEY=
    TOMSCODING_ARK_VIDEO_MODEL=      # an ep-m-… endpoint id, not a model name

Set both on the box and `make deploy`, and the button appears. Nothing else is
needed. The key belongs in `.env` on the server and nowhere else — not in a
chat, not in this file, not in a commit.

One caveat written into that file by its author and repeated here because it
still holds: docs.byteplus.com was unreachable when it was written, so the
request and response shapes came from secondary sources. They are believed
right, not verified. The base URL, the path and the model id are configuration
for exactly that reason. **The first real call is the test**, and failures
surface the upstream status and body verbatim so one attempt is enough to
diagnose a shape mismatch.

## What these are for

Four functions need a hook each. They are posted into WeChat groups and onto the
board, where the only thing that survives a forward is the file itself — so
every one has to work with the sound off and read in about two seconds.

Vertical, 1080×1920, 3–6 seconds, no captions burned in beyond what is listed
(the copy is added afterwards, in both languages, so it can be corrected without
re-generating).

## Do not generate these with a model

**The UI hooks.** Browse students, the personality test, and comparing with a
friend are all screens. A generated video of a screen is a video of a screen
that does not exist, and it will not match the product a person opens ten
seconds later. Those are rendered from the real interface — see
`scripts/` and the browse hook already made this way — and they cost nothing.

**Anything with a face that is meant to be a user.** The board carries
photographs of real students. A generated face presented alongside them is the
one thing on this product that cannot be taken back once somebody has screenshot
it.

## Worth generating

Only the things that are neither a screen nor a person: the situations the app
is for. These are the shots a model is actually good at, and they have no UI to
get wrong.

1. **The moment before the app** — a person's hands holding an unreadable
   packet in a Chinese supermarket, shelf behind, no face in frame. Close, warm,
   handheld. Copy added after: *"You have been standing here for four minutes."*

2. **The empty seat** — a café table with two chairs, one empty, a notebook and
   a phone on it, late afternoon light. Static, slow push in. For the
   study-buddy hook: *"Nobody wants to revise alone."*

3. **A campus at night** — a Beijing university building with lit windows,
   people crossing at distance, no face readable. For the language test:
   *"Which class you were put in is not where your Chinese actually is."*

Ratio 9:16. No text in the generated frames — every model spells Chinese wrong
often enough that it is not worth the check.

## What to send back

The finished files, and the endpoint id and prompt used for each, so a shot that
lands can be regenerated at a different length without guessing what produced
it.
