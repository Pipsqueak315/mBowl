# mBowl -- Session Brief
**Full spec lives in:** mBowl-SPEC.md (Project folder) -- read it before writing any code.
**Last updated:** March 6, 2026

---

## Current Status

**Phase:** Phase 3 -- Navigation Shell is next.
**Last completed:** Phase 2 -- Data Layer
**Up next:** Phase 3 -- Navigation Shell

---

## How To Start a Session

Tell Claude Code at the top of each session: Phase X -- [what you are working on today].
Claude reads CLAUDE.md and mBowl-SPEC.md for full context. This brief tracks current state only.
The End of Phase Protocol lives in CLAUDE.md -- run it at the end of every phase.

---

## Critical Project Notes (Read Before Phase 3)

This is an Expo Router project -- not bare React Navigation.

- File-based routing. Tabs live in app/(tabs)/. Screens are files, not components registered manually.
- app/_layout.tsx is the root layout. Seed logic was wired here in Phase 2.
- app/(tabs)/_layout.tsx controls the bottom tab bar.
- React Navigation is already included via Expo Router -- do NOT reinstall it.
- Phase 3 must reference Expo Router file structure, not manual navigator setup.
- Windows machine: always write files using a JS file via node. Never use python or bash heredoc.

---

## Build Schedule

| # | Phase | Est. Time | Chats | Status |
|---|---|---|---|---|
| 1 | Environment Setup | 30 min | 1 | Complete |
| 2 | Data Layer | 45-60 min | 1 | Complete |
| 3 | Navigation Shell | 45 min | 1 | Not started |
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

### Phase 3 -- Navigation Shell -- UP NEXT
**Goal:** Replace the default Expo starter UI with mBowl 4-tab shell. No screen content yet -- just correct structure, icons, colors, and navigation wired up.

Claude Code prompt to use:

Read CLAUDE.md and mBowl-SPEC.md before writing any code.

I am on Phase 3 -- Navigation Shell. This is an Expo Router project. The tab structure lives in app/(tabs)/.

1. Replace app/(tabs)/_layout.tsx with mBowl 4-tab config:
   - Log (icon: square.and.pencil)
   - Stats (icon: chart.bar.fill)
   - History (icon: list.bullet)
   - Reference (icon: book.fill)
   - Active tab color: teal #00CEC9. Inactive: dimmed #8E8E93.
   - Tab bar background: #1C1C1E. Respects iPhone safe area insets.

2. Replace each tab screen with a minimal placeholder:
   - app/(tabs)/log.tsx -- dark background, Log centered in white SF Pro
   - app/(tabs)/stats.tsx -- dark background, Stats centered
   - app/(tabs)/history.tsx -- dark background, History centered
   - app/(tabs)/reference.tsx -- dark background, Reference centered
   - Background color: #000000 on all screens

3. Add gear icon (gearshape.fill) to the header on each tab screen.
   - Tapping it opens a blank modal sheet (slides up from bottom).
   - Modal has a close button. No content yet.
   - Wire this consistently across all 4 tabs.

4. Add a native stack screen for LogFrames:
   - app/log-frames.tsx -- blank placeholder, Log Frames centered
   - Accessible via push navigation from the Log tab (button not needed yet -- just register the route)

5. Delete any default Expo starter files that are no longer needed (index.tsx, explore tab, etc.) -- clean slate.

Done when: All 4 tabs navigate on iPhone. Correct icons and teal active color. Gear opens blank modal. No default Expo content visible. No crashes.

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

---

## Post-v1 Backlog

- Session edit flow
- Ball strength ratings editable in Settings (currently only name/active)
