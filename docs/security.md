# Security

Be clear-eyed about what this deployment is: **a root-capable shell, on the
public internet, behind one password.** code-server's terminal runs as `coder`,
which has passwordless sudo inside the container, and the container can reach
your git credentials and your Anthropic API key. Treat the password as
equivalent to your SSH key.

Scanners find new hostnames within hours of a certificate being issued — every
Let's Encrypt certificate is published to public Certificate Transparency logs.
Your domain is not obscure, and it will be probed.

That is also why the landing page's link to `/ide` costs you nothing in
practice: the IDE's hostname is public the moment its certificate issues,
whether or not anything links to it. Removing the link buys obscurity you never
had. The password is the control; treat it as the only one.

## The things that actually matter

**Every seat's password generated, not invented.** A second seat doubles the
number of root-capable shells on this box, and the deployment is only as strong
as the weaker of the two passwords — a memorable one on the second seat
compromises the first, since both containers hold the same API key and sit on
the same host. Generate each with `make password`, and don't reuse one across
seats.

**A generated password, not an invented one.** `make password` gives you 24
random bytes. A password you thought of is guessable at a rate you will not
notice in a log file.

**No host port on the workspace.** `docker-compose.yml` uses `expose`, not
`ports`, for code-server. It is not bound to any host interface, so it is
unreachable except through Caddy. Do not "temporarily" change this to debug
something — that puts an unauthenticated shell directly on the internet.

**A firewall that denies by default.** `bootstrap.sh` sets ufw to deny all
inbound except SSH, 80, and 443. Check it with `sudo ufw status verbose`.

**Key-only SSH.** `bootstrap.sh` deliberately does not touch your SSH config,
because a script that locks you out of a remote box is worse than an unhardened
one. Do it by hand, and keep your current session open while you verify a new
one works:

```bash
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sudo sshd -t && sudo systemctl reload ssh
# now open a SECOND terminal and confirm you can still log in
```

## The agent app, if you enable it

Two things sit behind that one password: an agent that runs commands, and your
Anthropic API key. Whoever gets in spends your money and edits your workspace.

Sign-in sets a signed cookie good for thirty days, rather than HTTP basic auth,
because iOS drops basic credentials the moment it reclaims a tab. The signing
key is derived from the password, so changing the password signs every device
out — which is what you want after losing a phone. **Sign out** in the masthead
does the same for one device.

The key is never sent to the browser — it stays in the container and is used
server-side — so a visitor cannot read it, only spend it. Give that key its own
spend limit in the Anthropic console. That limit is the only hard ceiling on
what a compromise costs you.

**Tools run without approval, on your real files.** The agent shares the IDE's
home volume, so it reads and writes the same projects you edit in the editor.
That is the point — an agent walled off from your work can only ever act on
files you do not care about — but it means a bad turn can delete work, not just
its own scratch space.

What protects those files is git, not container isolation. Commit before
anything large and a mistake costs a `git checkout`. Leave work uncommitted for
a day and it is genuinely at risk. That is the trade, and it is the same one
you accept every time you run the CLI in the IDE terminal.

The second seat is untouched by this — it has its own separate volume, and the
agent cannot see it.

## The browser, if you enable it

It has its own password and its own hostname, but it is a browser someone else
could drive if they got in — logged into whatever you left logged in. Give it a
password as strong as the workspaces', and sign out of anything that matters
before you stop using it. Treat its saved sessions the way you would treat
saved passwords on a shared machine.

## The partner seat

The only part of this deployment designed for somebody who is not you, and the
only one where "cannot" has to mean cannot.

**The controls are structural, not instructions.** The agent's tool list is
shortened and its prompt says what the seat is for, but neither is what stops a
partner changing your application. These are:

- **The source is bind-mounted `:ro`.** A write to it fails in the kernel. It
  does not matter what the agent was asked, told, or persuaded to do.
- **The only writable path is the mockups volume.** There is nowhere else to
  put anything.
- **That container has its own home volume**, not the workspace's. No
  `~/.claude`, no git identity, no credentials — nothing to push with and
  nowhere to push.
- **No Bash and no fetching.** Bash on that seat would be a shell on the box
  whatever the working directory is, and network access is how a mockup session
  becomes an exfiltration one.

Verify the mount on the server rather than taking it on trust:

```bash
docker compose exec partner sh -c 'echo x > /work/app/probe 2>&1; ls /work/app/probe 2>&1'
```

Both should fail — "Read-only file system", then "No such file". If either
succeeds, stop and fix it before giving anyone the password.

**The snapshot only moves when you move it.** `make partner-sync` replaces
`partner/source` with the repositories listed in `TOMSCODING_PARTNER_REPOS` and
writes a `SNAPSHOT.txt` recording each one's commit. Nothing the partner does
advances it, and there is no path from their seat to your workspace, your
repositories or your other projects.

**That list is the access control.** A repository not on it was never cloned, so
it is not on that machine — there is nothing to find, no credential that would
fetch it, and no network route to where it lives. This is the difference between
"not shown" and "not present", and only the second one survives someone trying.

**Each seat sits on its own Docker network**, with only Caddy on it. A partner
cannot resolve `workspace`, `agent` or `browser`, let alone reach them — and a
second partner is on a *different* network again, so two seats that cannot reach
the estate cannot reach each other either. Its session cookie sets
no domain, so it is host-only and cannot be replayed against your other
hostnames.

**Sign-in takes a username and a password**, both compared in constant time. The
username is not the control — it is guessable — but the seat reads as an account
rather than a shared door, and the cookie key is derived from both, so changing
either signs that person out everywhere.

**What they do get.** Your API key is spent on their turns — they cannot read
it, but they can cost you money, so give that key a spend limit. They can read
the whole snapshot, so do not sync a branch containing anything you would not
show them; check for committed `.env` files first. And their mockups are served
from your origin, so those pages are sent with a `Content-Security-Policy` that
permits no network of any kind — an agent-written page on the same origin as an
authenticated session is otherwise a way to call these APIs.

**A password is still one shared secret.** Everything under *Worth adding*
below applies here too, and more so: this one is held by someone else.

## The brand homepage

The one page here with no password on it, which makes it the one page where a
mistake is published rather than merely exposed.

**Nothing is authenticated on it and nothing should be.** The Admin list is a
set of links to the seats; each seat asks for its own username and password on
its own hostname. Do not add a password box to this page: credentials would
then cross an extra origin, and a form that forwards a password is a phishing
target wearing your own domain.

**It has no container.** Caddy serves files from `brand/`, read-only. There is
no session, no upload path, and nothing to compromise beyond the files
themselves — which is why the page is safe to leave open to the world.

**Caddy renders it with `templates`, which does not escape.** Every value it
substitutes comes from `.env`, written by you, and lands in element text rather
than in an attribute or a JavaScript string, so a stray quote produces odd
copy rather than markup. Keep new values in text positions. No request data
reaches the template, and it must not start to.

**Naming a seat on it publishes that person's name.** That is the trade for a
door someone can recognise as theirs. If a partner's name should not be public,
set `TOMSCODING_PARTNER_USER` to something neutral — the page shows whatever
that says, and the seat still checks it at sign-in.

## The counter

The only endpoint in this deployment that answers an unauthenticated request
from the open internet, which is why it is its own container and not a route on
the agent. A public endpoint sharing a process with your API key and a
partner's seat would be a poor trade for one fewer container.

**Collection is public; everything else is not.** Two paths answer without a
password — the snippet, and the endpoint that receives an event. The dashboard,
and the API behind it, need the same signed cookie as every other seat here,
and the stats hostname is the only place either is reachable. The brand page
proxies the two public paths and nothing else.

**Whose numbers these are is an allow-list.** `TOMSCODING_STATS_SITES` decides,
and the origin is taken from the request rather than the body — a page can
claim anything in a POST, but it cannot forge the Origin the browser sends. An
origin that is not listed is dropped. CORS echoes one allowed origin at a time,
never a wildcard.

**What is stored about a person: one random id they generated.** No IP address,
no user agent, no account, no third party, nothing cross-site. The user agent is
read to skip crawlers and then thrown away; the address is used for a rate
limit held in memory for a minute. If that ever changes, this paragraph is the
promise being broken.

**Names are sanitised before they are written.** A page reports the path it is
on and the function name it calls. Control characters are stripped, because
these land in a JSONL file where a newline in a value would put a second,
forged record on the next line.

**The dashboard is `noindex`,** and it should not be linked to from anywhere
public. It is business data about real usage, behind one password.

## The watchdog that comes with the browser

Enabling the browser profile also starts `autoheal`, which restarts the browser
when its health check reports Firefox has died. It needs `/var/run/docker.sock`,
and that is worth being clear about: **the Docker socket is root on the host.**
A container holding it can start any other container, mount any path, and read
any volume — including the one with your API key. Mounting it read-only changes
nothing; the flag protects the socket file, not the API behind it.

It is accepted here for a narrow reason: this container publishes no port, has
no route in from the internet, and runs one fixed job. Nothing reaches it
except the daemon it talks to. That makes it a much smaller exposure than the
password-protected shells already on this box. What it does add is a supply
chain: the risk is code running *inside this container*, so it is now a third
party's image that can reach root on the host. Do not give it a port, extra
mounts, or anything else to do.

Turn it off by dropping `browser` from `COMPOSE_PROFILES`, or by removing the
`autoheal` service; the browser then still works, and a black screen becomes
`make fix-browser` again.

## Worth adding

**A second authentication factor.** code-server's password is a single shared
secret with no rate limiting of its own. Putting basic auth in front of it in
Caddy means an attacker needs two secrets, and the failures show up in Caddy's
access log where fail2ban can see them. See `docker/conf.d/README.md`.

**An identity proxy — but not Cloudflare's.** Putting Tailscale in front of
this replaces the shared password with real SSO and device identity, and is the
strongest option available. The box then needs no public HTTPS port at all.

Do **not** reach for Cloudflare Access here, which is the obvious-looking
choice. Access requires Cloudflare's proxy (the orange cloud) to be on, and
Cloudflare's free-tier edge is badly degraded from mainland China — enabling
the proxy on a working domain is one of the most common ways it abruptly stops
loading there. You would be trading a working deployment for a better auth
story. Tailscale gets you the auth story without touching the path.

**A scoped API key.** If you set `ANTHROPIC_API_KEY` in `.env`, it sits in the
container environment where anything running there can read it. Use a key
dedicated to this host with a spend limit, so a compromise is bounded and
visible on your billing page. Do not reuse your local development key.

**Deploy keys, not your personal SSH key.** Generate a key inside the workspace
and register it per-repository as a deploy key. Do not copy your laptop's key
onto the VPS — it authorises far more than this box needs.

## Checking on it

```bash
docker compose exec caddy tail -f /data/access.log | grep -v ' 200 '
sudo fail2ban-client status sshd
sudo journalctl -u ssh --since '24 hours ago' | grep -i 'failed\|invalid'
```

Repeated 401s from addresses you do not recognise are normal background noise.
A *successful* login you did not make means the password is compromised:
`make down`, rotate `TOMSCODING_PASSWORD`, rotate the API key, rotate any git
credentials in the volume, then `make up`.

## If the machine is compromised

The volume contains credentials, so recovery is rebuild, not cleanup. Destroy
the VPS, rotate every secret it held — API key, deploy keys, anything in shell
history — and build a fresh one. `make backup` snapshots are for convenience,
not for restoring after a breach; restoring one restores whatever was placed in
it.

## Keeping it current

```bash
make rebuild                                   # new base image, node, CLI
sudo apt-get update && sudo apt-get upgrade -y  # host packages
```

Unattended security upgrades are enabled by `bootstrap.sh` for the host, but
container images are only updated when you rebuild. Once a month is reasonable.
