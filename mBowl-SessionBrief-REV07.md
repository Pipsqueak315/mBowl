# mBowl -- Session Brief
**Full spec lives in:** mBowl-SPEC.md (Project folder) -- read it before writing any code.
**Last updated:** March 15, 2026

---

## Current Status

**Phase:** Phase 9 -- Reference Tab (Position + Mental) is next.
**Last completed:** Phase 8 -- Settings Screen (complete)
**Up next:** Phase 9 -- Reference tab: Position sub-tab (6-row editable table) + Mental sub-tab (Shot Clock + 5 editable cues)

---

## How To Start a Session

Tell Claude Code at the top of each session: Phase X -- [what you are working on today].
Claude reads CLAUDE.md and mBowl-SPEC.md for full context. This brief tracks current state only.
The End of Phase Protocol lives in CLAUDE.md -- run it at the end of every phase.

---

## Critical Project Notes (Read Before Phase 9)

This is an Expo Router project -- not bare React Navigation.

- File-based routing. Tabs live in app/(tabs)/. Screens are files, not components registered manually.
- app/_layout.tsx is the root layout. Seed logic and dark theme forced here.
- app/(tabs)/_layout.tsx controls the bottom tab bar.
- React Navigation is already included via Expo Router -- do NOT reinstall it.
- Windows machine: always write files using a JS file via node. Never use python or bash heredoc.
- Write tool can be used to create the .js script, then Bash to run: node path/to/script.js

### Architecture Notes Accumulated Through Phase 8

**Root redirect:** app/index.tsx exists as a simple Redirect to /(tabs)/log. Required -- do not delete.

**Gear icon pattern:** Each tab screen uses useNavigation().setOptions() inside useLayoutEffect to inject the headerRight gear button. Modal opens with presentationStyle="pageSheet" and animationType="slide".

**Settings modal:** All 4 tabs now render `<SettingsContent onClose={...} />` inside their gear icon Modal. SettingsContent lives at components/SettingsContent.tsx. It handles its own SafeAreaView, header, scrollview, and data loading.

**Dark theme:** app/_layout.tsx forces DarkTheme always. StatusBar style set to "light".

**Tab bar:** backgroundColor #1C1C1E, borderTopColor #38383A, borderTopWidth 0.5. Active teal #00CEC9, inactive dim #8E8E93.

**Headers:** headerStyle backgroundColor #000000, headerTintColor #FFFFFF, headerShadowVisible false.

**log-frames route:** Registered in app/_layout.tsx Stack. Navigate via router.push('/log-frames').

**Stats tab data loading:** Uses useFocusEffect + useCallback to reload sessions and settings every time the tab is focused. This ensures stats update after a new session is submitted from the Log tab AND after season dates are set in Settings.

**Season toggle fallback:** When Current Season is selected but no dates exist in mbowl_settings_v1, the filter silently falls back to All-Time and shows a dim hint "No season dates set -- showing all sessions."

**Chart library decision (locked):** react-native-chart-kit. Peer deps compatible with React 19.1.0 + RN 0.81.5 + Expo SDK 54.

**CHART_CONFIG:** Defined outside the StatsScreen component as a module-level constant. This is intentional -- keeps the reference stable across renders.

**Ball picker in Log tab:** Manage Balls button at bottom now closes the picker and opens the Settings modal (via setTimeout 350ms to allow dismiss animation). Text is teal to signal it's actionable.

**Log tab ball reload:** When the Settings modal closes, a useEffect (watching settingsOpen via wasSettingsOpen ref) reloads active balls from mbowl_balls_v1. This ensures ball picker stays in sync with roster changes.

**DateTimePicker:** @react-native-community/datetimepicker v8.4.4 is installed. Used in both Log tab (date field) and SettingsContent (season dates). Use display="spinner" and textColor="#FFFFFF". Parse ISO dates with 'T12:00:00' suffix to avoid timezone day-shift issues. Build ISO string manually (not toISOString()) for the same reason.

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
| 9 | Reference: Position + Mental | 60 min | 1 | Not started |
| 10 | Reference: Signals + Spares | 75-90 min | 2 | Not started |
| 11 | Polish + Animations | 60-90 min | 1-2 | Not started |
| 12 | Build + Install | 60-90 min | 1 | Not started |

---

## Phase Details

### Phase 1 -- Environment Setup
**Completed:** March 6, 2026

- Node.js v24.14.0 installed
- Git for Windows installed
- VS Code installed
- Claude Code v2.1.71 installed and authenticated
- Expo CLI installed
- mBowl project created via npx create-expo-app mBowl
- Default Expo app confirmed live on iPhone via Expo Go

Notes: PATH fix required after Claude Code install -- added %USERPROFILE%\.local\bin to User environment variables manually. PowerShell execution policy set to RemoteSigned before npm would run.

---

### Phase 2 -- Data Layer
**Completed:** March 6, 2026

- @react-native-async-storage/async-storage installed via npx expo install (SDK 54.0.0 compatible version)
- src/storage.js created -- 10 named exports (read/write for all 5 keys), full replace strategy
- src/seeds.js created -- all 17 historical league sessions, full game schema
- src/balls.js created -- 9-ball roster, weakest to strongest, all active true
- First-launch seed logic wired into app/_layout.tsx -- seeds sessions and balls if storage empty
- App confirmed loading clean on iPhone via Expo Go

Storage keys confirmed working:
- mbowl_sessions_v1: 17 seeded sessions
- mbowl_balls_v1: 9-ball roster
- mbowl_reference_v1: empty until Phase 9
- mbowl_settings_v1: empty until Phase 8
- mbowl_draft_v1: empty until Phase 4

---

### Phase 3 -- Navigation Shell
**Completed:** March 6, 2026

Files created: app/(tabs)/log.tsx, stats.tsx, history.tsx, reference.tsx, log-frames.tsx, index.tsx, scripts/write_phase3.js
Files modified: app/(tabs)/_layout.tsx, app/_layout.tsx
Files deleted: app/(tabs)/index.tsx, app/(tabs)/explore.tsx

Workaround: "Unmatched Route" on Expo Go fixed by adding app/index.tsx as Redirect to /(tabs)/log.
Gear icon via useNavigation().setOptions() in useLayoutEffect -- avoids TypeScript typing issues.
TypeScript clean. Confirmed on device.

---

### Phase 4 -- Log Tab
**Completed:** (session before Phase 7)

Full Log tab with all session types, ball picker modal, draft persistence, and submit flow.
Confirmed on device.

---

### Phase 5 -- Log Frames Screen
**Completed:** (session before Phase 7)

Full frame entry screen with Live/Post-Game toggle, 10-frame logic, running score, haptic on strike.
Confirmed on device.

---

### Phase 6 -- History Tab
**Completed:** (session before Phase 7)

All 17 seeded sessions display. Filter pills work. Expand/collapse with frame grid. Swipe-delete with confirm. Color-coded scores. Confirmed on device.

---

### Phase 7 -- Stats Tab (2 chats)
**Completed:** March 10, 2026

Built: metrics (avg hero, high game/series, strike/spare/opens N/A state, toggle, empty state) + charts (react-native-chart-kit + react-native-svg; Series Trend + Game-by-Game Trend; both respect toggle; safe data guards). TSC clean. Confirmed on device.

Expected values against 17 seeded sessions:
- Overall Average: ~167.4 (orange)
- High Game: 253 (Week 8)
- High Series: 620 (Week 14: 173+205+242)
- Strike/Spare/Opens: N/A (no frame data in seeds)

---

### Phase 8 -- Settings Screen
**Completed:** March 15, 2026

**Files created:**
- components/SettingsContent.tsx -- standalone settings component, wired into all 4 tabs

**Files modified:**
- app/(tabs)/log.tsx -- SettingsContent injected; Manage Balls now opens Settings; wasSettingsOpen ref + useEffect reloads active balls after settings closes; manageBallsText changed to teal
- app/(tabs)/stats.tsx -- SettingsContent injected; dead SafeAreaView import + dead modal styles removed
- app/(tabs)/history.tsx -- SettingsContent injected
- app/(tabs)/reference.tsx -- SettingsContent injected; dead SafeAreaView import + dead modal styles removed

**What was built in SettingsContent.tsx:**
- Season Start Date + Season End Date: native iOS date picker (display="spinner"), saves immediately to mbowl_settings_v1 on every picker change. Date parsing uses 'T12:00:00' suffix to prevent timezone day-shift. ISO string built manually (not toISOString()) for same reason.
- Ball Roster section: lists all balls from mbowl_balls_v1, sorted by strength. Each row: 5-dot strength indicator + ball name (tap to rename inline, saves on blur/submit) + active/inactive iOS Switch (teal when active). Add Ball form: name TextInput + 1-5 strength picker buttons + Save button. New balls inserted sorted by strength. All changes write immediately to mbowl_balls_v1.
- Settings loads its own data on mount via readSettings() + readBalls().
- SettingsContent handles its own SafeAreaView and header ("Settings" title + teal Done button).

**Key wiring details:**
- Stats tab: already uses useFocusEffect to reload settings on tab focus -- Current Season filter will automatically use saved dates after settings close + tab refocus.
- Log tab: useEffect watches settingsOpen via wasSettingsOpen ref; on settings close, re-reads active balls into availableBalls state so ball picker is immediately up to date.
- Manage Balls button: closes ball picker, then setTimeout 350ms, then opens settings (allows dismiss animation to complete before opening new sheet).

TSC clean. Confirmed on device: pending Marcus confirmation.

---

### Phase 9 -- Reference: Position + Mental

Goal: Build out the Reference tab with 2 of its 4 sub-tabs.

**Current state:** reference.tsx is a placeholder (just shows "Reference" text).

**What to build:**
- Horizontal sub-tab bar at top: 4 pills -- Position · Signals · Spares · Mental. Signals + Spares inactive/grayed until Phase 10.
- Sub-tab 1 -- Position: 6-row table (Scenario / Feet / Eyes / Notes columns). All cells editable inline, saves on blur, persists to mbowl_reference_v1. Pre-loaded with spec content on first load.
- Sub-tab 4 -- Mental: Shot Clock (4-frame read framework, static display) + 5 Mental Cues (editable inline, saves on blur, persists to mbowl_reference_v1). Pre-loaded with spec content.
- All reference content loads from mbowl_reference_v1, initialized with spec defaults if empty.

Reference storage key: mbowl_reference_v1. Structure is flexible -- design the schema in Phase 9 to accommodate Phase 10 content too.

Done when: Position and Mental sub-tabs render with full spec content. Editable fields persist across app close.

---

### Phase 10 -- Reference: Signals + Spares (2 chats)

Chat A -- Signals:
- Toggle: Switch Guide, Ball Arsenal
- Ball Arsenal: 9 balls, strength dots, tap to expand, content editable
- Switch Guide: 11 scenarios, expandable, color-coded direction

Chat B -- Spares:
- 14 diagnostic leave cards, expandable
- Filter pills: All, High Frequency, Common, Situational
- Color-coded per frequency tier
- All content pre-loaded from Spec

Done when: All 4 Reference sub-tabs complete. All content loads. Editable fields save.

---

### Phase 11 -- Polish + Animations
- react-native-reanimated: spring animations, scale on press
- expo-haptics: full audit -- submit, delete, strike, confirm sheets
- expo-blur: modal overlays and sticky headers
- Keyboard avoid on all forms
- Safe area insets final audit
- Loading states throughout
- Full device walkthrough -- must feel native

Done when: No jarring transitions, no keyboard overlap, no content cut off. Feels native.

---

### Phase 12 -- Build + Install
- App icon asset + splash screen, configure in app.json
- Install EAS CLI
- eas build --platform ios --profile preview
- Download .ipa, install on iPhone
- Smoke test: log session, check stats, verify persistence

Done when: mBowl on home screen, runs without Expo Go, data persists.

---

## Open Questions

| Question | When |
|---|---|
| App icon image | Phase 12 |
| Session edit flow | Post-v1 |

---

## Session Notes

| Session | Phase | Completed | Notes |
|---|---|---|---|
| 1 | Phase 1 | Mar 6, 2026 | Environment setup complete. PATH fix needed post Claude Code install. PowerShell execution policy set to RemoteSigned. Node v24.14.0, Claude Code v2.1.71. |
| 2 | Phase 2 | Mar 6, 2026 | Data layer complete. Expo Router project (not bare RN). AsyncStorage SDK 54 compatible. src/storage.js, src/seeds.js, src/balls.js all created. App loads clean on iPhone. |
| 3 | Admin | Mar 6, 2026 | End of Phase Protocol added to CLAUDE.md. Project path locked in. Node is the file write method. |
| 4 | Phase 3 | Mar 6, 2026 | Navigation shell complete. 4 tabs wired. Gear icon via useNavigation().setOptions(). Root redirect in app/index.tsx required. log-frames route registered. TSC clean. Confirmed on device. |
| 5 | Phase 4+5+6 | (before Mar 10) | Log tab, Log Frames screen, History tab all complete and confirmed on device. |
| 6 | Phase 7 | Mar 10, 2026 | Stats tab complete. Metrics + charts. react-native-chart-kit + react-native-svg added. TSC clean. Confirmed on device. |
| 7 | Phase 8 | Mar 15, 2026 | Settings screen complete. components/SettingsContent.tsx created. Wired into all 4 tab gear modals. Season dates + ball roster fully functional. Manage Balls shortcut from Log ball picker opens Settings. Log tab reloads active balls on settings close. TSC clean. Pending device confirmation. |

---

## Post-v1 Backlog

- Session edit flow
- Ball strength ratings editable in Settings (currently only name/active)
