# mBowl -- Session Brief REV19
**Full spec lives in:** mBowl-SPEC.md (Project folder) -- read it before writing any code.
**Last updated:** July 17, 2026

---

## Current Status

**Phase:** Phase 21 complete -- stats expansion (First Ball Avg, Bounce-Back %, Doubles %, Clean Games, merged Leaves card + sort toggle, Game 4+ bucket) + deferred draft fixes S5/S6
**Last completed:** July 17, 2026 -- commit `1dd908a`, committed + pushed, shipped OTA to production
**Up next:**
- **Phase 22 -- session-type filter pills** (Stats/History filter by League / Makeup / Tournament / Practice).
- **Color-threshold calibration for the new stat cards** (First Ball Avg, Bounce-Back %, Doubles %, Clean Games) -- they ship white-only on purpose. **Revisit ~early August 2026**, after 2-3 weeks of real logged data, to set green/orange/red bands off actual distributions rather than guesses.

> **The Mac rebuild is DONE.** The production-channel binary is installed on the phone and OTA delivery is verified end-to-end (verification-marker round-trip + Phase 21 both landed live). Every JS-only change now ships via `eas update --branch production` with **no Mac involvement** -- unless a native module or SDK version changes.

> **Upload REV19 to the Claude.ai Knowledge folder when this session ends.** This is the step that keeps getting missed (REV17 was never uploaded; Knowledge sat on REV16 while the tree moved ahead, causing the drift REV18 had to reconcile). Do not skip it.

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
- **Draft persistence:** Includes all form fields, frame data, and pinsStanding arrays. writeDraft(null) calls removeItem, not setItem. Draft validated on read by checking sessionType field. **Auto-save now gated on `draftHasContent()` (Phase 21 / S5-S6)** -- an empty/default form is never persisted, and the guard SKIPS rather than writing null, so a real persisted draft is preserved.
- **Date storage:** formatDateISO uses local time (getFullYear/getMonth/getDate), not toISOString(). No UTC offset bug. **Do not regress this** -- it is re-checked every audit.
- **Stats:** filtered, metrics, seriesChartPoint, gameChartPoint, leaveStats, histogram, ballStats, gameByGameStats, advancedStats, sortedLeaves, avgGoalDelta, seriesGoalDelta all memoized with useMemo.
- **Ball picker:** Sorted weakest to strongest. Empty state message if no active balls. Reloads balls on picker open (not just mount) -- A1 fix.
- **Season start:** Derived from settings.seasonStart at runtime. No hardcoded date.
- **Shared types:** src/types.ts is the canonical source for ThrowEntry, FrameData, GameEntry, Session, Ball, Settings, DraftData. Do not redefine these locally.
- **Storage layer:** src/storage.ts (TypeScript). KEYS object exported -- **never write a raw key string at a call site**. All functions fully typed.
- **Storage read states (Phase 20):** reads report a status, not a bare array. `readSessionsResult()` / `readBallsResult()` return `{ status, value }` where status is `'missing' | 'ok' | 'invalid' | 'error'`. **`[]` alone is never acted on.** `readSessions()` keeps its old array signature for display-only callers; **anything that WRITES must use `readSessionsResult()`.** See Phase 20 / Session C below.
- **Split detection (Phase 20):** `isSplit()` in leaveUtils.js is the single source of truth. Derived at **READ TIME** from `pinsStanding` -- never persisted, never stored on a session. This is why it applies retroactively across all existing pin-logged history. No second adjacency map or split heuristic may exist anywhere.
- **Throw-notation tokens (source of truth = log-frames.tsx scorer):** `X` = strike, `/` = spare, **`—` (em dash, U+2014) = gutter/miss** (NOT the ASCII hyphen `-`), `0`-`9` = pin counts. **Any frame-derived metric that reads pin values must treat `—` as 0**, exactly as `pinsForThrow` does. See Phase 21 KEY LEARNING.
- **Advanced stats (Phase 21):** First Ball Avg / Bounce-Back % / Doubles % / Clean Games all derived at READ TIME from frames/pinsStanding via `calcAdvancedStats()` in stats.tsx. No storage keys, no schema change, no persisted derived values -- same principle as isSplit. **White values only -- color thresholds deferred to calibration.**
- **Auto-export:** src/backup.ts exports writeBackup() and restoreBackup(). writeBackup() called non-blocking (void) after every meaningful write. Both guard against degrading good data -- see Phase 20 / Session C.
- **Cert reminder:** src/notifications.ts exports scheduleCertReminder(). Called non-blocking (void) in _layout.tsx after writeBackup(). Repeating iOS local notification every 6 days. Identifier: sidestore-cert-reminder.
- **Frame editing from History:** Dismiss-and-return pattern. EditSessionModal closes → history.tsx useEffect pushes to log-frames → useFocusEffect return reads FRAME_RESULT_KEY, reopens modal with updated data. `pendingFrameEditRef` + `shouldPushFramesRef` guard the flow. **The guard is load-bearing** -- see Session B2.
- **Share card:** SessionCard in history.tsx renders an off-screen ShareCardView via react-native-view-shot captureRef(), then expo-sharing shareAsync(). iOS only.
- **Goals in Settings:** Target Average (0-300) and Target Series (0-900) stored as targetAverage / targetSeries in Settings.
- **TypeScript stub:** components/ui/icon-symbol.tsx exists as a re-export stub for TypeScript resolution. Metro resolves to icon-symbol.ios.tsx at runtime.
- **OTA channel (Phase 20):** app.json carries `updates.requestHeaders { "expo-channel-name": "production" }`. **Baked into the current binary** -- OTA now resolves the production branch correctly on device.
- **Local settings untracked (Phase 21):** `.claude/settings.local.json` is per-machine and is gitignored + untracked. Do not re-add it.

---

## Build Schedule

| # | Phase | Est. Time | Chats | Status |
|---|---|---|---|---|
| 1 | Environment Setup | 30 min | 1 | Complete |
| 2 | Data Layer | 45-60 min | 1 | Complete |
| 3 | Navigation Shell | 45 min | 1 | Complete |
| 4 | Log Tab -- Form + Submit + Draft | 90-120 min | 2 | Complete |
| 5 | Log Frames Screen | 90 min | 2 | Complete |
| 6 | History Tab | 60-75 min | 1 | Complete |
| 7 | Stats Tab | 90 min | 2 | Complete |
| 8 | Settings Screen | 45-60 min | 1 | Complete |
| 9 | Reference: Position + Mental + Your Numbers | 60 min | 1 | Complete |
| 10A | Reference: Signals | 45 min | 1 | Complete |
| 10B | Reference: Pocket Diagnostics | 45 min | 1 | Complete |
| 10C | Reference: Patterns | 60 min | 1 | Complete |
| 11 | Polish + Animations | 60-90 min | 1-2 | Complete |
| 12A | Pin Deck + Data Model | 60 min | 1 | Complete |
| 12B | Pin Deck Integration | 60 min | 1 | Complete |
| 13 | Leave Stats | 45-60 min | 1 | Complete |
| -- | Deep Code Audit Fixes | 30-60 min | 1 | Complete |
| 15A | Session Edit + Ball Strength | 60-90 min | 1 | Complete |
| 15B | Stats Extensions | 45-60 min | 1 | Complete |
| 15C | Pocket Diagnostics My Data | 45-60 min | 1 | Complete |
| 15D | Deep Code Audit (post 15A-C) | 30-60 min | 1 | Complete |
| 14 | EAS Update -- Expo Go Deploy | 30-45 min | 1 | Complete |
| 16A | Log Frames QOL | 45 min | 1 | Complete |
| 16B | Senior SWE Audit | 60 min | 2 | Complete |
| 17 | Auto-export JSON backup | 30 min | 1 | Complete |
| 18 | SideStore cert notification | 20 min | 1 | Complete |
| 19 | Log QOL, frame editing, share, decay, goals, restore | 90-120 min | 1 | Complete |
| 20 | Split detection, Makeable Spare %, OTA channel, full-tree audit + fixes A/B/B2/C | 5 sessions | 5 | Complete |
| -- | Mac rebuild (production-channel IPA) | 1 Mac trip | 1 | Complete |
| 21 | Stats expansion + deferred draft fixes S5/S6 | 1 | 1 | Complete |
| 22 | Session-type filter pills (+ stat-card threshold calibration) | TBD | -- | Up next |

---

## Phase Details -- Post-REV17 Reconciliation

> REV17 was written at commit `8617e32`. Four fixes and two milestones landed **after** REV17's own commit and were never documented. They are recorded here.

### Post-REV17 committed fixes (predate REV18, postdate REV17)

- **B1 frame-strip overlay-at-frame-9** (`c2e6e27`) -- "Fix B1 frame strip nav: complete overlay only shows at frame 9". The complete-overlay no longer blocks free navigation to frames 1-9. **This is the change that opened M1** (see Session A): narrowing the completion guard to `allComplete && currentFrame===9` left the non-10th renderers with no throw-index cap.
- **C2 share-card blank-image fix** (`2d8f65e`) -- removed `opacity:0`, added background color, 100ms capture delay. The off-screen ShareCardView captured blank without these.
- **C2 share-card layout fix** (`15aac43`) -- full width, series row, FrameGrid flex, no clipping.
- **Umbrella commit** (`ee77963`) -- "Phase 19 -- share card and frame edit fixes".

### Undocumented milestones

- **App icon finalized** (`6d55680`). The spec still says "App icon: Deferred to Phase 12". It shipped. Recorded in the spec's new Reality Deltas appendix.
- **An IPA was actually built and sideloaded** (`23af3c9`, `b7dcfb1`, `cf97011` added it; `a81b8c0`, `72f0d47` removed it from the repo). **SideStore Phases 2-3 were genuinely exercised** -- REV17 wrongly presents the whole install plan as not-started. The IPA is deliberately not kept in the repo.
- **REBUILD.md already exists** (`7683ed7`). REV17 says it "will be written during the Mac session". It is written. It was followed for the (now complete) Mac rebuild.
- **`_archive/` + app.json slimming** (`c51c8aa`).

---

### Phase 20 -- Split Detection, Makeable Spare %, OTA Channel, Full-Tree Audit
**Completed:** July 14, 2026 -- commit `d48c258` (committed + pushed to origin/master)

#### OTA production channel (this IS SideStore-plan Phase 4)

- Production channel created and mapped to the production branch.
- `app.json`: `updates.requestHeaders { "expo-channel-name": "production" }`.
- The header was inert until the next IPA build -- that is what the (now complete) Mac trip delivered.

#### Split detection

- `isSplit()` + `PIN_ADJACENCY` + `countStandingComponents()` in `src/leaveUtils.js`.
- **Derived at READ TIME from `pinsStanding`. Never persisted.** A split is a pure function of the leave shape, so it is computed per leave key on read. Consequence: split detection is **retroactive across all existing pin-logged history** -- no migration, no backfill, and the derived field can never drift from the pin set it describes.
- Adjacency map is fully symmetric, correct nearest-neighbour, plus **two deliberate sleeper edges: 2↔8 and 3↔9**. An in-line pin (8 directly behind 2, 9 directly behind 3) is coverable by driving the front pin straight back through it -- so the pair is connected, not split.
- Guard-safe: null / wrong-length input returns false, never throws.

#### RULING -- 2-8-10 and 4-7-9 are SPLITS

*This is a bowling decision, not a code decision. Recorded so it is not relitigated.*

- **2-8-10 and 4-7-9 classify as splits.** In 2-8-10, the 2 and 8 are connected by the sleeper edge, but the 10 is stranded with nothing adjacent. In 4-7-9, the 4-7 are adjacent and the 9 is stranded.
- The spec's "bucket" / "cluster" labels are **naming conventions, not makeability calls**. A leave having a friendly name does not make it a single-ball convert.
- **No `NEVER_SPLIT` override exists, and none should be added.**
- **Rationale:** both leaves strand a pin the others cannot reach. Classifying them makeable would pad the makeable denominator with genuinely hard converts, and the metric would then lie about spare-shooting ability -- which is the only thing it exists to measure.

#### Makeable Spare %

- **Makeable = any non-split leave.** Splits are excluded from the denominator **entirely** (not counted as misses).
- `makeableSparePct` is null when there are no makeable leaves. Splits excluded, no double-count, per-key `isSplit` cannot drift from its pin set.

#### Stats UI

- Makeable Spare % card (null/color branches crash-safe).
- SPLIT badges on leaves.
- Both leave lists render through a shared `LeaveRow` -- de-duplicated. **(Phase 21 later merged the two leave lists into one card.)**

---

### The 16-agent full-tree audit
**Run:** July 13, 2026 (night) -- recorded in `docs/PHASE20-AUDIT.md` (commit `96c1ce3`)

- 4 tiers, true-parallel read-only subagents, plus a mandatory hallucination-filter verification pass.
- 31 candidate findings → **2 cut as false positives** → **29 actionable** (1 MUST, 14 SHOULD, 14 NICE).
- **Phase 20's own additions came back clean.**
- The two cuts: **S7** (shared FRAME_RESULT_KEY cross-tab corruption -- unreachable, see Session B2) and **S8** (writeReference not awaited before writeBackup -- AsyncStorage's serial native queue makes it safe).

---

### Fix Session A -- log-frames.tsx (M1, S1, S2)
**Completed:** July 14, 2026

- **M1 -- over-fill of a complete frame silently corrupted the saved score.** The input lock was pushed **down into the pure functions** so callers cannot bypass it.
- **S1 -- `allComplete` checked only the 10th frame.** Now gates on all 10 frames.
- **S2 -- count-chip off-by-one.** Fixed to `i < 10 - t1Pins`.
- **`handleDone` null-score backstop** added.

> **KEY LEARNING -- M1 and S1 had to land together.** They are coupled through the same completion predicate; fixing either in isolation moves the corruption rather than removing it.

---

### Fix Session B -- history.tsx + EditSessionModal.tsx (S3, S4)
**Completed:** July 14, 2026

- **S3 -- unsaved field edits discarded on the frame-editor round trip.** Fix: `handleSave`'s session-builder extracted into **`buildSession()` in EditSessionModal.tsx and reused by both paths** -- the Edit Frames snapshot cannot drift from what Save writes.
- **S4 -- Cancel silently dropped the just-made frame edit.** Fixed with an `initiallyDirty` prop.
- **Bonus fix:** `priorScores` was reading stale pre-edit scores.

---

### Fix Session B2 -- frame-editor cancel boundary
**Completed:** July 14, 2026

- **Cancel is inferred from the ABSENCE of `FRAME_RESULT_KEY`, not from a marker written on cancel.** Swipe-back never runs the header Cancel handler, so inference from an absent key is exhaustive by construction.
- **`log.tsx` consumes `FRAME_RESULT_KEY` unguarded.** History's `pendingFrameEditRef` guard is the only thing preventing History from swallowing the Log tab's frame result -- mechanism behind the cut S7 false positive. Hygiene concern survives as **N4** (`FRAME_RESULT_KEY` outside the `KEYS` registry).

---

### Fix Session C -- storage.ts, backup.ts, _layout.tsx, log.tsx (S9-S12)
**Completed:** July 14, 2026

**Shared root cause.** `readSessions()` collapsed three distinct states -- genuinely empty / invalid JSON / transient read failure -- into `[]`, and callers treated `[]` as "safe to seed / back up / overwrite".

**The fix -- reads report a status:**

| Status | Meaning | May a caller overwrite on it? |
|---|---|---|
| `missing` | key never written | **Yes -- this is the only state that seeds** |
| `ok` | parsed + fully validated (`[]` = genuinely emptied) | Yes |
| `invalid` | key exists but unparseable / fails validation | **No -- real data may be underneath** |
| `error` | the storage layer threw | **No -- says nothing about contents** |

- **S12** -- `isSessionArray` now validates **every element**; null session/game guards at the dereference site (was white-screen Stats tab).
- **S11** -- seeds fire **only on `missing`**. A read that threw defers init without latching `SEEDED_FLAG`.
- **S9** -- `writeBackup` refuses to write on a failed/corrupt read, and refuses to blank a populated backup from an empty read.
- **S10** -- `restoreBackup` shape-checks every value **before any write** (Settings + reference have no shadow keys, so a bad write there is permanent).

> **KEY LEARNING -- the fifth bug.** `log.tsx` submit does a read-modify-write full replace. On a transient/corrupt read this already wiped all history on HEAD. Fixed in scope: submit now refuses to write on a non-trustworthy read and keeps the draft. **When a root-cause fix changes what a shared function returns, every read-modify-write caller is part of the blast radius.**

**Verification.** 54 checks pass against the **real modules**, plus a **negative control** against pre-fix HEAD (all 12 audited failure modes reproduce there, none on this tree).

---

### Phase 21 -- Stats Expansion + Deferred Draft Fixes (S5/S6)
**Completed:** July 17, 2026 -- commit `1dd908a` (committed + pushed; shipped OTA to production, confirmed live on device)

#### Part 1 -- deferred draft fixes S5 & S6 (log.tsx)

- **Shared root cause:** the debounced auto-save could not tell a user edit from a programmatic state change, so it persisted the empty/default form.
  - **S5** -- post-submit `resetForm()` re-created a phantom `mbowl_draft_v1` → phantom "Resume Session?".
  - **S6** -- mount `setWeek()` (when `settings.seasonStart` shifts the week) fired while the Resume sheet was open and overwrote the real persisted draft with the empty form.
- **One guard fixes both:** auto-save is gated on `draftHasContent(draft)` -- only a form the user actually put content into is persisted. Date and week are treated as non-content (auto-initialised). Critically, the empty case **SKIPS** (never `writeDraft(null)`), so the genuine persisted draft -- which during S6 lives only in `pendingDraft` memory -- is preserved, not deleted. Also closes a latent third case: mount-with-no-draft no longer writes an empty phantom draft.

#### Part 2 -- stats expansion (stats.tsx) -- all read-time, no storage/schema change

- **New triple row:** First Ball Avg · Bounce-Back % · Doubles % (below Strike%/Spare%/Opens), via a shared `StatCell` reusing the exact card + "Log frames to unlock" N/A pattern. **White values, no thresholds.**
- **Clean Games** ("N of M") pairs with **Makeable Spare %** in a two-card row.
- **Leaves merge:** Common Leaves + All Tracked Leaves → one **Leaves** card. Top 6 + `Show All (N)` expander. Header sort toggle **Frequency / Opportunity / Conv %** (Opportunity = `count × (1 − conversion rate)` = raw missed chances). Not persisted; resets to Frequency each visit. `LeaveRow`, SPLIT badges, conversion display unchanged. **`isSplit`, adjacency, and the makeable denominator were not touched** -- sorting is a pure stats.tsx memo over `computeLeaveStats` output.
- **By Game Number:** games 4+ collapse into one aggregate **Game 4+** bucket (combined average + count); games 1-3 stay individual.
- All new derived values (`advancedStats`, `sortedLeaves`) memoized.

> **KEY LEARNING -- match the scorer's gutter token.** `firstBallPins` was first written to treat the ASCII hyphen `-` as a 0-pin gutter. The app's actual gutter/miss token everywhere -- chip bar, stored frames, and the `pinsForThrow` scorer -- is **`—` (em dash, U+2014)**. Left uncorrected, a gutter first ball would have been *excluded* from First Ball Average (returning null) instead of counted as 0, silently inflating the metric. Caught by running the real seed frames (sessions 1017/1018) through the logic before commit. **Any new frame-derived metric that reads pin values must special-case `—` → 0, matching log-frames.tsx -- the scorer is the source of truth, not intuition about `-`.**

**Verification.** TSC clean. Metrics run over real seed frames with no NaN/crash and sane values (First Ball 8.4, Bounce-Back 75%, Doubles 42%, Clean 0/6). Marker-free hero label confirmed before publish.

**Bookkeeping.** `.claude/settings.local.json` untracked (`git rm --cached`) + gitignored -- per-machine local settings should never have been tracked.

---

## SideStore Install Plan -- COMPLETE

> All four phases are exercised and the one unavoidable Mac rebuild is done. The workflow is now fully OTA.

| Phase | Reality |
|---|---|
| **1 -- Install SideStore via iloader (PC)** | Complete |
| **2 -- Build IPA on Mac** | Complete -- production-channel IPA built + sideloaded |
| **3 -- Sideload via SideStore** | Complete -- app installed and running on device |
| **4 -- Production EAS channel** | Complete (Phase 20) -- channel created + mapped, app.json header baked into the binary |

**OTA delivery verified end-to-end:** a trivial verification marker was published to the production branch and confirmed landing on the phone, then reverted; Phase 21 then shipped the same way and is live. **Every JS-only change now ships via `eas update --branch production`. No Mac involvement again unless a native module or SDK version changes.**

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
| **S15** | `_archive/components/ui/icon-symbol.tsx` -- dead boilerplate still **inside the TS graph** (`tsconfig.json` includes `**/*.tsx` with no `exclude`) → latent liability to the TSC-clean gate |
| **S16** | `MiniPinDeck` + `FrameGrid` duplicated verbatim in `log.tsx` and `history.tsx` -- **already diverged** (log's `miniPinUp` is `#FFFFFF`, history's is `#00CEC9`) |
| **N3** | Strike-streak flattens frames → false "2 IN A ROW" if a frame is skipped |
| **--** | **Swipe-back bypasses log-frames' own "Discard Frames?" confirm.** Pre-existing; same `gestureEnabled` root as B2's learning. **UX gap, not data loss** -- the cancel boundary already protects the data |
| **N4** | `FRAME_RESULT_KEY` lives outside the `KEYS` registry |
| **N1-N14** | Remaining NICE items -- see `docs/PHASE20-AUDIT.md` |

> **Shipped (removed from this table):** **S5, S6** -- fixed in Phase 21 (`1dd908a`).

---

## Open Questions

| Question | When |
|---|---|
| House shot exact specs (length + volume) | Verify with house sheet before updating Patterns in-app |
| Stat-card color thresholds (First Ball Avg, Bounce-Back %, Doubles %, Clean Games) | Calibrate ~early August 2026 off 2-3 weeks of real data -- see Phase 22 |

---

## Session Notes

| Session | Phase | Completed | Notes |
|---|---|---|---|
| 1-24 | Phases 1-18 | Mar 6 -- Mar 22 | See REV17 (archive) for full per-session detail. |
| 25 | Phase 19 | Apr 3 | 10 items: ball picker fix, frame strip nav, mini scorecard, edit frames (Log + History), pins default, game decay, share card, goal tracking, data restore. Production audit + EAS deploy. TSC clean. |
| 26 | Phase 20 core | Jul 13 | Split detection + isSplit per leave, Makeable Spare %, LeaveRow refactor, SPLIT badge, app.json production-channel header. Left uncommitted pending the audit. |
| 27 | Phase 20 audit | Jul 13 | 16-agent full-tree read-only audit. 31 candidates → 2 cut → 29 actionable. Committed as `96c1ce3`. Phase 20's own code verified clean. |
| 28 | Fix Session A | Jul 14 | M1, S1, S2. Input lock pushed into the pure functions. M1+S1 had to land together. Scoring harness written. |
| 29 | Fix Sessions B + B2 | Jul 14 | S3 (buildSession() shared builder), S4 (initiallyDirty), stale priorScores. B2: cancel-boundary inference, wasDirty on pendingFrameEditRef, S7 guard preserved + pinned. Trace harness written. |
| 30 | Fix Session C + Phase 20 commit | Jul 14 | S9-S12 as one change. Fifth bug found (submit read-modify-write wipe). 54 checks + negative control. All of Phase 20 committed + pushed as `d48c258`. TSC clean. |
| 31 | REV18 brief + doc reconciliation | Jul 14 | CLAUDE.md pointer → REV18, storage.js→storage.ts, missing files added, KEYS table completed, seed count 17→18, Spec Reality Deltas appendix. |
| -- | Mac rebuild | (pre Jul 17) | Production-channel IPA built on Mac, sideloaded via SideStore. OTA pipeline then verified end-to-end (marker round-trip on production branch, confirmed on device, reverted). The one unavoidable Mac trip -- done. |
| 32 | Phase 21 | Jul 17 | Stats expansion (First Ball Avg, Bounce-Back %, Doubles %, Clean Games, merged Leaves card + Frequency/Opportunity/Conv % sort, Game 4+ bucket) + deferred draft fixes S5/S6 (single `draftHasContent` guard). Em-dash gutter-token learning. `.claude/settings.local.json` untracked + gitignored. TSC clean, verified over real seed frames. Committed + pushed `1dd908a`, shipped OTA to production, confirmed live on device. |

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
