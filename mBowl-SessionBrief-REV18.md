# mBowl -- Session Brief REV18
**Full spec lives in:** mBowl-SPEC.md (Project folder) -- read it before writing any code.
**Last updated:** July 14, 2026

---

## Current Status

**Phase:** Phase 20 complete -- split detection, Makeable Spare %, OTA production channel, 16-agent full-tree audit + fix sessions A/B/B2/C
**Last completed:** July 14, 2026 -- commit `d48c258`, committed and pushed
**Up next:** **Mac rebuild.** This is the ONE unavoidable Mac trip. It bakes the production channel into the binary. After it, every JS-only change ships OTA with no Mac involvement.

> **REV18 is the first brief since REV17 -- and REV17 was never uploaded to the Claude.ai Knowledge folder.** Knowledge is still on REV16. That upload gap is the direct cause of the drift this brief reconciles. **Upload REV18 to Knowledge when this session ends.**

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
- PowerShell does not support && -- run commands one at a time.

### Architecture Patterns

- **Gear icon:** Each tab uses useNavigation().setOptions() in useLayoutEffect to inject headerRight gear button. Opens SettingsContent.tsx as a modal (presentationStyle pageSheet).
- **Dark theme:** Forced in app/_layout.tsx (no color scheme check). StatusBar style light.
- **Tab bar:** bg #1C1C1E, borderTopColor #38383A, borderTopWidth 0.5. Active teal, inactive dim.
- **Headers:** bg #000000, tintColor #FFFFFF, shadowVisible false.
- **ScalePressable:** Shared animated press component using withSpring (damping 15, stiffness 400).
- **Pin Deck:** Dual input mode in Log Frames. Pins/Quick toggle. Pin data optional, analytics-only. Post-Game mode defaults to Pins as of Phase 19.
- **Draft persistence:** Includes all form fields, frame data, and pinsStanding arrays. writeDraft(null) calls removeItem, not setItem. Draft validated on read by checking sessionType field.
- **Date storage:** formatDateISO uses local time (getFullYear/getMonth/getDate), not toISOString(). No UTC offset bug. **Do not regress this** -- it is re-checked every audit.
- **Stats:** filtered, metrics, seriesChartPoint, gameChartPoint, leaveStats, histogram, ballStats, gameByGameStats, avgGoalDelta, seriesGoalDelta all memoized with useMemo.
- **Ball picker:** Sorted weakest to strongest. Empty state message if no active balls. Reloads balls on picker open (not just mount) -- A1 fix.
- **Season start:** Derived from settings.seasonStart at runtime. No hardcoded date.
- **Shared types:** src/types.ts is the canonical source for ThrowEntry, FrameData, GameEntry, Session, Ball, Settings, DraftData. Do not redefine these locally.
- **Storage layer:** src/storage.ts (TypeScript). KEYS object exported -- **never write a raw key string at a call site**. All functions fully typed.
- **Storage read states (Phase 20):** reads report a status, not a bare array. `readSessionsResult()` / `readBallsResult()` return `{ status, value }` where status is `'missing' | 'ok' | 'invalid' | 'error'`. **`[]` alone is never acted on.** `readSessions()` keeps its old array signature for display-only callers; **anything that WRITES must use `readSessionsResult()`.** See Phase 20 / Session C below.
- **Split detection (Phase 20):** `isSplit()` in leaveUtils.js is the single source of truth. Derived at **READ TIME** from `pinsStanding` -- never persisted, never stored on a session. This is why it applies retroactively across all existing pin-logged history. No second adjacency map or split heuristic may exist anywhere.
- **Auto-export:** src/backup.ts exports writeBackup() and restoreBackup(). writeBackup() called non-blocking (void) after every meaningful write. Both now guard against degrading good data -- see Phase 20 / Session C.
- **Cert reminder:** src/notifications.ts exports scheduleCertReminder(). Called non-blocking (void) in _layout.tsx after writeBackup(). Repeating iOS local notification every 6 days. Identifier: sidestore-cert-reminder.
- **Frame editing from History:** Dismiss-and-return pattern. EditSessionModal closes → history.tsx useEffect pushes to log-frames → useFocusEffect return reads FRAME_RESULT_KEY, reopens modal with updated data. `pendingFrameEditRef` + `shouldPushFramesRef` guard the flow. **The guard is load-bearing** -- see Session B2.
- **Share card:** SessionCard in history.tsx renders an off-screen ShareCardView via react-native-view-shot captureRef(), then expo-sharing shareAsync(). iOS only.
- **Goals in Settings:** Target Average (0-300) and Target Series (0-900) stored as targetAverage / targetSeries in Settings.
- **TypeScript stub:** components/ui/icon-symbol.tsx exists as a re-export stub for TypeScript resolution. Metro resolves to icon-symbol.ios.tsx at runtime.
- **OTA channel (Phase 20):** app.json carries `updates.requestHeaders { "expo-channel-name": "production" }`. The header is **baked into the binary at build time** -- it does not take effect until the next IPA is built. Until then the app resolves OTA from the wrong branch.

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

---

## Phase Details -- Post-REV17 Reconciliation

> REV17 was written at commit `8617e32`. Four fixes and two milestones landed **after** REV17's own commit and were never documented. They are recorded here.

### Post-REV17 committed fixes (predate this brief, postdate REV17)

- **B1 frame-strip overlay-at-frame-9** (`c2e6e27`) -- "Fix B1 frame strip nav: complete overlay only shows at frame 9". The complete-overlay no longer blocks free navigation to frames 1-9. **This is the change that opened M1** (see Session A): narrowing the completion guard to `allComplete && currentFrame===9` left the non-10th renderers with no throw-index cap.
- **C2 share-card blank-image fix** (`2d8f65e`) -- removed `opacity:0`, added background color, 100ms capture delay. The off-screen ShareCardView captured blank without these.
- **C2 share-card layout fix** (`15aac43`) -- full width, series row, FrameGrid flex, no clipping.
- **Umbrella commit** (`ee77963`) -- "Phase 19 -- share card and frame edit fixes".

### Undocumented milestones

- **App icon finalized** (`6d55680`). The spec still says "App icon: Deferred to Phase 12". It shipped. Recorded in the spec's new Reality Deltas appendix.
- **An IPA was actually built and sideloaded** (`23af3c9`, `b7dcfb1`, `cf97011` added it; `a81b8c0`, `72f0d47` removed it from the repo). **SideStore Phases 2-3 were genuinely exercised** -- REV17 wrongly presents the whole install plan as not-started. The IPA is deliberately not kept in the repo.
- **REBUILD.md already exists** (`7683ed7`). REV17 says it "will be written during the Mac session". It is written. Read it before the Mac trip.
- **`_archive/` + app.json slimming** (`c51c8aa`).

---

### Phase 20 -- Split Detection, Makeable Spare %, OTA Channel, Full-Tree Audit
**Completed:** July 14, 2026 -- commit `d48c258` (committed + pushed to origin/master)

#### OTA production channel (this IS SideStore-plan Phase 4)

- Production channel created and mapped to the production branch.
- `app.json`: `updates.requestHeaders { "expo-channel-name": "production" }`.
- REV17 listed "Up next: TBD" and the install plan's Phase 4 as not-started. **Phase 4 is done.** The header is inert until the next IPA is built -- that is precisely what the Mac trip is for.

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
- Both leave lists render through a shared `LeaveRow` -- de-duplicated.

---

### The 16-agent full-tree audit
**Run:** July 13, 2026 (night) -- recorded in `docs/PHASE20-AUDIT.md` (commit `96c1ce3`)

- 4 tiers, true-parallel read-only subagents, plus a mandatory hallucination-filter verification pass.
- 31 candidate findings → **2 cut as false positives** → **29 actionable** (1 MUST, 14 SHOULD, 14 NICE).
- **Phase 20's own additions came back clean.** Split detection, the makeable metric, the LeaveRow refactor, the channel header, and TSC all verified clean. **Every confirmed MUST/SHOULD lived in a pre-existing surface** (log-frames scoring, draft lifecycle, backup/seed) that the full-tree pass simply surfaced for the first time.
- The two cuts: **S7** (shared FRAME_RESULT_KEY cross-tab corruption -- unreachable, see Session B2) and **S8** (writeReference not awaited before writeBackup -- AsyncStorage's serial native queue makes it safe).

---

### Fix Session A -- log-frames.tsx (M1, S1, S2)
**Completed:** July 14, 2026

- **M1 -- over-fill of a complete frame silently corrupted the saved score.** Re-entering an already-complete frame 1-9 rendered live input with **no throw-index cap**; one chip/Confirm appended a 3rd throw, `framesToPins` emitted an orphan pin, `calculateScores` desynced its pin walk, and `handleDone` persisted a wrong `scores[9]`. Reachable in **both Pins and Quick modes**, including History → Edit Frames on a completed game. The only finding that silently corrupted persisted data.
  **Fix:** the input lock was pushed **down into the pure functions** (`getAvailableChips` / `getPinDeckProps` return empty for a complete non-10th frame; `addThrow` / `addThrowWithPins` bail when the target frame is already complete regardless of index) **so callers cannot bypass it.** A guard at the call site would have been re-openable by the next entry path.
- **S1 -- `allComplete` checked only the 10th frame.** Entering frame 10 as `X X X` with frames 1-9 empty showed "All Frames Complete" while `scores[9]` was null → Done saved **score 0**, discarding the game. Now gates on all 10 frames.
- **S2 -- count-chip off-by-one.** 2nd-throw chips used `i <= 10 - t1Pins`, offering a chip equal to the pins left. After a `9`, tapping `1` recorded `['9','1']` -- scored as an **open 10 with no spare bonus**. Fixed to `i < 10 - t1Pins`.
- **`handleDone` null-score backstop** added.

> **KEY LEARNING -- M1 and S1 had to land together.** Fixing S1 alone would have opened a *new* bug: a 10th frame entered as `X X X` over empty frames would then have accepted a 4th throw. The two findings are coupled through the same completion predicate; fixing either in isolation moves the corruption rather than removing it.

---

### Fix Session B -- history.tsx + EditSessionModal.tsx (S3, S4)
**Completed:** July 14, 2026

- **S3 -- unsaved field edits were discarded on the frame-editor round trip.** `handleEditFrames` snapshotted the pre-edit `editingSession`, not the modal's live state, so ball / notes / score / date / type / week / opponent / tournament / other-games edits vanished on return.
  **Fix:** `handleSave`'s session-builder was extracted into **`buildSession()` in EditSessionModal.tsx and reused by both paths.** The Edit Frames snapshot now **cannot drift from what Save writes** -- they are literally the same function. This is the structural fix, not a copy of the field list.
- **S4 -- Cancel silently dropped the just-made frame edit.** Returning from the frame editor changed the `session` prop → the populate effect reset `isDirty.current = false` → a subsequent Cancel skipped the "Discard changes?" confirm. Fixed with an `initiallyDirty` prop.
- **Bonus fix (not in the audit):** `priorScores` was reading **stale pre-edit scores**.

---

### Fix Session B2 -- frame-editor cancel boundary
**Completed:** July 14, 2026 -- **not in the original audit; surfaced by Session B's trace harness**

- **Cancel is inferred from the ABSENCE of `FRAME_RESULT_KEY`, not from a marker written on cancel.**

> **KEY LEARNING -- why a cancel marker would have been wrong.** `log-frames` is registered in `app/_layout.tsx:118` **without `gestureEnabled: false`**. iOS swipe-back therefore calls `goBack()` **directly** and never runs the header Cancel handler. A marker written by that handler would have missed **the most natural way a user leaves the screen**. Inference from an absent result key is **exhaustive by construction**: every exit that isn't an explicit Done -- header Cancel, swipe-back, hardware back -- leaves no key, and all of them are handled identically without enumerating them.

- **`log.tsx:318` consumes `FRAME_RESULT_KEY` unguarded.** History's `pendingFrameEditRef` guard is therefore **the only thing** preventing History from swallowing the Log tab's frame result. This is the **mechanism behind the audit's cut S7 false positive**: the shared-key smell is real, but the cross-tab application is unreachable because `log-frames` is a root-stack screen *above* the tab bar (tabs cannot be switched while it is open) and `goBack` returns focus to History, which consumes/removes the key before Log is ever focused. **Test case (e) pins this.** The hygiene concern survives separately as **N4** (`FRAME_RESULT_KEY` lives outside the `KEYS` registry).
- `wasDirty` rides along on `pendingFrameEditRef` so a cancelled trip restores the modal's dirty state. The S7 guard is preserved and pinned by test.

---

### Fix Session C -- storage.ts, backup.ts, _layout.tsx, log.tsx (S9-S12)
**Completed:** July 14, 2026

**Shared root cause.** `readSessions()` collapsed three distinct states -- genuinely empty / invalid JSON / transient read failure -- into `[]`, and callers treated `[]` as "safe to seed / back up / overwrite". Validation was also shallow. The four findings compounded into real data-loss paths, so they were fixed as one change.

**The fix -- reads report a status:**

| Status | Meaning | May a caller overwrite on it? |
|---|---|---|
| `missing` | key never written | **Yes -- this is the only state that seeds** |
| `ok` | parsed + fully validated (`[]` = genuinely emptied) | Yes |
| `invalid` | key exists but unparseable / fails validation | **No -- real data may be underneath** |
| `error` | the storage layer threw | **No -- says nothing about contents** |

- **S12 (`storage.ts` → `leaveUtils.js`)** -- `isValidSessionArray` inspected only element `[0]`, so `[valid, null, ...]` passed and `computeLeaveStats` then dereferenced `null.games` → TypeError → **white-screen Stats tab**. `isSessionArray` now validates **every element**; null session/game guards added at the dereference site.
- **S11 (`_layout.tsx`)** -- the seed gate was `readSessions().length === 0`, so a false-empty read with `SEEDED_FLAG` unset **overwrote real sessions with the seeds**. Now seeds fire **only on `missing`** -- a genuinely never-written key. A read that threw **defers init without latching `SEEDED_FLAG`**, so a real first launch still seeds on a later launch. The shadow-key restore no longer fires on a transient failure (it would have written a stale shadow over live data).
- **S9 (`backup.ts`)** -- `writeBackup` had no empty/sanity guard and overwrote `mBowl-backup.json` on **every cold launch**; one transient `readSessions()→[]` degraded the last-resort file to `sessions:[]`. It now refuses to write on a failed/corrupt read, and refuses to blank a **populated** backup from an empty read.
- **S10 (`backup.ts`)** -- `restoreBackup` validated key **presence** only (`'sessions' in payload`), so a malformed backup wrote `"null"` over live data. **Settings and reference have no shadow keys, so that wipe was permanent.** Every value is now shape-checked **before any write**.

> **KEY LEARNING -- the fifth bug, found by fixing the other four.** `log.tsx:514` does a read-modify-write **full replace**: `writeSessions([session, ...(await readSessions())])`. On a transient or corrupt read this **already wiped all history on HEAD** -- submitting one session left only that session. The S12 fix would have *widened* it to partially-corrupt arrays. It was fixed in scope even though the fix prompt never named the file, because the S12 fix alone would have made it worse. **The lesson: when a root-cause fix changes what a shared function returns, every read-modify-write caller is part of the blast radius.** Submit now refuses to write on a non-trustworthy read and keeps the draft.

**Verification.** 54 checks pass against the **real modules** (transpiled with the project's own TypeScript, faked AsyncStorage/filesystem; `initStorage` and the submit guard are *extracted from the real files*, not reimplemented). Critically, a **negative control** ran the same scenarios against pre-fix HEAD: **all 12 audited failure modes reproduce there and none on this tree** -- proving the tests are not vacuous. A passing test that would also pass against the broken code proves nothing; this is the standard for future data-safety work.

**TSC: Clean (zero errors confirmed).**

---

## SideStore Install Plan -- CORRECTED STATUS

> REV17 presented all four phases as not-started. That was wrong: 1, 2, 3 and 4 have all been exercised. What remains is a **rebuild**, not a first build.

| Phase | REV17 said | Reality |
|---|---|---|
| **1 -- Install SideStore via iloader (PC)** | not started | **Complete** |
| **2 -- Build IPA on Mac** | not started | **Exercised** -- an IPA was built (`23af3c9`/`b7dcfb1`/`cf97011`) |
| **3 -- Sideload via SideStore** | not started | **Exercised** -- app installed and ran on device |
| **4 -- Production EAS channel** | "Up next: TBD" | **Complete in Phase 20** -- channel created + mapped, app.json header added |

### What remains: the Mac rebuild (the one unavoidable Mac trip)

The previously-built IPA predates Phase 20. **The Mac IPA build does `git clone` from GitHub -- nothing uncommitted exists in the binary.** Phase 20 is now pushed (`d48c258`), so a rebuild is what puts split detection, the Makeable metric, and the production-channel header into a binary that actually runs on the phone.

1. `git clone https://github.com/Pipsqueak315/mBowl.git` (or `git pull` a clean tree)
2. `npm install`
3. `npx expo prebuild --clean --platform ios` -- **note `--clean`**; REBUILD.md:48 omits it (audit N6), which is only safe on a genuinely fresh clone
4. `pod install --project-directory=ios` if prompted
5. `open ios/mBowl.xcworkspace` → Signing & Capabilities → Team = personal Apple ID
6. Product → Archive → Organizer → Distribute App → Custom → Release Testing → Export IPA
7. AirDrop IPA → iPhone → Files → SideStore → install (LocalDevVPN connected)
8. **Verify the channel:** confirm the rebuilt app pulls from the **production** branch, not preview

**Follow `REBUILD.md`** -- it already exists (`7683ed7`) and captures the exact commands and Xcode settings.

**After this trip:** every JS-only change ships via `eas update --branch production`. No Mac involvement, ever again, unless a native module or SDK version changes.

### Known friction points and mitigations
- iOS update breaks SideStore temporarily → never let the cert counter drop below 3 days. The 6-day notification (Phase 18) handles this.
- Pairing file expires → re-run iloader with the saved pairing file. No full reinstall.
- Work VPN conflicts with LocalDevVPN → turn work VPN off briefly, open SideStore, tap counter to refresh, turn it back on. Under 2 minutes.
- New iPhone / iCloud restore → the Phase 17 backup travels via iCloud Drive. Redo Phases 1-3, then Restore from Backup in Settings.
- SideStore abandoned → fallback is AltStore + AltServer on PC. Same one-time Mac build.

---

## Deferred -- post-Mac OTA pass

Ship these via `eas update --branch production` after the rebuild. **None of them block the Mac trip.**

| ID | Item |
|---|---|
| **S5** | `log.tsx` -- post-submit `resetForm()` re-triggers the 400ms auto-save → recreates `mbowl_draft_v1` with the empty default form → **phantom "Resume Session?"** on next cold launch |
| **S6** | `log.tsx` -- on mount, if `settings.seasonStart` makes `setWeek` change the week, auto-save fires while the Resume sheet is still open and overwrites the real persisted draft with the empty form. Conditional on the week actually changing |
| **S15** | `_archive/components/ui/icon-symbol.tsx` -- dead boilerplate still **inside the TS graph** (`tsconfig.json` includes `**/*.tsx` with no `exclude`) → latent liability to the TSC-clean gate |
| **S16** | `MiniPinDeck` + `FrameGrid` duplicated verbatim in `log.tsx` and `history.tsx` -- **already diverged** (log's `miniPinUp` is `#FFFFFF`, history's is `#00CEC9`) |
| **N3** | Strike-streak flattens frames → false "2 IN A ROW" if a frame is skipped |
| **--** | **Swipe-back bypasses log-frames' own "Discard Frames?" confirm.** Pre-existing; same `gestureEnabled` root as B2's learning. **UX gap, not data loss** -- the cancel boundary already protects the data |
| **N1-N14** | All 14 NICE items -- see `docs/PHASE20-AUDIT.md` |

---

## Open Questions

| Question | When |
|---|---|
| House shot exact specs (length + volume) | Verify with house sheet before updating Patterns in-app |

---

## Session Notes

| Session | Phase | Completed | Notes |
|---|---|---|---|
| 1-24 | Phases 1-18 | Mar 6 -- Mar 22 | See REV17 (archive) for full per-session detail. |
| 25 | Phase 19 | Apr 3 | 10 items: ball picker fix, frame strip nav, mini scorecard, edit frames (Log + History), pins default, game decay, share card, goal tracking, data restore. Production audit + EAS deploy. TSC clean. CLAUDE.md pointer updated to REV17. |
| 26 | Phase 20 core | Jul 13 | Split detection + isSplit per leave, Makeable Spare %, LeaveRow refactor, SPLIT badge, app.json production-channel header. Left uncommitted pending the audit. |
| 27 | Phase 20 audit | Jul 13 | 16-agent full-tree read-only audit. 31 candidates → 2 cut → 29 actionable (1 MUST, 14 SHOULD, 14 NICE). Committed on its own as `96c1ce3` (docs/PHASE20-AUDIT.md). Phase 20's own code verified clean. |
| 28 | Fix Session A | Jul 14 | M1 (over-fill score corruption), S1 (allComplete gated only frame 10), S2 (count-chip off-by-one). Input lock pushed into the pure functions. M1+S1 had to land together. Scoring harness written. |
| 29 | Fix Sessions B + B2 | Jul 14 | S3 (buildSession() shared builder -- snapshot can't drift from Save), S4 (initiallyDirty). Bonus: stale priorScores. B2: cancel-boundary inference (swipe-back never runs the Cancel handler), wasDirty on pendingFrameEditRef, S7 guard preserved + pinned. Trace harness written. |
| 30 | Fix Session C + Phase 20 commit | Jul 14 | S9-S12 as one change: read states (missing/ok/invalid/error), every-element validation, seed gate on `missing` only, backup write/restore guards. **Fifth bug found: log.tsx:514 read-modify-write wipe.** 54 checks + negative control (12/12 reproduce on HEAD). All of Phase 20 committed + pushed as `d48c258`. TSC clean. |
| 31 | REV18 brief + doc reconciliation | Jul 14 | This brief. CLAUDE.md pointer REV13→REV18, storage.js→storage.ts, 5 missing files added, KEYS table completed (8 keys), seed count 17→18. Spec Reality Deltas appendix added (spec itself left locked). |

---

## Post-v1 Backlog

- **Mac rebuild:** the only remaining blocker to a fully-OTA workflow. See SideStore Install Plan above.
- iCloud backup / key-value sync
- Export to CSV or JSON

---

## End-of-Session Protocol

1. TSC clean (`npx tsc --noEmit`).
2. Commit + push. **The Mac build clones from GitHub -- uncommitted work does not exist in the binary.**
3. Update this brief (bump the REV, add a Session Notes row).
4. Update the CLAUDE.md pointer to the new REV.
5. **Upload the new brief to the Claude.ai Knowledge folder.** *Step 5 is the one that has been missed. REV17 was never uploaded; Knowledge sat on REV16 while the tree moved 3 phases ahead, and that gap is exactly what produced the drift REV18 had to reconcile.*
