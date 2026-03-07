# mBowl -- Session Brief
**Full spec lives in:** mBowl-SPEC.md (Project folder) -- read it before writing any code.
**Last updated:** March 6, 2026

---

## Current Status

**Phase:** Phase 4 -- Log Tab (Form + Submit + Draft) is next.
**Last completed:** Phase 3 -- Navigation Shell
**Up next:** Phase 4 -- Log Tab (Chat A: Core form)

---

## How To Start a Session

Tell Claude Code at the top of each session: Phase X -- [what you are working on today].
Claude reads CLAUDE.md and mBowl-SPEC.md for full context. This brief tracks current state only.
The End of Phase Protocol lives in CLAUDE.md -- run it at the end of every phase.

---

## Critical Project Notes (Read Before Phase 4)

This is an Expo Router project -- not bare React Navigation.

- File-based routing. Tabs live in app/(tabs)/. Screens are files, not components registered manually.
- app/_layout.tsx is the root layout. Seed logic and dark theme forced here.
- app/(tabs)/_layout.tsx controls the bottom tab bar.
- React Navigation is already included via Expo Router -- do NOT reinstall it.
- Windows machine: always write files using a JS file via node. Never use python or bash heredoc.
- Write tool can be used to create the .js script, then Bash to run: node path/to/script.js

### Phase 3 Architecture Notes

**Root redirect:** app/index.tsx exists as a simple Redirect to /(tabs)/log. Required because unstable_settings: { anchor: '(tabs)' } alone does not handle the root route in Expo Go -- causes "Unmatched Route" without it. Do not delete this file.

**Gear icon pattern:** Each tab screen uses useNavigation().setOptions() inside useLayoutEffect to inject the headerRight gear button. This is the standard React Navigation pattern -- TypeScript-safe and avoids Expo Router <Tabs.Screen> name-typing issues. The gear opens a local useState Modal with presentationStyle="pageSheet" and animationType="slide" for the iOS native sheet. This will be replaced with full Settings content in Phase 8.

**Dark theme:** app/_layout.tsx forces DarkTheme always (no color scheme check). StatusBar style set to "light".

**Tab bar:** backgroundColor #1C1C1E, borderTopColor #38383A, borderTopWidth 0.5. Active teal #00CEC9, inactive dim #8E8E93.

**Headers:** headerStyle backgroundColor #000000, headerTintColor #FFFFFF, headerShadowVisible false. This blends the header into the black screen background.

**log-frames route:** Registered in app/_layout.tsx Stack as a named screen. Navigate to it via router.push('/log-frames'). No button wired yet -- just the route registered.

---

## Build Schedule

| # | Phase | Est. Time | Chats | Status |
|---|---|---|---|---|
| 1 | Environment Setup | 30 min | 1 | Complete |
| 2 | Data Layer | 45-60 min | 1 | Complete |
| 3 | Navigation Shell | 45 min | 1 | Complete |
| 4 | Log Tab -- Form + Submit + Draft | 90-120 min | 2 | Not started |
| 5 | Log Frames Screen | 90 min | 2 | Not started |
| 6 | History Tab | 60-75 min | 1 | Not started |
| 7 | Stats Tab | 90 min | 2 | Not started |
| 8 | Settings Screen | 45-60 min | 1 | Not started |
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

**Goal:** Replace default Expo starter UI with mBowl 4-tab shell.

**Files created:**
- app/(tabs)/log.tsx -- Log placeholder, black bg, gear icon, blank settings modal
- app/(tabs)/stats.tsx -- Stats placeholder, same pattern
- app/(tabs)/history.tsx -- History placeholder, same pattern
- app/(tabs)/reference.tsx -- Reference placeholder, same pattern
- app/log-frames.tsx -- Log Frames blank placeholder, black bg
- app/index.tsx -- Root redirect to /(tabs)/log (required -- see Critical Notes above)
- scripts/write_phase3.js -- Node.js script that generated all Phase 3 files

**Files modified:**
- app/(tabs)/_layout.tsx -- Full rewrite: 4 mBowl tabs, teal/dim colors, dark tab bar
- app/_layout.tsx -- Added log-frames Stack.Screen, forced DarkTheme, StatusBar light

**Files deleted:**
- app/(tabs)/index.tsx -- Default Expo starter
- app/(tabs)/explore.tsx -- Default Expo starter

**Workarounds / Issues:**
- "Unmatched Route" error on Expo Go after deleting index.tsx. Root cause: unstable_settings anchor is insufficient to handle the root URL on device. Fix: added app/index.tsx as a simple <Redirect href="/(tabs)/log" />.
- Gear icon header injection: used useNavigation().setOptions() in useLayoutEffect rather than <Tabs.Screen> component inside each screen -- avoids TypeScript name-typing issues in Expo Router.

**TypeScript:** npx tsc --noEmit clean. No errors.
**Device:** Confirmed on iPhone via Expo Go.

---

### Phase 4 -- Log Tab (2 chats)

Chat A -- Core form:
- Session type segmented selector (League, Makeup, Tournament, Practice)
- Date picker (native iOS)
- Week auto-suggest from season start (every 7 days)
- Dynamic game rows -- add/remove (swipe + confirm), min 1, no max
- Score input (numeric keypad, 0-300)
- Game notes field per row
- Session notes field

Chat B -- Type fields, Ball Picker, submit, draft:
- Type-specific fields (League/Makeup/Tournament)
- Ball Picker Modal -- full-screen, sorted by strength, tap to select
- Manage Balls shortcut to Settings
- Submit: validate, write session, clear draft, navigate to Stats, haptic
- Draft auto-save on every change (including frames)
- Resume/Discard bottom sheet on open with existing draft

Done when: All session types log and appear in storage. Draft survives close. Submit navigates to Stats.

---

### Phase 5 -- Log Frames Screen (2 chats)

Chat A -- Frame interface:
- Push screen from Log Frames button
- Live / Post-Game toggle at top
- Top strip: all 10 frames compact, current highlighted in teal
- Active frame card: large, centered, throw slots prominent
- Fixed chip bar at bottom: X, /, --, 0-9 (replaces system keyboard)
- Running score in real time
- 10th frame 3-throw logic (all cases)

Chat B -- Notes, complete, cancel:
- Per-throw notes (Live only): collapsed, expand on chevron
- Per-frame notes (both modes): tap-to-expand
- Haptic on strike
- On complete: score fills game row, screen pops back
- Cancel: confirm sheet, no data saved

Done when: Full frame entry works both modes. Score fills correctly. 10th frame handles all cases.

---

### Phase 6 -- History Tab
- Session cards collapsed: date, type badge, color-coded scores, series total
- Expand: ball per game, notes, full frame grid + key stats row, tournament details
- Made Cut badge: green / red / gray
- Filter pills: All, League, Makeup, Practice, Tournament
- Swipe left, Delete, confirm, haptic, removed from storage
- Empty states per filter

Done when: 17 seeded sessions display. Filter works. Delete removes from storage. Badges correct.

---

### Phase 7 -- Stats Tab (2 chats)

Chat A -- Metrics:
- Overall Average hero card, color-coded
- High Game + High Series side-by-side
- Strike % + Spare % + Opens/Game
- Apple N/A state when no frame data (Log frames to unlock)
- Current Season / All-Time toggle
- Empty state

Chat B -- Charts:
- Decide chart library (react-native-chart-kit vs Victory Native) -- lock in now
- Series Trend line chart
- Game-by-Game Trend line chart
- Both charts respect toggle

Done when: All metric cards correct against seeded data. Both charts render. Toggle works.

---

### Phase 8 -- Settings Screen
- Modal sheet from gear icon
- Season Start + End dates (native iOS pickers)
- Ball roster: list all, add, rename, toggle active/inactive
- Changes immediately reflect in Log tab ball picker

Done when: Dates save and Stats reflects them. Ball changes show in picker immediately.

---

### Phase 9 -- Reference: Position + Mental
- Horizontal sub-tab bar, 4 tabs
- Position: 6-row table, all fields editable inline, saves on blur
- Mental: Shot Clock (static), 5 Mental Cues (editable inline)
- All content wired to mbowl_reference_v1
- Pre-loaded with full content from Spec

Done when: Both sub-tabs render with full content. Editable fields persist across app close.

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
| Chart library -- react-native-chart-kit vs Victory Native | Phase 7 |
| App icon image | Phase 12 |
| Session edit flow | Post-v1 |

---

## Session Notes

| Session | Phase | Completed | Notes |
|---|---|---|---|
| 1 | Phase 1 | Mar 6, 2026 | Environment setup complete. PATH fix needed post Claude Code install. PowerShell execution policy set to RemoteSigned. Node v24.14.0, Claude Code v2.1.71. |
| 2 | Phase 2 | Mar 6, 2026 | Data layer complete. Expo Router project (not bare RN) -- seed logic in app/_layout.tsx. AsyncStorage SDK 54 compatible. src/storage.js, src/seeds.js, src/balls.js all created. App loads clean on iPhone. |
| 3 | Admin | Mar 6, 2026 | End of Phase Protocol added to CLAUDE.md. Project path locked in. Brief auto-write enabled. Node is the file write method on this Windows machine -- no python, no bash heredoc. |
| 4 | Phase 3 | Mar 6, 2026 | Navigation shell complete. 4 tabs wired with correct icons and teal/dim colors. Gear icon via useNavigation().setOptions() in useLayoutEffect. Modal via RN Modal presentationStyle pageSheet. Root redirect required in app/index.tsx -- unstable_settings anchor insufficient alone. log-frames route registered. TSC clean. Confirmed on device. |

---

## Post-v1 Backlog

- Session edit flow
- Ball strength ratings editable in Settings (currently only name/active)
