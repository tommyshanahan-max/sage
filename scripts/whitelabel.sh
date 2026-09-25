#!/usr/bin/env bash
# A PARTNER, TAKING MONEY INTO HIS OWN STRIPE, ON HIS OWN NAME, ON THIS BOX.
#
#   make whitelabel                                  where this stands, asked of Stripe
#   make whitelabel ID="ca_…"                        switch the connect button on
#   make whitelabel AT="/europay"                 a path on a name we own
#   make whitelabel DOMAIN="pay.his-name.lu"         give him his own hostname
#   make whitelabel NAME="Daniel Brokerage" INK="#16233D"    put his face on it
#   make whitelabel WHO="Daniel"                     the message to send him
#
# All of them compose, so the whole thing is one line:
#
#   make whitelabel ID="ca_…" DOMAIN="pay.his-name.lu" \
#     NAME="Daniel Brokerage" INK="#16233D" PAPER="#F7F7F5" WHO="Daniel"
#
# WHAT IT IS FOR. Daniel is a broker in Luxembourg. He wants the money screen
# as a page on his own site, the money landing in the Stripe account he
# already has, running this code on this box. Both halves already existed and
# neither was reachable without editing .env over SSH:
#
#   the Stripe half   lib/stripe.js's linkUrl/linkFinish — OAuth, so he
#                     connects the account he HAS rather than being given a
#                     new empty one. Needs BOARD_STRIPE_CLIENT_ID.
#   the name half     docker/sites/whitelabel.caddy — his hostname, this
#                     container. Needs TOMSCODING_WHITELABEL_DOMAIN and a
#                     DNS record he sets himself.
#   the face half     the money screen in his colour, with his name on it and
#                     nothing of ours — the mockup that got agreed. It is one
#                     deep colour, because that is what the mockup actually
#                     used: its gold appeared twice, both times on HIS site's
#                     chrome, never on this screen.
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
ACCT=""
AT=""
DOMAIN=""
NAME=""
INK=""
PAPER=""
WHO=""
while [ $# -gt 0 ]; do
  case "$1" in
    --id)     ID="${2:-}";     shift 2 ;;
    --acct)   ACCT="${2:-}";   shift 2 ;;
    --at)     AT="${2:-}";     shift 2 ;;
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --name)   NAME="${2:-}";   shift 2 ;;
    --ink)    INK="${2:-}";    shift 2 ;;
    --paper)  PAPER="${2:-}";  shift 2 ;;
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
case "$ID$ACCT$AT$DOMAIN$NAME$INK$PAPER$WHO" in
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

# AN acct_ ID AND NOTHING THAT LOOKS LIKE ONE. What this writes decides who
# carries a chargeback, so a typo here is somebody else's loss landing on us
# — or ours landing on them. server.js filters the list again for the same
# reason; this one can say so while somebody is still at the keyboard.
case "$ACCT" in
  "") ;;
  acct_*)
    case "$ACCT" in
      *[!a-zA-Z0-9_,]*)
        echo ""; echo "  \"$ACCT\" has something in it that is not part of an account id."; echo ""; exit 1 ;;
    esac ;;
  *)
    echo ""
    echo "  A connected account id starts with acct_. That one does not."
    echo "  It is in the Stripe dashboard under Connect -> Accounts."
    echo ""
    exit 1 ;;
esac

# A PATH BECOMES A ROUTE, so it is one slash and then plain characters.
# server.js ignores anything else outright, which would leave somebody with
# a command that reported success and an address that 404s.
#
# NOT CALLED "PATH". `make whitelabel PATH=/europay` would hand every recipe
# in the Makefile a $PATH of "/europay", and the next line of the deploy
# would not find sh. AT reads better anyway.
case "$AT" in
  "") ;;
  /[a-z0-9]*)
    case "$AT" in
      *[!a-z0-9/-]*|*/*/*)
        echo ""
        echo "  \"$AT\" is not a path this can serve."
        echo "  One slash, then lower-case letters, digits and dashes:"
        echo "    AT=\"/europay\""
        echo ""
        exit 1 ;;
    esac ;;
  *)
    echo ""
    echo "  A path starts with a slash — AT=\"/europay\", not \"$AT\"."
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

# A COLOUR THAT IS NOT A COLOUR ends up inside a <style> block on a page
# strangers open, so it is refused here as well as in server.js. Two checks
# for one value is right: this one can say "copy the hex code, it looks like
# #16233D" while somebody is still at the keyboard, and the one in server.js
# is what actually holds if a line is ever edited into .env by hand.
for pair in "INK:$INK" "PAPER:$PAPER"; do
  what="${pair%%:*}"; val="${pair#*:}"
  [ -n "$val" ] || continue
  case "$val" in
    "#"[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]) ;;
    "#"[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]) ;;
    *)
      echo ""
      echo "  $what has to be a hex colour — #16233D, hash and all."
      echo "  \"$val\" is not one, and a colour that is not a colour would"
      echo "  be ignored on the page with nothing anywhere to say why."
      echo ""
      exit 1 ;;
  esac
done

# HIS NAME GOES IN A <title> AND ON THE SCREEN. server.js escapes it, so this
# is about the screen rather than about safety: forty characters is already
# past what fits, and a newline was caught further up.
case "$NAME" in
  "") ;;
  ?????????????????????????????????????????*)
    echo ""
    echo "  That name is too long for the line it goes on. Forty characters."
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

[ -n "$ACCT" ]   && put TOMSCODING_BOARD_STRIPE_DIRECT "$ACCT"
[ -n "$AT" ]     && put TOMSCODING_WHITELABEL_PATH "$AT"
[ -n "$DOMAIN" ] && put TOMSCODING_WHITELABEL_DOMAIN "$DOMAIN"
[ -n "$NAME" ]   && put TOMSCODING_WHITELABEL_NAME "$NAME"
[ -n "$INK" ]    && put TOMSCODING_WHITELABEL_INK "$INK"
[ -n "$PAPER" ]  && put TOMSCODING_WHITELABEL_PAPER "$PAPER"

if [ -n "$ID$ACCT$AT$DOMAIN$NAME$INK$PAPER" ]; then
  echo "  Writing, and bringing the box up so it reads them…"
  make up >/dev/null
fi

# WITH NOTHING TO WRITE, THIS IS A STATUS COMMAND. It asks Stripe the state
# of play every time rather than only when something is missing: Connect can
# be switched off in the dashboard on a Tuesday by somebody who is not here,
# and a command that only looks when it already suspects trouble is a command
# that reports "fine" from memory.
if [ -z "$ID$ACCT$AT$DOMAIN$NAME$INK$PAPER" ]; then
  docker compose run --rm --no-deps -T -v "$PWD/scripts:/seed:ro" \
    --entrypoint node board /seed/connect-check.mjs || true
fi


# WHERE THE SCREEN IS, WHICH IS THE THING THAT EXISTS NOW.
#
# Stripe used to decide whether anything got printed here at all, and that
# was the wrong way round: the screen is real the moment there is an address
# for it, with or without a payment rail behind it. That is the thing to send
# somebody and look at together.
#
# The path wins over the hostname when both are set, because the path works
# today and the hostname works once somebody else has made a DNS record.
DEAL="$(get TOMSCODING_DEALIO_DOMAIN)"
[ -n "$DEAL" ] || DEAL="$(get TOMSCODING_BOARD_DOMAIN)"
AT_NOW="$(get TOMSCODING_WHITELABEL_PATH)"
DOM_NOW="$(get TOMSCODING_WHITELABEL_DOMAIN)"

SCREEN=""
if [ -n "$AT_NOW" ] && [ -n "$DEAL" ]; then
  SCREEN="https://$DEAL$AT_NOW"
elif [ -n "$DOM_NOW" ]; then
  SCREEN="https://$DOM_NOW/"
fi

echo ""
if [ -n "$SCREEN" ]; then
  echo "  The screen:  $SCREEN"
  LABEL_NOW="$(get TOMSCODING_WHITELABEL_NAME)"
  [ -n "$LABEL_NOW" ] && echo "  It says:     $LABEL_NOW"
  D="$(get TOMSCODING_BOARD_STRIPE_DIRECT)"
  if [ -n "$D" ]; then
    echo "  Charged:     directly, on $D — his name, his chargebacks"
  else
    echo "  Charged:     through us — OUR name on the statement, OUR chargebacks"
  fi
  [ -n "$(get TOMSCODING_WHITELABEL_INK)" ] \
    || echo "  No colour set yet — it is wearing ours. INK=\"#16233D\""
else
  echo "  No address for it yet:  make whitelabel AT=\"/europay\""
fi
echo ""

# AND HIS OWN NAME, IF HE IS EVER GIVEN ONE. Second, because it is the half
# that waits on somebody else.
if [ -n "$DOM_NOW" ]; then
  echo "  $DOM_NOW answers once he points it here:"
  echo ""
  echo "      $DOM_NOW    A    45.77.8.166"
  echo ""
  echo "  That record is his one job. The certificate is automatic."
  echo ""
fi

# THE STRIPE HALF, ONLY WHEN THERE IS ONE. Without a client id there is no
# link worth sending — the button behind it is greyed — and the check at the
# top of this run has already said where to get one.
[ -n "$(get TOMSCODING_BOARD_STRIPE_CLIENT_ID)" ] || exit 0
[ -n "$DEAL" ] || exit 0

NAME_FOR="${WHO:-there}"
echo "────────────────────────────────────────────────────────────"
echo ""
echo "$NAME_FOR — this is the page I mentioned. It connects the Stripe"
echo "account you already have. Nothing new to open, and don't send"
echo "me any keys — you authorise it yourself and I never see them."
echo ""
echo "https://${DOM_NOW:-$DEAL}/china/connect"
echo ""
echo "────────────────────────────────────────────────────────────"
echo ""
echo "Everything between the rules is the message."
echo ""
