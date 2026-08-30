# Architecture

Two containers on one Docker network. Only Caddy is reachable from outside.

```
        internet
            │
       :80  :443                    VPS (Tokyo)
            │
      ┌─────▼──────┐
      │   caddy    │  TLS termination, ACME, websocket proxy
      └─────┬──────┘
            │  sage network (internal only)
      ┌─────▼──────────────────────────────┐
      │            workspace               │
      │  code-server  :8080                │
      │  claude CLI                        │
      │  node, python, git, tmux, ripgrep  │
      │  /home/coder  ← named volume       │
      └────────────────┬───────────────────┘
                       │
                 api.anthropic.com, github.com, npm, …
```

## caddy

Terminates TLS and proxies everything to the workspace. Chosen over nginx for
one reason: it obtains and renews Let's Encrypt certificates itself, with no
cron job and no certbot. Certificates and account keys live in the `caddy_data`
volume, so a rebuild does not re-issue and burn rate limit.

Two configuration choices are deliberate:

**HTTP/3 is off.** Caddy enables it by default, which puts traffic on QUIC over
UDP/443. On long-haul routes into Japan, UDP is more often lossy or
rate-limited than TCP, and a browser that tries QUIC first pays a stalled
handshake before falling back. Pinning `protocols h1 h2` skips that entirely.

**Nothing overrides the proxy defaults.** code-server holds a single websocket
open for the life of an editor session, and Caddy proxies it with no idle
timeout out of the box. Adding explicit transport timeouts here would only
create a way to accidentally close that connection.

## workspace

Built from `codercom/code-server`, with a toolchain layered on: Node 22 from
NodeSource, Python, git, ripgrep, tmux, and the `@anthropic-ai/claude-code`
CLI installed globally.

It listens on `:8080` and is published to the Docker network with `expose`,
not `ports`. It has no host port binding, so it cannot be reached from the
internet even if the firewall were misconfigured — the only way in is through
Caddy, which requires authentication.

`/home/coder` is a named volume. Everything that matters — repositories, shell
history, the Claude Code credential store, editor settings, installed
extensions — is inside it and persists across restarts and image rebuilds.

Memory is capped (`SAGE_WORKSPACE_MEMORY`, default 3g) so a runaway build in
the IDE terminal cannot take the host down with it and lock you out.

## Why this shape

**Why containers rather than installing on the host.** `make rebuild` gets you
a current toolchain without accumulated drift, and the memory cap is enforced
by the kernel rather than by hoping.

**Why one volume rather than a host bind mount.** A named volume keeps the
`coder` user's ownership correct with no uid mapping to get wrong. `make
backup` tars it when you want a copy on the host.

**Why code-server rather than a thin custom UI.** The editor is not the
interesting part of this project and writing one would be a large ongoing cost
for no gain. code-server is a real VS Code, so extensions, keybindings, and
muscle memory transfer unchanged.

## Extending it

Add a service to `docker-compose.yml` on the `sage` network, then drop a
`.caddy` file in `docker/conf.d/` to route to it. For example, a Postgres for
local development needs no Caddy entry at all — reach it from the workspace at
`postgres:5432` and leave it off the internet.
