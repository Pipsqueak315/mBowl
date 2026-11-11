# mBowl -- Session Brief REV24
**Full spec lives in:** mBowl-SPEC.md -- read it before writing any code.
**Duo roadmap + locked design spec:** `docs/mBowl-DuoPlan.md` (v1.6) -- Phases 25-28. **Phase 28 build spec (execution-ready):** `docs/mBowl-Phase28-BuildSpec.md`.
**Last updated:** November 10, 2026, 18:45 (Tue night)

---

## START HERE (Nov 10, 2026, 18:45)

**One-line status:** the v2 binary (2.0.0) is BUILT and on GitHub. Next = install it on the Duo and move the data (tonight), then Phase 28 Thu-Fri. League is Sat Nov 14. We are about a day ahead of the sprint plan.

**Where things are:**
- **Branches (all on GitHub, `github.com/Pipsqueak315/mBowl`):**
  - `master` @ `4b6e5bf` -- Phase 24 Parts 5/6/6b + Phase 26 + Phase 26A automation, merged Nov 10. SDK 54, **version 1.0.0**. Nothing from it has shipped to any phone.
  - `phase27` -- **SDK 58 + native tabs + add-ons, version 2.0.0. This is what the v2 binary was built from** (`467d73e`). CI green. Master's docs commit is merged into it (Nov 10 night). **Not merged to `master` yet** -- needs the reviewer pass first (see NEXT).
  - `phase28` @ `86fbd86` -- Phase 28 WP0 only (theme tokens, layout classes, SegmentedControl, SeasonMenu; no screen changes). Based on an early `phase27` commit (`92a642d`); rebase onto `phase27` before WP1.
  - `phase26`, `phase26a`, `verify-expo-token` -- already merged / done; safe to delete later.
- **v2 binary:** `mBowl-2.0.0.ipa` (15.7 MB), **GitHub Release `v2.0.0`** (https://github.com/Pipsqueak315/mBowl/releases/tag/v2.0.0, target `467d73e`), also in the Mac's iCloud Drive -> mBowl Builds. Built Nov 10 18:18 on the Mac (Xcode 27.2, Apple ID Personal Team signing).
- **Phones:**
  - **Old phone:** all the data, current 1.0.0 build (Phase 23, or Phase 24 Parts 0-4 -- unconfirmed). **The guaranteed fallback for Saturday. Don't touch it.**
  - **Duo:** v2 not installed yet as of 18:45 -- Marcus is doing it now (NEXT step 1).
- **Backup (the data to move):** `mBowl-backup.json` exported 2026-10-11 from the old phone = **40 sessions, 125 games, avg 174.1, high game 253, best 3-game series 620**. Seasons: Winners 25 = 24, Jubilee 26 = 13, Winners 26 = 3 (Sep 12, Sep 19, Oct 10). 74 games with frames, 650 frames with pins, 10 balls. Oct 10 was the last time the app was used, so the file is complete. Copies: iCloud Drive -> mBowl Backups, and `Desktop\mBowl-backups\` on the PC.
  - **Missing Winners 2026 weeks** (never logged in the app): Wk 3 Sep 26, Wk 4 Oct 3, and Oct 17 / 24 / 31 / Nov 7 if bowled. Backfill later from SyncPassport scorecards -- Marcus will send them. Not blocking.
- **Hard rule all week:** nothing is published to the **1.0.0 runtime** (the old phone). `master` is still 1.0.0, so **no OTA from `master` until `phase27` is merged into it** (then `master` is 2.0.0 and its OTAs reach only the Duo).

---

## NEXT -- in order (pick up here in a new chat)

**1. Tonight (Tue) -- Marcus, PC + Duo: install v2 and move the data (plan 25.2)**
1. PC browser (signed in to GitHub): open the `v2.0.0` release above -> Assets -> download `mBowl-2.0.0.ipa`. (No iCloud Drive on the PC -- GitHub Release is the Mac -> PC hand-off.)
2. Plug the Duo into the PC, unlock, tap Trust. iloader -> select the Duo -> **Import IPA** -> the file in Downloads.
3. First open, if blocked: "Untrusted Developer" -> Settings -> General -> VPN & Device Management -> Apple ID -> Trust. "Developer Mode required" -> Settings -> Privacy & Security -> Developer Mode -> On (restarts).
4. Open mBowl: it shows the 18 sample sessions. **Leave it open -- never swipe it closed until step 7.**
5. Files app: get the Oct 10 backup (iCloud Drive -> mBowl Backups, or AirDrop from the old phone -> Downloads). Put it in **On My iPhone -> mBowl** named exactly `mBowl-backup.json`, choose Replace.
6. Back to mBowl (still open, not restarting) -> Settings -> **Restore from Backup**.
7. Stats on All-Time / All: must show **40 sessions / 125 games / 174.1 / 253 / 620**. If it shows 18 sessions, the app relaunched and overwrote the file -- repeat from step 4; the safe copies are untouched.
8. Settings -> **Export Backup** -> attach the file to Claude -> Claude runs `backup-check` (must read 40 / 125 / 174.1).
- v2 includes N7, so Restore also refreshes the shadow keys -- the "seeds stuck in the shadow" residual from the plan no longer applies.

**2. Tonight or Wed -- Marcus, Duo: screen check of the v2 binary (Claude can't see the phone).** Screenshot anything off and send it:
- Tab bar placement on the cover screen (system-drawn now; inactive tabs use iOS grey, not `#8E8E93`).
- Header title + Settings gear on all 4 tabs, and the Log Frames header.
- Swipe rows: Edit/Delete in History, Remove in Log (rebuilt for gesture-handler 3 -- riskiest change).
- History share card; Settings -> Export Backup.
- Log Frames keeps the screen awake.
- Splash icon size (~147pt).
- Rotation: expect landscape to happen anyway (iOS 27 may ignore the portrait request).

**3. Thu -- Claude (from the iOS app or PC):**
1. Reviewer pass on `phase27` vs `master` (`reviewer` agent; Level 2 files: `src/backup.ts`, plus the swipe-row rebuild). Fix anything real.
2. Merge `phase27` -> `master` (master becomes 2.0.0). Only after this may `ota.yml` run.
3. Rebase `phase28` onto `phase27`/`master` (WP0 touches none of the moved tab files -- should be clean).
4. Execute `docs/mBowl-Phase28-BuildSpec.md` WP1 -> WP7 (all decisions locked). Each WP: CI green -> Marcus 2-minute check on the Duo -> "ship it" -> OTA via `ota.yml` (reaches 2.0.0 only). **Cut line:** WP6-WP7 slip first.

**4. Fri 8pm -- Marcus: go/no-go.** Duo bowls Saturday only if: (1) counts match the backup, (2) a full practice game logs end to end in Pins mode on the cover screen (then delete it), (3) Export Backup works. Otherwise bowl on the old phone.

**5. Sat -- league.** If the old phone was used: after league, Export on the old phone -> Restore on the Duo (only if the Duo logged nothing new). Set Target Average 190 / Series 570 on whichever phone is used.

**Who does what:**

| Who | Can do | Can't do |
|---|---|---|
| **Claude (Claude.ai project session, cloud)** | Clone/push branches and open PRs (GitHub App installed); read CI via the GitHub REST API (`gh api ...`; GraphQL is blocked in cloud sessions); write code + docs; update the project docs; run the OTA workflow after "ship it" (`EXPO_TOKEN` secret is set); read backups. | npm installs (no package access in cloud sessions), anything on the Mac, iloader, seeing the phone screen. |
| **Claude Code on the PC** | Everything above plus npm installs, SDK upgrades, `npm run ship:ota`. | iloader, the Mac, looking at the phone. |
| **The Mac (no Claude Code there)** | `scripts/mac-build.sh` -- setup + package + GitHub Release. Only needed for the next native rebuild. | Anything else -- errors go to Claude in the iOS app. |
| **Marcus only** | iloader installs + 7-day cert refreshes, phone-side data moves, checking screens on the Duo, "ship it", Friday go/no-go, Xcode signing/Archive clicks. | -- |

---

## DONE log (Nov 10)

- **12:11-13:58 (Claude, via the PC link):** docs committed + pushed; `phase26` + `phase26a` merged into `master` (nothing shipped); GitHub check tools bumped to v5; `scripts/mac-build.sh` added; `EXPO_TOKEN` added + verified; Claude pre-did Phase 27 prep on `phase27` (v2.0.0, orientation, new splash, N11).
- **~17:00-17:50 -- "Phase 27 part 1" (Claude Code on the PC):** Expo SDK 54 -> 55 -> 56 -> 57 -> 58 one commit per step (`a573b9a`, `3c9d30e`, `ef74e90`, `8ef099f`), each with expo-doctor clean, `npm run check` green and a real iOS JS bundle. Add-ons (`626f207`), native tabs (`dd57146`), Mac preflight Node check (`edac19e`). Nothing published.
- **17:55 (Claude, iOS app):** CI confirmed green on `phase27`; `src/backup.ts` diff checked -- one line (`await file.write`), S9 guards + restore shape checks untouched, safe for the restore.
- **18:05-18:33 (Marcus on the Mac, a day early):** Node 25.8.1 (Homebrew, odd version -- rejected) -> switched to Node 24.22.2 (`brew unlink node`, `brew install node@24`, `brew link --overwrite --force node@24`). Setup command clean (Xcode 27.2, CocoaPods 1.16.2, 132 pods). Archive done 18:18. `package` built the .ipa; the GitHub Release first failed (stale `gh` login, HTTP 401) -> `gh auth login` with a classic PAT -> Release `v2.0.0` created with the .ipa.
- **18:45 (Claude):** merged master's docs commit into `phase27`; rewrote this START HERE; synced all project docs.

**What Phase 28 needs to know from Phase 27:**
- **Tab screens moved:** `app/(tabs)/<tab>.tsx` -> `app/(tabs)/<tab>/index.tsx` (pure renames). NativeTabs draw no header, so each tab is its own Stack via `components/TabStack.tsx` (opaque black header, title, the Settings gear via `setOptions` as before). URLs unchanged. `phase28` (WP0) touches none of these files.
- **SDK 56+:** no `@react-navigation/*` imports (uninstalled) -- use `expo-router/react-navigation`. **gesture-handler 3:** legacy `Swipeable` is gone -> `ReanimatedSwipeable` (History rows, Log game rows). **Strict TS:** View refs are `useRef<ViewInstance>`.
- **Headers:** SDK 58 iOS stack headers default to transparent Liquid Glass. Kept opaque for now (TabStack `headerStyle`, Log Frames `headerTransparent: false`); Phase 28 opts in per screen.
- **27.4 answers:** `preferredPlacement` (iOS 27) = `automatic`; **`NativeTabs.BottomAccessory` exists (iOS 26+)** -- the native slot for the Live game button (WP7). Tab haptic kept via `screenListeners.tabPress`.
- **Splash:** `expo-splash-screen` plugin (SDK 56 rejects the top-level key). `splash.png` = 600x600 crop of the same art, `imageWidth` 184 = ~147pt icon.
- **`src/backup.ts`:** `await file.write(...)` (SDK 58 made it async) -- Export can't share a half-written file.
- **Portrait request:** `ScreenOrientation.lockAsync(PORTRAIT_UP)` in `app/_layout.tsx` -- delete it over the air once Phase 28 layouts handle landscape.
- **npm:** the SDK 58 install hit a false ERESOLVE (datetimepicker's optional `react-native-windows` peer). A one-time `--legacy-peer-deps` was used; a clean `npm ci` with no flags works on the committed lockfile (what CI + the Mac run). If a future `npm install` hits it, pass the flag once, then plain `npm install`, then confirm `npm ci`.

---

## Mac rebuild procedure (for the NEXT native build -- known good Nov 10)

Only needed for SDK bumps, new native modules, or `app.json` native changes. JS-only changes go over the air.

**Mac facts (Nov 10):** Xcode 27.2; Node 24.22.2 via Homebrew `node@24` (**don't `brew upgrade node`** -- Homebrew's default `node` is an odd version Expo rejects; stay on `node@24`). CocoaPods 1.16.2 (the "Ignoring ffi-1.17.2" lines are harmless). `gh` signed in with a **classic PAT** (scopes `repo` + `read:org`, expires on the date picked at creation (~Feb 8, 2027 if 90 days) -- when it expires: https://github.com/settings/tokens/new, then `gh auth login` -> GitHub.com -> HTTPS -> Yes -> Paste an authentication token).

1. Terminal -- setup (clones the code, installs, generates the iOS project, opens Xcode, prints the checklist; the Mac's zsh supports `&&`). Change `phase27` to the branch being built:
```
cd ~ && rm -rf mbowl-build && git clone https://github.com/Pipsqueak315/mbowl.git mbowl-build && cd mbowl-build && git checkout phase27 && bash scripts/mac-build.sh
```
2. Xcode -- check the left sidebar shows **mBowl AND Pods** (the workspace; if not: `open ios/mBowl.xcworkspace`). Settings -> Accounts -> Apple ID (first time only); mBowl target -> Signing & Capabilities -> Automatically manage signing, Team "Marcus Castro (Personal Team)", bundle ID `com.marcus.mbowl`; delete Push Notifications if listed; device "Any iOS Device (arm64)"; Product -> Archive (first build 5-15 min).
3. Terminal -- **must be in `~/mbowl-build`** (a new Terminal window starts in `~`, and the script isn't found there):
```
cd ~/mbowl-build && bash scripts/mac-build.sh package
```
- Done = `build/mBowl-<version>.ipa`, copied to iCloud Drive -> mBowl Builds **and** a GitHub Release `v<version>`. The PC downloads it from the Release page (no iCloud on the PC), then iloader -> Import IPA.
- If setup stops, it prints the one fix -- run it and paste the setup again. Errors: paste the last ~20 lines (Xcode: the FIRST red error in the Issue navigator) to Claude.
- If the version is unchanged and the Release already exists, `package` replaces the .ipa on it (`--clobber`).

---

## Phase 26 -- what was built (Nov 10; merged to `master`, ships to the Duo inside the v2 binary)

Verified: `npx tsc --noEmit` clean against the PC's `node_modules`; `npm run check` all green; Phase 24 harness on the real backup all green; independent reviewer pass: PASS WITH WARNINGS, no blockers; four warnings fixed in `513f9a8` (see the last table row). Open info item: `components/PocketDiagnosticsTab.tsx` keeps its own single-band `conversionColor`, so split leaves on the Reference tab still use 80/60 -- align in Phase 28 or with the NICE batch.

| Plan item | What changed | Files |
|---|---|---|
| **24 Part 5** | Reconciliation on the real Oct 10 backup: **24 / 13 / 3 = 40** ✓, boundary sessions (2026-05-30, 2026-09-12) land on the right side ✓, NaN-free across season × type ✓. Harness mirrors 6b; gained `--data <file>` and `--seeds`. | `scripts/phase24-verify.mjs` |
| **24 Part 6** | Seven grid cells colored by `CELL_BANDS` + `bandColor()`. **Goal-based (Marcus: end the season at a 190 average):** green = the level of his own 180-200 games, orange = his current level up to the goal, red = below current. White below 10 games with frame data. Color computed at display precision. | `app/(tabs)/stats.tsx` |
| **24 Part 6b** | High Series + Series Trend count **exactly-3-game sessions only** (`threeGameSeriesTotal`). All-time High Series 1435 -> **620**. High Game unaffected. `—` when no 3-game session. | `stats.tsx` |
| **26.1 N15** | `conversionColor` split: `makeableColor` (aggregate, **locked 80/60**) and `leaveConversionColor(pct, isSplit)` -- non-splits keep 80/60; **splits: green >=40, orange >=15, else grey `#8E8E93` (never red)**. Real data: splits convert 9/44 = 20% overall. | `stats.tsx` |
| **26.0b Export** | Settings -> **Export Backup** (teal, above Restore): `exportBackup()` = `writeBackup()` then the share sheet for `mBowl-backup.json`. S9 guards intact. JSON only. | `src/backup.ts`, `components/SettingsContent.tsx` |
| **26.0c** | `.gitattributes`: `* text=auto eol=lf`, binaries untouched. | `.gitattributes` |
| **26.2 N4** | `FRAME_RESULT_KEY` -> **`KEYS.FRAME_RESULT`**, same string `'mbowl_frame_result'`. Export removed from log-frames. | `src/storage.ts`, `app/log-frames.tsx`, `log.tsx`, `history.tsx` |
| **26.3 swipe-back** | One `usePreventRemove(hasData, …)` guard shows the existing "Discard Frames?" for header Cancel AND iOS swipe-back (native-stack 7.14 `preventNativeDismiss`). `handleDone` sets `savedRef` first so Done is never challenged. **B2 boundary unchanged:** discard never writes `KEYS.FRAME_RESULT`. | `app/log-frames.tsx` |
| **Review fixes** | Discard confirm only when frames changed since the screen opened (History -> Edit Frames with no change backs out silently); `savedRef` set before the result write, failed write alerts; Clean bands on the exact share; Export ignores a double tap ("Exporting…"). | `log-frames.tsx`, `stats.tsx`, `SettingsContent.tsx` |
| **26.5 screen size** | Log Frames reads `useWindowDimensions` live; height < **760pt** (`COMPACT_HEIGHT`) = compact: the two toggles share a row, frame slots 60, final score 60pt, PinDeck spacing tighter (pins stay 44pt). History share card fixed at **390pt** (was `Dimensions.get` at load). Audit found no other `Dimensions.get`; all tabs already scroll. **Not visually verified** -- no simulator in the cloud; check on the Duo cover screen. | `log-frames.tsx`, `components/PinDeck.tsx`, `history.tsx` |

**Part 6 bands (locked Nov 10):**

| Stat | Red below | Orange | Green (190 level) |
|---|---|---|---|
| First Ball | 8.6 | 8.6-8.8 | >= 8.9 |
| Strike % | 39 | 39-47 | >= 48 |
| Doubles % | 36 | 36-41 | >= 42 |
| Clean % | 7 | 7-19 | >= 20 |
| Spare % | 60 | 60-66 | >= 67 |
| Opens/G (lower better) | > 2.2 | 2.2-1.7 | <= 1.6 |
| Bounce-Back % | 75 | 75-79 | >= 80 |

Source: Marcus's 22 games scoring 180-200 in the Oct 10 export averaged FB 8.89, Strike 48.5%, Spare 64.7%, Opens 1.64 (Clean green from P(0 opens) at 1.6/game ~ 20%). Orange floors = his all-time (FB 8.6, Strike 39, Doubles 36, Clean 7, Spare 60, Opens 2.2, BB 75). **Expect normal nights to flicker orange/red -- that's the intended push.** Spare % (59.9 all-time) shows red: it's the biggest lever to 190. Bands live in one constant -- one line per stat to retune.

---

## Phase 26.4 -- NICE triage (decided Nov 10: all of Claude's takes accepted)

N3 shipped in Phase 23; N4 and N15 are done on `phase26`. **Keeps built in `972445d`** (N6 is the REBUILD.md line; used on the Mac trip). N7 turned out to matter more than the audit said: `app/_layout.tsx` *recovers from* the shadow keys on launch when the primary reads back empty, so after a fresh-install restore a stale shadow (the 18 seeds) could have been "recovered" instead of the real data. **Residual resolved (Nov 10):** the Duo restore now runs on the v2 build, which includes N7, so Restore writes the shadow keys too.

| ID | Item | Take | Why |
|---|---|---|---|
| N2 | Null-score expanded History row shows `—` in red | **Keep** | Tiny; a red dash reads as a bad score |
| N6 | `REBUILD.md` prebuild without `--clean` | **Keep** | One line; matters for the Phase 27 native build |
| N7 | Restore doesn't refresh the shadow keys | **Keep** | 2 lines; right after the Duo restore the shadow still holds the 18 seeds (Level 2 -- audit + backup gates) |
| N10 | `reset-project` script points at a deleted file | **Keep** | Delete one line |
| N12 | Unreachable `if (!sessions)` in PocketDiagnostics | **Keep** | Dead code, 1 line |
| N14 | `makeableConverted` returned but unused | **Keep** | Trivial cleanup |
| N1 | Share shows a text label, not a spinner | **Phase 28** | Restyled anyway in the v2 pass |
| N9 | Pin-row layout hard-coded in 4 files | **Phase 28** | Natural to consolidate during the redesign |
| N11 | Orphaned `splash-icon.png` | **Phase 27** | Splash work is batched with 27.5 |
| N13 | SPLIT badge can squeeze a long name | **Phase 28** | Layout work |
| N5 | Redundant `as` cast in stats.tsx | **Cut** | Typing a JS module for little gain |
| N8 | Seeds use `throwNotes: []` not `{}` | **Cut** | Seeds only exist before a restore; harmless |

---

## How To Start a Session

Tell Claude Code at the top of each session: Phase X -- [what you are working on today].
Claude reads CLAUDE.md and mBowl-SPEC.md for full context. This brief tracks current state only.

---

## Critical Project Notes

This is an Expo Router project -- not bare React Navigation.

- File-based routing. Tabs live in app/(tabs)/. Screens are files, not components registered manually.
- app/_layout.tsx is the root layout. Seed logic and dark theme forced here.
- app/(tabs)/_layout.tsx = NativeTabs (Phase 27.4); each tab is a folder with its own Stack (`app/(tabs)/<tab>/index.tsx` + `_layout.tsx` via `components/TabStack.tsx`).
- app/index.tsx is a redirect to /(tabs)/log -- required for Expo Go.
- Windows machine: always write files using a JS file via node. Never use python or bash heredoc.
- PowerShell does not support && -- run commands one at a time. Multi-line commit messages: write to a file and use `git commit -F`.
- `app.json` (on `phase27`): `"orientation": "default"` (all orientations, native) + a JS portrait request in `app/_layout.tsx`; `supportsTablet: false`. Version 2.0.0 / buildNumber 2. Changing these is native = Mac rebuild.

### Architecture Patterns

- **Seasons (Phase 24) -- multi-season, gapless, read-time.** `src/seasons.ts` owns the model. `DEFAULT_SEASONS` (winners-2025 / jubilee-2026 / winners-2026) is synthesized in memory when `settings.seasons` is absent -- **never persisted on read** (`mbowl_settings_v1` has no shadow key). Only each season's `start` is stored; `resolveSeasonRanges()` derives each end as (next start − 1 day), last open-ended. `seasonForDate()` / `currentSeason()` map a date / today to a season. Membership is derived from `session.date` at read time -- nothing written onto sessions, no `seasonId`, no migration. `seasonStart`/`seasonEnd` are **left untouched** and still drive **week auto-suggest** (log.tsx) -- do not rewire that.
- **Shared session filter (Phase 24 Part 0):** `src/sessionFilter.ts` exports `filterSessions(sessions, seasonSel, seasons, typeFilter)` + `ALL_TIME` + `TypeFilter`/`SeasonSelection`. **Single implementation used by both Stats and History.** Season selection is non-persistent, reset to the current season on each focus, like the type pills.
- **Season comparison (Phase 24 Part 3):** selected season vs its predecessor via `computeSeasonMetrics()`. Frame-derived deltas suppressed below `MIN_FRAME_GAMES` (10) games with frame data on either side.
- **Stat colors (Phase 24 Part 6):** `CELL_BANDS` + `bandColor()` in stats.tsx for the seven grid cells; `makeableColor` for aggregate Makeable (locked 80/60); `leaveConversionColor(pct, isSplit)` for per-leave rows. Same `MIN_FRAME_GAMES` gate. `avgColor` (180/166) is the locked overall-average rule -- separate.
- **Series rule (Part 6b):** `threeGameSeriesTotal()` -- High Series and Series Trend use exactly-3-game sessions only.
- **Gear icon:** Each tab injects a headerRight gear via useNavigation().setOptions() in useLayoutEffect. Opens SettingsContent.tsx as a pageSheet modal.
- **Dark theme:** Forced in app/_layout.tsx. StatusBar light.
- **ScalePressable:** Shared animated press component (withSpring damping 15, stiffness 400).
- **Shared mini-scorecard (Phase 23):** `components/FrameGrid.tsx`, `variant: 'compact' | 'full'`. Standing-pin color teal `#00CEC9` via `STANDING_PIN`.
- **Typography scale (Phase 23):** 200 (hero numerals) / 300 (white data) / 400 (threshold-colored ceiling) / 500 (labels) / 600 (emphasis).
- **Storage read states (Phase 20):** `readSessionsResult()` / `readBallsResult()` return `{ status, value }` (`missing|ok|invalid|error`). `[]` alone is never acted on; writers must use the *Result variants. Only `missing` seeds.
- **Split detection (Phase 20):** `isSplit()` in leaveUtils.js, read-time from `pinsStanding`, never persisted. 2-8-10 and 4-7-9 are splits; sleepers (2-8, 3-9) count as adjacent.
- **Throw-notation tokens:** `X` strike, `/` spare, **`—` (em dash, U+2014)** gutter/miss (NOT ASCII `-`), `0`-`9` counts.
- **Advanced stats (Phase 21):** First Ball Avg / Bounce-Back % / Doubles % / Clean Games all read-time via `calcAdvancedStats()`.
- **Backup / export:** `src/backup.ts` `writeBackup()` / `restoreBackup()` / `exportBackup()`. File `mBowl-backup.json` in `Paths.document`, **visible in Files -> On My iPhone -> mBowl** (`UIFileSharingEnabled`). **TRAP:** `writeBackup()` runs on every cold launch -- on a fresh install, restore a copied-in file BEFORE the app is ever relaunched.
- **Log Frames leave guard:** `usePreventRemove(isDirty)` + `savedRef`; one "Discard Frames?" for Cancel and swipe-back. `isDirty` = frames differ from the snapshot taken when the screen opened.
- **Compact layout:** Log Frames `COMPACT_HEIGHT = 760`; PinDeck `compact` prop.
- **Shared types:** src/types.ts is canonical. Do not redefine locally.
- **Storage layer:** src/storage.ts. KEYS object exported -- never write a raw key string at a call site (`npm run check` enforces this on `phase26a`).
- **OTA channel:** app.json carries `expo-channel-name: production`, baked into the binary. Both phones get every OTA.

### Automation (Phase 26A, merged to `master` Nov 10)
- `npm run check` -> `scripts/checks/run-all.mjs`: TypeScript + `leaves` / `seasons` / `rules` checks (import the REAL app source via Node 22 type stripping + `ts-resolve.mjs`) + the Phase 24 harness on the seeds.
- `npm run backup-check -- <file>`: read-only report of a backup (real season model).
- `npm run ship:ota`: refuses unless on `master`, clean, in sync with origin, and every check passes; then `eas update --branch production`.
- `.claude/settings.json` hooks: block hand-typed `eas update`; block `&&` and heredocs on Windows; run tsc after every .ts/.tsx edit (~25s on the PC).
- Skills `/feature`, `/ship`, `/audit`, `/backup-check`; agent `reviewer` (read-only).
- `.github/workflows/ci.yml` (every push/PR); `ota.yml` **manual dispatch only**, from `master`. `EXPO_TOKEN` secret is set (verified Nov 10). 26A.8 dry run not done yet -- the first Phase 28 OTA is effectively it. **Never run it while `master` is 1.0.0.**

---

## Phase Details -- Recent

> Phases 1-19 carried in REV18/REV20; Phase 20 fix-session detail in REV21; Phase 20-23 headers below.

### Phase 24 -- Multi-Season Support, Season Comparison, Color Thresholds
- **Parts 0-4** -- Sep 12, `004217c` (on `master`; OTA status unconfirmed).
- **Parts 5 / 6 / 6b** -- Nov 10 (see the Phase 26 table above). Merged to `master`; reach the Duo in the v2 binary. Never OTA'd to the old phone.

> **KEY LEARNING -- the current season can be empty by design.** Seasons are gapless and the newest is open-ended, so on rollover day the current season has zero sessions; the empty state is intended.

### Phases 20-23 (headers -- full detail in REV21)
- **Phase 20** (`d48c258`) -- split detection, Makeable Spare %, OTA production channel, 16-agent audit (`docs/PHASE20-AUDIT.md`), fix sessions A/B/B2/C.
- **Phase 21** (`1dd908a`) -- stats expansion, draft fixes S5/S6, em-dash gutter-token learning.
- **Phase 22** (`528d060`) -- one-screen stats + session-type pills.
- **Phase 23** -- `a66a3e5` (S16/S15/N3), `1f59960` (typography).

---

## Deferred -- ship via `eas update --branch production`

| ID | Item |
|---|---|
| **N1, N9, N13** | NICE -> Phase 28 (redesign). **N11** -> Phase 27 Mac trip (splash). N5, N8 cut. |
| **Backfill** | Winners 2026 weeks 3, 4 and Oct 17 onward -- from SyncPassport scorecards |

> **Done in Phase 26 (merged, in the v2 binary):** swipe-back confirm, N4, N15. **Shipped earlier:** S5, S6 (Ph 21); S15, S16, N3 (Ph 23).

---

## Open Questions

| Question | When |
|---|---|
| House shot exact specs (length + volume) | Verify with house sheet before updating Patterns in-app |
| Did Phase 24 Parts 0-4 ever reach the old phone? | Moot -- the old phone stays on 1.0.0 as the fallback; the Duo gets everything in v2. |
| ~~SF Pro or SF Pro Rounded~~ | Resolved Nov 10: SF Pro, weight 200 (Phase 28 D2). |

---

## Session Notes

| Session | Phase | Completed | Notes |
|---|---|---|---|
| 1-31 | Phases 1-20 + REV18 | Mar 6 -- Jul 14 | See REV18/REV20 (archive). |
| 32 | Phase 21 | Jul 17 | Stats expansion + draft fixes S5/S6. `1dd908a`, OTA'd. |
| 33 | Phase 22 | Jul 17 | Stats compaction + type filter pills. `528d060`, OTA'd. |
| 34 | Phase 23 | Jul 18 | `a66a3e5` (S16/S15/N3), `1f59960` (typography). OTA'd. |
| 35 | Phase 24 Parts 0-4 | Sep 12 | Multi-season model, shared filter, selectors, comparison card, season CRUD. `004217c`. NOT OTA'd at the time. |
| 36 | Planning (Claude.ai) | Oct 23 -- Nov 3 | Backlog triaged; Duo plan v1.2 -> v1.5 (split pages, v2 look, closed layouts, native bars from real Duo screenshots; workflow + Phase 26A added; $99 dev account declined). REV23. No code. |
| 37 | Phase 24 Parts 5-6b + Phase 26 + 26A prep (Claude.ai cloud session) | Nov 10 | Backup (Oct 10 export) verified: 40 / 125 / 174.1. Built on branches `phase26` (app) and `phase26a` (automation) in a cloud clone; tsc + checks run against the PC's node_modules via the device link; independent reviewer pass. Push to GitHub refused (no Claude GitHub App) -> branches delivered into the PC repo via git bundle. Decisions: goal-based 190 bands; split leaves grey-not-red; export JSON only; compact layout under 760pt; OTA workflow manual-only for now; NICE takes all accepted (6 keeps built); Phase 27 = Mac build (no Expo cloud build); Mac add-ons M1-M3 yes, M4 keep icon + update splash, M5 skip. REV24 + plan v1.6. Not merged, not shipped. |
| 38 | Phase 27 part 1 (Claude Code, PC) | Nov 10 | SDK 54 -> 58 step by step (each step: doctor + check + iOS bundle), React Navigation codemod, splash -> plugin, ReanimatedSwipeable, async `File.write` awaited, add-ons M1/M2/M3/M6, NativeTabs + per-tab stacks, Mac preflight Node check. `phase27` @ `edac19e` pushed. SDK 58 npm ERESOLVE -> Marcus chose one-time `--legacy-peer-deps`. Not shipped. |
| 39 | Phase 27 Mac build + docs sync (Claude.ai, iOS app) | Nov 10 | CI on `phase27` confirmed via REST; `backup.ts` diff checked. Mac a day early: Node 25 -> `node@24`, setup + Archive clean (Xcode 27.2), `package` -> `mBowl-2.0.0.ipa`; `gh` re-auth with a classic PAT -> GitHub Release `v2.0.0` @ `467d73e`. Master's docs commit merged into `phase27`. START HERE rewritten with NEXT steps; project docs synced. Duo install + data move next. |

---

## Post-v1 Backlog

- Export as CSV of games (optional; JSON export is built).
- Cut Oct 23: iCloud sync, Practice-type removal, H+I pin-heat redesign, home screen widget, app icon refinement.

---

## End-of-Session Protocol

`/ship` runs this (Phase 26A is merged). By hand:
1. `npm run check` green.
2. Commit + push.
3. Update this brief (bump the REV, add a Session Notes row).
4. Update the CLAUDE.md pointer to the new REV (all three locations).
5. **Upload the new brief to the Claude.ai project.** Claude in the Claude.ai project can do this directly -- ask it.
