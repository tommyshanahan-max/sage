#!/usr/bin/env bash
# BUILD THE APP AND HAND IT TO APPLE, in one line, from the Mac.
#
#   make app-ship                 build, upload, print where it landed
#   make app-ship BUILD=7         that build number instead of the next one
#   make app-ship OPEN=1          stop after the project exists and open Xcode
#
# WHY IT IS A TARGET AND NOT A PAGE OF INSTRUCTIONS. Everything either side of
# this — the listing, the screenshots, the reviewer's board, asking Apple where
# the app is — is already one command. The archive in the middle was seven
# steps in Xcode, which is the shape of thing that does not get done, and the
# one step that was still a screen.
#
# THE KEY NEVER MOVES. ~/.appstoreconnect/private_keys, read by altool off this
# disk, the same one app-state and fill-listing use. Nothing here asks anybody
# to log in to anything.
#
# WHAT IT CANNOT DO, and no script can: the age rating, two App Information
# sections and the screenshots are a web form. app/store/FILL-IN.md is the
# list, and it is the only reason that file still exists.
#
# UNTESTED ON A MAC AT THE TIME OF WRITING — there is no Mac where this was
# written. Every step prints what it is about to do and stops on the first
# failure with the command that failed, so a first run that goes wrong says
# where rather than leaving a half-made archive behind.
set -euo pipefail

say() { printf '\n  %s\n' "$*"; }
die() { printf '\n  %s\n\n' "$*" >&2; exit 1; }

KEY_ID="NQB9NSL78X"
ISSUER_ID="27f759c2-092c-478d-a9ef-038927820519"
KEY_FILE="$HOME/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8"

[ "$(uname)" = "Darwin" ] || die "This one runs on the Mac. Apple's tools are not on the box."
command -v xcodebuild >/dev/null || die "No Xcode command line tools. Install Xcode, open it once, then try again."
command -v node >/dev/null || die "No node on this Mac, and Capacitor is a node program."
[ -f "$KEY_FILE" ] || die "No App Store Connect key at $KEY_FILE — the same one make app-state uses."
[ -d app ] || die "Run this from ~/tc."

# THE TEAM, FROM THE KEYCHAIN. It is a ten-character id nobody remembers and
# it is printed in brackets after every distribution certificate on this Mac,
# so it is read rather than asked for. A Mac with two teams gets the first and
# says so — TEAM=… overrides it.
if [ -z "${TEAM:-}" ]; then
  TEAM="$(security find-identity -v -p codesigning 2>/dev/null \
    | sed -n 's/.*"Apple Distribution: .*(\([A-Z0-9]\{10\}\))".*/\1/p' | head -1)"
  [ -n "$TEAM" ] || TEAM="$(security find-identity -v -p codesigning 2>/dev/null \
    | sed -n 's/.*(\([A-Z0-9]\{10\}\)).*/\1/p' | head -1)"
fi
[ -n "$TEAM" ] || die "No distribution certificate on this Mac. Open Xcode → Settings → Accounts and add the Apple ID, then try again. Or pass TEAM=XXXXXXXXXX."
say "Team $TEAM"

cd app

[ -d node_modules ] || { say "Installing what the shell needs (once on this machine)…"; npm install --silent --no-audit --no-fund; }

# THE NATIVE PROJECT IS NOT IN THE REPOSITORY, on purpose: it is generated,
# it is enormous, and a generated thing in git is a thing that drifts from
# what generates it. Made here the first time, synced every time after.
if [ -d ios ]; then
  say "Syncing the shell with the board…"
  npx --no-install cap sync ios
else
  say "Making the iOS project for the first time…"
  npx --no-install cap add ios
fi

# The icon and the launch screen, from app/resources. Skipped rather than
# fatal: a missing icon is Apple's rejection to give, not this script's.
if [ -f resources/icon.png ]; then
  say "Drawing the icons…"
  npx --no-install capacitor-assets generate --ios >/dev/null || say "(icons not regenerated — carrying on with what is there)"
fi

if [ -n "${OPEN:-}" ]; then
  say "Stopping here as asked. Opening Xcode."
  npx --no-install cap open ios
  exit 0
fi

# WORKSPACE OR PROJECT, AND CAPACITOR 8 HAS NO WORKSPACE.
#
# This looked for App.xcworkspace and died saying the project had not
# generated — on a machine where it had generated perfectly. A workspace is
# what CocoaPods needs, and Capacitor 8 does not use CocoaPods: its own log
# says so, one line above the failure ("All Capacitor plugins have a
# Package.swift file"). Swift Package Manager builds the .xcodeproj directly.
#
# Both are still possible — an older shell, or somebody who added a pod — so
# it takes whichever is there rather than believing either.
if [ -f "ios/App/App.xcworkspace/contents.xcworkspacedata" ]; then
  TARGET=(-workspace "ios/App/App.xcworkspace")
  say "Building the workspace."
elif [ -d "ios/App/App.xcodeproj" ]; then
  TARGET=(-project "ios/App/App.xcodeproj")
  say "Building the project — Capacitor 8, so Swift Package Manager and no workspace."
else
  die "Nothing to build in ios/App. Run again with OPEN=1 and look at what Xcode says."
fi

# THE BUILD NUMBER HAS TO CLIMB. Apple refuses a build whose number it has
# seen before, with an error that arrives ten minutes into an upload. Minutes
# since the start of 2026 is monotonic, short enough for Apple's field, and
# needs nothing remembered between runs.
BUILD="${BUILD:-$(( ($(date +%s) - 1767225600) / 60 ))}"
VERSION="${VERSION:-1.0}"
say "Version $VERSION, build $BUILD"

ARCH="$PWD/build/App.xcarchive"
OUT="$PWD/build/export"
rm -rf "$ARCH" "$OUT"

say "Archiving. This is the slow part — a few minutes, and it is silent."
xcodebuild "${TARGET[@]}" -scheme App \
  -configuration Release -destination "generic/platform=iOS" \
  -archivePath "$ARCH" \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$TEAM" \
  MARKETING_VERSION="$VERSION" CURRENT_PROJECT_VERSION="$BUILD" \
  archive

cat > build/ExportOptions.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>$TEAM</string>
  <key>uploadSymbols</key><true/>
  <key>signingStyle</key><string>automatic</string>
</dict></plist>
PLIST

say "Exporting the .ipa…"
# `app-store-connect` is the name from Xcode 15 on; older Xcodes call the same
# thing `app-store` and fail on the new word with a message about a key.
if ! xcodebuild -exportArchive -archivePath "$ARCH" \
     -exportOptionsPlist build/ExportOptions.plist -exportPath "$OUT" \
     -allowProvisioningUpdates 2>build/export.log; then
  if grep -qi "app-store-connect" build/export.log; then
    say "Older Xcode — using the previous name for the same thing."
    sed -i '' 's/app-store-connect/app-store/' build/ExportOptions.plist
    xcodebuild -exportArchive -archivePath "$ARCH" \
      -exportOptionsPlist build/ExportOptions.plist -exportPath "$OUT" \
      -allowProvisioningUpdates
  else
    sed 's/^/    /' build/export.log >&2
    die "The export failed — the reason is above."
  fi
fi

IPA="$(ls "$OUT"/*.ipa 2>/dev/null | head -1)"
[ -n "$IPA" ] || die "No .ipa came out of the export. $OUT is empty."

say "Uploading to Apple. Ten minutes is normal; it says nothing until it is done."
xcrun altool --upload-app -f "$IPA" -t ios \
  --apiKey "$KEY_ID" --apiIssuer "$ISSUER_ID"

say "Uploaded. Apple processes it for a few minutes and then emails you."
printf '  Then, in this order:\n\n'
printf '    make app-state                          where Apple thinks it is\n'
printf '    make listing PHONE="+61 4xx xxx xxx"    the words, through the API\n\n'
printf '  The age rating, two App Information sections and the screenshots are\n'
printf '  a web form — app/store/FILL-IN.md is the list, in the order the site\n'
printf '  asks for them.\n\n'
