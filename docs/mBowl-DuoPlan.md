# mBowl — iPhone Duo Plan
**Stamped:** October 23, 2026 · **Updated:** November 11, 2026 (~12:00) · **Version:** v1.8 (Nov 10 night: v2 on the Duo with the real data; `phase27` merged; Phase 28 WP1-WP7 built and shipped over the air · Nov 11: hang fix, rotation, audit + pre-league fix batch shipped) · **Owner:** Marcus
**Read with:** the latest `mBowl-SessionBrief-REVXX.md` and `mBowl-SPEC.md`. This plan covers the next four phases; the brief still tracks session-by-session state.

---

## Where things stand (Nov 10, ~20:45)

- **Backup done and verified.** Oct 10 export: 40 sessions, 125 games, 174.1 average (Winners 25: 24 · Jubilee 26: 13 · Winners 26: 3). Missing Winners 2026 weeks (Sep 26, Oct 3, Oct 17 onward): backfill later from scorecards.
- **Phase 25 done:** v2.0.0 installed on the Duo (iloader; Developer Mode had to be turned on) and the backup restored -- 40 sessions confirmed, swipe rows work.
- **Phase 26 + 26A + 27 merged into `master`** -- `master` is 2.0.0 / SDK 58. OTAs from it reach only the Duo; the old phone stays on 1.0.0 as the fallback.
- **Phase 28 WP1-WP7 built and shipped over the air** (`master` @ `44af9ee`), after a Duo screen check (findings F1-F6, Claude.ai project doc `mBowl-DuoScreenCheck-Nov10.md`) and an independent reviewer pass. **Next: Marcus checks it on the Duo, fixes ship over the air, Fri 8pm go/no-go. Step-by-step: REV25 → NEXT.**
- **Nov 11:** backfill done on the Duo (43 sessions / 134 games); Log Frames game-over hang fixed (`97de587`); rotation unlocked; targeted post-SDK 58 audit (`docs/PHASE28-AUDIT.md`); **pre-league fix batch M2, S17-S20 shipped** (`master` @ `20bfa97`, OTA run 43091822546). **Next: Marcus's device checks, Fri 8pm go/no-go. Step-by-step: REV27 → NEXT.**
- **Next league night: Sat, Nov 14.**

---

## Backlog decisions (October 23, 2026)

| Item | Decision | What it means for you |
|---|---|---|
| Session export | **Keep — no longer blocking** | A one-tap Settings button for the backup file. The Files app already reaches the file (Step 0), so this is a convenience now. Moves to Phase 26. |
| N15 split conversion color | **Keep** | The Leaves list stops showing a missed split in the same red as a missed single pin. |
| N4 FRAME_RESULT_KEY | **Keep** | Invisible plumbing fix. Keeps the "no raw storage keys" rule honest. |
| Swipe-back confirm | **Keep** | Swiping back out of Log Frames asks before throwing away unsaved frames. |
| NICE sweep (N1–N14) | **Keep — triage** | Claude Code lists all 14 with a one-line take; you keep or cut each. |
| Splash screen icon | **Keep — rides Phase 27** | The launch screen shows the current icon instead of the old one. |
| iPhone Duo support | **Keep — this plan** | Works properly on the cover screen; the open screen shows two pages side by side (Log \| Stats, Stats \| History). |
| v2 visual refresh | **Keep — Phase 28** | Cleaner, Apple-style look across the app (see Design spec). |
| iCloud sync | Cut | Export covers the need; likely blocked on a free cert anyway. |
| Practice type removal | Cut | Practice stays as a session type. |
| H+I redesign (pin heat rack, open rate by frame, Log Frames rework) | Cut | Stats stays as it is. |
| Home screen widget | Cut | Too heavy and fragile on a free cert. |
| App icon refinement | Cut | Current icon stays. |
| Paid Apple Developer account ($99/yr) | **Declined (Nov 3)** | Staying on a free Apple ID. Sideloading, weekly certificate refreshes, and installing native builds stay manual for good. See "What stays manual". |
| Automation setup | **Keep — Phase 26A** | The ask → decide → Claude builds → ships to your phone loop. See "How we work". |

---

## The plan at a glance

| Phase | What you get | Ships via | Needed for league? |
|---|---|---|---|
| **Step 0 — Back up the old phone** | Two safe copies of all your data, off the phone | Files app | **Yes, do first** |
| **25 — Move to the Duo** | App and all data running on the Duo | Sideload + Files app | **Yes** |
| **26 — Cleanup + screen-size proofing** | Finish Phase 24, the three fixes, the Export button, NICE items, layouts that adapt to screen size | OTA | **Yes** |
| **26A — Automation setup** | The new working model: automatic checks, saved routines, automatic updates to your phone | Repo + GitHub setup | No (first thing after league) |
| **27 — iOS 27 upgrade** | App rebuilt for iOS 27 so it can fill the inner screen; splash fix; batched native add-ons (27.0) | Native build on the Mac | No |
| **28 — Inner-screen layout** | Log, Stats, and History designed for the inner screen | OTA | No |

Phases 25 and 26 make the Duo league-ready. Phase 26A comes next: it changes how we build, and its automatic checks make the risky Phase 27 upgrade safer. Phases 27 and 28 are the Duo upgrade itself. If they slip past league night, nothing breaks: the app runs on the Duo as-is (letterboxed on the inner screen), and the old phone is still there.

---

## Ground rules

1. **Copy the backup file off the phone before any install.** Every time a new build goes on a phone, take a fresh copy first.
1a. **Don't touch mBowl on the old phone.** Don't delete it, don't reinstall it, don't sign out of the Apple ID, and keep its certificate refreshed until it's retired. If the certificate lapses the app won't open, but the data stays.
2. **One phone logs.** After migration day, log only on the Duo. The old phone becomes a read-only backup. Data does not sync between the two phones.
3. **League freeze.** No new native build gets installed in the 3 days before league night. OTA fixes are allowed only if verified. **Exception, week of Nov 10 (Marcus):** waived for the Duo only, for the v2 sprint, because the old phone stays an untouched fallback on 1.0.0 (nothing published to that runtime this week). Go/no-go Friday 8pm — see REV24 SPRINT.
4. **Keep the old phone installed** until Phase 28 is done and you've bowled one league night on the Duo.
5. **OTA boundary unchanged.** Pure JS ships via `eas update --branch production`. Native changes happen in Phase 27 only.
6. **End-of-phase protocol, every phase:** TSC clean → commit and push → bump the session brief REV → update the CLAUDE.md pointer → upload the brief to Claude.ai Knowledge. Once Phase 26A is done, `/ship` runs this, and Claude handles the Knowledge upload.
7. **Windows rules (on the PC only):** file writes via a JS file + `node`, never python or bash heredoc. One PowerShell command at a time, no `&&`. Multi-line commits via `git commit -F <file>`. After Phase 26A a hook enforces these. Cloud sessions run Linux and aren't affected.

---

## How we work (the target model, live after Phase 26A)

### The loop for every feature
| # | Step | Who | What happens |
|---|---|---|---|
| 1 | **Ask** | You | Describe the feature in chat, from your phone or PC. A rough idea is fine. |
| 2 | **Brief** | Claude | Pros, cons, effort, OTA or native, whether it touches stored data, and a recommendation. Same format every time (the `/feature` routine). |
| 3 | **Decide** | You | Go, change it, or park it. The decision gets written into the brief. |
| 4 | **Build** | Claude | Works on its own branch. Checks run on every edit. A separate reviewer agent checks the change against the project rules before it's called done. |
| 5 | **Review** | You | A plain-English summary of what changed. You approve with one tap in the GitHub app. |
| 6 | **Ship** | Automatic | Approving runs the checks on GitHub. If they pass, the update goes to your phone. If any check fails, nothing ships. |
| 7 | **Check** | You | Open the app and look, about 2 minutes. If it's wrong, Claude rolls the update back. |
| 8 | **Record** | Claude | Updates the session brief and CLAUDE.md, and uploads the brief to this project. |

While you're learning, step 5 stays a manual tap. Once you trust the loop, you can switch small changes to ship on "go" alone.

### Risk levels (how careful each change is)
- **Level 1: normal changes.** UI, layout, wording, new stats calculated at read time. Uses the full loop above, with no extra gates.
- **Level 2: anything touching stored data.** Saving, backup and restore, scoring, the storage keys, migrations. Adds three gates:
  - a read-only audit before building
  - a fresh backup copy taken off the phone
  - your explicit "ship it" (never automatic)
- **Level 3: native changes.** New native modules, Expo SDK upgrades, `app.json` native fields. These go through a planned build day (see below), never automatic.

### Where Claude works
- **Claude in this project (Claude.ai):**
  - planning, briefs, design, and updating the docs in this project
  - working in the mBowl folder on your PC while it's linked (it can edit files there but can't push to GitHub from that link)
  - pushing branches from a cloud session once GitHub access is approved in 26A.1
- **Claude Code on your PC:** heavy builds, multi-agent audits, anything that needs your machine (iloader, the Expo CLI login).
- **GitHub Actions:** runs the checks and sends updates to your phone. No Claude involved, and it runs the same way every time.

### What stays manual (free Apple ID, accepted Nov 3)
- **Refreshing the certificate every 7 days on each phone with iloader.** The in-app reminder stays.
- **Installing any new native build with iloader.** Only needed in Level 3 phases.
- **Building native builds on the Mac** (decided Nov 10: you want to learn the process, so no Expo cloud build). Claude Code on the Mac walks you through it and updates REBUILD.md as you go.
- **Looking at the app on your phone.** Claude can't see your screen.
- **Moving data between phones** with the Files app and Restore.

---

## How the backup works (checked in the code, Nov 1)

- The app keeps a full copy of everything in one file, `mBowl-backup.json`: sessions, balls, settings, and Reference.
- The file lives in the app's own folder, which shows in the **Files app → On My iPhone → mBowl**. File sharing (`UIFileSharingEnabled` and `LSSupportsOpeningDocumentsInPlace`) has been in `app.json` since March, so the current build includes it. REV22's line that the file is "trapped in the sandbox" was wrong.
- **Settings → Restore from Backup** reads that same file from that same folder.
- **The trap:** every time the app cold-starts, it rewrites the backup file with whatever data the app currently holds (`_layout.tsx` → `writeBackup()`). On a fresh install, that data is the 18 sample sessions. A backup file copied into the Duo's mBowl folder gets overwritten the next time the app is closed and reopened, so **restore before the app is ever closed.**

---

## Step 0 — Back up the old phone ✅ Done (Oct 10 export, verified Nov 10)

**Goal:** two safe copies of your data, off the old phone, before anything else happens.

1. **Check the certificate on the old phone.** Open SideStore. If it has fewer than 3 days left, refresh with iloader.
2. **Refresh the backup file.** Open mBowl, swipe it fully closed, and open it again. The cold start rewrites the backup with everything current.
3. **Write down the check numbers.** Go to Stats, choose All-Time (or the season selector) with the All filter, and screenshot it. You want: sessions, games, average, high game, high series.
4. **Copy the file off the phone.** Open Files → On My iPhone → mBowl. Long-press `mBowl-backup.json`, then:
   - **Copy 1 (iCloud Drive):** Share → Save to Files → iCloud Drive → a folder named `mBowl Backups`. Rename the file `mBowl-backup-2026-11-01.json`.
   - **Copy 2 (PC):** email it to yourself or save it to OneDrive, then put it in `Desktop\mBowl-backups\` on the PC. Keep it out of the repo.
5. **Have Claude check the PC copy.** It reads the file and confirms the counts match your screenshot. This also unblocks Phase 24 Part 5, the season count check.

**If there is no mBowl folder in the Files app:** stop. Building the Export button becomes the top priority, ahead of everything else.

---

## Phase 25 — Move to the Duo

**Goal:** mBowl running on the Duo with every session, ball, and setting from the old phone.

**25.1 — Install on the Duo (no data risk).**
Pair the Duo in iloader and install the current production build from the GitHub Release. Confirm it launches and shows the 18 sample sessions, and that the inner screen shows the app letterboxed. If sideloading fails on iOS 27, stop here; the plan changes. **Do this by Wednesday, Nov 11** (league freeze for Sat Nov 14).

**25.2 — Move the data, in this exact order.**
1. AirDrop the verified backup (the Oct 10 `mBowl-backup.json`) from the old phone to the Duo. It lands in Files → Downloads.
2. Open mBowl on the Duo and **leave it open**. Don't swipe it closed at any point until step 5 is done.
3. Switch to the Files app. Move the file into **On My iPhone → mBowl** and rename it exactly `mBowl-backup.json`, replacing the one already there.
4. Switch back to mBowl. It should still be open, not restarting. Go to Settings → **Restore from Backup**.
5. Check Stats against your Step 0 screenshot.

If it shows 18 sessions after the restore, the app was reopened and overwrote the file. Repeat from step 2. Your two safe copies are untouched.

**Exit criteria:**
- Duo Stats matches the Step 0 screenshot exactly: session count, game count, average, high game, high series.
- Old phone still installed and untouched.
- From here on, log only on the Duo.

**Risks:**
- SideStore/iloader on iOS 27. Checked first, in 25.1.
- Cert refresh now covers two phones. Each needs its own 7-day refresh until the old phone is retired.

---

## Phase 26 — Cleanup + screen-size proofing

> **Status Nov 10: done and merged to `master`; reaches the Duo inside the v2 binary (never OTA'd to the old phone).** tsc + checks green; reviewer pass with 4 warnings fixed. Details: REV24 → "Phase 26 -- what was built".

**Goal:** the three fixes and NICE items ship, and every screen adapts to whatever size it's given. That fixes the cover screen now and sets up Phase 28.

**26.0 — Finish Phase 24.** ✅ Part 5 passed on the real backup (24/13/3 = 40). Part 6 bands are **goal-based: green = a 190-average level** (decided Nov 10). Part 6b done (High Series 1435 → 620). Run Part 5 (season count check) against the Step 0 backup file, then Part 6 (colors for the seven stat cells) and Part 6b (keep the 8-game tournament out of High Series). Ship Parts 0–6b over the air together, if 0–4 never reached the phone.

**26.0b — Export button.** ✅ Settings → **Export Backup** shares `mBowl-backup.json` through the share sheet (expo-sharing is already installed). This makes Step 0 one tap next time. JSON only for now; a CSV of games stays optional.

**26.0c — Line endings.** ✅ Add a `.gitattributes` so the line-ending-only changes stop showing up as changed files.

**26.1 — N15.** ✅ (splits: green ≥40, orange ≥15, else grey — never red) Split leaves get their own conversion color treatment. `isSplit` stays the single source of truth; no adjacency or denominator changes.

**26.2 — N4.** ✅ Move `FRAME_RESULT_KEY` into the `KEYS` registry.

**26.3 — Swipe-back confirm.** ✅ (and it only asks when frames actually changed) Swiping back out of Log Frames with unsaved frames shows the existing "Discard Frames?" confirm. Reuse the existing confirm; don't build a second one. The cancel boundary from Session B2 must keep working.

**26.4 — NICE triage.** ✅ Decided Nov 10 (all of Claude's takes). Keeps N2, N6, N7, N10, N12, N14 built on `phase26`; N1, N9, N13 → Phase 28; N11 → Phase 27; N5, N8 cut. Claude Code lists N1–N14 from `docs/PHASE20-AUDIT.md`, each with a one-line take. You keep or cut each one. Kept items ship in this drop.

**26.5 — Screen-size proofing.** ✅ in code (compact Log Frames under 760pt tall; fixed share-card width). Needs your eyes on the Duo cover screen — there is no simulator in the cloud.
- No `Dimensions.get` captured once at load time; use `useWindowDimensions`. Chart widths are the usual offender.
- Safe areas via `useSafeAreaInsets` (the Duo's are uneven).
- No hard-coded screen heights.
- The Stats one-screen layout scrolls instead of clipping on the shorter cover screen.

**Exit criteria:**
- Every tab looks right on the Duo's cover screen.
- Log Frames is fully usable on the cover screen.
- TSC clean; OTA verified landing on both phones.
- **League-ready.**

---

## League night

Bowl on the Duo cover screen, or on the old phone if anything is off. Log in Full mode.

---

## Phase 26A — Automation setup (first thing after league)

> **Status Nov 10: merged to `master`; GitHub App installed; `EXPO_TOKEN` added.** `npm run check`, `npm run backup-check`, `npm run ship:ota`, hooks, the four skills, the reviewer agent, `ci.yml` (green), and `ota.yml` (manual-only). Still to do: rollback (26A.7) and the dry run (26A.8) -- the first Phase 28 OTA effectively is the dry run.

**Goal:** turn on the working model in "How we work". It's done in small steps, and each one comes with a short explanation, so you learn what each piece does as it goes in.

**26A.1 — One source of truth.**
- Commit the docs, plus a `.gitattributes` if 26.0c hasn't landed yet.
- Approve GitHub access for Claude's cloud sessions. One prompt, once.
- *You'll learn:* why everything lives in the repo and not in chat.

**26A.2 — One command that checks everything (`npm run check`).**
- Gathers the TypeScript check and the scoring, storage, and season test scripts into `scripts/checks/` and runs them in one go.
- The test scripts from Phases 20–24 weren't all committed, so rebuild any that are missing.
- They run on the 18 sample sessions. Your real backup file stays on your PC, out of GitHub.
- *You'll learn:* what a test harness is, and why it lets Claude work without you watching.

**26A.3 — Hooks (automatic rules in Claude Code, in `.claude/settings.json`).**
- Run the TypeScript check after every edit.
- Block `&&` and heredocs in PowerShell (your Windows rules, now enforced instead of requested).
- Block `eas update` typed by hand, so updates only go out through the checked path.
- *You'll learn:* the difference between a rule Claude tries to follow (CLAUDE.md) and one it can't break (a hook).

**26A.4 — Saved routines (skills in `.claude/skills/`).**
- `/feature`: the pros, cons, and logistics brief, same format every time.
- `/ship`: checks, commit, push, update the brief and CLAUDE.md pointer.
- `/audit`: your multi-agent audit prompt, saved once.
- `/backup-check`: reads a backup file and reports the session and game counts and the averages.
- *You'll learn:* how to save a workflow you'd otherwise retype.

**26A.5 — Reviewer agent (`.claude/agents/`).**
- A read-only agent that checks every change against CLAUDE.md, the locked decisions, and the data-safety rules before anything is called done.
- *You'll learn:* what a subagent is, and why the work shouldn't grade itself.

**26A.6 — GitHub Actions (robots on GitHub).**
- `ci.yml`: every push runs `npm run check`.
- `ota.yml`: approving a change into master runs the checks again, and only if they pass runs `eas update --branch production`.
- You create one Expo access token at expo.dev and add it to GitHub as the `EXPO_TOKEN` secret. Claude walks you through it.
- *You'll learn:* what CI is, and how updates reach your phone without you typing anything.

**26A.7 — Rollback.**
- A written and tested way to put the previous update back on your phone.
- *You'll learn:* how to undo a bad update in under a minute.

**26A.8 — Dry run.**
- Take one small real item (for example N4) through the whole loop.
- You only say "go", tap approve, and check your phone.
- Time it, and fix whatever felt clunky.

**Exit criteria:**
- A change goes from "go" to your phone with your only actions being "go", one approve tap, and the phone check.
- A deliberately broken change gets blocked by the checks and never reaches your phone.
- Rollback tested once.

**What it doesn't change:** cert refreshes, native builds, and installs (see "What stays manual").

---

## Phase 27 — iOS 27 upgrade (native)

> **Status Nov 10 night: built.** SDK 54 -> 58 step by step, native tabs, add-ons M1-M3 + M6, splash, 2.0.0 -- branch `phase27`, CI green. Mac build done a day early (Xcode 27.2, Node 24 via Homebrew `node@24`); `mBowl-2.0.0.ipa` on GitHub Release `v2.0.0`. Left: install on the Duo (27.8), confirm OTA reaches 2.0.0 (27.7), reviewer pass + merge to `master`. Mac rebuild procedure and facts: REV24 → "Mac rebuild procedure".

**Goal:** rebuild the app with the iOS 27 toolchain so it can fill the inner screen. You won't see much yet: the splash fix, and the app filling the inner screen with layouts not tuned yet.

**Build route (decided Nov 10): the Mac.** One Mac trip, learned properly. Because every native change needs a new build — and a new build means a Mac trip — everything native that we might want for the next several months gets batched into this one build (27.0).

**27.0 — Mac trip checklist (decide before the trip).**
**iOS 27 facts (Expo SDK 58 + Duo guides, checked Nov 10):** iPhone apps are resizable and orientation locks are only a preference (`lockAsync` may be refused), so v2 will appear in landscape regardless — layouts must survive it. The Duo's side rail needs an 84pt left/right safe-area inset on every screen. Native tabs moved to `expo-router/native-tabs` (`preferredPlacement`). SDK 58 headers are transparent Liquid Glass by default.

Must-haves (already part of this phase):
- SDK 54 → 58 upgrade, native tabs, splash fix (27.2, 27.4, 27.5).
- App version 1.0.0 → 2.0.0. The update channel is keyed to the app version, so this is what keeps SDK 58 updates off the old phone (27.7).

Add-ons (cheap to add now, each saves a future Mac trip) — **decided Nov 10:**
| # | Add-on | Why | Claude's take |
|---|---|---|---|
| M1 | Allow landscape (`app.json` orientation) + `expo-screen-orientation` | The cover-landscape and open-landscape layouts in the Design spec are impossible while the app is locked to portrait, and that lock is native. The module lets the app keep itself in portrait until Phase 28 layouts are ready, then unlock with an over-the-air update. | ✅ **Yes** |
| M2 | `expo-document-picker` → "Restore from file…" | Pick any backup (iCloud, Downloads, AirDrop) instead of the rename-into-the-mBowl-folder routine. Makes every future phone move and upgrade one tap. The button itself can ship over the air later. | ✅ **Yes** |
| M3 | `expo-keep-awake` in Log Frames | Screen stays on while you log a live game. May already be in the build as part of Expo; add it explicitly so it's guaranteed. | ✅ **Yes** |
| M4 | New app icon | Cut on Oct 23. Icons are native, so this is the last cheap chance until the next Mac trip. | ✅ **No — keep the current icon.** But the splash must show it (27.5). |
| M6 | `@expo/ui` (ArrangementView) | Expo's fold-aware two-pane layout: splits along the fold when open, one column when closed, avoids the fold when half-open. Native, so it must be in this build; the Phase 28 page pairs can then use it over the air instead of hand-written fold math. (Found Nov 10 in Expo's "Supporting iPhone Duo" guide.) | **Recommended — in the Phase 27 prompt; strike it if not wanted** |
| M5 | Fold-state module (open/closed detection) | Phase 28 layouts work off screen width, so it isn't needed. Unfolding mid-game still works without it: iOS hands the app a wider screen, the layout switches to two pages, and the frames you've entered stay put (same as rotating — no restart). The module would only add things like hinge angle or a half-folded "tabletop" mode. The 28.6 fold/unfold test confirms frames survive. | ✅ **Skip** |

Also on this trip: N6 (`prebuild --clean` in REBUILD.md) and N11 (orphaned splash asset) from the NICE list; REBUILD.md rewritten for Xcode 27.1 as you go; the new IPA attached to a GitHub Release so reinstalls never need the Mac.

**Before the trip:** check that the Mac's macOS can run Xcode 27.1 (update macOS first if not — that download is the slow part), and have the Mac signed in to GitHub.

**27.1 — Branch first, and take a fresh copy of the backup file off the Duo.**

**27.2 — Upgrade Expo SDK 54 → 58 (React Native 0.88).**
Best guess: go one SDK at a time (55 → 56 → 57 → 58), with TSC and a smoke test at each step. Confirm the approach against Expo's upgrade guide before starting.

Watch list:
- Scene lifecycle (generated by `prebuild` in SDK 58).
- Orientation lock behavior on iOS 27.
- Expo Router header appearance review.
- expo-file-system (backup and restore).
- Reanimated.
- react-native-chart-kit.
- expo-symbols, expo-blur, expo-haptics.

**27.3 — Regression gate.**
Run `npm run check` (from 26A) at every SDK step. Also run `/backup-check` against a fresh real backup, before and after. Every number must match the pre-upgrade app exactly.

**27.4 — Native tabs (decided Oct 23).**
Move from the custom JS tab bar to native tabs so iOS places the bar the way Apple does: a side column on the cover screen and on the open screen in landscape, floating at the bottom when open in portrait. This also brings the Liquid Glass look. Before building, confirm the Expo Router native-tabs API on SDK 58 supports:
- iOS 27 bar placement on the Duo
- a persistent accessory slot for the Live game button (see Design spec)

If the accessory slot isn't supported, fall back to the button floating above the tab bar.

The target bar placement is in the Design spec ("Native iOS bars"). Two things to confirm on device: the closed-landscape tab bar, and where the Live button sits.

**27.5 — Splash fix.** The splash screen shows the **current app icon** (decided Nov 10: icon stays, splash catches up to it). Clean up the orphaned `splash-icon.png` (N11) at the same time.

**27.6 — Build on the Mac (bare minimum, known-good signing — decided Nov 10).** `scripts/mac-build.sh` does the setup (`npm ci` → `prebuild --clean` + CocoaPods → opens Xcode); Xcode 27.1 signs with the Personal Team and Product → Archive, exactly like previous builds; `scripts/mac-build.sh package` turns the archive into `mBowl-2.0.0.ipa` → iCloud Drive / GitHub Release. Claude Code isn't on the Mac; errors go to Claude in the iOS app, and Claude updates REBUILD.md afterwards. Then install on the Duo with iloader from the PC. (An Expo cloud build was considered and set aside Nov 10 — you want to learn the Mac process. It stays available if the Mac is ever unavailable.)

**27.7 — OTA runtime version.**
The SDK bump changes the OTA runtime. The old phone stays on the old runtime and stops receiving new OTA updates. That's fine; it's the backup. Confirm the Duo build receives OTA updates on the new runtime, and that the automatic update job (`ota.yml`) publishes to it.

**27.8 — Install on the Duo.**
Same bundle ID, so the data stays. Take a fresh backup copy first anyway, then verify the counts match again.

**Exit criteria:**
- Duo running the iOS 27 build, every stat identical, OTA confirmed, splash fixed.
- Installed outside the league freeze window.

---

## Phase 28 — Split pages + v2 visual design (OTA)

> **Status Nov 10 night: WP1-WP7 built and shipped OTA to the Duo** (`44af9ee`); awaiting Marcus's on-device check. 28.5 (Reference + Settings) is after league. What was built and every deviation: REV25 → "Phase 28 -- what was built" and the status table in `docs/mBowl-Phase28-BuildSpec.md`.

**Goal:** the open screen shows two full pages side by side, and the whole app moves to the v2 look. The spec is in the Design spec section below. **Execution plan with every decision locked (Nov 10): `docs/mBowl-Phase28-BuildSpec.md`** — Saturday scope = cover + open screen + Live game button; Reference/Settings after league.

**28.1 — One layout per tab that adapts to its width.** Log, Log Frames, Stats, and History each get one layout that works at any width. A half of the open screen (~372–455pt wide) is about the width of the cover screen (382pt), so the open screen just shows two pages at once. No layouts specific to the inner screen. The one exception is the wide-but-short cover landscape (~560×430pt), which gets the arrangements in "Closed (cover screen) layouts".

**28.2 — Pairing logic.** Which page pairs show on the open screen, plus the Live game button. Rules in the Design spec.

**28.3 — Short-height adjustments.** The open-portrait halves are only ~320pt tall:
- Log uses 44pt game rows, and Add Game moves to the header.
- Log Frames takes over the whole screen (rules below).

**28.4 — v2 visual pass across all tabs.** Rules in the Design spec.

**28.5 — Reference and Settings.** Restyle to v2. Reference uses the full width of the open screen, with a max text width. No structural redesign.

**28.6 — Fold/unfold torture test:**
- Fold and unfold mid-Log Frames entry, mid-draft, and mid-edit modal. No lost state, no draft reset.
- Rotate the inner screen. iOS 27 doesn't honor the app's orientation lock there.

**Exit criteria:**
- The three core tabs feel native unfolded.
- Folding and unfolding never loses data.
- After one league night on the Duo, the old phone can be retired.

---

## Design spec (locked October 23, 2026)

### Layout by screen state
| State | What shows |
|---|---|
| Closed, cover screen, portrait (466×678pt) | One page at a time. Side column on the right: camera and clock at the top, icon-only tabs at the bottom. |
| Closed, cover screen, landscape (678×466pt) | One page at a time. Side column on the left by the camera (status bar hidden). Log Frames puts the pin deck and a 4-column keypad side by side. |
| Open, landscape (951×669pt) | Two pages, split at the fold (fold band at x 455–495). The right page is narrower (~372pt) because the side column takes the right edge: clock at the top, icon-only tabs at the bottom. |
| Open, portrait (669×951pt) | Two pages stacked top and bottom. The tab bar floats at the bottom. |

### Closed (cover screen) layouts (added Nov 3)
The cover screen gets the full v2 look too. It's the screen used most, so it's a first-class layout, not a leftover.
- **Portrait (466×678):**
  - The same single pages as the v2 renders, with the tab column and Live game button on the right.
  - Log Frames keeps the pin deck in the middle, with a 7-column keypad along the bottom.
- **Landscape (678×466), its own arrangements instead of a squashed portrait:**
  - **Log:** session details on the left, Games on the right, and Notes plus Submit across the bottom.
  - **Log Frames:** toolbar with the Live/Post-game and Pins/Quick switches on one row, the scorecard across the screen, then the pin deck on the left and a 4-column keypad filling the right.
  - **Stats:** the average plus high game and high series on the left, Striking and Spares & recovery on the right. The charts are below, reached by scrolling.
  - **History:** the same list, full width.
  - The tab column and Live game button sit on the left, by the camera.
- **Reference renders:** `docs/design/Closed_*`. For bar placement, follow "Native iOS bars" below.

### Native iOS bars (locked Nov 3, checked against Contacts and Phone on the real Duo)
- **Top bar stays at the top.** Trailing buttons (gear, Done) are glass capsules at the top right of each page. Done is the filled teal capsule.
- **Leading button (Cancel ✕ or back) moves into the side column** under the clock on the closed screen (portrait: right side; landscape: camera side). On the open screen it stays top-left.
- **Clock area:** a compact cluster (location, time, signal ring with battery %). On the closed screen the camera cutout sits above it. In closed landscape the status bar is hidden.
- **Tab bar:**
  - **Closed portrait and open landscape:** an icon-only vertical capsule pinned to the **bottom** of the side column (confirmed in Phone).
  - **Open portrait:** a floating labeled bar at the bottom (confirmed in Phone).
  - **Closed landscape:** assumed to mirror portrait on the camera side. Confirm on device.
- **Live game button:** just above the tab bar. This is a best guess, based on where iOS puts the "now playing" bar. Confirm with Apple Music's mini player on device.
- **Log Frames** sits on top of the tabs, so its screens show only ✕ and Done, with no tab bar.
- **Open portrait, two pages stacked:** the top bar's buttons belong to the top page.
- **Cramped check:** passed. The side column holds the camera/clock at the top and Live plus tabs at the bottom, with open space between.
- **Reference renders:** `docs/design/NativeBars-v3_*`.

### Page pairs on the open screen
- **Log tab:** Log | Stats.
- **Log Frames:** replaces the Log half, so Log Frames | Stats.
- **Stats or History tab:** Stats | History.
- **Stats switches sides** between the two pairs. Accepted.
- **Open portrait while scoring:** Log Frames takes the whole screen. Scorecard and pin deck on top, a large keypad on the bottom half. Done returns to Log over Stats.
- **Reference:** one full-width page.

### Live game button
- Shown whenever a session draft is in progress. Reads "Game N · Frame N".
- Sits in the tab column, or floats above the tab bar in open portrait.
- Tapping it opens Log Frames for the active game from anywhere.
- On the open screen it replaces the non-Stats half (Stats | History becomes Stats | Log Frames).
- Its exact spot in the Duo's side column is a best guess. Confirm it in 27.4.

### v2 visual rules (modeled on Apple Sports, Fitness, and Weather)
- **Font:** SF Pro system font, unchanged. No custom fonts; SF Hello was considered and rejected on Oct 23 (license and print-only design). SF Pro Rounded via the system is allowed if wanted later.
- **Fewer boxes:** Stats and History are type on black with thin dividers. History is a plain iOS list (rows edge to edge, hairline separators, opaque highlight on press) so it reads as one design beside Stats on the open screen (Marcus, Nov 10 night -- replaces "History rows boxed"). Boxed (inset-grouped, symmetric) only for the Log form. Rounded cards never run under the rail; only square backgrounds do.
- **Type:**
  - Large page titles (32pt, weight 600).
  - Sentence-case section headers (20pt, weight 600). No tiny all-caps labels.
  - Big numbers at weight 200.
  - Values at weight 300, with digits that line up in columns (tabular figures).
- **Color carries meaning only.** Hero numbers are white. Green, orange, and red are used only for change or threshold signals, such as "↑ 1.4 vs target" or a series dot. Teal is for things you tap and the current selection.
- **Controls:** native iOS segmented controls replace the teal filter pills. Toolbar buttons use Liquid Glass, and Done is the main button (filled teal).
- **History rows:** game scores in secondary gray, series in white with a small colored dot for its threshold band. *This replaces the per-game red/orange/green colors from the spec.* Approved Oct 23.
- **Pin deck:** standing pins solid white, knocked-down pins as faint rings. *The standing-pin color changes from teal to white* (one line in the shared frame-grid component). Approved Oct 23.
- **Scorecard:** box-score grid with thin dividers. The current frame gets a subtle teal column.
- **Charts:** a thin teal line with a soft area fill, the latest value labeled, and minimal axis labels. The histogram highlights its tallest bar in teal, with the other bars gray.
- **Unchanged:** dark mode only, the teal #00CEC9 accent, SF Symbols, haptics, the press animation on buttons.

### Reference renders (saved in `docs/design/`)
| Set | What it shows | Status |
|---|---|---|
| `NativeBars-v3_*` (8) | **The target.** Final look with real iOS bar placement, every screen state | Current |
| `Closed_*` (8) | Closed screen, portrait and landscape, every tab (bars drawn before the native check) | Layouts current; bars superseded by NativeBars-v3 |
| `v2_*` (5) | The v2 visual style, first version | Look current; bars superseded |
| `SplitPages_*` (14) | Page pairing on the open screen, older visual style | Arrangement current; look superseded |

The mockups use Inter as a stand-in for SF Pro, with sample numbers. **Build to the spec text above. Where a render and the text disagree, the text wins.**

---

## Open questions

| # | Question | Decide at |
|---|---|---|
| 1 | ~~Inner-screen layout~~ **Resolved Oct 23:** split pages (see Design spec) | — |
| 2 | ~~Export format~~ **Resolved Nov 10:** JSON only for now; CSV optional later | — |
| 3 | ~~Tab bar~~ **Resolved Oct 23:** native tabs, to match Apple | — |
| 4 | ~~Big-number font~~ **Resolved Nov 10:** SF Pro (not Rounded) | — |

---

## Timeline

**v2 sprint (decided Nov 10).** Full schedule, prompts, and the go/no-go checklist: REV24 → SPRINT.

| When | Work |
|---|---|
| Tue Nov 10 | ✅ Backup verified; Phase 26 + 26A merged; Phase 27 built; ✅ Mac build -> GitHub Release v2.0.0; ✅ **Duo install + restore (40 sessions)**; ✅ screen check; ✅ `phase27` merged; ✅ **Phase 28 WP1-WP7 built + shipped OTA** (two days early). |
| Wed–Fri Nov 11–13 | ✅ Nov 11: backfill, hang fix, rotation, audit, **pre-league fix batch shipped** (`20bfa97`). Marcus checks on the Duo; Fri 8pm go/no-go. |
| Sat Nov 14 | League on the Duo (v2) or the old phone (fallback). |
| After league | Full ordered list: REV27 → NEXT step 5. Audit Level 2 items S21 + S22, then S23 + NICE N16–N28; mid-game resume + Restore from file (Level 2); 28.5 Reference + Settings restyle; Phase 26A leftovers (26A.7 rollback, 26A.8 dry run); log the 11/7 makeup; retire the old phone after one good league night on v2. |
