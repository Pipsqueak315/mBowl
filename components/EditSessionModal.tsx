import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  Keyboard,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { readBalls } from '@/src/storage';
import type { ThrowEntry, GameEntry, Ball, Session, LaneCondition } from '@/src/types';
import GameExtrasFields from '@/components/GameExtrasFields';
import SegmentedControl from '@/components/v2/SegmentedControl';
import KeyboardDoneBar, { DONE_BAR } from '@/components/v2/KeyboardDoneBar';
import { gameExtrasFromForm, gameExtrasToForm, gameExtrasInvalid, isCondition, DEFAULT_HOUSE, drillShots, normalizeDrill } from '@/src/extras';

const CONDITION_SEGMENTS = [
  { key: '', label: '—' },
  { key: 'fresh', label: 'Fresh' },
  { key: 'broken', label: 'Broken' },
  { key: 'pattern', label: 'Pattern' },
] as const satisfies readonly { key: LaneCondition | ''; label: string }[];

// Phase 31B: the per-game extras are rebuilt from the form, so an old copy of
// any of them never rides along after Marcus clears it.
const EXTRA_KEYS = ['speed', 'feet', 'target', 'switchFrame', 'switchBall'] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EditableSession = Session;

type EditGame = {
  game: number;
  score: string;
  ball: string;
  notes: string;
  frames: ThrowEntry[] | null;
  // Phase 31B form strings
  speed: string;
  feet: string;
  target: string;
  switchFrame: string;
  switchBall: string;
};
type SessionType = EditableSession['type'];
type MadeCut = 'Yes' | 'No' | 'N/A';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// v2.1 P5: the same segmented controls (and labels) as the Log form -- the
// old teal pills here were ~32pt tall, under the 44pt rule.
const SESSION_TYPES = [
  { key: 'league', label: 'League' },
  { key: 'makeup', label: 'Makeup' },
  { key: 'tournament', label: 'Tourney' },
  { key: 'practice', label: 'Practice' },
] as const satisfies readonly { key: SessionType; label: string }[];

const MADE_CUT_SEGMENTS = [
  { key: 'Yes', label: 'Yes' },
  { key: 'No', label: 'No' },
  { key: 'N/A', label: 'N/A' },
] as const satisfies readonly { key: MadeCut; label: string }[];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateDisplay(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function parseDate(iso: string): Date {
  return new Date(iso + 'T12:00:00');
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StrengthDots({ strength }: { strength: number }) {
  return (
    <View style={styles.dotsRow}>
      {[1, 2, 3, 4, 5].map(i => (
        <View key={i} style={[styles.dot, i <= strength ? styles.dotFilled : styles.dotEmpty]} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function EditSessionModal({
  session,
  visible,
  onClose,
  onSave,
  onEditFrames,
  initiallyDirty = false,
}: {
  session: EditableSession | null;
  visible: boolean;
  onClose: () => void;
  onSave: (updated: EditableSession) => void;
  /** Receives the live form state, plus the current dirty flag so a cancelled
   *  frame edit can restore it, so in-progress edits survive the frame editor. */
  onEditFrames?: (gameIndex: number, liveSession: EditableSession, wasDirty: boolean) => void;
  /** True when `session` already carries unsaved edits (e.g. returning from the
   *  frame editor) — keeps Cancel guarded instead of silently discarding them. */
  initiallyDirty?: boolean;
}) {
  const [sessionType, setSessionType] = useState<SessionType>('league');
  const [dateStr, setDateStr] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [week, setWeek] = useState('');
  const [opponent, setOpponent] = useState('');
  const [tournamentName, setTournamentName] = useState('');
  const [tournamentFormat, setTournamentFormat] = useState('');
  const [tournamentPattern, setTournamentPattern] = useState('');
  const [madeCut, setMadeCut] = useState<MadeCut>('N/A');
  const [placement, setPlacement] = useState('');
  const [games, setGames] = useState<EditGame[]>([]);
  const [sessionNotes, setSessionNotes] = useState('');
  const [ballPickerOpen, setBallPickerOpen] = useState(false);
  const [ballPickerForIndex, setBallPickerForIndex] = useState<number | null>(null);
  const ballPickerFieldRef = useRef<'ball' | 'switchBall'>('ball');
  // Phase 31B
  const [house, setHouse] = useState('');
  const [condition, setCondition] = useState<LaneCondition | null>(null);
  const [availableBalls, setAvailableBalls] = useState<Ball[]>([]);
  const isDirty = useRef(false);
  const savedScoresRef = useRef<string[]>([]);
  // Mirrored so the populate effect can read the latest value without taking it
  // as a dependency — re-running that effect would wipe the edits it guards.
  const initiallyDirtyRef = useRef(initiallyDirty);
  initiallyDirtyRef.current = initiallyDirty;

  // Populate state from session whenever modal opens
  useEffect(() => {
    if (!session || !visible) return;
    let active = true;
    // Normally a fresh open starts clean, but a session handed back from the
    // frame editor already carries unsaved edits — stay dirty so Cancel warns.
    isDirty.current = initiallyDirtyRef.current;
    setSessionType(session.type);
    setDateStr(session.date);
    setShowDatePicker(false);
    setWeek(session.week != null ? String(session.week) : '');
    setOpponent(session.opponent ?? '');
    setTournamentName(session.name ?? '');
    setTournamentFormat(session.format ?? '');
    setTournamentPattern(session.pattern ?? '');
    setMadeCut((session.madeCut as MadeCut) ?? 'N/A');
    setPlacement(session.placement ?? '');
    // F11: each game's score as it was saved, for the override confirm below.
    savedScoresRef.current = session.games.map(g => (g.score != null ? String(g.score) : ''));
    setGames(
      session.games.map(g => ({
        game: g.game,
        score: g.score != null ? String(g.score) : '',
        ball: g.ball ?? '',
        notes: g.notes ?? '',
        frames: g.frames ?? null,
        ...gameExtrasToForm(g),
      }))
    );
    setSessionNotes(session.notes ?? '');
    setHouse(session.house ?? '');
    setCondition(isCondition(session.condition) ? session.condition : null);
    readBalls().then(b => {
      if (active) setAvailableBalls(b.filter(ball => ball.active).sort((a, b) => a.strength - b.strength));
    });
    return () => { active = false; };
  }, [session, visible]);

  const markDirty = () => {
    isDirty.current = true;
  };

  function handleCancel() {
    if (isDirty.current) {
      Alert.alert('Discard changes?', 'Are you sure you want to discard your edits?', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onClose },
      ]);
    } else {
      onClose();
    }
  }

  // Snapshot the live form state as a Session. Used by Save, and by Edit Frames
  // so in-progress field edits survive the round trip to the frame editor.
  function buildSession(): EditableSession | null {
    if (!session) return null;
    return {
      // Phase 31B: start from the saved session so any field this sheet does
      // not edit (drill counts, anything newer) is carried, never dropped.
      ...session,
      id: session.id,
      type: sessionType,
      date: dateStr,
      week:
        sessionType === 'league' || sessionType === 'makeup'
          ? parseInt(week, 10) || null
          : null,
      opponent:
        sessionType === 'league' || sessionType === 'makeup'
          ? opponent.trim() || null
          : null,
      name: sessionType === 'tournament' ? tournamentName.trim() || null : null,
      format: sessionType === 'tournament' ? tournamentFormat.trim() || null : null,
      pattern: sessionType === 'tournament' ? tournamentPattern.trim() || null : null,
      madeCut: sessionType === 'tournament' ? madeCut : null,
      placement: sessionType === 'tournament' ? placement.trim() || null : null,
      games: games.map((g, i) => {
        const saved: Partial<GameEntry> = { ...(session.games[i] ?? {}) };
        for (const k of EXTRA_KEYS) delete saved[k];
        return {
          ...saved,
          game: g.game,
          score: g.score ? parseInt(g.score, 10) : null,
          ball: g.ball || null,
          frames: g.frames,
          notes: g.notes.trim() || null,
          ...gameExtrasFromForm(g),
        };
      }),
      notes: sessionNotes.trim() || null,
      house: house.trim() || null,
      condition,
      // Kept whatever the type (a type change must never delete drill counts).
      drill: session.drill ?? null,
    };
  }

  // F11 (Nov 15): typing a new score on a game that has frames used to save
  // silently, so the score (average) and the frames (strike %, leaves) then
  // disagreed. Same confirm the Log form uses: keep the frame score or override.
  /** v2.1 P1: true when ending an edit would ask "Override Saved Score?". */
  function overridePending(): boolean {
    return games.some((g, i) => {
      const saved = savedScoresRef.current[i] ?? '';
      return !!g.frames && g.frames.length > 0 && g.score !== '' && g.score !== saved;
    });
  }

  function confirmScoreOverride(i: number) {
    const g = games[i];
    const saved = savedScoresRef.current[i] ?? '';
    if (!g || !g.frames || g.frames.length === 0) return;
    if (g.score === '' || g.score === saved) return;
    Alert.alert(
      'Override Saved Score?',
      `This game has frame data and was saved as ${saved || 'no score'}. Save ${g.score} instead? The frames stay as they are.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () =>
            setGames(prev => prev.map((gm, idx) => (idx === i ? { ...gm, score: saved } : gm))),
        },
        {
          text: 'Override',
          style: 'destructive',
          // Asked once: the new score is now the one to compare against.
          onPress: () => {
            savedScoresRef.current[i] = g.score;
          },
        },
      ]
    );
  }

  function handleSave() {
    if (!session) return;
    const hasScore = games.some(g => g.score !== '');
    if (!hasScore && !(sessionType === 'practice' && drillShots(normalizeDrill(session.drill)) > 0)) {
      Alert.alert('No scores entered', 'Enter at least one score before saving.');
      return;
    }
    const bad = games.findIndex(g => gameExtrasInvalid(g).length > 0);
    if (bad >= 0) {
      Alert.alert(
        'Check game ' + games[bad].game,
        `${gameExtrasInvalid(games[bad]).join(', ')} can't be saved. Fix or clear it, then save.`
      );
      return;
    }
    const updated = buildSession();
    if (!updated) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onSave(updated);
  }

  const showWeek = sessionType === 'league' || sessionType === 'makeup';
  const showOpponent = sessionType === 'league' || sessionType === 'makeup';
  const showTournament = sessionType === 'tournament';

  if (!session) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      supportedOrientations={['portrait', 'landscape']}
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleCancel}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.cancelBtn}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Session</Text>
          <TouchableOpacity
            onPress={handleSave}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.saveBtn}>Save</Text>
          </TouchableOpacity>
        </View>

        {/* v2.1 P1 / P8: the ScrollView insets itself by the keyboard (a
            KeyboardAvoidingView inside a pageSheet measured the wrong height),
            and a tap on a control with the keyboard up works the first time. */}
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
          >
            {/* Session type */}
            <View style={styles.typeBar}>
              <SegmentedControl
                segments={SESSION_TYPES}
                value={sessionType}
                onChange={(k) => {
                  setSessionType(k);
                  markDirty();
                }}
                accessibilityLabel="Session type"
              />
            </View>

            {/* Date */}
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.fieldRow}
                onPress={() => {
                  Keyboard.dismiss(); // v2.1 P1
                  setShowDatePicker(v => !v);
                }}
              >
                <Text style={styles.fieldLabel}>Date</Text>
                <Text style={styles.fieldValueTeal}>{formatDateDisplay(dateStr)}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(false)}
                    style={styles.pickerDoneRow}
                  >
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </TouchableOpacity>
                  <DateTimePicker
                    value={parseDate(dateStr)}
                    mode="date"
                    display="spinner"
                    onChange={(_e, d) => {
                      if (d) {
                        setDateStr(toISODate(d));
                        markDirty();
                      }
                    }}
                    textColor="#FFFFFF"
                    style={styles.datePicker}
                  />
                </>
              )}
            </View>

            {/* Week */}
            {showWeek && (
              <View style={styles.card}>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Week</Text>
                  <TextInput
                    style={styles.weekInput}
                    value={week}
                    onChangeText={v => {
                      setWeek(v);
                      markDirty();
                    }}
                    keyboardType="number-pad"
                    placeholder="—"
                    placeholderTextColor="#48484A"
                    inputAccessoryViewID={DONE_BAR.edit}
                    selectTextOnFocus
                  />
                </View>
              </View>
            )}

            {/* Opponent */}
            {showOpponent && (
              <View style={styles.card}>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Opponent</Text>
                  <TextInput
                    style={styles.inlineInput}
                    value={opponent}
                    onChangeText={v => {
                      setOpponent(v);
                      markDirty();
                    }}
                    placeholder="Optional"
                    placeholderTextColor="#48484A"
                    returnKeyType="done"
                    autoCorrect={false}
                  />
                </View>
              </View>
            )}

            {/* Tournament fields */}
            {showTournament && (
              <>
                <View style={styles.card}>
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Name</Text>
                    <TextInput
                      style={styles.inlineInput}
                      value={tournamentName}
                      onChangeText={v => {
                        setTournamentName(v);
                        markDirty();
                      }}
                      placeholder="Tournament name"
                      placeholderTextColor="#48484A"
                      returnKeyType="done"
                      autoCorrect={false}
                    />
                  </View>
                </View>
                <View style={styles.card}>
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Format</Text>
                    <TextInput
                      style={styles.inlineInput}
                      value={tournamentFormat}
                      onChangeText={v => {
                        setTournamentFormat(v);
                        markDirty();
                      }}
                      placeholder="e.g. Match Play"
                      placeholderTextColor="#48484A"
                      returnKeyType="done"
                      autoCorrect={false}
                    />
                  </View>
                </View>
                <View style={styles.card}>
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Pattern</Text>
                    <TextInput
                      style={styles.inlineInput}
                      value={tournamentPattern}
                      onChangeText={v => {
                        setTournamentPattern(v);
                        markDirty();
                      }}
                      placeholder="e.g. Chameleon 39'"
                      placeholderTextColor="#48484A"
                      returnKeyType="done"
                      autoCorrect={false}
                    />
                  </View>
                </View>
                <View style={styles.card}>
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Made cut</Text>
                    <View style={styles.madeCutBar}>
                      <SegmentedControl
                        segments={MADE_CUT_SEGMENTS}
                        value={madeCut}
                        onChange={(k) => {
                          setMadeCut(k);
                          markDirty();
                        }}
                        accessibilityLabel="Made cut"
                      />
                    </View>
                  </View>
                </View>
                <View style={styles.card}>
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Placement</Text>
                    <TextInput
                      style={styles.inlineInput}
                      value={placement}
                      onChangeText={v => {
                        setPlacement(v);
                        markDirty();
                      }}
                      placeholder="e.g. 3rd"
                      placeholderTextColor="#48484A"
                      returnKeyType="done"
                      autoCorrect={false}
                    />
                  </View>
                </View>
              </>
            )}

            {/* Phase 31B: house + lanes */}
            <View style={styles.card}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>House</Text>
                <TextInput
                  style={styles.inlineInput}
                  value={house}
                  onChangeText={v => {
                    setHouse(v);
                    markDirty();
                  }}
                  placeholder={DEFAULT_HOUSE}
                  placeholderTextColor="#48484A"
                  returnKeyType="done"
                  autoCorrect={false}
                />
              </View>
              <View style={styles.laneRow}>
                <Text style={styles.fieldLabel}>Lanes</Text>
                <SegmentedControl
                  segments={CONDITION_SEGMENTS}
                  value={condition ?? ''}
                  onChange={k => {
                    setCondition(k === '' ? null : k);
                    markDirty();
                  }}
                  accessibilityLabel="Lane condition"
                />
              </View>
            </View>

            {/* Games */}
            {games.map((g, i) => (
              <View key={g.game} style={styles.gameCard}>
                <Text style={styles.gameLabel}>Game {g.game}</Text>

                {/* Score */}
                <View style={styles.scoreRow}>
                  <Text style={styles.fieldLabel}>Score</Text>
                  <TextInput
                    style={styles.scoreInput}
                    value={g.score}
                    onChangeText={v => {
                      const digits = v.replace(/[^0-9]/g, '');
                      const val =
                        digits === '' ? '' : String(Math.min(300, parseInt(digits, 10)));
                      setGames(prev =>
                        prev.map((gm, idx) => (idx === i ? { ...gm, score: val } : gm))
                      );
                      markDirty();
                    }}
                    onEndEditing={() => confirmScoreOverride(i)}
                    keyboardType="number-pad"
                    placeholder="—"
                    placeholderTextColor="#48484A"
                    maxLength={3}
                    inputAccessoryViewID={DONE_BAR.edit}
                    selectTextOnFocus
                  />
                </View>

                {/* Ball */}
                <TouchableOpacity
                  style={styles.ballRow}
                  onPress={() => {
                    Keyboard.dismiss(); // v2.1 P1
                    ballPickerFieldRef.current = 'ball';
                    setBallPickerForIndex(i);
                    setBallPickerOpen(true);
                  }}
                >
                  <Text style={styles.fieldLabel}>Ball</Text>
                  <Text style={g.ball ? styles.fieldValueTeal : styles.fieldValueDim}>
                    {g.ball || 'Select...'}
                  </Text>
                </TouchableOpacity>

                {/* Phase 31B: line, speed, ball switch */}
                <GameExtrasFields
                  value={g}
                  onChange={(field, v) => {
                    setGames(prev => prev.map((gm, idx) => (idx === i ? { ...gm, [field]: v } : gm)));
                    markDirty();
                  }}
                  onPickSwitchBall={() => {
                    ballPickerFieldRef.current = 'switchBall';
                    setBallPickerForIndex(i);
                    setBallPickerOpen(true);
                  }}
                  doneBarId={DONE_BAR.edit}
                />

                {/* Frame data edit button */}
                {onEditFrames && (
                  <TouchableOpacity
                    style={styles.editFramesButton}
                    onPress={() => {
                      // v2.1 P1: with the keyboard up, closing it can run the
                      // score field's "Override Saved Score?" check. When that
                      // question is pending, this tap only closes the keyboard so
                      // the answer lands before the sheet closes.
                      if (Keyboard.isVisible() && overridePending()) {
                        Keyboard.dismiss();
                        return;
                      }
                      Keyboard.dismiss();
                      const live = buildSession();
                      if (live) onEditFrames(i, live, isDirty.current);
                    }}
                  >
                    <Text style={styles.editFramesText}>
                      {g.frames && g.frames.length > 0 ? 'Edit frames' : 'Log frames'}
                    </Text>
                    <IconSymbol name="chevron.right" size={14} color="#8E8E93" />
                  </TouchableOpacity>
                )}

                {/* Game notes */}
                <TextInput
                  style={styles.gameNotesInput}
                  value={g.notes}
                  onChangeText={v => {
                    setGames(prev =>
                      prev.map((gm, idx) => (idx === i ? { ...gm, notes: v } : gm))
                    );
                    markDirty();
                  }}
                  placeholder="Game notes..."
                  placeholderTextColor="#48484A"
                  multiline
                />
              </View>
            ))}

            {/* Session notes */}
            <View style={styles.card}>
              <TextInput
                style={styles.sessionNotesInput}
                value={sessionNotes}
                onChangeText={v => {
                  setSessionNotes(v);
                  markDirty();
                }}
                placeholder="Session notes..."
                placeholderTextColor="#48484A"
                multiline
              />
            </View>

            <View style={styles.bottomSpacer} />
          </ScrollView>
          <KeyboardDoneBar id={DONE_BAR.edit} />

        {/* Ball picker modal */}
        <Modal
          visible={ballPickerOpen}
          animationType="slide"
          supportedOrientations={['portrait', 'landscape']}
          presentationStyle="pageSheet"
          onRequestClose={() => setBallPickerOpen(false)}
        >
          <SafeAreaView style={styles.ballPickerContainer}>
            <View style={styles.ballPickerHeader}>
              <Text style={styles.ballPickerTitle}>Select Ball</Text>
              <TouchableOpacity
                onPress={() => setBallPickerOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.saveBtn}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.ballPickerContent}>
              {availableBalls.length === 0 ? (
                <Text style={styles.noBallsText}>
                  No active balls. Add balls in Settings.
                </Text>
              ) : (
                availableBalls.map(ball => {
                  const isSelected =
                    ballPickerForIndex !== null &&
                    games[ballPickerForIndex]?.[ballPickerFieldRef.current] === ball.name;
                  return (
                    <TouchableOpacity
                      key={ball.id}
                      style={[
                        styles.ballPickerRow,
                        isSelected && styles.ballPickerRowSelected,
                      ]}
                      onPress={() => {
                        if (ballPickerForIndex !== null) {
                          setGames(prev =>
                            prev.map((g, idx) =>
                              idx === ballPickerForIndex
                                ? { ...g, [ballPickerFieldRef.current]: ball.name }
                                : g
                            )
                          );
                          markDirty();
                        }
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setBallPickerOpen(false);
                        setBallPickerForIndex(null);
                      }}
                    >
                      <StrengthDots strength={ball.strength} />
                      <Text style={styles.ballPickerName}>{ball.name}</Text>
                      {isSelected && (
                        <IconSymbol name="checkmark" size={16} color="#00CEC9" />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  laneRow: {
    paddingVertical: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#38383A',
  },
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#000000' },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383A',
    backgroundColor: '#000000',
  },
  title: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  cancelBtn: { fontSize: 17, fontWeight: '500', color: '#8E8E93' },
  saveBtn: { fontSize: 17, fontWeight: '600', color: '#00CEC9' },

  // Scroll content
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  bottomSpacer: { height: 40 },

  // Type bar
  typeBar: { marginBottom: 16 },

  // Card
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 13,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  fieldLabel: { fontSize: 15, color: '#FFFFFF', fontWeight: '500' },
  fieldValueTeal: { fontSize: 15, color: '#00CEC9' },
  fieldValueDim: { fontSize: 15, color: '#48484A' },

  // Date picker
  pickerDoneRow: { alignItems: 'flex-end', paddingTop: 4, paddingRight: 2 },
  pickerDoneText: { fontSize: 15, color: '#00CEC9', fontWeight: '600' },
  datePicker: { marginBottom: 4 },

  // Inputs
  weekInput: {
    fontSize: 15,
    color: '#00CEC9',
    textAlign: 'right',
    minWidth: 60,
    padding: 0,
  },
  inlineInput: {
    fontSize: 15,
    color: '#00CEC9',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
    padding: 0,
  },

  // Game card
  gameCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 13,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    marginBottom: 12,
  },
  // v2.1 P11: sentence case like the Log form's game cards (no tiny all-caps)
  gameLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383A',
  },
  scoreInput: {
    fontSize: 22,
    fontWeight: '300',
    color: '#00CEC9',
    textAlign: 'right',
    minWidth: 60,
    padding: 0,
  },
  ballRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383A',
  },
  editFramesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  editFramesText: { fontSize: 15, color: '#FFFFFF' },
  gameNotesInput: {
    fontSize: 14,
    color: '#8E8E93',
    paddingVertical: 10,
    minHeight: 36,
  },

  // Session notes
  sessionNotesInput: {
    fontSize: 14,
    color: '#8E8E93',
    paddingVertical: 14,
    minHeight: 56,
  },

  // Tournament Made Cut (v2.1 P5: segmented control, same width as the Log form)
  madeCutBar: { width: 170 },

  // Ball picker
  ballPickerContainer: { flex: 1, backgroundColor: '#000000' },
  ballPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383A',
  },
  ballPickerTitle: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  ballPickerContent: { paddingHorizontal: 16, paddingTop: 8 },
  ballPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383A',
  },
  ballPickerRowSelected: { backgroundColor: '#1C1C1E' },
  ballPickerName: { flex: 1, fontSize: 16, color: '#FFFFFF', fontWeight: '500' },
  noBallsText: {
    color: '#48484A',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 40,
  },

  // Strength dots (read-only display in ball picker)
  dotsRow: { flexDirection: 'row', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotFilled: { backgroundColor: '#00CEC9' },
  dotEmpty: { backgroundColor: '#38383A' },
});
