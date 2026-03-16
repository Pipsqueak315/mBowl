import { useState, useLayoutEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import SettingsContent from '@/components/SettingsContent';
import SignalsTab, { SignalsData, DEFAULT_SIGNALS } from '@/components/SignalsTab';
import PocketDiagnosticsTab, {
  DiagnosticsData,
  DEFAULT_DIAGNOSTICS,
} from '@/components/PocketDiagnosticsTab';
import PatternsTab, { PatternsData, DEFAULT_PATTERNS } from '@/components/PatternsTab';
import { readReference, writeReference } from '@/src/storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SubTab = 'Position' | 'Signals' | 'Pocket Diagnostics' | 'Mental' | 'Patterns';

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

const SUB_TABS: SubTab[] = [
  'Position',
  'Signals',
  'Pocket Diagnostics',
  'Mental',
  'Patterns',
];

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
    pap: '',
    dominantMiss: '',
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SubTab>('Position');
  const [data, setData] = useState<ReferenceData>(DEFAULT_DATA);
  const latestData = useRef<ReferenceData>(DEFAULT_DATA);
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setSettingsOpen(true)}
          style={styles.gearButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <IconSymbol name="gearshape.fill" size={22} color="#8E8E93" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const stored = await readReference();
        if (stored) {
          const merged = mergeWithDefaults(stored as Record<string, unknown>);
          setData(merged);
          latestData.current = merged;
        } else {
          setData(DEFAULT_DATA);
          latestData.current = DEFAULT_DATA;
        }
      })();
    }, []),
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
    void writeReference(latestData.current);
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
  // Position tab
  // -------------------------------------------------------------------------

  function renderPositionTab() {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
      >
        <Text style={styles.sectionLabel}>POSITION</Text>

        {data.position.map((row, index) => (
          <View key={row.scenario} style={styles.card}>
            {/* Scenario name — not editable */}
            <Text style={styles.scenarioName}>{row.scenario}</Text>

            {/* Feet + Eyes side by side */}
            <View style={styles.feetEyesRow}>
              <View style={styles.feetEyesCol}>
                <Text style={styles.subFieldLabel}>FEET</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={row.feet}
                  onChangeText={v =>
                    update(prev => ({
                      ...prev,
                      position: prev.position.map((r, i) =>
                        i === index ? { ...r, feet: v } : r,
                      ),
                    }))
                  }
                  onBlur={save}
                  returnKeyType="done"
                  placeholder="—"
                  placeholderTextColor="#48484A"
                />
              </View>
              <View style={styles.feetEyesDivider} />
              <View style={styles.feetEyesCol}>
                <Text style={styles.subFieldLabel}>EYES</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={row.eyes}
                  onChangeText={v =>
                    update(prev => ({
                      ...prev,
                      position: prev.position.map((r, i) =>
                        i === index ? { ...r, eyes: v } : r,
                      ),
                    }))
                  }
                  onBlur={save}
                  returnKeyType="done"
                  placeholder="—"
                  placeholderTextColor="#48484A"
                />
              </View>
            </View>

            {/* Notes full width */}
            <View style={styles.notesRow}>
              <Text style={styles.subFieldLabel}>NOTES</Text>
              <TextInput
                style={styles.notesInput}
                value={row.notes}
                onChangeText={v =>
                  update(prev => ({
                    ...prev,
                    position: prev.position.map((r, i) =>
                      i === index ? { ...r, notes: v } : r,
                    ),
                  }))
                }
                onBlur={save}
                placeholder="Add notes..."
                placeholderTextColor="#48484A"
                multiline
                textAlignVertical="top"
              />
            </View>
          </View>
        ))}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    );
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
        <Text style={styles.sectionLabel}>SHOT CLOCK</Text>
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
        <Text style={styles.sectionLabel}>MENTAL CUES</Text>
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
        <Text style={styles.sectionLabel}>YOUR NUMBERS</Text>
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
  // Placeholder tab
  // -------------------------------------------------------------------------

  function renderPlaceholder(name: string) {
    return (
      <View style={styles.placeholderContainer}>
        <IconSymbol name="book.fill" size={48} color="#48484A" />
        <Text style={styles.placeholderTitle}>{name}</Text>
        <Text style={styles.placeholderText}>Coming soon</Text>
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      <View style={styles.container}>
        {/* Sub-tab bar — sticky, does not scroll with content */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.subTabBar}
          contentContainerStyle={styles.subTabBarContent}
          bounces={false}
        >
          {SUB_TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              style={styles.subTabItem}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Text style={[styles.subTabText, activeTab === tab && styles.subTabTextActive]}>
                {tab}
              </Text>
              {activeTab === tab && <View style={styles.subTabIndicator} />}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Tab content */}
        {activeTab === 'Position' && renderPositionTab()}
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
        {activeTab === 'Patterns' && (
          <PatternsTab
            data={data.patterns}
            onUpdate={updated => update(prev => ({ ...prev, patterns: updated }))}
            onSave={save}
          />
        )}
      </View>

      {/* Settings Modal */}
      <Modal
        visible={settingsOpen}
        animationType="slide"
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

  // ---- Sub-tab bar ----
  subTabBar: {
    height: 44,
    backgroundColor: '#1C1C1E',
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383A',
    flexGrow: 0,
  },
  subTabBarContent: {
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  subTabItem: {
    height: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  subTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  subTabTextActive: {
    color: '#00CEC9',
    fontWeight: '600',
  },
  subTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 14,
    right: 14,
    height: 2,
    backgroundColor: '#00CEC9',
    borderRadius: 1,
  },

  // ---- Scroll + content ----
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },

  // ---- Section label ----
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '700',
    color: '#000000',
  },
  cueLabelInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
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
    fontWeight: '600',
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

  // ---- Placeholder ----
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 60,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#48484A',
  },
  placeholderText: {
    fontSize: 15,
    color: '#48484A',
  },

  // ---- Gear button ----
  gearButton: {
    marginRight: 16,
  },

  // ---- Bottom spacer ----
  bottomSpacer: {
    height: 40,
  },
});
