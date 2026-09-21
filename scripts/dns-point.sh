#!/usr/bin/env bash
# POINT A DOMAIN AT THIS BOX, IN ONE LINE.
#
#   make dns-point DOMAIN=aozhoubaba.com
#   make dns-point DOMAIN=aozhoubaba.com KEY="pk1_…" SECRET="sk1_…"
#
# THIS HAS NOW BLOCKED TWO THINGS IN ONE DAY. A domain bought at Porkbun comes
# with an ALIAS and a wildcard CNAME pointing at their parking page, and until
# both are gone the name resolves to a holding server no matter what else is
# deployed. Finding that out means reading a records table on a screen that is
# hard to read, working out which two of seven rows are the problem, deleting
# them in the right order — the apex ALIAS has to go before an A record can
# take its place — and adding two more.
#
# So it is a command. It keeps the mail records and the SPF line, because
# taking those out silently stops mail arriving and nobody connects the two.
#
# THE KEYS GO IN ONCE. Porkbun: Account → API Access, switch it on FOR THE
# DOMAIN (a per-domain toggle, and the usual reason a correct key still gets
# refused), then generate a pair. Passed here they are written to .env, and
# every domain after this one is `make dns-point DOMAIN=…` on its own.
set -euo pipefail

DOMAIN=""; IP=""; KEY=""; SECRET=""
while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --ip)     IP="${2:-}";     shift 2 ;;
    --key)    KEY="${2:-}";    shift 2 ;;
    --secret) SECRET="${2:-}"; shift 2 ;;
    *) echo "  Unknown argument: $1"; exit 1 ;;
  esac
done

usage() {
  echo ""
  echo '  make dns-point DOMAIN=aozhoubaba.com [KEY="pk1_…" SECRET="sk1_…"] [IP=…]'
  echo ""
  echo "  The keys are needed once. Porkbun → Account → API Access:"
  echo "  switch API access ON FOR THAT DOMAIN, then generate a pair."
  echo "  After that this box remembers them."
  echo ""
}
[ -n "$DOMAIN" ] || { usage; exit 1; }
case "$DOMAIN$KEY$SECRET" in *…*|*"your-"*|*"xxx"*) echo "  That is the placeholder, not a real value."; exit 1 ;; esac

[ -f .env ] || { echo "  No .env here. Run this from ~/tc."; exit 1; }
get() { grep -E "^${1}=" .env | tail -1 | cut -d= -f2- | tr -d '"' || true; }
put() { grep -v "^${1}=" .env > .env.next || true; [ -n "${2:-}" ] && printf '%s=%s\n' "$1" "$2" >> .env.next; mv .env.next .env; }

[ -n "$KEY" ]    || KEY="$(get TOMSCODING_PORKBUN_KEY)"
[ -n "$SECRET" ] || SECRET="$(get TOMSCODING_PORKBUN_SECRET)"
[ -n "$KEY" ] && [ -n "$SECRET" ] || { echo ""; echo "  No Porkbun keys on this box yet."; usage; exit 1; }

# THE ADDRESS IS THIS MACHINE'S, asked rather than typed — a domain pointed at
# the box somebody remembers is the same failure in a new costume.
[ -n "$IP" ] || IP="$(curl -s -m 8 https://api.ipify.org || true)"
[ -n "$IP" ] || { echo "  Could not find this box's own address. Pass IP=…"; exit 1; }

API=https://api.porkbun.com/api/json/v3
auth() { printf '{"apikey":"%s","secretapikey":"%s"%s}' "$KEY" "$SECRET" "${1:-}"; }
call() { curl -s -m 25 -H 'Content-Type: application/json' -d "$2" "$API/$1"; }

echo ""
echo "  Pointing $DOMAIN at $IP"
echo ""

PING="$(call ping "$(auth)")"
case "$PING" in
  *'"status":"SUCCESS"'*) : ;;
  *) echo "  Porkbun refused those keys, so nothing was changed:"
     echo "  $(printf '%s' "$PING" | head -c 300)"
     echo ""
     echo "  The commonest cause is API access being off FOR THIS DOMAIN —"
     echo "  it is a per-domain switch, separate from having a key at all."
     echo ""; exit 1 ;;
esac

RECS="$(call "dns/retrieve/$DOMAIN" "$(auth)")"
# WHAT GOES AND WHAT STAYS. Only the two parking rows and any stale A/AAAA on
# the two names being set: MX, SPF and the ACME challenges are somebody's mail
# and somebody's certificate.
KILL="$(printf '%s' "$RECS" | python3 -c '
import json,sys
d=json.load(sys.stdin); dom=sys.argv[1]
for r in d.get("records",[]):
    name, t = r.get("name",""), r.get("type","")
    if name in (dom, "www."+dom, "*."+dom) and t in ("ALIAS","CNAME","A","AAAA"):
        print(r["id"], t, name, r.get("content",""))
' "$DOMAIN")"

if [ -n "$KILL" ]; then
  echo "  Taking out:"
  printf '%s\n' "$KILL" | while read -r id t n c; do echo "    $t  $n  ->  $c"; done
  printf '%s\n' "$KILL" | while read -r id _ _ _; do call "dns/delete/$DOMAIN/$id" "$(auth)" >/dev/null; done
else
  echo "  Nothing in the way."
fi

echo "  Putting in:"
for host in "" "www"; do
  echo "    A  ${host:-@}  ->  $IP"
  OUT="$(call "dns/create/$DOMAIN" "$(auth ",\"name\":\"$host\",\"type\":\"A\",\"content\":\"$IP\",\"ttl\":\"600\"")")"
  case "$OUT" in *'"status":"SUCCESS"'*) : ;; *) echo "    refused: $(printf '%s' "$OUT" | head -c 200)"; exit 1 ;; esac
done

put TOMSCODING_PORKBUN_KEY "$KEY"
put TOMSCODING_PORKBUN_SECRET "$SECRET"

echo ""
echo "────────────────────────────────────────────────────────────"
echo ""
echo "  Done at the registrar. DNS takes a few minutes to travel."
echo ""
echo "  When this prints $IP the name is here:"
echo ""
echo "      getent ahostsv4 $DOMAIN"
echo ""
