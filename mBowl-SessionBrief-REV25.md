# mBowl -- Session Brief REV25
**Full spec lives in:** mBowl-SPEC.md -- read it before writing any code.
**Duo roadmap + locked design spec:** `docs/mBowl-DuoPlan.md` (v1.8) -- Phases 25-28. **Phase 28 build spec:** `docs/mBowl-Phase28-BuildSpec.md` (all WPs built -- see its status table).
**Last updated:** November 10, 2026, ~21:05 (Tue night)

---

## START HERE (Nov 10, 2026, ~20:45)

**One-line status:** the Duo has the v2 binary and all the real data. **Phase 28 WP1-WP7 are all built and shipped over the air to the Duo** (`master` @ `44af9ee`, OTA run 42959325753), **plus a polish round** for the Duo's right column + the settings button (`master` @ `75a430e`, OTA run 42963050595). What's left before Saturday is **Marcus checking it on the Duo** (NEXT step 1), fixing whatever he finds, and the Friday go/no-go. League is Sat Nov 14.

**Where things are:**
- **Branches (`github.com/Pipsqueak315/mBowl`):**
  - `master` -- **2.0.0 / SDK 58**. `phase27` merged Nov 10 (`a0496e9`), then `phase28` fast-forwarded in (WP1+WP2 at `21ac7c1`, everything else at `44af9ee`). CI green. OTAs from `master` reach **only 2.0.0 builds (the Duo)** -- runtime policy is `appVersion`, so the old phone (1.0.0) can't receive them.
  - `phase28` -- same as `master` (keep using it for Phase 28 follow-ups, or branch fresh from `master`).
  - `phase26`, `phase26a`, `phase27`, `verify-expo-token` -- merged / done; safe to delete.
- **v2 binary:** `mBowl-2.0.0.ipa`, GitHub Release `v2.0.0` (target `467d73e`). Installed on the Duo Nov 10 night via iloader (needed Developer Mode on the Duo: Settings -> Privacy & Security -> Developer Mode).
- **Phones:**
  - **Duo:** v2.0.0 + every Phase 28 OTA. Real data restored Nov 10 night: Marcus confirmed **40 sessions**; swipe rows work. (`backup-check` on a fresh Export not run yet -- optional now.)
  - **Old phone:** 1.0.0, all the data, untouched. **The fallback for Saturday until the Duo passes go/no-go.**
- **Data:** Oct 10 backup = 40 sessions / 125 games / 174.1 / high game 253 / best 3-game series 620. Seasons: Winners 25 = 24, Jubilee 26 = 13, Winners 26 = 3. Copies: iCloud Drive -> mBowl Backups, `Desktop\mBowl-backups\` on the PC. Missing Winners 2026 weeks (Sep 26, Oct 3, Oct 17 onward) -- backfill later from SyncPassport scorecards.
- **Duo screen findings (Nov 10):** `claude/mBowl-DuoScreenCheck-Nov10.md` in the Claude.ai project -- every finding F1-F6 and its fix.

**Hard rules:**
- OTA only from `master`, only via `ota.yml` (GitHub Actions, manual dispatch) or `npm run ship:ota`, only after CI is green and Marcus says "ship it".
- Phase 28 is **Level 1 (presentation only)**: no change to scoring, stats math, storage keys, or saved data. Anything that would touch those stops and gets flagged.
- Every control must feel native: >= 44pt touch target, never inside a horizontal ScrollView (Marcus, Nov 10 -- see "Tap feel" below).

---

## NEXT -- in order (pick up here in a new chat)

**1. Marcus, on the Duo -- check the Phase 28 OTA (needs one or two cold launches to pick it up: swipe mBowl closed, reopen; if nothing changed, once more).** Screenshot anything off and send it. Cover screen portrait + landscape, and the open screen:
- **Log tab:** title "New session"; League/Makeup/Tourney/Practice segmented control; Date/Week/Opponent in one grouped card (Tournament fields when Tourney); "Games" header with teal "Add game"; game cards ("Game 1", score, ball, "Log frames / No frames yet"); "Notes"; teal capsule "Submit session". Landscape: details left, games right.
- **Log Frames:** ✕ + "Game N" header, teal Done capsule when complete; one row of Live/Post-game + Pins/Quick; full-width scorecard (current frame teal tint, tap to select); compact active row "Frame N · ball k" with the Frame note visible below on the cover screen; Pins: white pins, Strike/Confirm, delete row; Quick: keypad with ⌫; landscape: pins/keypad left, totals right. **Score a full practice game incl. a 10th-frame fill, Done, then delete the practice session.**
- **Stats:** "Winners 26 ⌄" season menu (action sheet) + All/League/Tourney/Practice/Makeup control (first-tap reliable?); big white average, delta, counts; High game | High series rows; Striking / Spares & recovery as 4-up values on black; charts without boxes; tallest distribution bar teal. Landscape: hero left, metrics right.
- **History:** same filter header; "Winners 2026 · 176.x avg" header; rows = date + "League · Week N", grey game scores, white series with colored dot, chevron; expand / edit / share / swipe unchanged. **Polish round 2 (`db5923c`, not shipped yet):** plain list on black with dividers (no cards); press-and-hold = solid dark-grey highlight, no red/blue; swipe = flat blue Edit + red Delete sliding in with the row (Delete runs under the rail); expand animates; tab switches never flash a spinner after the first load.
- **Nothing under the side tab rail or the clock column** on any tab (Reference "Patterns" visible).
- **Polish round (`75a430e`):** settings gear centered in its glass pill on all 4 tabs (white icon); History rows, Log details/game cards and Reference's sub-tab bar run to the screen edge under the rail while text stays inset; Log Frames uses the full width from the scorecard down (bigger scorecard cells, wider buttons); Stats High game / High series beside the average; on the rail the Live game button is a glass capsule just above the tab capsule; tournament "Made cut" is a segmented control. Check: the Live capsule's spot (measured from the cover screen; may need a nudge in landscape / open screen) and swipe actions on the bottom rows (they now slide in from the screen edge, possibly under the tab capsule).
- **Open screen (unfolded):** Log tab = Log | Stats; Stats/History tabs = Stats | History; Log Frames in landscape = Log Frames | Stats, in portrait = full screen. **Fold/unfold mid-game in Log Frames and mid-draft on Log: nothing resets** (plan 28.6).
- **Live game button:** start a draft with an unscored game, go to History -> a "● Game N" accessory on the tab bar (iOS may not show it on the cover screen's side rail -- note what you see). Tap -> Log tab -> Log Frames for that game -> Done -> the score is in the draft.
- If something is badly broken: tell Claude "roll back" -> republish the previous update (`eas update:republish` or revert the commit on `master` + `ota.yml`).

**2. Claude -- fix what the check finds** (each fix: CI green -> Marcus checks -> "ship it" -> `ota.yml`). Known small follow-ups / reviewer notes to verify on the device:
- Accepted (reviewer W2): rotating the cover screen mid-throw resets pins tapped but not yet confirmed in Log Frames (frames + current frame are safe). Fix only if it bites: keep the PinDeck at one tree position in both cover layouts.
- Verify on device (reviewer info): the Live game accessory appearing/disappearing at runtime; the 40pt fold gap lines up with the real fold when the left/right insets differ; Scorecard cells are ~34pt wide on the cover screen (a mis-tap only selects the neighbouring frame).
- Large-title headers (spec WP3-WP5 "large title") use the standard native header for now (safer, untested on the Duo); try `headerLargeTitle` in `components/TabStack.tsx` only if Marcus wants it.
- Log Frames landscape keypad has no "Next frame" key (frames auto-advance) -- confirm Marcus doesn't miss it.
- Settings gear crowding the status cluster on open portrait (F6) -- re-check after the OTA.

**3. Fri 8pm -- Marcus: go/no-go.** Duo bowls Saturday only if: (1) counts match (40 sessions / 125 games / 174.1 + anything new), (2) a full practice game logs end to end in Pins mode on the cover screen (then delete it), (3) Export Backup works. Otherwise bowl on the old phone.

**4. Sat -- league.** If the old phone was used: after league, Export on the old phone -> Restore on the Duo (only if the Duo logged nothing new). Set Target Average 190 / Series 570 on whichever phone is used.

**5. After league:** 28.5 Reference + Settings v2 restyle; "Restore from file…" (Level 2); mid-game resume for Log Frames (Level 2); PocketDiagnostics split-leave color alignment; backfill missing Winners 2026 weeks; retire the old phone after one good league night on v2; delete merged branches.

**Who does what:**

| Who | Can do | Can't do |
|---|---|---|
| **Claude (Claude.ai project session, cloud)** | `add_repo` the GitHub repo (push access) -> clone, branch, commit, push; read CI and dispatch `ota.yml` with `gh api` (**unset `GH_TOKEN` first: `env -u GH_TOKEN gh api ...`** -- the session proxy supplies auth); update project docs; run the `reviewer` agent; read backups. | `npm install` (no package network in cloud sessions) -- so no local `tsc`: **CI is the type check** (~2 min per push). The PC link (device_bash) **cannot reach GitHub** (proxy 403) -- use it only to read the PC's `node_modules` for API types. |
| **Claude Code on the PC** | Everything above plus npm installs, local `tsc`, `npm run ship:ota`. **The PC repo is stale** (last on `phase27` @ `6d54a31`): first `git fetch`, then `git checkout master`, then `git pull` (one PowerShell command at a time). `package.json` hasn't changed since `phase27`, so `node_modules` is still good. | iloader, the Mac, looking at the phone. |
| **The Mac (no Claude Code there)** | `scripts/mac-build.sh` -- only for the next native rebuild. | Anything else. |
| **Marcus only** | iloader installs + 7-day cert refreshes, checking screens on the Duo, "ship it", Friday go/no-go, Xcode signing/Archive clicks. | -- |

---

## DONE log (Nov 10 night, after the Mac build)

- **~21:10-21:35 (Claude, cloud) -- polish round 2, `phase28` @ `db5923c`, CI green, NOT shipped (waiting on "ship it"; then fast-forward `master` + `ota.yml`).** Marcus's 21:05 screenshots: History rows rounded on the left but square under the rail (lopsided); press-and-hold showed red/blue through the row; animations sometimes slow, sometimes quick. Fixes: History = plain iOS list (edge to edge on black, hairline separators, opaque press highlight); Log rounded cards back to symmetric inset-grouped (rule: only SQUARE backgrounds bleed under the rail); new `components/v2/SwipeRow` for History + Log (actions glued to the trailing edge, invisible at rest, 1:1 tracking, Delete runs under the rail); `motion` tokens in `src/v2/theme.ts` + `src/v2/motion.ts` (one critically damped spring, one 240ms layout animation); Stats/History stop blanking to a spinner + rebuilding on every focus (first load only, re-render only on changed data); hidden second pages skip reloads (`usePageVisible`); Log stops re-rendering on every focus.
- **~19:00-19:50 (Marcus, PC + Duo):** downloaded `mBowl-2.0.0.ipa` (14.9 MB in Windows = 15.7 MB on the Mac, same file); iloader -> Duo; turned on Developer Mode; restored the Oct 10 backup; confirmed 40 sessions; 13 screenshots of v2 -> findings F1-F6 (rail + clock column covering content/controls, Log Frames overlaps on the cover screen, half-width frame strip, hard-to-tap pills).
- **~20:00 (Claude, cloud):** reviewer pass `phase27` vs `master` = PASS, no blockers (info: `writeBackup()` swallows write errors, so a failed write would let Export share the previous file). Merged `phase27` -> `master` (`a0496e9`). Rebased `phase28` onto it.
- **Pill tap cause found:** Stats pills were ~28pt tall (iOS min 44) inside horizontal ScrollViews nested in the vertical page -- small finger drift became a scroll and cancelled the tap. Rule now in `components/v2/SegmentedControl.tsx`.
- **20:06 -> OTA #1 (`21ac7c1`, ota.yml run 42957085260):** WP1 + WP2. Marcus's 20:12 screenshots: Log Frames good, frame note cut off on the cover screen, grey panel stopped short of the rail; History/Stats still old (not yet shipped).
- **20:40-21:05 (Claude):** design canvas "mBowl cover screen -- using the right column" (Claude.ai artifact: Marcus's screenshots with measured zones vs proposals -- clock y 75-160, tab capsule y 442-654, both in the right 84pt; ~280pt empty between). Marcus approved all four ideas + a settings-button fix -> polish round `1d4f21b` + `75a430e`, CI green, OTA run 42963050595.
- **20:15-20:40 (Claude):** screenshot fixes; WP3, WP4, WP5 restyles; WP4a/5a filter header + side safe areas; WP6 page pairs (+ fix: primary page never remounts on fold/unfold); WP7 Live game button; independent `reviewer` pass (PASS WITH WARNINGS -- blocker fixed: the second page of a pair now stays mounted (hidden) when folded, so a History edit in progress can never leave a `KEYS.FRAME_RESULT` for the Log draft; plus Done and Log Frames double-tap guards); OTA #2 (`44af9ee`, run 42959325753).

---

## Phase 28 -- what was built (Nov 10 night)

All Level 1 (presentation only). Scoring, `handleDone`, the leave guard, `KEYS.FRAME_RESULT`, stats math, `CELL_BANDS`, `filterSessions`, storage: unchanged.

| WP | What | Files |
|---|---|---|
| WP0 | v2 tokens, `useLayoutClass()`, SegmentedControl, SeasonMenu (built earlier Nov 10) | `src/v2/theme.ts`, `src/v2/layout.ts`, `components/v2/SegmentedControl.tsx`, `components/v2/SeasonMenu.tsx` |
| WP1 | Standing pins solid white + black numbers, knocked = faint ring; FrameGrid `STANDING_PIN` white, both variants connected box-score grids, optional `currentFrame` tint; segments >= 48pt touch | `components/PinDeck.tsx`, `components/FrameGrid.tsx`, `SegmentedControl.tsx` |
| WP2 | Log Frames: ✕ / "Game N" / Done capsule header; one row of two segmented controls; full-width `Scorecard`; middle scrolls (no overlaps); Quick = `Keypad` (7 cols narrow, 4 cols otherwise, ⌫ = delete); cover landscape = input left, info right (`PinDeck side`); short windows show the compact "Frame N · ball k" row so the note fits; every band pads by side insets, panels full-bleed | `app/log-frames.tsx`, `components/v2/Scorecard.tsx`, `components/v2/Keypad.tsx`, `PinDeck.tsx` |
| WP3 | Log: title "New session"; type segmented control; details in one grouped card; "Games" header + "Add game"; sentence case; "Log frames / No frames yet" status; Notes header; Submit capsule; cover landscape = details | games columns. Every input + draft/submit behavior unchanged | `components/pages/LogPage.tsx`, `app/(tabs)/log/_layout.tsx` |
| WP4 | Stats: `FilterHeader` (SeasonMenu + 5-segment type control); hero = "Average" + big white number (weight 200) + delta + counts + High game / High series divider rows; Striking / Spares & recovery = 20/600 headers + 4-up value-over-label cells with hairline dividers (band colors as before); no card boxes; charts on black with soft teal fill; tallest distribution bar teal, others grey; cover landscape = hero column left | `components/pages/StatsPage.tsx`, `components/v2/FilterHeader.tsx` |
| WP5 | History: `FilterHeader`; list header "<season label>  <avg> avg"; rows = date + "Type · Week N" (+ season when All-Time), game scores grey, series white + band dot, chevron; expand/edit/share/swipe unchanged | `components/pages/HistoryPage.tsx` |
| WP6 | Page pairs: tab routes are thin wrappers around page components; `SplitPages` (spec fallback: row/column with a 40pt fold gap -- `ArrangementView` needs iOS 27.1). Log -> Log \| Stats; Stats and History -> Stats \| History; Log Frames landscape -> Log Frames \| Stats, open portrait full screen; Reference single. **The primary page never remounts on fold/unfold** (only the second page is added/removed). Pages get width + side insets from `PageContext` | `components/v2/SplitPages.tsx`, `src/v2/page.tsx`, `app/(tabs)/{log,stats,history}/index.tsx`, `app/log-frames.tsx` |
| WP7 | Live game button in `NativeTabs.BottomAccessory` (iOS 26+), shown while the draft has an unscored game: "● Game N · Tap to score". Tap -> `requestLiveGame()` + navigate to Log -> **LogPage opens Log Frames itself** (same path as tapping the row) once the draft is loaded and any resume prompt is settled -- so the score always lands in the Log page's own game list. Draft writes call `notifyDraftChanged()`. No mid-game resume (D5) | `src/v2/liveGame.ts`, `components/v2/LiveGameButton.tsx`, `app/(tabs)/_layout.tsx`, `LogPage.tsx` |
| Side insets | Log, Stats, History, Reference, Log Frames pad by left/right safe-area insets -> nothing under the Duo's tab rail or clock column (F1/F2) | `useSideInsets()` everywhere |
| Polish (`75a430e`) | **Settings button:** `components/v2/HeaderIconButton` (36pt centered, white SF symbol, no margins -- iOS 26 draws the glass pill; the old `marginRight: 16` pushed the gear off-center). **Edge-to-edge backgrounds:** `useBleed()` (`src/v2/page.tsx`) -- boxed rows/groups stretch to the screen edge on a side with a safe-area inset, content keeps the inset (History rows, Log details + game cards; off in Log's 2-column landscape; Reference sub-tab bar). **Log Frames portrait:** only toggles + running total are inset; scorecard -> input use the full width. **Stats:** High game / High series stacked beside the average (portrait). **Live game on the rail:** `components/v2/LiveGameRailButton` (glass capsule 12pt above the tab capsule, measured: capsule top 236pt above window bottom, 24pt in from the edge); native BottomAccessory only with a bottom tab bar (`RAIL_MIN_INSET` 60 in `app/(tabs)/_layout.tsx`). **Made cut:** segmented control (last old pill control). | `HeaderIconButton.tsx`, `src/v2/page.tsx`, `HistoryPage.tsx`, `LogPage.tsx`, `StatsPage.tsx`, `app/log-frames.tsx`, `LiveGameRailButton.tsx`, `app/(tabs)/_layout.tsx`, `reference/index.tsx` |

**Look rules (Marcus, Nov 10 -- keep the clean aesthetic constant everywhere):** header buttons = `HeaderIconButton` (never a margin of its own); toggles = `SegmentedControl`; only SQUARE backgrounds run under the rail (History's plain list rows, Reference's sub-tab band), text/controls never do; rounded cards (the Log form) stay symmetric, inside the safe areas (Nov 10 night -- a card rounded on one side and square on the other looked lopsided). History matches Stats: type on black, no cards. Swipe rows = `components/v2/SwipeRow`. Motion = `motion` in `src/v2/theme.ts` (one spring, one 240ms layout animation) -- never a one-off duration.

**Tap feel (Marcus, Nov 10 -- standing requirement):** "it should feel smooth like a native iOS app." Every tappable control >= 44pt (segments 32 + 8/8 hitSlop), whole-segment hit area, pressed state, never nested in a horizontal ScrollView. Re-check tap feel on every change. Remaining old-style control: Reference sub-tabs (underline tabs, 44pt tall -- restyle in 28.5).

**Code map changes (for anyone reading old notes):** the four tab screens moved -- `app/(tabs)/<tab>/index.tsx` are now ~20-line route wrappers; the real pages are `components/pages/LogPage.tsx`, `StatsPage.tsx`, `HistoryPage.tsx` (Reference stays in `app/(tabs)/reference/index.tsx`). `CELL_BANDS` now lives in `components/pages/StatsPage.tsx`. `StatsPage` / `HistoryPage` take `embedded` (second page of a pair: no header gear).

---

## Mac rebuild procedure (for the NEXT native build -- known good Nov 10)

Only needed for SDK bumps, new native modules, or `app.json` native changes. JS-only changes go over the air.

**Mac facts (Nov 10):** Xcode 27.2; Node 24.22.2 via Homebrew `node@24` (**don't `brew upgrade node`** -- Homebrew's default `node` is an odd version Expo rejects; stay on `node@24`). CocoaPods 1.16.2 (the "Ignoring ffi-1.17.2" lines are harmless). `gh` signed in with a **classic PAT** (scopes `repo` + `read:org`, expires on the date picked at creation (~Feb 8, 2027 if 90 days) -- when it expires: https://github.com/settings/tokens/new, then `gh auth login` -> GitHub.com -> HTTPS -> Yes -> Paste an authentication token).

1. Terminal -- setup (clones the code, installs, generates the iOS project, opens Xcode, prints the checklist; the Mac's zsh supports `&&`). Change `phase27` to the branch being built:
```
cd ~ && rm -rf mbowl-build && git clone https://github.com/Pipsqueak315/mbowl.git mbowl-build && cd mbowl-build && git checkout phase27 && bash scripts/mac-build.sh
```
2. Xcode -- check the left sidebar shows **mBowl AND Pods** (the workspace; if not: `open ios/mBowl.xcworkspace`). Settings -> Accounts -> Apple ID (first time only); mBowl target -> Signing & Capabilities -> Automatically manage signing, Team "Marcus Castro (Personal Team)", bundle ID `com.marcus.mbowl`; delete Push Notifications if listed; device "Any iOS Device (arm64)"; Product -> Archive (first build 5-15 min).
3. Terminal -- **must be in `~/mbowl-build`** (a new Terminal window starts in `~`, and the script isn't found there):
```
cd ~/mbowl-build && bash scripts/mac-build.sh package
```
- Done = `build/mBowl-<version>.ipa`, copied to iCloud Drive -> mBowl Builds **and** a GitHub Release `v<version>`. The PC downloads it from the Release page (no iCloud on the PC), then iloader -> Import IPA.
- If setup stops, it prints the one fix -- run it and paste the setup again. Errors: paste the last ~20 lines (Xcode: the FIRST red error in the Issue navigator) to Claude.
- If the version is unchanged and the Release already exists, `package` replaces the .ipa on it (`--clobber`).

---

## Phase 26 -- what was built (Nov 10; merged to `master`, ships to the Duo inside the v2 binary)

Verified: `npx tsc --noEmit` clean against the PC's `node_modules`; `npm run check` all green; Phase 24 harness on the real backup all green; independent reviewer pass: PASS WITH WARNINGS, no blockers; four warnings fixed in `513f9a8` (see the last table row). Open info item: `components/PocketDiagnosticsTab.tsx` keeps its own single-band `conversionColor`, so split leaves on the Reference tab still use 80/60 -- align in Phase 28 or with the NICE batch.

| Plan item | What changed | Files |
|---|---|---|
| **24 Part 5** | Reconciliation on the real Oct 10 backup: **24 / 13 / 3 = 40** ✓, boundary sessions (2026-05-30, 2026-09-12) land on the right side ✓, NaN-free across season × type ✓. Harness mirrors 6b; gained `--data <file>` and `--seeds`. | `scripts/phase24-verify.mjs` |
| **24 Part 6** | Seven grid cells colored by `CELL_BANDS` + `bandColor()`. **Goal-based (Marcus: end the season at a 190 average):** green = the level of his own 180-200 games, orange = his current level up to the goal, red = below current. White below 10 games with frame data. Color computed at display precision. | `app/(tabs)/stats.tsx` |
| **24 Part 6b** | High Series + Series Trend count **exactly-3-game sessions only** (`threeGameSeriesTotal`). All-time High Series 1435 -> **620**. High Game unaffected. `—` when no 3-game session. | `stats.tsx` |
| **26.1 N15** | `conversionColor` split: `makeableColor` (aggregate, **locked 80/60**) and `leaveConversionColor(pct, isSplit)` -- non-splits keep 80/60; **splits: green >=40, orange >=15, else grey `#8E8E93` (never red)**. Real data: splits convert 9/44 = 20% overall. | `stats.tsx` |
| **26.0b Export** | Settings -> **Export Backup** (teal, above Restore): `exportBackup()` = `writeBackup()` then the share sheet for `mBowl-backup.json`. S9 guards intact. JSON only. | `src/backup.ts`, `components/SettingsContent.tsx` |
| **26.0c** | `.gitattributes`: `* text=auto eol=lf`, binaries untouched. | `.gitattributes` |
| **26.2 N4** | `FRAME_RESULT_KEY` -> **`KEYS.FRAME_RESULT`**, same string `'mbowl_frame_result'`. Export removed from log-frames. | `src/storage.ts`, `app/log-frames.tsx`, `log.tsx`, `history.tsx` |
| **26.3 swipe-back** | One `usePreventRemove(hasData, …)` guard shows the existing "Discard Frames?" for header Cancel AND iOS swipe-back (native-stack 7.14 `preventNativeDismiss`). `handleDone` sets `savedRef` first so Done is never challenged. **B2 boundary unchanged:** discard never writes `KEYS.FRAME_RESULT`. | `app/log-frames.tsx` |
| **Review fixes** | Discard confirm only when frames changed since the screen opened (History -> Edit Frames with no change backs out silently); `savedRef` set before the result write, failed write alerts; Clean bands on the exact share; Export ignores a double tap ("Exporting…"). | `log-frames.tsx`, `stats.tsx`, `SettingsContent.tsx` |
| **26.5 screen size** | Log Frames reads `useWindowDimensions` live; height < **760pt** (`COMPACT_HEIGHT`) = compact: the two toggles share a row, frame slots 60, final score 60pt, PinDeck spacing tighter (pins stay 44pt). History share card fixed at **390pt** (was `Dimensions.get` at load). Audit found no other `Dimensions.get`; all tabs already scroll. **Not visually verified** -- no simulator in the cloud; check on the Duo cover screen. | `log-frames.tsx`, `components/PinDeck.tsx`, `history.tsx` |

**Part 6 bands (locked Nov 10):**

| Stat | Red below | Orange | Green (190 level) |
|---|---|---|---|
| First Ball | 8.6 | 8.6-8.8 | >= 8.9 |
| Strike % | 39 | 39-47 | >= 48 |
| Doubles % | 36 | 36-41 | >= 42 |
| Clean % | 7 | 7-19 | >= 20 |
| Spare % | 60 | 60-66 | >= 67 |
| Opens/G (lower better) | > 2.2 | 2.2-1.7 | <= 1.6 |
| Bounce-Back % | 75 | 75-79 | >= 80 |

Source: Marcus's 22 games scoring 180-200 in the Oct 10 export averaged FB 8.89, Strike 48.5%, Spare 64.7%, Opens 1.64 (Clean green from P(0 opens) at 1.6/game ~ 20%). Orange floors = his all-time (FB 8.6, Strike 39, Doubles 36, Clean 7, Spare 60, Opens 2.2, BB 75). **Expect normal nights to flicker orange/red -- that's the intended push.** Spare % (59.9 all-time) shows red: it's the biggest lever to 190. Bands live in one constant -- one line per stat to retune.

---

## Phase 26.4 -- NICE triage (decided Nov 10: all of Claude's takes accepted)

N3 shipped in Phase 23; N4 and N15 are done on `phase26`. **Keeps built in `972445d`** (N6 is the REBUILD.md line; used on the Mac trip). N7 turned out to matter more than the audit said: `app/_layout.tsx` *recovers from* the shadow keys on launch when the primary reads back empty, so after a fresh-install restore a stale shadow (the 18 seeds) could have been "recovered" instead of the real data. **Residual resolved (Nov 10):** the Duo restore now runs on the v2 build, which includes N7, so Restore writes the shadow keys too.

| ID | Item | Take | Why |
|---|---|---|---|
| N2 | Null-score expanded History row shows `—` in red | **Keep** | Tiny; a red dash reads as a bad score |
| N6 | `REBUILD.md` prebuild without `--clean` | **Keep** | One line; matters for the Phase 27 native build |
| N7 | Restore doesn't refresh the shadow keys | **Keep** | 2 lines; right after the Duo restore the shadow still holds the 18 seeds (Level 2 -- audit + backup gates) |
| N10 | `reset-project` script points at a deleted file | **Keep** | Delete one line |
| N12 | Unreachable `if (!sessions)` in PocketDiagnostics | **Keep** | Dead code, 1 line |
| N14 | `makeableConverted` returned but unused | **Keep** | Trivial cleanup |
| N1 | Share shows a text label, not a spinner | **Phase 28** | Restyled anyway in the v2 pass |
| N9 | Pin-row layout hard-coded in 4 files | **Phase 28** | Natural to consolidate during the redesign |
| N11 | Orphaned `splash-icon.png` | **Phase 27** | Splash work is batched with 27.5 |
| N13 | SPLIT badge can squeeze a long name | **Phase 28** | Layout work |
| N5 | Redundant `as` cast in stats.tsx | **Cut** | Typing a JS module for little gain |
| N8 | Seeds use `throwNotes: []` not `{}` | **Cut** | Seeds only exist before a restore; harmless |

---

## How To Start a Session

Tell Claude Code at the top of each session: Phase X -- [what you are working on today].
Claude reads CLAUDE.md and mBowl-SPEC.md for full context. This brief tracks current state only.

---

## Critical Project Notes

This is an Expo Router project -- not bare React Navigation.

- File-based routing. Tabs live in app/(tabs)/. Screens are files, not components registered manually.
- app/_layout.tsx is the root layout. Seed logic and dark theme forced here.
- app/(tabs)/_layout.tsx = NativeTabs (Phase 27.4) + the WP7 Live game bottom accessory; each tab is a folder with its own Stack (`_layout.tsx` via `components/TabStack.tsx`) and an `index.tsx` route that is a thin WP6 wrapper around `components/pages/<Tab>Page.tsx` (Reference: the page is still the route file).
- app/index.tsx is a redirect to /(tabs)/log -- required for Expo Go.
- Windows machine: always write files using a JS file via node. Never use python or bash heredoc.
- PowerShell does not support && -- run commands one at a time. Multi-line commit messages: write to a file and use `git commit -F`.
- `app.json` (on `phase27`): `"orientation": "default"` (all orientations, native) + a JS portrait request in `app/_layout.tsx`; `supportsTablet: false`. Version 2.0.0 / buildNumber 2. Changing these is native = Mac rebuild.

### Architecture Patterns

- **Seasons (Phase 24) -- multi-season, gapless, read-time.** `src/seasons.ts` owns the model. `DEFAULT_SEASONS` (winners-2025 / jubilee-2026 / winners-2026) is synthesized in memory when `settings.seasons` is absent -- **never persisted on read** (`mbowl_settings_v1` has no shadow key). Only each season's `start` is stored; `resolveSeasonRanges()` derives each end as (next start − 1 day), last open-ended. `seasonForDate()` / `currentSeason()` map a date / today to a season. Membership is derived from `session.date` at read time -- nothing written onto sessions, no `seasonId`, no migration. `seasonStart`/`seasonEnd` are **left untouched** and still drive **week auto-suggest** (log.tsx) -- do not rewire that.
- **Shared session filter (Phase 24 Part 0):** `src/sessionFilter.ts` exports `filterSessions(sessions, seasonSel, seasons, typeFilter)` + `ALL_TIME` + `TypeFilter`/`SeasonSelection`. **Single implementation used by both Stats and History.** Season selection is non-persistent, reset to the current season on each focus, like the type pills.
- **Season comparison (Phase 24 Part 3):** selected season vs its predecessor via `computeSeasonMetrics()`. Frame-derived deltas suppressed below `MIN_FRAME_GAMES` (10) games with frame data on either side.
- **Stat colors (Phase 24 Part 6):** `CELL_BANDS` + `bandColor()` in `components/pages/StatsPage.tsx` for the seven grid cells; `makeableColor` for aggregate Makeable (locked 80/60); `leaveConversionColor(pct, isSplit)` for per-leave rows. Same `MIN_FRAME_GAMES` gate. `avgColor` (180/166) is the locked overall-average rule -- separate.
- **Series rule (Part 6b):** `threeGameSeriesTotal()` -- High Series and Series Trend use exactly-3-game sessions only.
- **Gear icon:** Each page injects a headerRight gear via useNavigation().setOptions() in useLayoutEffect (skipped when `embedded`). Opens SettingsContent.tsx as a pageSheet modal.
- **v2 / Phase 28:** tokens `src/v2/theme.ts`; arrangement `useLayoutClass()` (`src/v2/layout.ts`: compact / compactWide / splitStacked / splitSideBySide from the usable width); page width + side insets `usePageWidth()` / `useSideInsets()` (`src/v2/page.tsx`, PageContext set by `components/v2/SplitPages.tsx`); shared controls `components/v2/` (SegmentedControl, SeasonMenu, FilterHeader, Scorecard, Keypad, SplitPages, LiveGameButton); Live game plumbing `src/v2/liveGame.ts`.
- **Dark theme:** Forced in app/_layout.tsx. StatusBar light.
- **ScalePressable:** Shared animated press component (withSpring damping 15, stiffness 400).
- **Shared mini-scorecard (Phase 23, restyled Phase 28 WP1):** `components/FrameGrid.tsx`, `variant: 'compact' | 'full'`, both connected box-score grids; optional `currentFrame` tint. Standing-pin color **white** `#FFFFFF` via `STANDING_PIN` (was teal). Log Frames has its own full-width `components/v2/Scorecard.tsx`.
- **Typography scale (Phase 23):** 200 (hero numerals) / 300 (white data) / 400 (threshold-colored ceiling) / 500 (labels) / 600 (emphasis).
- **Storage read states (Phase 20):** `readSessionsResult()` / `readBallsResult()` return `{ status, value }` (`missing|ok|invalid|error`). `[]` alone is never acted on; writers must use the *Result variants. Only `missing` seeds.
- **Split detection (Phase 20):** `isSplit()` in leaveUtils.js, read-time from `pinsStanding`, never persisted. 2-8-10 and 4-7-9 are splits; sleepers (2-8, 3-9) count as adjacent.
- **Throw-notation tokens:** `X` strike, `/` spare, **`—` (em dash, U+2014)** gutter/miss (NOT ASCII `-`), `0`-`9` counts.
- **Advanced stats (Phase 21):** First Ball Avg / Bounce-Back % / Doubles % / Clean Games all read-time via `calcAdvancedStats()`.
- **Backup / export:** `src/backup.ts` `writeBackup()` / `restoreBackup()` / `exportBackup()`. File `mBowl-backup.json` in `Paths.document`, **visible in Files -> On My iPhone -> mBowl** (`UIFileSharingEnabled`). **TRAP:** `writeBackup()` runs on every cold launch -- on a fresh install, restore a copied-in file BEFORE the app is ever relaunched.
- **Live game (WP7):** the button only *requests*; `LogPage` answers (opens Log Frames for the first unscored game) once `ready` and no resume prompt is up. Never push `/log-frames` from outside the Log page for a draft game -- Log consumes `KEYS.FRAME_RESULT` on focus and must own the game list.
- **Log Frames leave guard:** `usePreventRemove(isDirty)` + `savedRef`; one "Discard Frames?" for Cancel and swipe-back. `isDirty` = frames differ from the snapshot taken when the screen opened.
- **Compact layout:** Log Frames `COMPACT_HEIGHT = 760` (short windows: compact frame row, 44pt pins); PinDeck `compact` + `side` (cover landscape) props; Log Frames middle section scrolls rather than overlapping.
- **Shared types:** src/types.ts is canonical. Do not redefine locally.
- **Storage layer:** src/storage.ts. KEYS object exported -- never write a raw key string at a call site (`npm run check` enforces this on `phase26a`).
- **OTA channel:** app.json carries `expo-channel-name: production`, baked into the binary. Both phones get every OTA.

### Automation (Phase 26A, merged to `master` Nov 10)
- `npm run check` -> `scripts/checks/run-all.mjs`: TypeScript + `leaves` / `seasons` / `rules` checks (import the REAL app source via Node 22 type stripping + `ts-resolve.mjs`) + the Phase 24 harness on the seeds.
- `npm run backup-check -- <file>`: read-only report of a backup (real season model).
- `npm run ship:ota`: refuses unless on `master`, clean, in sync with origin, and every check passes; then `eas update --branch production`.
- `.claude/settings.json` hooks: block hand-typed `eas update`; block `&&` and heredocs on Windows; run tsc after every .ts/.tsx edit (~25s on the PC).
- Skills `/feature`, `/ship`, `/audit`, `/backup-check`; agent `reviewer` (read-only).
- `.github/workflows/ci.yml` (every push/PR); `ota.yml` **manual dispatch only**, from `master`. `EXPO_TOKEN` secret is set (verified Nov 10). 26A.8 dry run not done yet -- the first Phase 28 OTA is effectively it. **Never run it while `master` is 1.0.0.**

---

## Phase Details -- Recent

> Phases 1-19 carried in REV18/REV20; Phase 20 fix-session detail in REV21; Phase 20-23 headers below.

### Phase 24 -- Multi-Season Support, Season Comparison, Color Thresholds
- **Parts 0-4** -- Sep 12, `004217c` (on `master`; OTA status unconfirmed).
- **Parts 5 / 6 / 6b** -- Nov 10 (see the Phase 26 table above). Merged to `master`; reach the Duo in the v2 binary. Never OTA'd to the old phone.

> **KEY LEARNING -- the current season can be empty by design.** Seasons are gapless and the newest is open-ended, so on rollover day the current season has zero sessions; the empty state is intended.

### Phases 20-23 (headers -- full detail in REV21)
- **Phase 20** (`d48c258`) -- split detection, Makeable Spare %, OTA production channel, 16-agent audit (`docs/PHASE20-AUDIT.md`), fix sessions A/B/B2/C.
- **Phase 21** (`1dd908a`) -- stats expansion, draft fixes S5/S6, em-dash gutter-token learning.
- **Phase 22** (`528d060`) -- one-screen stats + session-type pills.
- **Phase 23** -- `a66a3e5` (S16/S15/N3), `1f59960` (typography).

---

## Deferred -- ship via `eas update --branch production`

| ID | Item |
|---|---|
| **N1, N9, N13** | NICE -- not done in the Phase 28 pass (N1 share spinner, N9 pin-row layout in 4 files, N13 SPLIT badge squeeze) -> after league. N11 done (Phase 27). N5, N8 cut. |
| **28.5 etc.** | Reference + Settings v2 restyle, Restore from file (Level 2), mid-game resume (Level 2), PocketDiagnostics split-leave colors, Made Cut pills -> segmented control. |
| **Backfill** | Winners 2026 weeks 3, 4 and Oct 17 onward -- from SyncPassport scorecards |

> **Done in Phase 26 (merged, in the v2 binary):** swipe-back confirm, N4, N15. **Shipped earlier:** S5, S6 (Ph 21); S15, S16, N3 (Ph 23).

---

## Open Questions

| Question | When |
|---|---|
| House shot exact specs (length + volume) | Verify with house sheet before updating Patterns in-app |
| Did Phase 24 Parts 0-4 ever reach the old phone? | Moot -- the old phone stays on 1.0.0 as the fallback; the Duo gets everything in v2. |
| ~~SF Pro or SF Pro Rounded~~ | Resolved Nov 10: SF Pro, weight 200 (Phase 28 D2). |

---

## Session Notes

| Session | Phase | Completed | Notes |
|---|---|---|---|
| 1-31 | Phases 1-20 + REV18 | Mar 6 -- Jul 14 | See REV18/REV20 (archive). |
| 32 | Phase 21 | Jul 17 | Stats expansion + draft fixes S5/S6. `1dd908a`, OTA'd. |
| 33 | Phase 22 | Jul 17 | Stats compaction + type filter pills. `528d060`, OTA'd. |
| 34 | Phase 23 | Jul 18 | `a66a3e5` (S16/S15/N3), `1f59960` (typography). OTA'd. |
| 35 | Phase 24 Parts 0-4 | Sep 12 | Multi-season model, shared filter, selectors, comparison card, season CRUD. `004217c`. NOT OTA'd at the time. |
| 36 | Planning (Claude.ai) | Oct 23 -- Nov 3 | Backlog triaged; Duo plan v1.2 -> v1.5 (split pages, v2 look, closed layouts, native bars from real Duo screenshots; workflow + Phase 26A added; $99 dev account declined). REV23. No code. |
| 37 | Phase 24 Parts 5-6b + Phase 26 + 26A prep (Claude.ai cloud session) | Nov 10 | Backup (Oct 10 export) verified: 40 / 125 / 174.1. Built on branches `phase26` (app) and `phase26a` (automation) in a cloud clone; tsc + checks run against the PC's node_modules via the device link; independent reviewer pass. Push to GitHub refused (no Claude GitHub App) -> branches delivered into the PC repo via git bundle. Decisions: goal-based 190 bands; split leaves grey-not-red; export JSON only; compact layout under 760pt; OTA workflow manual-only for now; NICE takes all accepted (6 keeps built); Phase 27 = Mac build (no Expo cloud build); Mac add-ons M1-M3 yes, M4 keep icon + update splash, M5 skip. REV24 + plan v1.6. Not merged, not shipped. |
| 38 | Phase 27 part 1 (Claude Code, PC) | Nov 10 | SDK 54 -> 58 step by step (each step: doctor + check + iOS bundle), React Navigation codemod, splash -> plugin, ReanimatedSwipeable, async `File.write` awaited, add-ons M1/M2/M3/M6, NativeTabs + per-tab stacks, Mac preflight Node check. `phase27` @ `edac19e` pushed. SDK 58 npm ERESOLVE -> Marcus chose one-time `--legacy-peer-deps`. Not shipped. |
| 39 | Phase 27 Mac build + docs sync (Claude.ai, iOS app) | Nov 10 | CI on `phase27` confirmed via REST; `backup.ts` diff checked. Mac a day early: Node 25 -> `node@24`, setup + Archive clean (Xcode 27.2), `package` -> `mBowl-2.0.0.ipa`; `gh` re-auth with a classic PAT -> GitHub Release `v2.0.0` @ `467d73e`. Master's docs commit merged into `phase27`. START HERE rewritten with NEXT steps; project docs synced. Duo install + data move next. |
| 40 | Duo install + Phase 27 merge + Phase 28 WP1-WP7 (Marcus PC/Duo + Claude.ai cloud session) | Nov 10 night | v2 on the Duo, data restored (40 sessions). Screen check F1-F6 (project doc `mBowl-DuoScreenCheck-Nov10.md`). Reviewer PASS on `phase27` -> merged (`a0496e9`). Pill-tap root cause (28pt pills in nested horizontal ScrollViews). WP1+WP2 OTA (`21ac7c1`); screenshot fixes; WP3-WP7 built; tab pages moved to `components/pages/`; reviewer pass; OTA `44af9ee`. Cloud-session lessons: no npm (CI = tsc), `env -u GH_TOKEN gh api`, PC link can't reach GitHub. |

---

## Post-v1 Backlog

- Export as CSV of games (optional; JSON export is built).
- Cut Oct 23: iCloud sync, Practice-type removal, H+I pin-heat redesign, home screen widget, app icon refinement.

---

## End-of-Session Protocol

`/ship` runs this (Phase 26A is merged). By hand:
1. `npm run check` green.
2. Commit + push.
3. Update this brief (bump the REV, add a Session Notes row).
4. Update the CLAUDE.md pointer to the new REV (all three locations).
5. **Upload the new brief to the Claude.ai project.** Claude in the Claude.ai project can do this directly -- ask it.
