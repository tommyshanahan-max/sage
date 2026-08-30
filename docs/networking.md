# Keeping the link usable

The whole design rests on one long-lived HTTPS connection from your browser to
your VPS. This is what to do when that connection is bad.

## What "good" looks like

Run `make doctor` from your laptop, not from the VPS. On a healthy path to
Tokyo from coastal China:

| Measure | Healthy | Marginal | Unusable |
|---|---|---|---|
| `connect` | < 0.10s | 0.10–0.25s | > 0.5s or varies wildly |
| ICMP RTT | 30–60 ms | 60–120 ms | > 150 ms |
| Loss (`mtr`) | < 1% | 1–5% | > 5% |

Typing latency in the editor is roughly your RTT. Under 60 ms it feels local.
Around 150 ms it is noticeably behind your fingers but workable. Past that,
switch to the terminal fallback below.

Take three readings a day for a week, including one at 21:00 local. Evening
congestion is the single biggest factor on these routes, and a line that
benchmarks beautifully at 10:00 can be unusable after dinner. Judge a provider
on its worst hour, not its best.

## BBR

`install/bootstrap.sh` switches the VPS to BBR congestion control. This is the
highest-leverage single change on a lossy long-haul path.

The default, CUBIC, treats any packet loss as a congestion signal and halves
its sending window. Routes into Japan carry steady background loss that is not
congestion, so CUBIC spends most of a session backed off far below the
available bandwidth. BBR models the path's actual bandwidth and round-trip
time and paces to that, so isolated loss barely moves it. On a path with a few
percent loss this is frequently a several-fold throughput difference.

Verify it took:

```bash
sysctl net.ipv4.tcp_congestion_control    # want: bbr
```

## When it degrades

**The editor loads but stays "connecting".** The websocket is not completing.
Confirm with `make doctor` — the websocket section reports this specifically.
If the upgrade fails while ordinary requests succeed, something on the path is
terminating long-lived connections; the terminal fallback below is unaffected
by this and is the fastest way to keep working.

**Everything is slow but works.** Congested transit, usually time-of-day.
Check `mtr` loss: the first hop where `Loss%` climbs and *stays* high in every
subsequent hop is the real problem. Loss at a single middle hop that recovers
afterwards is just an intermediate router deprioritising ICMP — ignore it.
If the bad hop is inside your provider's network, that is a support ticket
worth filing. If it is at the international boundary, no amount of tuning
fixes it; change the route.

**Keep DNS unproxied.** The A record must point straight at the VPS IP. If
your registrar is Cloudflare, leave the cloud grey (DNS-only). Turning the
proxy on routes you through an edge that performs poorly from mainland China
and is a common cause of a working site going dark.

**Nothing connects at all, from any network.** Check the VPS is alive from
somewhere else — an uptime monitor, or SSH from a different country. If the
server is fine and only your path is broken, the IP is the variable.

## Rotating the IP

Most providers will assign a new address, or you can rebuild in a different
datacentre. Try this **twice** before drawing conclusions: some hosts hand back
addresses that were already blocked, so one bad new IP proves nothing.

Because the state is in Docker volumes, moving is cheap:

```bash
make backup                         # on the old VPS
scp backups/home-*.tar.gz new-vps:  # move it
# on the new VPS: bootstrap, clone, .env, make up, then restore into the volume
```

Keep your DNS TTL at 300 seconds so a change takes effect in minutes rather
than a day. This is worth setting up *before* you need it.

## Terminal fallback

When the browser IDE is too laggy to use, SSH into the VPS and work in tmux
against the same files. This is not a lesser workflow — the Claude Code CLI is
a terminal program, and a terminal needs a fraction of the bandwidth the editor
does.

The workspace's files are in a Docker volume, so get a shell in the container:

```bash
ssh you@your.domain
cd sage && make shell
tmux new -A -s work      # attach, or create if absent
claude
```

Because tmux keeps the session alive server-side, a dropped connection costs
you nothing — reconnect and `tmux attach` puts you back exactly where you were.

For a genuinely bad link, **mosh** is better than SSH: it runs over UDP,
survives packet loss and IP changes, and echoes your keystrokes locally so
typing stays responsive at high latency. It is not installed by default because
UDP is the less reliable transport on this particular path — it is worth
trying, but keep SSH as the thing you depend on:

```bash
# on the VPS
sudo apt-get install -y mosh && sudo ufw allow 60000:61000/udp
# from your laptop
mosh you@your.domain
```

## Two paths in

The cheapest insurance is a second, unrelated way to reach the box, set up
while everything is working:

- SSH on a non-standard port, in addition to 443 for the web UI. A rule that
  affects one often does not affect the other.
- A second A record (`code2.your.domain`) pointing at a spare IP, so a switch
  is a DNS edit rather than a rebuild.

A single point of failure you have never tested is the thing that will strand
you.
