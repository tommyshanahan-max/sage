#!/bin/sh
# Write a digest of recent platform changes for the agent to read.
#
# Sage runs in a container with the *workspace* volume mounted, not this
# repository. It can see your projects and has no idea what the platform around
# it looks like — which is why it could not answer "what did we change
# yesterday" and why a deploy was invisible from inside it.
#
# The obvious fix is to bind-mount this repository into the agent. That is
# worse than it looks: `.env` lives here, and it holds every secret on the box
# including both partner passwords. So instead we hand the container one
# generated file with nothing sensitive in it — commit subjects, dates, changed
# paths — and mount only the directory that file is in, read-only.
#
# Run by `make up`, so the digest is stamped at the moment of the deploy: the
# commit list is what is actually running, not what happens to be on a branch
# somewhere. `make whats-new` runs it on its own if you want the agent brought
# up to date after a pull without a rebuild.
#
# sh, git and awk only. This was python3 first and the first deploy of it wrote
# nothing at all, because a VPS is not obliged to have python3 and a digest
# nobody notices is missing is worse than no feature. Everything used here is
# on any box that can run git.

set -eu

ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
OUT_DIR="$ROOT/.platform-state"
OUT="$OUT_DIR/changes.json"

# How many commits the agent is told about. Enough to answer "what changed this
# week" without turning every one of its turns into a changelog recital.
COUNT=25
# Changed paths per commit. A commit that touched forty files is described by
# its first few and a count; the whole list would crowd out the next commit.
FILES_PER_COMMIT=8

if ! git -C "$ROOT" rev-parse HEAD >/dev/null 2>&1; then
  echo "whats-new: $ROOT is not a git checkout — nothing to stamp" >&2
  exit 1
fi

BRANCH=$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [ -n "$(git -C "$ROOT" status --porcelain 2>/dev/null)" ]; then
  DIRTY=true
else
  DIRTY=false
fi
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

mkdir -p "$OUT_DIR"

# One pass. Records are separated by \x1e and header fields within a record by
# \x1f — control characters git will not put inside a subject, so a subject
# containing a tab, a quote or a pipe still parses. --name-only puts the changed
# paths on the lines after the header, which is why this needs no second call
# per commit.
#
# Written to a temporary file and moved into place, so a reader never sees a
# half-written digest. The agent caches on mtime and a rename updates it.
git -C "$ROOT" log "-n$COUNT" --name-only \
  --pretty=format:'%x1e%H%x1f%h%x1f%aI%x1f%an%x1f%s' \
  | awk -v now="$NOW" -v branch="$BRANCH" -v dirty="$DIRTY" \
        -v maxfiles="$FILES_PER_COMMIT" '
    function esc(s) {
      gsub(/\\/, "\\\\", s)
      gsub(/"/, "\\\"", s)
      gsub(/\t/, " ", s)
      # Anything else unprintable would make invalid JSON; a commit subject has
      # no business containing it, so it goes rather than being encoded.
      gsub(/[\001-\037]/, "", s)
      return s
    }
    BEGIN { RS = "\036"; FS = "\n"; printed = 0 }
    {
      if ($0 ~ /^[[:space:]]*$/) next
      split($1, h, "\037")
      if (h[1] == "") next
      if (printed == 0) {
        printf "{\n \"deployedAt\": \"%s\",\n", esc(now)
        printf " \"branch\": \"%s\",\n", esc(branch)
        printf " \"head\": \"%s\",\n", esc(h[1])
        printf " \"headShort\": \"%s\",\n", esc(h[2])
        printf " \"dirty\": %s,\n", (dirty == "true" ? "true" : "false")
        printf " \"commits\": ["
      } else {
        printf ","
      }
      printed++

      # Everything after the header line is a changed path, minus the blank
      # line git puts between them.
      shown = 0; total = 0; files = ""
      for (i = 2; i <= NF; i++) {
        if ($i ~ /^[[:space:]]*$/) continue
        total++
        if (shown < maxfiles) {
          files = files (shown ? "," : "") "\n    \"" esc($i) "\""
          shown++
        }
      }

      printf "\n  {\n"
      printf "   \"sha\": \"%s\",\n", esc(h[1])
      printf "   \"short\": \"%s\",\n", esc(h[2])
      printf "   \"date\": \"%s\",\n", esc(h[3])
      printf "   \"author\": \"%s\",\n", esc(h[4])
      printf "   \"subject\": \"%s\",\n", esc(h[5])
      printf "   \"files\": [%s%s],\n", files, (shown ? "\n   " : "")
      printf "   \"fileCount\": %d\n", total
      printf "  }"
    }
    END {
      if (printed == 0) exit 3
      printf "\n ]\n}\n"
    }
  ' > "$OUT.tmp"

mv "$OUT.tmp" "$OUT"

SHORT=$(git -C "$ROOT" rev-parse --short HEAD)
COUNTED=$(git -C "$ROOT" log "-n$COUNT" --pretty=format:x | wc -l | tr -d ' ')
echo "whats-new: $((COUNTED + 1)) commits, head $SHORT"
