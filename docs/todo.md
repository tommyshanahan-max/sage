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
