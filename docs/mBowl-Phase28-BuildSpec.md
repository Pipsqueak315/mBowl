# mBowl — Phase 28 Build Spec (v2 redesign)
**Locked:** November 10, 2026 · **Owner:** Marcus · **Builds on:** `phase27` (Expo SDK 58, native tabs, v2.0.0)
**Read with:** `docs/mBowl-DuoPlan.md` → "Design spec" (the look) and REV24 → SPRINT (the schedule).

This turns the design spec into work packages so Thursday–Friday is execution only. **Every decision is made.** If something below turns out to be impossible on SDK 58, fall back as written and note it in REV24 — don't stop to re-decide.

---

## Decisions (all locked)

| # | Decision | Answer | When |
|---|---|---|---|
| D1 | Scope for Sat Nov 14 | **Cover screen + open screen**: v2 look on Log Frames, Log, Stats, History (cover portrait + landscape), the open-screen page pairs, and the Live game button. Reference + Settings restyle and Restore-from-file ship the week after. | Nov 10 |
| D2 | Big-number font | **SF Pro** (system), weight 200. Not Rounded. | Nov 10 |
| D3 | Season picker | **Dropdown menu** ("Winners 26 ⌄") on Stats and History. Type filter = native-style **segmented control** (All / League / Tourney / Practice / Makeup). | Nov 10 |
| D4 | Log Frames default input | **Unchanged:** Pins in Live, Quick in Post-game. | Nov 10 |
| D5 | Live game button | Shows when a draft has an unscored game. Label **"Game N"** (the first game without a score). Tap opens Log Frames for that game. **No mid-game resume** — in-progress frames aren't saved today, and adding that is a stored-data change (Level 2) for after league. | Nov 10 (Claude, from the code: frames only persist on Done) |
| D6 | Native vs JS controls | Use `@expo/ui` (in the v2 build, M6) for `ArrangementView` (page pairs). The segmented control and season menu are **JS components** (`components/v2/`) styled to match iOS — they work on both builds and don't depend on `@expo/ui`'s API. Swapping in native versions later is a one-file change each. | Nov 10 |
| D7 | Orientation | iOS 27 may ignore the portrait request, so **every screen must work in landscape** (cover landscape gets its own arrangements below). | Nov 10 (Expo SDK 58 guide) |
| D8 | Risk level | **Level 1 throughout.** Presentation only: no change to scoring, stats math, storage keys, or saved data. Any change that would touch those stops and gets flagged. | Nov 10 |

---

## Layout classes (`src/v2/layout.ts`, WP0)

One hook, `useLayoutClass()`, decides the arrangement from the **usable** window (window minus left/right safe-area insets, so the Duo's 84pt rail is excluded):

| Class | When | Duo state | What renders |
|---|---|---|---|
| `compact` | usable width < 520 | Cover portrait (≈382 wide), any normal iPhone | One page, portrait layout |
| `compactWide` | usable width ≥ 520 **and** height < 520 | Cover landscape (≈594×466) | One page, landscape arrangement |
| `splitSideBySide` | usable width ≥ 820 | Open landscape (≈951 wide) | Two pages left \| right, split at the fold |
| `splitStacked` | usable width 520–819 **and** height ≥ 820 | Open portrait (≈669×951) | Two pages top / bottom |

Thresholds live in one constant so they can be tuned in one line after checking on the Duo.

---

## Work packages — build in this order

Each WP: build → `npm run check` → push → CI green → Marcus does the 2-minute check on the Duo → ship over the air (`ota.yml`, master only, reaches 2.0.0 only). **Cut line:** if Friday 8pm arrives, whatever isn't checked doesn't ship; WP6–WP7 are the first to slip.

### WP0 — Foundations (built Nov 10 on branch `phase28`; no screen changes)
- `src/v2/theme.ts`: color tokens (from CLAUDE.md), type scale (title 32/600, section 20/600, hero 200, value 300 + `tabular-nums`, label 15/400 secondary), spacing, radii, divider style.
- `src/v2/layout.ts`: `useLayoutClass()` + thresholds (table above).
- `components/v2/SegmentedControl.tsx`: iOS-style segmented control (dark track `#1C1C1E`, selected segment `#2C2C2E` raised, label 13/500), haptic on change.
- `components/v2/SeasonMenu.tsx`: "Season ⌄" button (teal) → native action sheet (`ActionSheetIOS`) listing seasons + All-Time.
- **Done when:** CI green; nothing on screen changes.

### WP1 — Pins + scorecard visuals (tiny, do first)
- `components/FrameGrid.tsx`: `STANDING_PIN` teal → white; scorecard = box-score grid with hairline dividers; current frame column gets a subtle teal tint (`rgba(0,206,201,0.12)`).
- `components/PinDeck.tsx`: standing pins solid white with black numbers; knocked-down pins = faint ring (`#38383A` border, transparent fill); unavailable pins dimmer still.
- **Check:** pin deck reads clearly in sunlight-ish brightness; strike/spare buttons unchanged.

### WP2 — Log Frames (league-critical)
Scoring logic, `handleDone`, the leave guard (`usePreventRemove`), and the `KEYS.FRAME_RESULT` hand-off are **not touched** — only layout and styling.
- **Header (native):** ✕ leading (on the cover screen iOS moves it into the rail), title "Game N", **Done** trailing as the filled teal capsule (shown only when the game is complete — as today).
- **Cover portrait (`compact`):** one row with two segmented controls (Live / Post-game, Pins / Quick) → scorecard (full width) → running total + MAX line → pin deck centered (Pins mode) → **7-column keypad** along the bottom in Quick mode: row 1 `X / — ⌫ 1 2 3`, row 2 `4 5 6 7 8 9 0`. Unavailable keys dim (same availability logic as the chip bar today). Delete-last-throw = the ⌫ key. Frame note + throw notes stay, behind the existing note affordances.
- **Cover landscape (`compactWide`):** toolbar row with both segmented controls; scorecard across; below it, pin deck card on the left (~250pt) and a **4-column keypad** filling the right: `X / — ⌫` · `1 2 3 4` · `5 6 7 8` · `9 0 [Next frame ×2]`. (Render: `NativeBars-v3_*` / `Closed_6-Landscape_LogFrames.png`.)
- **Open portrait (`splitStacked`):** Log Frames takes the **whole screen**: scorecard + pin deck in the top half, a large keypad in the bottom half. Done returns to Log over Stats.
- **Open landscape (`splitSideBySide`):** Log Frames \| Stats (WP6 handles the pairing; Log Frames itself just uses its `compact` layout in its half).
- Keep the 26.5 compact rules (pins never below 44pt).
- **Check:** log one full practice game in Pins and one in Quick (including a 10th-frame strike-strike-strike and a spare fill), Done saves the right score, swipe-back asks only when changed, landscape works; then delete the practice session.

### WP3 — Log tab
- **Cover portrait:** large title "New session"; grouped form rows (Type, Date, Week, Opponent — tournament fields when Tournament) using today's inputs; "Games" section header with **Add game** (teal text) on the right; each game is one row: score (300, white; "—" grey if none) · "Game N · Ball" · status line ("Frames logged" / "No frames yet"), chevron → Log Frames; Notes row; **Submit session** full-width teal capsule.
- **Cover landscape:** details form left (~230pt) · Games right · Notes + Submit across the bottom.
- **Open-portrait half (~320pt tall):** 44pt game rows; Add game moves into the header.
- Draft save/restore, validation, submit → Stats behavior **unchanged**.
- **Check:** create a draft, add 3 games, open/close Log Frames, kill and reopen the app (draft survives), submit lands on Stats; delete the test session.

### WP4 — Stats
Metrics, `CELL_BANDS`, `filterSessions`, comparison logic **unchanged** — layout and type only.
- Large title "Stats"; header row: **SeasonMenu** (default = current season) + **SegmentedControl** for type.
- **Hero:** "Average" label → big number (weight 200, **white**) → delta line ("↑ 1.4 vs target", green/red) → "N games · N sessions". High game and High series as divider rows (value weight 300).
- **Striking** and **Spares & recovery**: section headers (20/600); four metrics each as a 4-up row on black (value colored by its band when ≥10 frame games, else white; label below in secondary).
- **Series** / **Game by game** charts: thin teal line + soft area fill, latest value labeled, minimal axis labels. **Score distribution:** tallest bar teal, others grey.
- By ball, By game number, Leaves, Season comparison: type on black with hairline dividers (no cards); keep content.
- **Cover landscape:** hero column left (~196pt), Striking + Spares right; charts below on scroll.
- **Check:** numbers identical to before the redesign (compare against today's screenshots); season menu + type filter both work; colors appear once ≥10 frame games.

### WP5 — History
- Large title "History"; **SeasonMenu** + **SegmentedControl** (same as Stats; same `filterSessions`).
- Rows stay boxed (they're tappable): date + type + season label; game scores in **secondary grey**; series in **white with a small colored dot** (series band: >550 green, ≥500 orange, else red); expanded detail, edit, share, swipe-to-delete **unchanged**.
- Landscape: same list, full width.
- **Check:** expand/collapse, edit a session and cancel, share card still renders, swipe-delete confirm (cancel it).

### WP6 — Open-screen page pairs
- Refactor each tab screen into a **page component** + a thin screen wrapper: `LogPage`, `StatsPage`, `HistoryPage` (and Log Frames' body). Screens render one page when `compact`/`compactWide`, two when `split*`.
- Pairs: Log tab → **Log \| Stats** · Stats tab or History tab → **Stats \| History** · Log Frames → **Log Frames \| Stats** (open portrait: Log Frames full screen) · Reference → one full-width page.
- Use `@expo/ui` `ArrangementView` for the two-pane split (it splits along the fold and avoids it when half-open). **Fallback if unavailable:** a row with a 40pt gap at the fold (x 455–495) / a column for stacked.
- Each page manages its own scroll and data loading; both refresh on focus as today.
- **Check:** open the Duo on each tab; fold/unfold mid-draft and mid-Log-Frames (state survives — plan 28.6); rotate the inner screen.

### WP7 — Live game button
- `components/v2/LiveGameButton.tsx`: reads the draft (read-only); visible when the draft has a game without a score; label "Game N" with a live dot; tap → `router.push('/log-frames', { gameIndex, priorScores, initialFrames })` exactly as the Log tab does today.
- Placement: NativeTabs bottom accessory if SDK 58 exposes one; **fallback:** floating capsule just above the tab bar (cover: bottom of the content area on the rail side). On the open screen, tapping it swaps the non-Stats half for Log Frames.
- **Check:** start a draft, leave to History, tap Live → Log Frames for the right game; finish → back with the score in the draft.

### After league (not Saturday)
- 28.5 Reference + Settings v2 restyle (max text width on the open screen).
- "Restore from file…" button using `expo-document-picker` (already in the v2 build) — Level 2: audit + backup gates.
- Mid-game resume for Log Frames (D5) — Level 2.
- `PocketDiagnosticsTab` split-leave color alignment (reviewer info item).

---

## Friday 8pm go/no-go (unchanged)
Duo bowls Saturday only if: (1) counts match the backup (40 / 125 / 174.1 + anything logged since), (2) a full practice game logs end to end on the cover screen in Pins mode, (3) Export Backup works. Otherwise: old phone.
