#!/usr/bin/env bash
# ONE SIGN-IN CODE THAT KEEPS WORKING.
#
# WHY THIS EXISTS. `make back` mints six random characters, prints them, and
# spends them the moment they are used. That is right for a member who lost
# their phone — a code that keeps working is a code that ends up in a group
# chat — and it is wrong for the person who runs the board, who signs in on a
# fresh browser often enough that running a command and reading six random
# characters off a terminal is a weekly chore. On a screen that is hard to
# read, the reading is the expensive half.
#
# So: one code, chosen rather than minted, that never spends and never
# expires. It puts one named person's page onto whatever browser types it.
#
#   make sign-in-code CODE="XXXXXX" WHO="Tom"
#
# IT IS A PASSWORD. Not a code — a password, on a public door, that never
# changes. Whoever types it becomes that person: their requests, the account
# their money lands in, and every member they can see. The door allows five
# wrong answers an hour per browser, which is the whole wall, and six
# characters somebody would try first are not behind that wall at all, because
# the first guess is inside the five. Pick six nobody would type on a hunch
# and it is as strong as the rest of the door. Pick a word and it is a door
# left open.
#
# Letters and digits, six of them, and no I O 0 1 — those four get read back
# wrong, which is why every other code on this board avoids them too.
#
# TO TAKE IT AWAY: make sign-in-code OFF=1
set -euo pipefail

[ -f .env ] || { echo "  No .env here. Run this from ~/tc."; exit 1; }
[ -w .env ] || { echo "  .env is not writable."; exit 1; }

# put NAME VALUE — last one wins, and an empty value removes the line. Written
# to a sibling and moved into place, so a full disk leaves the old file intact
# rather than half a new one. Same shape as scripts/stripe-names.sh.
put() {
  grep -v "^${1}=" .env > .env.next || true
  [ -n "${2:-}" ] && printf '%s=%s\n' "$1" "$2" >> .env.next
  mv .env.next .env
}

if [ -n "${OFF:-}" ]; then
  put TOMSCODING_BOARD_BACK_CODE ""
  put TOMSCODING_BOARD_BACK_WHO ""
  echo ""
  echo "  Bringing the board up so it forgets the code…"
  make up >/dev/null
  echo ""
  echo "  The standing code is gone. make back still works."
  echo ""
  exit 0
fi

CODE="$(printf '%s' "${CODE:-}" | tr '[:lower:]' '[:upper:]' | tr -cd 'A-Z0-9')"
WHO="${WHO:-}"

[ -n "$CODE" ] || { echo 'make sign-in-code CODE="XXXXXX" WHO="Tom"'; exit 1; }
[ -n "$WHO" ]  || { echo 'make sign-in-code CODE="XXXXXX" WHO="Tom"'; exit 1; }

[ "${#CODE}" -eq 6 ] || {
  echo "  Six characters, and that one is ${#CODE}."; exit 1; }

# The four that get read back wrong. Refused rather than quietly swapped: a
# code stored as something other than what was typed is a code that does not
# work and never says why.
case "$CODE" in
  *I*|*O*|*0*|*1*)
    echo "  No I, O, 0 or 1 — they get read back wrong. Pick six others."
    exit 1;;
esac

put TOMSCODING_BOARD_BACK_CODE "$CODE"
put TOMSCODING_BOARD_BACK_WHO  "$WHO"

# The public address, off .env, for the line that gets read back. Same source
# as scripts/back.mjs uses — the board answers on its own hostname inside the
# compose network and that is not a name anybody can type.
DOMAIN="$(grep -E '^TOMSCODING_BOARD_DOMAIN=' .env | tail -1 | cut -d= -f2- | tr -d '"' || true)"
DOMAIN="${DOMAIN:-thexchange.app}"

echo ""
echo "  Bringing the board up so it reads the new setting…"
make up >/dev/null
echo ""
echo "────────────────────────────────────────────────────────────"
echo ""
echo "  https://${DOMAIN}/enter?next=/dealio"
echo "  ${CODE}"
echo ""
echo "  Opens ${WHO}'s page on whatever browser types it."
echo "  Works every time. Nothing to run again."
echo ""
echo "────────────────────────────────────────────────────────────"
echo ""
echo "  Anybody who guesses those six characters becomes ${WHO}."
echo "  Change it with this same command. Take it away with OFF=1."
echo ""
