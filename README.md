# Tom's Coding

A self-hosted coding environment on a VPS you own, reachable from a normal
browser over HTTPS. Built for the case where a VPN is unreliable and you want
a stable place to work instead.

## What this actually is

The short answer to "can I import the cloud coding platform onto my own
website": no, and you don't need to.

`claude.ai/code` is a hosted product. There is no downloadable copy of it, so
it cannot be installed on your VPS. But that web UI is not where the work
happens — it is an editor and a terminal in front of an agent. Both of those
parts *are* self-hostable:

- **The editor** — [code-server](https://github.com/coder/code-server), which
  is VS Code running as a web app. Full editor, file tree, extensions,
  integrated terminal.
- **The agent** — the Claude Code CLI, `npm`-installed inside that same
  container and driven from the integrated terminal, exactly as you would use
  it locally.

So you get the same working surface, hosted by you, at your own domain.

## How it changes your network path

Today, everything you do has to survive the trip out of the country:

```
  browser ──[ VPN, when it works ]──> claude.ai + api.anthropic.com
```

With this, your browser only ever talks to one hostname you control:

```
  browser ──[ plain HTTPS to your.domain ]──> Tokyo VPS
                                                 ├── code-server (the editor)
                                                 └── claude CLI ──> api.anthropic.com
```

Your laptop makes one long-lived HTTPS connection to your own server. Every
call to Anthropic is made by the VPS, from Tokyo, where that path is
uncongested. Your repository, your builds, and your test runs all live on the
VPS too, so a slow link degrades typing latency rather than breaking your
toolchain.

Tokyo is the right choice for this: it is typically 30–60 ms from coastal
China, the lowest of any region with reliable capacity.

**This is not a VPN and does not replace one.** It exposes exactly one
authenticated web application. Your browser's other traffic is unaffected.

## Before you build this

Anthropic publishes a list of supported countries, and mainland China is not
on it. Running the API calls from a Tokyo VPS changes where the requests
originate, but it does not by itself settle whether your account and your use
comply with Anthropic's Terms of Service. That is worth reading before you
invest in the setup, since an account issue would strand the whole thing.
Everything in this repo is a general remote-development environment and is
useful regardless of which agent you run in it.

## Requirements

- A VPS in Tokyo. 2 vCPU / 4 GB is comfortable; 1 vCPU / 2 GB works for light
  use. Ubuntu 22.04 or 24.04.
- A domain with an A record for **each service you enable**, all pointing
  straight at the VPS and all in place *before* first boot — Let's Encrypt
  validates each hostname over HTTP and fails without them. The full set is
  listed under Hostnames below; the minimum is one, for the IDE. Keep DNS
  unproxied (grey cloud on Cloudflare); see `docs/networking.md`.
- Ports 80 and 443 open (`install/bootstrap.sh` handles the firewall).

On provider choice: budget VPS lines (Vultr, Linode, DigitalOcean Tokyo) route
over commodity transit that gets congested during Chinese evening hours.
Providers selling a China-optimised line — CN2 GIA, or a domestic cloud's
Japan region with an accelerated backbone — cost several times more and are
dramatically steadier at 20:00–24:00 local. Start cheap, run `make doctor` for
a week, and upgrade only if the evening numbers are bad.

## Hostnames

One Caddy process serves every site, each on its own hostname with its own
certificate:

| Hostname | What it is | Required |
|---|---|---|
| `code.tomscoding.com` | The IDE | yes |
| `tomscoding.com` | Launcher page from `landing/` | no |
| `her.tomscoding.com` | Second seat | no |
| `browser.tomscoding.com` | Firefox running on the VPS | no |
| `agent.tomscoding.com` | Agent chat app | no |

Each optional one needs its A record, its `.env` entry, and — for the three
that run containers — its Compose profile. An optional service you have not
configured costs nothing and serves nothing.

They are separate site blocks, and the launcher is plain files on disk: it
cannot reach any container. The only connection is its redirects, which fill
in the real hostnames from the environment so none is hardcoded in the HTML.

Run `make check` after changing any of them. It resolves every site address
the way Caddy does and fails on an empty or duplicated one — both of which
stop Caddy serving *anything*, not just the site at fault.

Giving code-server a whole hostname rather than a sub-path is deliberate.
Serving it under `/ide/` on a shared hostname means rewriting paths on a
websocket, which is the kind of thing that works until it doesn't.

The landing page is a launcher: a tile per service, each linking to a short
path (`/ide`, `/seat2`, `/browser`, `/agent`) that Caddy redirects to the real
hostname from the environment. No hostname is hardcoded in the HTML, so moving
to another domain touches `.env` and nothing else.

Sites like Instagram and WhatsApp are deliberately **not** tiles. They refuse
to be embedded in another page, and a plain link would load from wherever the
reader is rather than from Tokyo — defeating the point. They belong in the
remote browser's own bookmarks toolbar, where the request originates in Tokyo.

Edit `landing/index.html` freely — it is intentionally one self-contained file
with no build step. Keep it that way: it has no web fonts, no CDN, and no
analytics, because Google Fonts and most CDNs are unreachable from mainland
China, and one blocked stylesheet is enough to leave a visitor on an unstyled
page. Same-origin only.

If you don't want a public front door at all, leave `TOMSCODING_LANDING_DOMAIN`
blank and delete `docker/sites/landing.caddy`. The IDE is unaffected.

## Setup

For the live `tomscoding.com` deployment, `env.tomscoding` already holds the
domains, contact address and the memory and CPU sizing for a 4 GB box. Copy it
and append the two passwords, so there is no text editor to navigate:

```bash
cp env.tomscoding .env
echo "TOMSCODING_PASSWORD=your-passphrase" >> .env
echo "TOMSCODING_PASSWORD_2=her-passphrase" >> .env
```

`.env` is gitignored; the preset carries no secrets. For any other deployment,
start from `.env.example` instead.


On the VPS:

```bash
git clone https://github.com/tommyshanahan-max/tomscoding.git
cd tomscoding
sudo bash install/bootstrap.sh          # docker, firewall, fail2ban, BBR
cp .env.example .env
make password                            # generate a real password
$EDITOR .env                             # domain, email, password
make up
```

First start pulls images and builds the workspace; give it a few minutes.
Then open `https://your.domain` and log in with `TOMSCODING_PASSWORD`.

The workspace opens straight onto a terminal with Claude Code already running
— no welcome page, no editor tab. On the very first run it will ask you to log
in, unless you set `ANTHROPIC_API_KEY` in `.env`.

That default assumes you drive this by talking to the agent rather than by
editing files yourself. The editor is still there when you want it, for reading
a file or looking over a diff, but it isn't what greets you.

To change it, edit `projects/.vscode/tasks.json` inside the workspace (delete
it to get a plain editor on startup) or the settings at
`~/.local/share/code-server/User/settings.json`. Both are seeded from the image
on first start only, so your edits survive `make rebuild`. The flip side: if
you already have a volume from an earlier run, a rebuild will *not* introduce
them — copy them in by hand or start from a fresh volume.

## Day to day

```bash
make logs        # tail both services
make shell       # shell into the workspace
make doctor      # diagnose a slow or dead connection (run from your laptop)
make backup      # snapshot the home volume to ./backups
make rebuild     # rebuild the workspace image, picking up new CLI versions
make reload      # apply Caddy config changes with no downtime
```

Your work lives in the `home` Docker volume and survives `make down`,
reboots, and image rebuilds. It does **not** survive destroying the VPS — push
to git, and run `make backup` before anything risky.

## How the agent behaves here

`docker/workspace/CLAUDE.md` is seeded to `~/.claude/CLAUDE.md` and applies to
every project opened in the workspace, not just this one. It sets the working
manner: match answer length to the question, never invent a file path or claim
something ran when it didn't, explain changes in plain language rather than
assuming the diff gets read, and say what will be lost before doing anything
destructive.

It is short on purpose — a long instructions file is followed less reliably
than a short one. Edit it in place in the workspace; like the settings above,
it is seeded from the image once and then yours.

## A second seat

Another person gets their own container, their own home volume, their own
password and their own hostname. They cannot see your files, your terminal or
your editor state, and you cannot see theirs — this is a second machine that
happens to share a box, not a second login to yours.

Enable it in `.env`: keep `COMPOSE_PROFILES=seat2`, set `TOMSCODING_DOMAIN_2`
to a hostname with its own A record, and set `TOMSCODING_PASSWORD_2` to a
freshly generated password. `make up` refuses to start if that password is
empty. Clear `COMPOSE_PROFILES` and the container is never created at all.

What is **not** separated, and is worth knowing before you hand out the URL:

- **The VPS.** Both seats share the CPU. They carry relative weights —
  `TOMSCODING_CPU_SHARES` at 1024 against 512 for the second seat — so when
  both are busy at once the primary gets roughly two thirds. These are weights,
  not caps: an idle seat gives up its share completely, so a quiet box is never
  slowed by them. Caddy is deliberately left at the default weight, since a
  starved proxy makes both seats look dead.
- **The IP and the domain.** If the address is blocked, both seats go down.
- **The Anthropic key.** Both containers get the same `ANTHROPIC_API_KEY`, so
  usage bills together and shares rate limits. Give the second seat its own
  key if you ever want those separated.

Two seats want more RAM than one. On a 4 GB box drop the limits to `2g` and
`1g`; 8 GB is a great deal more comfortable.

`make shell-2` gets you into the second seat, and `make backup` snapshots both
home volumes.

## A browser on the VPS

Optional. Runs a real Firefox on the server and streams its screen to you over
HTTPS, so pages are fetched from Tokyo rather than from wherever you are. The
practical value is not having to reach for a second device when a site loads on
one and not the other.

Enable it in `.env`: add `browser` to `COMPOSE_PROFILES` (comma-separated —
`COMPOSE_PROFILES=seat2,browser`), set `TOMSCODING_BROWSER_DOMAIN` to a
hostname with its own A record, and set `TOMSCODING_BROWSER_PASSWORD`. `make up`
refuses to start without that password.

It streams over TCP by way of KasmVNC. The WebRTC-based alternatives look
better on a good link but run over UDP, which is the weaker transport on this
route — the same reason HTTP/3 is off.

A browser is the heaviest thing on this box. On 4 GB the ceilings over-commit
(2g + 1g + 1g plus the host); ceilings are not reservations and there is swap,
so light use is fine, but sustained slowness is the box asking for 8 GB.

## The agent chat app

Optional, and the reason it exists is worth stating plainly: Claude Code's
browser sign-in checks where *you* are, and there are places that check
refuses. An API key does not — it is presented by the server, from Tokyo. This
app is a chat interface that uses one.

`agent/` is a small Node server in front of the
[Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk), which is Claude
Code as a library: the agent loop, context management, and the built-in tools
(read, write, edit, bash, search) all come from it. The app supplies a UI, a
session, and streaming; it does not reimplement the agent.

Enable it in `.env`: add `agent` to `COMPOSE_PROFILES`, set
`TOMSCODING_AGENT_DOMAIN` to a hostname with its own A record, set
`TOMSCODING_AGENT_PASSWORD`, and set `ANTHROPIC_API_KEY`. `make up` refuses to
start without the last two.

Replies stream as Server-Sent Events rather than over a websocket — plain HTTP
over TCP, which needs nothing special from the proxy and holds up better on
this route.

**What it can do to your files.** Tools run without pausing to ask. The
container is the boundary: the agent sees `/workspace` (its own volume) and
nothing else — not the IDE seats, not the host, not journey. That volume starts
empty, so early on there is little to lose; as it fills, that stops being true.
An approval step before writes and commands is the obvious next thing to build,
and it is not built yet.

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — what each piece does and why
- [`docs/networking.md`](docs/networking.md) — keeping the link usable, and what to do when it isn't
- [`docs/security.md`](docs/security.md) — this box has a public shell on it; read this

## Layout

```
docker-compose.yml        caddy, the workspaces, and the optional browser/agent
docker/Caddyfile          TLS termination, websocket proxying, security headers
docker/sites/             one site block per hostname
docker/conf.d/            optional overlays on the IDE site (extra auth, allowlist)
docker/workspace/         the IDE image: code-server + node + claude CLI
agent/                    the agent chat app: server, UI, image
landing/                  the launcher page, static and self-contained
env.tomscoding            this deployment's settings, minus the secrets
install/bootstrap.sh      one-shot VPS preparation
scripts/check-sites.py    verifies every site address resolves and is unique
scripts/doctor.sh         client-side network diagnostics
```
