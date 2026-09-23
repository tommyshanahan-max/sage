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

# The same, for a value that is allowed to be missing. Enter skips it.
ask_maybe() {
  local label="$1" want="$2" val=""
  while :; do
    echo "" >&2
    echo "  ────────────────────────────────────────────────" >&2
    printf '  PASTE THE %s, or press Enter to skip\n' "$(printf '%s' "$label" | tr '[:lower:]' '[:upper:]')" >&2
    echo "  Nothing will appear as you paste. That is normal." >&2
    echo "  ────────────────────────────────────────────────" >&2
    printf '  %s' "$want" >&2
    read -rs val < /dev/tty || { echo ""; echo "  Nothing read."; exit 1; }
    echo "" >&2
    val="$(printf '%s' "$val" | tr -d '[:space:]')"
    if [ -z "$val" ]; then echo "    Skipped." >&2; break; fi
    case "$val" in
      "$want"*) echo "    starts $want, ${#val} characters" >&2; break ;;
      *) echo "    That does not start with $want. Enter to skip." >&2 ;;
    esac
  done
  printf '%s' "$val"
}

SK="$(ask "Secret key" "sk_${MODE}_")"
PK="$(ask "Publishable key" "pk_${MODE}_")"

# THE DOOR FOR SOMEBODY WHO ALREADY HAS STRIPE, WHICH IS A THIRD VALUE AND
# WAS A HAND EDIT.
#
# "Connect my Stripe" on /china/connect hands a merchant to Stripe's OAuth and
# takes back the id of THEIR account, rather than opening them an empty second
# one. It cannot work without the platform's client id, and without it the
# screen says so and puts the other route first — so the button that is meant
# to be the default has been inert since it was written, waiting on a value
# that lived in the dashboard and nowhere else.
#
# ASKED HERE BECAUSE IT IS PER-MODE, exactly like the keys and the payout
# accounts below. Stripe issues one client id for live and another for test,
# and a live ca_ left behind under test keys walks merchants into the wrong
# mode with no error anywhere. So skipping it REMOVES it: the door turns
# itself off, which is a screen that says the truth, instead of a button that
# quietly sends people to the other account.
#
# NOT A SECRET, unlike the other two — it travels in the query string of every
# OAuth link. It is read the same way anyway; a value nobody can see pasted is
# a value nobody pastes into the wrong window.
CID="$(ask_maybe "Connect client id (${MODE} mode)" "ca_")"

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
VER="$(grep -E '^TOMSCODING_BOARD_STRIPE_VERSION=' .env | tail -1 | cut -d= -f2- | tr -d '"' || true)"
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

# THE NAMES IN .env ARE NOT THE NAMES THE BOARD READS, and this cost an
# afternoon. docker-compose.yml maps
#   BOARD_STRIPE_KEY: ${TOMSCODING_BOARD_STRIPE_KEY:-}
# so the name on the container is BOARD_STRIPE_KEY and the name in .env is
# TOMSCODING_BOARD_STRIPE_KEY. This script wrote the container name. Compose
# never looked at it, the old sandbox key under the real name stayed in force,
# and every screen agreed: go-live said "this board now takes real money",
# .env plainly contained sk_live_, and pay-check said test. All three were
# telling the truth about different things.
#
# `:-` in that mapping is why it failed silently rather than loudly: an unset
# variable is an empty string, not an error.
put() {
  local name="$1" val="$2"
  grep -v "^${name}=" .env > .env.next || true
  printf '%s=%s\n' "$name" "$val" >> .env.next
  mv .env.next .env
}
put TOMSCODING_BOARD_STRIPE_KEY "$SK"
put TOMSCODING_BOARD_STRIPE_PK "$PK"
put TOMSCODING_BOARD_DEAL_FEE_SECRET "$WH"
if [ -n "$CID" ]; then
  put TOMSCODING_BOARD_STRIPE_CLIENT_ID "$CID"
else
  # See the note by CID. Left in place it would belong to the other mode.
  if grep -q "^TOMSCODING_BOARD_STRIPE_CLIENT_ID=" .env; then
    grep -v "^TOMSCODING_BOARD_STRIPE_CLIENT_ID=" .env > .env.next || true
    mv .env.next .env
    echo "  No client id given — removed the old one. \"Connect my Stripe\" is off."
  fi
fi

# The wrong names, if an earlier run of this script left them. They are dead
# lines that nothing reads — and a live secret key sitting in a file under a
# name nobody will ever grep for is the worst kind of dead line.
for dead in BOARD_STRIPE_KEY BOARD_STRIPE_PK BOARD_DEAL_FEE_SECRET BOARD_STRIPE_VERSION; do
  if grep -q "^${dead}=" .env; then
    grep -v "^${dead}=" .env > .env.next || true
    mv .env.next .env
    echo "  Removed ${dead} from .env — nothing reads that name."
  fi
done

# Accounts v2 refuses without a pinned version, and it is the same string in
# both modes — so it is left alone if it is already there rather than asked for
# a fourth time.
if ! grep -q "^TOMSCODING_BOARD_STRIPE_VERSION=" .env; then
  printf 'TOMSCODING_BOARD_STRIPE_VERSION=%s\n' "2026-08-26.dahlia" >> .env
  echo ""
  echo "  TOMSCODING_BOARD_STRIPE_VERSION was not set. Pinned to 2026-08-26.dahlia."
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

# READ BACK WHAT IS ACTUALLY THERE, under the name compose actually reads,
# and print the prefix. The failure this is here to prevent was not a wrong
# key — it was three screens each truthfully reporting a different thing, and
# no single line anywhere saying what the board would use.
echo ""
LANDED="$(grep -E '^TOMSCODING_BOARD_STRIPE_KEY=sk_[a-z]+' .env | tail -1 \
  | sed 's/^TOMSCODING_BOARD_STRIPE_KEY=\(sk_[a-z]*\).*/\1/' || true)"
if [ "$LANDED" = "sk_${MODE}_" ] || [ "$LANDED" = "sk_${MODE}" ]; then
  echo "  .env now holds a ${MODE} key under the name compose reads."
else
  echo "  WARNING: .env does not hold a ${MODE} key under the name compose"
  echo "  reads. Nothing below can be trusted."
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
