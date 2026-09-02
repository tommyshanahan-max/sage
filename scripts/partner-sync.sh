#!/usr/bin/env bash
# Replace the snapshot a partner sees.
#
# This is the whole of "nothing changes without my say so", and also the whole
# of "he sees only the repositories I allow". The partner's container mounts
# ./partner/source read-only; that directory contains exactly what this script
# put there, it only moves when this script runs, and only the owner can run it.
# Their mockups are untouched.
#
# One repository or several. Each lands in its own folder, named after the
# repository, so Sage sees them side by side:
#
#   /work/app/journey/          <- journey.git @ aesthetic-spike
#   /work/app/liuxuesheng/      <- liuxuesheng.git @ main
#
# Every clone is stripped of its .git before it goes into place. A partner seat
# has no shell, so nothing in there could act on a remote anyway — but a
# snapshot with no remote and no history is a thing you can reason about in one
# sentence, and that is worth more than the convenience of keeping it.
set -euo pipefail

DEST="partner/source"

# Preferred: a list. Comma- or newline-separated, each entry `<url>#<branch>`,
# optionally `<url>#<branch>=<folder>` when you want to name the folder
# yourself.
#
#   TOMSCODING_PARTNER_REPOS="https://github.com/you/a.git#main,https://github.com/you/b.git#spike"
#
# The older single-repository pair still works and means the same thing.
REPOS="${TOMSCODING_PARTNER_REPOS:-}"
if [ -z "$REPOS" ] && [ -n "${TOMSCODING_PARTNER_REPO:-}" ]; then
  REPOS="${TOMSCODING_PARTNER_REPO}#${TOMSCODING_PARTNER_BRANCH:-main}"
fi

if [ -z "$REPOS" ]; then
  cat >&2 <<'MSG'
Nothing configured, so nothing was changed.

Set this in .env — one entry per repository you are willing to show, as
url#branch, separated by commas or newlines:

  TOMSCODING_PARTNER_REPOS="https://github.com/you/journey.git#aesthetic-spike"

This list is the access decision. A repository that is not in it is not on that
machine at all, so there is nothing to reach, guess at, or be talked into.
MSG
  exit 1
fi

TMP="$(mktemp -d)"
# Ordinary trap semantics: leave nothing behind on any exit path, including a
# clone that fails half way through a list.
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/next"

MANIFEST="$TMP/next/SNAPSHOT.txt"
{
  echo "A read-only snapshot, shown to a partner seat."
  echo
  echo "It does not update on its own. It changes when the owner runs"
  echo "\`make partner-sync\`, and not before. Only what is listed here is on"
  echo "that machine."
  echo
  printf 'taken   %s\n' "$(date -u '+%Y-%m-%d %H:%M UTC')"
  echo
} > "$MANIFEST"

count=0
# Commas become newlines so a list can be written either way; blank lines are
# skipped so a trailing comma is not an error.
while IFS= read -r entry; do
  entry="$(echo "$entry" | xargs)"
  [ -z "$entry" ] && continue

  url="${entry%%#*}"
  rest="${entry#*#}"
  if [ "$rest" = "$entry" ]; then
    echo "no branch in '$entry' — write it as url#branch" >&2
    exit 1
  fi
  branch="${rest%%=*}"
  folder="${rest#*=}"
  [ "$folder" = "$branch" ] && folder="$(basename "$url" .git)"

  echo "fetching $branch from $url"
  git clone --depth 1 --branch "$branch" "$url" "$TMP/next/$folder" >/dev/null
  commit="$(git -C "$TMP/next/$folder" rev-parse --short HEAD)"
  subject="$(git -C "$TMP/next/$folder" log -1 --format=%s)"
  rm -rf "$TMP/next/$folder/.git"

  printf '%s\n  repo    %s\n  branch  %s\n  commit  %s\n  subject %s\n\n' \
    "$folder" "$url" "$branch" "$commit" "$subject" >> "$MANIFEST"
  echo "  -> $folder  ($commit — $subject)"
  count=$((count + 1))
done < <(printf '%s\n' "$REPOS" | tr ',' '\n')

if [ "$count" -eq 0 ]; then
  echo "nothing to sync" >&2
  exit 1
fi

# Swap rather than edit in place: the live snapshot is either the old set or the
# new one, never a half-copied mixture, even if this dies mid-move.
mkdir -p partner
rm -rf "$DEST.new"
mv "$TMP/next" "$DEST.new"
rm -rf "$DEST.old"
[ -e "$DEST" ] && mv "$DEST" "$DEST.old"
mv "$DEST.new" "$DEST"
rm -rf "$DEST.old"

echo
echo "$count repositor$([ "$count" = 1 ] && echo y || echo ies) in the snapshot."
echo "the partner sees this from their next page load; mockups are untouched."
