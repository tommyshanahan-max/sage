#!/usr/bin/env bash
# ASK ABOUT AN ACCOUNT THIS BOX DOES NOT HOLD.
#
# WHY THIS EXISTS. `make wallets` reads BOARD_STRIPE_KEY out of the container,
# which is one account's key. The approval that is actually being waited on
# sits on another account, and on 23 Sep this was answered three times about a
# SANDBOX while every reading of it was about the live account — including a
# line in NOW.md saying Stripe had withheld the wallets, about an account
# nobody had asked.
#
# So: paste the key of whichever account you mean, get that account's answer,
# and nothing is kept. Same script, same output, one different key.
#
# READ, NOT PASSED. `make wallets KEY=sk_...` would put a key in the shell's
# history and in `ps` for the length of the call. read -rs puts it in neither,
# and that is the whole reason this is a file and not another line of make.
#
#   bash scripts/wallets-ask.sh
set -euo pipefail

# ssh without -t gets no terminal, and read would then fail with a bash error
# about /dev/tty rather than the fix. Opened for real: the permission bits say
# readable even where there is no controlling terminal, and the open fails
# with ENXIO halfway through.
if ! { : < /dev/tty; } 2>/dev/null; then
  echo ""
  echo "  Nothing to type into. Run it with ssh -t:"
  echo ""
  echo "    ssh -t root@45.77.8.166 'cd ~/tc && make wallets ASK=1'"
  echo ""
  exit 1
fi

echo ""
echo "  ────────────────────────────────────────────────"
echo "  PASTE A STRIPE KEY (sk_ or a read-only rk_), then Enter"
echo "  Nothing will appear as you paste. That is normal."
echo "  ────────────────────────────────────────────────"
printf '  sk_'
read -rs KEY < /dev/tty || { echo ""; echo "  Nothing read."; exit 1; }
echo ""
KEY="$(printf '%s' "$KEY" | tr -d '[:space:]')"
[ -n "$KEY" ] || { echo "  Empty — nothing pasted."; exit 1; }
# rk_ AS WELL AS sk_. This command only reads — GET /v1/account and GET
# /v1/payment_method_configurations — so a restricted read-only key is the
# right key for it, and refusing one would push somebody towards a full secret
# key for a question that cannot change anything.
case "$KEY" in
  sk_live_*|sk_test_*|rk_live_*|rk_test_*) ;;
  *) echo "  That does not start with sk_ or rk_, live or test."; exit 1 ;;
esac

# Through the environment rather than argv, for the same reason as hook-make.
# --no-deps so this cannot start anything, and no volume but scripts/.
export BOARD_STRIPE_KEY="$KEY"
docker compose run --rm --no-deps -T \
  -e BOARD_STRIPE_KEY \
  -v "$PWD/scripts:/seed:ro" --entrypoint node board /seed/stripe-methods.mjs
