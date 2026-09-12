# Phase 24 — Multi-Season Support, Season Comparison, Color Thresholds

Paste into Claude Code at session start.

---

## Session header

```
Phase 24 — multi-season support, season-over-season comparison, and color-threshold calibration.

Read CLAUDE.md, mBowl-SPEC.md, and the current session brief before writing any code.

Windows/PowerShell rules apply: no && chaining, file writes via JS + node,
multi-line commit messages via git commit -F <file>.

Do not start coding. Read first, then confirm the OTA classification and the
Part 0 → Part 6 ordering back to me before touching anything.
```

---

## Context

The app currently models "season" as a single window in `mbowl_settings_v1`
(`seasonStart` / `seasonEnd`), with a binary Current Season / All-Time toggle on
Stats. There are three real seasons of data and no way to address them
individually. This phase makes seasons first-class.

**Governing principle:** season membership is DERIVED AT READ TIME from
`session.date`. Nothing is written onto sessions. No migration of session data.
No `seasonId` field. Same principle as `isSplit` and `calcAdvancedStats` —
retroactively correct by construction, cannot drift.

**OTA classification:** pure JS/TS. No native modules, no `app.json` changes, no
new storage keys. Ships via `eas update --branch production`.

---

## Ground truth — verified against the live app

Session counts read from the device on 2026-09-12:

| Window | Sessions | Games | Avg |
|---|---|---|---|
| All-Time, all types | 37 | 116 | 173.9 |
| All-Time, league only | 36 | 108 | 173.4 |
| Current window (5/30–9/12), all types | 13 | 44 | 179.2 |
| Current window, league only | 12 | 36 | 179.2 |

Exactly one non-league session exists: an 8-game tournament dated in early
September 2026.

Current settings: `seasonStart` = 2026-05-30, `seasonEnd` = 2026-09-12,
`targetAverage` = 175, `targetSeries` = 630.

---

## The three seasons

```
Bob's Saturday Winners 2025   start 2025-09-06
Bob's Saturday Jubilee 2026   start 2026-05-30
Bob's Saturday Winners 2026   start 2026-09-12
```

**Gapless model.** Only `start` is stored. A season's end is derived as
(next season's start − 1 day). The most recent season is open-ended. This means:

- No session can fall outside a season.
- No end-date field to keep in sync.
- The early-September tournament lands in Jubilee 2026, not in a gap.

**Required reconciliation** — the harness in Part 5 must assert exactly this:

```
Winners 2025   2025-09-06 → 2026-05-29    24 sessions
Jubilee 2026   2026-05-30 → 2026-09-11    13 sessions
Winners 2026   2026-09-12 → open           0 sessions
                                          ── 37 total
```

If the buckets do not sum to 37, or any individual count is off, STOP and report
before proceeding. A boundary is wrong.

---

## Part 0 — Extract `filterSessions` (do this first)

`filterSessions` currently lives inside `stats.tsx`. History has its own separate
filter logic. Part 4 adds a season selector to History, so extract before
building.

- Move `filterSessions` into `src/` as a shared, fully typed module.
- Both `stats.tsx` and `history.tsx` import it. No second implementation.
- No behaviour change in this part. Stats must produce byte-identical output
  before and after.

Rationale: `MiniPinDeck` and `FrameGrid` were duplicated across `log.tsx` and
`history.tsx` and silently diverged (audit S16). Do not create a third instance
of that pattern.

---

## Part 1 — Seasons in settings

Add a `seasons` array to `mbowl_settings_v1`. Additive only.

```ts
type Season = {
  id: string;        // stable, e.g. "winners-2025"
  label: string;     // "Bob's Saturday Winners 2025"
  short: string;     // "Winners 25" — for pills
  start: string;     // "YYYY-MM-DD"
};
```

**Critical constraint:** `mbowl_settings_v1` has NO SHADOW KEY. A bad write is
permanent (see CLAUDE.md). Therefore:

- Migration is READ-TIME ONLY. If `settings.seasons` is absent, synthesize it in
  memory from the three seasons above. Do not persist on read.
- Do NOT delete or overwrite `seasonStart` / `seasonEnd`. Leave both fields in
  place untouched.
- `seasonStart` remains the source of truth for week auto-suggest. Do not rewire
  week derivation in this phase.
- The first persisted write happens only when the user explicitly saves in
  Settings.

Helper functions (read-time, pure):

- `resolveSeasonRanges(seasons)` — sorts by start, derives each end as the next
  start minus one day, leaves the last open-ended.
- `seasonForDate(date, seasons)` — returns the season id containing that date.
- `currentSeason(seasons, today)` — the season whose range contains today.

Settings UI: list the seasons, allow add/edit/delete of start + label. Adding a
new season is how a season rolls over. Deleting requires a confirm sheet.

---

## Part 2 — Season selector on Stats

Replace the binary Season / All segmented control with a season selector.

- Options: each season by `short` label, plus All-Time.
- Default: the season containing today.
- Stacks with the existing type pills via AND logic, unchanged.
- Applied at the SINGLE choke point inside `filterSessions`. Do not re-filter
  downstream — every stats memo already depends on `filtered`.
- NOT persisted. Resets to current season on each visit, matching the existing
  type-pill and leaves-sort behaviour.
- Haptic on tap, matching the existing controls.
- Empty-result safety: a season with no sessions must hit the existing
  `!metrics` empty state, never a wall of N/A cards.

---

## Part 3 — Season comparison view

The actual payoff of the phase. A compact comparison of two seasons.

- Default pairing: current season vs the immediately preceding season.
- Metrics: Average, First Ball, Strike %, Doubles %, Clean %, Spare %,
  Makeable %, Opens/G, Bounce-Back %.
- Each row shows both values plus a delta, color-coded by direction (Opens/G is
  inverted — lower is better).
- Reuses the existing metric functions run over two filtered sets. No new metric
  logic whatsoever.

**Sample-size guard.** Frame-derived metrics have very uneven coverage across
seasons (Winters 2025 has frame data on roughly a third of its games; Jubilee
2026 on nearly all of them). Display the frame-data coverage (`N of M games`) on
the comparison card, and suppress the delta for frame-derived rows when either
side has fewer than 10 games with frame data. Do not show a delta the sample
cannot support.

Placement: below the fold, after the existing cards. Do not disturb the Phase 22
one-screen layout above Score Distribution.

---

## Part 4 — History: season selector + labels

- Add the same season selector to History, using the extracted `filterSessions`
  from Part 0. Stacks with the existing type pills.
- Add a small season label to each session card.
- Same non-persistence and default behaviour as Stats.

---

## Part 5 — Verification harness

Throwaway Node script, not shipped. Runs against the real session data.

**Must assert:**

1. Season bucket counts are exactly 24 / 13 / 0, summing to 37.
2. No session falls outside a season (gapless invariant).
3. Each season's boundary sessions land on the correct side — check the session
   immediately before and after each boundary date.
4. Every metric is NaN-free and crash-free for each season × each type filter,
   including empty sets.
5. All-Time output is unchanged from pre-Phase-24 for every metric.

**Must print, for each season:** every metric value, plus games-with-frame-data
counts, so thresholds in Part 6 can be verified against real output.

**Must also print the exact definitions** of these four, read from the source:

- `Bounce-Back %` — strike after an open, or mark after an open?
- `First Ball Avg` — does it include 10th-frame bonus balls?
- `Clean Games` — denominator is games with frame data, or all games?
- `Spare %` — are splits in the denominator? (Makeable excludes them; confirm
  Spare does not.)

Report these back before Part 6 lands. If any definition differs from what the
thresholds below assume, flag it and do not guess.

---

## Part 6 — Color thresholds

Seven stat cells currently render white with no color branch: First Ball,
Strike, Doubles, Clean, Spare, Opens/G, Bounce-Back. (Note: the session brief
lists only four — Strike, Spare, and Opens/G are also uncolored.)

Use the existing color-branch pattern from Average and Makeable. Same three
colors: `#30D158` green, `#FF9F0A` orange, `#FF453A` red. Weight ceiling 400 for
color-coded values, per the locked type scale.

**Bands** — orange sits at roughly current performance, green at the level that
corresponds to the next average tier:

| Stat | Green | Orange | Red |
|---|---|---|---|
| First Ball Avg | ≥ 8.9 | ≥ 8.5 | < 8.5 |
| Strike % | ≥ 45 | ≥ 40 | < 40 |
| Doubles % | ≥ 45 | ≥ 37 | < 37 |
| Clean % | ≥ 20 | ≥ 10 | < 10 |
| Spare % | ≥ 65 | ≥ 58 | < 58 |
| Makeable % | ≥ 75 | ≥ 65 | < 65 |
| Opens/G | ≤ 1.6 | ≤ 2.2 | > 2.2 |
| Bounce-Back % | ≥ 80 | ≥ 72 | < 72 |

Opens/G is inverted — lower is better.

**Sample-size gates.** Do not color a value the data cannot support:

- Clean Games: no color below 10 games with frame data. It is a count over a
  small denominator and a single clean game swings it double digits.
- All frame-derived cells: no color below 10 games with frame data. Render white,
  same as today.

Same instinct as `makeableSparePct` returning null rather than lying.

**Makeable already has a band.** Report its current thresholds before changing
them — the table above is a proposal, not a confirmed diff.

---

## Part 6b — OPTIONAL, pending approval

Delete this section if not approved.

**High Series is comparing 8-game blocks against 3-game series.** The early-
September tournament produces a series total of 1435, which becomes the app-wide
High Series and blows out the Series Trend y-axis, compressing every league
session into a flat line at the bottom of the chart.

Proposed fix: restrict High Series and the Series Trend chart to 3-game sessions.
Sessions with a different game count are excluded from both, and the High Game
card is unaffected.

Do not implement without explicit approval.

---

## Documentation — do not skip

1. `npx tsc --noEmit` clean.
2. Commit + push.
3. Add a Reality Delta entry to `mBowl-SPEC.md` covering: the multi-season model
   replacing the single season window, the season comparison view, and the color
   thresholds (spec still describes only the three original threshold sets).
4. Bump the session brief to REV22 with a Session Notes row.
5. Update the CLAUDE.md pointer in all three locations.
6. **Upload the new brief to the Claude.ai Knowledge folder.** Knowledge is
   currently on REV20 while the tree is at REV21 — the drift that REV18 already
   had to reconcile once.

---

## Explicitly out of scope

Do not do these in this phase:

- Removing the Practice session type. Touches the Log segmented control, both
  filter rows, and type-specific field branching. Standalone cleanup later.
- Persisting the season selection. Type pills and leaves-sort deliberately do not
  persist; one control behaving differently is an inconsistency, not a feature.
- Writing any season field onto session records.
- Rewiring week auto-suggest away from `seasonStart`.
- Deriving the Average color band from `targetAverage` instead of the hardcoded
  180/166. Worth doing, but it is a separate change.
