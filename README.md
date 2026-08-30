# Sage

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
- A domain with **two** A records pointing straight at the VPS, both in place
  *before* first boot — Let's Encrypt validates over HTTP and will fail without
  them. One for the landing page (`tomscoding.com`) and one for the IDE
  (`code.tomscoding.com`). Keep DNS unproxied (grey cloud on Cloudflare); see
  `docs/networking.md`.
- Ports 80 and 443 open (`install/bootstrap.sh` handles the firewall).

On provider choice: budget VPS lines (Vultr, Linode, DigitalOcean Tokyo) route
over commodity transit that gets congested during Chinese evening hours.
Providers selling a China-optimised line — CN2 GIA, or a domestic cloud's
Japan region with an accelerated backbone — cost several times more and are
dramatically steadier at 20:00–24:00 local. Start cheap, run `make doctor` for
a week, and upgrade only if the evening numbers are bad.

## Two hostnames

The deployment serves two separate sites from one Caddy process:

| Hostname | What it is |
|---|---|
| `tomscoding.com` | A static landing page from `landing/`. Public. |
| `code.tomscoding.com` | The IDE. Password-gated. |

They are separate site blocks with separate certificates, and the landing page
is plain files on disk — it cannot reach the workspace container. The only link
between them is the `/ide` redirect on the landing site, which sends you to the
IDE's hostname; the real domain is filled in from `SAGE_DOMAIN`, so no hostname
is hardcoded in the HTML.

Giving code-server a whole hostname rather than a sub-path is deliberate.
Serving it under `/ide/` on a shared hostname means rewriting paths on a
websocket, which is the kind of thing that works until it doesn't.

Edit `landing/index.html` freely — it is intentionally one self-contained file
with no build step. Keep it that way: it has no web fonts, no CDN, and no
analytics, because Google Fonts and most CDNs are unreachable from mainland
China, and one blocked stylesheet is enough to leave a visitor on an unstyled
page. Same-origin only.

If you don't want a public front door at all, leave `SAGE_LANDING_DOMAIN`
blank and delete `docker/sites/landing.caddy`. The IDE is unaffected.

## Setup

On the VPS:

```bash
git clone https://github.com/tommyshanahan-max/sage.git
cd sage
sudo bash install/bootstrap.sh          # docker, firewall, fail2ban, BBR
cp .env.example .env
make password                            # generate a real password
$EDITOR .env                             # domain, email, password
make up
```

First start pulls images and builds the workspace; give it a few minutes.
Then open `https://your.domain` and log in with `SAGE_PASSWORD`.

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

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — what each piece does and why
- [`docs/networking.md`](docs/networking.md) — keeping the link usable, and what to do when it isn't
- [`docs/security.md`](docs/security.md) — this box has a public shell on it; read this

## Layout

```
docker-compose.yml        two services: caddy (TLS, proxy) and workspace (IDE)
docker/Caddyfile          TLS termination, websocket proxying, security headers
docker/sites/             additional site blocks — ships the landing page
docker/conf.d/            optional overlays on the IDE site (extra auth, allowlist)
docker/workspace/         the IDE image: code-server + node + claude CLI
landing/                  the public landing page, static and self-contained
install/bootstrap.sh      one-shot VPS preparation
scripts/doctor.sh         client-side network diagnostics
```
