# Caddy overlays

Files matching `*.caddy` in this directory are imported into the site block in
`../Caddyfile`, before the `reverse_proxy`. Nothing here is required — the
default deployment ships this directory empty.

## Add a second authentication factor

code-server already requires `SAGE_PASSWORD`. To require HTTP basic auth in
front of it as well, create `auth.caddy`:

```
basic_auth {
	you $2a$14$REPLACE_WITH_A_REAL_HASH
}
```

Generate the hash on the VPS:

```
docker run --rm caddy:2-alpine caddy hash-password --plaintext 'your-password'
```

## Restrict by source IP

Useful only if your ISP gives you a stable address; most Chinese residential
connections do not.

```
@blocked not client_ip 203.0.113.4 198.51.100.0/24
respond @blocked 403
```

Reload after any change: `make reload`.
