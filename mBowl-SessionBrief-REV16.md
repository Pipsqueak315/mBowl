# mBowl -- Session Brief REV16
**Full spec lives in:** mBowl-SPEC.md (Project folder) -- read it before writing any code.
**Last updated:** March 22, 2026

---

## Current Status

**Phase:** Phase 18 complete -- SideStore cert expiry notification
**Last completed:** March 22, 2026
**Up next:** SideStore install -- complete in this exact order: Phase 1 (install SideStore on iPhone from PC using iloader), Phase 2 (build mBowl IPA on Mac using Xcode), Phase 3 (sideload mBowl through SideStore), Phase 4 (set up production EAS branch from PC)

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
- **Pin Deck:** Dual input mode in Log Frames. Pins/Quick toggle. Pin data optional, analytics-only.
- **Draft persistence:** Includes all form fields, frame data, and pinsStanding arrays. writeDraft(null) calls removeItem, not setItem. Draft validated on read by checking sessionType field.
- **Date storage:** formatDateISO uses local time (getFullYear/getMonth/getDate), not toISOString(). No UTC offset bug.
- **Stats:** filtered, metrics, seriesChartPoint, gameChartPoint, leaveStats, histogram, ballStats all memoized with useMemo.
- **Ball picker:** Sorted weakest to strongest. Empty state message if no active balls.
- **Season start:** Derived from settings.seasonStart at runtime. No hardcoded date.
- **Shared types:** src/types.ts is the canonical source for ThrowEntry, FrameData, GameEntry, Session, Ball, Settings, DraftData. Do not redefine these locally.
- **Storage layer:** src/storage.ts (TypeScript). KEYS object exported. All functions fully typed. No any returns.
- **Log Frames QOL:** Max Available Score (Live+Pins only), Running Series Total (game 2+), Strike Streak badge with spring animation.
- **Auto-export:** src/backup.ts exports writeBackup(). Called non-blocking (void) after every meaningful writeSessions/writeBalls/writeSettings call. Also fires on cold launch after initStorage(). Never throws, never blocks UI. Uses expo-file-system v19 new API: `new File(Paths.document, 'mBowl-backup.json').write(json)`. Output visible in Files app under On My iPhone → mBowl → mBowl-backup.json.
- **Cert reminder:** src/notifications.ts exports scheduleCertReminder(). Called non-blocking (void) in _layout.tsx after writeBackup(). Schedules one repeating iOS local notification every 6 days. Identifier: sidestore-cert-reminder. Never duplicates, never throws, iOS only.

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

---

## Phase Details (Completed Phases)

### Phases 1-12B
See REV06 (archive) or git history for full details. All complete as of March 16, 2026.

### Phase 13 -- Leave Stats
**Completed:** March 16, 2026
- leaveUtils.js: utility function extracts leave data from sessions with pinsStanding
- Named leave mapping: 11 combinations + 7-10 Split + Greek Church added in audit
- Common Leaves section in Stats tab below charts
- Mini pin diagrams, counts, conversion %, color-coded by conversion rate
- Respects Current Season / All-Time toggle
- N/A locked state when no pin data exists

### Deep Code Audit Fixes
**Completed:** March 16, 2026

Fixes applied:

MUST FIX:
- formatDateISO now uses local time (getFullYear/getMonth/getDate) -- UTC date bug eliminated

SHOULD FIX:
- Ball picker now sorted weakest to strongest in both load effect and settings-close reload
- Ball picker shows empty state message when no active balls configured
- Stats tab: filtered, metrics, seriesChartPoint, gameChartPoint wrapped in useMemo
- SEASON_START no longer hardcoded -- reads settings.seasonStart at runtime
- writeDraft(null) now calls AsyncStorage.removeItem instead of storing string "null"
- Settings modal transition: pendingOpenSettings ref replaces setTimeout(350) hack

NICE TO HAVE:
- Boilerplate files deleted: app/modal.tsx, components/external-link.tsx, components/hello-wave.tsx, components/parallax-scroll-view.tsx, components/themed-text.tsx, components/themed-view.tsx, components/ui/collapsible.tsx, scripts/reset-project.js
- storage.js read/write wrapped in try/catch
- leaveUtils.js: added 7-10 Split and Greek Church to named leave map
- handleCancelRef.current in log-frames.tsx: useCallback wrapper removed, function assigned directly
- Draft auto-save in log.tsx: 400ms debounce added

TSC: Clean (zero errors confirmed)

---

### Phase 15A -- Session Edit + Ball Strength Editable
**Completed:** March 20, 2026

**Session Edit:**
- Swipe left on History card now reveals two buttons: Edit (blue, left) + Delete (red, right)
- Tapping Edit opens a pageSheet modal (EditSessionModal.tsx) pre-populated with all session fields
- Edit form: type selector, date picker, week, opponent, tournament fields (name/format/pattern/madeCut/placement), per-game score/ball/notes, session notes
- Frame data shows read-only notice ("Frame data cannot be edited") with lock icon when frames exist
- Ball picker modal inside edit form -- loads active balls sorted weakest to strongest
- Save: validates at least one score, writes updated session (full replace, sorted by date desc), haptic confirm
- Cancel: "Discard changes?" confirm sheet if any field was modified, immediate dismiss otherwise
- Session id and date preserved exactly on save (id never regenerated; date uses local-time ISO format)

**Ball Strength Editable in Settings:**
- Each ball row in Settings now shows TappableStrengthDots instead of read-only StrengthDots
- Tapping any dot sets that ball's strength to that value (1--5)
- Writes immediately to mbowl_balls_v1 (full replace)
- Haptic on dot tap (Light)

TSC: Clean (zero errors confirmed)

---

### Phase 15B -- Stats Extensions
**Completed:** March 20, 2026

**Score Distribution Histogram:**
- New full-width card below Game-by-Game Trend chart
- 10 buckets: 100--119 through 280--300
- Custom horizontal bar chart (teal filled bars, scaled to max bucket count)
- Shows count on right of each bar; empty label if count is 0
- Empty state: lock icon + message if no scores fall in the 100--300 range
- Respects Current Season / All-Time toggle via `filtered` sessions

**Per-Ball Performance (By Ball):**
- New full-width card below Score Distribution
- Shows ball name, games logged count, and average score for each ball with data
- Sorted by average score descending
- Average color-coded using same thresholds as overall avg (≥180 green, ≥166 orange, below red)
- Empty state: "No ball data logged yet" if no ball field on any game
- Respects toggle via `filtered`

**All Tracked Leaves:**
- leaveUtils.js: removed `.slice(0, 10)` -- now returns all leaves sorted by frequency
- stats.tsx: Common Leaves section now uses `.slice(0, 10)` explicitly
- New "All Tracked Leaves" section renders after Common Leaves
- Only shown when total leaves > 10 (otherwise identical to Common Leaves, not duplicated)
- Show All / Show Less toggle when more than 10 entries (collapses to top 10 by default)
- Same visual style (mini pin diagram, count, conversion % color-coded)
- Respects toggle via `filtered`

All three new sections use `useMemo` consistent with existing memoization pattern.
TSC: Clean (zero errors confirmed)

---

### Phase 15C -- Pocket Diagnostics My Data Integration
**Completed:** March 20, 2026

**Leave name alignment audit:**
- Mapped all 14 DiagnosticCard names to their corresponding leaveUtils leave name(s)
- 3 composite cards map to 2 leaves each: "Corner pin (7 or 10)" → [7 Pin, 10 Pin]; "Baby split (2-7 or 3-10)" → [Baby Split (2-7), Baby Split (3-10)]; "Sleeper pocket (2-8 or 3-9)" → [Sleeper (2-8), Sleeper (3-9)]
- "Washout" has no matching leave (no headpin leave tracked in leaveUtils) → always shows no data
- Static `CARD_LEAVE_KEYS` lookup table in PocketDiagnosticsTab.tsx holds all mappings

**Reference / My Data toggle:**
- Segmented control at top of Pocket Diagnostics tab (above filter pills)
- Toggle state resets automatically on sub-tab switch because PocketDiagnosticsTab is conditionally rendered in reference.tsx

**My Data mode:**
- Sessions loaded all-time via `readSessions()` in `useEffect` on mount; `computeLeaveStats` processes them
- N/A locked state (lock icon + message) if no pin data has ever been logged
- If pin data exists: cards shown with count (×N), conversion % (color-coded ≥80/60/below), teal frequency bar (3px, scaled to most frequent leave in the current filtered view)
- Cards with data sorted by count descending; zero-occurrence cards moved to bottom and dimmed (opacity 0.4)
- Filter pills (All Leaves / High Frequency / Common / Situational) work in both modes
- Reference mode is pixel-identical to pre-15C -- no changes to that render path
- Expanded body (Why / Fix / Pattern) still editable in both modes

TSC: Clean (zero errors confirmed)

---

### Phase 15D -- Deep Code Audit (post 15A-C)
**Completed:** March 20, 2026

Files audited: EditSessionModal.tsx, history.tsx, SettingsContent.tsx, PocketDiagnosticsTab.tsx, stats.tsx, leaveUtils.js

**Clean (no changes):**
- history.tsx: handleSaveEdit uses functional setSessions (no stale closure), swipe button wiring correct, EditSessionModal props correct
- PocketDiagnosticsTab.tsx: getCardLeaveData composite summing correct (no double-count), computeLeaveStats only in useEffect not render path, all 14 CARD_LEAVE_KEYS verified, no any types, no console.log
- EditSessionModal.tsx: isDirty tracking correct, toISODate local-time, id preserved on save
- changeStrength in SettingsContent: stale closure acceptable (value passed as parameter, converges correctly on rapid taps)

**Fixed:**
- stats.tsx: `showAllLeaves` now resets to false when `filtered` changes (Season↔All-Time toggle no longer leaves expanded state stale). Added `useEffect(() => { setShowAllLeaves(false); }, [filtered])` after memos. Added `useEffect` to import.
- SettingsContent.tsx: Removed dead `StrengthDots` component (replaced by TappableStrengthDots in 15A, never used)

TSC: Clean (zero errors confirmed)

---

### Phase 14 -- EAS Update Deploy
**Completed:** March 20, 2026

**Deployment approach:** EAS Update (OTA) via Expo Go -- no standalone build, no Apple Developer account required.

Pre-requisites:
- Expo account created at expo.dev (free)
- EAS CLI installed: npm install -g eas-cli
- Expo Go installed on iPhone (App Store, free)

Steps Claude Code executed:
1. Verified TSC clean
2. Verified eas-cli version
3. eas login (Marcus authenticated in terminal)
4. eas update:configure (update config written to app.json)
5. eas update --branch preview --message "Phase 14 -- initial deploy"
6. Reported update URL / QR code

Manual steps after update:
- Open Expo Go on iPhone → scan QR or open project link
- Smoke test (see checklist below)
- git commit: "Phase 14 complete -- EAS Update deploy"

Smoke test checklist:
- App loads in Expo Go
- Seeded sessions appear in History
- Log a new session with scores -- submits -- appears in Stats and History
- Log a session with Pin Deck -- frames save -- leave data appears in Stats
- Current Season toggle works (requires season dates set in Settings)
- Delete a session from History
- Edit a session from History (swipe left → Edit)
- Settings opens from gear icon on all 4 tabs
- Kill app and reopen -- data persists

Done when: mBowl running in Expo Go on iPhone, smoke test passes.

---

### Phase 16A -- Log Frames QOL
**Completed:** March 22, 2026

- **Max Available Score:** shown in Live + Pins mode only, dim gray above running total. Calculates optimal completion of remaining frames using existing scoring engine (`buildMaxFrames` + `calculateMaxScore`). Hidden when game is complete. Never displays lower than current running total.
- **Running Series Total:** shown from game 2 onward, dim text below running total label, updates in real time. Prior game scores passed as comma-separated nav param (`priorScores`) from log.tsx. Parsed in log-frames.tsx into `priorTotal`.
- **Strike Streak:** yellow/fire badge, animates in with spring (damping 12, stiffness 200), haptic on each increment, instant clear on streak break. Works in all modes. Badge hidden below 2 consecutive strikes.
- **Architecture fix:** `GameRow` sub-component (defined outside `LogScreen`) received `onLogFrames: () => void` callback prop so the parent `LogScreen` can assemble nav params with access to `games` state.

TSC: Clean (zero errors confirmed)

---

### Phase 16B -- Senior SWE Audit
**Completed:** March 22, 2026

Full audit across 18 files: 4 MUST FIX, 8 SHOULD FIX, 3 NICE TO HAVE -- all resolved across two chats.

**M1:** `FRAME_RESULT_KEY` exported from log-frames.tsx, imported in log.tsx -- no more raw key string at call sites.

**M2:** `PocketDiagnosticsTab.tsx` setState-after-unmount fixed with `active` flag in `useEffect`.

**M3:** `SettingsContent.tsx` setState-after-unmount fixed with `active` flag in `useEffect`.

**M4:** `KEYS` exported from storage.ts. All raw AsyncStorage key strings in `_layout.tsx` replaced with `KEYS.SEEDED_FLAG`, `KEYS.SESSIONS_BACKUP`, `KEYS.BALLS_BACKUP`. `SEEDED_FLAG` added to KEYS object.

**S1+S2:** `stats.tsx` settings state type changed from `Settings | null` to `Settings`. Redundant `?? null` and `?? []` coalesces removed. `filterSessions` param updated to match.

**S3:** `src/types.ts` created -- canonical `ThrowEntry`, `FrameData`, `GameEntry`, `Session`, `Ball`, `Settings`, `DraftData`. Local type definitions removed from history.tsx, stats.tsx, EditSessionModal.tsx, log-frames.tsx, log.tsx. `throwNotes` drift resolved: canonical type is `Record<string, string | null>`; `emptyFrames()` now initialises with `{}`, `updateThrowNote` uses object spread. `EditableSession` in EditSessionModal is now a re-export of `Session`.

**S4:** `calculateScores`, `calculateMaxScore`, `getStrikeStreak`, and all derived values in log-frames.tsx wrapped in `useMemo` keyed on `frames`.

**S5:** `useFocusEffect` in reference.tsx got `active` flag and `return () => { active = false; }` cleanup.

**S6:** `dotRow` and `dot` moved from plain typed objects into `StyleSheet.create` in SignalsTab.tsx.

**S7:** `src/storage.js` converted to `src/storage.ts` with full TypeScript annotations. `isValidSessionArray` is now a proper type predicate (`data is Session[]`). All exported functions have typed params and return types. `DraftData` added to types.ts. Redundant `as Ball[]`, `as Session[]`, `as Settings`, `as DraftData` casts removed from all 8 call-site files. Seeds/balls casts in `_layout.tsx` kept (legitimate -- JS files without types).

**S8:** Unsafe `as unknown[]` cast removed from PocketDiagnosticsTab. `leaveUtils.js` got `@param {import('./types').Session[]}` JSDoc annotation.

**N1:** `availablePins.map(a => a)` → `[...availablePins]` in PinDeck.tsx.

**N2:** Redundant `(s as Settings) ?? {}` and `(b as Ball[]) ?? []` removed from SettingsContent.

**N3:** `{ alignItems: 'flex-end' }` inline style object in log-frames.tsx `totalRow` moved to `StyleSheet.create` as `styles.totalRight`.

**Draft validation bug fixed:** `readDraft()` was checking `data.type` instead of `data.sessionType` -- every valid draft was silently discarded on read. Fixed to check `data.sessionType`.

TSC: Clean (zero errors confirmed) -- all three chats ended with zero tsc errors.

---

### Phase 17 -- Auto-export JSON backup
**Completed:** March 22, 2026

- expo-file-system v19 installed -- uses new File/Paths API not legacy writeAsStringAsync
- `src/backup.ts` created: `writeBackup()` reads all 4 storage keys, writes complete JSON payload to `documentDirectory/mBowl-backup.json`
- Payload: `{ exportedAt: ISO string, version: 1, sessions, balls, settings, reference }`
- Uses expo-file-system v19 new class-based API: `new File(Paths.document, 'mBowl-backup.json').write(json)`. Old `writeAsStringAsync` / `documentDirectory` are deprecated in v19 and moved to `expo-file-system/legacy` -- do not use.
- Trigger points: session submit (log.tsx), session delete (history.tsx), session edit save (history.tsx handleSaveEdit), ball roster changes (SettingsContent saveBallsData -- covers add/toggle/rename/strength), season date changes (SettingsContent saveSettingsData), cold launch (app/_layout.tsx after initStorage resolves)
- Non-blocking everywhere: `void writeBackup()` fires after primary write succeeds; in setState callbacks (handleDelete, handleSaveEdit) chained via `.then(() => { void writeBackup(); })` to preserve order
- Files app visibility: `UIFileSharingEnabled: true` and `LSSupportsOpeningDocumentsInPlace: true` added to `app.json` ios.infoPlist
- In Expo Go: backup lands in On My iPhone → Expo Go → mBowl-backup.json
- In SideStore app: backup lands in On My iPhone → mBowl → mBowl-backup.json
- No UI -- entirely silent
- TSC: Clean (zero errors confirmed)

---

### Phase 18 -- SideStore cert expiry notification
**Completed:** March 22, 2026

- expo-notifications installed
- `src/notifications.ts` created: `scheduleCertReminder()` schedules a repeating local notification every 6 days
- Notification: title "mBowl — check SideStore", body "Refresh your SideStore cert before it expires. Takes 2 minutes."
- Permission requested on first cold launch -- if denied, fails silently with console log, never throws
- Checks for existing scheduled notification before creating -- never duplicates
- iOS only -- Platform.OS guard in place
- NotificationBehavior type in this expo-notifications version requires shouldShowBanner + shouldShowList in addition to shouldShowAlert -- all three present
- Called non-blocking (void) in _layout.tsx after initStorage() and writeBackup(): `initStorage().then(() => { void writeBackup(); void scheduleCertReminder(); })`
- Behavior in Expo Go vs standalone app is slightly different but correct in both -- expected and documented
- TSC: Clean (zero errors confirmed)

---

## SideStore Install Plan

### Pre-work completed
- iCloud Drive confirmed on -- JSON backup file travels to new iPhone automatically via iCloud
- GitHub repo live at github.com/Pipsqueak315/mBowl -- clean clone available for Mac build
- Xcode downloaded and opened on Mac for the first time -- initial setup complete
- Pairing file: save immediately during Phase 1 iloader setup -- store in iCloud Drive and PC for fast recovery
- REBUILD.md: Claude will write this during the Mac session capturing every exact command and Xcode setting for future rebuilds

### Known friction points and mitigations
- iOS update breaks SideStore temporarily → never let cert counter drop below 3 days. 6-day notification handles this automatically.
- Pairing file expires → save pairing file from iloader during Phase 1. Re-run iloader with saved file for fast recovery. No full reinstall needed.
- Work VPN conflicts with LocalDevVPN → Phase 18 notification fires at day 6 giving a 1-day buffer. Turn off work VPN briefly, open SideStore, tap counter to refresh, turn work VPN back on. Under 2 minutes.
- New iPhone or iCloud restore → Phase 17 backup travels via iCloud Drive. Redo Phase 1-3 install, import JSON backup to restore all session data.
- Expo SDK rebuild needed → follow REBUILD.md written during Mac session. Come back to Claude.ai for live support.
- SideStore project abandoned → fallback is AltStore + AltServer on PC. Same one-time Mac build required.

### Four phases in order

**Phase 1 -- Install SideStore on iPhone from Windows PC using iloader (no Mac needed)**
- Install LocalDevVPN from App Store on iPhone
- Download iloader on PC from SideStore site
- Connect iPhone to PC via USB, trust computer
- Open iloader, sign in with Apple ID, select iPhone, install SideStore Stable
- On iPhone: trust Apple ID in Settings → General → VPN & Device Management
- Enable Developer Mode: Settings → Privacy & Security → Developer Mode → restart
- Open LocalDevVPN → Connect
- Open SideStore, sign in, go to My Apps, tap 7 DAYS counter to finish setup
- Save pairing file from iloader immediately to iCloud Drive and PC

**Phase 2 -- Build mBowl IPA on Mac using Xcode**
- Clone project: git clone https://github.com/Pipsqueak315/mBowl.git
- Install Node.js from nodejs.org if not on Mac
- npm install
- npx expo prebuild --platform ios (confirm bundle ID com.marcus.mbowl)
- Install CocoaPods if prompted: sudo gem install cocoapods then pod install --project-directory=ios
- open ios/mBowl.xcworkspace
- Xcode: Settings → Accounts → add Apple ID
- mBowl target → Signing & Capabilities → Automatically manage signing → set Team to personal Apple ID
- Product → Archive → wait 5-15 min
- Organizer → Distribute App → Custom → Release Testing → Export → save IPA to Desktop
- AirDrop IPA to iPhone, save to Files
- Claude writes REBUILD.md during this session

**Phase 3 -- Sideload mBowl through SideStore**
- Make sure LocalDevVPN is connected
- Open SideStore → tap + → browse to mBowl IPA in Files → install
- Settings → General → VPN & Device Management → trust Apple ID for mBowl
- Open mBowl from home screen, confirm it loads and data is correct
- Confirm JSON backup appears in On My iPhone → mBowl → mBowl-backup.json in Files

**Phase 4 -- Set up production EAS branch from PC**
- eas update:branch:create production
- From this point: preview branch for Expo Go testing, production branch for SideStore app
- Verify by pushing a test update to production branch and confirming SideStore app receives it

---

## Open Questions

| Question | When |
|---|---|
| House shot exact specs (length + volume) | Verify with house sheet before updating Patterns in-app |

---

## Session Notes

| Session | Phase | Completed | Notes |
|---|---|---|---|
| 1 | Phase 1 | Mar 6 | Environment setup. PATH fix post Claude Code install. PowerShell execution policy set. |
| 2 | Phase 2 | Mar 6 | Data layer. Expo Router project discovered. Seed logic in app/_layout.tsx. |
| 3 | Admin | Mar 6 | End of Phase Protocol added to CLAUDE.md. Project path locked. Node file write method. |
| 4 | Phase 3 | Mar 6 | Nav shell. Root redirect required. Gear icon via useLayoutEffect. TSC clean. |
| 5 | Admin | Mar 11 | Spec updated: Lane Reads, Pocket Diagnostics rename, Patterns sub-tab, Your Numbers. Phase 10 split 3 ways. |
| 6 | Phase 4 | Mar 11 | Log tab complete. Both chats in one session. GestureHandlerRootView fix applied. |
| 7 | Phase 5 | Mar 11 | Log Frames complete. Both chats in one session. |
| 8 | Phase 6 | Mar 11 | History tab complete. |
| 9 | Phase 7 | Mar 11 | Stats tab. Context window interrupted mid-7b. Verified complete in later session. |
| 10 | Phase 8 | Mar 15 | Settings. Verified Phase 7 clean first, then built Settings in same session. |
| 11 | Phase 9 | Mar 15 | Reference Position + Mental + Your Numbers. |
| 12 | Phase 10A-C | Mar 15 | All 3 Reference sub-tabs (Signals, Pocket Diagnostics, Patterns). |
| 13 | Phase 11 | Mar 15 | Polish pass. Haptics audit, ScalePressable, blur overlays. Segmented control fix. |
| 14 | Phase 12A | Mar 16 | Pin Deck component + data model. |
| 15 | Phase 12B | Mar 16 | Pin Deck wired into Log Frames. MiniPinDeck in History. Draft persistence updated. |
| 16 | Phase 13 | Mar 16 | Leave Stats complete. leaveUtils.js created. Common Leaves section in Stats tab. |
| 17 | Audit Fixes | Mar 16 | Deep code audit fixes applied. TSC clean. Boilerplate deleted. See phase details above. |
| 18 | Phase 15A-C + 15D | Mar 20 | Session edit, ball strength editable, stats extensions, pocket diagnostics my data, post-15A-C audit. TSC clean. |
| 19 | REV13 Brief Cleanup | Mar 20 | Brief brought current: Phase 14 rewritten for EAS Update/Expo Go, backlog pruned, stale question removed, CLAUDE.md pointer updated. |
| 20 | Phase 16A + 16B Audit | Mar 22 | Log Frames QOL (max score, series total, streak). Full 18-file audit delivered. 16B fixes: all MUST/SHOULD/NICE items resolved. storage.js → storage.ts. TSC clean throughout. |
| 21 | 16B Closeout | Mar 22 | Draft validation bug fixed (data.type → data.sessionType). REV14 brief written. CLAUDE.md pointer updated. |
| 22 | Phase 17 | Mar 22 | Auto-export JSON backup. src/backup.ts created. expo-file-system v19 new API (File/Paths classes, not legacy). 6 trigger points wired. app.json infoPlist updated. TSC clean. |
| 23 | Phase 18 | Mar 22 | SideStore cert expiry notification. expo-notifications installed. src/notifications.ts created. NotificationBehavior type fix (shouldShowBanner + shouldShowList required). app.json plugin entry added. TSC clean. Deployed. |
| 24 | REV16 Brief | Mar 22 | Session brief updated: Phase 18 complete, SideStore install plan documented (4 phases + friction points + mitigations), architecture patterns updated, backlog updated. CLAUDE.md pointer updated to REV16. |

---

## Post-v1 Backlog

- **SideStore install:** All pre-work complete, phases documented above, ready to execute. Use the return prompt saved from this session for live step-by-step guidance.
- iCloud backup / key-value sync
- Export to CSV or JSON
- Pin-by-pin entry default (make Pins mode default in both Live and Post-Game once users are comfortable)
- Edit frame data in session edit (currently read-only by design -- v2 candidate)
