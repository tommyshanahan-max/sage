#!/usr/bin/env bash
# PUT DEALIO ON THE REAL RAILS, for one person, in one command.
#
#   make dealio-me WHO="Tom"      turn it on for Tom's own requests
#   make dealio-me OFF=1          take it off again
#
# WHAT IT TURNS ON. A request in yuan made by that person, paid by WeChat Pay
# or Alipay, now draws a real Airwallex code on the payer's page instead of
# the grey "this is where the payment sheet appears" box. The payer
# long-presses it, pays in the wallet they already had open, and the row goes
# green on its own.
#
# WHY ONE PERSON AND NOT EVERYBODY. Every payment these keys confirm lands in
# the ONE Airwallex account they belong to. Paying other members that way
# needs connected accounts, which Airwallex has not approved yet. Until they
# do, a second person's client paying through here would be paying the
# account holder for work they did not do — so the handle below is the whole
# of who may use it.
#
# WHOSE NAME. The handle on the board, which is usually a first name. It is
# the same WHO as `make ask`, and this runs that at the end with a one-yuan
# request, so a wrong handle fails here rather than on somebody's phone.
set -euo pipefail

[ -f .env ] || { echo "  No .env here. Run this from ~/tc."; exit 1; }
[ -w .env ] || { echo "  .env is not writable."; exit 1; }

put() {
  grep -v "^${1}=" .env > .env.next || true
  [ -n "${2:-}" ] && printf '%s=%s\n' "$1" "$2" >> .env.next
  mv .env.next .env
}
get() { grep -E "^${1}=" .env | tail -1 | cut -d= -f2- | tr -d '"' || true; }

if [ -n "${OFF:-}" ]; then
  put TOMSCODING_BOARD_DEALIO_OWNER ""
  echo ""
  echo "  Bringing the board up…"
  make up >/dev/null
  echo ""
  echo "  No request draws a code any more. Nothing else changed."
  echo ""
  exit 0
fi

[ -n "${WHO:-}" ] || { echo 'make dealio-me WHO="Tom"'; exit 1; }

if [ -z "$(get TOMSCODING_BOARD_WALLET_AIRWALLEX_API_KEY)" ]; then
  echo ""
  echo "  There are no Airwallex keys in .env, and the code comes from them."
  echo "  Put the client id and the API key in first:"
  echo ""
  echo "    TOMSCODING_BOARD_WALLET_AIRWALLEX_CLIENT_ID="
  echo "    TOMSCODING_BOARD_WALLET_AIRWALLEX_API_KEY="
  echo ""
  exit 1
fi

# The provider switch, only if it is not already saying something. A box
# already set to `airwallex` or deliberately on the stand-in is left alone.
[ -n "$(get TOMSCODING_BOARD_WALLET)" ] || put TOMSCODING_BOARD_WALLET airwallex
put TOMSCODING_BOARD_DEALIO_OWNER "$WHO"

SANDBOX="$(get TOMSCODING_BOARD_WALLET_AIRWALLEX_SANDBOX)"
echo ""
echo "  Bringing the board up so it reads the new line…"
make up >/dev/null

echo ""
echo "────────────────────────────────────────────────────────────"
echo ""
if [ "$SANDBOX" = "0" ]; then
  echo "  LIVE KEYS. Money paid against these codes is real money."
else
  echo "  Sandbox keys. The codes are real; the money is test money."
fi
echo ""
echo "  ${WHO}'s own requests in yuan now draw a WeChat or Alipay code."
echo "  Nobody else's do. Take it off with: make dealio-me OFF=1"
echo ""
echo "  A one-yuan request to open on your phone:"
echo ""
make ask WHO="$WHO" AMOUNT="¥1" FOR="a test"
