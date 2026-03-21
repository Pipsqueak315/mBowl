# mBowl -- Session Brief REV09
**Full spec lives in:** mBowl-SPEC.md (Project folder) -- read it before writing any code.
**Last updated:** March 20, 2026

---

## Current Status

**Phase:** Phase 15B complete -- Stats Extensions
**Last completed:** Phase 15B (March 20, 2026)
**Up next:** Phase 14 -- Build + Install

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
- **Draft persistence:** Includes all form fields, frame data, and pinsStanding arrays. writeDraft(null) calls removeItem, not setItem.
- **Date storage:** formatDateISO uses local time (getFullYear/getMonth/getDate), not toISOString(). No UTC offset bug.
- **Stats:** filtered, metrics, seriesChartPoint, gameChartPoint all memoized with useMemo.
- **Ball picker:** Sorted weakest to strongest. Empty state message if no active balls.
- **Season start:** Derived from settings.seasonStart at runtime. No hardcoded date.

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
| 14 | Build + Install | 60-90 min | 1 | Not started |

---

## Phase Details (Completed Phases)

### Phases 1-12B
See REV07 for full details. All complete as of March 16, 2026.

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

## Phase 14 -- Build + Install

Pre-requisites Marcus must complete away from Claude Code before starting this phase:
- Apple Developer Program enrolled and active ($99/year -- apple.com/developer)
- Expo account created at expo.dev (free)
- EAS CLI installed: npm install -g eas-cli
- Apple Configurator 2 installed on Mac (free -- Mac App Store) OR Xcode installed
- assets/images/icon.png (1024x1024) confirmed present
- assets/images/splash-icon.png confirmed present

Steps Claude Code will execute:
1. Verify TSC clean
2. Verify eas-cli version
3. Create eas.json with preview internal distribution profile
4. Verify app.json fields (name, slug, bundleIdentifier, buildNumber, version)
5. eas login (Marcus authenticates in terminal)
6. eas project:init
7. eas build --platform ios --profile preview
8. Report build URL and download link

Manual steps after build:
- Download .ipa from EAS dashboard or build URL
- Install via Apple Configurator 2 or Xcode Devices window
- Trust developer certificate on iPhone: Settings > General > VPN & Device Management
- Smoke test (see smoke test checklist below)
- git commit: "Phase 14 complete -- production build"

Smoke test checklist:
- App opens without Expo Go
- Seeded sessions appear in History
- Log a new session with scores -- submits -- appears in Stats and History
- Log a session with Pin Deck -- frames save -- leave data appears in Stats
- Current Season toggle works (requires season dates set in Settings)
- Delete a session from History
- Settings opens from gear icon on all 4 tabs
- Kill app and reopen -- data persists

Done when: mBowl on home screen, runs without Expo Go, smoke test passes.

---

## Open Questions

| Question | When |
|---|---|
| House shot exact specs (length + volume) | Verify with house sheet before updating Patterns in-app |
| Apple Developer enrollment status | Needed for Phase 14 -- must be active before starting |

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

---

## Post-v1 Backlog

- iCloud backup / key-value sync
- Export to CSV or JSON
- Per-ball performance stats (average by ball)
- Spare conversion by specific pin combo (deeper than top 10)
- Pocket Diagnostics integration (link actual leave data to reference cards)
- Score distribution histogram
- Pin-by-pin entry default (make Pins mode default in both Live and Post-Game once users are comfortable)
