# This deployment

Background for an agent working on this machine. Read it when a question turns
on how the deployment is put together; the short version is in `CLAUDE.md`.

## Why it exists

The person you are working with is in mainland China. His VPN works
intermittently, and the tools he needs to write software are on the far side
of it. Everything here follows from that one fact.

The deployment is a small VPS in Tokyo serving a handful of applications over
ordinary HTTPS on a domain he owns. From China it looks like any other
website, so it does not depend on a VPN being up. Nothing here circumvents
anything: it is his server, his domain, his account, reached over the public
internet.

This shapes technical choices that would otherwise look arbitrary:

- **TCP everywhere, never UDP.** HTTP/3 is deliberately disabled, and the
  remote browser streams over WebSocket rather than WebRTC. UDP is the
  unreliable transport on the China–Japan route; a lower-latency protocol that
  stalls is worse than a slower one that arrives.
- **No CDN, no web fonts.** Google Fonts and most CDNs are unreachable or slow
  from China. Every page here uses system fonts and ships its own assets. Do
  not add a `<link>` to an external stylesheet or a script tag pointing at a
  CDN — it will simply fail to load for the only person who uses this.
- **Cookies, not HTTP basic auth,** for the agent app. iOS drops basic
  credentials whenever it reclaims a tab, which meant retyping a password
  every time the phone was put down.
- **Long operations must survive a dropped connection.** SSH sessions from
  China to Tokyo time out regularly. Anything slow should be run under `tmux`
  or otherwise detached, not in a bare foreground shell.

## What runs here

One VPS (Vultr, Tokyo, 4 GB) running Docker Compose. Caddy terminates TLS for
every hostname and gets certificates from Let's Encrypt automatically. Nothing
else is exposed; the application containers have no host ports at all and are
reachable only through Caddy.

| Hostname | What it is |
| --- | --- |
| `tomscoding.com` | Static launcher page linking to the rest |
| `code.tomscoding.com` | code-server — VS Code in the browser |
| `her.tomscoding.com` | A second, fully separate workspace |
| `browser.tomscoding.com` | Firefox running on the VPS, screen streamed |
| `agent.tomscoding.com` | Sage — a chat interface over the Claude Agent SDK |
| `partner.tomscoding.com` | A partner seat: the same Sage, one read-only snapshot, mockups only |
| `liuxuesheng.io` | The Liuxuesheng brand homepage, plus the door to the partner seats |

**Only `liuxuesheng.help` is public facing.** Everything else here is
infrastructure with a password on it, including the brand homepage until it is
launched. Do not put usage dashboards, admin tools or anything operational on a
public-facing hostname.
| `numbers.tomscoding.com` | The counter: people per day, and what they used |

Optional services are Compose profiles (`seat2`, `browser`, `agent`,
`partner`, `partner2`, `analytics`) enabled in `.env`, so a deployment that wants only the
IDE spends nothing on the rest. `liuxuesheng.io` is not one of them — it is a
static page Caddy serves from disk, with no container behind it.

## Liuxuesheng, and the seat that shows it

**Study Pal is the product; Liuxuesheng is the brand it goes out under.** The
live app is at `liuxuesheng.help`; `liuxuesheng.io` is the homepage in front of
it. Both are the same product, and neither runs in this deployment yet.

**It has its own repository now: `tommyshanahan-max/study-pal`, branch `main`.**
It used to be a route called `/talk` inside Fern (`journey.git`, branch
`aesthetic-spike`) and it is not there any more — every old `/talk/*` address
308-redirects, because phrases people already shared carry those links inside
WeChat messages nobody is going to edit. Do not reach back into the Fern repo
for it, and do not import between the two: they are separate products that
happen to share a history. If something is genuinely common, copy it.

The partner seat shows a snapshot of that repository, taken by
`make partner-sync` on the host and by nothing else.

**There are two machines, not one.** `tomscoding.com` is this box,
45.77.8.166. `liuxuesheng.help`, `fernsocial.io` and `sagejourney.io` all
resolve to 45.32.58.178 — an older box where Fern and Study Pal still share one
container behind one Caddy. Study Pal's own `TODO.md` calls cutting
`liuxuesheng.help` over to its own container an open task, keeping the `.data`
volume so the device count survives. Do not assume a hostname here is served
from here.

**Study Pal's `docs/PRIVACY.md` is the standing brief on all of this** — what
the product protects, and how attribution would actually happen. Read it before
proposing anything that adds a server, a third party, or a way for one user to
see another. `make privacy` in this repo checks the parts of it that are
checkable from outside.

**No third-party analytics, ever.** That is Study Pal's own rule, and it is why
its device count is a file on its box rather than a script from somewhere else.
The counter in this deployment was built to the same rule — first-party id,
nothing sent to anyone, counts on disk — so it fits. Do not propose Plausible,
Umami, GA or any hosted alternative as a simplification; the constraint is the
design.

**Brendan's Documents panel lists `README.md` and nothing else.** `TODO.md` in
that repo is about registration privacy, what the hosting provider discloses
under legal process, and what share a partner should get — it is the owner's
side of a negotiation with the person that seat belongs to. It must not be
added to `TOMSCODING_PARTNER_DOCS`.

## Where things are, exactly

This trips up an agent working here, so be precise about it:

- **`/home/coder/projects` is the workspace.** The IDE and Sage share one
  volume, so a file written by either is immediately visible to the other.
  This is deliberate — an agent walled off from the real work can only act on
  files nobody cares about.
- **The deployment's own source is not visible from inside any container.**
  The git repository holding `docker-compose.yml`, the Caddyfile and these
  instructions lives on the *host*, at `~/tc`, reachable only over SSH. Do not
  go looking for `docker-compose.yml` in the workspace; it is not there, and
  changes to the deployment cannot be made from inside it.
- **The second seat is invisible.** It has its own volume and its own
  password. Nothing in this container can see or affect it.

## What protects the files

Git, not container isolation. The agent runs its tools without stopping to ask
for approval, on the same files the editor opens, so a bad turn can destroy
real work. Commit before anything large. That is the whole safety net, and it
is the same one the CLI has always had in the IDE terminal.

## Credentials

An Anthropic API key is present in this container's environment. It is what
makes the agent work from here — the request to Anthropic is made by the
server, from Tokyo. Never print it, never write it into a file, and never
commit it.

The passwords protecting each hostname live in `.env` on the host, outside
every container.

**There may be no git credentials configured.** If a `git push` or a clone of
a private repository fails with an authentication error, that is why. Say so
rather than retrying — it needs a token set up on the host, which is not
something that can be fixed from inside here.

## Things that have actually gone wrong

Recorded because each one cost real time and each is easy to repeat.

**Caddy served nothing at all.** Site addresses are supplied by environment
variables. Caddy's `{$VAR:default}` substitutes its default only when a
variable is *unset* — a variable set to an empty string stays empty, and an
empty site address is a fatal config error that takes down every site,
including the correctly configured ones. Compose now supplies real `.localhost`
fallbacks so no address can ever be empty, and `make check` verifies every site
resolves to something usable and unique. Run it after touching any site block.

**The agent failed every turn with an exit code and no message.** Three causes
stacked together: the Agent SDK does not bundle the Claude Code CLI (it spawns
one it expects on `PATH`), the SDK and CLI ship in lockstep on a shared build
number and a mismatched pair fails exactly like a missing one, and
`bypassPermissions` is refused unless `allowDangerouslySkipPermissions` is set
with it — and refused outright under root, which is why the container runs as
uid 1000. The reason for all of it was on the child process's stderr, which is
discarded unless a callback asks for it.

**A failed turn poisoned every turn after it.** The chat app announced a
conversation id before the run that creates it, so a failure left the browser
asking to resume a session that had never existed — which returns nothing at
all, with no error. Ids are now sent only after a run succeeds.

**The remote browser goes black.** Firefox gets killed while its container
keeps running, so the web server still answers and you get a black rectangle
rather than an error. It is a memory failure: tab contents live in `/dev/shm`,
which counts against the container's memory limit rather than sitting outside
it. Shared memory is now half the ceiling, a health check looks for a live
Firefox process (not an HTTP response, which answers fine through this), and a
watchdog restarts it automatically.

**The box is over-committed.** Container memory ceilings total more than the
4 GB of RAM. Ceilings are not reservations and there is swap, so ordinary use
is fine, but this is the standing cause of anything that feels slow or dies
unexpectedly. The real fix is resizing to 8 GB.

## The pattern in all of these

Every one was a failure that reported nothing, or reported a code instead of a
cause. When something here breaks, assume the visible symptom is not the
error — find where the real message went before proposing a fix.
