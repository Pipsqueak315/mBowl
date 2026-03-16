# mBowl -- Session Brief
**Full spec lives in:** mBowl-SPEC.md (Project folder) -- read it before writing any code.
**Last updated:** March 15, 2026

---

## Current Status

**Phase:** Phase 10A -- Reference: Signals sub-tab (Ball Arsenal + Switch Guide) is next.
**Last completed:** Phase 9 -- Reference Tab (Position + Mental + Your Numbers)
**Up next:** Phase 10A -- Signals sub-tab with Ball Arsenal (9 balls, strength dots, editable) and Switch Guide (11 scenarios, color-coded direction). Phase 10B is Pocket Diagnostics (14 leave cards, filter pills). Phase 10C may be Patterns if needed.

---

## How To Start a Session

Tell Claude Code at the top of each session: Phase X -- [what you are working on today].
Claude reads CLAUDE.md and mBowl-SPEC.md for full context. This brief tracks current state only.
The End of Phase Protocol lives in CLAUDE.md -- run it at the end of every phase.

---

## Critical Project Notes (Read Before Phase 10)

This is an Expo Router project -- not bare React Navigation.

- File-based routing. Tabs live in app/(tabs)/. Screens are files, not components registered manually.
- app/_layout.tsx is the root layout. Seed logic and dark theme forced here.
- app/(tabs)/_layout.tsx controls the bottom tab bar.
- React Navigation is already included via Expo Router -- do NOT reinstall it.
- Windows machine: always write files using a JS file via node. Never use python or bash heredoc.
- Write tool can be used to create the .js script, then Bash to run: node path/to/script.js

### Architecture Notes Accumulated Through Phase 9

**Root redirect:** app/index.tsx exists as a simple Redirect to /(tabs)/log. Required -- do not delete.

**Gear icon pattern:** Each tab screen uses useNavigation().setOptions() inside useLayoutEffect to inject the headerRight gear button. Modal opens with presentationStyle="pageSheet" and animationType="slide".

**Settings modal:** All 4 tabs render `<SettingsContent onClose={...} />` inside their gear icon Modal. SettingsContent lives at components/SettingsContent.tsx.

**Dark theme:** app/_layout.tsx forces DarkTheme always. StatusBar style set to "light".

**Tab bar:** backgroundColor #1C1C1E, borderTopColor #38383A, borderTopWidth 0.5. Active teal #00CEC9, inactive dim #8E8E93.

**Headers:** headerStyle backgroundColor #000000, headerTintColor #FFFFFF, headerShadowVisible false.

**log-frames route:** Registered in app/_layout.tsx Stack. Navigate via router.push('/log-frames').

**Stats tab data loading:** Uses useFocusEffect + useCallback to reload sessions and settings every time the tab is focused.

**Chart library (locked):** react-native-chart-kit. react-native-svg installed.

**Ball picker in Log tab:** Manage Balls button opens Settings via setTimeout 350ms. Log tab reloads active balls when settings modal closes.

**DateTimePicker:** @react-native-community/datetimepicker v8.4.4. display="spinner", textColor="#FFFFFF". Parse ISO dates with T12:00:00 suffix. Build ISO string manually.

### Reference Tab Architecture (Phase 9)

**File:** app/(tabs)/reference.tsx -- complete rewrite from placeholder. One self-contained file (~430 lines total including styles).

**Sub-tabs:** 5 tabs rendered in a horizontal ScrollView (sticky, height: 44, backgroundColor: #1C1C1E, borderBottomWidth: 0.5). Active tab: teal text + 2px teal indicator at bottom. Inactive: dim text. State: `activeTab: SubTab` where `SubTab = 'Position' | 'Signals' | 'Pocket Diagnostics' | 'Mental' | 'Patterns'`.

**Data pattern:** All editable content lives in `mbowl_reference_v1` as a single `ReferenceData` object. Loaded via `useFocusEffect` + `useCallback` from `readReference()`. If storage empty → pre-populates from DEFAULT_DATA constant and leaves it unsaved (saves on first blur). On any field blur: `save()` is called which writes `latestData.current` (a ref that's always up to date) via `void writeReference(...)`.

**Update pattern:** `update(updater)` function atomically updates both React state and `latestData` ref:
```tsx
function update(updater: (prev: ReferenceData) => ReferenceData) {
  setData(prev => {
    const next = updater(prev);
    latestData.current = next;
    return next;
  });
}
```
This prevents stale closure issues in onBlur save. Save function: `function save() { void writeReference(latestData.current); }`.

**mergeWithDefaults:** Called when loading from storage. Merges stored data with defaults for any missing fields. Phase 10 must extend this function when adding signals/diagnostics/patterns fields to ReferenceData.

**ReferenceData schema (Phase 9):**
```typescript
interface ReferenceData {
  position: PositionRow[];        // 6 rows: scenario(fixed), feet, eyes, notes
  mentalCues: MentalCue[];        // 5 cues: label + body, both editable
  yourNumbers: YourNumbers;       // 7 fields: ballSpeed, revRate, axisTilt, axisRotation, pap, dominantMiss, layDownBoard
  speedNotes: string;             // freetext
  releaseNotes: string;           // freetext
  pressureTendencies: string;     // freetext
}
```
Phase 10 will add to this schema: `signals` (ball arsenal + switch guide) and `pocketDiagnostics` (14 leave cards). The mergeWithDefaults function must be updated to handle these new fields gracefully.

**Position tab:** 6 cards (one per row). Each card: scenario name (non-editable Text), Feet + Eyes side-by-side with a vertical divider, Notes below with top separator. All inputs: fontSize 15, color #00CEC9. Notes input: multiline, color #FFFFFF.

**Mental tab sections:**
1. Shot Clock -- static card, 3 columns (Frame: width 66, Role: width 98, Action: flex 1). Column widths are FIXED not flex ratios. Data is SHOT_CLOCK constant, not from storage.
2. Mental Cues -- 5 cards with teal number badge (24x24, rounded) + bold label TextInput + body TextInput.
3. Your Numbers -- one card with 7 rows (separator between each). Label left (flex none), value TextInput right (textAlign: 'right'). Placeholders show format hints (e.g. "16.0 mph").
4. Notes Sections -- 3 separate cards for Speed Notes, Release Notes, Pressure Tendencies. Multiline TextInputs, minHeight: 60.

**Placeholder tabs:** Signals, Pocket Diagnostics, Patterns render centered view with book.fill SF Symbol + title + "Coming soon" text.

**TypeScript notes:**
- YOUR_NUMBERS_ROWS typed as `Array<{ key: keyof YourNumbers; label: string; placeholder: string }>`
- yourNumbers update uses `as YourNumbers` cast for computed key
- NOTES_SECTIONS uses `NotesKey = 'speedNotes' | 'releaseNotes' | 'pressureTendencies'` and has helper functions `getNotesValue()` and `updateNotes()` to avoid computed-key TypeScript complexity

---

## Build Schedule

| # | Phase | Est. Time | Chats | Status |
|---|---|---|---|---|
| 1 | Environment Setup | 30 min | 1 | Complete |
| 2 | Data Layer | 45-60 min | 1 | Complete |
| 3 | Navigation Shell | 45 min | 1 | Complete |
| 4 | Log Tab -- Form + Submit + Draft | 90-120 min | 2 | Complete |
| 5 | Log Frames Screen | 90 min | 2 | Complete |
| 6 | History Tab | 60-75 min | 1 | Complete |
| 7 | Stats Tab | 90 min | 2 | Complete |
| 8 | Settings Screen | 45-60 min | 1 | Complete |
| 9 | Reference: Position + Mental | 60 min | 1 | Complete |
| 10 | Reference: Signals + Diagnostics | 75-90 min | 2 | Not started |
| 11 | Polish + Animations | 60-90 min | 1-2 | Not started |
| 12 | Build + Install | 60-90 min | 1 | Not started |

---

## Phase Details

### Phase 1 -- Environment Setup
**Completed:** March 6, 2026

- Node.js v24.14.0, Git, VS Code, Claude Code v2.1.71, Expo CLI installed
- mBowl project created via npx create-expo-app mBowl
- PATH fix needed post Claude Code install. PowerShell execution policy set to RemoteSigned.

---

### Phase 2 -- Data Layer
**Completed:** March 6, 2026

- src/storage.js -- 10 named exports (read/write for all 5 keys), full replace strategy
- src/seeds.js -- 17 historical league sessions
- src/balls.js -- 9-ball roster, weakest to strongest
- First-launch seed logic in app/_layout.tsx

---

### Phase 3 -- Navigation Shell
**Completed:** March 6, 2026

- 4 tabs + log-frames route. Root redirect in app/index.tsx. Gear icon via useNavigation().setOptions(). TSC clean.

---

### Phase 4 -- Log Tab
**Completed:** (session before Phase 7)

Full Log tab: all session types, ball picker, draft persistence, submit. Confirmed on device.

---

### Phase 5 -- Log Frames Screen
**Completed:** (session before Phase 7)

Full frame entry: Live/Post-Game toggle, 10-frame logic, running score, haptic on strike. Confirmed on device.

---

### Phase 6 -- History Tab
**Completed:** (session before Phase 7)

All 17 seeded sessions. Filter pills. Expand/collapse with frame grid. Swipe-delete with confirm. Confirmed on device.

---

### Phase 7 -- Stats Tab
**Completed:** March 10, 2026

Metrics (avg hero, high game/series, strike/spare/opens N/A state, toggle, empty state) + charts (react-native-chart-kit + react-native-svg). TSC clean. Confirmed on device.

---

### Phase 8 -- Settings Screen
**Completed:** March 15, 2026

components/SettingsContent.tsx created. Wired into all 4 tab gear modals. Season dates + ball roster. Manage Balls shortcut. Ball reload on settings close. TSC clean. Confirmed on device: pending.

---

### Phase 9 -- Reference: Position + Mental + Your Numbers
**Completed:** March 15, 2026

**Files modified:** app/(tabs)/reference.tsx -- complete rewrite from placeholder

**What was built:**
- 5 sub-tab bar (horizontal ScrollView, height 44, sticky above content): Position · Signals · Pocket Diagnostics · Mental · Patterns
- Sub-tab indicator: 2px teal line at bottom of active tab item (absolute positioned within TouchableOpacity)
- Position sub-tab: 6 position cards, each with non-editable scenario name + editable Feet/Eyes (side by side with vertical divider) + editable Notes (below separator). All save on blur to mbowl_reference_v1.
- Mental sub-tab:
  - Shot Clock: static 4-row card, 3 fixed-width columns (Frame w:66, Role w:98, Action flex:1). Not from storage.
  - Mental Cues: 5 cards with teal number badge + editable label + editable body. Both save on blur.
  - Your Numbers: 1 card with 7 editable rows (Ball Speed, Rev Rate, Axis Tilt, Axis Rotation, PAP, Dominant Miss, Lay Down Board). Placeholder shows format hint. Save on blur.
  - Notes: 3 separate cards -- Speed Notes, Release Notes, Pressure Tendencies. Multiline freetext. Save on blur.
- Placeholders for Signals, Pocket Diagnostics, Patterns: centered book icon + name + "Coming soon"
- All Position and Mental content pre-loaded from DEFAULT_DATA constant if mbowl_reference_v1 is empty
- useFocusEffect reloads data every time tab is focused
- mergeWithDefaults() handles missing fields -- Phase 10 must extend this when adding signals/diagnostics fields

TSC clean. Confirmed on device: pending Marcus confirmation.

---

### Phase 10 -- Reference: Signals + Pocket Diagnostics (2-3 chats)

**Chat A -- Signals sub-tab:**
- Toggle at top: Ball Arsenal / Switch Guide
- Ball Arsenal: 9 balls listed weakest to strongest, each row has strength dots + name + expandable motion profile + when-to-use. Content editable, saves on blur.
- Switch Guide: 11 scenarios, expandable cards, color-coded direction indicator (green = down in strength, red = up, yellow = feet only)
- Content pre-loaded from Spec defaults
- Saves to mbowl_reference_v1 (add signals field to ReferenceData)

**Chat B -- Pocket Diagnostics sub-tab:**
- 14 diagnostic leave cards (from Spec: ringing 10, solid 8, etc.)
- Filter pills: All Leaves · High Frequency · Common · Situational
- Each card: leave name + frequency badge + expandable: Why It Happens / Fix / Pattern to Watch
- Color-coded frequency: High Frequency = red, Common = orange, Situational = yellow
- Content pre-loaded from Spec defaults
- Saves to mbowl_reference_v1

**Chat C -- Patterns sub-tab (if time):**
- TBD -- may be post-v1

Phase 10 requires extending ReferenceData schema and mergeWithDefaults() in reference.tsx.

---

### Phase 11 -- Polish + Animations
- react-native-reanimated: spring animations, scale on press
- expo-haptics: full audit
- expo-blur: modal overlays
- Keyboard avoid on all forms
- Safe area insets final audit
- Full device walkthrough -- must feel native

---

### Phase 12 -- Build + Install
- App icon + splash screen in app.json
- EAS CLI + eas build --platform ios --profile preview
- Download .ipa, install on iPhone, smoke test

---

## Open Questions

| Question | When |
|---|---|
| App icon image | Phase 12 |
| Session edit flow | Post-v1 |
| Patterns sub-tab content | Phase 10C or post-v1 |

---

## Session Notes

| Session | Phase | Completed | Notes |
|---|---|---|---|
| 1 | Phase 1 | Mar 6, 2026 | Environment setup. PATH fix. PowerShell RemoteSigned. Node v24.14.0. |
| 2 | Phase 2 | Mar 6, 2026 | Data layer. Expo Router project. AsyncStorage SDK 54. Seeds + balls. |
| 3 | Admin | Mar 6, 2026 | End of Phase Protocol added. Project path locked. |
| 4 | Phase 3 | Mar 6, 2026 | Navigation shell. 4 tabs. Gear icon. Root redirect. log-frames route. TSC clean. |
| 5 | Phase 4+5+6 | (before Mar 10) | Log tab, Log Frames, History. All confirmed on device. |
| 6 | Phase 7 | Mar 10, 2026 | Stats tab. Metrics + charts. react-native-chart-kit + react-native-svg. TSC clean. Confirmed. |
| 7 | Phase 8 | Mar 15, 2026 | Settings screen. SettingsContent.tsx. All 4 tabs wired. Season dates + ball roster. TSC clean. |
| 8 | Phase 9 | Mar 15, 2026 | Reference tab. Full rewrite. 5 sub-tabs. Position (6 cards, editable). Mental (Shot Clock static, 5 Cues editable, Your Numbers 7 rows, 3 notes blocks). Placeholders for Signals/Pocket Diagnostics/Patterns. useFocusEffect loads from storage, mergeWithDefaults handles missing fields. TSC clean. |

---

## Post-v1 Backlog

- Session edit flow
- Ball strength ratings editable in Settings
- Patterns sub-tab
