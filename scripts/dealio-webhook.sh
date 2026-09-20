#!/usr/bin/env bash
# AIRWALLEX TELLS US A CODE WAS PAID, instead of a page having to ask.
#
#   make dealio-webhook                 print the address to give Airwallex
#   make dealio-webhook SECRET="…"      store the secret it gave back
#   make dealio-webhook OFF=1           stop listening
#
# WHY. Asking works and needs nothing set up — the payer's page asks while
# the code is on the screen, the asker's list asks when it is opened — but
# both need somebody to be looking, and the commonest shape of this is
# nobody looking at all: the payer pays on a phone and closes the tab while
# the person owed the money is asleep.
#
# THE ONE STEP THAT CANNOT BE A COMMAND. Airwallex registers notification
# endpoints in their own dashboard, and hands back the signing secret once.
# So this prints exactly what to paste there, and takes back the secret.
#
# THE SECRET ARRIVES AS AN ARGUMENT, NEVER FROM THE ENVIRONMENT. It used to
# read $SECRET, and this box already has a SECRET in its environment — make
# imports those as its own variables, so `make dealio-webhook` with nothing
# after it stored that value and reported "Listening" about a webhook that
# could never have verified. The Makefile passes it only when it came from
# the command line ($(origin SECRET)), and what is not passed is not read.
set -euo pipefail

SECRET=""; OFF=""
while [ $# -gt 0 ]; do
  case "$1" in
    --secret) SECRET="${2:-}"; shift 2 ;;
    --off) OFF=1; shift ;;
    *) shift ;;
  esac
done

[ -f .env ] || { echo "  No .env here. Run this from ~/tc."; exit 1; }
[ -w .env ] || { echo "  .env is not writable."; exit 1; }

put() {
  grep -v "^${1}=" .env > .env.next || true
  [ -n "${2:-}" ] && printf '%s=%s\n' "$1" "$2" >> .env.next
  mv .env.next .env
}
get() { grep -E "^${1}=" .env | tail -1 | cut -d= -f2- | tr -d '"' || true; }

if [ -n "$OFF" ]; then
  put TOMSCODING_BOARD_WALLET_AIRWALLEX_WEBHOOK_SECRET ""
  echo ""
  echo "  Bringing the board up…"
  make up >/dev/null
  echo ""
  echo "  Not listening. Rows still settle when somebody opens a page."
  echo ""
  exit 0
fi

DOMAIN="$(get TOMSCODING_DEALIO_DOMAIN)"
[ -n "$DOMAIN" ] || DOMAIN="$(get TOMSCODING_BOARD_DOMAIN)"
URL="https://${DOMAIN}/api/wallet/webhooks/provider"

if [ -z "$SECRET" ]; then
  echo ""
  echo "────────────────────────────────────────────────────────────"
  echo ""
  echo "  In Airwallex: Developer → Webhooks → Add endpoint"
  echo ""
  echo "  ${URL}"
  echo ""
  echo "  Tick these three:"
  echo "    payment_intent.succeeded"
  echo "    payment_intent.payment_failed"
  echo "    payment_intent.cancelled"
  echo ""
  echo "  It shows a signing secret once. Bring it back here:"
  echo ""
  echo "    make dealio-webhook SECRET=\"the secret it showed you\""
  echo ""
  echo "────────────────────────────────────────────────────────────"
  echo ""
  exit 0
fi

# THE ONE VALUE IT IS WORTH REFUSING BY NAME. The board's admin key opens
# every operator route there is, and the accident above put it one typo away
# from being stored as something else.
if [ "$SECRET" = "$(get TOMSCODING_BOARD_KEY)" ]; then
  echo ""
  echo "  That is the board's admin key, not Airwallex's signing secret."
  echo "  Nothing stored. The secret is the one Airwallex showed you once,"
  echo "  in Developer → Webhooks, after you added the endpoint."
  echo ""
  exit 1
fi

put TOMSCODING_BOARD_WALLET_AIRWALLEX_WEBHOOK_SECRET "$SECRET"
echo ""
echo "  Bringing the board up so it reads the secret…"
make up >/dev/null
echo ""
# The length and nothing else, so a secret pasted half-selected is visible
# without the secret being on a screen or in a scrollback.
echo "  Listening — a secret of ${#SECRET} characters is stored."
echo "  A row now settles whether or not anybody has a page open."
echo "  The address it listens on: ${URL}"
echo ""
echo "  Check it with: make pay-check"
echo ""
