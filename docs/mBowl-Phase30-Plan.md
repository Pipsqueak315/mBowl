# mBowl — Next Phase Plan (Phase 30+)
**Written:** Nov 21, 2026 · **Updated:** Nov 23 · **Status:** candidates below not built yet
**Context:** Nov 20 brainstorm. Phase 29 (Path to goal + Spare leak, read-only Stats cards) **shipped Nov 21** (`02db869`, update group e7cd0dff, REV30). Everything below is what's left from that brainstorm.

**Constraints (Marcus, Nov 20):** only Marcus uses it · nothing social · no iCloud · no widgets · nothing that costs money unless it's clearly worth it · everything fits the current workflow (OTA from `master`, free sideload).

---

## Done since this plan was written
- **Phase 30A (Nov 23, update group 814db029):** three more read-only Stats cards Marcus asked for after Phase 29 -- 190 recipe ("Your 180-200 games"), Leave -> fix, Tilt cost. Details in REV31.
- Offered, not picked: **Closing frames** (9th/10th mark % vs frames 1-8) -- close to the Oct cut of open-rate-by-frame; only if Marcus asks.

## Bowling sensors (researched Nov 22 -- Marcus passed: "just another thing to buy")
| Sensor | Price | Fit / export |
|---|---|---|
| F5 (Storm) | $199 incl. 1 yr membership, then $99/yr (required for connected services) | Drilled thumb insert; export not documented |
| Witsee | $319; app free, Premium $89.99/yr | Mounts in a grip hole (no drilling); **CSV export on Premium** -- the only one with an import path |
| BowlSense Pro | $199.99, no subscription | Puck in a thumb slug; shipping in batches; export not documented; "practice feedback, not validated accuracy" |
| Ruby | not listed | Installs in the ball; early |
USBC had no electronic sensors on its approved list (Oct 2026) -- practice-only. If revisited: Witsee CSV import (document picker already in the binary, OTA), or type in per-game numbers (extends item 3 below). Check semi-thumb fit first.

## Before Phase 30: close out v2
- **Part E:** 28.5 restyle of Reference + Settings (needs Marcus's screenshots; ships as its own update)
- Leftover NICE items: N16, N19, N21–N24, N27, D8 (N1, N9, N13, PocketDiagnostics split-leave colors)
- D5 / F14: do the goal fields save when you tap Done with the keyboard up? Fix only if not.

---

## Phase 30 candidates (ranked)

### 1. Miss tags (Level 2: changes saved data)
- **What:** optional one-tap tag on a first ball in Log Frames: Good · Yank · Fast · Missed target. Never required, so entry stays fast.
- **Why:** turns the self-scouted 60/20/20 tilt pattern (acceptable / yank / too fast) into real data. Grip pressure and yanks are the main fault on record.
- **Stats it unlocks:** yank % by game number (fatigue, game 3), yank % in the frame after an open (bounce-back).
- **Data:** a new optional field on each frame. Additive; old frames simply have no tag. Level 2 gates: fresh backup off the phone, audit first, reviewer pass, device checks.
- **Open question:** tag every first ball, or only misses (no tag = good)?

### 2. Line log + "start here" (Level 2: changes saved data)
- **What:** for each game, feet board → target board, plus an optional "switched at frame N" marker. When a ball is picked, show where Marcus last started with it and how that game went.
- **Why:** goes straight at the known weak spot. After a ball change he doesn't know where to start the new ball, so he makes drastic position moves.
- **Flag:** the switch marker touches the spec's "one ball per game" cut. Proposal: keep one ball per game for scoring and stats, and save the switch like a note. **Marcus decides.**

### 3. Ball speed per game (Level 2, small)
- One number per game: the average first-ball speed off the Brunswick overhead at Earl Anthony's. Shows whether "too fast" nights line up with bad scores.

### 4. Ball wear counter (Level 1 counting + one date per ball)
- Games on each ball since its last resurface / oil extraction, counted from history. Needs one optional "last serviced" date per ball (ball roster = additive field).

### 5. Spare drill mode (Level 2)
- In Practice: pick a leave, log make/miss per shot, track 10-pin % over the weeks. Pairs with Spare leak, which shows how much single pins (10 / 7 broken out) cost a game.

### 6. House + lane condition per session (Level 2, small)
- House + fresh / broken down / pattern, so stats can split house shot vs. everywhere else.

### 7. Smaller items
- **Data health row** in Settings: "45 sessions · 140 games · last backup today".
- **Season recap** at rollover: best game/series, most-improved stat, ball usage (read-only).
- **CSV export** (already on the backlog).

---

## Not doing (and why)
| Idea | Why not |
|---|---|
| Scorecard photo scanning | Needs a native module (Mac rebuild); backfill is rare now |
| Opponent records | No W/L by design |
| In-app cert-refresh reminder | Already exists: `src/notifications.ts` schedules a 6-day repeating reminder |
| Open rate by frame / pin heat | Cut Oct 23, stays cut |
| iCloud sync, widgets, social | Marcus's constraints |

## Suggested order
Close out v2 → live with Phase 29 for 2–3 league weeks → Miss tags → Line log → the small ones as filler.
