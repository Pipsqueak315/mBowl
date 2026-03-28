# mBowl

A personal iPhone bowling tracker and coaching app. Built for one bowler — not a generic score tracker.

---

## Screenshots

*Screenshots coming soon*

---

## What It Does

Four tabs, one focused purpose.

**Log** — Enter sessions with full frame-by-frame pin tracking. Live or post-game entry modes. Visual pin deck captures exactly which pins were left standing on every shot. Draft auto-saves so you never lose a session in progress.

**Stats** — Overall average, high game, high series, strike and spare rates, opens per game. Series and game-by-game trend charts. Score distribution histogram. Leave analysis with mini pin diagrams and conversion rates. Per-ball performance breakdown. Current season or all-time toggle.

**History** — Every session in a card list, color-coded against average, filterable by session type. Swipe left to edit or delete. Full edit modal pre-populated with all session fields.

**Reference** — Five sub-tabs of personalized coaching content: position table, switch guide and ball arsenal with lane reads, pocket diagnostics overlaid with your real leave data, mental game framework with shot clock and pre-shot cues, and a lane pattern library with recommended lines.

---

## Key Features

- Pin-by-pin tracking with a visual pin deck — captures leave data for every shot
- Leave diagnostics — frequency counts and conversion rates for every leave type, including splits and combinations
- Ball arsenal management — track your full lineup by strength, assign a ball to every game
- Pocket diagnostics with personal data — your real miss rates and frequencies overlaid on reference cues
- Lane pattern library with entry angles, breakpoints, and suggested lines
- Mental game framework — shot clock, five editable pre-shot cues, release and speed reference card
- Draft auto-save with resume or discard on reopen
- Auto-export JSON backup to Files app on every meaningful data change
- SideStore cert expiry reminder — local notification at day 6 so the app never goes dark

---

## Tech Stack

- React Native via Expo (SDK 54, Expo Router 6)
- TypeScript throughout — zero tsc errors
- AsyncStorage for all persistence
- react-native-reanimated for spring animations
- react-native-chart-kit for trend charts and histogram
- expo-haptics, expo-blur, expo-symbols (SF Symbols)

---

## Design

Apple dark mode only. SF Pro system font — no import, no font flash. Teal `#00CEC9` accent color throughout.

Designed to feel indistinguishable from a first-party iPhone app: horizontal navigation transitions, bottom-sheet modals, spring-animated press feedback, haptics on every meaningful interaction, momentum scrolling with rubber-band effect, blur overlays.

---

## Not on the App Store

This is a personal tool built for one bowler. It's deployed as a standalone IPA sideloaded via SideStore using a free Apple ID. See [REBUILD.md](REBUILD.md) for the exact Mac build and PC sideload process.

---

## Development

Built with [Claude Code](https://claude.ai/claude-code) and Claude.ai across 18 development phases from spec to sideloaded production app.

Full locked spec: [mBowl-SPEC.md](mBowl-SPEC.md)
Build history and architecture notes: [mBowl-SessionBrief-REV16.md](mBowl-SessionBrief-REV16.md)

```bash
npm install
npx expo start
```

Preview on iPhone via Expo Go, or push an OTA update via `eas update --branch preview`.
