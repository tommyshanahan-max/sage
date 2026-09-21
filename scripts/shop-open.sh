#!/usr/bin/env bash
# THE SHOP FRONT, OPENED IN ONE LINE.
#
#   make shop-open WHO="Tom" NAME="澳洲爸爸汤姆"
#   make shop-open WHO="Tom" NAME="澳洲爸爸汤姆" WECHAT="tomshanahan"
#   make shop-open WHO="Tom" NAME="澳洲爸爸汤姆" DOMAIN=aozhoubaba.com
#
# Everything the shop needs already existed and none of it was one command.
# Opening it was: edit two lines in .env over SSH, bring the stack up, hope the
# hostname did not collide with another site block, then run shop-brand, then
# remember shop-contact, then find out from a browser whether DNS had ever been
# pointed at this box. Six steps, four of which fail silently, on a screen that
# is hard to read. So it is one.
#
# PROVED FIRST, WRITTEN SECOND — the lesson off airwallex-keys.sh, which used
# to write the pair into .env and test it afterwards, so a bad pair had already
# overwritten the working one by the time it failed. Nothing here touches .env
# until the handle, the DNS and the site blocks have all said yes.
set -euo pipefail

WHO=""; NAME=""; DOMAIN=""; WECHAT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --who)    WHO="${2:-}";    shift 2 ;;
    --name)   NAME="${2:-}";   shift 2 ;;
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --wechat) WECHAT="${2:-}"; shift 2 ;;
    *) echo "  Unknown argument: $1"; exit 1 ;;
  esac
done

# aozhoubaba.com is the shop's name and has been since it was chosen, so it is
# the default rather than a thing to retype. DOMAIN is there for the day it is
# not.
[ -n "$DOMAIN" ] || DOMAIN="aozhoubaba.com"

usage() {
  echo ""
  echo '  make shop-open WHO="Tom" NAME="澳洲爸爸汤姆" [WECHAT="tomshanahan"] [DOMAIN=aozhoubaba.com]'
  echo ""
  echo "  WHO is the handle on the board, which is what /shop/ matches on."
  echo "  \`make who\` is the only place that knows it."
  echo ""
  echo "  NAME is the shop's name as a buyer reads it, so it is Chinese."
  echo "  A handle and a grey circle is not a shop."
  echo ""
}
[ -n "$WHO" ] || { usage; exit 1; }

# THE PLACEHOLDER THAT GOT PASTED. A command handed over with "…" in it comes
# back run exactly as written more often than not, and a placeholder written
# into .env looks configured while failing somewhere else later.
case "$WHO$NAME$DOMAIN$WECHAT" in
  *…*|*"your-"*|*"example.com"*|*"xxx"*|*"XXX"*)
    echo ""; echo "  That is the placeholder, not a real value."; echo ""; exit 1 ;;
esac

[ -f .env ] || { echo "  No .env here. Run this from ~/tc."; exit 1; }
[ -w .env ] || { echo "  .env is not writable."; exit 1; }

get() { grep -E "^${1}=" .env | tail -1 | cut -d= -f2- | tr -d '"' || true; }

echo ""
echo "  Opening $DOMAIN as $WHO's shop front."
echo ""

# ── 1. THE HANDLE IS REAL ────────────────────────────────────────────────────
# A wrong handle fails with "Not on this board" and looks exactly like the
# person being missing when they are not — CLAUDE.md says so about every WHO on
# the board. Asked here, before anything is written, so the answer costs
# nothing.
echo "  ── Is $WHO on this board?"
if ! make shop-check WHO="$WHO" >/dev/null 2>&1; then
  echo ""
  echo "  \"$WHO\" is not a handle on this board, so nothing was written."
  echo "  \`make who\` lists them. On the board WHO is the handle the person"
  echo "  chose, which is usually a first name and is not always."
  echo ""
  exit 1
fi
echo "     yes"

# ── 2. DNS POINTS AT THIS BOX ────────────────────────────────────────────────
# Caddy asks Let's Encrypt for a certificate the moment the hostname is
# configured, and a name that does not resolve here fails that challenge over
# and over in the background. Nothing says so on the terminal that ran the
# deploy: the site is simply unreachable, which reads as the deploy having
# failed. .app and .com both sit behind HSTS in enough browsers that there is
# no clicking through it either.
HERE="$(curl -s -m 5 https://api.ipify.org 2>/dev/null || true)"
# getent is not on every image, and its absence would read as "the domain does
# not resolve" — which would send somebody to their registrar to fix a record
# that is already correct. Python answers the same question and is here anyway,
# since check-sites.py runs on every `make up`.
THERE="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ' \
  || python3 -c "import socket,sys
try: print(' '.join(sorted({a[4][0] for a in socket.getaddrinfo(sys.argv[1],80,socket.AF_INET)})))
except Exception: pass" "$DOMAIN" 2>/dev/null || true)"
if [ -z "$HERE" ]; then
  echo "  ── DNS: could not find this box's own address, so not checked."
elif [ -z "$THERE" ]; then
  echo ""
  echo "  $DOMAIN does not resolve to anything yet, so nothing was written."
  echo ""
  echo "  At the registrar, one A record:"
  echo ""
  echo "      @    A    $HERE"
  echo ""
  echo "  Then run this again. DNS usually lands within a few minutes."
  echo ""
  exit 1
elif ! echo " $THERE " | grep -q " $HERE "; then
  echo ""
  echo "  $DOMAIN points at $THERE, and this box is $HERE."
  echo "  Nothing was written — Caddy would ask for a certificate it cannot get."
  echo ""
  echo "  At the registrar, change the A record to:"
  echo ""
  echo "      @    A    $HERE"
  echo ""
  exit 1
else
  echo "  ── DNS: $DOMAIN → $HERE, this box."
fi

# ── 3. THE SITE BLOCKS DO NOT COLLIDE ────────────────────────────────────────
# Two Caddy site blocks sharing an address is a startup failure, not a warning,
# and it takes every other site on this box down with it — shop.caddy says so
# at length. check-sites.py resolves every block the way Caddy does. Run
# against a candidate file so a collision costs nothing: .env is not touched
# until it passes.
echo "  ── Do the hostnames collide?"
grep -v -E '^(TOMSCODING_SHOP_DOMAIN|TOMSCODING_SHOP_HANDLE)=' .env > .env.next
printf 'TOMSCODING_SHOP_DOMAIN=%s\n' "$DOMAIN" >> .env.next
printf 'TOMSCODING_SHOP_HANDLE=%s\n' "$WHO"    >> .env.next
if ! python3 scripts/check-sites.py .env.next; then
  rm -f .env.next
  echo ""
  echo "  That hostname clashes with another site block, so nothing was written."
  echo ""
  exit 1
fi
echo "     no"

mv .env.next .env
echo ""
echo "  Written. Bringing everything up…"
make up >/dev/null

# ── 4. DRESS IT ──────────────────────────────────────────────────────────────
# A shop that is merely reachable is a handle and a grey circle. The name and
# the way to reach her are the difference between an address that works and a
# shop, and both are already one command each — so they are inside this one.
if [ -n "$NAME" ]; then
  echo ""
  make shop-brand WHO="$WHO" NAME="$NAME" >/dev/null
  echo "  Named: $NAME"
fi
if [ -n "$WECHAT" ]; then
  make shop-contact WHO="$WHO" WECHAT="$WECHAT" >/dev/null
  echo "  联系店家: $WECHAT"
fi

echo ""
echo "────────────────────────────────────────────────────────────"
echo ""
echo "  Open on a phone:"
echo ""
echo "      https://$DOMAIN"
echo ""
echo "  Her own link, and every other representative's:"
echo ""
echo "      https://$DOMAIN/shop/$WHO"
echo ""
make shop-check WHO="$WHO"

# WHAT IS STILL A GREY BOX, said here rather than found in a browser. Both are
# pictures, both are already one line, and neither is worth a second visit to
# this file to look up. Not guarded on anything: `set -e` plus a trailing test
# that can be false is a script that exits 1 on the happy path, and the value
# it would have tested was written twenty lines above.
cat <<TIP
  The two pictures, if they are still blank above, from the Mac:

      ssh root@$HERE 'cd ~/tc && make shop-banner WHO="$WHO"' < ~/Desktop/shop.png
      ssh root@$HERE 'cd ~/tc && make shop-contact WHO="$WHO" QR=<url>'

TIP
