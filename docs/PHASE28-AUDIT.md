# mBowl — Post-SDK 58 Targeted Audit (Nov 11, 2026) · Fix List

**Tree:** `master` @ `1ea0f6c` (findings), re-verified against `4d4ec3b` (rotation + landscape Log Frames + season-based week). Read-only audit; no code changed by it.
**Why:** the Nov 11 morning hang (Expo Router 58's own `usePreventRemove` needs `repeat()`; the RN7 `dispatch(data.action)` looped and the app aborted). That bug compiled, passed CI, and had never run on a device. This audit hunted for the next one before league night (Sat Nov 14).
**Method (Phase 20 style, targeted):** 4 parallel read-only agents, each reading the actual SDK 58-era library source (expo/expo `sdk-58`, RN v0.88.1, react-native-screens 4.30.1, GH 3.3.0, Reanimated 4.7.1, AsyncStorage 2.2.0, ...):
- A1 navigation/routing API drift · A2 native-module/library API drift · B1 Log league-night path · B2 History, split pages, backup.
Then one separate verification agent re-read every cited line: **13 CONFIRMED, 4 PLAUSIBLE, 2 CUT.**
**IDs continue from `docs/PHASE20-AUDIT.md`** (M2+, S17+, N16+).

---

## ⭐ AGREED TRIAGE — start here

**Agreed by Marcus, Nov 11 ~08:12.** Build order for the pre-league batch: **1. M2 → 2. S17 → 3. S18 → 4. S19 → 5. S20** (one branch, one commit per item, CI + `reviewer`, then the device checks at the bottom and "ship it"). After league: **S21 → S22 → S23 → NICE batch**. Fixes were deferred to a new chat; the trigger phrase "let's fix all the things needed before this week's league session" = the pre-league batch (see `mBowl-SessionBrief-REV26.md` → NEXT step 1, which has the implementation notes per item).

**Headline:** no second SDK 58 "flipped API" bug. A2 checked every non-navigation library API against source: safe. A1 found one routing problem that predates SDK 58 but became user-visible with the WP7 Live game button (M2).

| Bucket | Items |
|---|---|
| **Fix before Saturday (pre-league batch, Level 1, OTA)** | **M2** duplicate tabs / Live button opens the wrong game · **S17** tapping a button's label does nothing (ScalePressable) · **S18** Submit double-tap duplicates a session · **S19** Log form date goes stale while the app sits in memory · **S20** modals force portrait now that rotation is on |
| **After league (Level 2 — touches write paths; audit + backup gates)** | **S21** History/Settings/Reference write stale in-memory lists after a Restore · **S22** swallowed write errors can lose a submitted session (disk full) · **S23** open-screen Stats doesn't refresh after a History edit |
| **Known / accepted (D5)** | **S24** game in progress lives only in memory |
| **NICE (after league, batch)** | N16-N28 |
| **Cut** | Live button usable while Log Frames is open (it isn't — root stack covers the tabs) · Export share promise hang (component unmounts, no user impact) |

**Operational rule until S21 ships:** after Settings → Restore, **relaunch the app before touching anything** (the alert already says so).

---

## 🔴 MUST — 1

### M2 · `app/_layout.tsx:25-27` + `app/index.tsx:4` + `components/pages/LogPage.tsx:~587-602` — every cold launch mounts a second, hidden tab navigator; the Live game button can open the wrong game, then stops working · **CONFIRMED**
- **Chain (expo-router 58.0.31 source):** `unstable_settings = { anchor: '(tabs)' }` seeds the root stack as `[(tabs), index]` (`createSeededNavigationState.ts:264-265`); `app/index.tsx`'s `<Redirect href="/(tabs)/log" />` does `router.replace` (`Redirect.tsx:69-72`) at the root stack (`resolveNavigationDestination.ts:72-113`); `StackRouter` REPLACE mints a NEW route (`StackRouter.tsx:346-381`) → `[(tabs)#anchor, (tabs)#new]`. Both stay mounted with live effects (`NativeStackView.native.tsx:511`, `freezeOnBlur={false}`).
- **Effect:** two `LogPage`s, both subscribed to `onLiveGameRequest` (not focus-gated). With no draft at launch, the hidden copy answers the first Live tap first → opens Log Frames for ITS empty form's game 0 ("Game 1", empty) → Done writes `gameIndex: 0` → the visible Log page **overwrites Game 1 with that score/frames**. Its `openingFramesRef` then stays true forever (it is never focused), so **every later Live tap does nothing** until relaunch. If the first Live tap of a launch is for Game 1, it happens to look right — which is why it hasn't been seen.
- **Also (PLAUSIBLE):** a left-edge back swipe on a tab page can pop to the stale anchor tabs.
- **Age:** files from `96bf25b` (Mar 6, Phase 3); consequence since WP7 (`44af9ee`, Nov 10).
- **Fix:** drop `unstable_settings.anchor` (keep `app/index.tsx` — Expo Go needs it), and only answer a Live request from the focused Log page.
- **Device test:** cold launch with no draft → type a Game 1 score, add Game 2 → tap Live: header should read "Game 2" (bug: "Game 1", empty) → back out → tap Live again: should open (bug: nothing).

---

## 🟠 SHOULD

### Pre-league batch (Level 1)

**S17 · `components/ScalePressable.tsx:29-43` — a tap on a button's label text does nothing · CONFIRMED (source)**
The `Pressable` is an absoluteFill SIBLING under `{children}`. Fabric hit-tests the deepest view (the label's paragraph view, `RCTParagraphComponentView.mm:433-436`), the touch targets the Text (`RCTSurfaceTouchHandler.mm:82-92`), Text only takes the responder when pressable (`Text.js:150-153`), and responder negotiation walks ancestors only — the sibling Pressable never gets it. Affects Log Frames **Done** (final-score card), **Submit session**, Draft Resume/Discard, Export Backup, Settings season/ball buttons, Edit-session type pills, Reference sub-tabs. Since `137ec0a` (Mar 16). Marcus's Done taps worked because the button is ~141×50 around a ~45×21 label — taps landed on padding. **Fix:** one animated `Pressable` that carries the style and wraps the children. **Test:** tap squarely on the word "Done" / "Submit session".

**S18 · `components/pages/LogPage.tsx:~495-559` — Submit has no in-flight guard · CONFIRMED**
Each tap builds a session with a new `Date.now()` id; a double tap can append the same night twice (double-counts 3 games). Done and Log frames got double-tap guards Nov 10; Submit didn't. **Fix:** a submitting ref + clear `draftSaveTimer` (covers N20).

**S19 · `LogPage.tsx:~269, 448-451` — the form date (and so the week) goes stale · CONFIRMED (still open after 4d4ec3b)**
`date` is set at mount, on resume and in `resetForm` only. Submit resets it to that night; if the app stays in memory until next Saturday, the session saves last week's date (and `weekFor` computes last week's week). `settingsRef` is never refreshed after a Settings change. **Fix:** on Log focus / app foreground, if the form has no content and no pending draft, reset date + week to today; re-read settings when the Settings sheet closes.

**S20 · every RN `Modal` — no `supportedOrientations` · PLAUSIBLE, reachable since `1ea0f6c`**
RN defaults to portrait on iPhone (`RCTModalHostViewComponentView.mm:52-57`; the Fabric VC returns that mask in Release). Most at risk: the transparent overFullScreen "Resume Session?" (`LogPage.tsx:~904-906`); pageSheets go full screen in iPhone landscape. **Fix:** `supportedOrientations={['portrait','landscape']}` on all modals. **Test:** Rotation Lock off, cover landscape: cold launch with a draft (does it snap to portrait?); open the Settings gear.

### After league (Level 2)

**S21 · `HistoryPage.tsx:615, 673-696` (+ `SettingsContent.tsx:80-106`, `reference/index.tsx:266-298`) — writes stale in-memory lists · CONFIRMED (was MUST; downgraded because the Restore alert says "Restart the app")**
Delete/Save write `prev` (loaded with display-only `readSessions()`) without a fresh read. Settings is a pageSheet → no focus event when it closes. After Restore without a restart, one delete/edit writes the old list over the restored primary + shadow, then `writeBackup` overwrites `mBowl-backup.json` (the restore source). Permanent, silent. Low-probability variant: an error/invalid read sets `[]`, then Save maps over `[]` → `writeSessions([])` (backup file spared by its zero guard). **Fix:** re-read with `readSessionsResult()`, refuse on invalid/error (like Log submit), apply the change to the fresh array, and move the write out of the `setSessions` updater (NEW-2: updaters must be pure); force a reload after Restore.

**S22 · `src/storage.ts:120-126` + `LogPage.tsx:553-554` — write errors swallowed · CONFIRMED (rare: disk full)**
`write()` catches and logs, so `writeSessions` "succeeds"; Submit then deletes the draft. AsyncStorage 2.2.0 iOS caches the value BEFORE checking the file-write error (`RNCAsyncStorage.mm:635-640, 592-596`), so the session even shows in-app until relaunch, then is gone. Same root as N27. **Fix:** writers return success; Submit keeps the draft and alerts on failure.

**S23 · `StatsPage.tsx:661-695` — open-screen Stats stale after a History edit/delete/restore · CONFIRMED (display only)**
Both panes share one focus; Stats reloads only on focus / visibility change. **Fix:** a sessions-changed notifier like `notifyDraftChanged`.

### Known (D5)

**S24 · `app/log-frames.tsx` — the game in progress is memory only · CONFIRMED (accepted, D5)**
An app kill/crash in Log Frames loses that game's throws. Plus a ~400ms window after Done: Log removes `FRAME_RESULT` before the debounced draft write. Mid-game resume is on the after-league list (Level 2).

---

## ⚪ NICE (after league)

| ID | Where | What |
|---|---|---|
| N16 | `log-frames.tsx:941-999` | Cover-screen rotation mid-frame remounts PinDeck: tapped-but-unconfirmed pins reset; note panels collapse (note text is safe). (= reviewer W2, now reachable) |
| N17 | `LogPage.tsx:340-357` | `FRAME_RESULT` consumed by Log without a source check (leftover key at launch, tab switch during History's load). Fix: tag the result with its source. |
| N18 | `log-frames.tsx:637-663` | ⌫ in a mixed Pins/Quick frame deletes the wrong throw's pin data (leave stats only). Fix: `slice(0, f.throws.length - 1)`. |
| N19 | `log-frames.tsx:~799` | Re-entering an earlier frame on a complete game hides Done until frame 10 is tapped. |
| N20 | `LogPage.tsx:~380-386, 555` | Armed draft timer can re-write a phantom draft during Submit's haptic await (folded into the S18 fix). |
| N21 | `HistoryPage.tsx:661-665, 591-601` | Edit sheet reopens during the native pop (PLAUSIBLE; flow predates SDK 58). Test: History → Edit → Edit Frames → Done ×5. |
| N22 | `HistoryPage.tsx` | Edit finished while History is the hidden pane presents over Stats (PLAUSIBLE, arguably fine). |
| N23 | `LogPage.tsx:566-567`, `HistoryPage.tsx:596-599` | Notes inside the `initialFrames` route param are decoded twice; a note containing a literal `%22`-style escape opens Log Frames empty (nothing overwritten unless re-scored + Done). |
| N24 | `log-frames.tsx:~720` | `isDirty` false positive after adding + deleting a Pins throw (spurious Discard prompt). |
| N25 | `log-frames.tsx:338-341, 450-457` | Multiline notes + `returnKeyType="done"`: Return inserts a newline, keyboard stays up. |
| N26 | `src/storage.ts:4` | `KEYS` typed `Record<string,string>` — a key typo type-checks. `as const`. |
| N27 | `HistoryPage.tsx` | Failed History writes invisible (same root as S22); season filter resets on every focus incl. the Edit Frames round trip; type filter never resets (comment says it does). |
| N28 | misc | Backup file written non-atomically (`FileSystemFile.swift:117`, self-heals); `shouldShowAlert` deprecated; `await Haptics.impactAsync` in Submit unnecessary; double ✕ can queue two alerts. |

---

## ✂️ Cut (2)
- **Live button while Log Frames is on top / double push** — Log Frames is a root-stack screen covering the tabs, so neither Live button is tappable; the live effect clears the request before opening.
- **Export share promise hang** — SettingsContent unmounts when the sheet closes; the promise just leaks, no UI is stuck.

## ✅ Checked and clean (highlights)
- Leave guard vs SDK 58 source: `repeat()` correct; Keep Editing keeps prevention; swipe-back goes through the same prevented pop; Done double tap and failed write handled.
- Scoring: every 10th-frame fill, gutters (em dash), skipped frames, deleting back across frames, editing a middle frame.
- AsyncStorage / expo-file-system / expo-sharing / keep-awake / haptics / notifications / Alert / Modal / LayoutAnimation / Reanimated 4.7 springs / GH 3.3 ReanimatedSwipeable props / view-shot / chart-kit / expo-blur / expo-symbols: no SDK 58 semantics change affecting the app.
- Navigation: `useFocusEffect`, focus propagation, `setOptions`, NativeTabs (conditional BottomAccessory, `usePlacement`, `tabPress`), `router.push/navigate` paths, event name `removePrevented` (app never listens to `beforeRemove`).
- Data guards: restore shape checks + shadows, `writeBackup` zero/invalid guards, seed-only-on-missing, launch shadow recovery, Log submit refuses invalid/error reads.
- Landscape: no `Dimensions.get`; everything sizes from `useWindowDimensions` / `usePageWidth`.

## Device checks before Friday go/no-go
1. M2 test (above) — before and after the fix.
2. S17: tap squarely on "Done" and "Submit session".
3. History → Edit → Edit Frames → Done, then Save; same with ✕ → Cancel (never run on 2.0.0).
4. Swipe-back in Log Frames → Discard; swipe-back → Keep Editing → ✕.
5. S20: rotate with Settings / Edit Session / Resume sheet open.
