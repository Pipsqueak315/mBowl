#!/usr/bin/env bash
# mBowl — Mac build, the known-good way (Phase 27; decided Nov 10).
#
# Same flow as every previous build: Xcode signs with Marcus's free Apple ID
# (Personal Team) and Product → Archive makes the build. This script only
# automates the typing around it. Two runs, with Xcode clicks in between:
#
#   bash scripts/mac-build.sh            # PREP:    preflight, npm ci, prebuild --clean, pods, open Xcode
#   (Xcode: sign + Product → Archive — the checklist is printed for you)
#   bash scripts/mac-build.sh package    # PACKAGE: newest archive → mBowl-<version>.ipa → iCloud Drive / GitHub
#
# What each step does (so you learn it as it runs):
#   preflight — Xcode, Node and CocoaPods installed and new enough
#   npm ci    — installs the exact package versions from package-lock.json
#   prebuild  — Expo generates the native ios/ folder from app.json
#               (--clean = start fresh, nothing stale survives — audit N6);
#               CocoaPods then downloads the native iOS libraries
#   Xcode     — signs with your Apple ID and archives a Release build
#   package   — wraps the .app in Payload/ and zips it: that zip IS an .ipa
#   hand-off  — copies the .ipa to iCloud Drive (+ GitHub Release if `gh` is
#               signed in) so the PC can install it with iloader
#
# If anything stops, paste the last lines to Claude in the iOS app.
# Full manual reference: REBUILD.md.

set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
MODE="${1:-prep}"

step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31m✗ %s\033[0m\n' "$1"; exit 1; }

command -v node >/dev/null || fail "Node.js not found. Install the LTS from nodejs.org, then re-run."
VERSION="$(node -p "require('./app.json').expo.version")"

if [ "$MODE" = "prep" ]; then
  step "1/4 Preflight — mBowl $VERSION from $(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD)"
  command -v xcodebuild >/dev/null || fail "Xcode not found. Install Xcode 27.1, open it once, then re-run."
  xcodebuild -version | head -1
  xcodebuild -checkFirstLaunchStatus >/dev/null 2>&1 || fail "Xcode needs first-launch setup. Run: sudo xcodebuild -runFirstLaunch   then re-run this."
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$NODE_MAJOR" -ge 20 ] || fail "Node $(node -v) is too old. Install the LTS (22+) from nodejs.org."
  echo "node $(node -v)"
  command -v pod >/dev/null || fail "CocoaPods not found. Run: sudo gem install cocoapods   (or: brew install cocoapods)"
  echo "pod $(pod --version)"
  [ -z "$(git status --porcelain)" ] || fail "This folder has local changes. Re-clone (paste the setup command again)."

  step "2/4 npm ci — exact package versions"
  npm ci --no-audit --no-fund

  step "3/4 expo prebuild --clean — generate ios/ + CocoaPods"
  CI=1 npx expo prebuild --platform ios --clean --no-install
  (cd ios && pod install)

  WORKSPACE="$(ls -d ios/*.xcworkspace | head -1)"
  [ -n "$WORKSPACE" ] || fail "No .xcworkspace in ios/ — prebuild didn't finish. Scroll up for the error."

  step "4/4 Opening Xcode — your turn (same as previous builds)"
  open "$WORKSPACE"
  cat <<'CHECKLIST'

  In Xcode:
   1. First time on this Mac only: Xcode → Settings → Accounts → + → Apple ID → sign in.
   2. Left sidebar: click the blue "mBowl" project → TARGETS: mBowl → "Signing & Capabilities".
   3. Check "Automatically manage signing". Team: "Marcus Castro (Personal Team)".
      Bundle Identifier must read: com.marcus.mbowl
   4. If a "Push Notifications" capability is listed, click its trash icon (free Apple IDs can't use it).
   5. Top bar device menu: choose "Any iOS Device (arm64)" — NOT a simulator.
   6. Menu: Product → Archive. Wait for the Organizer window to show the new archive.
   7. Close Xcode, come back here and run:
        bash scripts/mac-build.sh package

CHECKLIST
  exit 0
fi

if [ "$MODE" = "package" ]; then
  OUT="$ROOT/build"
  IPA="$OUT/mBowl-$VERSION.ipa"
  step "1/2 Package — newest Xcode archive → $(basename "$IPA")"
  # Archive folder names contain invisible characters — always glob, never type them.
  ARCHIVE="$(ls -dt "$HOME"/Library/Developer/Xcode/Archives/*/mBowl*.xcarchive 2>/dev/null | head -1 || true)"
  [ -n "$ARCHIVE" ] || fail "No mBowl archive found. In Xcode: Product → Archive first."
  echo "archive: $(basename "$ARCHIVE")"
  APP="$(ls -d "$ARCHIVE"/Products/Applications/*.app | head -1)"
  [ -n "$APP" ] || fail "No .app inside the archive."
  mkdir -p "$OUT"
  rm -rf "$OUT/Payload" "$IPA"
  mkdir -p "$OUT/Payload"
  cp -R "$APP" "$OUT/Payload/"
  (cd "$OUT" && zip -qry "$(basename "$IPA")" Payload)
  rm -rf "$OUT/Payload"
  echo "$IPA ($(du -h "$IPA" | cut -f1))"

  step "2/2 Hand-off to the PC"
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
      gh release create "$TAG" "$IPA" --target "$(git rev-parse HEAD)" --title "mBowl $VERSION" \
        --notes "Built on the Mac from $(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD), $(xcodebuild -version | head -1), signed with the Personal Team." \
        && echo "Created GitHub Release $TAG"
    fi
  else
    echo "GitHub CLI not signed in — skipped the Release (Claude can add it later)."
  fi
  printf '\n\033[1;32m✓ Mac work is done.\033[0m Next, on the PC: iloader → Import IPA → %s\n' "$(basename "$IPA")"
  exit 0
fi

fail "Unknown mode '$MODE'. Use: bash scripts/mac-build.sh   or   bash scripts/mac-build.sh package"
