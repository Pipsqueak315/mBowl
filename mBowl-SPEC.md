# mBowl — Permanent Spec
**Status:** LOCKED. This document does not change after build starts.  
**If something here needs updating:** That's a v2 decision. Log it in the Session Brief instead.

---

## What This Is

A personal iPhone bowling tracker and reference app. Consolidates three Claude artifacts (Session Logger, Stats Dashboard, March Madness Reference) into one native mobile app with persistent, reliable storage. No copy-paste pipelines. No artifact reload friction. One app, always on the home screen, data that doesn't disappear.

---

## Platform

**React Native via Expo**

- PWA rejected: Safari on iOS silently purges storage when device runs low on space.
- Expo: React-based, AsyncStorage backed by native iOS, Expo Go for live preview, EAS Build for `.ipa`.
- Dev preview: Expo Go on iPhone via QR code.
- Final install: EAS Build → `.ipa` → installed directly. No App Store.

---

## App Scope

Bowling only. 4 tabs. No placeholder slots. No future expansion gaps.

---

## iOS-Native Feel Directive

This app must feel indistinguishable from a first-party iPhone app.

- Navigation transitions slide horizontally — native iOS stack behavior
- Swipe gestures weighted and springy via `react-native-reanimated`
- Buttons scale down slightly on press — tactile feedback
- Lists use momentum scrolling with rubber-band effect
- Modals sheet up from bottom — never pop from center
- Haptics on: session submit, delete confirm, strike entry
- Native iOS activity indicator for loading states
- Blur effects on sticky headers and modal overlays via `expo-blur`
- Back navigation on Log Frames: swipe-right gesture (iOS default) + explicit Cancel button in header

---

## Design System

### Typography
SF Pro — Apple system font. No import, no load time, no font flash.

| Use | Style | Weight |
|---|---|---|
| Screen titles, large numbers | SF Pro Display | Bold / Heavy |
| Section labels | SF Pro Text | Semibold |
| Body, inputs, notes | SF Pro Text | Regular |
| Captions, metadata | SF Pro Text | Regular |

No `fontFamily` declaration needed. SF Pro loads automatically on iOS.

### Colors
```
bg:        #000000   — systemBackground (dark)
surface:   #1C1C1E   — secondarySystemBackground (dark)
card:      #2C2C2E   — tertiarySystemBackground (dark)
border:    #38383A   — separator (dark)
teal:      #00CEC9   — brand accent
white:     #FFFFFF   — label (dark)
dim:       #8E8E93   — secondaryLabel (dark)
dimmer:    #48484A   — tertiaryLabel (dark)
green:     #30D158   — systemGreen (dark)
orange:    #FF9F0A   — systemOrange (dark)
yellow:    #FFD60A   — systemYellow (dark)
bad:       #FF453A   — systemRed (dark)
```

Dark mode only. No light mode in v1.

### Shape + Spacing
- Card border radius: 13px
- Input / button border radius: 10px
- Standard card padding: 16px
- Tab content padding: 16px horizontal

### Icons
SF Symbols via `expo-symbols`. Weight-matched to SF Pro automatically.

### Score Color Thresholds
- Game vs **that session's own average**: +5 or better → green · within 5 → orange · below → red
- Series: > 550 → green · ≥ 500 → orange · below → red
- Overall average: ≥ 180 → green · ≥ 166 → orange · below → red

---

## Navigation Structure

**4 bottom tabs:**

| Tab | Icon (SF Symbol) | Purpose |
|---|---|---|
| Log | `square.and.pencil` | Enter a new session |
| Stats | `chart.bar.fill` | Metrics and trend charts |
| History | `list.bullet` | All sessions, filterable, deletable |
| Reference | `book.fill` | Position, signals, spares, mental |

Active tab: teal. Inactive: dimmed. Respects iPhone safe area insets.

**Settings:** Gear icon (`gearshape.fill`) top-right header — wired per-screen in React Navigation. Slides up as native iOS modal sheet.

---

## Data Architecture

### Session Schema

```javascript
{
  id: number,              // timestamp-based unique ID
  type: "league" | "practice" | "tournament" | "makeup",
  date: "YYYY-MM-DD",
  week: number | null,                    // league/makeup only
  opponent: string | null,                // league only (required) / makeup (optional)
  name: string | null,                    // tournament only
  format: string | null,                  // tournament only
  pattern: string | null,                 // tournament only
  madeCut: "Yes" | "No" | "N/A" | null,  // tournament only
  placement: string | null,               // tournament only
  games: [
    {
      game: number,
      score: number | null,
      ball: string | null,
      frames: [
        {
          throws: string[],          // ["X"], ["7","/"], ["8","—"] etc.
          note: string | null,       // frame-level note
          throwNotes: {              // per-throw notes, keyed by throw index
            "0": string | null,
            "1": string | null,
            "2": string | null,      // 10th frame only
          }
        }
      ] | null,
      notes: string | null
    }
  ],
  notes: string | null
}
```

- No W/L field.
- One ball per game. Mid-game changes go in game notes.
- Gutter notation: `—` (dash).

### Ball Schema

```javascript
{ id: string, name: string, short: string, strength: number, active: boolean }
// strength: 1–5 integer matching Arsenal dots rating
```

### Storage Keys

| Key | Contents |
|---|---|
| `mbowl_sessions_v1` | Full sessions array |
| `mbowl_balls_v1` | Ball roster |
| `mbowl_reference_v1` | Reference tab editable content |
| `mbowl_settings_v1` | Season dates + preferences |
| `mbowl_draft_v1` | In-progress Log tab draft (includes frame data) |

Write strategy: full replace on every save, delete, or edit.

### Historical Seed Data

17 league sessions from 2025–26 season seeded on first launch if storage is empty.

```javascript
[
  { id:1001, type:"league", date:"2025-09-06", week:1,  games:[{score:155},{score:169},{score:156}] },
  { id:1002, type:"league", date:"2025-09-13", week:2,  games:[{score:138},{score:169},{score:181}] },
  { id:1003, type:"league", date:"2025-09-27", week:4,  games:[{score:176},{score:136},{score:166}] },
  { id:1004, type:"league", date:"2025-10-18", week:7,  games:[{score:160},{score:165},{score:148}] },
  { id:1005, type:"league", date:"2025-10-25", week:8,  games:[{score:253},{score:157},{score:181}] },
  { id:1006, type:"league", date:"2025-11-01", week:9,  games:[{score:143},{score:144},{score:143}] },
  { id:1007, type:"league", date:"2025-11-08", week:10, games:[{score:166},{score:161},{score:180}] },
  { id:1008, type:"league", date:"2025-11-15", week:11, games:[{score:168},{score:145},{score:190}] },
  { id:1009, type:"league", date:"2025-11-29", week:13, games:[{score:167},{score:149},{score:162}] },
  { id:1010, type:"league", date:"2025-12-06", week:14, games:[{score:173},{score:205},{score:242}] },
  { id:1011, type:"league", date:"2025-12-20", week:16, games:[{score:141},{score:198},{score:131}] },
  { id:1012, type:"league", date:"2025-12-27", week:17, games:[{score:122},{score:163},{score:183}] },
  { id:1013, type:"league", date:"2026-01-10", week:19, games:[{score:170},{score:157},{score:161}] },
  { id:1014, type:"league", date:"2026-01-17", week:20, games:[{score:163},{score:154},{score:160}] },
  { id:1015, type:"league", date:"2026-01-31", week:22, games:[{score:162},{score:190},{score:200}] },
  { id:1016, type:"league", date:"2026-02-07", week:23, games:[{score:199},{score:156},{score:201}] },
  { id:1017, type:"league", date:"2026-02-28", week:26, games:[{score:130},{score:186},{score:164}] },
]
```

### Season Definition

Settings: Season Start Date + Season End Date.  
Current Season = sessions where date falls within the window.  
Week auto-suggest: every 7 days from season start = new week number.

---

## Tab Specs

---

### TAB 1 — Log

**Default state:** League type · Today's date · Week auto-suggested · 1 game row · all other fields blank.

**Session type selector:** Segmented pill — League · Makeup · Tournament · Practice

**Fields — all types:**
- Date (native iOS date picker)
- Games (add/remove dynamically, min 1, no max)
  - Remove: swipe gesture + "Are you sure?" confirm sheet
  - Per game: Score (numeric keypad, 0–300) · Ball (full-screen picker modal) · Game notes
  - Per game: Log Frames button

**Type-specific fields:**

| Type | Extra Fields |
|---|---|
| League | Week # (auto-suggest, overridable) · Opponent (required) |
| Makeup | Week # (auto-suggest, overridable) · Opponent (optional) |
| Tournament | Name · Format · Pattern · Made Cut · Finish/Place |
| Practice | None |

**Session Notes field** (all types)

**Submit behavior:**
- Validates at least one score or frame set entered
- Writes to `mbowl_sessions_v1`
- Clears `mbowl_draft_v1`
- Clears form
- Navigates to Stats tab
- Haptic on submit

**Draft persistence:**
- Auto-saves every field change including frame data to `mbowl_draft_v1`
- On open with existing draft: bottom sheet → Resume or Discard
- On submit: draft cleared

#### Ball Picker Modal
Full-screen modal, slides up on ball field tap.
- Lists all active balls, sorted by strength (weakest → strongest)
- Each row: strength dots + ball name
- Tap to select, modal dismisses
- "Manage Balls" shortcut at bottom → Settings

#### Log Frames Screen

Pushed from Log Frames button (slides right). Used for both Live and Post-Game entry.

**Layout:**
- **Top strip:** All 10 frames visible, compact. Current frame highlighted in teal. Scrollable.
- **Active frame card:** Large center display showing current frame's throw slots.
- **Throw chip bar:** Fixed at bottom, replaces system keyboard. Chips: X · / · — · 1 · 2 · 3 · 4 · 5 · 6 · 7 · 8 · 9 · 0
- **Progress indicator:** Between strip and active card.

**Live / Post-Game toggle** at top controls note visibility.

| Mode | Behavior |
|---|---|
| Live | Per-throw note fields available, collapsed by default. Chevron below throw chip expands note input. |
| Post-Game | Per-throw notes hidden. Fast, clean entry only. |

**Frame logic:**
- Running score calculated in real time
- 10th frame: 3-throw logic handled (all cases including spare fill, strike fill)
- Haptic on strike entry

**Per-frame notes (both modes):** Tap-to-expand field at bottom of each frame card.

**On complete:** Score auto-fills the game row. Screen pops back.  
**On cancel:** "Are you sure?" native iOS confirm sheet. No data saved.

---

### TAB 2 — Stats

Default landing after session submit.

**Season toggle:** Current Season · All-Time (default: Current Season)

**Layout:**
1. Overall Average — hero number, full width, color-coded
2. High Game + High Series — two cards side by side
3. Strike % + Spare % + Opens/Game — three cards side by side
4. Series Trend — full-width line chart
5. Game-by-Game Trend — full-width line chart

**Strike/Spare/Opens when no frame data exists:**  
Apple-style N/A state — cards display with a lock/info icon and a single line: "Log frames to unlock." Clean, simple, never hidden.

**Empty state:** Centered message + prompt to log first session.

---

### TAB 3 — History

Default sort: most recent first, always.

**Filter bar:** Scrollable pills — All · League · Makeup · Practice · Tournament

**Session card (collapsed):**
- Date · Type badge · Scores inline (color-coded vs that session's own average) · Series total
- Practice: scores only, no series total

**Expanded card:**
- Ball per game
- Per-game notes
- **Full frame grid** if logged — all 10 frames displayed in a compact scorecard layout with throw chips shown
- Key stats row under the frame grid: strikes · spare % · opens
- Tournament: name · made cut badge · placement
- Made Cut badge: green "Made Cut" · red "Missed Cut" · gray "N/A"

**Delete:** Swipe left → red Delete button → "Are you sure?" haptic confirm → removed.

**Edit:** Not in v1. Post-ship.

**Empty state per filter:** "No [type] sessions yet" centered with icon.

---

### TAB 4 — Reference

Horizontal sub-tab bar, 4 tabs.

All editable content stored in `mbowl_reference_v1`. Tap any field to edit, saves on blur.

---

#### Sub-tab 1 — Position

| Scenario | Feet | Eyes | Notes |
|---|---|---|---|
| Default Stance | Board 20 | Board 12 | Baseline — all adjustments relative to this |
| Fresh / Clean | Board 20 | Board 12 | Hold position, let the ball work |
| Lane Hooking Early | Right 1–3 | Board 12–13 | Move feet with ball to reduce angle |
| Lane Playing Flat | Left 1–3 | Board 11–12 | Open angle, eyes track with feet |
| Mid-Transition | Board 17–19 | Board 11 | Lane opening outside, ball reads sooner |
| Heavy / Dry | Board 15–17 | Board 10–11 | Eyes come in with feet |

All rows editable inline.

---

#### Sub-tab 2 — Signals

Toggle at top: **Switch Guide** · **Ball Arsenal**

**Ball Arsenal** (sorted weakest → strongest, editable inline):

| Ball | Strength | Motion Profile | When To Use |
|---|---|---|---|
| Spare Ball | ● ○ ○ ○ ○ | Dead straight. No read, no hook. | Single pins only. Never on strikes. |
| Phaze 2 Pearl | ● ● ○ ○ ○ | Very clean frontend, sharp angular snap on the backend. High RG, stores energy long. | Fresh clean conditions. When you need length and a defined move at the break. |
| Phaze 5 | ● ● ○ ○ ○ | Extremely long and clean through the front. Snappier backend than the Pearl with the polish. Longest ball in the bag. | When the Pearl is reading too early or when you need maximum length before the snap. |
| Physix Blackout #1 | ● ● ● ○ ○ | Arcy, controlled, smooth midlane read. Less angular than the Pearl. Consistent and predictable. | Game 1 on a fresh house shot when you want a controlled arc. Currently benched — revisit when the house shot tightens. |
| Summit | ● ● ● ○ ○ | Hybrid. Earlier midlane read than the Pearl. Smooth but strong, continuous. Less angular, more roll-through. | When the Pearl starts losing shape but you're not in transition yet. Good benchmark ball. |
| Phaze 2 Solid | ● ● ● ○ ○ | More surface than the Pearl. Earlier traction through the heads. Consistent arc into the pocket. | When the Pearl starts skating. Reliable when you need more hook without stepping way up in strength. |
| Physix Blackout #2 (Pin Down) | ● ● ● ● ○ | Pin down layout creates an earlier, smoother, more controlled roll. Strong but not aggressive. Built for volume and distance. | Longer oil patterns on fresh conditions. When the pattern has length and you need a ball that rolls through it instead of snapping at it. |
| Primal Rage Evolution | ● ● ● ● ○ | Symmetrical pearl. Very clean frontend, then explosive angular snap at the break. High RG — stores energy, then fires. | Mid-block transition. When the VE Blackout is reading too early and rolling out. Step down in strength, up in length and snap. |
| VE Blackout | ● ● ● ● ● | Strong, angular, high flare asymmetric. Clean through the heads then big midlane-to-backend move. Your weekly workhorse. | Heavy oil and mid-transition on the house shot. The ball you live in for most of league night. When the Solid and Summit give up, this takes over. |

**Switch Guide:**

| # | What You're Seeing | Cause | Switch To | Feet | Direction |
|---|---|---|---|---|---|
| 1 | Ball rolling out before the pins | Too strong for current oil | Pearl or Phaze 5 | Right 1–2 first | 🟢 Down |
| 2 | Ball skidding through, weak entry | Too clean, not enough ball | Solid → Summit → Physix #2 | Left 1–2 simultaneously | 🔴 Up |
| 3 | Ball reading too early, over-hooking | Burned track or dry outside | Pearl or Phaze 5 | Right 1–3, eyes stay at 12 | 🟢 Down |
| 4 | Good shape but leaving corners (7 or 10) | Entry angle — not a ball issue | Stay | Left 1 board only | 🟡 Feet only |
| 5 | Leaving ringing 10 consistently | Too much entry angle | Solid or Summit | Left 1 board | 🔴 Slightly up |
| 6 | Leaving solid 8 consistently | Entry too flush, deflection loss | Pearl | Right 1 board | 🟢 More angle |
| 7 | Score dropping Game 3, losing pocket | Mid-transition, ball not reading friction | Phaze 5 → Solid → VE Blackout | Left 2–3 from current | 🔴 Up |
| 8 | Fresh pair, unfamiliar condition | Unknown — read first | Summit or Physix #1 | Board 20, eyes 12 — adjust after shot 1 | 🟡 Conservative |
| 9 | VE Blackout reads too early, rolling out | Lanes broken down, need more length | Primal Rage Evolution | Right 1–2, let ball breathe longer | 🟢 Down in strength, up in length |
| 10 | On fresh long oil pattern | Need controlled early roll, not angular | Physix #2 Pin Down | Board 20, eyes 12 baseline | 🔴 Strong but controlled |
| 11 | Physix #1 too arcy, not finishing | Need more angle on fresh shot | Pearl or Phaze 5 | Right 1–2, open angle | 🟢 Down, more snap |

---

#### Sub-tab 3 — Spares

Diagnostics only. No shooting reference.

**Filter pills:** All Leaves · High Frequency · Common · Situational

| Leave | Frequency | Why It Happens | Fix | Pattern to Watch |
|---|---|---|---|---|
| Ringing 10 pin | 🔴 High | Entry angle too aggressive. Ball drives through the 6 and deflects past the 10. | Move left 1 board or step down slightly in strength to tighten entry angle. | If it's happening every time you strike, your angle is too sharp. It's a success diagnostic, not a miss. |
| Solid 8 pin | 🔴 High | Hit too flush. Ball deflects straight back through the 5 instead of driving diagonally into the 8. | Move right 1 board or use a ball with more backend to sharpen entry angle. | Consistent solid 8s mean your entry is too flat. Check your ball path, not your spare shooting. |
| Ringing 7 pin | 🔴 High | Hit too high on the headpin. 2-pin kicks the 4, but the 4 misses the 7. | Move right 1–2 boards to hit the headpin slightly lighter and drive pins left. | Pairs with ringing 10 — if you're getting both, your line is too direct. Open up slightly. |
| Big 4 (4-6-7-10) | 🔴 High | High flush hit with zero angle. Ball drives straight through without spreading pins. | Critical read — your ball is going straight in. Revisit your entire line. | If this happens more than once in a session, stop adjusting feet and change the ball. |
| 6-7-10 | 🔴 High | Extreme high hit. 6-pin knocked flat across both corners. | Very light hit — move right 2+ boards to hit fuller on the headpin. | Rare. If you see it twice in a night, you're playing too straight or too far outside. |
| Washout | 🔴 High | Missed the headpin. Ball went high or wide, leaving a non-pocket split with the headpin. | Execution miss — headpin must be hit for a washout to become a spare. | Recurring washouts = inconsistent release or misread on the line. Check your target. |
| Corner pin (7 or 10) | 🟠 Common | Slightly light hit leaving the far corner. Common on good shots — not always a ball issue. | Not necessarily a problem. If consistent, fine-tune entry angle by 1 board. | If you're leaving the same corner 3+ times in a session, it's a pattern. Move 1 board toward that corner. |
| 2-8-10 bucket | 🟠 Common | Light hit on the headpin. 2-pin kicks back to the 8 but doesn't bridge to the 10. | Move left 1–2 boards to hit fuller and drive the 2-pin harder. | Buckets are a light-hit diagnostic. If it's recurring, you're missing your target right. |
| 2-4-5-8 bucket | 🟠 Common | Entry angle too inside. Ball hits the 1-2 pocket with insufficient angle to scatter the cluster. | Open your angle — move left, target deeper, hit the 2-pin more squarely. | Repeat buckets on this side = you're playing too far inside. Open up. |
| 4-6 split | 🟠 Common | Dead flush hit, zero entry angle. Ball goes straight through without deflecting pins outward. | Carry issue — check entry angle first, then consider a sharper backend ball. | If this shows up early in a set, your line is too direct. You need angle, not more speed. |
| 5-7 split | 🟠 Common | Light left hit. Headpin deflects right, 5-pin goes left and misses the 7. | Move right slightly to hit fuller and drive the headpin left into the 7. | Consistent 5-7s = missing left. Your target is drifting. |
| Baby split (2-7 or 3-10) | 🟠 Common | Slightly light or slightly wide hit. One pin deflects the wrong direction. | Adjust 1 board toward the missed side. Execution more than ball. | If you're getting the same baby split repeatedly, your ball is missing the same direction every time. |
| 4-7-9 cluster | 🟠 Common | Hit too far left of the pocket. Ball deflected left side pins but left a cluster. | Move right to hit more toward the pocket center. | Consistent 4-7-9 = you're pulling the ball or your feet are too far left. |
| Sleeper pocket (2-8 or 3-9) | 🟡 Situational | Hit the pocket but the 5-pin didn't fall. Light hit or deflection loss. | Increase entry angle or step up in ball strength to drive through the 5-pin harder. | If it shows up in Game 3, your ball is losing energy. Time to switch. |

---

#### Sub-tab 4 — Mental

**Shot Clock — 4-frame read framework (static display):**

| Frame | Role | Action |
|---|---|---|
| Frame 1 | Gather only | No decisions. Watch exit board, entry angle, pin action. |
| Frame 2 | Confirm | Does it match Frame 1? Mixed signals — stay patient. |
| Frame 3 | Pull the trigger | Same read twice = switch and commit. Mixed = feet only. |
| Frame 4+ | Locked in | Done deliberating. Ball changes after Frame 4 are tilt-driven. |

**5 Mental Cues (editable inline):**

1. **The loop starts with self-criticism** — Minor error → grief → tilt → scoreboard → more errors. The intervention happens at the grief step. Catch it early.
2. **After a bad shot** — Take a breath. Name one thing you'll do differently. Step up. That's the whole routine.
3. **Check yourself** — Ask: "Am I bowling this shot or the last one?" Still on the last one? Reset. On this one? Go.
4. **You're never out of it** — Don't check the scoreboard. Don't do the math. Bowl the shot in front of you. Strings happen fast.
5. **Mental fatigue is real** — Fatigue shows up as overthinking. Simpler is better late in a set. Ball, line, shot.

---

## Settings Screen

Native iOS modal sheet from gear icon on any tab.

- **Season Start Date** — native iOS date picker
- **Season End Date** — native iOS date picker
- **Ball Roster** — add, rename, toggle active/inactive. Inactive balls hidden from picker, preserved in history.

"Manage Balls" also accessible via shortcut at bottom of ball picker modal.

---

## Dependencies

| Package | Purpose |
|---|---|
| `@react-native-async-storage/async-storage` | Persistent storage |
| `react-native-reanimated` | Native animations |
| `expo-haptics` | Haptic feedback |
| `expo-blur` | Modal blur effects |
| `expo-symbols` | SF Symbols |
| `react-navigation` + `@react-navigation/bottom-tabs` | Tab navigation |
| `@react-navigation/native-stack` | Log Frames push screen |
| Chart library | Decided Phase 7: react-native-chart-kit or Victory Native |

---

## What Got Cut and Why

| Cut | Reason |
|---|---|
| W/L result field | Not tracked |
| Average by session type | Not needed |
| Per-frame ball tracking | One ball per game, changes go in notes |
| Spare shooting reference | Replaced by diagnostics |
| Checklist tab | Not useful enough |
| Game Plan section | Incomplete content |
| JSON copy-paste pipeline | Replaced by AsyncStorage |
| PWA | iOS Safari storage purge risk |
| Barlow / Google Fonts | Replaced by SF Pro |
| March Madness bracket rounds | Tournament-specific |
| Session edit (v1) | Post-ship |

---

## Full Decision Log

| Decision | Answer |
|---|---|
| App name | mBowl |
| Platform | Expo / React Native |
| Scope | Bowling only, 4 tabs |
| Default session type | League |
| Games on open | 1, add more manually |
| Game row removal | Swipe + confirm sheet. No max cap. |
| Score input keyboard | Numeric, 0–300 |
| Gutter chip label | — (dash) |
| Frame entry modes | Live / Post-Game toggle at top |
| Frame entry layout | Full strip top + active frame card + fixed chip bar at bottom |
| Per-throw notes | Live mode only, collapsed by default |
| Ball per frame | No — one ball per game |
| Ball picker style | Full-screen modal, sorted by strength |
| Week number | Every 7 days from season start = new week |
| After submit | Clear form, navigate to Stats |
| Draft persistence | Auto-save including frame data, resume/discard on reopen |
| Stats layout | Hero avg → High game/series → Strike/Spare/Opens → Charts |
| Strike/Spare/Opens — no frame data | Apple-style N/A state with "Log frames to unlock" label |
| Stats timeframe | Current Season / All-Time toggle |
| Season definition | Start + end date in Settings |
| History default sort | Most recent first |
| Practice series in History | Never — scores only |
| History score color-coding | vs that session's own average |
| History expanded frame view | Full frame grid + key stats row |
| History made cut display | Colored badge — green / red / gray |
| History delete | Swipe left → red button → confirm → haptic |
| Makeup opponent field | Optional |
| Reference nav | Horizontal sub-tabs, 4 tabs |
| Reference sections | Position · Signals · Spares · Mental |
| Spares content | Diagnostics only, 14 leaves, filtered by frequency |
| Signals views | Switch Guide + Ball Arsenal toggle |
| Ball Arsenal sort order | Weakest → strongest |
| Reference editing | Inline tap-to-edit, saves on blur |
| Ball roster management | Settings + shortcut from picker |
| Settings access | Gear icon top-right, any tab |
| Design | Apple dark mode, SF Pro, SF Symbols |
| Accent color | Teal #00CEC9 |
| App icon | Deferred to Phase 12 |
| Historical data | 17 sessions seeded on first launch |
| Adding new ball to Arsenal | Get motion profile from Claude → paste into editable field in app |

---

# Appendix — Reality Deltas (post-lock)

**Added:** July 14, 2026 (REV18 doc reconciliation) · **Status:** append-only record

> This spec is a **locked document**. Nothing above this line has been rewritten, and nothing above it should be.
>
> This appendix records where **shipped reality diverges from the locked text**. Where the two disagree, **shipped reality wins and this appendix is the tiebreaker** — the text above is preserved as the original intent, not as a description of the current app. Anything not listed here still stands as written.
>
> Current state of the build lives in `mBowl-SessionBrief-REV18.md`.

| # | Spec says | Shipped reality | Where |
|---|---|---|---|
| 1 | "Reference nav: Horizontal sub-tabs, **4 tabs**" · "Reference sections: Position · Signals · **Spares** · Mental" (:511–512) | **5 sub-tabs.** Spares was renamed **Pocket Diagnostics**, and **Patterns** was added: Position · Signals · Pocket Diagnostics · Mental · Patterns | Phases 9, 10A–10C |
| 2 | "**Edit:** Not in v1. Post-ship." (:324) | **Both edit paths ship.** Session edit (swipe left → Edit → `EditSessionModal`) landed in Phase 15A; frame edit (Edit Frames → `log-frames` round trip) landed in Phase 19 | Phases 15A, 19 |
| 3 | "Stats layout: Hero avg → High game/series → Strike/Spare/Opens → Charts" (:500) — 5 blocks | **Stats carries more.** Also: Leave Stats (Common Leaves + All Tracked Leaves), Score Distribution histogram, By Ball, By Game Number, and **Makeable Spare %** | Phases 13, 15B, 19, 20 |
| 4 | "Historical data: **17** sessions seeded on first launch" (:522) | **18** sessions, ids **1001–1018**. Verified by count, not by comment — `seeds.js`'s own header also said 17 and has been corrected | Phase 2 (drift caught in Phase 20) |
| 5 | "App icon: **Deferred to Phase 12**" (:521) | **Shipped** (`6d55680`) | post-Phase 19 |

### Notes on #1 and #3

The "Spares → Pocket Diagnostics" rename and the Patterns sub-tab were agreed in a Mar 11 spec-update session; the locked table at the foot of this spec was never updated to match. The Stats blocks accreted across four phases, each individually agreed.

### Note on #4 — why the seed count matters

Nothing depends on the number being 17 vs 18. It is recorded because **three separate documents asserted 17** (this spec, `CLAUDE.md`, and `seeds.js`'s own header comment) and all three were wrong — the discrepancy only surfaced when a Phase 20 verification harness asserted 17 and failed against the real data. A fact repeated in three places is not a verified fact.

### Bowling ruling — 2-8-10 and 4-7-9 are SPLITS (Phase 20)

Not a spec conflict, but a **bowling decision** recorded here so it is not relitigated:

- **2-8-10 and 4-7-9 classify as splits.** Each strands a pin the others cannot reach.
- The **"bucket" / "cluster" labels in this spec are naming conventions, not makeability calls.** A leave having a friendly name does not make it a single-ball convert.
- **No `NEVER_SPLIT` override exists, and none should be added.**
- Rationale: classifying them makeable would pad the Makeable Spare % denominator with genuinely hard converts, making the metric lie about spare-shooting ability — the only thing it exists to measure.
- `leaveUtils.isSplit()` is the **single source of truth**, derived at read time from `pinsStanding` and never persisted.
