# mBowl — Phase 20 Full-Tree Audit · Master Fix List

**Audited:** 2026-07-13 (night session) · **Method:** 16-agent read-only reconciliation audit (4 tiers, TRUE parallel subagents + mandatory hallucination-filter verification pass).
**Purpose:** Clean-tree gate before baking a new IPA on the Mac. The audited tree = HEAD + the uncommitted Phase 20 working-tree changes (`src/leaveUtils.js`, `app/(tabs)/stats.tsx`, `app.json`).
**Result:** 31 candidate findings → **2 cut** as false positives → **29 actionable** (1 MUST · 14 SHOULD · 14 NICE).
**Status of fixes:** NONE applied. This doc is the record; fixes happen in separate sessions.

---

## ⭐ AGREED TRIAGE — start here (do not re-derive)

> A future session should read this block first and act on it directly.

| Bucket | Items | Meaning |
|---|---|---|
| **FIX BEFORE MAC (blocking)** | **M1, S1, S2, S3, S4, S9, S10, S11, S12** | Must be fixed + committed + pushed before the Mac IPA build. Score corruption + data-loss + frame-edit data-loss. |
| **DEFER to later OTA** | **S5, S6, S15, S16, all NICE (N1–N14)** | Ship later via `eas update` to the production channel. Non-blocking. |
| **DOCS → REV18 brief** | **S13, S14** + the full Drift→REV18 list | Documentation reconciliation, not code. Fold into the next session brief. |

**Blocking count:** 1 MUST + 8 SHOULD = 9 code fixes gate the Mac build.

---

## 🔴 MUST — fix before baking the IPA (1)

### M1 · `app/log-frames.tsx` — over-fill of a complete frame silently corrupts the saved score
*Anchors:* guard `:540`, `addThrow`/`addThrowWithPins` `:590`/`:605`, `getAvailableChips` (non-10th) `:181–185`, `getPinDeckProps` `:241–244`, `framesToPins` `:57`, `handleDone` `scores[9]` `:668`.
*Origin:* Agents 5 **and** 15 (two independent entry paths) · verified CONFIRMED by Agent 16.

B1's free-nav narrowed the completion guard to `allComplete && currentFrame===9`, but the non-10th chip/pin renderers have **no throw-index cap** — re-entering an already-complete frame 1–9 (tap it in the strip) renders live input, and a single Confirm/chip **appends a 3rd throw**. `framesToPins` then emits an orphan pin, `calculateScores` desyncs its pin walk, and `handleDone` persists a wrong `scores[9]`. Reachable in **both Pins and Quick modes**, including **History → Edit Frames on a completed game**. This is the only finding that silently corrupts persisted data.
*Fix direction:* cap input for any already-complete non-10th frame (`getAvailableChips`/`getPinDeckProps` should return empty for a complete frame ≠ 9; `addThrow`/`addThrowWithPins` should bail when the target frame is already complete regardless of index).

---

## 🟠 SHOULD — 14 (8 blocking · 4 deferred · 2 docs)

### Scoring / Log Frames — *Agent 5* · **BLOCKING**
- **S1 · `log-frames.tsx:540`** — `allComplete = isFrameComplete(frames,9)` checks only the 10th frame. Enter frame 10 as `X X X` with 1–9 empty → card says "All Frames Complete" but `scores[9]` is null → Done saves **score 0**, discarding the game.
- **S2 · `log-frames.tsx:184` (also 194/202)** — 2nd-throw chips use `i <= 10 - t1Pins`, offering a count chip equal to the pins left. After a `9`, tapping `1` records `['9','1']`, scored as an **open 10 with no spare bonus**. Fix: `i < 10 - t1Pins`.

### Frame-edit flow — *Agent 4* · **BLOCKING**
- **S3 · `history.tsx:695` (serialize `:694`)** — `handleEditFrames` snapshots the pre-edit `editingSession`, not the modal's live edited state → **unsaved field edits** (ball, notes, score, date, type, week, opponent, tournament, other games) are discarded on return.
- **S4 · `EditSessionModal.tsx:126`** — returning from the frame editor changes the `session` prop → populate effect resets `isDirty.current=false` → a subsequent Cancel **skips the "Discard changes?" confirm** and silently drops the just-made frame edit.

### Draft lifecycle — *Agent 7* · **DEFER**
- **S5 · `log.tsx:515`** — post-submit `resetForm()` re-triggers the 400 ms auto-save → recreates `mbowl_draft_v1` with the empty default form → **phantom "Resume Session?"** on next cold launch. No dirty/empty guard, not suppressed post-submit.
- **S6 · `log.tsx:294`** — on mount, if `settings.seasonStart` makes `setWeek` change the week, auto-save fires while the Resume sheet is still open and **overwrites the real persisted draft** with the empty form (genuine draft survives only in `pendingDraft` memory) → lost if the app is killed before Resume is tapped. Conditional on the week actually changing.

### Data-safety cluster — *Agent 12 (S9 also Agent 8)* · **BLOCKING**
> ⚠️ **Shared root cause — treat as one problem.** `readSessions()` collapses three distinct states — genuinely empty / invalid JSON / transient read failure — into `[]`, and callers treat `[]` as "safe to seed / back up / overwrite." Validation is also shallow. These four compound into real data-loss paths.
- **S9 · `backup.ts:16–35`** — `writeBackup` has no empty/sanity guard and overwrites `mBowl-backup.json` on **every cold launch** (`_layout.tsx:74`); one transient `readSessions()→[]` degrades the last-resort file backup to `sessions:[]`.
- **S10 · `backup.ts:63`** — `restoreBackup` validates key **presence** only (`'sessions' in payload`), not value shape → a malformed backup writes `"null"` over live data; **settings & reference have no shadow keys**, so that wipe is permanent. Fix: gate on `isValidSessionArray(payload.sessions)` + array/object checks before `multiSet`.
- **S11 · `_layout.tsx:29`** — seed gate is `readSessions().length===0` → a false-empty read with `SEEDED_FLAG` unset **overwrites real sessions with the 17 seeds**. Fix: test raw `getItem(KEYS.SESSIONS)===null`, not parsed length.
- **S12 · `storage.ts:16–24` → `leaveUtils.js:151`** — `isValidSessionArray` inspects only element `[0]`; a partially-corrupt array `[valid, null, …]` passes, then `computeLeaveStats` dereferences `null.games` → **TypeError → white-screen Stats tab**.

### Docs / dead code / structure — *Agents 13, 14*
- **S13 · `CLAUDE.md:16`** — *(DOCS→REV18)* — "Current Phase" still directs every session to `mBowl-SessionBrief-REV13.md`, which is **deleted** (only REV16/REV17 survive). One stale spot; line 4 is already correct.
- **S14 · `CLAUDE.md:163`** — *(DOCS→REV18)* — File Structure lists `src/storage.js` (now `.ts`) and **omits** `EditSessionModal.tsx`, `src/backup.ts`, `src/notifications.ts`, `src/types.ts`, `components/ui/icon-symbol.tsx`.
- **S15 · `_archive/components/ui/icon-symbol.tsx`** — *(DEFER)* — dead boilerplate still **inside the TS graph** (`tsconfig.json` includes `**/*.tsx` with no `exclude`) → latent liability to the TSC-clean gate.
- **S16 · `log.tsx:99–142` vs `history.tsx:144–188`** — *(DEFER)* — `MiniPinDeck` + `FrameGrid` duplicated verbatim, and **already diverged** (log's `miniPinUp` is `#FFFFFF`, history's is `#00CEC9`).

---

## ⚪ NICE — 14 (all DEFER)

| ID | Location | Note |
|---|---|---|
| N1 | `history.tsx:556` | Share uses a text label, not an `ActivityIndicator` spinner |
| N2 | `history.tsx:485` | Null-score expanded row renders `—` colored red |
| N3 | `log-frames.tsx:158` | Strike-streak flattens frames → false "2 IN A ROW" if a frame is skipped (rides on M1) |
| N4 | `log-frames.tsx:40` | `FRAME_RESULT_KEY` lives outside the `KEYS` registry |
| N5 | `stats.tsx:378` | Redundant `as` cast suppresses JS→TS shape-drift detection |
| N6 | `REBUILD.md:48` | `expo prebuild` without `--clean` (safe on fresh clone only) |
| N7 | `backup.ts:68` | Restore doesn't refresh shadow keys → stale-shadow revert risk |
| N8 | `seeds.js:38` | `throwNotes: []` (array) vs schema `Record<string,string\|null>` |
| N9 | `stats.tsx:85` +3 | Pin-row layout `[[6,7,8,9],[3,4,5],[1,2],[0]]` hardcoded in 4 files |
| N10 | `package.json:7` | `reset-project` script points at a deleted file |
| N11 | `assets/images/splash-icon.png` | Orphaned asset, referenced nowhere |
| N12 | `PocketDiagnosticsTab.tsx:241` | Unreachable `if (!sessions)` branch |
| N13 | `stats.tsx:116` | SPLIT badge in a non-wrapping row — long split name can squeeze |
| N14 | `leaveUtils.js:218` | `makeableConverted` returned but read by no consumer |

---

## ✂️ Cut as false positives (2) — verified NOT bugs by Agent 16

- **S7 · `log.tsx:318` — "shared `FRAME_RESULT_KEY` channel corrupts the Log draft cross-tab."** **CUT.** `log-frames` is a root-stack screen *above* the tab bar, so tabs cannot be switched while it is open. `goBack` returns focus to the originating tab (History), whose focus effect consumes/removes the key (guarded by `pendingFrameEditRef`) **before** the Log tab is ever focused. The shared-key smell is real but the cross-tab application is unreachable. *(The hygiene concern survives separately as **N4**.)*
- **S8 · `reference.tsx:296` — "`writeReference` not awaited before `writeBackup` snapshots stale data."** **CUT.** `void writeReference(...)` synchronously dispatches `setItem` before `void writeBackup()` dispatches `readReference`'s `getItem`; AsyncStorage's serial native queue completes the write before the read. Inconsistency with the other four write paths is cosmetic, not a data bug.

---

## ✅ Phase 20 core verdict — the new code is clean

Split detection, the makeable-spare metric, the `LeaveRow` refactor, the OTA channel header, and TSC all came back **clean**. Agents 1, 2, 3, 9, 10, 11, 14 confirmed:
- `isSplit` + `PIN_ADJACENCY` + `countStandingComponents` (`leaveUtils.js:40–126`): adjacency map fully symmetric with correct nearest-neighbour + only the approved 2↔8 / 3↔9 sleeper edges; guard-safe (null/wrong-length → false, never throws); 2-8-10 and 4-7-9 correctly classify as splits.
- `computeLeaveStats` makeable extension (`leaveUtils.js:145–219`): splits excluded from the denominator, no double-count, per-key `isSplit` can't drift from its pin set, `makeableSparePct` null-guarded.
- `stats.tsx`: Makeable card null/color branches crash-safe; both leave lists render via shared `LeaveRow`; every new style key exists.
- **`npx tsc --noEmit` → clean (exit 0, zero diagnostics).**
- `leaveUtils.isSplit` is the **single source of truth** — no second adjacency map / split heuristic anywhere; the frame-edit save path persists only `{throws, note, throwNotes, pinsStanding}` and never a derived field.

Every confirmed MUST/SHOULD lives in **pre-existing** surfaces (log-frames scoring, draft, backup) that this full-tree pass surfaced — not in the Phase 20 additions.

---

## Drift → REV18 (reconciliation notes, not bugs)

**Uncommitted Phase 20 (no brief exists):** split detection + `isSplit` per leave (`leaveUtils.js`); Makeable Spare % (`leaveUtils.js` + `stats.tsx` card, `LeaveRow`, SPLIT badge); `app.json:52` production-channel header — this is SideStore-plan **Phase 4** work, which REV17 still lists as "Up next: TBD."

**Post-REV17 committed fixes** (REV17 = commit `8617e32`, which predates them): B1 frame-strip overlay-at-frame-9 (`c2e6e27`); C2 share-card blank-image fix (`2d8f65e`); C2 share-card layout fix (`15aac43`); umbrella `ee77963`.

**Undocumented milestones:** app icon finalized (`6d55680`) — spec still says "deferred to Phase 12"; an **IPA was actually built and sideloaded** (`23af3c9`/`b7dcfb1`/`cf97011` add, `a81b8c0`/`72f0d47` remove) → SideStore **Phases 2–3 were exercised**, yet REV17 presents the whole install plan as not-started; `_archive/` + app.json slimming (`c51c8aa`); **REBUILD.md already exists** (`7683ed7`) though REV17 says it "will be written during the Mac session."

**Spec drift (locked doc — note only, do not edit the spec):** Reference is **5 sub-tabs, not 4** (Spares→Pocket Diagnostics, +Patterns); session edit + frame edit now exist ("Edit: not in v1" is stale); Stats carries more blocks than the spec's 5.

---

## ⚠️ Git-commit-before-Mac note

Phase 20 lives in **3 uncommitted files** (`src/leaveUtils.js`, `app/(tabs)/stats.tsx`, `app.json`). The dirty-tree-by-directive norm applies to `eas update` OTA pushes — but the **Mac IPA build does `git clone` from GitHub**, so **whatever isn't committed and pushed does not exist in the binary.** Baking the IPA with these uncommitted would ship a tree with **no split detection, no makeable metric, and no production-channel header** — and the app would silently pull OTA from the wrong branch.

**Before the Mac trip:** fix the blocking set (M1 + S1–S4 + S9–S12), then commit and push those 3 Phase 20 source files. Recommended sequence: fix M1 first (it corrupts saved scores), then the rest of the blocking set, then commit Phase 20 clean.

*(This doc is committed on its own — the Phase 20 source files are intentionally left uncommitted, pending the fix sessions.)*
