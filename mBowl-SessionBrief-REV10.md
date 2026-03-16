# mBowl -- Session Brief
**Full spec lives in:** mBowl-SPEC.md (Project folder) -- read it before writing any code.
**Last updated:** March 15, 2026

---

## Current Status

**Phase:** Phase 12 -- Build + Install is next.
**Last completed:** Phase 11 -- Polish + Animations (ScalePressable, haptics audit, expo-blur, KAV, loading states, safe area)
**Up next:** Phase 12 -- App icon + splash screen, EAS CLI, eas build --platform ios --profile preview, download .ipa, install on iPhone, smoke test.

---

## How To Start a Session

Tell Claude Code at the top of each session: Phase X -- [what you are working on today].
Claude reads CLAUDE.md and mBowl-SPEC.md for full context. This brief tracks current state only.
The End of Phase Protocol lives in CLAUDE.md -- run it at the end of every phase.

---

## Critical Project Notes (Read Before Phase 12)

This is an Expo Router project -- not bare React Navigation.

- File-based routing. Tabs live in app/(tabs)/. Screens are files, not components registered manually.
- app/_layout.tsx is the root layout. Seed logic and dark theme forced here.
- app/(tabs)/_layout.tsx controls the bottom tab bar.
- React Navigation is already included via Expo Router -- do NOT reinstall it.
- Windows machine: always write files using a JS file via node. Never use python or bash heredoc.
- Write tool can be used to create the .js script, then Bash to run: node path/to/script.js

### Architecture Notes Accumulated Through Phase 11

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

### Phase 11 Polish (complete)

**ScalePressable component:** components/ScalePressable.tsx. Uses Reanimated useSharedValue + useAnimatedStyle + withSpring. Wraps Pressable + Animated.View. Scale to 0.96 on pressIn, spring back to 1 on pressOut. Damping 15, stiffness 400. Drop-in replacement for TouchableOpacity anywhere a scale animation is desired.

**Haptics (corrected and complete):**
- Submit session: impactAsync(Heavy) -- was notificationAsync(Success)
- Ball select in picker: impactAsync(Light) -- added new
- Delete session (History): impactAsync(Medium) -- was notificationAsync(Warning)
- Filter pill press (History): impactAsync(Light) -- added new
- Strike entry (Log Frames): impactAsync(Light) -- was impactAsync(Medium)
- Discard frames: impactAsync(Medium) -- added new (fires before navigation.goBack())
- Sub-tab switch (Reference): impactAsync(Light) -- added new

**expo-blur:** expo-blur installed (npx expo install expo-blur). Draft resume sheet overlay in Log tab uses BlurView intensity=60 tint="dark" as the overlay container (replaces solid rgba background).

**KeyboardAvoidingView:**
- app/(tabs)/log.tsx -- already had KAV (behavior: padding, offset: 88)
- components/SettingsContent.tsx -- KAV added wrapping ScrollView (behavior: padding, offset: 0)
- app/(tabs)/reference.tsx -- KAV added wrapping full container (behavior: padding, offset: 88)

**Loading states:**
- app/(tabs)/history.tsx -- loaded state: false on focusEffect start, true after data resolves. Shows ActivityIndicator while loading.
- app/(tabs)/reference.tsx -- loaded state: false on focusEffect start, true after data resolves. Shows ActivityIndicator while loading. Sub-tab content gated behind loaded flag.
- app/(tabs)/stats.tsx -- had loading state already (from Phase 7).

**Safe area (History):** useSafeAreaInsets added to HistoryScreen. FlatList contentContainerStyle uses insets.bottom + 16 for bottom padding.

### Reference Tab Architecture (Phase 9 + 10)

**File:** app/(tabs)/reference.tsx -- complete rewrite in Phase 9, extended in Phase 10.

**Sub-tabs:** 5 tabs rendered in a horizontal ScrollView (sticky, height: 44, backgroundColor: #1C1C1E, borderBottomWidth: 0.5). Active tab: teal text + 2px teal indicator at bottom.

**State:** `activeTab: SubTab` where `SubTab = 'Position' | 'Signals' | 'Pocket Diagnostics' | 'Mental' | 'Patterns'`.

**Data pattern:** All editable content lives in `mbowl_reference_v1` as a single `ReferenceData` object. Loaded via `useFocusEffect` + `useCallback`. Pre-populates from DEFAULT_DATA if storage empty. Saves on any field blur via `latestData` ref pattern.

**Update pattern:** Atomic update via `update(updater)` which updates both React state and `latestData.current` ref. Prevents stale closures in onBlur save.

**mergeWithDefaults:** Handles all 7 fields. Called when loading from storage to fill in any missing fields.

**ReferenceData schema (Phase 10 final):**
```typescript
interface ReferenceData {
  position: PositionRow[];        // 6 rows: scenario(fixed), feet, eyes, notes
  mentalCues: MentalCue[];        // 5 cues: label + body, both editable
  yourNumbers: YourNumbers;       // 7 fields
  speedNotes: string;
  releaseNotes: string;
  pressureTendencies: string;
  signals: SignalsData;           // Switch Guide (11) + Ball Arsenal (9) + Lane Reads (7)
  pocketDiagnostics: DiagnosticsData;  // 14 leave cards with frequency tiers
  patterns: PatternsData;         // 9 oil pattern cards with lane diagrams
}
```

### Signals Sub-tab (Phase 10A)

**File:** components/SignalsTab.tsx

**Exports:** `SignalsTab` (default), `SignalsData`, `DEFAULT_SIGNALS`

**Views:** 3-pill toggle at top -- Switch Guide · Ball Arsenal · Lane Reads

**Switch Guide:** 11 expandable cards. Collapsed: teal outline number badge + description + color-coded direction label + chevron. Expanded: 5 editable fields (What You're Seeing, Cause, Switch To, Feet Adjustment, Direction). Direction color: green=#30D158, red=#FF453A, yellow=#FFD60A from emoji prefix of direction string.

**Ball Arsenal:** 9 expandable cards. Collapsed: StrengthDots (5 dots, teal/grey) + ball name + chevron. Expanded: Motion Profile + When To Use (both editable).

**Lane Reads:** 7 expandable cards. Collapsed: description + chevron. Expanded: What You're Seeing + What It Means + Recommendation (all editable).

**Animation:** `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)` before expand/collapse. Enabled for Android too.

**Toggle pills:** flex:1 each, teal active with black text + fontWeight:700, #1C1C1E inactive.

**TypeScript:** Uses `patchGuide/patchArsenal/patchLane` helpers with explicit `Partial<Type>` patches to avoid computed-key issues. `SetUpdater` type alias used for toggle helper.

### Pocket Diagnostics Sub-tab (Phase 10B)

**File:** components/PocketDiagnosticsTab.tsx

**Exports:** `PocketDiagnosticsTab` (default), `DiagnosticsData`, `DEFAULT_DIAGNOSTICS`

**Filter pills:** All Leaves · High Frequency · Common · Situational. Default: All Leaves. Switching filter collapses all expanded cards.

**14 cards (6 High Frequency, 7 Common, 1 Situational):** Each expandable. Collapsed: leave name (bold, flex:1) + colored frequency dot (9x9, borderRadius 4.5) + rotating chevron. Expanded: WHY IT HAPPENS / FIX / PATTERN TO WATCH (all editable TextInputs).

**Frequency dot colors:** High Frequency=#FF453A, Common=#FF9F0A, Situational=#FFD60A.

**Card background:** #2C2C2E (card color, not surface #1C1C1E).

**Filter logic:** `originalIndex` tracked through filter so patchCard always targets correct card in data.cards array.

**Animation:** LayoutAnimation.easeInEaseOut on expand/collapse.

### Patterns Sub-tab (Phase 10C)

**File:** components/PatternsTab.tsx

**Exports:** `PatternsTab` (default), `PatternsData`, `DEFAULT_PATTERNS`

**9 pattern cards (2 House, 6 Sport/PBA, 1 Regional):** Always fully expanded -- not collapsible.

**Filter pills:** All · House · Sport/PBA · Regional. Default: All.

**Card layout (top to bottom):** Lane diagram SVG · pattern name (bold, 16px) · metadata row (type badge + length + volume) · SUGGESTED LINE TextInput (teal text) · NOTES TextInput (white, multiline).

**Lane diagram:** SVG via react-native-svg (already installed). ViewBox "0 0 60 120", height=120px fixed, centered in card. Lane border at x=2,y=2 width=56 height=116. Foul line (red, 0.7 opacity) at y=110. Oil trapezoid from y=110 upward; height = (lengthFt/52)*108. Taper shapes:
- Heavy taper: top width 40% of lane (half-width=11.2 units)
- Moderate taper: top width 65% (half-width=18.5)
- Slight taper: top width 80% (half-width=23.5)
- Flat: top width 90% (same as bottom)
- Flat / Reverse block: slightly wider at top (half-width=26.3)
Oil fill: teal #00CEC9 at 22% opacity. Oil top edge line: teal 0.5 opacity. Length label: 7px SvgText at oilTopY-3.

**Static vs stored data:** PATTERNS constant holds name/type/length/volume/shape/defaults. PatternsData stores only `entries: Array<{ suggestedLine, notes }>` (parallel to PATTERNS array).

**Type badge colors:** House=teal bg/black text, Sport/PBA=orange #FF9F0A/black text, Regional=#38383A bg/#8E8E93 text.

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
| 10 | Reference: Signals + Diagnostics + Patterns | 75-90 min | 3 | Complete |
| 11 | Polish + Animations | 60-90 min | 1-2 | Complete |
| 12 | Build + Install | 60-90 min | 1 | Not started |

---

## Phase Details

### Phase 1 -- Environment Setup
**Completed:** March 6, 2026
Node v24.14.0, Git, VS Code, Claude Code v2.1.71, Expo CLI. PATH fix. PowerShell RemoteSigned.

---

### Phase 2 -- Data Layer
**Completed:** March 6, 2026
src/storage.js (10 exports), src/seeds.js (17 sessions), src/balls.js (9 balls). First-launch seed in _layout.tsx.

---

### Phase 3 -- Navigation Shell
**Completed:** March 6, 2026
4 tabs + log-frames route. Root redirect. Gear icon via useNavigation().setOptions(). TSC clean.

---

### Phase 4 -- Log Tab
**Completed:** (session before Phase 7)
All session types, ball picker, draft persistence, submit. Confirmed on device.

---

### Phase 5 -- Log Frames Screen
**Completed:** (session before Phase 7)
Live/Post-Game toggle, 10-frame logic, running score, haptic on strike. Confirmed on device.

---

### Phase 6 -- History Tab
**Completed:** (session before Phase 7)
All 17 seeded sessions. Filter pills. Expand/collapse. Swipe-delete. Confirmed on device.

---

### Phase 7 -- Stats Tab
**Completed:** March 10, 2026
Metrics + charts (react-native-chart-kit + react-native-svg). TSC clean. Confirmed on device.

---

### Phase 8 -- Settings Screen
**Completed:** March 15, 2026
components/SettingsContent.tsx. All 4 tabs wired. Season dates + ball roster. TSC clean. Pending device confirm.

---

### Phase 9 -- Reference: Position + Mental + Your Numbers
**Completed:** March 15, 2026

**Files modified:** app/(tabs)/reference.tsx -- complete rewrite from placeholder

**What was built:**
- 5 sub-tab bar (horizontal ScrollView, height 44, sticky): Position · Signals · Pocket Diagnostics · Mental · Patterns
- Position sub-tab: 6 position cards, editable Feet/Eyes/Notes, saves on blur
- Mental sub-tab: Shot Clock (static 4-row), 5 Mental Cues (editable), Your Numbers (7 rows), 3 freetext note cards
- Placeholders for Signals, Pocket Diagnostics, Patterns
- useFocusEffect loads from mbowl_reference_v1, mergeWithDefaults handles missing fields

TSC clean. Pending device confirmation.

---

### Phase 10 -- Reference: Signals + Pocket Diagnostics + Patterns
**Completed:** March 15, 2026

**Files created:**
- components/SignalsTab.tsx (Phase 10A)
- components/PocketDiagnosticsTab.tsx (Phase 10B)
- components/PatternsTab.tsx (Phase 10C)

**Files modified:** app/(tabs)/reference.tsx -- imports + ReferenceData schema + DEFAULT_DATA + mergeWithDefaults + render logic updated for all 3 sub-tabs

**Phase 10A -- Signals:**
- 3-view toggle (Switch Guide / Ball Arsenal / Lane Reads)
- Switch Guide: 11 expandable cards, direction color-coded, all fields editable
- Ball Arsenal: 9 expandable cards weakest→strongest, strength dots, motion profile + when-to-use editable
- Lane Reads: 7 expandable cards, 3 editable fields each
- LayoutAnimation.easeInEaseOut on expand/collapse
- `SetUpdater` type alias fixed TypeScript issue with toggle helper

**Phase 10B -- Pocket Diagnostics:**
- Filter pills: All Leaves / High Frequency / Common / Situational; switching filter collapses cards
- 14 expandable cards: 6 High Frequency (red dot), 7 Common (orange dot), 1 Situational (yellow dot)
- Expanded: Why It Happens / Fix / Pattern to Watch, all editable
- Uses originalIndex tracking so patch targets correct card through filtered view

**Phase 10C -- Patterns:**
- Filter pills: All / House / Sport/PBA / Regional
- 9 always-expanded cards: 2 House, 6 Sport/PBA, 1 Regional
- Lane diagram SVG (react-native-svg, already installed): 60px wide, 120px tall, teal oil trapezoid with taper shape per pattern, red foul line, length label
- Type badge with color per tier. Suggested Line (teal, single line) + Notes (white, multiline) both editable
- Only suggestedLine and notes stored per pattern; name/type/length/volume/shape are static constants

TSC clean. All 3 pending device confirmation.

---

### Phase 11 -- Polish + Animations
**Completed:** March 15, 2026

**Files created:**
- components/ScalePressable.tsx

**Files modified:**
- app/(tabs)/log.tsx
- app/(tabs)/history.tsx
- app/(tabs)/reference.tsx
- app/log-frames.tsx
- components/SettingsContent.tsx

**What was built:**
- ScalePressable.tsx: Reanimated spring scale (0.96 on pressIn, 1.0 on pressOut). Uses useSharedValue + useAnimatedStyle + withSpring. Damping 15, stiffness 400.
- Haptics fully audited and corrected:
  - Submit: notificationAsync(Success) → impactAsync(Heavy)
  - Ball select: impactAsync(Light) added
  - History delete confirm: notificationAsync(Warning) → impactAsync(Medium)
  - History filter pill: impactAsync(Light) added
  - Strike entry: impactAsync(Medium) → impactAsync(Light)
  - Discard frames: impactAsync(Medium) added before navigation.goBack()
  - Reference sub-tab switch: impactAsync(Light) added
- expo-blur installed. Draft resume sheet overlay uses BlurView intensity=60 tint="dark".
- KeyboardAvoidingView: already existed in log.tsx; added to SettingsContent.tsx (offset 0) and reference.tsx (offset 88).
- Loading states: History tab shows ActivityIndicator on focus before data loads. Reference tab gates content behind loaded flag with ActivityIndicator.
- Safe area: History FlatList uses useSafeAreaInsets for bottom padding.
- TSC clean.

Device walkthrough: pending.

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
| 8 | Phase 9 | Mar 15, 2026 | Reference tab. Full rewrite. 5 sub-tabs. Position (6 cards). Mental (Shot Clock, 5 Cues, Your Numbers, 3 notes). Placeholders for Signals/Diagnostics/Patterns. TSC clean. |
| 9 | Phase 10 | Mar 15, 2026 | Reference tab completed. SignalsTab.tsx (3 views: Switch Guide 11 cards, Ball Arsenal 9 cards, Lane Reads 7 cards). PocketDiagnosticsTab.tsx (14 cards, 4 filter pills, frequency dots). PatternsTab.tsx (9 cards, lane SVG diagrams via react-native-svg, oil taper shapes, type badges, 4 filter pills). All wired into reference.tsx with ReferenceData schema extended. TSC clean. Pending device confirmation. |
| 10 | Phase 11 | Mar 15, 2026 | Polish + Animations. ScalePressable.tsx (Reanimated spring). Haptics audit: 7 corrections/additions across 4 files. expo-blur installed; draft resume sheet uses BlurView. KAV added to SettingsContent + reference. Loading spinners for History + Reference. Safe area insets on History FlatList. TSC clean. Device walkthrough pending. |

---

## Post-v1 Backlog

- Session edit flow
- Ball strength ratings editable in Settings
