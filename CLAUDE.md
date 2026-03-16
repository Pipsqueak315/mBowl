# mBowl — Claude Code Instructions

**Full spec:** `mBowl-SPEC.md` in this project folder. Read it before writing any code.  
**Session state:** `mBowl-SessionBrief-REV10.md` — check this for current phase and notes.

---

## What This Is

A personal iPhone bowling tracker and reference app built in React Native via Expo. 4 tabs: Log, Stats, History, Reference. iOS-native feel, Apple dark mode only, AsyncStorage for persistence.

---

## Current Phase

**Check mBowl-SessionBrief-REV10.md for current phase before starting any session.**

At the top of each session Marcus will tell you which phase he's on. Read the Spec for full context on that phase before writing any code.

---

## Tech Stack

- **React Native via Expo** (not PWA, not web)
- **AsyncStorage** (`@react-native-async-storage/async-storage`) — only storage solution
- **React Navigation** — bottom tabs + native stack
- **expo-haptics** — haptic feedback
- **expo-blur** — modal overlays
- **expo-symbols** — SF Symbols icons
- **react-native-reanimated** — animations
- **SF Pro** — system font, no import needed on iOS

---

## How We Work

- Marcus tells you the phase at the top of each chat
- You read the Spec for that phase's full requirements
- You write complete, working code — no placeholders, no TODOs
- One step at a time. Marcus pastes output back after each command
- Clean run = one confirmation line back. Error = full output pasted
- You explain what each step does before running it
- You flag problems before they happen
- On error: Marcus pastes full output, you diagnose, provide full corrected command

---

## Non-Negotiable Rules

- **Platform:** Expo / React Native only. Never suggest PWA or web alternatives.
- **Storage:** AsyncStorage only. Never suggest SQLite, MMKV, or anything else.
- **Font:** SF Pro system font. No Google Fonts, no custom font imports.
- **Scope:** 4 tabs, bowling only. No scope creep.
- **Dark mode only.** No light mode in v1.

---

## Storage Keys

| Key | Contents |
|---|---|
| `mbowl_sessions_v1` | Full sessions array |
| `mbowl_balls_v1` | Ball roster |
| `mbowl_reference_v1` | Reference tab editable content |
| `mbowl_settings_v1` | Season dates + preferences |
| `mbowl_draft_v1` | In-progress Log tab draft |

Write strategy: full replace on every save, delete, or edit.

---

## Design System

```
bg:        #000000
surface:   #1C1C1E
card:      #2C2C2E
border:    #38383A
teal:      #00CEC9   ← brand accent
white:     #FFFFFF
dim:       #8E8E93
dimmer:    #48484A
green:     #30D158
orange:    #FF9F0A
yellow:    #FFD60A
bad:       #FF453A
```

- Card border radius: 13px
- Input/button border radius: 10px
- Standard card padding: 16px
- Tab content padding: 16px horizontal
- Active tab: teal. Inactive: dimmed.

---

## Score Color Thresholds

- Game vs session average: +5 or better → green · within 5 → orange · below → red
- Series: > 550 → green · ≥ 500 → orange · below → red
- Overall average: ≥ 180 → green · ≥ 166 → orange · below → red

---

## iOS-Native Feel — Non-Negotiable

- Navigation transitions slide horizontally
- Modals sheet up from bottom — never pop from center
- Haptics on: session submit, delete confirm, strike entry
- Buttons scale down on press
- Lists use momentum scrolling with rubber-band effect
- Blur effects on modal overlays via expo-blur

---

## File Structure (after Phase 11)

```
mBowl/
├── app/
│   ├── _layout.tsx          — root layout, seed logic, DarkTheme
│   ├── index.tsx            — redirect to /(tabs)/log
│   ├── log-frames.tsx       — Log Frames push screen
│   └── (tabs)/
│       ├── _layout.tsx      — bottom tab bar config
│       ├── log.tsx          — Log tab
│       ├── stats.tsx        — Stats tab
│       ├── history.tsx      — History tab
│       └── reference.tsx    — Reference tab
├── components/
│   ├── ScalePressable.tsx   — Reanimated spring press scale
│   ├── SettingsContent.tsx  — Settings modal (all 4 tabs)
│   ├── SignalsTab.tsx        — Reference: Signals sub-tab
│   ├── PocketDiagnosticsTab.tsx — Reference: Pocket Diagnostics sub-tab
│   └── PatternsTab.tsx      — Reference: Patterns sub-tab
├── src/
│   ├── storage.js       — AsyncStorage read/write helpers
│   ├── seeds.js         — 17 historical sessions
│   └── balls.js         — initial ball roster
├── CLAUDE.md            — this file
├── mBowl-SPEC.md        — permanent spec
└── mBowl-SessionBrief-REV10.md  — session state
```

---

## Locked Decisions — Do Not Revisit

| Decision | Answer |
|---|---|
| Platform | Expo / React Native |
| Storage | AsyncStorage only |
| Font | SF Pro system font |
| Scope | 4 tabs, bowling only |
| Default session type | League |
| After submit | Clear form, navigate to Stats |
| History default sort | Most recent first |
| Dark mode | Only — no light mode in v1 |
| Accent color | Teal #00CEC9 |
| Historical data | 17 sessions seeded on first launch |
| Ball picker | Full-screen modal, sorted by strength |
| Frame entry modes | Live / Post-Game toggle |
| Gutter notation | — (dash) |


---

## Project Path (Locked)

C:/Users/marcus/Desktop/mBowl

All brief writes go here. Never ask Marcus to confirm this path again.

---

## Windows File Write Method

Always write files using a JS file via node. Never use python or bash heredoc.
Write the JS to a file with Set-Content, then run: node path/to/script.js

---

## End of Phase Protocol

Run at the end of every phase in order. Do not skip steps.

### Step 1 - Verify Phase Completion
Run phase-specific checks below. Do not mark complete if any check fails.

### Step 2 - Update the Brief
- Mark phase complete in Build Schedule table
- Update Current Status block at top
- Add completion date to phase header
- Write thorough session notes: files created/modified, version pins, workarounds, decisions, issues and resolutions, anything next session needs to know. Vague notes not acceptable. Next session starts cold with zero memory.
- Add row to Session Notes table
- Increment RevXX by 1 in filename and header
- Update CLAUDE.md to reference new brief filename

### Step 3 - Write the Updated Brief
Write to both locations:
- C:/Users/marcus/Desktop/mBowl/mBowl-SessionBrief-REVXX.md
- C:/Users/marcus/Desktop/mBowl-SessionBrief-REVXX.md
Confirm both files exist after writing.

### Step 4 - Git Commit
git add .
git commit -m Phase X complete
Confirm commit hash.

### Step 5 - Wrap Confirmation
Output:
Phase X complete and verified.
Brief updated: mBowl-SessionBrief-REVXX.md
Written to project folder and Desktop backup.
Git committed: [hash]
One manual step: upload brief to Claude.ai project Knowledge folder.
Next up: Phase X+1 -- [name and one sentence preview]

---

## Phase Verification Checklists

### Phase 3
- app/(tabs)/log.tsx, stats.tsx, history.tsx, reference.tsx exist
- app/(tabs)/_layout.tsx contains teal #00CEC9
- app/log-frames.tsx exists
- Gear icon modal wired on all 4 tabs
- npx tsc --noEmit returns no errors
- Marcus confirms app loads on iPhone via Expo Go

### Phase 4
- LogScreen renders all session types without crash
- Type-specific fields show/hide correctly
- Ball Picker Modal opens and dismisses cleanly
- Draft persists across app close and reopen
- Submit writes to mbowl_sessions_v1 and navigates to Stats
- npx tsc --noEmit returns no errors
- Marcus confirms on device

### Phase 5
- Log Frames screen pushes from Log tab
- All 10 frames render in top strip
- Chip bar inputs correctly for frames 1-9
- 10th frame handles all 3-throw cases
- Running score calculates in real time
- Score auto-fills game row on complete
- Cancel confirm sheet fires without saving
- npx tsc --noEmit returns no errors
- Marcus confirms on device

### Phase 6
- All 17 seeded sessions visible in History
- Filter pills filter by type correctly
- Scores color-coded vs session own average
- Swipe left delete confirm removes from storage
- Empty state shows per filter
- npx tsc --noEmit returns no errors
- Marcus confirms on device

### Phase 7
- Overall average correct against seeded data
- High game and series correct
- Current Season / All-Time toggle works
- Strike/Spare/Opens shows N/A when no frame data
- Both charts render without crash
- npx tsc --noEmit returns no errors
- Marcus confirms on device

### Phase 8
- Settings modal opens from gear on all 4 tabs
- Season dates save and persist
- Ball roster add rename toggle all work
- Ball changes reflect in Log tab picker immediately
- npx tsc --noEmit returns no errors
- Marcus confirms on device

### Phase 9
- Reference tab renders 4 horizontal sub-tabs
- Position table 6 rows editable saves on blur persists
- Mental Shot Clock static 5 cues editable and persist
- All content matches Spec exactly
- npx tsc --noEmit returns no errors
- Marcus confirms on device

### Phase 10
- Signals toggle works
- Ball Arsenal 9 balls sorted weakest to strongest
- Switch Guide 11 scenarios color-coded
- Spares 14 leave cards filter pills work
- All editable fields persist
- npx tsc --noEmit returns no errors
- Marcus confirms on device

### Phase 11
- Scale-on-press on all interactive elements
- Haptics on submit delete confirm strike
- No keyboard overlap on any form
- Safe area insets correct everywhere
- Modals blur via expo-blur
- Marcus confirms feels native

### Phase 12
- App icon and splash in app.json
- EAS build completes
- ipa installs without Expo Go
- Data persists across close and reopen
- Marcus confirms on device