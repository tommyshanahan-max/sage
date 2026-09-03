#!/usr/bin/env python3
"""Write a digest of recent platform changes for the agent to read.

Sage runs in a container with the *workspace* volume mounted, not this
repository. It can see your projects and has no idea what the platform around
it looks like — which is why it could not answer "what did we change
yesterday" and why it does not know a deploy has happened.

The obvious fix is to bind-mount this repository into the agent. That is worse
than it looks: `.env` lives here, and it holds every secret on the box
including the partner passwords. So instead we hand the container one
generated file with nothing sensitive in it — commit subjects, dates, changed
paths — and mount only the directory that file is in.

Written by `make up`, so the digest is stamped at the moment of the deploy:
the commit list is what is actually running, not what happens to be on a
branch somewhere. `make whats-new` regenerates it on its own if you want the
agent brought up to date without a restart.
"""

import json
import os
import subprocess
import sys
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, ".platform-state")
OUT = os.path.join(OUT_DIR, "changes.json")

# How many commits the agent is told about. Enough to answer "what changed this
# week" without turning every one of its turns into a changelog recital.
COUNT = 25
# Changed paths per commit. A commit that touched forty files is described by
# its first few and a count; the whole list would crowd out the next commit.
FILES_PER_COMMIT = 8

# Field separator inside a log line, and record separator between them. Both
# are control characters that cannot occur in a commit subject, so a subject
# containing a tab, a pipe or a newline still parses.
FS = "\x1f"
RS = "\x1e"


def git(*args):
    return subprocess.run(
        ["git", "-C", ROOT, *args],
        capture_output=True,
        text=True,
        check=True,
    ).stdout


def main():
    try:
        head = git("rev-parse", "HEAD").strip()
    except (subprocess.CalledProcessError, FileNotFoundError) as exc:
        # No git, or not a checkout. A missing digest is handled by the agent —
        # it simply says nothing about the platform — so this is a note, not a
        # failure that should stop a deploy.
        print(f"whats-new: skipped ({exc.__class__.__name__})", file=sys.stderr)
        return 0

    fmt = FS.join(["%H", "%h", "%aI", "%an", "%s"]) + RS
    raw = git("log", f"-n{COUNT}", f"--pretty=format:{fmt}")

    commits = []
    for record in raw.split(RS):
        record = record.strip("\n")
        if not record.strip():
            continue
        parts = record.split(FS)
        if len(parts) < 5:
            continue
        sha, short, date, author, subject = parts[:5]
        try:
            names = git("show", "--name-only", "--pretty=format:", sha).split()
        except subprocess.CalledProcessError:
            names = []
        commits.append(
            {
                "sha": sha,
                "short": short,
                "date": date,
                "author": author,
                "subject": subject,
                "files": names[:FILES_PER_COMMIT],
                "fileCount": len(names),
            }
        )

    try:
        branch = git("rev-parse", "--abbrev-ref", "HEAD").strip()
    except subprocess.CalledProcessError:
        branch = ""
    try:
        dirty = bool(git("status", "--porcelain").strip())
    except subprocess.CalledProcessError:
        dirty = False

    state = {
        # When this deploy happened — which, because this file is written by
        # `make up`, is also "as of when this commit list was what was
        # running".
        "deployedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "branch": branch,
        "head": head,
        "headShort": commits[0]["short"] if commits else head[:7],
        "dirty": dirty,
        "commits": commits,
    }

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(state, fh, indent=1)
        fh.write("\n")
    print(f"whats-new: {len(commits)} commits, head {state['headShort']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
