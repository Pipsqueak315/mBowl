# mBowl -- Session Brief REV24
**Full spec lives in:** mBowl-SPEC.md -- read it before writing any code.
**Duo roadmap + locked design spec:** `docs/mBowl-DuoPlan.md` (v1.6) -- Phases 25-28.
**Last updated:** November 10, 2026

---

## START HERE (Nov 10, 2026)

**Where things are:**
- **`master` is unchanged at `cfd90e1`** (Phase 24 Parts 0-4 code = `004217c`). Nothing has been merged.
- **All Phase 26 work is built, checked and reviewed, but NOT merged and NOT shipped.** It sits on two local branches in the PC repo (`C:\Users\marcus\Desktop\mBowl`):
  - **`phase26`** (8 commits on `cfd90e1`, tip `889a231`, app code, all OTA-safe): Phase 24 Parts 5/6/6b + N15, Export button + `.gitattributes`, N4 + swipe-back confirm, screen-size proofing, reviewer fixes, NICE keeps (N2/N6/N7/N10/N12/N14). **Contains one Level 2 change (N7, restore) -- needs Marcus's explicit "ship it".** See "Phase 26 -- what's on the branch" below.
  - **`phase26a`** (1 commit on top of `phase26`, tip `18a2e23`, no app code): Phase 26A automation files -- `npm run check`, hooks, skills, reviewer agent, CI, manual-only OTA workflow.
- **Both branches are on GitHub (pushed Nov 10, 11:32, after Marcus installed the Claude GitHub App).** First CI run on `phase26a` passed (`npm ci` + `npm run check` on GitHub). Cloud sessions can now push and open PRs. Minor follow-up: bump `actions/checkout` / `actions/setup-node` to versions that run on Node 24 (GitHub deprecation notice).
- **Uncommitted docs on the PC working tree:** this brief, `CLAUDE.md`, `docs/mBowl-DuoPlan.md`, `docs/design/` (35 renders), REV23. Commit them on `master` (commands below). The 3 "modified" files `log.tsx` / `balls.js` / `seeds.js` are CRLF line-ending noise only -- discard with `git checkout --` before switching branches (the `.gitattributes` on `phase26` stops it recurring).
- **Phones:** the old phone has all the data and is on Phase 23 (or Phase 24 Parts 0-4 -- still unconfirmed; a "Winners 26" season pill on Stats = 0-4 shipped). **The Duo is not set up yet** (Phase 25 not started).
- **Backup verified Nov 10:** `mBowl-backup.json` exported 2026-10-11 from the old phone = **40 sessions, 125 games, avg 174.1, high game 253, best 3-game series 620**. Seasons: Winners 25 = 24, Jubilee 26 = 13, Winners 26 = 3 (Sep 12, Sep 19, Oct 10). 74 games with frames, 650 frames with pins, 10 balls. Marcus says Oct 10 is the last time he used the app, so this file is complete.
  - **Missing Winners 2026 weeks** (never logged in the app): Wk 3 Sep 26, Wk 4 Oct 3, and Oct 17 / 24 / 31 / Nov 7 if bowled. Backfill later from SyncPassport scorecards -- Marcus will send them. Not blocking.
- **Next league night: Sat Nov 14 -- v2 sprint in progress (see SPRINT below).**

**SPRINT -- v2 by league night Sat Nov 14 (decided Nov 10: "Full v2 sprint", Mac on Wednesday).**
Rule change Marcus approved: the 3-day native freeze is waived for the **Duo only** this week, because the **old phone is the guaranteed fallback** -- it keeps all data on the current 1.0.0 build and **nothing is published to the 1.0.0 runtime this week** (phase26 rides inside the v2 build instead of being OTA'd). v2 is version 2.0.0, so its OTA updates can't reach the old phone.

| When | Who / where | What |
|---|---|---|
| **Tue night** | Marcus, PC | Push: run the commands below. Check the Mac's macOS can run **Xcode 27.1** and, if possible, start the Xcode download (10+ GB -- the slow part). |
| **Tue night -> Wed AM** | Claude Code on the **PC** (npm works there; it does NOT work in cloud sessions) | Paste prompt "Phase 27 part 1" below: pull `master` (phase26 + phase26a already merged by Claude, Nov 10), branch `phase27`, SDK 54->58 one step at a time with `npm run check` each step, version 2.0.0, M1-M3 add-ons, native tabs, splash. Push `phase27`. |
| **Wed** | Marcus on the **Mac** -- **bare minimum: paste one Terminal command** (below) | `scripts/mac-build.sh` does the whole Mac part: preflight -> `npm ci` -> `prebuild --clean` + CocoaPods -> unsigned `xcodebuild archive` -> `mBowl-2.0.0.ipa` -> copies it to iCloud Drive / GitHub Release. Claude Code is NOT on the Mac (decided Nov 10) -- if anything fails, paste the error to Claude in the iOS app. Claude updates REBUILD.md afterwards. |
| **Wed night** | Marcus, PC + Duo | iloader: install v2 on the **Duo** (skip installing the old build there). Move data with plan 25.2 using the Oct 10 backup; restore BEFORE ever closing the app. Export from the Duo and run `npm run backup-check` -- must read 40 sessions / 125 games / 174.1. |
| **Thu-Fri** | Claude (cloud or PC) + Marcus checking on the Duo | Phase 28 over the air to the 2.0.0 runtime only (`npm run ship:ota`), **in this priority order, each shipped only after Marcus checks it**: (1) Log Frames on the cover screen (league-critical), (2) Stats, (3) History, (4) open-screen page pairs + Live game button, (5) v2 visual pass. Whatever isn't verified waits. |
| **Fri 8pm** | Marcus | **Go/no-go.** Duo bowls Saturday only if: counts match the backup; a full practice game logs end to end in Pins mode on the cover screen (then delete it); Export Backup works. Otherwise bowl on the old phone. |
| **Sat** | Marcus | League on the winner. If the old phone was used: after league, Export on the old phone -> Restore on the Duo (Duo must have logged nothing new). Set Target Average 190 / Series 570 on whichever phone is used. |

**Who does what (goal: Claude does everything it can; Marcus only does what needs hands, eyes, or a decision):**

| Who | Can do | Can't do |
|---|---|---|
| **Claude from the phone** (Claude.ai project session, linked to the PC) | Write code on branches; typecheck + `npm run check` against the PC's node_modules through the link; drop branches into the PC repo; update docs + project; read backups (`backup-check`); Phase 28 layout code once `phase27` exists. **With the Claude GitHub App installed:** push branches + open PRs. **With `EXPO_TOKEN` in GitHub:** ship OTA by running the OTA workflow after your "ship it". | npm installs (no package access), the SDK upgrade, anything on the Mac, iloader, seeing the phone screen. |
| **Claude Code on the PC** | Everything above plus npm installs, the SDK 54->58 upgrade, git push, `npm run ship:ota`. Runs "Phase 27 part 1" end to end on its own. | iloader, the Mac, looking at the phone. |
| **The Mac (no Claude Code there)** | Runs `scripts/mac-build.sh` -- everything Mac-only in one command. | Anything else: debugging goes to Claude in the iOS app (paste the error), REBUILD.md and the GitHub Release are done by Claude afterwards. |
| **Marcus only** | (1) One-time: install the Claude GitHub App + add the `EXPO_TOKEN` secret (~10 min, unlocks Claude doing pushes + ships from the phone). (2) Start the PC Claude Code session with the paste prompt. (3) Mac: paste one Terminal command; only if it stops, run the one fix command it prints (Xcode first-launch, Node, or CocoaPods) and re-run. (4) iloader install on the Duo (phone plugged into the PC). (5) Phone-side data move (AirDrop, Files, Restore) + Settings goals. (6) Check each screen on the Duo, say "ship it", Friday go/no-go. | -- |

**DONE Nov 10, 12:11 (Claude, via the PC link):** docs committed on `master` as `08323d7` and pushed; both branches pushed; CRLF noise discarded; PC working tree clean. `EXPO_TOKEN` secret added and verified (signs in as pipsqueak315). Xcode 27.1 / macOS check done by Marcus. **12:25: Claude also merged `phase26` + `phase26a` into `master` (nothing shipped), bumped the GitHub check tools to v5, and added `scripts/mac-build.sh` (Mac day = one Terminal command).** **Remaining tonight: only the "Phase 27 part 1" prompt on the PC.** The commands below are kept for reference only -- do not re-run them.

**Tonight's push (PowerShell, one line at a time):**
```
cd C:\Users\marcus\Desktop\mBowl
git checkout -- "app/(tabs)/log.tsx" src/balls.js src/seeds.js
git add CLAUDE.md mBowl-SessionBrief-REV23.md mBowl-SessionBrief-REV24.md docs/mBowl-DuoPlan.md docs/design
git commit -m "docs: REV24, Duo plan v1.6, design renders"
git push
git push -u origin phase26
git push -u origin phase26a
```

**Paste prompt -- "Phase 27 part 1" (Claude Code on the PC):**
```
Phase 27 sprint, part 1 (PC). Read CLAUDE.md, mBowl-SessionBrief-REV24.md (SPRINT section), and docs/mBowl-DuoPlan.md Phase 27 + 27.0.
Do NOT run eas update or npm run ship:ota. Nothing goes to the 1.0.0 runtime this week.
1. git checkout master, git pull (Claude already merged phase26 + phase26a and added scripts/mac-build.sh). Run npm ci, then npm run check (must be green).
2. Create branch phase27 from master.
3. Upgrade Expo SDK 54 -> 55 -> 56 -> 57 -> 58, one step at a time: read Expo's upgrade notes for that SDK, then
   npx expo install expo@^<N>.0.0 and npx expo install --fix. Run npm run check after each step and commit each step.
   If a step fails twice, stop and report.
4. app.json: version 2.0.0, ios.buildNumber 2, orientation "default". Add expo-screen-orientation (lock to portrait at
   startup in app/_layout.tsx; Phase 28 unlocks it over the air), expo-document-picker (dependency only for now),
   expo-keep-awake (keep the screen on while app/log-frames.tsx is open).
5. Native tabs (plan 27.4): first confirm the Expo Router native-tabs API on SDK 58. If unclear or broken, keep the
   current JS tab bar and report -- don't let this block the build.
6. Splash (27.5): show the current app icon; delete the orphaned assets/images/splash-icon.png (N11).
7. npm run check green, then push phase27 and report: done / blocked / anything I must check on the Mac.
```

**Mac day -- paste into Terminal (one block; the Mac's zsh supports `&&`):**
```
cd ~ && rm -rf mbowl-build && git clone https://github.com/Pipsqueak315/mbowl.git mbowl-build && cd mbowl-build && git checkout phase27 && bash scripts/mac-build.sh
```
- The repo is private: if `git clone` asks to sign in, run `gh auth login` first (or use a GitHub personal access token as the password).
- It prints each step as it goes (the script's header explains every step -- that's the learning part).
- If it stops, it prints the one fix command (e.g. `sudo xcodebuild -runFirstLaunch`, Node, or CocoaPods). Run it and paste the block again.
- If the unsigned archive fails, send Claude the last lines it prints. The fallback is REBUILD.md's Xcode GUI flow (add Apple ID -> Product -> Archive).
- Done = `build/mBowl-2.0.0.ipa`, copied to iCloud Drive -> mBowl Builds (and to GitHub Releases if the GitHub CLI is signed in).

**OTA classification (phase26 by itself):** everything on `phase26` is pure JS/TS -- no native module, no `app.json` change, no new storage key (`KEYS.FRAME_RESULT` keeps the old string). `expo-sharing` is already in the binary (History share).

---

## Phase 26 -- what's on the branch (Nov 10)

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

N3 shipped in Phase 23; N4 and N15 are done on `phase26`. **Keeps built in `972445d`** (N6 is the REBUILD.md line; used on the Mac trip). N7 turned out to matter more than the audit said: `app/_layout.tsx` *recovers from* the shadow keys on launch when the primary reads back empty, so after a fresh-install restore a stale shadow (the 18 seeds) could have been "recovered" instead of the real data. **Residual:** the Phase 25 restore runs on the OLD build, so on the Duo the shadow still holds the seeds until the first session is saved (any save rewrites it) or Restore is run once more after the OTA lands.

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
- app/(tabs)/_layout.tsx controls the bottom tab bar.
- app/index.tsx is a redirect to /(tabs)/log -- required for Expo Go.
- Windows machine: always write files using a JS file via node. Never use python or bash heredoc.
- PowerShell does not support && -- run commands one at a time. Multi-line commit messages: write to a file and use `git commit -F`.
- `app.json` has `"orientation": "portrait"` and `supportsTablet: false` -- both are native fields; Duo landscape needs Phase 27.

### Architecture Patterns

- **Seasons (Phase 24) -- multi-season, gapless, read-time.** `src/seasons.ts` owns the model. `DEFAULT_SEASONS` (winners-2025 / jubilee-2026 / winners-2026) is synthesized in memory when `settings.seasons` is absent -- **never persisted on read** (`mbowl_settings_v1` has no shadow key). Only each season's `start` is stored; `resolveSeasonRanges()` derives each end as (next start − 1 day), last open-ended. `seasonForDate()` / `currentSeason()` map a date / today to a season. Membership is derived from `session.date` at read time -- nothing written onto sessions, no `seasonId`, no migration. `seasonStart`/`seasonEnd` are **left untouched** and still drive **week auto-suggest** (log.tsx) -- do not rewire that.
- **Shared session filter (Phase 24 Part 0):** `src/sessionFilter.ts` exports `filterSessions(sessions, seasonSel, seasons, typeFilter)` + `ALL_TIME` + `TypeFilter`/`SeasonSelection`. **Single implementation used by both Stats and History.** Season selection is non-persistent, reset to the current season on each focus, like the type pills.
- **Season comparison (Phase 24 Part 3):** selected season vs its predecessor via `computeSeasonMetrics()`. Frame-derived deltas suppressed below `MIN_FRAME_GAMES` (10) games with frame data on either side.
- **Stat colors (Phase 24 Part 6, on `phase26`):** `CELL_BANDS` + `bandColor()` in stats.tsx for the seven grid cells; `makeableColor` for aggregate Makeable (locked 80/60); `leaveConversionColor(pct, isSplit)` for per-leave rows. Same `MIN_FRAME_GAMES` gate. `avgColor` (180/166) is the locked overall-average rule -- separate.
- **Series rule (Part 6b, on `phase26`):** `threeGameSeriesTotal()` -- High Series and Series Trend use exactly-3-game sessions only.
- **Gear icon:** Each tab injects a headerRight gear via useNavigation().setOptions() in useLayoutEffect. Opens SettingsContent.tsx as a pageSheet modal.
- **Dark theme:** Forced in app/_layout.tsx. StatusBar light.
- **ScalePressable:** Shared animated press component (withSpring damping 15, stiffness 400).
- **Shared mini-scorecard (Phase 23):** `components/FrameGrid.tsx`, `variant: 'compact' | 'full'`. Standing-pin color teal `#00CEC9` via `STANDING_PIN`.
- **Typography scale (Phase 23):** 200 (hero numerals) / 300 (white data) / 400 (threshold-colored ceiling) / 500 (labels) / 600 (emphasis).
- **Storage read states (Phase 20):** `readSessionsResult()` / `readBallsResult()` return `{ status, value }` (`missing|ok|invalid|error`). `[]` alone is never acted on; writers must use the *Result variants. Only `missing` seeds.
- **Split detection (Phase 20):** `isSplit()` in leaveUtils.js, read-time from `pinsStanding`, never persisted. 2-8-10 and 4-7-9 are splits; sleepers (2-8, 3-9) count as adjacent.
- **Throw-notation tokens:** `X` strike, `/` spare, **`—` (em dash, U+2014)** gutter/miss (NOT ASCII `-`), `0`-`9` counts.
- **Advanced stats (Phase 21):** First Ball Avg / Bounce-Back % / Doubles % / Clean Games all read-time via `calcAdvancedStats()`.
- **Backup / export:** `src/backup.ts` `writeBackup()` / `restoreBackup()` / `exportBackup()` (on `phase26`). File `mBowl-backup.json` in `Paths.document`, **visible in Files -> On My iPhone -> mBowl** (`UIFileSharingEnabled`). **TRAP:** `writeBackup()` runs on every cold launch -- on a fresh install, restore a copied-in file BEFORE the app is ever relaunched.
- **Log Frames leave guard (on `phase26`):** `usePreventRemove(isDirty)` + `savedRef`; one "Discard Frames?" for Cancel and swipe-back. `isDirty` = frames differ from the snapshot taken when the screen opened.
- **Compact layout (on `phase26`):** Log Frames `COMPACT_HEIGHT = 760`; PinDeck `compact` prop.
- **Shared types:** src/types.ts is canonical. Do not redefine locally.
- **Storage layer:** src/storage.ts. KEYS object exported -- never write a raw key string at a call site (`npm run check` enforces this on `phase26a`).
- **OTA channel:** app.json carries `expo-channel-name: production`, baked into the binary. Both phones get every OTA.

### Automation (on `phase26a`, not merged yet)
- `npm run check` -> `scripts/checks/run-all.mjs`: TypeScript + `leaves` / `seasons` / `rules` checks (import the REAL app source via Node 22 type stripping + `ts-resolve.mjs`) + the Phase 24 harness on the seeds.
- `npm run backup-check -- <file>`: read-only report of a backup (real season model).
- `npm run ship:ota`: refuses unless on `master`, clean, in sync with origin, and every check passes; then `eas update --branch production`.
- `.claude/settings.json` hooks: block hand-typed `eas update`; block `&&` and heredocs on Windows; run tsc after every .ts/.tsx edit (~25s on the PC).
- Skills `/feature`, `/ship`, `/audit`, `/backup-check`; agent `reviewer` (read-only).
- `.github/workflows/ci.yml` (every push/PR); `ota.yml` **manual dispatch only** until the `EXPO_TOKEN` secret + 26A.8 dry run.

---

## Phase Details -- Recent

> Phases 1-19 carried in REV18/REV20; Phase 20 fix-session detail in REV21; Phase 20-23 headers below.

### Phase 24 -- Multi-Season Support, Season Comparison, Color Thresholds
- **Parts 0-4** -- Sep 12, `004217c` (on `master`; OTA status unconfirmed).
- **Parts 5 / 6 / 6b** -- Nov 10, on branch `phase26` (see the table above). Not merged, not shipped.

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

> **Done on `phase26` (not shipped):** swipe-back confirm, N4, N15. **Shipped earlier:** S5, S6 (Ph 21); S15, S16, N3 (Ph 23).

---

## Open Questions

| Question | When |
|---|---|
| House shot exact specs (length + volume) | Verify with house sheet before updating Patterns in-app |
| Did Phase 24 Parts 0-4 ever reach the old phone? | Look for season pills on Stats. Moot once `phase26` ships. |
| SF Pro or SF Pro Rounded for big numbers | Phase 28.4 |

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

---

## Post-v1 Backlog

- Export as CSV of games (optional; JSON export is built).
- Cut Oct 23: iCloud sync, Practice-type removal, H+I pin-heat redesign, home screen widget, app icon refinement.

---

## End-of-Session Protocol

Once `phase26a` is merged, `/ship` runs this. Until then, by hand:
1. TSC clean (`npx tsc --noEmit`) -- or `npm run check` once `phase26a` is merged.
2. Commit + push.
3. Update this brief (bump the REV, add a Session Notes row).
4. Update the CLAUDE.md pointer to the new REV (all three locations).
5. **Upload the new brief to the Claude.ai project.** Claude in the Claude.ai project can do this directly -- ask it.
