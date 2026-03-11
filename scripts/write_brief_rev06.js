const fs = require('fs');

const content = `# mBowl -- Session Brief
**Full spec lives in:** mBowl-SPEC.md (Project folder) -- read it before writing any code.
**Last updated:** March 10, 2026

---

## Current Status

**Phase:** Phase 8 -- Settings Screen is next.
**Last completed:** Phase 7 -- Stats Tab (both chats, complete)
**Up next:** Phase 8 -- Settings Screen (season dates + ball roster)

---

## How To Start a Session

Tell Claude Code at the top of each session: Phase X -- [what you are working on today].
Claude reads CLAUDE.md and mBowl-SPEC.md for full context. This brief tracks current state only.
The End of Phase Protocol lives in CLAUDE.md -- run it at the end of every phase.

---

## Critical Project Notes (Read Before Phase 8)

This is an Expo Router project -- not bare React Navigation.

- File-based routing. Tabs live in app/(tabs)/. Screens are files, not components registered manually.
- app/_layout.tsx is the root layout. Seed logic and dark theme forced here.
- app/(tabs)/_layout.tsx controls the bottom tab bar.
- React Navigation is already included via Expo Router -- do NOT reinstall it.
- Windows machine: always write files using a JS file via node. Never use python or bash heredoc.
- Write tool can be used to create the .js script, then Bash to run: node path/to/script.js

### Architecture Notes Accumulated Through Phase 7

**Root redirect:** app/index.tsx exists as a simple Redirect to /(tabs)/log. Required -- do not delete.

**Gear icon pattern:** Each tab screen uses useNavigation().setOptions() inside useLayoutEffect to inject the headerRight gear button. Modal opens with presentationStyle="pageSheet" and animationType="slide". Phase 8 will fill this modal with real Settings content.

**Dark theme:** app/_layout.tsx forces DarkTheme always. StatusBar style set to "light".

**Tab bar:** backgroundColor #1C1C1E, borderTopColor #38383A, borderTopWidth 0.5. Active teal #00CEC9, inactive dim #8E8E93.

**Headers:** headerStyle backgroundColor #000000, headerTintColor #FFFFFF, headerShadowVisible false.

**log-frames route:** Registered in app/_layout.tsx Stack. Navigate via router.push('/log-frames').

**Stats tab data loading:** Uses useFocusEffect + useCallback to reload sessions and settings every time the tab is focused. This ensures stats update after a new session is submitted from the Log tab.

**Season toggle fallback:** When Current Season is selected but no dates exist in mbowl_settings_v1, the filter silently falls back to All-Time and shows a dim hint "No season dates set -- showing all sessions." This is intentional until Phase 8 sets real dates.

**Chart library decision (locked):** react-native-chart-kit. Chosen over Victory Native because:
- Simpler API, fewer deps
- Uses react-native-svg (well-supported by Expo)
- Peer deps compatible with React 19.1.0 + RN 0.81.5 + Expo SDK 54
- Victory Native 40+ requires @shopify/react-native-skia which is a heavy unneeded dep

**CHART_CONFIG:** Defined outside the StatsScreen component as a module-level constant. This is intentional -- keeps the reference stable across renders and avoids recreating the object.

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

Notes: PATH fix required after Claude Code install -- added %USERPROFILE%\\.local\\bin to User environment variables manually. PowerShell execution policy set to RemoteSigned before npm would run.

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

**Chat A -- Metrics:**

Files created: scripts/write_stats_phase7a.js
Files modified: app/(tabs)/stats.tsx (full rewrite from Phase 3 placeholder)

Built:
- Current Season / All-Time toggle at top. Teal active, dark inactive, pill-style.
- Overall Average hero card: 64pt number, color-coded (>=180 green, >=166 orange, below red).
- High Game + High Series: two equal-width cards side by side.
- Strike % + Spare % + Opens/Game: three equal-width cards. N/A state with lock icon and "Log frames to unlock." when no frame data exists in filtered sessions.
- Empty state: SF Symbol icon + "No sessions yet" when no sessions match the filter.
- useFocusEffect reloads data on every tab focus.
- Season toggle falls back silently to All-Time when no season dates set (Phase 8 will fix this).
- TSC clean. Confirmed on device.

Expected values against 17 seeded sessions (all league, no frame data):
- Overall Average: ~167.4 (orange)
- High Game: 253 (Week 8, session 1005)
- High Series: 620 (Week 14, session 1010: 173+205+242)
- Strike/Spare/Opens: N/A state (no frame data in seeds)

**Chat B -- Charts:**

Files created: scripts/write_stats_phase7b.js
Files modified: app/(tabs)/stats.tsx (added chart imports, helpers, and chart cards)
Dependencies added:
- react-native-svg: installed via npx expo install (SDK 54 compatible version resolved automatically)
- react-native-chart-kit: installed via npm install (4 packages added)

Built:
- Series Trend line chart: one point per session, chronological. Teal bezier line. Date labels shown every 3rd session ("9/6", "10/18", etc.) to prevent crowding. Teal dots with surface fill. Grid lines #38383A solid.
- Game-by-Game Trend line chart: one point per individual game across all sessions (51 points with 17 seeded sessions). No dots (too dense). No X labels (withVerticalLabels={false}). Teal bezier. Same grid.
- Both charts: full-width inside surface-colored card with overflow hidden. chartWidth = useWindowDimensions().width - 32. Chart fills edge-to-edge within card; card handles border radius and clipping.
- Both charts respect toggle -- data recalculates when toggle changes.
- Safe data guards: buildSeriesData and buildGameData return null if < 2 data points; placeholder text shown instead of chart.
- CHART_CONFIG defined as module-level constant outside component (stable reference).
- TSC clean. Confirmed on device.

Chart config details:
- backgroundColor/backgroundGradientFrom/To: #1C1C1E
- color: rgba(0, 206, 201, opacity) -- teal
- labelColor: rgba(142, 142, 147, opacity) -- dim
- propsForDots: r=4, stroke #00CEC9, fill #1C1C1E (hollow teal dot)
- propsForBackgroundLines: stroke #38383A, strokeDasharray '' (solid lines)
- decimalPlaces: 0

Note: rgba color functions use string concatenation (not template literals) to avoid double-escaping issues in the node.js write script.

---

### Phase 8 -- Settings Screen

Goal: Full Settings modal from gear icon on any tab.

Content:
- Season Start Date + Season End Date -- native iOS date pickers. Writes to mbowl_settings_v1.
- Ball Roster -- list all balls, add new, rename, toggle active/inactive. Writes to mbowl_balls_v1.

When dates are saved, Stats tab Current Season toggle will filter correctly.
When balls change, Log tab ball picker must reflect immediately (it reads from mbowl_balls_v1 on focus).

Currently: All 4 tab gear icons open an empty modal sheet with just a Done button. Phase 8 replaces that content.

The gear modal pattern is the same across all 4 tabs -- the Settings content just needs to be built once and wired into each modal. Recommend building the Settings content as a standalone component that gets rendered inside the modal on each tab. Or build it in one tab first and confirm, then copy to the other three.

Done when: Season dates save and Stats reflects them. Ball changes show in Log picker immediately.

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
| 6 | Phase 7 | Mar 10, 2026 | Stats tab complete. 7A: metrics (avg hero, high game/series, strike/spare/opens, N/A state, toggle, empty state). 7B: charts (react-native-chart-kit + react-native-svg added; Series Trend + Game-by-Game Trend; both respect toggle; safe data guards). TSC clean. Confirmed on device. |

---

## Post-v1 Backlog

- Session edit flow
- Ball strength ratings editable in Settings (currently only name/active)
`;

const pathA = 'C:/Users/marcus/Desktop/mBowl/mBowl-SessionBrief-REV06.md';
const pathB = 'C:/Users/marcus/Desktop/mBowl-SessionBrief-REV06.md';

fs.writeFileSync(pathA, content, 'utf8');
fs.writeFileSync(pathB, content, 'utf8');

console.log('Written: ' + pathA);
console.log('Written: ' + pathB);
