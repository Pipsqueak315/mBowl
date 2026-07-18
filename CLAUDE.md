# mBowl — Claude Code Instructions

**Full spec:** `mBowl-SPEC.md` in this project folder. Read it before writing any code.
**Session state:** `mBowl-SessionBrief-REV19.md` — check this for current phase and notes.

---

## What This Is

A personal iPhone bowling tracker and reference app built in React Native via Expo. 4 tabs: Log, Stats, History, Reference. iOS-native feel, Apple dark mode only, AsyncStorage for persistence.

---

## Current Phase

**Check mBowl-SessionBrief-REV19.md for current phase before starting any session.**

At the top of each session Marcus will tell you which phase he's on. Read the Spec for full context on that phase before writing any code.

---

## Tech Stack

- **React Native via Expo** (SDK 54, Expo Router 6)
- **AsyncStorage** (`@react-native-async-storage/async-storage`) — only storage solution
- **Expo Router** — file-based routing (NOT bare React Navigation)
- **expo-haptics** — haptic feedback
- **expo-blur** — modal overlays
- **expo-symbols** — SF Symbols icons
- **react-native-reanimated** (~4.1.1) — animations
- **react-native-gesture-handler** — swipe gestures
- **react-native-chart-kit** — Stats tab line charts
- **react-native-svg** — required by chart-kit + PinDeck visuals
- **@react-native-community/datetimepicker** — native iOS date pickers
- **SF Pro** — system font, no import needed on iOS

---

## Critical Architecture Notes

This is an **Expo Router** project — NOT bare React Navigation.

- File-based routing. Tabs live in `app/(tabs)/`. Screens are files, not components registered manually.
- `app/_layout.tsx` is the root layout. Seed logic and dark theme forced here.
- `app/(tabs)/_layout.tsx` controls the bottom tab bar.
- `app/index.tsx` exists as a redirect to `/(tabs)/log` — required because `unstable_settings` alone doesn't handle root in Expo Go.
- React Navigation is included via Expo Router — do NOT reinstall it separately.

### Windows Machine Constraints

- **Never use python heredoc or bash heredoc.** They don't work on this machine.
- File writes use Node: write JS to a file with `Set-Content`, then run `node path/to/script.js`.
- PowerShell does not support `&&` — run commands one at a time.
- `python3` is NOT in PATH.

---

## How We Work

- Marcus tells you the phase at the top of each chat
- You read the Spec for that phase's full requirements
- **Audit before building:** At the start of each phase, read the relevant files and report what exists before writing code
- You write complete, working code — no placeholders, no TODOs
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

All keys live in the exported `KEYS` object in `src/storage.ts`. **Never write a raw key string at a call site — always `KEYS.X`.**

| `KEYS` name | Key | Contents |
|---|---|---|
| `SESSIONS` | `mbowl_sessions_v1` | Full sessions array |
| `SESSIONS_BACKUP` | `mbowl_sessions_backup_v1` | Shadow copy — written on every `writeSessions` |
| `BALLS` | `mbowl_balls_v1` | Ball roster |
| `BALLS_BACKUP` | `mbowl_balls_backup_v1` | Shadow copy — written on every `writeBalls` |
| `REFERENCE` | `mbowl_reference_v1` | Reference tab editable content |
| `SETTINGS` | `mbowl_settings_v1` | Season dates + preferences + goals |
| `DRAFT` | `mbowl_draft_v1` | In-progress Log tab draft (includes frame + pin data) |
| `SEEDED_FLAG` | `mbowl_seeded_v1` | `'true'` once seeding has been decided — seeds run at most once, ever |

Write strategy: full replace on every save, delete, or edit.

`REFERENCE` and `SETTINGS` have **no shadow key** — a bad write to either is permanent. This is why `restoreBackup` shape-checks every value before writing anything.

**Reading (Phase 20):** `readSessions()` returns a plain array and is for **display-only** callers. Anything that **writes** based on what it read must use `readSessionsResult()` / `readBallsResult()`, which return `{ status, value }` where status is `'missing' | 'ok' | 'invalid' | 'error'`. A bare `[]` cannot distinguish "genuinely empty" from "corrupt" or "read failed" — **never act on `[]` alone.** Only `missing` may be seeded over. See `mBowl-SessionBrief-REV19.md` → Fix Session C.

`FRAME_RESULT_KEY` (the log-frames → caller result channel) is exported from `app/log-frames.tsx` and is **not** in `KEYS` (audit N4, deferred).

---

## Design System

```
bg:        #000000
surface:   #1C1C1E
card:      #2C2C2E
border:    #38383A
teal:      #00CEC9   <- brand accent
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

- Game vs session average: +5 or better -> green · within 5 -> orange · below -> red
- Series: > 550 -> green · >= 500 -> orange · below -> red
- Overall average: >= 180 -> green · >= 166 -> orange · below -> red

---

## iOS-Native Feel — Non-Negotiable

- Navigation transitions slide horizontally
- Modals sheet up from bottom — never pop from center
- Haptics on: session submit, delete confirm, strike entry, pin tap, filter/toggle tap
- Buttons scale down on press (ScalePressable with withSpring)
- Lists use momentum scrolling with rubber-band effect
- Blur effects on modal overlays via expo-blur

---

## File Structure (current)

```
mBowl/
├── app/
│   ├── _layout.tsx          — root layout, seed logic, DarkTheme, StatusBar
│   ├── index.tsx            — redirect to /(tabs)/log
│   ├── log-frames.tsx       — frame entry screen (chip bar + pin deck)
│   └── (tabs)/
│       ├── _layout.tsx      — 4-tab bottom bar config
│       ├── log.tsx          — Log tab (full session form + submit + draft)
│       ├── stats.tsx        — Stats tab (metrics + charts + leave stats)
│       ├── history.tsx      — History tab (cards + filter + delete)
│       └── reference.tsx    — Reference tab (5 sub-tabs)
├── components/
│   ├── ScalePressable.tsx       — animated press-scale wrapper
│   ├── SettingsContent.tsx      — Settings modal content (dates + ball roster + goals + restore)
│   ├── EditSessionModal.tsx     — session edit sheet (buildSession shared builder)
│   ├── SignalsTab.tsx           — Reference: Signals sub-tab
│   ├── PocketDiagnosticsTab.tsx — Reference: Pocket Diagnostics sub-tab
│   ├── PatternsTab.tsx          — Reference: Patterns sub-tab
│   ├── PinDeck.tsx              — visual pin deck input component
│   ├── haptic-tab.tsx           — tab bar haptic wrapper (active, do not delete)
│   └── ui/
│       ├── icon-symbol.ios.tsx  — SF Symbol routing (active, do not delete)
│       └── icon-symbol.tsx      — TS resolution stub; Metro resolves .ios.tsx at runtime
├── src/
│   ├── storage.ts           — AsyncStorage read/write helpers + KEYS + read states
│   ├── types.ts             — canonical shared types (do not redefine locally)
│   ├── backup.ts            — writeBackup / restoreBackup (mBowl-backup.json)
│   ├── notifications.ts     — SideStore cert reminder (6-day repeating, iOS only)
│   ├── seeds.js             — 18 historical sessions (ids 1001–1018)
│   ├── balls.js             — 9-ball roster
│   └── leaveUtils.js        — leave extraction + named leaves + isSplit (single source of truth)
└── scripts/
    └── gen-assets.js        — icon/splash asset generation
```

`_archive/` also exists (retired boilerplate). It is still inside the TS graph — `tsconfig.json` includes `**/*.tsx` with no `exclude` (audit S15, deferred).

---

## Pin Deck System (added Phase 12)

The Log Frames screen has two input modes, toggled via a Pins/Quick segmented control:
- **Pins mode** (default in Live): visual pin deck — user taps pins left standing, captures `pinsStanding` boolean array
- **Quick mode** (default in Post-Game): chip bar notation (X / — 0-9), no pin data captured

Pin data is optional. `pinsStanding` is `null` for frames entered via chip bar. Scoring always runs on throw notation, never on pin data. Pin data is analytics-only — it powers the Leave Stats section in the Stats tab.

Pin index mapping: indices 0-9 = pins 1-10. Layout:
```
    7  8  9  10      (back row — indices 6, 7, 8, 9)
      4  5  6        (middle row — indices 3, 4, 5)
        2  3         (front-middle — indices 1, 2)
          1          (headpin — index 0)
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
| Historical data | 18 sessions seeded on first launch (ids 1001–1018) |
| Ball picker | Full-screen modal, sorted by strength weakest to strongest |
| Frame entry modes | Live / Post-Game toggle + Pins / Quick toggle |
| Gutter notation | — (dash) |
| Pin tracking | Optional per-frame, analytics-only, does not affect scoring |
| Chart library | react-native-chart-kit |
| Reference sub-tabs | 5: Position, Signals, Pocket Diagnostics, Mental, Patterns |
| Bundle identifier | com.marcus.mbowl |
