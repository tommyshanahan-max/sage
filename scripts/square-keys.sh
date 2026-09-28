#!/usr/bin/env bash
# PUTTING SQUARE ON THE BOX, SO A LIVE CAN TAKE APPLE PAY — `make book-square`.
#
# Three values from Square's Developer Console (squareup.com/au → Developer →
# the app → Production): the access token, which is secret, and the
# application id and location id, which are not. Read with `read -rs`, same
# as scripts/stripe-keys.sh and for the same reason: nothing echoed, nothing
# in the shell's history.
#
# THEN APPLE PAY, WHICH IS THE POINT. Apple only shows its button on a site
# that has proved Square may take payments for it: a file from Square served
# at thexchange.app/.well-known/apple-developer-merchantid-domain-association,
# and the domain registered with Square. Both done here, so it is not a
# fourth and fifth thing to do by hand. If either fails the keys are still
# in and card and Google Pay work; Apple Pay says why and running this again
# tries again.
set -euo pipefail

[ -f .env ] || { echo "  No .env here. Run this from ~/tc."; exit 1; }
if ! { : < /dev/tty; } 2>/dev/null; then
  echo ""
  echo "  Nothing to type into. Run it with ssh -t:"
  echo ""
  echo "    ssh -t root@45.77.8.166 'cd ~/tc && make book-square'"
  echo ""
  exit 1
fi

ask() {
  local label="$1" want="$2" val=""
  while :; do
    echo "" >&2
    echo "  ────────────────────────────────────────────────" >&2
    printf '  PASTE THE %s NOW, then press Enter\n' "$(printf '%s' "$label" | tr '[:lower:]' '[:upper:]')" >&2
    echo "  Nothing will appear as you paste. That is normal." >&2
    echo "  ────────────────────────────────────────────────" >&2
    read -rs val < /dev/tty || { echo ""; echo "  Nothing read."; exit 1; }
    echo "" >&2
    val="$(printf '%s' "$val" | tr -d '[:space:]')"
    if [ -z "$val" ]; then echo "    Empty — nothing pasted. Try again." >&2; continue; fi
    if printf '%s' "$val" | grep -Eq "$want"; then echo "    ${#val} characters" >&2; break; fi
    echo "    That doesn't look like the $label. Try again." >&2
  done
  printf '%s' "$val"
}

echo ""
echo "  Square: three values from the Developer Console, Production."
TOKEN="$(ask "access token" '^EAAA[A-Za-z0-9_-]{20,}$')"
APP="$(ask "application id" '^(sandbox-)?sq0idp?-[A-Za-z0-9_-]+$|^sandbox-sq0idb-[A-Za-z0-9_-]+$')"
LOC="$(ask "location id" '^[A-Z0-9]{8,20}$')"

case "$APP" in sandbox-*) API=https://connect.squareupsandbox.com/v2 ;; *) API=https://connect.squareup.com/v2 ;; esac

# Checked against Square before anything is written: a token that cannot see
# that location is a till that refuses every sale, and better said now.
if ! curl -fsS -H "Authorization: Bearer $TOKEN" "$API/locations/$LOC" >/dev/null 2>&1; then
  echo ""
  echo "  Square did not accept that token with that location. Nothing written."
  echo "  Check both are from the same app, both Production, and run this again."
  exit 1
fi
echo ""
echo "  Square answered: token and location match."

cp .env .env.before-square-keys
put() {
  grep -v "^$1=" .env > .env.next || true
  printf '%s=%s\n' "$1" "$2" >> .env.next
  mv .env.next .env
}
# TOMSCODING_*, not BOOK_*: docker-compose.yml maps one to the other, and
# a name compose does not read is a key that silently does nothing.
put TOMSCODING_SQUARE_TOKEN "$TOKEN"
put TOMSCODING_SQUARE_APP "$APP"
put TOMSCODING_SQUARE_LOCATION "$LOC"
chmod 600 .env
docker compose up -d book >/dev/null 2>&1
echo "  Keys in. Card and Google Pay are on for every live."

# APPLE PAY. The file is Square's, the same for every Square seller; it goes
# in the book container's volume, and Caddy serves it at the address Apple
# checks (see docker/sites/board.caddy).
DOMAIN="$(grep -E '^TOMSCODING_BOARD_DOMAIN=' .env | tail -1 | cut -d= -f2- | tr -d "\"'" || true)"
[ -n "$DOMAIN" ] || DOMAIN=thexchange.app
FILE="$(mktemp)"
if curl -fsSL -o "$FILE" "https://app.squareup.com/digital-wallets/apple-pay/apple-developer-merchantid-domain-association" && [ -s "$FILE" ]; then
  docker compose exec -T book sh -c 'cat > /data/apple-pay-domain' < "$FILE"
  sleep 1
  OUT="$(curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"domain_name\":\"$DOMAIN\"}" "$API/apple-pay/domains" || true)"
  if printf '%s' "$OUT" | grep -q '"status": *"VERIFIED"'; then
    echo "  Apple Pay: on, for $DOMAIN."
  else
    echo "  Apple Pay: Square did not verify $DOMAIN yet. It said:"
    echo "    $(printf '%s' "$OUT" | head -c 300)"
    echo "  Card and Google Pay work meanwhile. Run make book-square again to retry."
  fi
else
  echo "  Apple Pay: could not fetch Square's domain file. Card and Google Pay"
  echo "  work meanwhile. Run make book-square again to retry."
fi
rm -f "$FILE"
