# mBowl -- Session Brief REV31
**Full spec lives in:** mBowl-SPEC.md -- read it before writing any code.
**Duo roadmap + locked design spec:** `docs/mBowl-DuoPlan.md` (v1.8). **Phase 28 build spec:** `docs/mBowl-Phase28-BuildSpec.md` (all WPs built).
**Audit sources:** `docs/PHASE28-AUDIT.md` (Nov 11 -- M / S / N IDs) + `docs/AUDIT-FABLE-NOV14.md` (Nov 14 -- F IDs). Project copies: `claude/mBowl-Audit-Nov11.md`, `claude/mBowl-Audit-Fable-Nov14.md`.
**Rollback:** `docs/ROLLBACK.md` + `.github/workflows/rollback.yml` (new Nov 15 -- dispatchable once merged to `master`).
**Last updated:** November 23, 2026, ~14:20 (Mon)

---

## START HERE (Nov 23, 2026)

**One-line status:** Phase 30A (**190 recipe, Leave -> fix, Tilt cost**, three read-only Stats cards) **SHIPPED Nov 23 ~14:15** -- `master` @ `492209a`, OTA run 45277551319 -> **update group `814db029-5007-4f67-9069-1934733e5df7`**, runtime 2.0.0. Phase 29 (`e7cd0dff`) confirmed good (Marcus, Nov 22). **Rollback target if 30A misbehaves:** `e7cd0dff-5bfa-455a-bd90-943e5c3a0d61` (`docs/ROLLBACK.md`).

**Next:** Marcus's first look at the three cards. Then the next batch: close out v2 (Part E restyle, leftover NICE items) + the Phase 30 plan items (`docs/mBowl-Phase30-Plan.md` -- miss tags, line log, ball speed, wear counter, spare drills, house/condition, smaller items). "Closing frames" (9th/10th mark %) was offered and not picked -- close to the Oct cut of open-rate-by-frame. Bowling sensors researched Nov 22 (F5/Storm, Witsee, BowlSense, Ruby) -- Marcus passed ("just another thing to buy"); notes in the plan doc.

## Phase 30A -- what was built (Nov 22-23, branch `phase30a-insights`, merged)

Level 1: read-time only; no change to sessions, scoring, storage keys or saved data. Order on Stats under the grids: Path to goal -> **Your 180-200 games** -> Spare leak -> **Leave -> fix** -> **Tilt cost** -> charts.

| Card | What | Files |
|---|---|---|
| 190 recipe ("Your 180-200 games") | Goal-level games = target ± 10 (`goalRange`, 190 if unset), all-time, any type, with frames (`goalLevelSessions`) run through the grid's own `calcMetrics` / `calcAdvancedStats` -> First ball, Strike %, Spare %, Opens/game vs the current view, Gap column (✓ when already there; Opens inverted). Gaps + the "N fewer opens a game is worth about X pins" line need 10 framed games in the view (`nowGated`); the whole card locks under 10 goal-level games | `src/recipe.ts`, `components/pages/StatsPage.tsx` |
| Leave -> fix | The view's 3 most common first-ball leaves a Pocket Diagnostics card covers, one row per card, with the card's fix (stored Reference text via `cardsFromReference`, `DEFAULT_DIAGNOSTICS` fallback). Most specific card wins (10 Pin -> Ringing 10 pin, not Corner pin). Share = of all leaves. `CARD_LEAVE_KEYS` moved from PocketDiagnosticsTab to `src/leaveFixes.ts` (one mapping). Stats now reads Reference (display only) | `src/leaveFixes.ts`, `components/PocketDiagnosticsTab.tsx`, `StatsPage.tsx` |
| Tilt cost | % open on the frame after an open vs after a mark (pairs like Bounce-back, but an unfinished second frame is skipped), back-to-back opens a game, first ball after each, and the cost: open-open pairs beyond chance -- **k(k-1)/n per game** (k opens among n finished frames in random order; unbiased, so an off night isn't tilt) -- priced at Spare leak's pins per costed miss. Color on the excess (≤2 green, ≤10 orange, else red); "None" under 0.05 extra opens a game | `src/tiltCost.ts`, `StatsPage.tsx` |
| Spare leak tweak | `SpareBucket.costed` (misses with a known cost); `pinsPerMissedSpare` divides by costed misses only | `src/spareLeak.ts`, `src/recipe.ts` |
| Checks | `scripts/checks/insights.check.mjs` (30 assertions) in `npm run check` | `scripts/checks/` |

**Reviews:** pass 1 = PASS WITH WARNINGS -> fixed in `3335939` (tilt compared per game, costed misses, recipe gate + precision, one row per card, text wrapping). Pass 2 = PASS WITH WARNINGS -> the per-game open-rate baseline was biased low ("hot hand" bias) -> k(k-1)/n in `492209a`; test now separates an off night (old formula 4.5 extra opens) from tilt. Kept: Stats re-renders everything when only Reference text changes (correct, just extra work). CI green on every push.

**Device checks (30A, ~2 min):** the three cards show on Winners 26 and All-Time; Leave -> fix text matches Reference -> Pocket Diagnostics (edit a fix there -> Stats shows the new text); on a regular-width phone, long rows wrap rather than run off the edge.

---

## REV30 START HERE (Nov 21, kept for reference)

**One-line status:** Phase 29 (**Path to goal + Spare leak**, two read-only Stats cards) **SHIPPED Nov 21 ~14:47** -- `master` @ `02db869`, OTA run 44958332762 -> **update group `e7cd0dff-5bfa-455a-bd90-943e5c3a0d61`**, runtime 2.0.0. The after-league batch (`766e68a8`, REV29) is confirmed good on the Duo (Marcus, Nov 20). **Rollback target if Phase 29 misbehaves:** `766e68a8-fbdc-4a50-955f-18e294806e60` (`docs/ROLLBACK.md`).

**Next:** Marcus sets **Settings -> edit Winners 26 -> League Weeks** (and Target Average 190 if not set) -> first look at both cards. Then: close out v2 (Part E restyle, leftover NICE items) -> live with Phase 29 for 2-3 league weeks -> Phase 30 (plan: `docs/mBowl-Phase30-Plan.md`, project copy `claude/mBowl-Phase30-Plan.md` -- miss tags, line log + "start here", ball speed, wear counter, spare drills, house/condition).

## Phase 29 -- what was built (Nov 21, branch `phase29-goal-spares`, merged)

Level 1 (read-time only; no change to sessions, scoring, stats math or storage keys). One additive optional settings field.

| Item | What | Files |
|---|---|---|
| Path to goal | Stats card under the grids: league average needed over the rest of the season to finish at `settings.targetAverage` + the series that means each week; league average (league + makeup only) + games; weeks left. Weeks bowled = highest logged week (makeup carries its week); no week numbers -> session count. 3 games/week. Colors: green on pace / orange within 10 / red more / grey > 300. Shown for the current season (set-up prompt with an Open Settings button when target or weeks missing, also in the empty state) and for a past season only with weeks set; final ("done") only once a season has ENDED; a finished season with no league games hides it. Hidden for All-Time and practice/tournament filters | `src/goalPath.ts`, `components/pages/StatsPage.tsx` |
| Season.weeks | Optional `weeks?: number \| null` on `Season`; edited in Settings -> season editor -> **League Weeks** (saved with the season's Save; 44pt input); shown in the season row as "· N wks". Restore accepts it (settings = plain object) | `src/types.ts`, `components/SettingsContent.tsx` |
| Spare leak | Stats card: pins a game lost to missed makeable spares + "about X% of your gap to <target>" (gap uses the league average when Path has one). Rows: Single pins (from notation: first ball '9' -> every framed game), 10 pin / 7 pin (pin data), Multi-pin makeable (pin data, splits excluded via `isSplit`) -- made X of Y, % (80/60 band, color from 5 chances), pins/g. Cost of a miss = deck pins + next ball (spare bonus) + deck pins again if the frame before was a strike; 10th-frame fill = first-ball average of the same data. A miss in an unfinished game counts as a chance but adds no pins | `src/spareLeak.ts`, `StatsPage.tsx` |
| Checks | `scripts/checks/goals.check.mjs` (31 assertions, hand-built games) added to `npm run check` | `scripts/checks/` |

**Reviews:** reviewer pass 1 = PASS WITH WARNINGS (6) -> 4 fixed in `f4918cd` (past season final, partial games, one gap basis, empty-state prompt, 44pt input); 2 kept (Target Average/Series inputs share the small-input pattern; hex colors instead of theme tokens -- matches the rest of StatsPage). Pass 2 (narrow) = PASS WITH WARNINGS -> fixed in `02db869` (future season not "final"; partial-game misses still counted). CI green on every push.

**Device checks (Phase 29, ~2 min):**
1. Settings -> Winners 26 -> League Weeks -> Save. Row shows "· N wks". Stats -> Path card shows a sensible needed average and series.
2. Spare leak numbers look believable on Winners 26 and All-Time; switching the type filter to Practice hides the Path card.
3. Pick Winners 25 / Jubilee 26 -> no Path card unless their League Weeks are set (then a final number).

---

## REV29 START HERE (Nov 17, kept for reference)

**SHIPPED Nov 18 ~07:35 (Marcus: "ship it"):** `master` fast-forwarded to `a8b3dca` (= `after-league`), OTA run 44336666836 -> **update group `766e68a8-fbdc-4a50-955f-18e294806e60`**, runtime 2.0.0. The Duo picks it up on the first launches after the cert refresh. **Next: cert refresh -> Export Backup -> device checks (below).** Rollback target if needed: `ee0882ee-f884-41a4-b8d7-c6c69d0f69a5` (`docs/ROLLBACK.md`).

**One-line status (Nov 17, before shipping):** the after-league batch is **BUILT on branch `after-league`, NOT merged, NOT shipped.** Parts A (data safety), B (mid-game save), C (rollback workflow) and most of D (Level 1) are done, with CI green and three independent `reviewer` passes, every finding that mattered fixed (results below). Part E (28.5 restyle) and a few NICE items are left. **Marcus can't run the app right now -- the 7-day cert has expired (iloader refresh pending)** -- so the device checks wait for that. **The next step is Marcus's call: "ship it" -> fast-forward `master` -> one OTA -> refresh the cert -> device checks.**

**Why one OTA for A+B+C+D (Nov 17):** REV28 planned an OTA per Part with device checks between, but with no runnable phone there's nothing to check between Parts, and an OTA only downloads on the next launch anyway. One OTA, then the full device-check list below in one sitting. If something is wrong, `docs/ROLLBACK.md` puts back `ee0882ee-f884-41a4-b8d7-c6c69d0f69a5` (the pre-league build that ran league Week 10 + the 11/7 makeup clean) in ~2 minutes, with no data risk (no data-shape change in this batch).

**Backup gate:** Marcus duplicated the most recent backup on Nov 17 before this session ("I just duplicated the most recent backup"). **Before the OTA is dispatched, confirm one copy is OFF the phone** (iCloud Drive -> mBowl Backups), not only a duplicate in Files -> On My iPhone -> mBowl -- an app reinstall would take the on-phone copy with it. Expected counts: 45 sessions / 140 games (unverified -- check with `npm run backup-check` or in the app after the cert refresh).

**Where things are:**
- **Repo:** `master` @ `1f4aedf` (docs) = app code `20bfa97`, live on the Duo as update group `ee0882ee-...`. **`after-league`** @ see the commit table below -- CI green on every push.
- **v2 binary:** `mBowl-2.0.0.ipa` (GitHub Release `v2.0.0`), on the Duo via iloader. **Cert expired ~Nov 17 -> iloader Import IPA to refresh** (data stays; it's the same app).
- **Data on the Duo:** ~45 sessions / ~140 games (43/134 + 11/7 makeup + 11/14 Week 10).
- **Old phone:** retire it (two clean nights on v2). Wipe after the post-OTA backup check.

---

## NEXT -- in order

1. **Marcus: "ship it"** (or hold). Claude then: confirm `after-league` CI green -> fast-forward `master` to it (confirm via API that `master` moved) -> dispatch `ota.yml` (normal eas-cli install first; `eas_before` only for an upstream break) -> add the new update group to the table in `docs/ROLLBACK.md`.
2. **Marcus: refresh the cert** (iloader -> Import IPA `mBowl-2.0.0.ipa`). Open mBowl, swipe closed, reopen (picks up the OTA).
3. **Marcus: Export Backup first** (Settings -> Export Backup -> iCloud Drive -> mBowl Backups) -- confirms the counts (~45 / ~140) and gives a post-OTA copy off the phone.
4. **Device checks** (below, ~15 min). Anything wrong -> `docs/ROLLBACK.md` to `ee0882ee-...` while it's fixed on a branch.
5. **Dry run 26A.8** (optional, any time after the merge): Actions -> Rollback with the NEW live group = no visible change; proves the workflow + token.
6. **Left in the batch:** Part E (28.5 Reference + Settings restyle -- needs Marcus's screenshots, own OTA), NICE N16, N19, N21-N24, N27, D5/F14 check, D8 (N1, N9, N13, split-leave colors). See "Not done" below.

## Device checks after the OTA (Duo, cover screen unless noted)

**Part A -- data safety**
1. Settings -> Export Backup works; Files -> On My iPhone -> mBowl -> **Backups** folder appears (a daily copy) after any save.
2. Log a practice session, Submit -> in History + Stats. Delete it -> Backups now has a `mBowl-kept-...` copy.
3. History -> Edit a session -> Save; Edit -> Edit Frames -> Done -> Save; Edit -> ✕ -> Cancel. On a game WITH frames, change the score -> "Override Saved Score?" appears once.
4. Settings: change Target Average, tap Done with the keyboard still up, reopen Settings -> did it save? (D5/F14 check -- report either way.) Toggle a ball off/on (no flicker).
5. **Restore from File...** -> pick the export from step 1 (iCloud Drive -> mBowl Backups) -> the confirm shows its counts -> Restore -> History and Stats show the data **without a relaunch** -> Backups has a `...-before-restore.json` copy.
6. Open screen (unfolded), Stats | History: delete the practice session if still there -> Stats numbers update at once (S23).

**Part B -- mid-game save (the big one)**
7. Practice draft, type an opponent, open Game 1 in Log Frames, enter 5 frames. Swipe mBowl closed from the app switcher. Reopen -> Resume -> Log Frames reopens on Game 1 with "Game 1 restored" and the 5 frames -> finish -> Done -> the score is in the draft.
8. Same with no opponent typed (fresh form): open Game 1, 3 frames, kill, reopen -> Game 1 reopens with the 3 frames.
9. Kill mid-game, reopen -> **Discard** on the Resume prompt -> next new game starts empty.
10. Normal exits still work: Done; swipe-back -> Discard; swipe-back -> Keep Editing -> ✕ (the Nov 11 hang paths -- every one once). Live game button opens the right game.
11. History -> Edit -> Edit Frames -> Done still updates the right session. Delete the practice sessions.

**Part D -- Level 1**
12. Reference shows 3 sub-tabs (Signals default, Pocket Diagnostics, Mental). Signals: Switch Guide has no "Switch to" field; Ball Arsenal is gone; a Lane Reads edit saves.
13. Log Frames: in Pins mode, ⌫ after a mixed Pins/Quick frame behaves; a frame note's Return key closes the keyboard (N25).

## What was built (Nov 17, branch `after-league`)

| Part | IDs | What | Commit(s) |
|---|---|---|---|
| A1 | S22, F3 | Every storage writer returns success. Submit on a failed write keeps the draft + alerts; a failed primary skips the shadow; `revertSessionsCache()` puts AsyncStorage's memory cache back after a failed write; one session id per form so a retry never saves the night twice | `bd04ae4`, `78663d1`, `3a341f3`, `61ab669` |
| A2 | S21, F4, F10 | History delete/edit: fresh `readSessionsResult()`, refuse on invalid/error, apply to the fresh list, write outside the updater; edit of a session no longer in the store refused; delete of a missing id refused | `5868fe5`, `3a341f3`, `a78d52c` |
| A3 | F5 | `readSettingsResult()` / `readReferenceResult()`; Settings (settings + balls) and Reference refuse to save over a failed read; Settings updates at once and rolls back on failure | `bd04ae4`, `ef0f7db`, `3a341f3` |
| A4 | F15 | `writeBackup()` skips if any of the 4 reads is invalid/error | `d299a57` |
| A5 | F1, F6 | `Documents/Backups/`: `mBowl-kept-*` before an overwrite that drops a session (10 kept, the largest never pruned) + `mBowl-daily-*` once a day (7 kept). A failed kept copy leaves the old file alone. Fable's subset guard NOT used | `d299a57`, `3a341f3` |
| A6 | F1 | First launch with sessions `missing`: a valid shadow -> left to shadow recovery (no seeding); else restore from the main file / newest Backups copy; seeds only with no backup anywhere; a failed restore -> alert, no seeding, flag unset, no launch backup. Balls shadow respected too | `d374aef`, `3a341f3`, `a78d52c` |
| A7 | F1 (B), F13 | Settings -> **Restore from File...** (expo-document-picker, in the 2.0.0 binary): counts + export date shown before restoring. **Every restore** (both kinds) first saves the phone's raw current data as `mBowl-kept-*-before-restore.json` and stops if it can't. Clearer partial-restore message | `d299a57`, `ef0f7db`, `3a341f3`, `a78d52c` |
| A8 | S21 | `src/dataEvents.ts` (`notifyDataChanged(source)` / `onDataChanged`): History, Reference, Stats re-read after a Restore; the Settings sheet reloads itself. Alert text still says "close and reopen if anything looks out of date" until verified | `d299a57`, `5868fe5`, `ef0f7db` |
| A9 | F12 | Submit's refusal now points to Restore from File when relaunching doesn't help | `78663d1` |
| B | S24, F2, N17, F9 | `KEYS.FRAMES_IN_PROGRESS` (transient): Log Frames (Log tab only) saves the game on every change, keyed by gameIndex + the form's game id; reopened after a kill (after Resume, or Game 1 with no draft); Discard clears it; Done leaves it until LogPage has written the result into the draft (immediately, not after the 400 ms auto-save); cleared by game id only. `FRAME_RESULT` carries `source` + a one-time token; each page takes only its own result | `7046f81`, `a78d52c`, `0eb759a` |
| C | 26A.7 | `.github/workflows/rollback.yml` (`eas update:republish --group`), `docs/ROLLBACK.md` with the known-good group | `a780423` |
| D1 | Reference trim | 3 sub-tabs; Position, Patterns, Ball Arsenal, Switch-to hidden -- all data still round-trips (REFERENCE has no shadow) | `a786bb6` |
| D2 | S23 | Stats re-reads on a data change (filters untouched) | `f1a7f94` |
| D3 | F7 | A form/draft whose only content is prep (opponent, type, tournament text) can still get S19's date/week refresh; any score/ball/frames/notes pins the date | `61ab669` |
| D4 | F11 | Edit sheet: changing a framed game's score asks once | `36b12de`, `a78d52c` |
| D6 | N18, N25, N26 | ⌫ trims pin data by throw index; note fields' Return closes the keyboard; `KEYS as const` | `5f4ce33`, `d6bb5d0`, `3a341f3` |
| Docs | -- | CLAUDE.md (keys table, write rules, backup rules, 3 sub-tabs), SPEC appendix rows 1/10/11 | `d6bb5d0` |

**Reviews:** reviewer pass 1 on Part A = BLOCK (Restore from File promised a copy it didn't always make) + 12 warnings -> fixed in `3a341f3` / `61ab669`. Pass 2 on fixes + B + D = PASS WITH WARNINGS (10) -> the ones that mattered fixed in `a78d52c` (S24 matched by game id; immediate draft write on every Done; first-launch alerts; balls shadow; kept copy includes the balls shadow). Pass 3 (narrow, on `a78d52c`) = PASS WITH WARNINGS -> fixed in `0eb759a` (clear by game id; the no-draft reopen only when the draft key is truly missing, so a draft that failed to read is never replaced). Kept as-is (minor): Settings rollback during two overlapping writes can show a stale value until reopen; edit Save haptic fires before the result. **CI (npm ci + tsc + checks) green on every push.**

**Decisions made in the build (Marcus can reverse):**
- One OTA for A-D (above). Kept copies 10 (REV28 said 5) with the largest protected; daily 7.
- Restore from File shows counts + date and saves the phone's data first; it doesn't diff the two.
- First launch restores automatically (with an alert saying so) rather than asking.
- F11 matches the Log form: override keeps the frames; it doesn't clear them.
- **D7 skipped** (atomic backup write): expo-file-system 58's `move(overwrite)` is remove-then-move, not atomic; the Backups copies are the protection.

## Not done (still open)

| Item | Why left |
|---|---|
| **Part E -- 28.5 Reference + Settings v2 restyle** | Visual; needs Marcus's screenshots. Own OTA after A-D are verified |
| **D5 / F14** goal fields save on blur | Device check 4 first; fix only if it fails |
| **N19** Done hidden after re-entering an earlier frame of a finished game | UI change; wants eyes on the device |
| S24 edge: a game other than Game 1 left open on a form that never became a draft (nothing typed, Add game, open Game 2, killed) is not reopened | Live game always opens the first unscored game, so rare; the entry is kept, never misapplied |
| **N16** rotation mid-frame resets tapped pins; **N21-N24, N27** | Display / plausible-only items; next Level 1 batch |
| **D8** N1 share spinner, N9 pin-row layout in one place, N13 SPLIT badge, PocketDiagnostics split-leave colors | Presentation; fold into Part E |
| Parked | Per-ball motion notes on the ball roster (Level 2, own item); Log Frames header Done capsule only if missed; delete merged branches |

---

## Hard rules

- OTA only from `master`, only via `ota.yml` (GitHub Actions, manual dispatch) or `npm run ship:ota`, only after CI is green and Marcus says "ship it". Confirm `master` moved to the intended commit before dispatching.
- **OTA escape hatch:** if the OTA run fails in `expo/expo-github-action` installing eas-cli (upstream, not our code), re-dispatch with `eas_before` = an ISO time when the last OTA worked: `env -u GH_TOKEN gh api -X POST repos/Pipsqueak315/mBowl/actions/workflows/ota.yml/dispatches -f ref=master -f 'inputs[message]=...' -f 'inputs[eas_before]=2026-11-11T16:00:00Z'`. Try the normal install first.
- **Level 2** (Parts A, B): fresh backup off the phone first, audit the files before editing, `reviewer` pass, device checks, never rushed. Level 1 (D, E): no change to scoring, stats math, storage keys or saved data.
- Every control must feel native: >= 44pt touch target, never inside a horizontal ScrollView.
- **SDK 58 rule:** check the vendored source (`expo/expo` branch `sdk-58`, `packages/expo-router/src/react-navigation/...`), not React Navigation's docs. `usePreventRemove`: continue with `repeat()` -- **never** `navigation.dispatch(data.action)`.
- **Every exit/guard path gets one on-device run before it counts as done.**
- Until A8 is verified on the device (check 5): after a Restore, **relaunch the app before touching anything**.
- **Data writes (Nov 17):** fresh `*Result` read -> refuse on invalid/error -> write outside any updater -> check the returned boolean -> `notifyDataChanged(source)`. Never write defaults over a key that failed to read.

**Who does what:**

| Who | Can do | Can't do |
|---|---|---|
| **Claude (Claude.ai project session, cloud)** | `add_repo` the GitHub repo (push access) -> clone, branch, commit, push; read CI and dispatch `ota.yml` with `gh api` (**`env -u GH_TOKEN gh api ...`**); update project docs; run the `reviewer` agent; read backups; sparse-clone library sources from GitHub (e.g. `expo/expo` branch `sdk-58`). | `npm install` (no package network) -- so no local `tsc`: **CI is the type check** (~2 min per push). The PC link (device_bash) cannot reach GitHub. |
| **Claude Code on the PC** | Everything above plus npm installs, local `tsc`, `npm run ship:ota`. **The PC repo is stale** (last on `phase27` @ `6d54a31`): `git fetch`, then `git checkout master`, then `git pull` (one PowerShell command at a time). | iloader, the Mac, looking at the phone. |
| **The Mac (no Claude Code there)** | `scripts/mac-build.sh` -- only for the next native rebuild. Console app + Duo by cable = live device logs. | Anything else. |
| **Marcus only** | iloader installs + 7-day cert refreshes, checking screens on the Duo, Export Backup, "ship it", Xcode signing/Archive clicks. | -- |

---

## DONE log (Nov 17)

- **~20:20-21:45 (Claude.ai project cloud session, Opus):** Marcus: "duplicated the most recent backup... get through as much as you can"; mid-session: cert not refreshed yet, wants the fixes in place for when he does. Built Parts A, B, C, most of D on `after-league` @ `0eb759a` (table above). Verified the expo-file-system / expo-document-picker 58 APIs and `eas update:republish` before using them. Three reviewer passes (BLOCK -> fixed; PASS WITH WARNINGS -> fixed; narrow pass on `a78d52c` -> fixed in `0eb759a`). CI green on every push. Not merged, not shipped -- waiting on "ship it". REV29.

## DONE log (Nov 15)

- **~07:40 (Claude.ai):** Marcus back from league Week 10 + the 11/7 makeup on the Duo: "everything worked well". Batch held until he had dedicated time. REV28 counts -> 45 / 140; old phone can retire.

## DONE log (Nov 14)

- **~10:55-11:00 (Claude.ai, Opus):** Marcus has Claude Fable on his plan for 3 more days. Plan: blind read-only re-audit today (answer key = the open Nov 11 items), Level 2 work on Fable after league. Marcus: Duo tonight, screenshots before every save. Claude: Export Backup before leaving (the backfill exists only on the Duo); bring the old phone; Rotation Lock on; screenshot the Log Frames scorecard before Done.
- **~11:00-13:40 (Claude.ai, Fable):** independent audit, `master` @ `de0bb94` (app code = `20bfa97`), read CLAUDE.md + SPEC only, then tagged against `docs/PHASE28-AUDIT.md`. Result: MUST 1 (new: F1), SHOULD 6 (3 new: F5, F6, F7), NICE 7 (4 new: F11-F14). Re-found S21, S22, S24, N17, N28 independently. -> `docs/AUDIT-FABLE-NOV14.md` / project `claude/mBowl-Audit-Fable-Nov14.md`.
- **~13:45-14:15 (Claude.ai, Opus):** review of the Fable report against the code. F1 confirmed in `src/backup.ts` / `app/_layout.tsx` (partly known as the REV27 "fresh install" TRAP note; scenario B -- an imported export silently overwritten on a cold launch -- is new). **Fable's F1 fix direction ("refuse unless the old file is a subset of live") rejected:** it would block every backup after a legitimate delete; replaced by copy-then-overwrite (A5). **New F15:** `writeBackup()` writes default balls/settings/reference into the file when those reads fail. After-league order rebuilt into Parts A-E (above); Marcus approved and asked for everything current so the next session can run the whole batch. REV28 + audit cross-reference + CLAUDE.md + DuoPlan synced (repo docs commit + project docs).

## DONE log (Nov 11 midday)

**~11:35-12:00 -- pre-league batch (Claude.ai project cloud session).** Marcus: "get going on the audit fixes we need before league". Built M2, S17, S18, S19, S20 on `fix/pre-league`, one commit each (table in NEXT step 1). M2 checked against the expo-router `sdk-58` source first (no anchor -> single `(tabs)`; `useIsFocused` exported from `'expo-router'`, same focus context as `useFocusEffect`). S19 design choice: never move a date Marcus picked (backfill from SyncPassport flips apps before any score is typed) + a 12h floor so a league night past midnight keeps its date. CI green; `reviewer` PASS WITH WARNINGS, no blockers -- fixed the post-save Submit window, the midnight floor (counts from last confirmation), and a dead try/catch (`20bfa97`, CI green). Marcus: "ship" -> fast-forwarded `master` to `20bfa97` (confirmed via API before dispatch). **OTA run 43091230711 FAILED twice** in `expo/expo-github-action` (yarn install of eas-cli 27.7.2 -- the version that installed fine at 16:05Z): a Babel release since then needs `@babel/types` / `parser` / `traverse` `^7.29.14`, which the registry didn't serve. Checks had passed; nothing published. Fix `c20bc8c`: optional `eas_before` dispatch input -> `npm install -g eas-cli@latest --before=<time>` + `EXPO_TOKEN` on the publish step (empty = old path). Re-dispatched with `eas_before=2026-11-11T16:00:00Z` -> **OTA run 43091822546, Published, runtime 2.0.0, update group ee0882ee**. Project docs synced (audit status, REV27, CLAUDE.md).

## DONE log (Nov 11 morning)

**08:15 -- audit + docs.** Targeted read-only audit after the hang: 4 parallel agents (A1 navigation API drift, A2 native-module/library drift, B1 Log league-night path, B2 History / split pages / backup), each reading real SDK 58-era library source; one separate verification agent re-read every cited line (13 confirmed, 4 plausible, 2 cut). No second "flipped SDK 58 API" bug. Result: 1 MUST (M2), SHOULDs S17-S24, NICE N16-N28 -> `docs/PHASE28-AUDIT.md` (`7d9c0f3`) + project copy `claude/mBowl-Audit-Nov11.md`. **Marcus agreed the triage** (pre-league batch M2, S17, S18, S19, S20 in that order; S21-S23 after league; S24 = known D5). Fixes deferred to a new chat.

**07:20-08:05 -- rotation + cover landscape.**
- `1ea0f6c` (OTA run 43048675202): removed the startup `ScreenOrientation.lockAsync(PORTRAIT_UP)` in `app/_layout.tsx` (a 27.0 stopgap "until the Phase 28 layouts handle landscape" that was never deleted). The app follows the phone; iOS Rotation Lock is the switch. Marcus asked about an in-app rotate button -- decided against (iOS 27 treats app locks as a preference on resizable apps; Control Center already does it).
- Marcus's cover-landscape screenshots (F12-F14 in the Duo screen check doc). `4d4ec3b` (OTA run 43052662197): Log Frames wide layout padded base + inset on both sides (the side inset had REPLACED the 12pt padding and the right inset is 0 in cover landscape); active row wraps "Frame N · ball k" under the slots; side Strike/Confirm 132pt (was 150). **Week suggestion** now counts from the start of the Phase 24 season the date falls in (`weekFor()` in `LogPage.tsx`) -- it showed "Week 62" from the legacy 2025 `seasonStart` (the Phase 24 "don't rewire week auto-suggest" note is superseded). `1ab5e24` (OTA run 43054655209): the right info column's hairlines run to the screen edge (square bands bleed), text stays inset -- Marcus: it looked cut off.
- History landscape looked right; unfolded "seems fine for now" (Marcus).
- Watermark / "on air" OTA badge idea: proposed, **Marcus nixed it** (extra step).

**06:20-07:15 -- Log Frames game-over hang (fixed + verified).**
- **Bug (Marcus, Duo folded, backfilling 10/17 with frames):** after a full game, Done did nothing; ✕ stopped working after Done; the app eventually aborted. Crash log `mBowl-2026-11-11-062917.ips`: SIGABRT, NSException rethrown in `ObjCTurboModule::performVoidMethodInvocation` on `com.meta.react.turbomodulemanager.queue` (no module/reason in the log -- iOS omits it for sideloaded apps). Isolation: ✕ with no frames closes; one throw + ✕ shows "Discard Frames?"; full game + Done hangs.
- **Root cause:** Expo Router 58 ships its OWN `usePreventRemove` (`expo-router/src/react-navigation/core/usePreventRemove.tsx`): prevention lives in router state and the callback gets `repeat()`. The 26.3 leave guard used the React Navigation 7 pattern `navigation.dispatch(data.action)`, which on SDK 58 is blocked again while `isDirty` is still true -> callback -> dispatch -> blocked... endless. Built Nov 10 in a cloud session, never run on a device before.
- **Fix:** `97de587` -- both paths call `repeat()`. OTA run 43045461171. **Verified by Marcus 07:14** (practice game Done + ✕/Discard).
- **Side change:** `89957d8` (OTA run 43043623284) removed WP2's teal Done capsule from the Log Frames header (first, wrong theory). Header is static (✕ + "Game N"); Done = the "Final score" card.
- **LESSONS:** after an SDK bump, re-check every vendored navigation hook against the NEW package source; every guard/exit path needs one on-device run. For an unexplained crash, the Mac's Console app (Duo by cable) shows the exception reason the .ips omits.

**06:08-06:35 -- backfill.** Plan: hand-enter through the Log tab (no file restore, no code). 9/26 and 10/31 scores-only; 10/17 with frames from the SyncPassport scorecards (Quick mode -- the scorecards have counts, not leaves). Week numbers typed by hand (3, 6, 8).

## DONE log (Nov 10 night, after the Mac build)

- **~21:10-21:35 (Claude, cloud) -- polish round 2, `phase28` @ `db5923c`, CI green. **Shipped 21:33: `master` @ `70393b1`, OTA run 42966234484 (runtime 2.0.0, update group d43b0e75).** (Run 42965978775 at 21:28 built the old `b794996` -- dispatched a moment before the master push registered; harmless re-publish of the same app code. Lesson: confirm `master` moved before dispatching.)** Marcus's 21:05 screenshots: History rows rounded on the left but square under the rail (lopsided); press-and-hold showed red/blue through the row; animations sometimes slow, sometimes quick. Fixes: History = plain iOS list (edge to edge on black, hairline separators, opaque press highlight); Log rounded cards back to symmetric inset-grouped (rule: only SQUARE backgrounds bleed under the rail); new `components/v2/SwipeRow` for History + Log (actions glued to the trailing edge, invisible at rest, 1:1 tracking, Delete runs under the rail); `motion` tokens in `src/v2/theme.ts` + `src/v2/motion.ts` (one critically damped spring, one 240ms layout animation); Stats/History stop blanking to a spinner + rebuilding on every focus (first load only, re-render only on changed data); hidden second pages skip reloads (`usePageVisible`); Log stops re-rendering on every focus.
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
- app/index.tsx is a redirect to /(tabs)/log -- required for Expo Go. **No `unstable_settings.anchor` in `app/_layout.tsx`** (M2, Nov 11): with the anchor, the Redirect minted a second `(tabs)` on every cold launch. Don't add it back.
- Windows machine: always write files using a JS file via node. Never use python or bash heredoc.
- PowerShell does not support && -- run commands one at a time. Multi-line commit messages: write to a file and use `git commit -F`.
- `app.json`: `"orientation": "default"` (all orientations, native); the JS portrait request was removed Nov 11 (`1ea0f6c`) -- the app rotates, iOS Rotation Lock is the switch; `supportsTablet: false`. Version 2.0.0 / buildNumber 2. Changing these is native = Mac rebuild.

### Architecture Patterns

- **Seasons (Phase 24) -- multi-season, gapless, read-time.** `src/seasons.ts` owns the model. `DEFAULT_SEASONS` (winners-2025 / jubilee-2026 / winners-2026) is synthesized in memory when `settings.seasons` is absent -- **never persisted on read** (`mbowl_settings_v1` has no shadow key). Only each season's `start` is stored; `resolveSeasonRanges()` derives each end as (next start − 1 day), last open-ended. `seasonForDate()` / `currentSeason()` map a date / today to a season. Membership is derived from `session.date` at read time -- nothing written onto sessions, no `seasonId`, no migration. `seasonStart`/`seasonEnd` are **left untouched** (legacy fields). **Week auto-suggest was rewired Nov 11 (`4d4ec3b`):** `weekFor()` in `LogPage.tsx` counts from the start of the season the date falls in, falling back to `settings.seasonStart` only for a date before every season.
- **Shared session filter (Phase 24 Part 0):** `src/sessionFilter.ts` exports `filterSessions(sessions, seasonSel, seasons, typeFilter)` + `ALL_TIME` + `TypeFilter`/`SeasonSelection`. **Single implementation used by both Stats and History.** Season selection is non-persistent, reset to the current season on each focus, like the type pills.
- **Season comparison (Phase 24 Part 3):** selected season vs its predecessor via `computeSeasonMetrics()`. Frame-derived deltas suppressed below `MIN_FRAME_GAMES` (10) games with frame data on either side.
- **Stat colors (Phase 24 Part 6):** `CELL_BANDS` + `bandColor()` in `components/pages/StatsPage.tsx` for the seven grid cells; `makeableColor` for aggregate Makeable (locked 80/60); `leaveConversionColor(pct, isSplit)` for per-leave rows. Same `MIN_FRAME_GAMES` gate. `avgColor` (180/166) is the locked overall-average rule -- separate.
- **Series rule (Part 6b):** `threeGameSeriesTotal()` -- High Series and Series Trend use exactly-3-game sessions only.
- **Gear icon:** Each page injects a headerRight gear via useNavigation().setOptions() in useLayoutEffect (skipped when `embedded`). Opens SettingsContent.tsx as a pageSheet modal.
- **v2 / Phase 28:** tokens `src/v2/theme.ts`; arrangement `useLayoutClass()` (`src/v2/layout.ts`: compact / compactWide / splitStacked / splitSideBySide from the usable width); page width + side insets `usePageWidth()` / `useSideInsets()` (`src/v2/page.tsx`, PageContext set by `components/v2/SplitPages.tsx`); shared controls `components/v2/` (SegmentedControl, SeasonMenu, FilterHeader, Scorecard, Keypad, SplitPages, LiveGameButton); Live game plumbing `src/v2/liveGame.ts`.
- **Dark theme:** Forced in app/_layout.tsx. StatusBar light.
- **Log form date (S19, Nov 11):** the Log page keeps an untouched form's date current (`refreshFormDate()` -- focus / foreground / Settings close). Rules: empty form only, never a picked/resumed date (`dateUserSetRef`), 12h floor from the last time the date was confirmed current (`STALE_MS`) so a night past midnight keeps its date. Submit has an in-flight guard (`submittingRef`, S18).
- **Modals (S20, Nov 11):** every RN `Modal` carries `supportedOrientations={['portrait', 'landscape']}` -- add it to any new Modal, or it snaps the app to portrait.
- **ScalePressable:** Shared animated press component (`motion.spring`, `motion.pressScale`). Since S17 (Nov 11) the animated Pressable IS the box and wraps its children -- never put the Pressable beside the children again (a tap on the label Text never reaches a sibling).
- **Shared mini-scorecard (Phase 23, restyled Phase 28 WP1):** `components/FrameGrid.tsx`, `variant: 'compact' | 'full'`, both connected box-score grids; optional `currentFrame` tint. Standing-pin color **white** `#FFFFFF` via `STANDING_PIN` (was teal). Log Frames has its own full-width `components/v2/Scorecard.tsx`.
- **Typography scale (Phase 23):** 200 (hero numerals) / 300 (white data) / 400 (threshold-colored ceiling) / 500 (labels) / 600 (emphasis).
- **Storage read states (Phase 20):** `readSessionsResult()` / `readBallsResult()` return `{ status, value }` (`missing|ok|invalid|error`). `[]` alone is never acted on; writers must use the *Result variants. Only `missing` seeds.
- **Split detection (Phase 20):** `isSplit()` in leaveUtils.js, read-time from `pinsStanding`, never persisted. 2-8-10 and 4-7-9 are splits; sleepers (2-8, 3-9) count as adjacent.
- **Throw-notation tokens:** `X` strike, `/` spare, **`—` (em dash, U+2014)** gutter/miss (NOT ASCII `-`), `0`-`9` counts.
- **Advanced stats (Phase 21):** First Ball Avg / Bounce-Back % / Doubles % / Clean Games all read-time via `calcAdvancedStats()`.
- **Backup / export:** `src/backup.ts` `writeBackup()` / `restoreBackup()` / `exportBackup()`. File `mBowl-backup.json` in `Paths.document`, **visible in Files -> On My iPhone -> mBowl** (`UIFileSharingEnabled`). **TRAP:** `writeBackup()` runs on every cold launch -- on a fresh install, restore a copied-in file BEFORE the app is ever relaunched.
- **Live game (WP7):** M2 fixed Nov 11 (one `(tabs)` at launch; the Live effect only answers when the Log page `useIsFocused()`). The button only *requests*; `LogPage` answers (opens Log Frames for the first unscored game) once `ready` and no resume prompt is up. Never push `/log-frames` from outside the Log page for a draft game -- Log consumes `KEYS.FRAME_RESULT` on focus and must own the game list.
- **Log Frames leave guard:** `usePreventRemove(isDirty)` + `savedRef`; one "Discard Frames?" for Cancel and swipe-back. `isDirty` = frames differ from the snapshot taken when the screen opened. **SDK 58: `usePreventRemove` is Expo Router's own -- continue a blocked exit with the callback's `repeat()` (or the returned `disablePrevention()` then navigate), NEVER `navigation.dispatch(data.action)` (it loops forever; Nov 11 hang).**
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
| **Audit Nov 11 + Nov 14** | ~~Pre-league batch M2, S17-S20~~ (shipped `20bfa97`). Parts A-D built Nov 17 on `after-league` (not shipped) -- see "What was built" / "Not done" above. |
| ~~Backfill~~ | Done Nov 11 on the Duo (9/26, 10/17, 10/31). 10/3 + 10/24 took averages (not entered); 11/7 makeup logged Nov 14-15. |

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
| 41 | Polish round 2 (Claude.ai project cloud session) | Nov 10 night | Marcus's 21:05 screenshots: lopsided History cards, red/blue on press-and-hold, uneven animation speed. History -> plain list like Stats (Marcus chose; spec + plan updated); Log cards symmetric; `SwipeRow`; `motion` tokens; no spinner on refocus; hidden pages skip reloads. `db5923c` + docs. Shipped OTA run 42966234484 (`70393b1`). |
| 42 | Backfill + hang fix + rotation + audit (Claude.ai project cloud session) | Nov 11 morning | Backfill by hand (9/26 + 10/31 scores-only, 10/17 frames; 43 sessions / 134 games). Game-over hang in Log Frames: first theory (header capsule, `89957d8`) wrong; root cause SDK 58 `usePreventRemove` needs `repeat()` -> `97de587`, verified. Rotation unlocked (`1ea0f6c`); cover-landscape Log Frames + season-based Week (`4d4ec3b`, `1ab5e24`). Targeted 4-agent audit + verifier -> `docs/PHASE28-AUDIT.md` (`7d9c0f3`); Marcus agreed the triage; fixes deferred to the next chat. Watermark idea nixed. REV26. |
| 43 | Pre-league fix batch + ship (Claude.ai project cloud session) | Nov 11 midday | M2 (anchor removed + focus-gated Live), S17 (ScalePressable wraps children), S18 (Submit guard + N20), S19 (stale form date/week + settings refresh; picked dates never moved; 12h floor), S20 (Modal orientations). Reviewer PASS WITH WARNINGS -> 3 fixed. `master` @ `20bfa97`; first OTA failed upstream (Babel 7.29.14 gap) -> `eas_before` escape hatch in `ota.yml` (`c20bc8c`) -> OTA run 43091822546 (update group ee0882ee). REV27. Device checks + Fri go/no-go next. |
| 44 | Fable re-audit + after-league plan (Claude.ai project: Opus + Fable) | Nov 14 (league day) | Blind read-only re-audit on Claude Fable (`docs/AUDIT-FABLE-NOV14.md`): 1 new MUST (F1 backup overwrite), new SHOULD F5-F7, NICE F11-F14; re-found S21/S22/S24/N17/N28. Opus review: F1 confirmed; Fable's subset guard rejected (blocks backups after a delete) -> copy-then-overwrite; new F15 (writeBackup writes default settings/reference/balls on a failed read). After-league order rebuilt into Parts A-E; Marcus approved. Docs only, no app code. REV28. |
| 45 | After-league batch A-D (Claude.ai project cloud session, Opus) | Nov 17 | Parts A (S21, S22, F1, F3-F6, F12, F13, F15, Restore from File, Backups/ copies, first-launch restore), B (S24 mid-game save + N17 tokens), C (rollback workflow), D (Reference trim, S23, F7, F11, N18, N25, N26) on `after-league`. 3 reviewer passes, CI green. Not shipped (cert expired; waiting on "ship it"). REV29. |
| 46 | Planning + Phase 29 (Claude.ai project cloud session, Opus) | Nov 20-21 | Nov 20 brainstorm of next features (constraints: just Marcus, no social/iCloud/widgets/cost) -> Phase 30 plan doc. Marcus picked Path to 190 + Spare leak for now. Built on `phase29-goal-spares` (`c3db9ac`, `f4918cd`, `02db869`), 2 reviewer passes, CI green. "ship it" -> `master` @ `02db869`, OTA run 44958332762, update group e7cd0dff. REV30. |
| 47 | Phase 30A + sensor research (Claude.ai project cloud session, Opus) | Nov 22-23 | Bowling sensor research (F5/Storm $199 + $99/yr membership; Witsee $319, CSV export on Premium; BowlSense Pro $199.99 no subscription; Ruby) -- Marcus passed. Marcus valued Path to 190 + Spare leak -> asked for more of that kind: 190 recipe, Leave -> fix, Tilt cost on `phase30a-insights` (`e4878dd`, `3335939`, `492209a`), 2 reviewer passes, CI green. "ship it" -> `master` @ `492209a`, OTA run 45277551319, update group 814db029. REV31. |

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
