# mBowl — Independent Audit (Fable, Nov 14, 2026)

> **Repo copy** of the Claude.ai project doc `claude/mBowl-Audit-Fable-Nov14.md` (verbatim below the line). **Read with:** `mBowl-SessionBrief-REV28.md` → NEXT (the build order) and `docs/PHASE28-AUDIT.md` (M / S / N IDs).
>
> **Nov 14 review notes (Opus, against the code):**
> - **F1 confirmed** (`src/backup.ts:41-87`, `app/_layout.tsx:49-64, 119`). Part of it was a known operating rule (REV27 "TRAP: on a fresh install, restore a copied-in file BEFORE the app is ever relaunched"); scenario B (an imported export overwritten by a cold launch) and scenario C are new.
> - **F1 fix direction changed:** "refuse to replace a file whose sessions are not a subset of the live ones" is **rejected** — after any legitimate delete the old file holds an id the live list lacks, so every later backup would be refused and the file would freeze. Build instead: copy-then-overwrite (kept copies when ids would be lost + one daily copy) → REV28 A5. Seed-from-backup → A6. Restore from file… → A7.
> - **New F15:** `writeBackup()` only guards the sessions read; `readBalls()` / `readSettings()` / `readReference()` return defaults on a failed or corrupt read, and those defaults go into the backup file (settings and reference have no shadow). → REV28 A4.
> - Mapping to the build order: F1 → A5-A7 · F2 → Part B · F3 → A1 · F4 + F10 → A2 · F5 → A3 · F6 → A5 · F7 → D3 · F8 → D7 · F9 → Part B · F11 → D4 · F12 + F13 → A9 · F14 → D5 · F15 → A4.

---

**Tree:** `master` @ `de0bb94`. App code is identical to `20bfa97` (the only later changes are docs and `ota.yml`).
**Mode:** read-only. No branches, no pushes, no OTA.
**Scope:** the league-night path and every storage write path: Log submit, Log Frames, History edit/delete, Settings and Reference saves, backup/restore, launch shadow-key recovery.
**Method:** read `CLAUDE.md` and `mBowl-SPEC.md` only, audited the code, ranked the findings, and only then opened `docs/PHASE28-AUDIT.md` to tag each one. I did not open `claude/mBowl-Audit-Nov11.md` or any session brief.
**Library source read (not docs):** `expo/expo` branch `sdk-58` @ `8a5196f` (expo-router, expo-file-system) and `@react-native-async-storage/async-storage@2.2.0`.
**Not done:** nothing was run on a device or in a simulator. Every finding is from reading code.

---

## Bottom line

- **Tonight:** nothing new blocks league. The normal path (Log, Log Frames, Done, Submit) reads correctly, and the SDK 58 calls it depends on match the library source.
- **The one realistic way to lose data tonight is already known (S24):** a game in progress in Log Frames exists only in memory.
- **One new MUST, not a tonight risk:** the launch-time auto-backup can overwrite the only good copy of the data. It matters for the 26A rollback / dry run and any phone move. Fix it before that work.
- **Tonight's habits:** tap Settings → Export Backup before bowling and save the file outside the app. Stay in mBowl while a game is open in Log Frames. Do not use Restore tonight.

| Rank | Count | New | Known |
|---|---|---|---|
| MUST | 1 | 1 | 0 |
| SHOULD | 6 | 3 | 3 |
| NICE | 7 | 4 | 3 |

---

## MUST

### F1 · The launch auto-backup overwrites the restore source; seeding can overwrite real history · NEW · disagrees with the old audit

**Where:** `app/_layout.tsx:49-64` (seed when the key is missing), `app/_layout.tsx:119` (`writeBackup()` after every launch), `src/backup.ts:65` (the only overwrite guard is "live has zero sessions"), `src/backup.ts:81` (the write), `src/backup.ts:122-125` (Restore reads that same file).

**Library facts (AsyncStorage 2.2.0, `ios/RNCAsyncStorage.mm`):**
- `:519-524` — the AsyncStorage folder is excluded from iCloud / Finder backups by default. `app.json` does not set `RCTAsyncStorageExcludeFromBackup`, so the default applies. `mBowl-backup.json` in Documents is not excluded.
- `:550-553` — if `manifest.json` fails to parse, the library logs and starts an empty manifest. Every key then reads as missing, with no error.

**Scenario A (rollback / new phone):** I install mBowl on a phone with no data, or restore a phone from a device backup. AsyncStorage is empty, so launch seeds the 18 sessions. Then `writeBackup()` runs. Live has 18 sessions, which is not zero, so it writes over `mBowl-backup.json`. If my real backup was already in that folder (carried over by the device restore, or copied in through Files before that launch), it is now the 18 seeds. Restore then "succeeds" and gives me the seeds.

**Scenario B (import an older export):** I copy an exported `mBowl-backup.json` into the mBowl folder in Files and open the app. If iOS had dropped the app from memory, that is a cold launch, and `writeBackup()` replaces my file with what is on the phone before I reach Settings. Any write in the app (a History delete, a Settings toggle) does the same. Restore reports success and changes nothing.

**Scenario C (manifest lost, rare):** the manifest is unreadable as JSON. The seeded flag lives in the manifest, so it reads missing, and so does the sessions key. Launch writes the seeds to `mbowl_sessions_v1` and to the shadow key. Both keys map to the same files the real data is in, so the real data is overwritten. Then the launch backup writes the seeds to the Documents file. All three copies are gone in one launch.

**Why MUST:** this is the last-resort copy, and the path that destroys it is the same path a rollback uses. I am sure of the code path. How iOS treats a sideloaded app's data during a device restore is a best guess, so scenario A's "carried over by the device restore" branch is unverified. The "copied in before launch" branch and scenarios B and C do not depend on it.

**Fix direction (Level 2):** before seeding, look at the Documents backup; if it holds a valid, non-empty session list, restore from it instead of seeding. In `writeBackup()`, refuse to replace a file whose sessions are not a subset of the live ones (compare ids), not only when live is empty. A real import path (the document picker is already in the binary) removes scenario B. *(Nov 14 review: the subset guard is rejected — see the notes at the top.)*

**Old audit:** not listed. Its "Checked and clean" section lists "writeBackup zero/invalid guards, seed-only-on-missing, launch shadow recovery" as clean. I disagree for the three scenarios above.

---

## SHOULD

### F2 · A game in progress in Log Frames is memory only · KNOWN: S24 · I rank it higher than "accepted"

**Where:** `app/log-frames.tsx:512` (frames are component state), `:680-706` (Done is the only write), `components/pages/LogPage.tsx:413-415` (the result key is removed before the draft is saved), `:449-455` (the draft save waits 400 ms).

**Scenario:** I am in frame 8 of Game 2 in Live mode. I switch to Messages, iOS drops mBowl from memory (or the app crashes, as it did on this screen Nov 11). I reopen, tap Resume. Game 1 is there. Game 2's eight frames are gone and I re-enter them from the lane monitor.

**Rank note:** no disagreement on the facts. The old audit files it as known / accepted (D5). It is the most likely loss on a league night, so I would put mid-game save first in the after-league order.

### F3 · A failed write still reports success, and Submit then deletes the draft · KNOWN: S22 · agree

**Where:** `src/storage.ts:120-126` (`write()` catches and logs), `:144-147`, `components/pages/LogPage.tsx:653-655`.

**Library check:** `AsyncStorage.native.ts:84-97` — `setItem` does reject on a native error, so the information is there and the app discards it. `RNCAsyncStorage.mm:636-638` — the value goes into the in-memory cache before the file-write error is checked.

**Scenario:** the phone's storage is full. I tap Submit. I get the haptic, the form clears, Stats shows tonight's games (served from the cache). The draft is deleted. After the next relaunch the session is gone.

**One addition:** `writeSessions` writes the primary and the shadow as two separate calls. If only one fails, the two disagree, and nothing notices.

### F4 · After Restore, pages still hold the old data and can write it back · KNOWN: S21 · agree

**Where:** `components/pages/HistoryPage.tsx:615, 673-693`, `components/SettingsContent.tsx:81-106, 666-670`, `app/(tabs)/reference/index.tsx:266-299`.

**Scenario:** I open Settings from History, tap Restore, tap OK, tap Done, and swipe-delete a session without restarting. History writes its pre-restore list (minus one) over the restored sessions and the shadow, and the backup file follows.

**Confirmed variant:** History → Edit → Edit Frames → Done. The return trip reloads the list (`:615`). If that read fails, the list becomes `[]` while the edit sheet reopens. Save then maps over `[]` and writes an empty store (`:688-691`).

### F5 · Settings, ball roster and Reference save over data they failed to read · NEW (extends S21)

**Where:** `src/storage.ts:109-117, 165-182` (a failed or corrupt read becomes the default value), `components/SettingsContent.tsx:84-87, 96-106, 162-173`, `app/(tabs)/reference/index.tsx:271-280, 296-298`.

**Scenario:** one read of `mbowl_settings_v1` fails while the Settings sheet opens. The sheet shows empty season dates and no goals. I change one thing. The whole blob is replaced: my seasons list and goals are gone, and Settings has no shadow key. Same shape for Reference (defaults plus my one edit replace everything). For balls: the roster loads as empty, I tap Add Ball, and the roster and its shadow become that one ball.

**Why SHOULD:** it needs a read failure, which is rare. But `CLAUDE.md` already has the rule ("never act on `[]` alone"), and these three writers do not follow it. S21 covers the stale-after-Restore case for the same files, not this one.

### F6 · An accidental delete or bad edit cannot be undone in the app · NEW

**Where:** `components/pages/HistoryPage.tsx:676, 691` (the write, then `writeBackup()` straight after), `src/storage.ts:144-147` (the shadow gets the same value), `src/backup.ts:41-87`.

**Scenario:** I confirm Delete on the wrong session. Within milliseconds the primary, the shadow and `mBowl-backup.json` all hold the list without it. Restore brings back the same list. The only way back is a file I exported earlier.

**Fix direction:** keep the previous backup as a second file before overwriting, or keep a few dated copies.

### F7 · A draft started on another day keeps that day's date and week · PARTLY KNOWN (S19 design note) · new scenario

**Where:** `components/pages/LogPage.tsx:364` (a form with content is never moved), `:542-544` (a resumed draft keeps its date).

**Scenario:** Friday night I type the opponent to get ahead. Saturday I bowl and Submit. The session saves with Friday's date. The season starts on a Saturday (`src/seasons.ts:20`), so Friday is the last day of the previous week: tonight would save as Week 9, not Week 10. The date is visible on the form, and I can fix it in History afterwards.

**Old audit:** S19 fixed the empty form and noted that a picked date is left alone by design. A date the app set on a form I only typed an opponent into is a different case.

---

## NICE

| ID | Where | What I do → what goes wrong | Tag |
|---|---|---|---|
| F8 | `src/backup.ts:81`; expo-file-system `ios/FileSystemFile.swift:117` (`atomically: false`) | App is killed during a backup write → truncated JSON. The next write repairs it, so it only matters if the live store is bad at the same moment. | KNOWN: N28 |
| F9 | `LogPage.tsx:413-428` | App dies between Done and the Log page reading the result → on relaunch the leftover result lands in whatever form is open. `JSON.parse` there has no try/catch. | KNOWN: N17 |
| F10 | `HistoryPage.tsx:674-678, 688-693` | Writes run inside `setSessions` updaters. React may call an updater more than once. The value is the same each time, so it is harmless today. | KNOWN: in S21 |
| F11 | `EditSessionModal.tsx:474-481` | I change a score in the edit sheet for a game that has frames → saved with no prompt; the score and the frames now disagree (average uses one, strike % the other). The Log form asks first (`LogPage.tsx:163-175`). | NEW |
| F12 | `LogPage.tsx:637-642`, `app/_layout.tsx:87-101` | Sessions key is unreadable and the shadow is too → Submit says "relaunch and try again", forever. The way out is Restore, and the alert does not say so. | NEW |
| F13 | `src/backup.ts:169-176` | Restore fails partway (storage full) → some keys restored, some not, and the alert says a generic error. The code comment admits it; the user-facing message does not. | NEW |
| F14 | `SettingsContent.tsx:497-499, 519-521` | I type a target average and tap Done with the keyboard still up → the goal may not save (it saves on blur only). Not verified; needs one device check. | NEW · unverified |

---

## Checked against library source — clean

- **Leave guard.** `usePreventRemove` at `expo-router/src/react-navigation/core/usePreventRemove.tsx:116-126`: `repeat()` turns prevention off, then re-dispatches the blocked action. `app/log-frames.tsx:730-750` uses it that way for Done and Discard; Keep Editing leaves prevention on.
- **Backup file calls.** `File.write` and `File.text` are async in SDK 58 (`FileSystemModule.swift:332, 390`), and `backup.ts` awaits both.
- **AsyncStorage writes.** Values over 1,024 characters are written to their own file atomically (`RNCAsyncStorage.mm:635`), so the sessions blob cannot be half-written.
- **Locked device.** A manifest that exists but cannot be opened returns an error (`:531-543`), which the launch code treats as "defer", not "seed".
- **Submit.** Refuses on an invalid or failed read; in-flight guard; draft timer disarmed before the draft is cleared (`LogPage.tsx:577-661`).
- **Scoring.** 10th-frame fills, spare / strike bonus, gutters (`log-frames.tsx:65-131`).
- **History Edit Frames hand-off.** History only consumes the result when it sent you to the editor (`HistoryPage.tsx:628-660`).
- **Live game.** Only the focused Log page answers, after the resume prompt is settled (`LogPage.tsx:693-711`).

## Where I differ from the Nov 11 audit

1. **F1** — the old audit lists the seed and backup guards as clean. I found three ways they destroy the backup. New MUST.
2. **F2 / S24** — same facts; I would not leave it as "accepted". It is the likeliest loss on a league night.
3. **F5** — S21 is framed around Restore. The same writers also overwrite after a failed read, with no Restore involved.
4. No disagreement on S21, S22, N17 or N28.

## Old-audit items I did not re-check

S23 and N16, N18, N19, N21–N27 are outside this scope (display, Log Frames input details). I did not re-verify M2, S17, S18, S19 or S20 on a device; in the code they are in place as described.

## Suggested order after league

1. **F1** — before the 26A rollback / dry run.
2. **F2** (S24 mid-game save).
3. **F3** (S22) together with **F5** and **F4** (S21) — one pass over every writer: fresh read with status, refuse on invalid / error, report failure.
4. **F6**, then the NICE batch.

*(Superseded Nov 14 by REV28 → NEXT Parts A-E.)*
