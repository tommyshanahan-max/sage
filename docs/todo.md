# Open

Things known to need doing, in rough order of what they cost if left. Each one
says what it is, why it matters, and what finished looks like — a list that only
names tasks turns into a list nobody can act on six weeks later.

Add to it as things come up. Delete an item when it is genuinely done, rather
than ticking it: a file of struck-through lines is harder to read than a short
list.

## Now

### Make the `sage` repository private

**What.** `github.com/tommyshanahan-max/sage` is public. So is `THE-MESS`.

**Why it matters.** This repository is the whole deployment: `docker-compose.yml`,
the Caddy configuration, `env.tomscoding`, and a README that explains in detail
how the partner seat is isolated and why each control is where it is. No secrets
are in it — those live in `.env`, which is not committed — but the design is the
thing being published, and one of the stated requirements is that a business
partner sees Study Pal and nothing else about how this box is built. That is not
true while the blueprint is on the open internet.

It matters twice over if any of this is ever sold: the isolation design is a
large part of what would make it worth buying.

**Done looks like.** Settings → General → bottom of the page → Change repository
visibility → Private. Same for `THE-MESS` if it holds anything real. Note that
anything already cloned or cached stays cloned; making it private stops new
readers, it does not un-publish.

### Rotate the Anthropic API key

**What.** `ANTHROPIC_API_KEY` in `.env` on the box.

**Why it matters.** It is in three containers' environments — the workspace, the
agent, and the partner seat — and the partner seat's tool deny-list exists
largely because `env` in that container would print it. It has also been in this
deployment since the beginning, through several people's hands.

**Done looks like.** New key at console.anthropic.com, old one revoked, `.env`
updated, `make up`. The revoke is the half that matters; a new key alongside a
live old one is not a rotation.

### Rotate the BytePlus Ark key

**What.** `TOMSCODING_ARK_API_KEY` in `.env`, the ByteDance video generation key.

**Why it matters.** The first one created, `ark-ca0ba3c3-…`, was pasted into a
terminal as a command by accident and appears in a screenshot. Treat it as
public. It is the one key here that spends money directly — a leaked key is
somebody else's video generation on your account, and the daily ceiling in this
platform does not apply to anyone calling BytePlus straight.

**Done looks like.** New key in the BytePlus console, old one deleted there,
`.env` updated, `make up`. Deleting the old one is the half that matters.

### Rotate Study Pal's admin key

**What.** `TOMSCODING_STUDYPAL_KEY` in `.env`, which the story desk uses to
publish to the live catalogue.

**Why it matters.** It was pasted into a chat transcript. Transcripts are stored.
Treat any secret that has been in one as public.

**Done looks like.** New key generated on Study Pal's side, `.env` updated,
`make up`, old key rejected by the app.

### Rotate the Study Pal webhook secret

**What.** `TOMSCODING_STUDYPAL_WEBHOOK_SECRET` in `.env` on this box, and
`PUBLIC_WEBHOOK_SECRET` in `/root/fern/deploy/fern/.env` on Study Pal's box
(`45.32.58.178`). They are one shared value and both have to change together.

**Why it matters.** The value in use was read back out of Study Pal's `.env` in a
terminal that was screenshotted into a chat transcript. Transcripts are stored;
treat any secret that has been in one as public.

What this secret protects is narrower than the other three, and worth being
precise about rather than alarmed: it is the only lock on
`POST /api/studypal-hook`, which is mounted above the sign-in gate because the
caller is a server with no cookie to present. Somebody holding it can write
rows into the panel's feedback file — invent a held post, mark something as
published that never was. It grants nothing else: no read of anything, no
session, no other route. The harm is a panel that reports things that did not
happen, which is a real harm for a surface whose whole job is telling you what
did.

**Done looks like.** A new value generated (`openssl rand -base64 32`), set in
both `.env` files, both sides restarted, and a test delivery accepted. Do not
paste the new value into a chat.

### Get the microdrama repo onto GitHub

**Where this got to, 4 September, ~1am.** `microdrama` and `studybox` do not
exist on GitHub — `github.com/tommyshanahan-max?tab=repositories` lists only
sage, study-pal, journey, sage-aesthetic and THE-MESS. Several dead ends chased
this as a permissions problem: the Claude app's repository list, four
fine-grained tokens, `make partner-sync` failing with "Repository not found".
None of that was the cause and none of it needs changing.

**The twelve-episode story structure exists**, but on the Mac rather than on
GitHub — most likely inside the Study Pal working copy, which `HANDOFF.md` puts
at `~/Downloads/study-pal`. A `git remote add` run in the home folder failed
with "not a git repository"; it has to run in the folder that holds the work.

**Done looks like,** in order:

1. `github.com/new` → `microdrama`, private, **tick "Add a README file"**. The
   README matters: it creates `main`, and `make partner-sync` clones
   `--branch main`, so an empty repo fails even once it exists.
2. Find the folder with the story-structure work and push it there.
3. Add `microdrama` to the Claude GitHub app's repository list, so a session can
   write to it.
4. Then, in one go: `make partner-sync` gives Brendan the repo, and cloning it
   into `/home/coder/projects` puts the icon in Sage next to study-pal.

`.env` on the box already names `microdrama` in `TOMSCODING_PARTNER_REPOS`, so
`make partner-sync` will keep failing until step 1 is done. The failure is clean
— the script builds the new snapshot in a temporary directory and only swaps it
in at the end, so Brendan's existing copy is untouched.

### Seedance belongs to microdrama, not to the platform

The Seedance client went into the platform first, which is the wrong shape: Sage
should be a client of a product, the way the story desk proxies to Study Pal's
own API rather than reimplementing it. As built, the ByteDance key would sit in
the platform's `.env` and the microdrama app itself could not generate anything
— only a person sitting in a seat could.

It is inert as it stands: without `TOMSCODING_ARK_API_KEY` there is no button,
the page 404s to a partner, and the routes refuse. So nothing is running and
nothing needs undoing in a hurry.

**Done looks like:** `agent/lib/video.js` moves into the microdrama repo, which
owns the key, the model, the prompt format and the spend ceiling, and exposes an
admin API in the same shape as Study Pal's (`x-admin-secret`). The platform
keeps the page and gains a `/md/*` proxy in place of the client.

## Soon

### Backups of the box

**What.** There are none. Not of the workspace volume, not of `analytics_data`,
not of the partner mockups, not of `.env`.

**Why it matters.** Everything not pushed to GitHub exists in exactly one place:
a single VPS. The counter's history is a set of files in a Docker volume and
exists nowhere else at all. Deleting a project from Sage now moves it to
`.trash` rather than removing it, which was written that way *because* of this
gap — but a trash folder on the same disk is not a backup.

**Done looks like.** Vultr automatic backups switched on for the instance (the
cheapest real protection), plus a nightly `make backup` off-box for
`home`, `analytics_data`, `partner_mockups` and `.env`.

### Study Pal's deployed code is not on `main`

**What.** The live app at `liuxuesheng.help` has a story feature and a card
layout that are not in the repository. The clone in the workspace is `main`, so
it is behind what is running.

**Why it matters.** Anything Sage says about how the app looks is drawn from code
that is not the code in production, and a change made against it may not apply.
It also means the story desk's cover art is being built to a card whose real
aspect ratio nobody here knows.

**Done looks like.** The deployed code pushed to `main`, and the workspace clone
pulled.

## Soon — an agent runs several accounts

### One key, several rows, and everybody can see whose they are

**The problem it solves.** Andy is an agent in Australia with a list of
exclusive actors. Chinese producers want them. He will not bring them onto a
board where they can be approached directly, because that is his leverage and
his network given away in one move. Every agent and manager on the film side
has this shape, and most of the talent will never sign up for themselves — for
film that is not a stage, it is how the business works.

**The shape.** The people he represents get ordinary accounts, and Andy
operates them from one login. A switcher says which one he is acting as.
Profile, sentence, follows, matching, cards and messages are unchanged, because
they are ordinary accounts.

**Why accounts rather than listings on his own row**, which is where this
conversation got to first: **the handover already exists.** The day Mia wants
her own account it is `make back WHO="Mia"` — six characters, the row moves to
her browser, Andy loses it. Built, tested, and nothing to migrate. With
listings there would be nothing to hand over: she would start again and his
card would dangle.

**Three other shapes considered and dropped.**

- *Routing a redirected conversation.* The first idea, and the wrong frame:
  **the agent is the party and the actor is the subject.** Nothing is
  forwarded, so nothing can be forwarded wrongly.
- *Listings on the agent's row.* Cheaper, but no handover, and it invents a
  second species of thing that has to be taught the whole matching mechanic.
- *Briefs instead of cards* — the producer posts what they need and agents
  answer. Cheaper still, exposes nothing of Andy's list, and puts the
  advertising on the scarce side. It was the better idea for about ten minutes
  and it loses the product: Browse is cards of actual people, and "Andy, agent,
  Sydney" is a card nobody stops on. **Mia, 24, Mandarin, Sydney** is.

**What is actually new is smaller than it sounds:** one key operating several
rows, a switcher, the label, and the contact rule. Everything else already
works.

**And the real cost is width, not depth.** *One browser is one person* is baked
in. `.by === me` appears **76 times** in `board/server.js` — the profile, the
feed, following, invites, offers, the waiting list, notes, cards. Every one of
them becomes "the row being operated now". Not deep, but wide, and exactly the
kind of change where one missed call site means Andy posts as Mia by accident.

So the order matters: **find all 76 and decide what each one means before
writing the switcher.** Most are "my current row" and change mechanically. A
few are not, and those are the whole job:

- *Invites.* Andy's allowance is Andy's, not one per account he runs — or one
  agent mints ten codes a day and invite-only stops meaning anything.
- *The waiting list.* A represented person is not somebody waiting to get in.
- *Deleting.* `forget()` takes everything hanging off a device hash. Run it
  from a browser holding six rows and it takes six people with it.
- *The member count.* Ten accounts operated by one agent is ten cards and one
  person, and the number on the front page has to say the second thing.

**Two labels, and neither is optional.** On the card, before anybody presses
Follow — *Represented by Andy — he takes the conversation*. And again when the
contact crosses: *Mia's agent · andy_syd*. Otherwise a producer saves that as
Mia, opens WeChat and finds a stranger. An account operated by an agent that
does not say so is worse than a listing that does not, not better.

**The thread is the agent's and is named for him.** "Andy — about Mia", every
line from him. The version to refuse is a thread that looks like it is from Mia
with Andy typing in it.

**Same messaging rules as everybody.** One line each, then it rests. A special
case for agents is a thing we would be explaining forever, and the natural
first question — "is she free in March?" — is answered inside the rule that
already exists.

**Consent is about the photograph, not the name.** A line and a first name is a
claim Andy makes with his own name attached to it. A face is a different thing,
and before photographs go up there should be a confirmation link he sends her.

**The open decision: a cap.** Ten agents with ten accounts each is a hundred
cards and ten people, and Browse stops being a room and becomes a catalogue
with one agency's stock in it. Three to five keeps it a room and makes an agent
put up their best rather than their whole list, which serves the producer too.
Pick a number before the first agent asks for the eleventh.

## Soon — money

### Charging for The Exchange, and why not per contact

**What was proposed.** Loosen messaging so members can write freely, and charge
at the moment one of them hands over an actual contact.

**Why the instinct is right.** It charges at the point of value. Nobody pays to
look or to talk; they pay when they want to take it off the board. That is what
a broker charges for, and it is the moment a member would agree they got
something.

**Why that particular toll is the wrong one.**

- *It taxes the promise.* The landing page says nobody's contact is handed over
  by the board — a person decides to answer. Charging to permit that turns a
  privacy guarantee into a paywall, in the same words, meaning the opposite.
- *It leaks, and policing the leak costs more than the leak.* The moment
  messaging is free, somebody types their WeChat id into a message. Catching
  that means reading messages, which breaks "not stored, nobody reads it" — the
  claim the whole product rests on. Every network that has tried this collects
  on a fraction of the connections it enables.
- *It charges the wrong side.* The one who wants the contact usually has less
  power: the founder chasing the investor, the performer chasing the agent. At
  this size that is exactly the side we are short of.

**What to look at instead, in order.**

- **Dues at the door.** A club charges for membership, not per introduction. It
  fits what this is, taxes nothing anybody does inside, and crowdfundme already
  collects money.
- **Charge the side with the cheque.** Investors and buyers pay; founders and
  talent do not. Standard for deal networks, and it raises quality on the side
  that decides whether the other side bothers.
- **Keep one-intro-per-match as a feature, not a limit to sell.** It forces a
  real opening line. Loosening it may lower quality rather than raise it, and
  that is worth knowing before anything is charged for.

**The number to get first.** Of the matches so far: how many became a message,
and how many became a card. It is in the data already. Charge for a step people
take, not the one we wish they took.

**The four gates considered, and what survives.** Worked through at two in the
morning, kept because the reasoning is the part that gets lost.

- **Charge to hand over a contact.** No. It taxes the promise the product is
  built on, it leaks the moment messaging is free, and policing the leak means
  reading messages. See above.
- **Cap browsing.** No, and this is the worst of the four. Never gate discovery
  in a cold marketplace: somebody sees three cards, decides there is nobody
  here, and leaves — and the cap also limits how many people see *them*, so one
  lever damages both sides at once. Browsing is how the value becomes visible.
- **Cap new introductions, sell unlimited.** Half right. One intro per match is
  a quality feature, not a limit to sell relief from: it forces a real opening
  line, and unlimited would make whoever pays the most the spammiest. What is
  worth selling is the thread staying **open** — the conversation not ending —
  which the code already models (`threadState` has `open`, used today when an
  offer opens a thread). One rule needed: if **either** side is a member the
  thread is open, or the wall lands on the person who did not buy anything and
  the payer's money does not buy them a working conversation.
- **Cap follows.** Yes — the best of the four. A Follow is the bet somebody is
  placing, so capping it caps how many bets, which is how the dating apps sell.
  It does not touch the contact promise, and the wall lands only on the person
  who chose not to pay, never on whoever they were writing to. It also improves
  the free tier rather than crippling it: fewer follows are more considered
  ones.

- **Speaking instead of typing.** It was put on this list and taken off again
  the same night, and the argument is worth keeping because it is the one that
  sounds best and is wrong.
  It looked like the honest gate: unlike everything else here it has a real
  bill attached, a transcription per press, so charging for it is charging for
  a cost rather than for relief from a limit we invented. Two things kill it.
  **Every phone already dictates.** iOS and Android both let somebody speak
  into any text field for nothing, in Chinese, today. What is left to sell is
  speaking *plus* translation in one press — and translation is free here for
  everybody, because a board where free members cannot cross the language is
  not this board. So the paid feature saves one tap, and one tap is not a
  subscription.
  **And the bill is rounding error at this size.** Transcription is fractions
  of a cent a minute. At forty members nobody needs that covered. It is a real
  cost and a trivial one, which is not the same thing.
  So: **build it, free.** It makes the board better for exactly the people we
  are shortest of — the ones composing in their second language on a phone
  keyboard — and it costs almost nothing. See `docs/mockups/chat.html`.

**What is left is what is actually scarce.** Both survivors are about access to
people, which is the only thing this board has that nobody else can hand out.
Convenience is what everybody expects for free; the room is what they pay for.

**So the shape, when the time comes.** Free: browse everyone, a handful of
follows a week, type or talk — the translation and the voice are for everybody.
Member: follows uncapped, and the thread stays open.

**And the order, which matters more than the shape.**

1. **Nothing.** Get to thirty or forty and watch what they do. With seven in the
   deck a cap of five follows a week is invisible; these levers only bite at a
   few hundred members.
2. **Dues at the door.** Annual, founding price that never goes up, everything
   free inside. One decision, one payment, no mechanic to build, and it is what
   the page already promises — you are selling being in the room.
3. **The caps above**, once there are conversations to point at and say: this is
   what stops when you leave.

Charging before the room is warm is the one mistake that is hard to undo. You
can always start charging; you cannot un-charge without telling everybody the
thing was not worth it.

**One practical blocker for anything recurring.** Taking a subscription from a
mainland member needs a Chinese entity, a business licence and a merchant
account — the same chain as WeChat login. Stripe covers Hong Kong and overseas
and does not cover a Shenzhen founder's WeChat Pay. At this size a manual
transfer against a name on a list is faster than building for it.

**Finished looks like.** A decision written down here with the number that
justified it — not a price on a feature nobody has been observed using.

## When it comes up

- **A preview hostname for dev servers.** Sage can start a project's dev server
  but nothing in that container has a host port, so it is unreachable from a
  browser. One DNS record (`preview.tomscoding.com`) and a Caddy site would fix
  it, and would make "click a project, then click App" work for projects that
  are not deployed anywhere.
- **`/sp/usage` is proxied but not drawn.** The route works; nothing renders it,
  because the shape of what Study Pal returns is not known here.
- **`POST /api/cover` does not exist on Study Pal.** The story desk is written to
  the shape it should have and falls back to offering the cropped file for
  download.
- **The `studybox` repository is not visible to the Claude GitHub app.** It
  exists, but the app is installed on selected repositories and this is not one
  of them, so it cannot be seeded from a session.
