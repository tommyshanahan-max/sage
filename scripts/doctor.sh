#!/usr/bin/env bash
# Diagnose the network path between where you are and the VPS.
# Run this from your laptop (not the VPS) when the IDE feels slow or unreachable:
#   bash scripts/doctor.sh code.example.com
set -uo pipefail

DOMAIN="${1:-}"
if [[ -z $DOMAIN && -f .env ]]; then
  DOMAIN=$(grep -E '^TOMSCODING_DOMAIN=' .env | cut -d= -f2- | tr -d '"'"'"' ')
fi
[[ -n $DOMAIN ]] || { echo "usage: bash scripts/doctor.sh <domain>" >&2; exit 1; }

hr() { printf '\033[2m%s\033[0m\n' "----------------------------------------"; }
sec() { printf '\n\033[1m%s\033[0m\n' "$*"; }

sec "Target"
echo "  $DOMAIN"

sec "DNS"
ips=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1}' | sort -u)
if [[ -z $ips ]]; then
  echo "  FAIL — name does not resolve."
  echo "  Your resolver may be returning nothing for this name. Try 1.1.1.1 or"
  echo "  8.8.8.8 directly, or connect to the VPS by IP to confirm it is up."
  exit 1
fi
echo "$ips" | sed 's/^/  /'

sec "Round-trip latency"
if command -v ping >/dev/null; then
  # ICMP is deprioritised or dropped on many paths; a failure here is not
  # conclusive, the TCP timing below is what actually matters.
  ping -c 5 -W 2 "$DOMAIN" 2>/dev/null | tail -n 2 | sed 's/^/  /' \
    || echo "  no ICMP reply (often filtered — not necessarily a problem)"
else
  echo "  ping not installed, skipping"
fi

sec "TLS + HTTP timing"
for i in 1 2 3; do
  out=$(curl -sS -o /dev/null \
    -w 'dns=%{time_namelookup}s connect=%{time_connect}s tls=%{time_appconnect}s first_byte=%{time_starttransfer}s total=%{time_total}s http=%{http_code}' \
    --max-time 20 "https://$DOMAIN/" 2>&1)
  echo "  try $i: $out"
done

sec "Certificate"
if command -v openssl >/dev/null; then
  echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null \
    | openssl x509 -noout -subject -issuer -dates 2>/dev/null | sed 's/^/  /' \
    || echo "  could not complete a TLS handshake"
else
  echo "  openssl not installed, skipping"
fi

sec "Websocket upgrade"
# code-server is unusable if the editor loads but the websocket is blocked, and
# that failure looks like "the page is stuck connecting" rather than an error.
code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: c2FnZS10ZXN0LTEyMzQ1Ng==' \
  "https://$DOMAIN/" 2>/dev/null)
case "$code" in
  101) echo "  ok — server accepted the upgrade (101)" ;;
  302|401|403) echo "  $code — auth gate reached before upgrade; log in and retry in the browser" ;;
  000) echo "  FAIL — connection dropped during upgrade. Something on the path is" ;
       echo "         terminating long-lived connections." ;;
  *)   echo "  unexpected status $code" ;;
esac

sec "Path"
if command -v mtr >/dev/null; then
  mtr -4 -r -c 20 -n "$DOMAIN" 2>/dev/null | sed 's/^/  /'
elif command -v traceroute >/dev/null; then
  traceroute -n -w 2 -m 20 "$DOMAIN" 2>/dev/null | sed 's/^/  /'
else
  echo "  install mtr for per-hop loss: the hop where Loss% first climbs and"
  echo "  stays high is the one to take to your provider."
fi

hr
cat <<'GUIDE'
Reading this:
  connect < 0.10s and stable   -> the route is healthy
  connect fine, tls slow       -> loss during handshake; check mtr loss
  total varies 5x between runs -> congested route, worst in local evening hours
  http=000 on every try        -> not reachable at all right now
GUIDE
