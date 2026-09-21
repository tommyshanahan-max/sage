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

# THE PLACEHOLDER THAT GOT PASTED. A command handed over with "…" in it comes
# back run exactly as written more often than not, and a placeholder written
# into .env is worse than no key at all: the file looks configured and the
# failure arrives later, somewhere else. Refuse it here, before anything is
# written, and say what to go and get.
case "$CLIENT_ID$API_KEY" in
  *…*|*"your-"*|*"…"*|*"CLIENT_ID"*|*"API_KEY"*|*"xxx"*|*"XXX"*)
    echo ""
    echo "  That is the placeholder, not a key."
    echo "  Airwallex dashboard → Developer → API keys has the real pair."
    echo ""
    exit 1 ;;
esac

put() {
  grep -v "^${1}=" .env > .env.next || true
  [ -n "${2:-}" ] && printf '%s=%s\n' "$1" "$2" >> .env.next
  mv .env.next .env
}
get() { grep -E "^${1}=" .env | tail -1 | cut -d= -f2- | tr -d '"' || true; }

SANDBOX="$([ -n "$LIVE" ] && echo 0 || echo 1)"

echo ""
if [ -n "$LIVE" ]; then
  echo "  LIVE KEYS. Anything paid against a code from here is real money."
else
  echo "  Sandbox keys. The codes are real; the money is test money."
fi
echo ""
echo "  Asking Airwallex for a quote with them, before writing anything:"
echo ""

# PROVED FIRST, WRITTEN SECOND, and it is not a matter of taste. This wrote
# the pair into .env and tested it afterwards, so a pair that came back 403
# had already overwritten the working keys underneath it — which is exactly
# what happened on 21 September: a live pair pasted against the sandbox host
# took out the sandbox keys that had settled a real ¥1 the day before.
#
# So the keys go in on the command line of a throwaway container and nothing
# on the box changes until Airwallex has said yes to them. A wrong pair now
# costs the thirty seconds it took to paste it and nothing else.
if ! docker compose run --rm --no-deps -T \
     -e BOARD_WALLET_AIRWALLEX_CLIENT_ID="$CLIENT_ID" \
     -e BOARD_WALLET_AIRWALLEX_API_KEY="$API_KEY" \
     -e BOARD_WALLET_AIRWALLEX_SANDBOX="$SANDBOX" \
     --entrypoint node board lib/wallet/providers/airwallex.check.mjs; then
  echo ""
  echo "  Airwallex refused that pair, so NOTHING was written."
  echo "  Whatever keys this box had, it still has."
  echo ""
  echo "  A 403 on login is one of four things:"
  echo ""
  echo "    · live keys, and this box is pointed at the sandbox — add LIVE=1"
  echo "    · the key was regenerated after it was copied"
  echo "    · the client id and the key are from different accounts"
  echo "    · the key has an IP allowlist that this box is not in"
  echo ""
  exit 1
fi

echo ""
echo "  The keys work. Writing them and bringing the board up…"
put TOMSCODING_BOARD_WALLET_AIRWALLEX_CLIENT_ID "$CLIENT_ID"
put TOMSCODING_BOARD_WALLET_AIRWALLEX_API_KEY "$API_KEY"
put TOMSCODING_BOARD_WALLET_AIRWALLEX_SANDBOX "$SANDBOX"
# The provider switch, only if it is not already saying something — a box
# deliberately left on the stand-in is left on the stand-in.
[ -n "$(get TOMSCODING_BOARD_WALLET)" ] || put TOMSCODING_BOARD_WALLET airwallex
make up >/dev/null
echo ""
echo "────────────────────────────────────────────────────────────"

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
