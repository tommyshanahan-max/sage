#!/usr/bin/env bash
# Replace the snapshot a partner sees.
#
# This is the whole of "nothing changes without my say so". The partner's
# container mounts ./partner/source read-only; that directory only ever moves
# when this script runs, and only you can run it. Their mockups are untouched.
#
# The clone is stripped of its .git before it goes into place. A partner seat
# has no shell, so nothing in there could act on a remote anyway — but a
# snapshot with no remote and no history is a thing you can reason about in one
# sentence, and that is worth more than the convenience of keeping it.
set -euo pipefail

REPO="${TOMSCODING_PARTNER_REPO:-}"
BRANCH="${TOMSCODING_PARTNER_BRANCH:-}"
DEST="partner/source"

if [ -z "$REPO" ] || [ -z "$BRANCH" ]; then
  cat >&2 <<'MSG'
Set both of these in .env first:

  TOMSCODING_PARTNER_REPO=https://github.com/you/repo.git
  TOMSCODING_PARTNER_BRANCH=the-branch-they-should-see

The branch is the decision this script exists to make explicit: it is the exact
version your partner will look at, and it does not move again until you run
this.
MSG
  exit 1
fi

echo "fetching $BRANCH from $REPO"

TMP="$(mktemp -d)"
# Ordinary trap semantics: leave nothing behind on any exit path, including a
# failed clone half way through.
trap 'rm -rf "$TMP"' EXIT

# --depth 1: a snapshot, not a history. Nobody is going to run git log in there.
git clone --depth 1 --branch "$BRANCH" "$REPO" "$TMP/checkout" >/dev/null

COMMIT="$(git -C "$TMP/checkout" rev-parse --short HEAD)"
SUBJECT="$(git -C "$TMP/checkout" log -1 --format=%s)"
rm -rf "$TMP/checkout/.git"

# Written into the snapshot so that both of you can always answer "which
# version is this?" without asking each other.
cat > "$TMP/checkout/SNAPSHOT.txt" <<EOF
This is a read-only snapshot, shown to a partner seat.

repo    $REPO
branch  $BRANCH
commit  $COMMIT
subject $SUBJECT
taken   $(date -u '+%Y-%m-%d %H:%M UTC')

It does not update on its own. It changes when the owner runs \`make
partner-sync\`, and not before.
EOF

# Swap rather than edit in place: the live directory is either the old snapshot
# or the new one, never a half-copied mixture, even if this dies mid-move.
mkdir -p partner
rm -rf "$DEST.new"
mv "$TMP/checkout" "$DEST.new"
rm -rf "$DEST.old"
[ -e "$DEST" ] && mv "$DEST" "$DEST.old"
mv "$DEST.new" "$DEST"
rm -rf "$DEST.old"

echo "snapshot is now $BRANCH @ $COMMIT — $SUBJECT"
echo "the partner sees this from their next page load; mockups are untouched."
