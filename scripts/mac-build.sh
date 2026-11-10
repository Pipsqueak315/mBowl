#!/usr/bin/env bash
# mBowl — Mac build, the bare minimum (Phase 27).
#
# The Mac does only what needs macOS: generate the iOS project, compile it with
# Xcode, and package mBowl.ipa. Everything else (code, checks, docs, GitHub
# Release, sideloading) happens on the PC or from Claude in the iOS app.
#
# Run in Terminal from the repo root, on the branch to build:
#   bash scripts/mac-build.sh
#
# What each step does (so you learn the process while it runs):
#   1. Preflight  — checks Xcode, Node, CocoaPods are installed and new enough.
#   2. npm ci     — installs the exact package versions from package-lock.json.
#   3. prebuild   — Expo generates the native ios/ folder from app.json
#                   (--clean = start fresh, nothing stale survives; audit N6).
#                   CocoaPods then downloads the native iOS libraries.
#   4. archive    — xcodebuild compiles a Release build for real iPhones.
#                   Signing is OFF: iloader re-signs with your free Apple ID
#                   when it installs, so the Mac never needs your Apple ID.
#   5. package    — wraps the app in Payload/ and zips it: that zip IS an .ipa.
#   6. hand-off   — copies the .ipa to iCloud Drive (and to GitHub Releases if
#                   the GitHub CLI is signed in), so the PC can pick it up.
#
# If step 4 fails on signing, fall back to REBUILD.md "Xcode Configuration"
# (open ios/*.xcworkspace, add your Apple ID, Product → Archive) and send
# Claude the error text.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
VERSION="$(node -p "require('./app.json').expo.version")"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
COMMIT="$(git rev-parse --short HEAD)"
OUT="$ROOT/build"
IPA="$OUT/mBowl-$VERSION.ipa"
LOG="$OUT/xcodebuild.log"

step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31m✗ %s\033[0m\n' "$1"; exit 1; }

step "1/6 Preflight — building mBowl $VERSION from $BRANCH @ $COMMIT"
command -v xcodebuild >/dev/null || fail "Xcode not found. Install Xcode 27.1 from the App Store, open it once, then re-run."
xcodebuild -version | head -1
xcode-select -p >/dev/null 2>&1 || fail "Run: sudo xcode-select -s /Applications/Xcode.app"
if ! xcodebuild -checkFirstLaunchStatus >/dev/null 2>&1; then
  fail "Xcode needs first-launch setup. Run: sudo xcodebuild -runFirstLaunch   (then: sudo xcodebuild -license accept)"
fi
command -v node >/dev/null || fail "Node.js not found. Install the LTS from nodejs.org, then re-run."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || fail "Node $(node -v) is too old. Install the LTS (22+) from nodejs.org."
echo "node $(node -v)"
command -v pod >/dev/null || fail "CocoaPods not found. Run: sudo gem install cocoapods   (or: brew install cocoapods)"
echo "pod $(pod --version)"
[ -z "$(git status --porcelain)" ] || fail "This folder has local changes. Run: git stash   (or re-clone), then re-run."

step "2/6 npm ci — exact package versions from package-lock.json"
npm ci --no-audit --no-fund

step "3/6 expo prebuild --clean — generate ios/ + install CocoaPods"
CI=1 npx expo prebuild --platform ios --clean --no-install
(cd ios && pod install)

WORKSPACE="$(ls -d ios/*.xcworkspace | head -1)"
[ -n "$WORKSPACE" ] || fail "No .xcworkspace in ios/ — prebuild didn't finish. Scroll up for the error."
SCHEME="$(basename "$WORKSPACE" .xcworkspace)"
echo "workspace $WORKSPACE · scheme $SCHEME"

step "4/6 xcodebuild archive — Release build for iPhone, unsigned (takes a few minutes)"
mkdir -p "$OUT"
rm -rf "$OUT/mBowl.xcarchive" "$OUT/Payload" "$IPA"
if ! xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -archivePath "$OUT/mBowl.xcarchive" \
  archive \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" \
  > "$LOG" 2>&1; then
  echo "Last 40 lines of $LOG:"
  tail -40 "$LOG"
  fail "Archive failed. Send Claude the lines above (full log: build/xcodebuild.log)."
fi
echo "archive OK ($(du -sh "$OUT/mBowl.xcarchive" | cut -f1))"

step "5/6 Package — Payload/ + zip = .ipa"
APP="$(ls -d "$OUT"/mBowl.xcarchive/Products/Applications/*.app | head -1)"
[ -n "$APP" ] || fail "No .app inside the archive."
mkdir -p "$OUT/Payload"
cp -R "$APP" "$OUT/Payload/"
(cd "$OUT" && zip -qry "$(basename "$IPA")" Payload)
rm -rf "$OUT/Payload"
echo "$IPA ($(du -h "$IPA" | cut -f1))"

step "6/6 Hand-off to the PC"
ICLOUD="$HOME/Library/Mobile Documents/com~apple~CloudDocs"
if [ -d "$ICLOUD" ]; then
  mkdir -p "$ICLOUD/mBowl Builds"
  cp "$IPA" "$ICLOUD/mBowl Builds/"
  echo "Copied to iCloud Drive → mBowl Builds/$(basename "$IPA")"
else
  echo "iCloud Drive not found — copy $IPA to the PC by USB/email instead."
fi
if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  TAG="v$VERSION"
  if gh release view "$TAG" >/dev/null 2>&1; then
    gh release upload "$TAG" "$IPA" --clobber && echo "Replaced the IPA on GitHub Release $TAG"
  else
    gh release create "$TAG" "$IPA" --target "$COMMIT" --title "mBowl $VERSION" \
      --notes "Built on the Mac from $BRANCH @ $COMMIT with $(xcodebuild -version | head -1). Unsigned; iloader signs at install." \
      && echo "Created GitHub Release $TAG with the IPA"
  fi
else
  echo "GitHub CLI not signed in — skipped the Release (Claude can create it from the PC copy)."
fi

printf '\n\033[1;32m✓ Done.\033[0m Mac work is finished. Next, on the PC: iloader → Import IPA → %s\n' "$(basename "$IPA")"
