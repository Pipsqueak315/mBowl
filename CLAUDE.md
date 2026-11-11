# mBowl — Claude Code Instructions

**Full spec:** `mBowl-SPEC.md` in this project folder. Read it before writing any code.
**Session state:** `mBowl-SessionBrief-REV26.md` — check this for current phase and notes (START HERE + NEXT).
**Audit fix list (Nov 11):** `docs/PHASE28-AUDIT.md` — pre-league batch M2, S17–S20 (in that order), after-league S21–S23 + NICE. "Let's fix all the things needed before this week's league session" = REV26 → NEXT step 1.
**Duo roadmap + design spec:** `docs/mBowl-DuoPlan.md` (v1.8) — Phases 25–28. Read the brief's START HERE section first.
**Phase 28 (v2 redesign):** `docs/mBowl-Phase28-BuildSpec.md` — WP1–WP7 all built and shipped Nov 10 night; v2 tokens + layout/page/live-game helpers in `src/v2/`, shared controls in `components/v2/`, tab pages in `components/pages/`.
**Status (Nov 11, ~08:15):** `master` @ `7d9c0f3` = **2.0.0 / SDK 58**, code `1ab5e24`, everything shipped over the air to the Duo (last OTA run 43054655209): Phase 28 WP1–WP7 + polish rounds, the Log Frames game-over hang fix (`97de587`, SDK 58 `usePreventRemove` → `repeat()`), rotation unlocked (`1ea0f6c`), cover-landscape Log Frames + season-based Week suggestion (`4d4ec3b`, `1ab5e24`). OTAs from `master` reach only 2.0.0 builds (runtime policy `appVersion`); the old phone stays on 1.0.0 as the fallback. Next: the pre-league fix batch → Marcus's device checks → Fri go/no-go — REV26 → **NEXT**. Level 1 (presentation only) before league. Run `npm run check` (CI runs it on every push) before calling anything done.

---

## What This Is

A personal iPhone bowling tracker and reference app built in React Native via Expo. 4 tabs: Log, Stats, History, Reference. iOS-native feel, Apple dark mode only, AsyncStorage for persistence.

---

## Current Phase

**Check mBowl-SessionBrief-REV26.md for current phase before starting any session.**

At the top of each session Marcus will tell you which phase he's on. Read the Spec for full context on that phase before writing any code.

---

## Tech Stack

- **React Native via Expo** (SDK 58 / RN 0.88 / Expo Router 58)
- **AsyncStorage** (`@react-native-async-storage/async-storage`) — only storage solution
- **Expo Router** — file-based routing (NOT bare React Navigation). Since SDK 56, never import `@react-navigation/*`: use `expo-router/react-navigation` (hooks, theme) and `expo-router/js-tabs`.
- **expo-haptics** — haptic feedback
- **expo-blur** — modal overlays
- **expo-symbols** — SF Symbols icons
- **react-native-reanimated** (4.7) — animations
- **react-native-gesture-handler** (3.x) — swipe gestures via `ReanimatedSwipeable` (the legacy `Swipeable` is gone)
- **Phase 27 native add-ons** — `expo-screen-orientation` (unused since Nov 11 — the app rotates; iOS Rotation Lock is the switch), `expo-keep-awake` (Log Frames), `expo-document-picker` + `@expo/ui` (in the binary for later OTA features)
- **react-native-chart-kit** — Stats tab line charts
- **react-native-svg** — required by chart-kit + PinDeck visuals
- **@react-native-community/datetimepicker** — native iOS date pickers
- **SF Pro** — system font, no import needed on iOS

---

## Critical Architecture Notes

This is an **Expo Router** project — NOT bare React Navigation.

- File-based routing. Tabs live in `app/(tabs)/`. Screens are files, not components registered manually.
- `app/_layout.tsx` is the root layout. Seed logic and dark theme forced here.
- `app/(tabs)/_layout.tsx` controls the tab bar: `NativeTabs` from `expo-router/native-tabs` (Phase 27.4) + the Live game bottom accessory (Phase 28 WP7). NativeTabs draw no header, so each tab is a folder with its own Stack (`components/TabStack.tsx`) — pages set header buttons with `navigation.setOptions` as before (skipped when `embedded`).
- **Phase 28 WP6:** `app/(tabs)/{log,stats,history}/index.tsx` are thin route wrappers. The real pages live in `components/pages/` (`LogPage`, `StatsPage`, `HistoryPage`); `components/v2/SplitPages.tsx` shows one page (cover screen) or a pair (open screen) and keeps both mounted so fold/unfold never resets state. Pages size themselves with `usePageWidth()` / `useSideInsets()` (`src/v2/page.tsx`), never the raw window. Every page pads by the side safe-area insets (the Duo's tab rail + clock column).
- **Live game (WP7):** the button only requests (`src/v2/liveGame.ts`); `LogPage` opens Log Frames itself. Never push `/log-frames` for a draft game from anywhere else — the Log page consumes `KEYS.FRAME_RESULT` on focus.
- **Controls feel native (Marcus):** every tappable control ≥ 44pt and never inside a horizontal ScrollView (Nov 10: 28pt pills in nested scroll views were hard to tap). Use `components/v2/SegmentedControl` / `SeasonMenu` / `FilterHeader`. Header buttons: `components/v2/HeaderIconButton` (no margins — iOS 26 draws the glass pill).
- **Duo rail:** only SQUARE backgrounds run under the rail (History's plain list rows, Reference's sub-tab band); rounded cards (the Log form) stay symmetric inside the safe areas; text and controls never sit under it. History is a plain iOS list like Stats (no cards). Swipe rows use `components/v2/SwipeRow`; all motion uses `motion` in `src/v2/theme.ts` / `animateNextLayout()` in `src/v2/motion.ts`. Hidden second pages of a folded pair skip their focus reloads (`usePageVisible()`). On the rail, the Live game button is `components/v2/LiveGameRailButton` (above the tab capsule); with a bottom tab bar it's the native `NativeTabs.BottomAccessory`.
- `app/index.tsx` exists as a redirect to `/(tabs)/log` — required because `unstable_settings` alone doesn't handle root in Expo Go.
- React Navigation is included via Expo Router — do NOT reinstall it separately.
- **SDK 58 vendored-API rule (Nov 11):** Expo Router 58 vendors React Navigation and changed some APIs. Check the vendored source (`expo/expo` branch `sdk-58`, `packages/expo-router/src/react-navigation/...`), not React Navigation's docs. `usePreventRemove`: continue a blocked exit with the callback's `repeat()` (or the returned `disablePrevention()` then navigate) — **never** `navigation.dispatch(data.action)` (loops forever; the Nov 11 game-over hang).
- **Every exit/guard path gets one on-device run before it counts as done.**

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
| `FRAME_RESULT` | `mbowl_frame_result` | Transient log-frames → caller hand-off (see below) |

Write strategy: full replace on every save, delete, or edit.

`REFERENCE` and `SETTINGS` have **no shadow key** — a bad write to either is permanent. This is why `restoreBackup` shape-checks every value before writing anything, and (N7) writes the shadow keys alongside the primaries — `app/_layout.tsx` recovers from the shadows on launch.

**Reading (Phase 20):** `readSessions()` returns a plain array and is for **display-only** callers. Anything that **writes** based on what it read must use `readSessionsResult()` / `readBallsResult()`, which return `{ status, value }` where status is `'missing' | 'ok' | 'invalid' | 'error'`. A bare `[]` cannot distinguish "genuinely empty" from "corrupt" or "read failed" — **never act on `[]` alone.** Only `missing` may be seeded over. See `mBowl-SessionBrief-REV21.md` → Fix Session C.

`FRAME_RESULT` (`mbowl_frame_result`) is the log-frames → caller result hand-off: written on Done, consumed + removed by Log / History on focus. Transient, never backed up. Moved into `KEYS` in Phase 26 (N4).

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
- Seven Stats grid cells: goal-based bands (green = 190-average level) in `CELL_BANDS`, `components/pages/StatsPage.tsx` — table in REV25/REV26. No color below 10 games with frame data.
- Makeable % (aggregate): green >= 80 · orange >= 60 — locked. Split leaves: green >= 40 · orange >= 15 · else grey (never red).

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
│   ├── log-frames.tsx       — frame entry screen (scorecard + pin deck / keypad; Log Frames | Stats on the open screen)
│   └── (tabs)/
│       ├── _layout.tsx      — NativeTabs: 4 native iOS tabs (Phase 27.4) + Live game accessory (WP7)
│       ├── log/             — each tab = its own stack: _layout.tsx (TabStack header) + index.tsx (route)
│       │   └── index.tsx    — route wrapper: LogPage (open screen: Log | Stats)
│       ├── stats/index.tsx  — route wrapper: StatsPage (open screen: Stats | History)
│       ├── history/index.tsx — route wrapper: HistoryPage (open screen: Stats | History)
│       └── reference/index.tsx — Reference tab (5 sub-tabs; still the page itself)
├── components/
│   ├── pages/
│   │   ├── LogPage.tsx          — Log page (session form + games + submit + draft + Live game answer)
│   │   ├── StatsPage.tsx        — Stats page (metrics + CELL_BANDS + charts + leave stats); `embedded` prop
│   │   └── HistoryPage.tsx      — History page (rows + filter + expand/edit/share/delete); `embedded` prop
│   ├── v2/                      — Phase 28 controls: SegmentedControl, SeasonMenu, FilterHeader, Scorecard, Keypad, SplitPages, SwipeRow, LiveGameButton, LiveGameRailButton, HeaderIconButton
│   ├── ScalePressable.tsx       — animated press-scale wrapper
│   ├── SettingsContent.tsx      — Settings modal content (dates + ball roster + goals + restore)
│   ├── EditSessionModal.tsx     — session edit sheet (buildSession shared builder)
│   ├── SignalsTab.tsx           — Reference: Signals sub-tab
│   ├── PocketDiagnosticsTab.tsx — Reference: Pocket Diagnostics sub-tab
│   ├── PatternsTab.tsx          — Reference: Patterns sub-tab
│   ├── PinDeck.tsx              — visual pin deck input component
│   ├── FrameGrid.tsx            — shared mini-scorecard (compact | full)
│   ├── TabStack.tsx             — per-tab native stack + header (title, Settings gear via setOptions)
│   ├── haptic-tab.tsx           — JS tab-bar haptic button: unused since native tabs (haptic now via screenListeners); kept for a JS-tabs fallback
│   └── ui/
│       ├── icon-symbol.ios.tsx  — SF Symbol routing (active, do not delete)
│       └── icon-symbol.tsx      — TS resolution stub; Metro resolves .ios.tsx at runtime
├── src/
│   ├── storage.ts           — AsyncStorage read/write helpers + KEYS + read states
│   ├── seasons.ts           — gapless multi-season model (Phase 24)
│   ├── sessionFilter.ts     — filterSessions, shared by Stats + History (Phase 24)
│   ├── types.ts             — canonical shared types (do not redefine locally)
│   ├── backup.ts            — writeBackup / restoreBackup + exportBackup (mBowl-backup.json)
│   ├── v2/                  — Phase 28: theme.ts (tokens), layout.ts (useLayoutClass), page.tsx (PageContext, usePageWidth, useSideInsets, usePageVisible, useBleed), motion.ts (animateNextLayout), liveGame.ts
│   ├── notifications.ts     — SideStore cert reminder (6-day repeating, iOS only)
│   ├── seeds.js             — 18 historical sessions (ids 1001–1018)
│   ├── balls.js             — 9-ball roster
│   └── leaveUtils.js        — leave extraction + named leaves + isSplit (single source of truth)
├── scripts/
│   ├── gen-assets.js        — icon/splash asset generation
│   ├── phase24-verify.mjs   — Phase 24 season/metric harness (--data <file>, --seeds)
│   ├── checks/              — npm run check + backup-check
│   ├── mac-build.sh         — Mac build helper: setup + open Xcode, then `package` → .ipa → iCloud/GitHub (signing stays in Xcode)
│   └── ship-ota.mjs         — npm run ship:ota — the only hand-run OTA path
├── .claude/                 — hooks, skills (/feature /ship /audit /backup-check), reviewer agent
└── .github/workflows/       — ci.yml (every push) + ota.yml (manual only)
```

`_archive/` was deleted in Phase 23 (S15). Real-data files (`mBowl-backup.json`, `docs/phase24-data.json`) are gitignored — never commit them.

---

## Pin Deck System (added Phase 12)

The Log Frames screen has two input modes, toggled via a Pins/Quick segmented control:
- **Pins mode** (the default in both Live and Post-Game): visual pin deck (white = standing) — user taps pins left standing, captures `pinsStanding` boolean array
- **Quick mode**: keypad notation (X / — 0-9, ⌫ deletes the last throw; Phase 28 `components/v2/Keypad.tsx`), no pin data captured

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
