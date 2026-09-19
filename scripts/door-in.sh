#!/usr/bin/env bash
# THE DOOR WITH THE TYPING TAKEN OUT, on and off in one command.
#
#   make door-in          turn it on
#   make door-in OFF=1    turn it off
#
# WHY IT EXISTS. The code step at the door is the part that kept breaking —
# typed wrong, landed on the wrong page, spent, or simply six characters read
# off a screen by somebody for whom reading six characters off a screen is the
# expensive part. With this on, the door keeps its landing page and loses the
# boxes: one button, and it opens.
#
# WHAT IT IS WORTH TO A STRANGER. Everything. While it is on, anybody who
# opens the door can tap the button and be whoever the standing code names.
# Not guess a code — tap a button. It is a way in with no wall at all, and it
# is meant for showing somebody the product, not for leaving on.
#
# It needs the standing code set first (make sign-in-code), so it cannot be
# switched on by accident on a box that never had one.
set -euo pipefail

[ -f .env ] || { echo "  No .env here. Run this from ~/tc."; exit 1; }
[ -w .env ] || { echo "  .env is not writable."; exit 1; }

# put NAME VALUE — last one wins, empty removes the line. Written to a sibling
# and moved into place, the same shape as scripts/sign-in-code.sh.
put() {
  grep -v "^${1}=" .env > .env.next || true
  [ -n "${2:-}" ] && printf '%s=%s\n' "$1" "$2" >> .env.next
  mv .env.next .env
}

if [ -n "${OFF:-}" ]; then
  put TOMSCODING_BOARD_DOOR_IN ""
  echo ""
  echo "  Bringing the board up so the door closes again…"
  make up >/dev/null
  echo ""
  echo "  The door asks for the code again."
  echo ""
  exit 0
fi

WHO="$(grep -E '^TOMSCODING_BOARD_BACK_WHO=' .env | tail -1 | cut -d= -f2- | tr -d '"' || true)"
CODE="$(grep -E '^TOMSCODING_BOARD_BACK_CODE=' .env | tail -1 | cut -d= -f2- | tr -d '"' || true)"
if [ -z "$WHO" ] || [ -z "$CODE" ]; then
  echo ""
  echo "  There is no standing code on this box yet, and the button opens as"
  echo "  whoever that names. Set one first:"
  echo ""
  echo '    make sign-in-code CODE="......" WHO="Tom"'
  echo ""
  exit 1
fi

put TOMSCODING_BOARD_DOOR_IN 1

DOMAIN="$(grep -E '^TOMSCODING_BOARD_DOMAIN=' .env | tail -1 | cut -d= -f2- | tr -d '"' || true)"
DOMAIN="${DOMAIN:-thexchange.app}"

echo ""
echo "  Bringing the board up so the door reads it…"
make up >/dev/null
echo ""
echo "────────────────────────────────────────────────────────────"
echo ""
echo "  https://${DOMAIN}/enter?next=/dealio"
echo ""
echo "  One button. No code to type. It opens as ${WHO}."
echo ""
echo "────────────────────────────────────────────────────────────"
echo ""
echo "  ANYBODY who opens that door can tap it and be ${WHO}."
echo "  Take it off with: make door-in OFF=1"
echo ""
