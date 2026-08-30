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
