# mBowl -- Session Brief REV28
**Full spec lives in:** mBowl-SPEC.md -- read it before writing any code.
**Duo roadmap + locked design spec:** `docs/mBowl-DuoPlan.md` (v1.8). **Phase 28 build spec:** `docs/mBowl-Phase28-BuildSpec.md` (all WPs built).
**Audit sources (read both before building anything below):**
- `docs/PHASE28-AUDIT.md` (Nov 11, 4 agents + verifier) -- the M / S / N IDs. Claude.ai project copy: `claude/mBowl-Audit-Nov11.md`.
- `docs/AUDIT-FABLE-NOV14.md` (Nov 14, independent blind re-audit on Claude Fable) -- the F IDs, file:line refs and failure scenarios. Project copy: `claude/mBowl-Audit-Fable-Nov14.md`.
**Last updated:** November 15, 2026, ~07:40 (Sun -- league + makeup done; batch not started)

---

## START HERE (Nov 14, 2026)

**One-line status:** app code unchanged since `20bfa97` (the pre-league batch). Marcus bowls league Week 10 on the **Duo** tonight (his call, Nov 14 ~11:00). Nov 14 midday: an independent read-only re-audit on Claude Fable (`master` @ `de0bb94`, app code = `20bfa97`) found 0 new blockers for tonight, independently re-found S21, S22, S24, N17, N28, and added 1 new MUST (F1, backup overwrite) + new SHOULD/NICE items. **The after-league order below is REBUILT (Nov 14, Marcus approved)** -- it replaces REV27 -> NEXT step 5.

**Nov 15 update:** Week 10 and the 11/7 makeup both logged on the Duo with no problems. Marcus is holding the batch until he has dedicated time -- nothing below has started; the Export Backup gate is still open. If Fable is no longer on his plan by then, Opus runs every Part (the reviewer agent still checks each one). Design defaults in Part B and A5 stand unless he changes them.

**Marcus's plan for the next session:** one session that runs through **every** after-league edit in order (Parts A -> E below). The brief is written so a fresh chat can start at "Before you build" and go. Stop at a ship point if the session runs long -- never ship half a Part.

**Where things are:**
- **Repo:** `github.com/Pipsqueak315/mBowl`, `master` @ docs commits on top of `20bfa97` (app code) / `c20bc8c` (OTA workflow). CI green. OTAs from `master` reach only 2.0.0 builds (the Duo). Merged branches safe to delete: `fix/pre-league`, `fix/logframes-done`, `fix/allow-rotation`, `fix/landscape-logframes`, `phase26`, `phase26a`, `phase27`, `phase28`, `verify-expo-token`.
- **v2 binary:** `mBowl-2.0.0.ipa`, GitHub Release `v2.0.0`, on the Duo via iloader. Next cert refresh: 7 days from the last iloader install (Nov 10 -> due ~Nov 17).
- **Data on the Duo:** 43 sessions / 134 games before Nov 14 (Oct 10 backup + backfill 9/26, 10/17, 10/31), **plus (Nov 14-15, Marcus: "everything worked well") the 11/7 makeup (type Makeup) and 11/14 Week 10 (League)** = expected **~45 sessions / ~140 games** (if both were 3 games). **Not entered by design:** 10/3, 10/24 (took average).
- **Old phone:** 1.0.0, untouched, NOT backfilled. **Retire it:** Week 10 + the makeup both ran clean on v2 (Nov 15), which was the condition. Keep it until the post-league Export Backup is verified, then it can be wiped.
- **Pre-league device checks (REV27 step 2) / go/no-go:** not recorded. Marcus chose the Duo for tonight. If anything misbehaved tonight, it goes into Part A's device checks.

---

## Before you build (next session -- do these first, in order)

1. **Marcus (phone):** Settings -> **Export Backup** -> iCloud Drive -> mBowl Backups. **Nothing in Parts A-B starts until a post-league backup is off the phone.** (Hard gate -- Level 2.)
2. **Claude:** `npm run backup-check -- <that file>` (or read it in the cloud) -> expect **45 sessions / 140 games** (43 / 134 + the 11/7 makeup + 11/14 Week 10, 3 games each) -- confirm the game counts with Marcus. Record the numbers here. If they don't match, stop and find out why before touching code.
3. **Claude:** read `docs/PHASE28-AUDIT.md` and `docs/AUDIT-FABLE-NOV14.md`, then re-open each file named below before editing it (line numbers in the audits are from `20bfa97`).
4. **Branch:** `after-league` from `master`. One commit per item ID. Push after each Part (CI = the type check in cloud sessions). `reviewer` agent at the end of each Part, fix its blockers, then the Part's device checks, then Marcus says "ship it" -> fast-forward `master` -> OTA.
5. **Model note (Nov 14):** Marcus has Claude Fable on his plan through about Nov 16-17. If it's available, use it for Part A and Part B (Level 2 / design-heavy). Opus is fine for Parts C-E.

---

## NEXT -- the after-league batch, in order (Nov 14, Marcus approved)

**Why this order (Nov 14):** S24 (game in progress lost on an app kill) is the likeliest loss on a league night, but S21 / S22 / F1 / F5 can destroy history that already exists, and the 26A.7 rollback is unsafe until F1 is fixed. So: protect existing data first (A), then the in-progress game (B), then rollback (C), then the Level 1 work (D, E).

### Part A -- Data safety pass (Level 2, write paths) -> SHIP POINT 1

One pass over every writer and the backup file. Rule for every writer after this Part: **fresh read with status -> refuse on `invalid` / `error` -> apply the change to the fresh value -> write outside any `setState` updater -> report failure to the user.**

| # | ID | What to build | Files |
|---|---|---|---|
| A1 | **S22 / F3** | `write()` in `src/storage.ts` returns `{ ok: boolean }` (or throws -- pick one, use it everywhere). `writeSessions` / `writeBalls` return ok only if BOTH primary and shadow wrote (F3 addition: a half-failed pair is a failure). Every caller checks it. **Submit:** on failure keep the draft, alert "Couldn't save -- your session is still in the form." No haptic, no navigate. | `src/storage.ts`, `components/pages/LogPage.tsx` (~653) |
| A2 | **S21 / F4 / F10** | History delete + edit Save: fresh `readSessionsResult()`, refuse on invalid/error (alert like Log submit), apply to the fresh array, write OUTSIDE the `setSessions` updater (updaters must be pure), then `setSessions(fresh)`. Covers the "Edit Frames return trip read failed -> list `[]` -> Save writes empty store" variant. | `components/pages/HistoryPage.tsx` (~615, 673-696) |
| A3 | **F5** (extends S21) | Add `readSettingsResult()` / `readReferenceResult()` (same `{status, value}` shape). Settings, ball roster and Reference saves: fresh read with status, refuse on invalid/error -- never save defaults + one edit over data that failed to read. Ball roster uses `readBallsResult()`. | `src/storage.ts`, `components/SettingsContent.tsx` (~84-106, 162-173), `app/(tabs)/reference/index.tsx` (~271-299) |
| A4 | **F15** (NEW, Nov 14 review of the Fable audit) | `writeBackup()` guards only the sessions read. `readBalls()` / `readSettings()` / `readReference()` return defaults on a failed or corrupt read, and those defaults are written into `mBowl-backup.json` -- settings and reference have no shadow, so the backup file is their only other copy. Use the *Result readers; if any is invalid/error, skip the whole backup write (same as sessions). | `src/backup.ts` (41-87) |
| A5 | **F1 + F6** (backup history) | **Never destroy a backup file -- keep copies.** Before `writeBackup()` replaces `mBowl-backup.json`: (a) if the existing file holds any session id that is NOT in the live list (a delete, a seeded phone, an imported older export), first copy it to `Backups/mBowl-kept-<YYYY-MM-DD-HHmm>.json`; keep the newest 5 kept copies. (b) Once per calendar day, before the first overwrite of the day, copy the existing file to `Backups/mBowl-daily-<YYYY-MM-DD>.json`; keep the newest 7. Files live in Documents (visible in Files -> On My iPhone -> mBowl -> Backups). **Do NOT use Fable's "refuse unless subset" guard** -- it would freeze the backup after any legitimate delete (the old file then has an id the live list lacks, so every later write is refused). Copy-then-overwrite keeps the protection without that trap. | `src/backup.ts` |
| A6 | **F1 (scenarios A + C)** | Seeding: when `seeded !== 'true'` and sessions read `missing`, first look at `mBowl-backup.json` (then the newest `Backups/` copy). If one holds a valid non-empty session list, **restore from it instead of seeding** (shape-checked, same as `restoreBackup`, shadows included). Seeds only on a phone with no backup anywhere. | `app/_layout.tsx` (49-64), `src/backup.ts` |
| A7 | **F1 (scenario B) + "Restore from file..."** | Settings -> **Restore from file...** using `expo-document-picker` (already in the 2.0.0 binary -> OTA-safe): pick any `.json` (iCloud Drive -> mBowl Backups, or a `Backups/` copy), run the same shape checks as `restoreBackup`, show "This file: N sessions / N games, exported <date>. Replace what's on the phone?" before writing. Existing Restore stays. This replaces "copy a file into Files, then Restore" -- the path the launch backup can silently overwrite. | `src/backup.ts`, `components/SettingsContent.tsx` |
| A8 | **S21 (Restore reload)** | After any successful Restore (both kinds): reload every page's data (a `notifySessionsChanged()` / data-changed notifier, shared with S23 in Part D) instead of relying on "Restart the app". Keep the alert text until this is verified on the device. | `components/SettingsContent.tsx`, `src/v2/` notifier |
| A9 | **F12, F13** | Messages only: F12 Submit "relaunch and try again" -> say Restore is the way out when both keys are unreadable; F13 partial-restore failure -> say some data may be partly restored, export again before retrying. | `LogPage.tsx` (~637-642), `src/backup.ts` (~169-176) |

**Part A device checks (Marcus, Duo):**
1. Log a practice session, Submit -> appears in History + Stats. Delete it -> `Backups/` in Files now has a `mBowl-kept-...` copy that includes it.
2. History -> Edit a session -> Save; Edit Frames -> Done -> Save; ✕ -> Cancel.
3. Settings: change Target Average, close, reopen -> saved. Add + remove a test ball.
4. Restore from file... -> pick tonight's export -> confirm counts shown -> Restore -> History/Stats update without a relaunch -> counts match.
5. Files -> On My iPhone -> mBowl -> Backups exists with a daily copy.
6. `npm run backup-check` on a fresh export -> same counts as "Before you build" step 2.

### Part B -- Mid-game save for Log Frames (Level 2) -> SHIP POINT 2

**ID:** S24 / F2 (= D5, no longer "accepted"). Plus **N17 / F9** (tag `FRAME_RESULT` with its source + try/catch the parse) because it touches the same hand-off.

**Design defaults (Nov 14 -- Marcus can veto at the start of the session; otherwise build these):**
- **Where it lives:** a new transient key `KEYS.FRAMES_IN_PROGRESS` = `'mbowl_frames_in_progress'` (same class as `FRAME_RESULT`: transient, never backed up, not one of the 5 data keys). Not inside the draft -- Log Frames writing the draft would race LogPage's 400 ms debounced draft writer.
- **Payload:** `{ source: 'log', gameIndex, frames, updatedAt }`. Scope = **Log only** (the league-night path). History -> Edit Frames is not covered (rebuilt from the scorecard if lost).
- **Write:** on every frame change in Log Frames (small payload; no debounce, or ≤150 ms). **Clear** on Done (after `FRAME_RESULT` is written) and on Discard.
- **Resume:** Log Frames opened for the same `gameIndex` with a saved in-progress entry -> load those frames (they win over the route's `initialFrames` only if `updatedAt` is newer than the draft). On a cold launch: after the normal "Resume Session?" -> Resume, if an in-progress entry exists for that draft, open Log Frames for that game automatically (reuse the Live game request path in `src/v2/liveGame.ts`, so LogPage still owns the game list). Discard on the Resume prompt also clears the in-progress key.
- **N17:** `FRAME_RESULT` gets `source: 'log' | 'history'`; LogPage only consumes `source === 'log'`, HistoryPage only `'history'`; a parse failure removes the key instead of throwing.
- Files: `src/storage.ts` (KEYS), `app/log-frames.tsx` (~512, 680-750), `components/pages/LogPage.tsx` (~413-455, 537-563, 693-711), `components/pages/HistoryPage.tsx` (~628-660), `src/v2/liveGame.ts`. Update CLAUDE.md's Storage Keys table.

**Part B device checks:** (1) start a practice draft, Game 1 in Log Frames, enter 5 frames, swipe mBowl closed from the app switcher, reopen -> Resume -> Log Frames reopens on Game 1 with 5 frames -> finish -> Done -> score lands in the draft. (2) Same, but Discard on the Resume prompt -> no leftover frames next time. (3) Normal Done / swipe-back Discard / Keep Editing still work (the Nov 11 hang paths -- every exit path once). (4) History -> Edit Frames -> Done still updates the right session. Delete the practice session.

### Part C -- Rollback (26A.7) + dry run (26A.8)

Safe now that A5/A6 exist. Write + test a way to put the previous OTA back without a new build: document the `eas update:republish` (or equivalent) command for the previous update group, add it to `docs/` + `.claude/skills/ship` notes, and do one dry run Marcus can watch (republish the current group = no visible change). Today's undo = revert on `master` + a new OTA, which stays the fallback. On this OTA, try the normal eas-cli install first (`eas_before` only for an upstream break).

### Part D -- Level 1 batch (presentation / display only) -> SHIP POINT 3

| # | ID | What | Files |
|---|---|---|---|
| D1 | **Reference trim** (scope locked Nov 11, unchanged) | Remove Position + Patterns sub-tabs; Signals keeps Switch Guide (drop the "Switch to" ball field) + Lane Reads, remove the Ball Arsenal view; keep Pocket Diagnostics + Mental. 3 sub-tabs, default Signals. **Hide, don't delete:** `mbowl_reference_v1` keeps its full shape (position, patterns, `switchGuide[].switchTo`, arsenal round-trip through `mergeWithDefaults`). Update CLAUDE.md + SPEC locked decision "Reference sub-tabs: 5" -> 3. | `app/(tabs)/reference/index.tsx`, `components/SignalsTab.tsx` |
| D2 | **S23** | Open-screen Stats refreshes after a History edit/delete/restore -- subscribe to the A8 notifier. | `components/pages/StatsPage.tsx` (~661-695) |
| D3 | **F7** | A draft whose only content is the opponent (no scores, no frames) and whose date the APP set: treat like an empty form for S19's date/week refresh. A picked or resumed date is still never moved. | `LogPage.tsx` (~364, 542-544) |
| D4 | **F11** | Edit sheet: changing a score on a game that has frames -> same confirm the Log form uses ("This will clear the frames for this game") before saving. | `components/EditSessionModal.tsx` (~474-481), see `LogPage.tsx` 163-175 |
| D5 | **F14** | Settings goal fields save on change (or on sheet close), not only on blur -- verify first on the device: type a target average, tap Done with the keyboard up, reopen. Fix only if it fails. | `components/SettingsContent.tsx` (~497-521) |
| D6 | **NICE N16, N18, N19, N21-N27** | As listed in `docs/PHASE28-AUDIT.md`. N18 (⌫ pin data slice) and N19 (Done hidden after re-entering a frame) first -- they touch Log Frames input. N26 `KEYS` `as const`. N27 History filter reset rules. | per audit |
| D7 | **N28 / F8** | Backup file write: write to a temp file then move (atomic). Other N28 crumbs. | `src/backup.ts` |
| D8 | **N1, N9, N13** + PocketDiagnostics split-leave colors | Share spinner; pin-row layout in one place; SPLIT badge squeeze; split leaves use `leaveConversionColor(pct, isSplit)` like Stats. | per REV27 Deferred |

**Part D device checks:** Reference shows 3 sub-tabs and a Lane Reads edit saves; Stats on the open screen updates after a History delete; a practice game with a ⌫ in Pins mode; Edit sheet score change on a framed game asks first.

### Part E -- 28.5 Reference + Settings v2 restyle -> SHIP POINT 4 (own OTA)

After D1 (only 3 sub-tabs left): Reference sub-tab bar -> `SegmentedControl` (fixes the last horizontal-ScrollView control); Reference + Settings move to the v2 look (type on black, hairlines, `HeaderIconButton`, max text width on the open screen). Look rules from the Phase 28 section below apply. **Needs Marcus's screenshots** before ship -- build it, OTA only after he's seen it.

### Parked (not in this batch)
- Per-ball motion notes on the Settings ball roster (changes saved ball data -> Level 2, its own item).
- Bring back the Log Frames header Done capsule only if Marcus misses it.
- ~~Retire the old phone after one good league night on v2~~ (condition met Nov 15 -- wipe after the backup check); delete the merged branches.
- ~~Data: log the 11/7 makeup~~ -- logged Nov 14-15 on the Duo.

---

## Hard rules (unchanged from REV27)

- OTA only from `master`, only via `ota.yml` (GitHub Actions, manual dispatch) or `npm run ship:ota`, only after CI is green and Marcus says "ship it". Confirm `master` moved to the intended commit before dispatching.
- **OTA escape hatch:** if the OTA run fails in `expo/expo-github-action` installing eas-cli (upstream, not our code), re-dispatch with `eas_before` = an ISO time when the last OTA worked: `env -u GH_TOKEN gh api -X POST repos/Pipsqueak315/mBowl/actions/workflows/ota.yml/dispatches -f ref=master -f 'inputs[message]=...' -f 'inputs[eas_before]=2026-11-11T16:00:00Z'`. Try the normal install first.
- **Level 2** (Parts A, B): fresh backup off the phone first, audit the files before editing, `reviewer` pass, device checks, never rushed. Level 1 (D, E): no change to scoring, stats math, storage keys or saved data.
- Every control must feel native: >= 44pt touch target, never inside a horizontal ScrollView.
- **SDK 58 rule:** check the vendored source (`expo/expo` branch `sdk-58`, `packages/expo-router/src/react-navigation/...`), not React Navigation's docs. `usePreventRemove`: continue with `repeat()` -- **never** `navigation.dispatch(data.action)`.
- **Every exit/guard path gets one on-device run before it counts as done.**
- Until A8 ships: after Settings -> Restore, **relaunch the app before touching anything**.

**Who does what:**

| Who | Can do | Can't do |
|---|---|---|
| **Claude (Claude.ai project session, cloud)** | `add_repo` the GitHub repo (push access) -> clone, branch, commit, push; read CI and dispatch `ota.yml` with `gh api` (**`env -u GH_TOKEN gh api ...`**); update project docs; run the `reviewer` agent; read backups; sparse-clone library sources from GitHub (e.g. `expo/expo` branch `sdk-58`). | `npm install` (no package network) -- so no local `tsc`: **CI is the type check** (~2 min per push). The PC link (device_bash) cannot reach GitHub. |
| **Claude Code on the PC** | Everything above plus npm installs, local `tsc`, `npm run ship:ota`. **The PC repo is stale** (last on `phase27` @ `6d54a31`): `git fetch`, then `git checkout master`, then `git pull` (one PowerShell command at a time). | iloader, the Mac, looking at the phone. |
| **The Mac (no Claude Code there)** | `scripts/mac-build.sh` -- only for the next native rebuild. Console app + Duo by cable = live device logs. | Anything else. |
| **Marcus only** | iloader installs + 7-day cert refreshes, checking screens on the Duo, Export Backup, "ship it", Xcode signing/Archive clicks. | -- |

---

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
| **Audit Nov 11 + Nov 14** | ~~Pre-league batch M2, S17-S20~~ (shipped `20bfa97`). Everything else -> REV28 NEXT Parts A-E (S21-S24, F1-F15, NICE N16-N28). |
| ~~Backfill~~ | Done Nov 11 on the Duo (9/26, 10/17, 10/31). 10/3 + 10/24 took averages (not entered); 11/7 makeup pending. |

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
