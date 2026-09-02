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
`partner/source` with a chosen branch and writes a `SNAPSHOT.txt` recording
which commit that was. Nothing the partner does advances it, and there is no
path from their seat to your workspace, your repositories or your other
projects.

**What they do get.** Your API key is spent on their turns — they cannot read
it, but they can cost you money, so give that key a spend limit. They can read
the whole snapshot, so do not sync a branch containing anything you would not
show them; check for committed `.env` files first. And their mockups are served
from your origin, so those pages are sent with a `Content-Security-Policy` that
permits no network of any kind — an agent-written page on the same origin as an
authenticated session is otherwise a way to call these APIs.

**A password is still one shared secret.** Everything under *Worth adding*
below applies here too, and more so: this one is held by someone else.

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
