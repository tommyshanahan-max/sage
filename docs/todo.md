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

### Rotate Study Pal's admin key

**What.** `TOMSCODING_STUDYPAL_KEY` in `.env`, which the story desk uses to
publish to the live catalogue.

**Why it matters.** It was pasted into a chat transcript. Transcripts are stored.
Treat any secret that has been in one as public.

**Done looks like.** New key generated on Study Pal's side, `.env` updated,
`make up`, old key rejected by the app.

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
