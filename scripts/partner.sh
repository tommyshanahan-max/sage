#!/usr/bin/env bash
# A PARTNER, TAKING MONEY INTO HIS OWN STRIPE, ON HIS OWN NAME, ON THIS BOX.
#
#   make partner                                  where this stands, asked of Stripe
#   make partner ID="ca_…"                        switch the connect button on
#   make partner DOMAIN="pay.his-name.lu"         give him his own hostname
#   make partner WHO="Daniel"                     the message to send him
#
# All of them compose, so the whole thing is one line:
#
#   make partner ID="ca_…" DOMAIN="pay.his-name.lu" WHO="Daniel"
#
# WHAT IT IS FOR. Daniel is a broker in Luxembourg. He wants the money screen
# as a page on his own site, the money landing in the Stripe account he
# already has, running this code on this box. Both halves already existed and
# neither was reachable without editing .env over SSH:
#
#   the Stripe half   lib/stripe.js's linkUrl/linkFinish — OAuth, so he
#                     connects the account he HAS rather than being given a
#                     new empty one. Needs BOARD_STRIPE_CLIENT_ID.
#   the name half     docker/sites/board-partner.caddy — his hostname, this
#                     container. Needs TOMSCODING_BOARD_PARTNER_DOMAIN and a
#                     DNS record he sets himself.
#
# HE NEVER SENDS A SECRET KEY, and that is the point rather than a nicety.
# One BOARD_STRIPE_KEY serves this whole container — the board, both its
# names and Dealio — so a partner's key here would take every payment on the
# box, his and ours alike. OAuth gives him the same outcome (his account, his
# balance, his bank) while the fee comes off the top automatically, and no
# secret ever travels through a chat window.
#
# ONLY FROM THE COMMAND LINE. make imports the environment as its own
# variables, and a box with an ID already in its environment would otherwise
# have that written into .env by a command that named no id at all. The
# Makefile passes $(origin) through, the same as airwallex-keys.
set -euo pipefail

ID=""
DOMAIN=""
WHO=""
while [ $# -gt 0 ]; do
  case "$1" in
    --id)     ID="${2:-}";     shift 2 ;;
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --who)    WHO="${2:-}";    shift 2 ;;
    *) echo "  Unknown argument: $1"; exit 1 ;;
  esac
done

[ -f .env ] || { echo "  No .env here. Run this from ~/tc."; exit 1; }

put() {
  grep -v "^${1}=" .env > .env.next || true
  [ -n "${2:-}" ] && printf '%s=%s\n' "$1" "$2" >> .env.next
  mv .env.next .env
}
get() { grep -E "^${1}=" .env | tail -1 | cut -d= -f2- | tr -d '"' || true; }

# A VALUE WITH A NEWLINE IN IT is what a copy out of a dashboard looks like
# when the selection took the line break too. Caught here, where it can be
# said plainly, rather than as a greyed button with no explanation.
case "$ID$DOMAIN$WHO" in
  *$'\n'*|*$'\r'*) echo "  That has a line break in it. Copy it again without the newline."; exit 1 ;;
esac

# THE PLACEHOLDER THAT GOT PASTED. A command handed over with "…" in it comes
# back run exactly as written more often than not, and a placeholder written
# into .env is worse than nothing: the file looks configured and the failure
# arrives later, somewhere else.
case "$ID" in
  "") ;;
  *…*|*"ca_…"*|*"xxx"*|*"XXX"*|*"your-"*)
    echo ""
    echo "  That is the placeholder, not the client id."
    echo "  It is on this page, as \"ca_…\":"
    echo "    https://dashboard.stripe.com/settings/connect/onboarding-options/oauth"
    echo ""
    exit 1 ;;
  ca_*) ;;
  *)
    echo ""
    echo "  A Connect client id starts with ca_. That one does not."
    echo "  An sk_ or pk_ is a different thing and must not go in here."
    echo ""
    exit 1 ;;
esac

case "$DOMAIN" in
  ""|*.*) ;;
  *) echo ""; echo "  \"$DOMAIN\" is not a hostname."; echo ""; exit 1 ;;
esac
# A HOSTNAME WITH A SCHEME ON IT binds a site block Caddy cannot serve, and
# the failure takes every other site on this box down with it. Said here.
case "$DOMAIN" in
  http://*|https://*|*/*)
    echo ""
    echo "  Just the name — pay.his-name.lu — with no https:// and no slash."
    echo ""
    exit 1 ;;
esac

# WRITTEN ONLY AFTER STRIPE HAS BEEN ASKED. A client id cannot be proved by
# an API call — it is only ever used in a redirect URL, and the authorise
# screen is the first thing that judges it. What CAN be asked, and is the
# thing actually in the way, is whether Connect is switched on for this
# platform at all. So the check runs first, against the box's own key, and
# nothing is written if the answer is no.
if [ -n "$ID" ]; then
  echo ""
  echo "  Asking Stripe whether this account is a Connect platform, before"
  echo "  writing anything:"
  if ! docker compose run --rm --no-deps -T -v "$PWD/scripts:/seed:ro" \
       -e BOARD_STRIPE_CLIENT_ID="$ID" \
       --entrypoint node board /seed/connect-check.mjs; then
    echo ""
    echo "  NOTHING was written. Whatever this box had, it still has."
    echo ""
    exit 1
  fi
  put TOMSCODING_BOARD_STRIPE_CLIENT_ID "$ID"
fi

[ -n "$DOMAIN" ] && put TOMSCODING_BOARD_PARTNER_DOMAIN "$DOMAIN"

if [ -n "$ID" ] || [ -n "$DOMAIN" ]; then
  echo "  Writing, and bringing the box up so it reads them…"
  make up >/dev/null
fi

# WITH NOTHING TO WRITE, THIS IS A STATUS COMMAND. It asks Stripe the state
# of play every time rather than only when something is missing: Connect can
# be switched off in the dashboard on a Tuesday by somebody who is not here,
# and a command that only looks when it already suspects trouble is a command
# that reports "fine" from memory.
if [ -z "$ID" ] && [ -z "$DOMAIN" ]; then
  docker compose run --rm --no-deps -T -v "$PWD/scripts:/seed:ro" \
    --entrypoint node board /seed/connect-check.mjs || true
fi

# NOTHING TO SAY YET is its own answer, and a better one than a message
# nobody can act on. The check above has already printed what is missing and
# where to get it, so this just stops.
[ -n "$(get TOMSCODING_BOARD_STRIPE_CLIENT_ID)" ] || exit 0

# WHICH NAME TO SEND HIM TO. His own if he has one, the payments name if not,
# and the board's name as the last resort — every one of them is this same
# container, and the board builds what it prints from the Host header, so the
# link he opens is the name he stays on.
HOST="$(get TOMSCODING_BOARD_PARTNER_DOMAIN)"
[ -n "$HOST" ] || HOST="$(get TOMSCODING_DEALIO_DOMAIN)"
[ -n "$HOST" ] || HOST="$(get TOMSCODING_BOARD_DOMAIN)"
if [ -z "$HOST" ]; then
  echo ""
  echo "  This box has no public hostname set, so there is no link to send."
  echo ""
  exit 1
fi

NAME="${WHO:-there}"
echo ""
echo "────────────────────────────────────────────────────────────"
echo ""
echo "$NAME — this is the page I mentioned. It connects the Stripe"
echo "account you already have. Nothing new to open, and don't send"
echo "me any keys — you authorise it yourself and I never see them."
echo ""
echo "https://$HOST/china/connect"
echo ""
echo "────────────────────────────────────────────────────────────"
echo ""
echo "Everything between the rules is the message."
echo ""
if [ -n "$(get TOMSCODING_BOARD_PARTNER_DOMAIN)" ]; then
  echo "His name is live here once he points it at this box:"
  echo ""
  echo "    $HOST    A    45.77.8.166"
  echo ""
  echo "That DNS record is his one job. The certificate is automatic."
else
  echo "He is on our name. To give him his own:"
  echo ""
  echo "    make partner DOMAIN=\"pay.his-name.lu\""
  echo ""
fi
