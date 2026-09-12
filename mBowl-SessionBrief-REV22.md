# mBowl -- Session Brief REV22
**Full spec lives in:** mBowl-SPEC.md (Project folder) -- read it before writing any code.
**Last updated:** September 12, 2026

---

## Current Status

**Phase:** Phase 24 -- multi-season support, season comparison, color thresholds. **Parts 0-4 COMPLETE and pushed. Parts 5 / 6 / 6b are OPEN and blocked on data** (see the OPEN section below).
**Last completed:** Sep 12, 2026 -- Phase 24 **Parts 0-4** committed + pushed as **`004217c`**. **NOT shipped OTA** -- the phone deliberately stays on **Phase 23** for tonight's league session. No `eas update` was run.
**Code HEAD:** **Phase 24 Parts 0-4 code HEAD is `004217c`.** The REV22 docs/tooling commit (this brief + SPEC deltas + CLAUDE.md pointer + the verification harness + audit N15 + `.gitignore`) sits on top -- same docs-on-top-of-code-HEAD pattern as prior REVs. When auditing, confirm the last *code* commit is `004217c` and anything above it is docs/tooling only.

> ### ⚠️ CRITICAL FOR TOMORROW -- READ BEFORE RUNNING THE HARNESS
> **I am bowling tonight (Sep 12). The reconciliation assertion becomes `24 / 13 / 1 = 38`, NOT `24 / 13 / 0 = 37`.** Tonight's league session lands in **Winners 2026** (starts 2026-09-12), taking it from 0 → 1 and the grand total from 37 → 38. **Do not run the harness against the old 24/13/0=37 numbers.** The harness now takes the counts as a parameter -- tomorrow's run is a one-line input change:
> ```
> node scripts/phase24-verify.mjs --expect 24,13,1 --at-avg <x> --at-games <x> --at-sessions 38 --at-league-avg <x> --at-league-games <x>
> ```
> (The `--at-*` anchors are the real pre-Phase-24 All-Time values from the export; omit any you don't have and that check is simply skipped.)

**OTA classification:** whole phase is **pure JS/TS** -- no native modules, no `app.json` change, no new storage keys (`seasons` is an *additive field inside* `mbowl_settings_v1`). Ships via `eas update --branch production` **when unblocked and approved** -- not tonight.

---

## OPEN -- Phase 24 remaining work (all blocked on tonight's data)

**Do not attempt these until the post-league-session export exists.** The whole point of the Part 5 gate is to verify thresholds against real per-season output before baking them in.

| Item | State | Unblock condition |
|---|---|---|
| **Part 5 -- reconciliation** | Harness built + parameterized. Ran on 18 seeds: gapless ✓, NaN-free across season×type incl. empty ✓, All-Time structural (== full set) ✓. **Cannot** assert the real bucket counts or the numeric All-Time anchors, and **boundary-session placement is unexercised** (no seed sessions near any boundary). | Drop the real export at `docs/phase24-data.json` (gitignored). Then run with **`--expect 24,13,1`** (see critical note above). Buckets must sum to **38**; if not, STOP -- a boundary is wrong. |
| **Part 6 -- seven-cell color thresholds** | Not started. Bands proposed in the phase prompt; sample-size gate = no color below 10 games with frame data. | Runs *after* Part 5 confirms the bands against real season values. Cells: First Ball, Strike %, Doubles %, Clean %, Spare %, Opens/G, Bounce-Back %. |
| **Part 6b -- High Series / Series Trend exclude** | Not started. **Approved** (exclude approach): restrict High Series card + Series Trend chart to 3-game sessions; High Game card unaffected. | Can land alongside Part 6. Motivated by the 8-game tournament's 1435 series blowing out the y-axis. |

**Locked decisions (do not relitigate):**
- **Part 6b approved** via the exclude approach.
- **Makeable band stays at shipped `conversionColor` green ≥80 / orange ≥60 / red <60.** Do **not** adopt the prompt's 75/65 proposal.
- **New bands apply to the seven uncolored cells only.** `conversionColor` is **untouched** -- it's shared with per-leave conversion rows, logged as **N15** (`docs/PHASE20-AUDIT.md`) to be split into two bands post-phase.

**The four metric definitions (read from source, for the Part 6 bands):**
- **Bounce-Back %** = frame after an OPEN that scored a **MARK** (strike *or* spare); anchors frames 1-9, no game-boundary crossing. (Mark-based → runs higher than a strike-only definition; the 72/80 band is calibrated to that.)
- **First Ball Avg** = mean pins on `throws[0]` of **every** frame incl. the 10th; **excludes** 10th-frame fill balls. `X`=10, `—`=0.
- **Clean Games** = games with zero open frames; **denominator = games WITH frame data** (not all games) → hence the ≥10-frame-game gate.
- **Spare %** = spares / non-strike frames in frames 1-9; **splits ARE in the denominator** (Makeable excludes them, Spare does not).

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
- PowerShell does not support && -- run commands one at a time. Multi-line commit messages: write to a file / heredoc and use `git commit -F`.

### Architecture Patterns

- **Seasons (Phase 24) -- multi-season, gapless, read-time.** `src/seasons.ts` owns the model. `DEFAULT_SEASONS` (winners-2025 / jubilee-2026 / winners-2026) is synthesized in memory when `settings.seasons` is absent -- **never persisted on read** (`mbowl_settings_v1` has no shadow key). Only each season's `start` is stored; `resolveSeasonRanges()` derives each end as (next start − 1 day), last open-ended. `seasonForDate()` / `currentSeason()` map a date / today to a season. Membership is derived from `session.date` at read time -- nothing written onto sessions, no `seasonId`, no migration. `seasonStart`/`seasonEnd` are **left untouched** and still drive **week auto-suggest** (log.tsx) -- do not rewire that.
- **Shared session filter (Phase 24 Part 0):** `src/sessionFilter.ts` exports `filterSessions(sessions, seasonSel, seasons, typeFilter)` + `ALL_TIME` + `TypeFilter`/`SeasonSelection`. **Single implementation used by both Stats and History** -- no divergent copies (the S16 lesson). `seasonSel` is a season id or `ALL_TIME`; season selection is **non-persistent**, reset to the current season on each focus, exactly like the type pills.
- **Season comparison (Phase 24 Part 3):** Stats' below-the-fold Season Comparison card = selected season vs its predecessor, via `computeSeasonMetrics()` over two filtered sets (reuses `calcMetrics`/`calcAdvancedStats`/`computeLeaveStats` -- no new metric logic). Frame-derived deltas are suppressed when either side has < 10 games with frame data (`MIN_FRAME_GAMES`); coverage shown as `N/M fr`. Hidden on All-Time or when the selected season has no predecessor.
- **Gear icon:** Each tab injects a headerRight gear via useNavigation().setOptions() in useLayoutEffect. Opens SettingsContent.tsx as a pageSheet modal.
- **Dark theme:** Forced in app/_layout.tsx. StatusBar light.
- **ScalePressable:** Shared animated press component (withSpring damping 15, stiffness 400).
- **Shared mini-scorecard (Phase 23):** `components/FrameGrid.tsx`, `variant: 'compact' | 'full'`. Standing-pin color unified to teal `#00CEC9` via `STANDING_PIN`.
- **Typography scale (Phase 23):** app-wide 200 (hero numerals) / 300 (white data + numeric inputs) / 400 (threshold-colored ceiling) / 500 (labels/eyebrows/inactive) / 600 (emphasis). 700/800 eliminated. `stats.tsx` is the reference and is untouched.
- **Stats memos:** filtered, metrics, chart points, leaveStats, histogram, ballStats, gameByGameStats, advancedStats, sortedLeaves, avgGoalDelta, **comparison** -- all `useMemo`, all keyed off `filtered`. The season + type filters are applied at the **single `filterSessions` choke point** inside the `filtered` memo.
- **Stats controls (Phase 24 update):** the old binary Season/All segmented control is replaced by **two pill rows** -- season selector (each season short + All-Time) above, type pills below. Both non-persistent, reset to current-season / All each visit.
- **Storage read states (Phase 20):** `readSessionsResult()` / `readBallsResult()` return `{ status, value }` (`missing|ok|invalid|error`). `[]` alone is never acted on; writers must use the *Result variants. Only `missing` seeds.
- **Split detection (Phase 20):** `isSplit()` in leaveUtils.js, read-time from `pinsStanding`, never persisted. 2-8-10 and 4-7-9 are splits; no `NEVER_SPLIT` override.
- **Throw-notation tokens (source = log-frames.tsx scorer):** `X` strike, `/` spare, **`—` (em dash, U+2014)** gutter/miss (NOT ASCII `-`), `0`-`9` counts. Any pin-value metric must treat `—` as 0.
- **Advanced stats (Phase 21):** First Ball Avg / Bounce-Back % / Doubles % / Clean Games all read-time via `calcAdvancedStats()`. **Seven stat cells are still white-only -- color thresholds are Phase 24 Part 6 (OPEN).**
- **Auto-export:** src/backup.ts `writeBackup()`/`restoreBackup()`. Writes `mBowl-backup.json` to `Paths.document` (the app's sandboxed Documents dir; exact URI logged as `[backup] written to …`). **The file is trapped in the iOS sandbox -- see the Post-v1 Backlog export item.**
- **Shared types:** src/types.ts is canonical (adds `Season` + `Settings.seasons` in Phase 24). Do not redefine locally.
- **Storage layer:** src/storage.ts. KEYS object exported -- never write a raw key string at a call site.
- **OTA channel:** app.json carries `expo-channel-name: production`, baked into the binary.

---

## Phase Details -- Recent

> Phases 1-19 carried in REV18/REV20; Phase 20 fix-session detail reproduced in REV21. This brief carries Phases 20-24 headers; see REV21 for the full Phase 20-23 detail if Knowledge drifts.

### Phase 24 -- Multi-Season Support, Season Comparison, Color Thresholds
**Parts 0-4 completed:** Sep 12, 2026 -- commit `004217c` (committed + pushed; **NOT yet OTA'd** -- phone stays on Phase 23 for tonight's league night). `npx tsc --noEmit` clean.

- **Part 0 -- `filterSessions` extracted** to `src/sessionFilter.ts`, shared by Stats + History. No behaviour change on extraction; then evolved from binary season/all-time mode to a season-id selection.
- **Part 1 -- seasons first-class.** `Season` type + additive `settings.seasons`; `src/seasons.ts` helpers; gapless read-time model; season CRUD in Settings (add/edit/delete, delete needs confirm, at least one season must remain). `seasonStart`/`seasonEnd` untouched.
- **Part 2 -- Stats season selector.** Each season by short label + All-Time; default = current season; non-persistent; applied at the `filterSessions` choke point; empty season hits the existing `!metrics` empty state. **Note:** today (2026-09-12) the current season is **Winners 2026 (0 sessions)**, so the default Stats view is intentionally the empty state until tonight's session lands.
- **Part 3 -- season comparison card** (below the fold; does not disturb the one-screen layout above Score Distribution).
- **Part 4 -- History** gets the same selector + a per-card season label.
- **Part 5 -- verification harness** (`scripts/phase24-verify.mjs`, throwaway, not shipped): parameterized expected counts (`--expect`) + optional All-Time anchors (`--at-*`). Ran clean on seeds for every non-count assertion. **Reconciliation blocked on real data (OPEN).**
- **Parts 6 / 6b -- OPEN** (see the OPEN section).

> **KEY LEARNING -- the current season can be empty by design.** Because seasons are gapless and the newest one is open-ended, "current season" on the day a season rolls over (today) contains zero sessions. Part 2's empty-state path is the intended landing, not a bug -- and it's exactly why the reconciliation flips to 24/13/**1** the moment Marcus bowls tonight.

### Phases 20-23 (headers -- full detail in REV21)
- **Phase 20** (`d48c258`) -- split detection, Makeable Spare %, OTA production channel, 16-agent full-tree audit (`docs/PHASE20-AUDIT.md`), fix sessions A/B/B2/C (read-status states; the "fifth bug" read-modify-write blast radius).
- **Phase 21** (`1dd908a`) -- stats expansion (First Ball / Bounce-Back / Doubles / Clean / Makeable), draft fixes S5/S6, em-dash gutter-token learning.
- **Phase 22** (`528d060`) -- one-screen stats compaction + session-type filter pills (single `filterSessions` choke point), 200/300/500 type scale introduced.
- **Phase 23** -- Part 1 `a66a3e5` (S16 shared FrameGrid, S15 `_archive/` delete, N3 strike-streak), Part 2 `1f59960` (app-wide typography unification, 63 weight-only edits).

---

## Deferred -- ship via `eas update --branch production`

| ID | Item |
|---|---|
| **--** | **Swipe-back bypasses log-frames' own "Discard Frames?" confirm.** UX gap, not data loss. |
| **N4** | `FRAME_RESULT_KEY` lives outside the `KEYS` registry |
| **N15** | *(added Phase 24)* `conversionColor` shared between aggregate Makeable % and per-leave conversion rows -- split into two bands |
| **N1-N15** | Remaining NICE items -- see `docs/PHASE20-AUDIT.md` |

> **Shipped (removed):** S5, S6 -- Phase 21. S15, S16, N3 -- Phase 23.

---

## Open Questions

| Question | When |
|---|---|
| House shot exact specs (length + volume) | Verify with house sheet before updating Patterns in-app |
| Seven-cell color thresholds (First Ball, Strike, Doubles, Clean, Spare, Opens/G, Bounce-Back) | **Phase 24 Part 6 -- verify bands against real per-season values from tonight's export, then apply.** |

---

## Session Notes

| Session | Phase | Completed | Notes |
|---|---|---|---|
| 1-31 | Phases 1-20 + REV18 | Mar 6 -- Jul 14 | See REV18/REV20 (archive). |
| 32 | Phase 21 | Jul 17 | Stats expansion + draft fixes S5/S6. `1dd908a`, OTA'd. |
| 33 | Phase 22 | Jul 17 | Stats compaction + type filter pills. `528d060`, OTA'd. |
| 34 | Phase 23 | Jul 18 | Two commits: `a66a3e5` (S16/S15/N3), `1f59960` (typography). OTA'd. |
| 35 | Phase 24 Parts 0-4 | Sep 12 | Multi-season gapless model (`src/seasons.ts`), shared `filterSessions` (`src/sessionFilter.ts`), Stats + History season selectors, season comparison card, Settings season CRUD. Verification harness built + parameterized; ran clean on seeds (count/anchor/boundary assertions blocked on real data). Committed + pushed `004217c`. **NOT OTA'd -- phone on Phase 23 for league night.** Parts 5/6/6b OPEN, blocked on tonight's export (reconciliation becomes **24/13/1=38**). |

---

## Post-v1 Backlog

- iCloud backup / key-value sync
- **Export sessions to JSON/CSV via `expo-sharing`** -- *(surfaced Phase 24)* the backup file is trapped in the iOS sandbox and there is currently **no way to get session data off the phone** (this is what blocked the Part 5 reconciliation). OTA-safe; `expo-sharing` is already installed (used by the History share card). Not this phase.

---

## End-of-Session Protocol

1. TSC clean (`npx tsc --noEmit`).
2. Commit + push.
3. Update this brief (bump the REV, add a Session Notes row).
4. Update the CLAUDE.md pointer to the new REV (all three locations).
5. **Upload the new brief to the Claude.ai Knowledge folder.** *The step that keeps getting missed -- Knowledge was on REV20 while the tree was at REV21. Do it every time.*
