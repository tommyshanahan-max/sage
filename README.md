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
| `partner.tomscoding.com` | A partner seat | no |
| `liuxuesheng.io` | A brand homepage, from `brand/` | no |
| `numbers.tomscoding.com` | The counter's dashboard | no |

Each optional one needs its A record and its `.env` entry; the ones that run
containers need their Compose profile too. The two static pages — the launcher
and the brand homepage — need no profile, because there is no container behind
either. An optional service you have not configured costs nothing and serves
nothing.

They are separate site blocks, and the launcher is plain files on disk: it
cannot reach any container. The only connection is its redirects, which fill
in the real hostnames from the environment so none is hardcoded in the HTML.

Run `make check` after changing any of them. It resolves every site address
the way Caddy does and fails on an empty or duplicated one — both of which
stop Caddy serving *anything*, not just the site at fault.

Giving code-server a whole hostname rather than a sub-path is deliberate.
Serving it under `/ide/` on a shared hostname means rewriting paths on a
websocket, which is the kind of thing that works until it doesn't.

The landing page is a launcher, and it is live: on load it makes a `no-cors`
request to each service and reports which answered and how long the round trip
took. That figure is the one thing about this deployment worth putting on its
front page — it is the link across the water, measured from wherever the reader
is standing, rather than a number someone typed in.

A `no-cors` probe tells you the machine answered without letting you read the
reply, which is the right amount of information for a status dot: an auth
prompt is a successful response, so a green dot means reachable, not signed in.

Hostnames live in one `SERVICES` object at the top of the script — the probes
need absolute URLs, so they cannot come from Caddy the way the old redirects
did. Moving domains means editing that object. The `/ide`, `/browser` and
friends redirects stay in `docker/sites/landing.caddy` for anyone typing them
directly.

There are no web fonts. The display face is `ui-serif`, which resolves to New
York on Apple devices and Georgia elsewhere — character with nothing
downloaded, which is the only kind available when Google Fonts is unreachable.

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
make whats-new   # tell Sage what changed, without a deploy
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
than a short one, and this one is carried in every turn.

The background that does not fit that budget sits beside it in
`~/.claude/tomscoding.md`: what runs on which hostname, why UDP and CDNs are
avoided on this route, where the deployment's own source lives (on the host,
not in the workspace — a thing agents reliably get wrong), and the failures
this setup has already had. `CLAUDE.md` points at it, so it is read when a
question actually needs it rather than on every message.

Both are seeded from the image **once**, on first start. The named volume
masks the image path from then on, so a rebuild will not update a running
deployment — that is what keeps your own edits safe. To push changed versions
across:

```bash
make instructions
```

It asks first, because it overwrites whatever is there. Sage reads the same
volume, so it picks the new files up with no restart; conversations already in
progress keep the old ones until you start a fresh one.

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

### When it goes black

The page loads, you sign in, and you get a black rectangle. That is Firefox
having been killed while the container carried on running — the web server is
still there to answer, but there is no browser behind it to draw anything.

It is a memory failure, not a network one. Tab contents live in `/dev/shm`,
which counts against the container's memory ceiling rather than sitting outside
it, so `TOMSCODING_BROWSER_SHM` and `TOMSCODING_BROWSER_MEMORY` are one budget:
set the first equal to the second and a few heavy tabs can spend all of it.
The preset now keeps shm at half the ceiling.

The container reports its own health by looking for a running Firefox rather
than by probing the HTTP port, which would answer perfectly through exactly
this failure. Compose does not act on health by itself, so a small `autoheal`
container watches for the unhealthy status and restarts the browser — roughly
a minute from black screen to working page, without you doing anything.

To do it by hand: `make fix-browser`. To see whether the watchdog is on it:

```bash
docker compose ps                    # browser shows healthy / unhealthy
docker compose logs --tail=20 autoheal
```

The watchdog makes the symptom self-clearing. It does not make the box bigger,
and repeated restarts are the argument for 8 GB.

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

The image installs the Claude Code CLI alongside the SDK. The SDK does not
bundle it — it spawns one it expects to find on PATH — and without it every
turn dies instantly with an exit code and nothing explaining why. The build
runs `command -v claude` so a missing CLI fails the build rather than the
first message someone sends.

**Both are pinned, and they have to move together.** The SDK and the CLI ship
in lockstep on a shared build number: SDK `0.3.251` goes with CLI `2.1.251`.
Installed but mismatched fails exactly like missing — an immediate exit code
with nothing to read — so `agent/package.json` and `CLAUDE_CLI_VERSION` in
`agent/Dockerfile` are changed as a pair, never one alone.

Two more things the app has to get right, both of which fail silently
otherwise. `permissionMode: "bypassPermissions"` is refused unless
`allowDangerouslySkipPermissions` is set with it, and it is refused outright
when the process is root — which is one of the reasons the container runs as
uid 1000. And the SDK's child process writes its real errors to stderr, which
is discarded unless the `stderr` callback asks for it; the app keeps the last
few lines so a failure can name its cause instead of reporting an exit code.

**It is called Sage**, and it inherits journey's plain-conversation voice —
appended to Claude Code's own system prompt rather than replacing it, since
the preset is what makes the tools work. What is deliberately left behind is
that app's apparatus: the archetypes, the Hero's Journey framing, the
therapist register. None of it has anything to attach to in a coding session.

Naming follows Anthropic's SDK branding guidance, which permits
"{YourAgentName} powered by Claude" and forbids presenting a product as Claude
Code. The masthead says exactly that.

### The live app beside the conversation

`AGENT_APP_URL` puts the running application in the panel next to the chat. It
was never set on the owner's seat — the tab was drawn unconditionally, `appUrl`
was always empty, and the blank frame that produced read as a site refusing to
be framed, which is what the note under it says. It now defaults to the live
app, so it works with no `.env` change; set `TOMSCODING_AGENT_APP_URL` to point
it somewhere else.

`TOMSCODING_PROJECT_APPS` maps a project to its own address —
`study-pal=https://liuxuesheng.help,journey=https://...` — so **App** follows
whatever project is selected. A project with no entry says so; it does not fall
back to another project's app, since showing Study Pal because studdy-buddy has
no address is exactly the confusion the map exists to remove. `AGENT_APP_URL`
is what opens when nothing is selected.

A map and not a guess. A dev server started inside the agent container has no
host port and cannot be reached from a browser, so an inferred address would be
a plausible wrong URL rather than a preview. Making dev servers reachable needs
a hostname through Caddy, which is a DNS record and a separate piece of work.

Clicking a project **is** the action: it selects the project, sends Sage to work
in that folder, and swings the App tab to that project's address in one press. A
click that types something for you and then waits has done half a job. The
selection is kept per browser, so two tabs can sit on two projects.

### What is in the workspace

Asked to "help me edit the study pal app", Sage listed the workspace, found
three directories with *study* in the name, said none of them was obviously it,
and stopped. That was the right answer and no use to anybody: there was no way
to see what was there in order to name it precisely, and no way to see that the
thing being asked about was not in the workspace at all.

So the preview panel has a second tab, **Projects** — and when no
`AGENT_APP_URL` is configured it is the whole panel rather than an empty pane.
Every top-level directory in the workspace as a tile: a monogram in a colour
taken from the name, so a project looks the same on every visit; whether it is
a git checkout; when it was last touched; and its own one-line description,
read from `package.json` or the first heading of its README.

Clicking a tile writes the project's **full path** into the message box and
puts the cursor after it. That is the point of the whole feature — the path is
unambiguous and the name demonstrably is not.

Owner seat only. A partner has one project, read-only, already on their screen;
that the rest of the workspace exists is not something that seat is told.

### Starting and deleting a project

**New project** makes a directory in the workspace with a README in it —
`/home/coder/projects/<name>`, inside the `home` volume, the same folder the
editor opens. Not a git repository: `git init` decides things (a branch name,
whether this is meant to be a repository at all) that are the owner's to
decide, and Sage can do it in a sentence when asked.

Deleting is the one that needed care, because a delete on that box is final —
there are no VPS backups yet. So it is not a delete. The directory **moves to
`.trash` inside the workspace**: a rename, atomic and on the same filesystem,
out of the listing and recoverable by hand.

Two things have to be true before it moves. The name has to be typed back,
which is the difference between a slip and a decision. And the server asks git
what is in there that is nowhere else — no repository at all, no remote,
commits on no remote, uncommitted edits — and refuses on a first press if it
finds any, returning what it found so the page can say what would be lost.
"Are you sure?" about nothing in particular teaches people to press yes.

### What she says she is doing

"working…" is what a progress bar says. The status line's only job is to prove
the page has not died, so it may as well have a voice: *smoko break*, *astral
travelling*, *spacing out*, *off with the fairies*. A different one each turn,
and a new one every nine seconds inside a long turn — a line that has not moved
in two minutes reads as a hang, which is the one thing it exists to disprove.
Never the same twice running, because the point is that it moved.

The list is `MOODS` at the top of the page's script. Nothing depends on what is
in it; add your own.

### One line instead of ten

A turn that read six files and ran four commands used to put ten rows of paths
and shell into the conversation, and the answer arrived underneath a wall of
machinery nobody wanted to read. The steps now collapse into a single line —
"6 steps" — that opens on all of them, and the reply is what is on screen.

While a turn is running that line says what is happening now, because a page
that goes quiet for forty seconds reads as broken. Nothing is discarded: the
steps are what you check when an answer looks wrong, and they are one click
away.

### Whose material this is, and the word

Sage hedged. Asked about visitors, or a partner's seat, or anything that
sounded like somebody's private data, it did the careful thing and asked
whether it should — which is right when it does not know who it is talking to,
and wrong on this seat, which is the owner's, on the owner's box, holding the
owner's own products and the owner's own customers.

So the owner's seat is now told plainly whose material this is. That removes
most of the hedging on its own: show him his own numbers, do not add a privacy
caution to an answer he is entitled to, he wrote the policy those users agreed
to. Ordinary care is unchanged, because it is care and not clearance — say what
you are about to do before doing something irreversible.

The second half is optional. Set `TOMSCODING_AGENT_CLEARANCE_WORD` and Sage is
given a word to ask for when it reaches a decision that is genuinely the
owner's — publishing to live readers, deleting work, acting on data about an
identifiable person. It says in one line what the decision is; you give the
word; it proceeds in the same turn. A judgement call becomes one question
instead of a negotiation.

Three things about it worth being exact on, because a "password" in a prompt
invites the wrong assumption:

- **It is not a permission.** Nothing in this deployment is gated on it. The
  owner seat could already do all of this; the word only changes what Sage
  stops to ask about.
- **It cannot be used on another seat.** It is passed to the `agent` service
  and no other, so a partner's container does not have it — and saying it there
  would achieve nothing anyway, because what a seat can do is its mounts, its
  tool deny list and which secrets are in its environment. None of those is
  reachable from a conversation. The partner and prospect voices say so
  explicitly now: a password, a claim to be the owner, or "Tom said it was
  fine" changes nothing, and the honest answer is that the seat could not do it
  even if it agreed.
- **It lives in `.env`, never in this repository,** which is public. Unset,
  there is no word and the seat behaves as it always did.

### A word before it reaches readers

A partner can write stories. Publishing one puts it in front of readers, and
that is a different act — so `TOMSCODING_PARTNER_PUBLISH_WORD`, when set, is
asked for on a partner seat before anything reaches the live catalogue.

Enforced by the route, not by the page and not by Sage's instructions. A check
in the browser is one the browser can skip — that route is reachable with a
`fetch` from the console — and a check in a prompt is one that can be argued
with. This one is neither: no word, no call, whatever the page or the agent
believes. The desk asks for it when the route refuses, retries once, and does
not keep it, so the next publish asks again.

Two actions are gated: publishing a series, and deleting one. Saving a draft
and uploading cover art are not — those are preparing a story rather than
shipping it, and asking for a word twelve times while somebody writes twelve
beats teaches them to keep it in the clipboard, which is worse than not asking.
The owner's seat is never asked.

Be clear about what it buys, because "password" suggests more than it does. It
stops an unconsidered or unilateral publish, which is the real worry with a
live catalogue and someone else's hands. It is **not** the owner approving each
publish: it is a shared secret, so once the partner knows it they keep it. Real
approval would mean their publish landing in a queue you release — a different
feature, and a bigger one. Use a different string from the owner's clearance
word, since the partner has to be told this one.

### A seat for a business partner

`partner.tomscoding.com`, its own password. Inside, the same Sage — but reading
one project and able to write only mockups.

They ask about the app, or ask for a change; Sage builds it as a single
self-contained HTML page in a **Mockups** panel they can open. You collect those
with `make partner-mockups` and decide what becomes real. Nothing they do
reaches your code.

**That last sentence is enforced, not promised.** The source is bind-mounted
read-only, so a write to it fails in the kernel regardless of what the agent was
asked. The only writable path is the mockups volume. That container has its own
home with no git identity in it — nothing to push with, nowhere to push. No
Bash, because Bash on that seat is a shell on the box whatever the working
directory says. See `docs/security.md`, including the one command that verifies
the mount rather than trusting it.

**The snapshot only moves when you move it:**

```bash
make partner-sync      # replaces what they see with TOMSCODING_PARTNER_BRANCH
make partner-mockups   # copies their mockups out to ./mockups for review
```

`TOMSCODING_PARTNER_REPOS` lists what they are allowed to see — one entry per
line as `url#branch`, as many as you like. Each lands in its own folder, so Sage
sees them side by side. **That list is the access decision:** a repository not on
it is not on the machine at all, so there is nothing to reach, guess at, or be
talked into.

`partner-sync` clones each one, strips its `.git`, and writes a `SNAPSHOT.txt`
recording every repo, branch, commit and the date — so neither of you ever has to
ask which version is on screen. Their mockups survive a sync.

**Documents** sits beside Mockups: named files from the snapshot, rendered as
readable pages. `TOMSCODING_PARTNER_DOCS` lists them one per line as
`path=Title`. A list, not a folder scan — a `docs/` directory holds working
notes as readily as anything meant for someone else, and under a scan every new
file publishes itself. The button only appears when there is something in it.

Sign-in takes a **username and password**. Set `TOMSCODING_PARTNER_USER` to
their name; Sage greets them by it. The username is not much of a secret and is
not what keeps anyone out — it makes the seat read as an account rather than a
shared door, and leaves room for a second partner later. The owner's own seat is
unchanged and still asks for a password only.

Enable it with `partner` in `COMPOSE_PROFILES`, a password, an A record, and the
repo list. `make up` refuses to start the seat without a password or before a
first sync.

**A second partner** is `partner2` in `COMPOSE_PROFILES` and the
`TOMSCODING_PARTNER2_*` settings, synced with `make partner-sync-2`. Own login,
own snapshot, own mockups, own hostname, own Docker network — the two cannot see
each other's work or each other's repositories. That separation is the reason to
run two containers rather than two accounts in one; several people who *should*
share everything would be the other design, and is not built.

Each seat costs about 768 MB. One is comfortable on 4 GB, two wants 8.

### Voice

A circle at the left of the composer. Tap it and Sage listens; tap again and
what you said arrives as text in the box — **not sent automatically**, because a
mis-heard word is easy to fix before it becomes a turn and impossible after.
Sage speaks her replies without being asked, and tapping the circle mid-sentence
cuts her off *and* starts listening, which is what "actually, hang on—" looks
like as a gesture.

Carried over from journey's spec §20.1, and load-bearing: **the speech provider
never generates a word of its own.** It is handed the exact text Sage already
produced — no system prompt, no history — and hands back audio. On the way in it
transcribes and returns text, which then travels the ordinary chat path exactly
as typed text would. Speaking and typing are one conversation arriving through
two doors. Give that module a prompt and the guarantee is gone.

The browser never contacts the speech provider; this server does, from Tokyo.
That is the only reason it works from where you are.

Optional. Add `ELEVENLABS_API_KEY` to `.env` and the circle appears; leave it
out and Sage is text-only with nothing else changed — a missing key must look
like a feature that is switched off, not one that is broken.
`TOMSCODING_AGENT_VOICE_ID` picks the voice.

Nothing is stored: audio is forwarded, transcribed, and dropped.

### Past conversations

**Path**, in the masthead. One list — the conversations *are* the history, so
there is no second place to look. Each entry has **Continue**, which draws the
thread back and carries it on, and **Analysis**, which reads it back and returns
four sections: what it was about, what changed, what is still open, and one
thing worth remembering.

Nothing new is recorded to make this work. Claude Code already writes every
session to disk as it goes, so the list covers conversations that happened
before the feature existed. It also means history is **server-side**: the same
list appears on your phone and your laptop, and clearing browser data doesn't
touch it.

Analysis costs a model call, so it runs only when asked and the result is kept.
Asking again is free; it regenerates only when the conversation has moved on
since — a fingerprint of the turns decides, not a timestamp.

`agent/lib/conversations.js` holds the part worth reusing: what counts as a
conversation, how a title is chosen, when an analysis is stale. It has no
Express in it and no UI, and talks to a store with four operations — `list`,
`get`, `readAnalysis`, `writeAnalysis`. Here that store reads transcript files;
elsewhere it could be `localStorage` or a table. Porting the feature to another
app means writing an adapter and a view, not reimplementing the rules.

Listing never opens a whole transcript — they reach tens of megabytes. Titles
and recency come from the last 64 KB, the opening line from the first 256 KB.

The interface shares the launcher's palette and typography, so
`tomscoding.com` and the agent read as one product rather than two tools that
happen to live on the same box. Sage's replies are set in the serif and yours
in the sans — the typeface says who is speaking, which is cheaper than a label
and works at a glance.

Enable it in `.env`: add `agent` to `COMPOSE_PROFILES`, set
`TOMSCODING_AGENT_DOMAIN` to a hostname with its own A record, set
`TOMSCODING_AGENT_PASSWORD`, and set `ANTHROPIC_API_KEY`. `make up` refuses to
start without the last two.

Sign-in is a form, and it sets a signed cookie good for thirty days. It was
HTTP basic auth first, which is wrong for a phone: iOS holds no cookie for
basic credentials, so putting the handset down and picking it up meant typing
the password again. The signing key derives from the password, so there is no
second secret to keep and changing the password signs every device out.

Replies stream as Server-Sent Events rather than over a websocket — plain HTTP
over TCP, which needs nothing special from the proxy and holds up better on
this route.

**It works on the same files as the IDE.** The agent mounts the workspace's
home volume and runs in `/home/coder/projects` — the directory code-server
opens. Ask it to change something and the file changes under the editor, where
you can read what it did.

That is deliberate, and it replaced an earlier design where the agent had a
private volume of its own. Isolation sounded safer, but it made the agent
useless: it could code, never on anything that mattered. Git is what protects
the files here, and it protects them better than a wall between containers did.

It runs as uid 1000, the workspace's own user, so files it creates stay
editable in the editor rather than arriving owned by root. It shares
`/home/coder` as its home too, which means the SDK loads the same
`~/.claude/CLAUDE.md` the CLI does — one set of working instructions, not two.

**Tools run without pausing to ask.** Commit before anything large. An approval
step before writes and commands is the obvious next thing to build, and it is
not built yet. The second seat keeps its own separate volume and is not
reachable from here.

## The brand homepage

`liuxuesheng.io` — a public page with the brand on it, and one **Admin** button
in the top right. The page itself is branding and nothing else; the app, the
partner seats and the numbers all live behind that button, because a homepage
for students should not have a staff door in the middle of it.

The panel is a `<dialog>` rather than a hand-rolled overlay, which buys the
parts that are easy to get wrong: Escape closes it, focus stays inside it while
it is open, and the page behind it goes inert. The app's reachability is probed
the first time the panel opens, not on page load — a request that leaves the
browser on every visit, for a status dot nobody is looking at, is not worth
making on a connection this page exists to accommodate.

It has no container and no Compose profile. Caddy serves `brand/` from disk,
so it costs nothing to run, has no session, and cannot be signed in to. Give it
an A record, set `TOMSCODING_BRAND_DOMAIN`, and `make up`.

**The admin list is links, not a login.** Each seat still asks for its own
username and password on its own hostname, and that is the only place a
password is ever typed. Routing someone by name from a public page is not a
control and is not built as one — the seat's password is the control. Putting a
password box here would mean credentials crossing an extra origin to buy
nothing.

Everything on the page is public. Do not put anything on it you would not print
on a flyer.

**Caddy renders it.** The brand name, the app's address and the seats' names are
substituted from `.env` through Caddy's `templates` directive, so a rename is a
config change rather than an edit. Two consequences worth knowing:

- **A doubled opening brace is reserved anywhere in that file** — CSS, script
  or comment. Go's template parser reads the whole file, not just the parts you
  meant as template.
- **`templates` is text substitution, not HTML escaping.** Configured values
  land in element text, never in an attribute or a JavaScript string, so a
  stray quote in a tagline cannot break the page. Keep it that way.

A seat that is not configured is left out rather than shown broken: the second
row appears only once `TOMSCODING_PARTNER2_DOMAIN` is set to a real hostname.

`www` redirects to the apex from its own site block. A homepage people type or
paste is different from a service hostname — someone will write the `www` in,
and a certificate error on the front door reads as the company being broken.

### The stage, and screenshots

A reviewer's seat splits: conversation on the left, the live app in a frame on
the right, set with `TOMSCODING_PARTNER_APP_URL`. Mockups open in that same
frame rather than a new tab, and one made during a turn shows itself as the
turn ends — asking for a change and then being told to go and find the result
is what makes a review tool feel like homework.

The divider drags, double-clicks to minimise, and remembers its width. That is
a decision a reviewer makes every minute rather than once, so it is a handle
and not a setting. **Do not `preventDefault()` on its `pointerdown`** — it
suppresses the click events that follow, and the double-click is one of them.
That was the first version's bug.

Screenshots attach three ways: paste, drag onto the window, or the button.
Paste is the one that matters — a Mac screenshot goes to the clipboard, so
that is the path people actually use. Pictures are scaled to 1568px on the
long side and re-encoded as JPEG in the browser before they are sent: above
that size the model gains nothing, and a retina screenshot is several megabytes
across a link this deployment exists to accommodate.

They reach the SDK as an Anthropic `MessageParam` with image content blocks,
which means the prompt becomes a one-message async iterable rather than a
string — that is the only shape that carries blocks. A plain text turn stays a
plain string. Only `/api/chat` takes a large body; every other route keeps the
small limit, because a route that accepts megabytes is a route worth aiming at.

## The counter

How many people used it today, how many of them had never been before, and
which pages and functions they used. `numbers.tomscoding.com`, `analytics` in
`COMPOSE_PROFILES`.

**The dashboard's password is optional.** Set `TOMSCODING_STATS_PASSWORD` and it
signs in like every other seat here; leave it empty and the page is open to
anyone with the address, and says so in a banner across the top while that is
true. Open is a choice and is treated as one — `make up` prints a note rather
than refusing — but be clear about what it means: hostnames are published to
public Certificate Transparency logs the moment a certificate issues, so "nobody
knows the URL" is not a control. The data itself holds no personal information,
so what is exposed is business information: your traffic, your growth, and which
features people actually use.

**A site reports with one script tag**, served by the counter itself so there is
no build step and nothing to keep in sync:

```html
<script src="https://numbers.tomscoding.com/lx.js" defer></script>
```

On the brand page it is `/a/lx.js` instead — same file, same origin, so
reporting a visit costs no preflight and no third-party request. The app at
`liuxuesheng.help` is on a different machine entirely, so it uses the absolute
form above; that is what the origin allow-list and the single-origin CORS echo
are for, and it works today without waiting for any cutover. Page views are
counted on their own. To count a feature, call it by name where the feature
happens:

```js
lx("translate");
```

That is the whole API. `lx()` is defined by the snippet and is safe to call
before it loads only if you guard it (`window.lx && lx("translate")`).

### Today's numbers in Sage

Sage's masthead carries a readout — people today, first-timers, and fourteen
days of bars — that opens the full dashboard. Owner seat only: a partner is
shown the app and their own mockups, and how the business is doing is not
theirs.

The page cannot fetch it. The counter is a different hostname with its own
sign-in, and that cookie is host-only, so a browser on the agent's origin has
no way to read it. The agent fetches it server-side over the Docker network
instead — a container name, so the request never leaves the box — and
identifies itself with `TOMSCODING_STATS_INTERNAL_TOKEN`, compared in constant
time and never sent to a browser. Unset, the readout is not drawn.

It fails quietly on purpose. A counter having a bad minute must not put an
error in the masthead of a page somebody is trying to work in.

### What changed, in Sage and on the page

Sage runs in a container that mounts your projects and not this repository, so
a deploy used to be invisible from inside it. Ask it what changed yesterday and
it had nothing to answer with — the platform around it is a thing it cannot see
the source of.

`make up` now writes `.platform-state/changes.json`: the last twenty-five
commits it is deploying, with dates and changed paths. Compose mounts that one
directory into the agent read-only, and the agent reads it fresh on every turn,
so a `make up` mid-conversation is picked up without a restart.

It is a digest and not a bind-mount of the repository on purpose. Mounting the
repository would have told the agent everything it needed and also handed it
`.env` — every key on the box, both partner passwords, Study Pal's admin key.
Commit subjects and file paths carry none of that.

The same list is on the page, behind a **What's new** button in the masthead
that counts what has arrived since this browser last looked (kept in
`localStorage`, so it is per-device and nothing is stored server-side). Owner
seat only, like the numbers: the platform's commit history describes how the
box is built, which is not a partner's to read.

Two limits worth knowing. The list is stamped at deploy time, so a commit
pushed but not deployed is not in it — the agent is told to believe you over
the list. And `make whats-new` refreshes it on its own after a `git pull`, if
you want Sage current without a rebuild.

### What "a person" means here

One browser. The counter puts a random id in that browser's own storage — no
account, no IP address kept, no user agent kept, no third party, nothing that
follows anyone to another site. The consequences are real and worth stating
rather than papering over: the same person on a phone and a laptop is two, and
someone who clears their storage is new again. Counting people properly needs
accounts, and this product does not have them.

**Days are never added up.** The dashboard shows visitors per day and no weekly
total, because the same person on Monday and Tuesday is one person and no
stored count can tell you that. Pages and functions *are* summed across a
range — those are actions, and two of them are two.

### What stops it counting the wrong things

- **An allow-list of origins.** `TOMSCODING_STATS_SITES` decides whose numbers
  these are. The origin is read from the request, not from the body — a page
  can claim anything in a POST but cannot forge the Origin the browser sends —
  and an origin that is not on the list is dropped.
- **Crawlers.** Most never run scripts, so they never arrive. The ones that do
  name themselves, and that name is used to skip them and then thrown away.
- **A ceiling per address**, so one bored visitor with a loop cannot invent a
  thousand page views.

### Where it keeps things

A directory in a named volume, no database:

```
2026-09-02.jsonl          every event, appended — the durable record
2026-09-02.summary.json   that day's totals — the index
devices.json              id -> first day seen, last day seen
```

On boot only today's log is replayed; earlier days come back from their
summaries, which is what keeps start-up flat as the log grows. `devices.json`
is the only thing that spans days and exists for exactly one question — is this
person new — which a single day cannot answer, and which the retained logs
would answer wrongly for someone returning after the window.

Raw logs are pruned at `TOMSCODING_STATS_RETAIN_DAYS`. Summaries are kept.

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — what each piece does and why
- [`docs/networking.md`](docs/networking.md) — keeping the link usable, and what to do when it isn't
- [`docs/security.md`](docs/security.md) — this box has a public shell on it; read this
- [`docs/todo.md`](docs/todo.md) — what is known to need doing, and what it costs to leave

## Layout

```
docker-compose.yml        caddy, the workspaces, and the optional browser/agent
docker/Caddyfile          TLS termination, websocket proxying, security headers
docker/sites/             one site block per hostname
docker/conf.d/            optional overlays on the IDE site (extra auth, allowlist)
docker/workspace/         the IDE image: code-server + node + claude CLI
agent/                    the agent chat app: server, UI, image
landing/                  the launcher page, static and self-contained
brand/                    the brand homepage, rendered by Caddy from .env
analytics/                the counter: collection endpoint, store, dashboard
env.tomscoding            this deployment's settings, minus the secrets
install/bootstrap.sh      one-shot VPS preparation
scripts/check-sites.py    verifies every site address resolves and is unique
scripts/privacy-check.py  what public records say about who runs these sites
scripts/doctor.sh         client-side network diagnostics
scripts/whats-new.sh      stamps the deploy's commit list for the agent to read
docs/todo.md              open items, with what each one costs if left
```
