import { useState, useLayoutEffect, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSideInsets } from '@/src/v2/page';
import { useNavigation, useFocusEffect } from 'expo-router/react-navigation';

import HeaderIconButton from '@/components/v2/HeaderIconButton';
import SettingsContent from '@/components/SettingsContent';
import SignalsTab, { SignalsData, DEFAULT_SIGNALS } from '@/components/SignalsTab';
import PocketDiagnosticsTab, {
  DiagnosticsData,
  DEFAULT_DIAGNOSTICS,
} from '@/components/PocketDiagnosticsTab';
import { type PatternsData, DEFAULT_PATTERNS } from '@/components/PatternsTab';
import { readReferenceResult, writeReference } from '@/src/storage';
import { writeBackup } from '@/src/backup';
import { onDataChanged, notifyDataChanged } from '@/src/dataEvents';
import SegmentedControl from '@/components/v2/SegmentedControl';
import { upgradeReference } from '@/src/referenceUpgrade';
import { YOUR_NUMBERS_KNOWN } from '@/src/referenceContent';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Reference trim (Nov 15, scope locked Nov 11): Position and Patterns are no
// longer shown. Their data (position[], patterns) stays in ReferenceData and
// round-trips through mergeWithDefaults on every save -- REFERENCE has no
// shadow key, so dropping fields would erase them. Hidden, not deleted.
type SubTab = 'Signals' | 'Pocket Diagnostics' | 'Mental';

interface PositionRow {
  scenario: string; // not editable
  feet: string;
  eyes: string;
  notes: string;
}

interface MentalCue {
  label: string;
  body: string;
}

interface YourNumbers {
  ballSpeed: string;
  revRate: string;
  axisTilt: string;
  axisRotation: string;
  pap: string;
  dominantMiss: string;
  layDownBoard: string;
}

type NotesKey = 'speedNotes' | 'releaseNotes' | 'pressureTendencies';

interface ReferenceData {
  position: PositionRow[];
  mentalCues: MentalCue[];
  yourNumbers: YourNumbers;
  speedNotes: string;
  releaseNotes: string;
  pressureTendencies: string;
  signals: SignalsData;
  pocketDiagnostics: DiagnosticsData;
  patterns: PatternsData;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Phase 30B (Nov 24, Marcus: "the toolbar going all the way... should look clean
// like the history tab"): the sub-tabs are the shared SegmentedControl inside
// the safe areas, not a grey band under the Duo rail. "Diagnostics" fits the
// cover screen; the key stays 'Pocket Diagnostics'.
const SUB_TABS = [
  { key: 'Signals', label: 'Signals' },
  { key: 'Pocket Diagnostics', label: 'Diagnostics' },
  { key: 'Mental', label: 'Mental' },
] as const satisfies readonly { key: SubTab; label: string }[];

const DEFAULT_DATA: ReferenceData = {
  position: [
    {
      scenario: 'Default Stance',
      feet: 'Board 20',
      eyes: 'Board 12',
      notes: 'Baseline — all adjustments relative to this',
    },
    {
      scenario: 'Fresh / Clean',
      feet: 'Board 20',
      eyes: 'Board 12',
      notes: 'Hold position, let the ball work',
    },
    {
      scenario: 'Lane Hooking Early',
      feet: 'Right 1–3',
      eyes: 'Board 12–13',
      notes: 'Move feet with ball to reduce angle',
    },
    {
      scenario: 'Lane Playing Flat',
      feet: 'Left 1–3',
      eyes: 'Board 11–12',
      notes: 'Open angle, eyes track with feet',
    },
    {
      scenario: 'Mid-Transition',
      feet: 'Board 17–19',
      eyes: 'Board 11',
      notes: 'Lane opening outside, ball reads sooner',
    },
    {
      scenario: 'Heavy / Dry',
      feet: 'Board 15–17',
      eyes: 'Board 10–11',
      notes: 'Eyes come in with feet',
    },
  ],
  mentalCues: [
    {
      label: 'The loop starts with self-criticism',
      body: 'Minor error → grief → tilt → scoreboard → more errors. The intervention happens at the grief step. Catch it early.',
    },
    {
      label: 'After a bad shot',
      body: "Take a breath. Name one thing you'll do differently. Step up. That's the whole routine.",
    },
    {
      label: 'Check yourself',
      body: 'Ask: "Am I bowling this shot or the last one?" Still on the last one? Reset. On this one? Go.',
    },
    {
      label: "You're never out of it",
      body: "Don't check the scoreboard. Don't do the math. Bowl the shot in front of you. Strings happen fast.",
    },
    {
      label: 'Mental fatigue is real',
      body: 'Fatigue shows up as overthinking. Simpler is better late in a set. Ball, line, shot.',
    },
  ],
  yourNumbers: {
    ballSpeed: '',
    revRate: '',
    axisTilt: '',
    axisRotation: '',
    pap: YOUR_NUMBERS_KNOWN.pap,
    dominantMiss: YOUR_NUMBERS_KNOWN.dominantMiss,
    layDownBoard: '',
  },
  speedNotes: '',
  releaseNotes: '',
  pressureTendencies: '',
  signals: DEFAULT_SIGNALS,
  pocketDiagnostics: DEFAULT_DIAGNOSTICS,
  patterns: DEFAULT_PATTERNS,
};

const SHOT_CLOCK = [
  {
    frame: 'Frame 1',
    role: 'Gather only',
    action: 'No decisions. Watch exit board, entry angle, pin action.',
  },
  {
    frame: 'Frame 2',
    role: 'Confirm',
    action: 'Does it match Frame 1? Mixed signals — stay patient.',
  },
  {
    frame: 'Frame 3',
    role: 'Pull the trigger',
    action: 'Same read twice = switch and commit. Mixed = feet only.',
  },
  {
    frame: 'Frame 4+',
    role: 'Locked in',
    action: 'Done deliberating. Ball changes after Frame 4 are tilt-driven.',
  },
];

const YOUR_NUMBERS_ROWS: Array<{
  key: keyof YourNumbers;
  label: string;
  placeholder: string;
}> = [
  { key: 'ballSpeed', label: 'Ball Speed', placeholder: '16.0 mph' },
  { key: 'revRate', label: 'Rev Rate', placeholder: '~250 rpm' },
  { key: 'axisTilt', label: 'Axis Tilt', placeholder: '15°' },
  { key: 'axisRotation', label: 'Axis Rotation', placeholder: '45°' },
  { key: 'pap', label: 'PAP', placeholder: '4½ over / ½ up' },
  { key: 'dominantMiss', label: 'Dominant Miss', placeholder: 'Left / Right' },
  { key: 'layDownBoard', label: 'Lay Down Board', placeholder: 'Board 15' },
];

const NOTES_SECTIONS: Array<{ key: NotesKey; label: string }> = [
  { key: 'speedNotes', label: 'Speed Notes' },
  { key: 'releaseNotes', label: 'Release Notes' },
  { key: 'pressureTendencies', label: 'Pressure Tendencies' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mergeWithDefaults(stored: Record<string, unknown>): ReferenceData {
  return {
    position: Array.isArray(stored.position)
      ? (stored.position as PositionRow[])
      : DEFAULT_DATA.position,
    mentalCues: Array.isArray(stored.mentalCues)
      ? (stored.mentalCues as MentalCue[])
      : DEFAULT_DATA.mentalCues,
    yourNumbers:
      stored.yourNumbers && typeof stored.yourNumbers === 'object'
        ? { ...DEFAULT_DATA.yourNumbers, ...(stored.yourNumbers as Partial<YourNumbers>) }
        : DEFAULT_DATA.yourNumbers,
    speedNotes: typeof stored.speedNotes === 'string' ? stored.speedNotes : '',
    releaseNotes: typeof stored.releaseNotes === 'string' ? stored.releaseNotes : '',
    pressureTendencies:
      typeof stored.pressureTendencies === 'string' ? stored.pressureTendencies : '',
    signals:
      stored.signals && typeof stored.signals === 'object'
        ? { ...DEFAULT_SIGNALS, ...(stored.signals as Partial<SignalsData>) }
        : DEFAULT_SIGNALS,
    pocketDiagnostics:
      stored.pocketDiagnostics && typeof stored.pocketDiagnostics === 'object'
        ? { ...DEFAULT_DIAGNOSTICS, ...(stored.pocketDiagnostics as Partial<DiagnosticsData>) }
        : DEFAULT_DIAGNOSTICS,
    patterns:
      stored.patterns && typeof stored.patterns === 'object'
        ? { ...DEFAULT_PATTERNS, ...(stored.patterns as Partial<PatternsData>) }
        : DEFAULT_PATTERNS,
  };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ReferenceScreen() {
  // Phase 28: pad by the side safe areas so nothing sits under the Duo's tab
  // rail or status column (Nov 10 Duo check F1/F2).
  const sideInsets = useSideInsets();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SubTab>('Signals');
  const [data, setData] = useState<ReferenceData>(DEFAULT_DATA);
  const [loaded, setLoaded] = useState(false);
  // F5 (Nov 15): REFERENCE has no shadow key. If the stored blob failed to
  // read, the page shows the defaults -- saving "defaults + one edit" over it
  // would erase the real content for good, so saving is blocked until a clean
  // read. Re-read after a Restore (A8) so an edit never writes the old copy.
  const readableRef = useRef(false);
  const warnedRef = useRef(false);
  const [dataTick, setDataTick] = useState(0);
  useEffect(() => onDataChanged((source) => {
    if (source === 'restore') setDataTick(n => n + 1);
  }), []);
  const latestData = useRef<ReferenceData>(DEFAULT_DATA);
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderIconButton
          icon="gearshape"
          onPress={() => setSettingsOpen(true)}
          accessibilityLabel="Settings"
        />
      ),
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoaded(false);
      (async () => {
        const read = await readReferenceResult();
        if (!active) return;
        readableRef.current = read.status === 'ok' || read.status === 'missing';
        warnedRef.current = false;
        let stored = read.value;
        // Phase 30B: one-time content upgrade (src/referenceUpgrade.ts) --
        // only on a clean read of real stored data; rows Marcus edited are
        // never touched. REFERENCE has no shadow key, so a failed write just
        // leaves the old copy and the upgrade runs again next time.
        if (read.status === 'ok') {
          const up = upgradeReference(stored);
          if (up.changed) {
            const ok = await writeReference(up.value);
            if (!active) return;
            if (ok) {
              stored = up.value;
              void writeBackup();
              notifyDataChanged('reference');
            }
          }
        }
        if (stored) {
          const merged = mergeWithDefaults(stored);
          setData(merged);
          latestData.current = merged;
        } else {
          setData(DEFAULT_DATA);
          latestData.current = DEFAULT_DATA;
        }
        setLoaded(true);
      })();
      return () => { active = false; };
    }, [dataTick]),
  );

  // Update state and ref atomically — prevents stale closure in save()
  function update(updater: (prev: ReferenceData) => ReferenceData) {
    setData(prev => {
      const next = updater(prev);
      latestData.current = next;
      return next;
    });
  }

  function save() {
    if (!readableRef.current) {
      if (!warnedRef.current) {
        warnedRef.current = true;
        Alert.alert(
          "Can't save Reference edits",
          "Your saved Reference content couldn't be read, so edits here won't be saved (saving now could erase it). Relaunch the app and try again."
        );
      }
      return;
    }
    void writeReference(latestData.current as unknown as Record<string, unknown>).then((ok) => {
      if (!ok) {
        Alert.alert("Couldn't save Reference edits", 'The phone could not save the change (storage may be full).');
        return;
      }
      void writeBackup();
      notifyDataChanged('reference');
    });
  }

  // -------------------------------------------------------------------------
  // Typed field helpers (avoids computed-key TypeScript complexity)
  // -------------------------------------------------------------------------

  function updateNotes(key: NotesKey, v: string) {
    if (key === 'speedNotes') update(prev => ({ ...prev, speedNotes: v }));
    else if (key === 'releaseNotes') update(prev => ({ ...prev, releaseNotes: v }));
    else update(prev => ({ ...prev, pressureTendencies: v }));
  }

  function getNotesValue(key: NotesKey): string {
    if (key === 'speedNotes') return data.speedNotes;
    if (key === 'releaseNotes') return data.releaseNotes;
    return data.pressureTendencies;
  }

  // -------------------------------------------------------------------------
  // Mental tab
  // -------------------------------------------------------------------------

  function renderMentalTab() {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
      >
        {/* ---- Shot Clock (static) ---- */}
        <Text style={styles.sectionLabel}>Shot clock</Text>
        <View style={styles.card}>
          {/* Header */}
          <View style={[styles.shotClockRow, styles.shotClockHeaderRow]}>
            <Text style={[styles.shotClockFrame, styles.shotClockHeaderText]}>FRAME</Text>
            <Text style={[styles.shotClockRole, styles.shotClockHeaderText]}>ROLE</Text>
            <Text style={[styles.shotClockAction, styles.shotClockHeaderText]}>ACTION</Text>
          </View>
          {SHOT_CLOCK.map(row => (
            <View key={row.frame}>
              <View style={styles.separator} />
              <View style={styles.shotClockRow}>
                <Text style={[styles.shotClockFrame, styles.shotClockFrameText]}>
                  {row.frame}
                </Text>
                <Text style={[styles.shotClockRole, styles.shotClockRoleText]}>
                  {row.role}
                </Text>
                <Text style={[styles.shotClockAction, styles.shotClockActionText]}>
                  {row.action}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* ---- Mental Cues (editable) ---- */}
        <Text style={styles.sectionLabel}>Mental cues</Text>
        {data.mentalCues.map((cue, index) => (
          <View key={index} style={styles.card}>
            <View style={styles.cueHeaderRow}>
              <View style={styles.cueNumBadge}>
                <Text style={styles.cueNumText}>{index + 1}</Text>
              </View>
              <TextInput
                style={styles.cueLabelInput}
                value={cue.label}
                onChangeText={v =>
                  update(prev => ({
                    ...prev,
                    mentalCues: prev.mentalCues.map((c, i) =>
                      i === index ? { ...c, label: v } : c,
                    ),
                  }))
                }
                onBlur={save}
                returnKeyType="done"
                placeholder="Cue title..."
                placeholderTextColor="#48484A"
              />
            </View>
            <TextInput
              style={styles.cueBodyInput}
              value={cue.body}
              onChangeText={v =>
                update(prev => ({
                  ...prev,
                  mentalCues: prev.mentalCues.map((c, i) =>
                    i === index ? { ...c, body: v } : c,
                  ),
                }))
              }
              onBlur={save}
              placeholder="Description..."
              placeholderTextColor="#48484A"
              multiline
              textAlignVertical="top"
            />
          </View>
        ))}

        {/* ---- Your Numbers (editable) ---- */}
        <Text style={styles.sectionLabel}>Your numbers</Text>
        <View style={styles.card}>
          {YOUR_NUMBERS_ROWS.map((row, index) => (
            <View key={row.key}>
              {index > 0 && <View style={styles.separator} />}
              <View style={styles.numbersRow}>
                <Text style={styles.numbersLabel}>{row.label}</Text>
                <TextInput
                  style={styles.numbersInput}
                  value={data.yourNumbers[row.key]}
                  onChangeText={v =>
                    update(prev => ({
                      ...prev,
                      yourNumbers: {
                        ...prev.yourNumbers,
                        [row.key]: v,
                      } as YourNumbers,
                    }))
                  }
                  onBlur={save}
                  returnKeyType="done"
                  placeholder={row.placeholder}
                  placeholderTextColor="#48484A"
                  textAlign="right"
                />
              </View>
            </View>
          ))}
        </View>

        {/* ---- Freetext notes blocks ---- */}
        {NOTES_SECTIONS.map(({ key, label }) => (
          <View key={key} style={styles.card}>
            <Text style={styles.notesCardLabel}>{label}</Text>
            <TextInput
              style={styles.notesCardInput}
              value={getNotesValue(key)}
              onChangeText={v => updateNotes(key, v)}
              onBlur={save}
              placeholder="Add notes..."
              placeholderTextColor="#48484A"
              multiline
              textAlignVertical="top"
            />
          </View>
        ))}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      <KeyboardAvoidingView
        style={[styles.container, { paddingLeft: sideInsets.left, paddingRight: sideInsets.right }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={88}
      >
        {/* Sub-tabs -- sticky, inside the safe areas (like History's filter) */}
        <View style={styles.subTabBar}>
          <SegmentedControl
            segments={SUB_TABS}
            value={activeTab}
            onChange={setActiveTab}
            accessibilityLabel="Reference section"
          />
        </View>

        {/* Tab content */}
        {!loaded ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8E8E93" />
          </View>
        ) : (
          <>
            {activeTab === 'Signals' && (
              <SignalsTab
                data={data.signals}
                onUpdate={updated => update(prev => ({ ...prev, signals: updated }))}
                onSave={save}
              />
            )}
            {activeTab === 'Pocket Diagnostics' && (
              <PocketDiagnosticsTab
                data={data.pocketDiagnostics}
                onUpdate={updated => update(prev => ({ ...prev, pocketDiagnostics: updated }))}
                onSave={save}
              />
            )}
            {activeTab === 'Mental' && renderMentalTab()}
          </>
        )}
      </KeyboardAvoidingView>

      {/* Settings Modal */}
      <Modal
        visible={settingsOpen}
        animationType="slide"
        supportedOrientations={['portrait', 'landscape']}
        presentationStyle="pageSheet"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <SettingsContent onClose={() => setSettingsOpen(false)} />
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---- Sub-tabs (Phase 30B: segmented control, no band) ----
  subTabBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },

  // ---- Scroll + content ----
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 40,
  },

  // ---- Section label ----
  // Phase 30B: Stats-style section headers (20/600, sentence case).
  sectionLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },

  // ---- Card ----
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 13,
    padding: 16,
    marginBottom: 20,
  },
  separator: {
    height: 0.5,
    backgroundColor: '#38383A',
  },

  // ---- Position rows ----
  scenarioName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 14,
  },
  feetEyesRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  feetEyesCol: {
    flex: 1,
  },
  feetEyesDivider: {
    width: 0.5,
    backgroundColor: '#38383A',
    marginHorizontal: 14,
  },
  subFieldLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#8E8E93',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  fieldInput: {
    fontSize: 15,
    color: '#00CEC9',
    padding: 0,
    minHeight: 22,
  },
  notesRow: {
    borderTopWidth: 0.5,
    borderTopColor: '#38383A',
    paddingTop: 12,
  },
  notesInput: {
    fontSize: 14,
    color: '#FFFFFF',
    padding: 0,
    minHeight: 20,
    lineHeight: 20,
  },

  // ---- Shot Clock ----
  shotClockRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    alignItems: 'flex-start',
  },
  shotClockHeaderRow: {
    paddingTop: 0,
    paddingBottom: 6,
  },
  shotClockHeaderText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#8E8E93',
    letterSpacing: 0.6,
  },
  shotClockFrame: {
    width: 66,
  },
  shotClockRole: {
    width: 98,
  },
  shotClockAction: {
    flex: 1,
  },
  shotClockFrameText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#00CEC9',
  },
  shotClockRoleText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  shotClockActionText: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
  },

  // ---- Mental Cues ----
  cueHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  cueNumBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#00CEC9',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  cueNumText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
  },
  cueLabelInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    padding: 0,
    minHeight: 22,
  },
  cueBodyInput: {
    fontSize: 14,
    color: '#8E8E93',
    padding: 0,
    minHeight: 40,
    lineHeight: 20,
  },

  // ---- Your Numbers ----
  numbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  numbersLabel: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  numbersInput: {
    fontSize: 15,
    color: '#00CEC9',
    padding: 0,
    minWidth: 90,
    flexShrink: 1,
  },

  // ---- Notes cards ----
  notesCardLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E8E93',
    marginBottom: 10,
  },
  notesCardInput: {
    fontSize: 14,
    color: '#FFFFFF',
    padding: 0,
    minHeight: 60,
    lineHeight: 20,
  },

  // ---- Gear button ----

  // ---- Bottom spacer ----
  bottomSpacer: {
    height: 40,
  },
});
