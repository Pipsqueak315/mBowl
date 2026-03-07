# mBowl — Session Brief
**Full spec lives in:** `mBowl-SPEC.md` (Project folder) — read it before writing any code.  
**Last updated:** March 2026

---

## Current Status

**Phase:** Phase 2 — Data Layer is next.  
**Last completed:** Phase 1 — Environment Setup ✅  
**Up next:** Phase 2 — Data Layer

---

## How To Start a Session

Tell Claude at the top of each chat: "Phase X — [what you're working on today]."  
Claude reads the Spec file for full context. This brief is just the current state.

---

## Build Schedule

| # | Phase | Est. Time | Chats | Status |
|---|---|---|---|---|
| 1 | Environment Setup | 30 min | 1 | ✅ Complete |
| 2 | Data Layer | 45–60 min | 1 | ⬜ Not started |
| 3 | Navigation Shell | 45 min | 1 | ⬜ Not started |
| 4 | Log Tab — Form + Submit + Draft | 90–120 min | 2 | ⬜ Not started |
| 5 | Log Frames Screen | 90 min | 2 | ⬜ Not started |
| 6 | History Tab | 60–75 min | 1 | ⬜ Not started |
| 7 | Stats Tab | 90 min | 2 | ⬜ Not started |
| 8 | Settings Screen | 45–60 min | 1 | ⬜ Not started |
| 9 | Reference: Position + Mental | 60 min | 1 | ⬜ Not started |
| 10 | Reference: Signals + Spares | 75–90 min | 2 | ⬜ Not started |
| 11 | Polish + Animations | 60–90 min | 1–2 | ⬜ Not started |
| 12 | Build + Install | 60–90 min | 1 | ⬜ Not started |
| **Total** | | **~12–14 hrs** | **~16–18 chats** | |

---

## Phase Details

### Phase 1 — Environment Setup ✅
**Completed:** March 6, 2026

- Node.js v24.14.0 installed
- Git for Windows installed
- VS Code installed
- Claude Code v2.1.71 installed and authenticated
- Expo CLI installed
- mBowl project created via `npx create-expo-app mBowl`
- Default Expo app confirmed live on iPhone via Expo Go

**Notes:** PATH fix was required after Claude Code install on Windows — added `%USERPROFILE%\.local\bin` to User environment variables manually. PowerShell execution policy also required setting to RemoteSigned before npm would run.

---

### Phase 2 — Data Layer
1. Install `@react-native-async-storage/async-storage`
2. Create `src/storage.js` — read/write helpers for all 5 keys
3. Create `src/seeds.js` — 17 historical sessions (scores in Spec)
4. First-launch seed logic: if `mbowl_sessions_v1` empty → write seeds
5. Create `src/balls.js` — initial 9-ball roster with strength ratings
6. Verify all 5 keys read/write, data survives app close/reopen

**Done when:** Console confirms storage works. 17 sessions persist across restart.  
**Brief update:** Note AsyncStorage version, any install quirks.

---

### Phase 3 — Navigation Shell
1. Install react-navigation, bottom-tabs, native-stack
2. 4 empty tab screens with correct SF Symbol icons, teal active color
3. Gear icon in header — opens blank modal sheet (wired per-screen)
4. Native stack for Log Frames (empty screen placeholder)
5. Safe area insets respected

**Done when:** All 4 tabs navigate correctly on iPhone. Gear opens blank modal. No crashes.  
**Brief update:** Note any navigation library version pins.

---

### Phase 4 — Log Tab (2 chats)

**Chat A — Core form:**
- Session type segmented selector
- Date picker (native iOS)
- Week auto-suggest from season start (every 7 days)
- Dynamic game rows — add/remove (swipe + confirm), min 1, no max
- Score input (numeric keypad, 0–300)
- Game notes field per row
- Session notes field

**Chat B — Type fields, Ball Picker, submit, draft:**
- Type-specific fields (League/Makeup/Tournament)
- Ball Picker Modal — full-screen, sorted by strength, tap to select
- "Manage Balls" shortcut → Settings
- Submit: validate → write session → clear draft → navigate to Stats → haptic
- Draft auto-save on every change (including frames)
- Resume/Discard bottom sheet on open with existing draft

**Done when:** All session types log and appear in storage. Draft survives close. Submit navigates to Stats.

---

### Phase 5 — Log Frames Screen (2 chats)

**Chat A — Frame interface:**
- Push screen from Log Frames button
- Live / Post-Game toggle at top
- Top strip: all 10 frames compact, current highlighted in teal
- Active frame card: large, centered, throw slots prominent
- Fixed chip bar at bottom: X · / · — · 0–9 (replaces system keyboard)
- Running score in real time
- 10th frame 3-throw logic (all cases)

**Chat B — Notes, complete, cancel:**
- Per-throw notes (Live only): collapsed, expand on chevron
- Per-frame notes (both modes): tap-to-expand
- Haptic on strike
- On complete: score fills game row, screen pops back
- Cancel: confirm sheet, no data saved

**Done when:** Full frame entry works both modes. Score fills correctly. 10th frame handles all cases.

---

### Phase 6 — History Tab
- Session cards collapsed: date, type badge, color-coded scores, series total
- Expand: ball per game, notes, full frame grid + key stats row, tournament details
- Made Cut badge: green / red / gray
- Filter pills: All · League · Makeup · Practice · Tournament
- Swipe left → Delete → confirm → haptic → removed from storage
- Empty states per filter

**Done when:** 17 seeded sessions display. Filter works. Delete removes from storage. Badges correct.

---

### Phase 7 — Stats Tab (2 chats)

**Chat A — Metrics:**
- Overall Average hero card, color-coded
- High Game + High Series side-by-side
- Strike % + Spare % + Opens/Game
- Apple N/A state when no frame data ("Log frames to unlock")
- Current Season / All-Time toggle
- Empty state

**Chat B — Charts:**
- Decide chart library (react-native-chart-kit vs Victory Native) — lock in now
- Series Trend line chart
- Game-by-Game Trend line chart
- Both charts respect toggle

**Done when:** All metric cards correct against seeded data. Both charts render. Toggle works.  
**Brief update:** Lock in chart library choice.

---

### Phase 8 — Settings Screen
- Modal sheet from gear icon
- Season Start + End dates (native iOS pickers)
- Ball roster: list all, add, rename, toggle active/inactive
- Changes immediately reflect in Log tab ball picker

**Done when:** Dates save and Stats reflects them. Ball changes show in picker immediately.

---

### Phase 9 — Reference: Position + Mental
- Horizontal sub-tab bar, 4 tabs
- Position: 6-row table, all fields editable inline, saves on blur
- Mental: Shot Clock (static), 5 Mental Cues (editable inline)
- All content wired to `mbowl_reference_v1`
- Pre-loaded with full content from Spec

**Done when:** Both sub-tabs render with full content. Editable fields persist across app close.

---

### Phase 10 — Reference: Signals + Spares (2 chats)

**Chat A — Signals:**
- Toggle: Switch Guide · Ball Arsenal
- Ball Arsenal: 9 balls, strength dots, gradient bar, tap to expand, content editable
- Switch Guide: 11 scenarios, expandable, color-coded direction

**Chat B — Spares:**
- 14 diagnostic leave cards, expandable
- Filter pills: All · High Frequency · Common · Situational
- Color-coded per frequency tier
- All content pre-loaded from Spec

**Done when:** All 4 Reference sub-tabs complete. All content loads. Editable fields save.

---

### Phase 11 — Polish + Animations
- `react-native-reanimated`: spring animations, scale on press
- `expo-haptics`: full audit — submit, delete, strike, confirm sheets
- `expo-blur`: modal overlays and sticky headers
- Keyboard avoid on all forms
- Safe area insets final audit
- Loading states throughout
- Full device walkthrough — must feel native

**Done when:** No jarring transitions, no keyboard overlap, no content cut off. Feels native.

---

### Phase 12 — Build + Install
- App icon asset + splash screen → configure in `app.json`
- Install EAS CLI
- `eas build --platform ios --profile preview`
- Download `.ipa`, install on iPhone
- Smoke test: log session, check stats, verify persistence

**Done when:** mBowl on home screen, runs without Expo Go, data persists.

---

## Open Questions

| Question | When |
|---|---|
| Chart library — react-native-chart-kit vs Victory Native | Phase 7 |
| App icon image | Phase 12 |
| Session edit flow | Post-v1 |

---

## Session Notes

| Session | Phase | Completed | Notes |
|---|---|---|---|
| 1 | Phase 1 | Mar 6, 2026 | Environment setup complete. PATH fix needed post Claude Code install. PowerShell execution policy set to RemoteSigned. Node v24.14.0, Claude Code v2.1.71. |

---

## Post-v1 Backlog

- Session edit flow
- Ball strength ratings editable in Settings (currently only name/active)
