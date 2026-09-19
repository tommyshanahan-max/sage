#!/usr/bin/env bash
# MOVE STRIPE'S VALUES ONTO THE NAMES COMPOSE ACTUALLY READS.
#
# WHY THIS EXISTS. An earlier make go-live wrote the container-internal names
# into .env — BOARD_STRIPE_KEY rather than TOMSCODING_BOARD_STRIPE_KEY. The
# mapping in docker-compose.yml is
#
#   BOARD_STRIPE_KEY: ${TOMSCODING_BOARD_STRIPE_KEY:-}
#
# so the live key sat in the file under a name nothing looks at while the old
# sandbox key kept the name that matters. .env plainly contained sk_live_,
# go-live said the board took real money, and pay-check said test. All three
# were telling the truth about different things.
#
# go-live writes the right names now. This is for a box that already has the
# wrong ones on it, and it is safe to run when there is nothing to do: it says
# so and changes nothing.
#
# IT NEVER PRINTS A KEY. Line numbers and the first characters of a prefix,
# which is what tells you the mode and nothing else.
set -euo pipefail

[ -f .env ] || { echo "  No .env here. Run this from ~/tc."; exit 1; }
[ -w .env ] || { echo "  .env is not writable."; exit 1; }

NAMES="STRIPE_KEY STRIPE_PK DEAL_FEE_SECRET STRIPE_VERSION"
moved=0

for n in $NAMES; do
  # The value under the wrong name, if there is one. tail -1 because a file
  # that has collected duplicates should end up with whatever was written last.
  v="$(grep "^BOARD_${n}=" .env | tail -1 | cut -d= -f2- || true)"
  [ -n "$v" ] || continue
  # Both names out, then the right one back in with the value. Written to a
  # sibling and moved into place, so a full disk leaves the old file intact
  # rather than half a new one.
  grep -v "^TOMSCODING_BOARD_${n}=" .env | grep -v "^BOARD_${n}=" > .env.next || true
  printf 'TOMSCODING_BOARD_%s=%s\n' "$n" "$v" >> .env.next
  mv .env.next .env
  echo "  ${n}: moved onto TOMSCODING_BOARD_${n}"
  moved=$((moved + 1))
done

if [ "$moved" -eq 0 ]; then
  echo ""
  echo "  Nothing to move — .env already uses the names compose reads."
  echo ""
  exit 0
fi

echo ""
grep -n "STRIPE_KEY=" .env | cut -c1-45
echo ""
echo "  Bringing the box up so the containers read it…"
echo ""
make up
echo ""
make -s pay-check
