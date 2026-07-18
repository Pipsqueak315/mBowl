# mBowl -- Session Brief REV21
**Full spec lives in:** mBowl-SPEC.md (Project folder) -- read it before writing any code.
**Last updated:** July 18, 2026

---

## Current Status

**Phase:** Phase 23 complete -- housekeeping (**S16** shared `FrameGrid`, **S15** `_archive/` deletion, **N3** strike-streak gap-break) + **app-wide typography unification** (the Stats 200/300/500 type scale propagated across Log, History, Reference, Settings and their child components)
**Last completed:** July 18, 2026 -- Phase 23 shipped as **two commits**: Part 1 `a66a3e5` (S16/S15/N3), Part 2 `1f59960` (typography unification). Both committed + pushed, shipped OTA to production, confirmed live on device.
**Code HEAD:** **Phase 23 code HEAD is `1f59960`** (Part 2). The REV21 docs commits (this brief + the CLAUDE.md pointer) sit on top -- the same docs-commit-on-top-of-code-HEAD pattern as REV20. A "code HEAD" line in this brief can't cite itself as the literal git HEAD without the doc commit that writes it becoming the new HEAD; so when auditing the tree, confirm the last **code** commit is `1f59960` and that anything above it is docs-only (`git diff --stat 1f59960 HEAD -- '*.ts' '*.tsx' '*.js' '*.json'` should be empty).
**Up next:**
- **Color-threshold calibration for the newer stat cards** (First Ball Avg, Bounce-Back %, Doubles %, Clean Games) -- still white-only on purpose. **Revisit ~early August 2026**, after 2-3 weeks of real logged data, to set green/orange/red bands off actual distributions rather than guesses.
- **Remaining deferred items** -- the swipe-back "Discard Frames?" UX gap, **N4** (`FRAME_RESULT_KEY` outside the `KEYS` registry), and the remaining **NICE** items (`docs/PHASE20-AUDIT.md`). See the Deferred table below.

> **The Mac rebuild is DONE.** The production-channel binary is installed on the phone and OTA delivery is verified end-to-end. Every JS-only change now ships via `eas update --branch production` with **no Mac involvement** -- unless a native module or SDK version changes.

> **Upload REV21 to the Claude.ai Knowledge folder when this session ends.** This is the step that keeps getting missed (REV17 was never uploaded; Knowledge sat on REV16 while the tree moved ahead, causing the drift REV18 had to reconcile). Do not skip it.

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
- PowerShell does not support && -- run commands one at a time. Multi-line commit messages: write to a file and use `git commit -F <file>` (PowerShell here-strings are fragile through the tool boundary).

### Architecture Patterns

- **Gear icon:** Each tab uses useNavigation().setOptions() in useLayoutEffect to inject headerRight gear button. Opens SettingsContent.tsx as a modal (presentationStyle pageSheet).
- **Dark theme:** Forced in app/_layout.tsx (no color scheme check). StatusBar style light.
- **Tab bar:** bg #1C1C1E, borderTopColor #38383A, borderTopWidth 0.5. Active teal, inactive dim.
- **Headers:** bg #000000, tintColor #FFFFFF, shadowVisible false.
- **ScalePressable:** Shared animated press component using withSpring (damping 15, stiffness 400).
- **Pin Deck:** Dual input mode in Log Frames. Pins/Quick toggle. Pin data optional, analytics-only. Post-Game mode defaults to Pins as of Phase 19.
- **Shared mini-scorecard (Phase 23):** `components/FrameGrid.tsx` owns the frame-grid + mini-pin-deck JSX/logic once. `variant: 'compact' | 'full'` selects between Log's compact wrapped boxes and History's connected bordered scorecard (each byte-identical to its original). Standing-pin color is a single `STANDING_PIN` constant (**teal `#00CEC9`**, matching the canonical Stats `LeaveMiniPinDeck`) so the two decks can't re-diverge. Used by `log.tsx` (compact) and `history.tsx` expanded card + share card (full). Replaces the previously duplicated-and-diverged copies (audit S16).
- **Typography scale (Phase 23):** app-wide **200** (hero numerals) / **300** (white data values + editable numeric inputs) / **400** (threshold-colored values -- the legibility ceiling) / **500** (labels, eyebrows, section headers, list-names, inactive controls) / **600** (emphasis: active/selected controls, primary CTAs, nav/modal/sheet titles, badges, teal action links). **700/800 eliminated.** `stats.tsx` is the reference and is untouched. Applied **by role** -- color-coding colors + all threshold logic (score-vs-average, series bands, overall-average bands) are unchanged; only the weight on colored values moved to the 400 ceiling.
- **Draft persistence:** Includes all form fields, frame data, and pinsStanding arrays. writeDraft(null) calls removeItem, not setItem. Draft validated on read by checking sessionType field. **Auto-save gated on `draftHasContent()` (Phase 21 / S5-S6)** -- an empty/default form is never persisted, and the guard SKIPS rather than writing null, so a real persisted draft is preserved.
- **Date storage:** formatDateISO uses local time (getFullYear/getMonth/getDate), not toISOString(). No UTC offset bug. **Do not regress this** -- it is re-checked every audit.
- **Stats memos (Phase 22):** filtered, metrics, seriesChartPoint, gameChartPoint, leaveStats, histogram, ballStats, gameByGameStats, advancedStats, sortedLeaves, avgGoalDelta all memoized with useMemo. The **session-type filter is threaded into the single `filterSessions` call inside the `filtered` memo** -- every downstream memo depends on `filtered`, so one choke point filters the entire tab with AND logic against the season window. Not persisted -- resets to All each visit.
- **Stats layout (Phase 22):** everything through Score Distribution targets one iPhone screen -- controls row (Season/All segmented + type pills) → hero strip (Average @ weight 200 + High Game/High Series slim cards) → STRIKING and SPARES & RECOVERY as 4-across compact cells → Series Trend (100pt) → Score Distribution (above the fold, empty ranges hidden). Below fold: Game-by-Game Trend → By Ball → By Game Number → Leaves. **This is the reference for the Phase 23 typography scale -- do not re-weight stats.tsx.**
- **Ball picker:** Sorted weakest to strongest. Empty state message if no active balls. Reloads balls on picker open (not just mount) -- A1 fix.
- **Season start:** Derived from settings.seasonStart at runtime. No hardcoded date.
- **Shared types:** src/types.ts is the canonical source for ThrowEntry, FrameData, GameEntry, Session, Ball, Settings, DraftData. Do not redefine these locally.
- **Storage layer:** src/storage.ts (TypeScript). KEYS object exported -- **never write a raw key string at a call site**. All functions fully typed.
- **Storage read states (Phase 20):** reads report a status, not a bare array. `readSessionsResult()` / `readBallsResult()` return `{ status, value }` where status is `'missing' | 'ok' | 'invalid' | 'error'`. **`[]` alone is never acted on.** `readSessions()` keeps its old array signature for display-only callers; **anything that WRITES must use `readSessionsResult()`.** See Phase 20 / Session C below.
- **Split detection (Phase 20):** `isSplit()` in leaveUtils.js is the single source of truth. Derived at **READ TIME** from `pinsStanding` -- never persisted, never stored on a session. Applies retroactively across all existing pin-logged history. No second adjacency map or split heuristic may exist anywhere.
- **Throw-notation tokens (source of truth = log-frames.tsx scorer):** `X` = strike, `/` = spare, **`—` (em dash, U+2014) = gutter/miss** (NOT the ASCII hyphen `-`), `0`-`9` = pin counts. **Any frame-derived metric that reads pin values must treat `—` as 0**, exactly as `pinsForThrow` does. See Phase 21 KEY LEARNING.
- **Advanced stats (Phase 21):** First Ball Avg / Bounce-Back % / Doubles % / Clean Games all derived at READ TIME from frames/pinsStanding via `calcAdvancedStats()` in stats.tsx. No storage keys, no schema change, no persisted derived values. **White values only -- color thresholds deferred to calibration.**
- **Auto-export:** src/backup.ts exports writeBackup() and restoreBackup(). writeBackup() called non-blocking (void) after every meaningful write. Both guard against degrading good data -- see Phase 20 / Session C.
- **Cert reminder:** src/notifications.ts exports scheduleCertReminder(). Called non-blocking (void) in _layout.tsx after writeBackup(). Repeating iOS local notification every 6 days. Identifier: sidestore-cert-reminder.
- **Frame editing from History:** Dismiss-and-return pattern. EditSessionModal closes → history.tsx useEffect pushes to log-frames → useFocusEffect return reads FRAME_RESULT_KEY, reopens modal with updated data. `pendingFrameEditRef` + `shouldPushFramesRef` guard the flow. **The guard is load-bearing** -- see Session B2.
- **Share card:** SessionCard in history.tsx renders an off-screen ShareCardView via react-native-view-shot captureRef(), then expo-sharing shareAsync(). iOS only. Uses the shared `FrameGrid` in `full` mode.
- **Goals in Settings:** Target Average (0-300) and Target Series (0-900) stored as targetAverage / targetSeries in Settings.
- **TypeScript stub:** components/ui/icon-symbol.tsx exists as a re-export stub for TypeScript resolution. Metro resolves to icon-symbol.ios.tsx at runtime. (The stale `_archive/` copy was deleted in Phase 23 / S15.)
- **OTA channel (Phase 20):** app.json carries `updates.requestHeaders { "expo-channel-name": "production" }`. **Baked into the current binary** -- OTA resolves the production branch correctly on device.
- **Local settings untracked (Phase 21):** `.claude/settings.local.json` is per-machine and is gitignored + untracked. Do not re-add it.

---

## Build Schedule

| # | Phase | Est. Time | Chats | Status |
|---|---|---|---|---|
| 1-13 | Setup → Leave Stats | -- | -- | Complete (see REV17 archive for detail) |
| 15A-D | Session Edit, Stats Extensions, Pocket My Data, audit | -- | -- | Complete |
| 14 | EAS Update -- Expo Go Deploy | 30-45 min | 1 | Complete |
| 16A/16B | Log Frames QOL / Senior SWE Audit | -- | -- | Complete |
| 17 | Auto-export JSON backup | 30 min | 1 | Complete |
| 18 | SideStore cert notification | 20 min | 1 | Complete |
| 19 | Log QOL, frame editing, share, decay, goals, restore | 90-120 min | 1 | Complete |
| 20 | Split detection, Makeable Spare %, OTA channel, full-tree audit + fixes A/B/B2/C | 5 sessions | 5 | Complete |
| -- | Mac rebuild (production-channel IPA) | 1 Mac trip | 1 | Complete |
| 21 | Stats expansion + deferred draft fixes S5/S6 | 1 | 1 | Complete |
| 22 | Stats compaction redesign + session-type filter pills | 1 | 1 | Complete |
| 23 | Housekeeping (S15 `_archive`, S16 shared FrameGrid, N3 streak) + app-wide typography unification | 1 | 1 | Complete |

---

## Phase Details -- Recent

> Phases 1-19 and the Post-REV17 reconciliation are carried in REV18/REV20. The **Phase 20 fix-session detail is reproduced in full below** -- it is the hardest-won knowledge in the project and must not depend on older briefs staying reachable in Knowledge.

### Phase 20 -- Split Detection, Makeable Spare %, OTA Channel, Full-Tree Audit + Fix Sessions
**Completed:** July 14, 2026 -- commit `d48c258` (committed + pushed to origin/master)

**Phase 20 core (unchanged since it landed):** `isSplit()` + `PIN_ADJACENCY` in `src/leaveUtils.js`, derived at **READ TIME** from `pinsStanding`, never persisted -- so split detection is retroactive across all pin-logged history and can never drift from the pin set. **RULING (a bowling decision, not code):** 2-8-10 and 4-7-9 classify as **splits** (each strands a pin the others cannot reach); no `NEVER_SPLIT` override exists or should be added. **Makeable Spare % = any non-split leave**; splits are excluded from the denominator entirely (not counted as misses); null when there are no makeable leaves. **OTA production channel** (`app.json` `expo-channel-name: production`) -- this IS SideStore-plan Phase 4.

#### The 16-agent full-tree audit (`96c1ce3`)

- 4 tiers, true-parallel read-only subagents, plus a mandatory hallucination-filter verification pass.
- 31 candidate findings → **2 cut as false positives** → **29 actionable** (1 MUST, 14 SHOULD, 14 NICE), recorded in `docs/PHASE20-AUDIT.md`.
- **Phase 20's own additions came back clean.**
- The two cuts: **S7** (shared `FRAME_RESULT_KEY` cross-tab corruption -- unreachable, see Session B2) and **S8** (`writeReference` not awaited before `writeBackup` -- AsyncStorage's serial native queue makes it safe).

#### Fix Session A -- log-frames.tsx (M1, S1, S2)

- **M1 -- over-fill of a complete frame silently corrupted the saved score.** The input lock was pushed **down into the pure functions** so callers cannot bypass it.
- **S1 -- `allComplete` checked only the 10th frame.** Now gates on all 10 frames.
- **S2 -- count-chip off-by-one.** Fixed to `i < 10 - t1Pins`.
- **`handleDone` null-score backstop** added.

> **KEY LEARNING -- M1 and S1 had to land together.** They are coupled through the same completion predicate; fixing either in isolation moves the corruption rather than removing it.

#### Fix Session B -- history.tsx + EditSessionModal.tsx (S3, S4)

- **S3 -- unsaved field edits discarded on the frame-editor round trip.** Fix: `handleSave`'s session-builder extracted into **`buildSession()` in EditSessionModal.tsx and reused by both paths** -- the Edit Frames snapshot cannot drift from what Save writes.
- **S4 -- Cancel silently dropped the just-made frame edit.** Fixed with an `initiallyDirty` prop.
- **Bonus fix:** `priorScores` was reading stale pre-edit scores.

#### Fix Session B2 -- frame-editor cancel boundary

- **Cancel is inferred from the ABSENCE of `FRAME_RESULT_KEY`, not from a marker written on cancel.** Swipe-back never runs the header Cancel handler, so inference from an absent key is exhaustive by construction.
- **`log.tsx` consumes `FRAME_RESULT_KEY` unguarded.** History's `pendingFrameEditRef` guard is the only thing preventing History from swallowing the Log tab's frame result -- the mechanism behind the cut S7 false positive. Hygiene concern survives as **N4** (`FRAME_RESULT_KEY` outside the `KEYS` registry).

#### Fix Session C -- storage.ts, backup.ts, _layout.tsx, log.tsx (S9-S12)

**Shared root cause.** `readSessions()` collapsed three distinct states -- genuinely empty / invalid JSON / transient read failure -- into `[]`, and callers treated `[]` as "safe to seed / back up / overwrite".

**The fix -- reads report a status:**

| Status | Meaning | May a caller overwrite on it? |
|---|---|---|
| `missing` | key never written | **Yes -- this is the only state that seeds** |
| `ok` | parsed + fully validated (`[]` = genuinely emptied) | Yes |
| `invalid` | key exists but unparseable / fails validation | **No -- real data may be underneath** |
| `error` | the storage layer threw | **No -- says nothing about contents** |

- **S12** -- `isSessionArray` now validates **every element**; null session/game guards at the dereference site (was a white-screen Stats tab).
- **S11** -- seeds fire **only on `missing`**. A read that threw defers init without latching `SEEDED_FLAG`.
- **S9** -- `writeBackup` refuses to write on a failed/corrupt read, and refuses to blank a populated backup from an empty read.
- **S10** -- `restoreBackup` shape-checks every value **before any write** (Settings + reference have no shadow keys, so a bad write there is permanent).

> **KEY LEARNING -- the fifth bug.** `log.tsx` submit does a read-modify-write full replace. On a transient/corrupt read this already wiped all history on HEAD. Fixed in scope: submit now refuses to write on a non-trustworthy read and keeps the draft. **When a root-cause fix changes what a shared function returns, every read-modify-write caller is part of the blast radius.**

**Verification.** 54 checks pass against the **real modules**, plus a **negative control** against pre-fix HEAD (all 12 audited failure modes reproduce there, none on this tree).

### Phase 21 -- Stats Expansion + Deferred Draft Fixes (S5/S6)
**Completed:** July 17, 2026 -- commit `1dd908a` (committed + pushed; shipped OTA to production, confirmed live on device)

- **Deferred draft fixes S5 & S6 (log.tsx):** the debounced auto-save could not tell a user edit from a programmatic state change, so it persisted the empty/default form. **One guard fixes both:** auto-save gated on `draftHasContent(draft)`; the empty case **SKIPS** (never `writeDraft(null)`), so a genuine persisted draft is preserved.
- **Stats expansion (stats.tsx), all read-time:** First Ball Avg · Bounce-Back % · Doubles % triple row; Clean Games + Makeable Spare % pair; merged Leaves card (Top 6 + Show All, Frequency/Opportunity/Conv % sort); By Game Number collapses games 4+ into one bucket.

> **KEY LEARNING -- match the scorer's gutter token.** The gutter/miss token everywhere is **`—` (em dash, U+2014)**, not the ASCII hyphen. Any new frame-derived metric that reads pin values must special-case `—` → 0, matching log-frames.tsx.

### Phase 22 -- Stats Compaction Redesign + Session-Type Filter Pills
**Completed:** July 17, 2026 -- commit `528d060` (committed + pushed; shipped OTA to production, confirmed live on device)

- One-screen compaction: hero strip + two 4-across compact-cell groups + 100pt charts + above-the-fold Score Distribution (empty ranges hidden). **Type scale 200/300/500 introduced here** (700/800 killed except color-coded values at a 400 ceiling) -- this became the app-wide reference in Phase 23.
- Session-type filter pills (All/Lg/Trn/Prc/Mk), single choke point in `filterSessions`, AND-stacked with the season window, not persisted.
- Two deliberate drops (flagged + approved): the series goal-delta sub-line and the Makeable "splits excluded" caption. Metric/split logic untouched.

> **KEY LEARNING -- one filter choke point beats N.** Every stats memo was already keyed off `filtered`, so the type filter meant editing exactly one function + one dep array.

### Phase 23 -- Housekeeping (S16/S15/N3) + App-Wide Typography Unification
**Completed:** July 18, 2026 -- two commits. Both OTA-safe (pure JS/TS, no new storage keys, no schema change, no native module, no app.json change), TSC clean, shipped OTA to production, confirmed live on device.

#### Part 1 -- housekeeping (commit `a66a3e5`)

- **S16 -- `MiniPinDeck` + `FrameGrid` were duplicated verbatim in `log.tsx` and `history.tsx` and had diverged** (log's standing pin had drifted to `#FFFFFF`, history's was `#00CEC9`). Extracted both into **`components/FrameGrid.tsx`** with a `variant: 'compact' | 'full'` prop. The JSX/logic (throw-slicing, 10th-frame handling, `leaveData` mapping) lives once; two style tables -- copied **byte-for-byte** from each original -- are selected by variant, so each surface renders exactly as before. The standing-pin color is unified to **teal `#00CEC9`** via a single `STANDING_PIN` constant (the deliberate, only visual change; log flipped `#FFFFFF` → `#00CEC9` to match History + the canonical Stats `LeaveMiniPinDeck`). History uses `full` at both call sites (expanded card + share card); Log uses `compact`.
- **S15 -- deleted `_archive/`** (stock Expo-template boilerplate: a MaterialIcons `icon-symbol.tsx` fallback + 4 template PNGs). It was still inside the TS graph (`tsconfig.json` includes `**/*.tsx` with no `exclude`) -- a latent liability to the TSC-clean gate. Nothing imported it (grep-verified before deletion).
- **N3 -- false strike streak.** `getStrikeStreak` (log-frames.tsx) flattened every throw across all 10 frames and lost frame boundaries, so a **skipped (empty) frame** between two strikes reported a false "2 IN A ROW" (reachable because frame nav is free -- the B1 fix). Rewritten to walk frames backward from the last played frame; an **empty frame is a gap that ends the streak**, as does any non-strike throw. The 10th frame's multiple strikes still each count. Harness-verified: only the skipped-frame case changes (2 → 1); every other scenario (genuine double, triple, 10th X-X-X after a f9 strike, spare-break) is identical.

> **KEY LEARNING -- byte-identical extraction under a variant.** The two `FrameGrid` copies had identical JSX but *intentionally different styles* (compact wrapped cards vs a connected bordered scorecard). A naive one-stylesheet extraction would have silently restyled one tab. The fix keeps both looks via `variant` + two verbatim style tables, changing exactly one value (the drifted pin color) -- proven by a diff showing the tab files gained only the import + the `variant` prop, every style removed wholesale (moved, not edited).

#### Part 2 -- app-wide typography unification (commit `1f59960`)

- **63 weight-only edits across 11 files** propagate the Stats **200/300/500** scale to Log, History, Reference, Settings, and their child components (`FrameGrid`, `EditSessionModal`, `SettingsContent`, `SignalsTab`, `PocketDiagnosticsTab`, `PatternsTab`, `PinDeck`, `log-frames`). No `fontFamily` anywhere (SF Pro) -- purely `fontWeight`.
- **Scale by role:** 200 hero numerals (`activeSlotText`, `completeFinalScore`) · 300 white values + numeric inputs (`scoreInput`, `totalValue`, `statValue`, `goalInput`) · 400 threshold-colored values at the ceiling (History `gameScore`/`seriesScore`/`seriesTotal`/`gameExpandScore`, Pocket `myDataConv`) · 500 labels/eyebrows/names/inactive controls · 600 emphasis (kept). **700/800 eliminated.** Final tally in target files: `200×2 · 300×6 · 400×6 · 500×67 · 600×45`.
- **`stats.tsx` is the reference and was NOT touched.** Operative rule: "kill 700/800; keep 600 for emphasis exactly where stats keeps it" -- active/selected controls, primary CTAs, nav/modal/sheet titles, badges, teal action links. Do not push the 600 emphasis set to 500; do not re-touch stats to make it fit.
- **No color or threshold-logic changes.** Colors + the score-vs-average / series / overall-average bands are byte-for-byte as before; only the *weight* on colored values moved to 400.

> **KEY LEARNING -- the scale is role-based, and stats already encodes it.** Reading `stats.tsx` (not the one-line "200/300/500" summary) revealed the real convention: stats *keeps* 600 for emphasis (segmented/pill active text, `splitBadge`, `emptyTitle`, the teal `allLeavesToggle`), and the color-coded **hero** is 200 *despite* being colored -- the 400 ceiling applies to the *secondary* colored values, not the hero. Propagating "the stats scale" means matching stats' actual role map, not collapsing everything to three weights.

**Verification.** Both parts `npx tsc --noEmit` exit 0. Part 1: strike-streak harness 8/8 + a byte-identical style-table walkthrough (only the pin color changed). Part 2: 63/63 weight-only diff with zero 700/800 remaining in target files. Both OTA'd to production (`a66a3e5`, `1f59960`) and visually confirmed on device (incl. the FrameGrid mini-scorecard chips now at 500 in both Log + History).

---

## SideStore Install Plan -- COMPLETE

> All four phases are exercised and the one unavoidable Mac rebuild is done. The workflow is now fully OTA. (Detail in REV20.)

| Phase | Reality |
|---|---|
| **1 -- Install SideStore via iloader (PC)** | Complete |
| **2 -- Build IPA on Mac** | Complete |
| **3 -- Sideload via SideStore** | Complete |
| **4 -- Production EAS channel** | Complete (Phase 20) |

**OTA delivery verified end-to-end.** Every JS-only change ships via `eas update --branch production`. No Mac involvement again unless a native module or SDK version changes.

### Known friction points and mitigations
- iOS update breaks SideStore temporarily → never let the cert counter drop below 3 days. The 6-day notification (Phase 18) handles this.
- Pairing file expires → re-run iloader with the saved pairing file. No full reinstall.
- Work VPN conflicts with LocalDevVPN → turn work VPN off briefly, open SideStore, tap counter to refresh, turn it back on. Under 2 minutes.
- New iPhone / iCloud restore → the Phase 17 backup travels via iCloud Drive. Redo Phases 1-3, then Restore from Backup in Settings.
- SideStore abandoned → fallback is AltStore + AltServer on PC. Same one-time Mac build.

---

## Deferred -- ship via `eas update --branch production`

| ID | Item |
|---|---|
| **--** | **Swipe-back bypasses log-frames' own "Discard Frames?" confirm.** Pre-existing; same `gestureEnabled` root as B2's learning. **UX gap, not data loss** -- the cancel boundary already protects the data |
| **N4** | `FRAME_RESULT_KEY` lives outside the `KEYS` registry |
| **N1-N14** | Remaining NICE items -- see `docs/PHASE20-AUDIT.md` |

> **Shipped (removed from this table):** **S5, S6** -- Phase 21 (`1dd908a`). **S15, S16, N3** -- Phase 23 (`a66a3e5`).

---

## Open Questions

| Question | When |
|---|---|
| House shot exact specs (length + volume) | Verify with house sheet before updating Patterns in-app |
| Stat-card color thresholds (First Ball Avg, Bounce-Back %, Doubles %, Clean Games) | Calibrate ~early August 2026 off 2-3 weeks of real data -- deferred, still white-only |

---

## Session Notes

| Session | Phase | Completed | Notes |
|---|---|---|---|
| 1-31 | Phases 1-20 + REV18 | Mar 6 -- Jul 14 | See REV18/REV20 (archive) for full per-session detail. |
| -- | Mac rebuild | (pre Jul 17) | Production-channel IPA built on Mac, sideloaded via SideStore. OTA pipeline verified end-to-end. |
| 32 | Phase 21 | Jul 17 | Stats expansion + deferred draft fixes S5/S6 (single `draftHasContent` guard). Em-dash gutter-token learning. Committed + pushed `1dd908a`, OTA'd, confirmed live. |
| 33 | Phase 22 | Jul 17 | Stats compaction redesign (one-screen hero strip + two 4-across compact-cell groups + 100pt charts + above-the-fold Score Distribution + 200/300/500 type scale) + session-type filter pills (single choke point in `filterSessions`, AND-stacked with season, not persisted). Committed + pushed `528d060`, OTA'd, confirmed live. |
| 34 | Phase 23 | Jul 18 | Two commits. Part 1 `a66a3e5`: S16 (shared `components/FrameGrid.tsx` with `variant` compact/full; standing pin unified to teal `#00CEC9`), S15 (`_archive/` deleted), N3 (strike-streak backward-walk with empty-frame gap-break). Part 2 `1f59960`: app-wide typography unification -- 63 weight-only edits across 11 files, Stats 200/300/500 scale propagated, 700/800 killed, 600 kept for emphasis, `stats.tsx` untouched. TSC clean both parts; both committed + pushed + OTA'd to production, verified on device. |

---

## Post-v1 Backlog

- iCloud backup / key-value sync
- Export to CSV or JSON

---

## End-of-Session Protocol

1. TSC clean (`npx tsc --noEmit`).
2. Commit + push. **The Mac build clones from GitHub -- uncommitted work does not exist in the binary.** (Native-only concern now; JS ships OTA.)
3. Update this brief (bump the REV, add a Session Notes row).
4. Update the CLAUDE.md pointer to the new REV.
5. **Upload the new brief to the Claude.ai Knowledge folder.** *This is the step that keeps getting missed -- REV17 was never uploaded and Knowledge sat on REV16 while the tree moved ahead. Do it every time.*
