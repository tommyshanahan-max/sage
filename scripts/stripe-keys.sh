#!/usr/bin/env bash
# PUTTING A SET OF STRIPE KEYS ON THE BOX, AND NOTHING ELSE ON THE SCREEN.
#
# WHY THIS EXISTS. Going live was four values edited into .env by hand, a
# rebuild, and a thing nobody would remember: a connected account minted under
# a test key does not exist under a live one, so every payout row on the board
# is a dead id the moment the keys change. Done by hand that is four steps and
# one silent failure — the payment opens and Stripe says the account is
# unknown.
#
# Nothing is echoed and nothing reaches the shell's history: the keys are read
# with `read -rs`, which is also why this is a script and not a make recipe
# with KEY=… in it.
#
#   bash scripts/stripe-keys.sh live
#   bash scripts/stripe-keys.sh test
set -euo pipefail

MODE="${1:-}"
case "$MODE" in
  live|test) ;;
  *) echo "  bash scripts/stripe-keys.sh live   (or test)"; exit 1 ;;
esac

[ -f .env ] || { echo "  No .env here. Run this from ~/tc."; exit 1; }
[ -w .env ] || { echo "  .env is not writable."; exit 1; }

# A TERMINAL TO TYPE INTO. `ssh host 'make go-live'` gets no tty, so the read
# below would fail with nothing useful on the screen. Said here, with the fix
# in it, rather than as a bash error about /dev/tty.
# `-r /dev/tty` is not the test: the permission bits say readable even where
# there is no controlling terminal to open, and the open then fails with ENXIO
# halfway through. So it is opened for real, here, before anything is written.
if ! { : < /dev/tty; } 2>/dev/null; then
  echo ""
  echo "  Nothing to type into. Run it with ssh -t:"
  echo ""
  echo "    ssh -t root@45.77.8.166 'cd ~/tc && make go-$MODE'"
  echo ""
  exit 1
fi

echo ""
if [ "$MODE" = live ]; then
  echo "  REAL MONEY. These keys make this board take live payments, with this"
  echo "  platform as merchant of record on every one of them."
else
  echo "  Sandbox keys. No real money will move."
fi
echo ""
echo "  Two values, from the Stripe dashboard in ${MODE} mode. The webhook and"
echo "  its signing secret are made here, so that is not a third thing to find."
echo ""
echo "  Nothing is shown as you paste, and nothing is written until it all"
echo "  looks right."
echo ""

# Read one secret, check its prefix, and say what arrived without showing it.
# The length is the only feedback worth giving: a half-pasted key is the
# commonest way this goes wrong and it is invisible otherwise.
ask() {
  local label="$1" want="$2" val=""
  while :; do
    # UNMISSABLE, because the one mistake this makes is pasting a key before
    # anything is asking for it. A key pasted at a shell prompt is a key in
    # the shell's history in plain text, and the prompt it was meant for
    # looked like every other line on a busy screen. So it is a banner, and
    # it names the thing wanted.
    echo "" >&2
    echo "  ────────────────────────────────────────────────" >&2
    printf '  PASTE THE %s NOW, then press Enter\n' "$(printf '%s' "$label" | tr '[:lower:]' '[:upper:]')" >&2
    echo "  Nothing will appear as you paste. That is normal." >&2
    echo "  ────────────────────────────────────────────────" >&2
    printf '  %s' "$want" >&2
    read -rs val < /dev/tty || { echo ""; echo "  Nothing read."; exit 1; }
    echo "" >&2
    val="$(printf '%s' "$val" | tr -d '[:space:]')"
    if [ -z "$val" ]; then echo "    Empty — nothing pasted. Try again." >&2; continue; fi
    case "$val" in
      "$want"*) echo "    starts $want, ${#val} characters" >&2; break ;;
      *) echo "    That does not start with $want. Wrong mode, or the wrong box on the dashboard." >&2 ;;
    esac
  done
  printf '%s' "$val"
}

SK="$(ask "Secret key" "sk_${MODE}_")"
PK="$(ask "Publishable key" "pk_${MODE}_")"

# THE THIRD VALUE IS MADE, NOT FETCHED.
#
# It was a third thing to go and get, and unlike the other two it does not
# exist until you have built the webhook by hand: find the page, type the URL,
# tick the one event, copy the string it shows once. Four things on a screen,
# which is the exact shape of instruction this box is not allowed to hand
# anybody. Stripe returns the signing secret in the reply to the create call,
# so a webhook made from here is the only kind whose secret a command can know.
#
# Made before anything is written: if Stripe refuses, .env is untouched.
# `|| true` on both, and it is not belt and braces: under `set -e` with
# pipefail a grep that matches nothing fails the assignment and kills the
# script — silently, right after the last thing it printed. A .env without a
# pinned version is ordinary and must not end the command.
DOMAIN="$(grep -E '^TOMSCODING_BOARD_DOMAIN=' .env | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
VER="$(grep -E '^BOARD_STRIPE_VERSION=' .env | tail -1 | cut -d= -f2- | tr -d '"' || true)"
[ -n "$VER" ] || VER="2026-08-26.dahlia"
WH=""
if [ -n "$DOMAIN" ]; then
  echo ""
  echo "  Making the webhook, so there is no third thing to go and find…"
  echo ""
  export BOARD_STRIPE_KEY="$SK"
  # Stripe's own sentence is the useful one when this fails; make's
  # "*** [hook-make] Error 1" under it is noise that reads like the reason.
  ERR="$(mktemp)"
  WH="$(make -s hook-make URL="https://$DOMAIN/api/hook/fee" VERSION="$VER" 2>"$ERR" || true)"
  grep -v '^make\[\?[0-9]*\]\?:' "$ERR" >&2 || true
  rm -f "$ERR"
  unset BOARD_STRIPE_KEY
else
  echo ""
  echo "  TOMSCODING_BOARD_DOMAIN is not in .env, so the webhook's address"
  echo "  cannot be worked out here."
  echo ""
fi

# Asked for by hand only when making it did not work — a wrong key, no network
# out of the box, or a Stripe account that has not been activated yet.
if [ -z "$WH" ]; then
  echo ""
  echo "  The webhook was not made. Paste its signing secret instead, from"
  echo "  Stripe's dashboard — or stop here, fix it, and run this again."
  echo ""
  WH="$(ask "Webhook signing secret" "whsec_")"
fi

# The old .env kept beside the new one, once. Not a timestamped pile: the only
# version anybody ever wants back is the one from before this command.
cp .env .env.before-stripe-keys

put() {
  local name="$1" val="$2"
  grep -v "^${name}=" .env > .env.next || true
  printf '%s=%s\n' "$name" "$val" >> .env.next
  mv .env.next .env
}
put BOARD_STRIPE_KEY "$SK"
put BOARD_STRIPE_PK "$PK"
put BOARD_DEAL_FEE_SECRET "$WH"

# Accounts v2 refuses without a pinned version, and it is the same string in
# both modes — so it is left alone if it is already there rather than asked for
# a fourth time.
if ! grep -q "^BOARD_STRIPE_VERSION=" .env; then
  printf 'BOARD_STRIPE_VERSION=%s\n' "2026-08-26.dahlia" >> .env
  echo ""
  echo "  BOARD_STRIPE_VERSION was not set. Pinned to 2026-08-26.dahlia."
fi

echo ""
echo "  Written. Bringing the box up on the new keys…"
echo ""
make up

# EVERY PAYOUT ACCOUNT ON THE BOARD IS NOW A DEAD ID, and this is the step a
# person would not know to take. Stripe's connected accounts are per-mode: an
# acct_ made under a test key does not exist under a live one. Left in place,
# the payment opens, Stripe refuses an account it has never heard of, and the
# screen says "that did not open" about something that has nothing to do with
# the payer.
NAMES="$(make -s payee-names 2>/dev/null || true)"
CLEARED=""
if [ -n "$NAMES" ]; then
  CLEARED=yes
  echo ""
  echo "  Clearing payout accounts — they were made in the other mode and"
  echo "  Stripe does not know them here. Each person sets theirs up again."
  while IFS= read -r who; do
    [ -n "$who" ] || continue
    echo "    $who"
    make -s payee WHO="$who" OFF=1 >/dev/null || echo "      could not clear $who"
  done <<< "$NAMES"
fi

echo ""
make -s pay-check

if [ "$MODE" = live ]; then
  echo "  This board now takes real money."
  if [ -n "$CLEARED" ]; then
    echo "  Every payout account was cleared, so the first thing anybody who is"
    echo "  owed money has to do is set theirs up again — with their real bank."
  fi
  echo ""
fi
