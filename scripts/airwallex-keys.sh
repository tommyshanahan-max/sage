#!/usr/bin/env bash
# THE KEYS GO IN AS ARGUMENTS, because the alternative is editing .env on a
# server over SSH with a text editor, on a screen that is hard to read, to put
# two long strings on two exact lines. That is the step every other Airwallex
# instruction here ended with — "put the client id and the API key in first" —
# and it is the step that was never done.
#
#   make airwallex-keys CLIENT_ID="…" API_KEY="…"            sandbox
#   make airwallex-keys CLIENT_ID="…" API_KEY="…" WHO="Tom"  and turn it on
#   make airwallex-keys CLIENT_ID="…" API_KEY="…" LIVE=1     production keys
#
# It writes the two lines, brings the board up so it reads them, and then logs
# in to Airwallex and asks for a real FX quote. That last part is the point: a
# key that is in the file and wrong looks exactly like a key that is right
# until somebody's phone is holding a code that will not scan.
#
# NOTHING IS PRINTED BACK. Not the key, not the id, not a masked version of
# either — a terminal is a window somebody can be standing behind, and a
# screenshot of a working deploy is a thing that gets sent to people.
#
# ONLY FROM THE COMMAND LINE. make imports the environment as its own
# variables, and a box with API_KEY already in its environment would otherwise
# have that written into .env by a command that named no key at all. The
# Makefile passes $(origin) through, the same as dealio-webhook.
set -euo pipefail

CLIENT_ID=""
API_KEY=""
WHO=""
LIVE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --client-id) CLIENT_ID="${2:-}"; shift 2 ;;
    --api-key)   API_KEY="${2:-}";   shift 2 ;;
    --who)       WHO="${2:-}";       shift 2 ;;
    --live)      LIVE=1;             shift ;;
    *) echo "  Unknown argument: $1"; exit 1 ;;
  esac
done

usage() {
  echo ""
  echo '  make airwallex-keys CLIENT_ID="…" API_KEY="…" [WHO="Tom"] [LIVE=1]'
  echo ""
  echo "  Both come from the Airwallex dashboard: Developer → API keys."
  echo "  The sandbox and the live account have different ones, and LIVE=1"
  echo "  is what says which of the two you are holding."
  echo ""
}

[ -n "$CLIENT_ID" ] && [ -n "$API_KEY" ] || { usage; exit 1; }
[ -f .env ] || { echo "  No .env here. Run this from ~/tc."; exit 1; }
[ -w .env ] || { echo "  .env is not writable."; exit 1; }

# A KEY WITH A NEWLINE IN IT is what a copy out of a web page looks like when
# the selection took the line break too, and it goes into .env as a line that
# is not a key followed by a line that is not a name. Caught here, where it
# can be said plainly, rather than as a login failure with no explanation.
case "$CLIENT_ID$API_KEY" in
  *$'\n'*|*$'\r'*) echo "  That key has a line break in it. Copy it again without the newline."; exit 1 ;;
esac

put() {
  grep -v "^${1}=" .env > .env.next || true
  [ -n "${2:-}" ] && printf '%s=%s\n' "$1" "$2" >> .env.next
  mv .env.next .env
}
get() { grep -E "^${1}=" .env | tail -1 | cut -d= -f2- | tr -d '"' || true; }

put TOMSCODING_BOARD_WALLET_AIRWALLEX_CLIENT_ID "$CLIENT_ID"
put TOMSCODING_BOARD_WALLET_AIRWALLEX_API_KEY "$API_KEY"
put TOMSCODING_BOARD_WALLET_AIRWALLEX_SANDBOX "$([ -n "$LIVE" ] && echo 0 || echo 1)"
# The provider switch, only if it is not already saying something — a box
# deliberately left on the stand-in is left on the stand-in.
[ -n "$(get TOMSCODING_BOARD_WALLET)" ] || put TOMSCODING_BOARD_WALLET airwallex

echo ""
echo "  Written. Bringing the board up so it reads them…"
make up >/dev/null

echo ""
echo "────────────────────────────────────────────────────────────"
echo ""
if [ -n "$LIVE" ]; then
  echo "  LIVE KEYS. Anything paid against a code from here is real money."
else
  echo "  Sandbox keys. The codes are real; the money is test money."
fi
echo ""
echo "  Asking Airwallex for a quote with them:"
echo ""

# THE PROOF, AND IT RUNS EVEN IF IT FAILS. A refusal printed here — wrong key,
# wrong host, account not approved for FX yet — is the answer to "is it
# working now", and it is worth more than a silent success.
if docker compose run --rm --no-deps -T --entrypoint node board \
     lib/wallet/providers/airwallex.check.mjs; then
  echo ""
  echo "  The keys work."
else
  echo ""
  echo "  The keys are in .env, but Airwallex refused the call above."
  echo "  Nothing else on the board changed. Run it again with the right"
  echo "  pair and it overwrites them."
  echo ""
  exit 1
fi

if [ -n "$WHO" ]; then
  echo ""
  make dealio-me WHO="$WHO"
else
  echo ""
  echo "  Nobody's requests draw a code yet. When you want that:"
  echo ""
  echo "    make dealio-me WHO=\"Tom\""
  echo ""
fi
