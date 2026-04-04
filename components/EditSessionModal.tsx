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
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from '@/components/ui/icon-symbol';
import ScalePressable from '@/components/ScalePressable';
import { readBalls } from '@/src/storage';
import type { ThrowEntry, GameEntry, Ball, Session } from '@/src/types';

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
};
type SessionType = EditableSession['type'];
type MadeCut = 'Yes' | 'No' | 'N/A';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_TYPES: { key: SessionType; label: string }[] = [
  { key: 'league', label: 'League' },
  { key: 'makeup', label: 'Makeup' },
  { key: 'tournament', label: 'Tournament' },
  { key: 'practice', label: 'Practice' },
];

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
}: {
  session: EditableSession | null;
  visible: boolean;
  onClose: () => void;
  onSave: (updated: EditableSession) => void;
  onEditFrames?: (gameIndex: number) => void;
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
  const [availableBalls, setAvailableBalls] = useState<Ball[]>([]);
  const isDirty = useRef(false);

  // Populate state from session whenever modal opens
  useEffect(() => {
    if (!session || !visible) return;
    let active = true;
    isDirty.current = false;
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
    setGames(
      session.games.map(g => ({
        game: g.game,
        score: g.score != null ? String(g.score) : '',
        ball: g.ball ?? '',
        notes: g.notes ?? '',
        frames: g.frames ?? null,
      }))
    );
    setSessionNotes(session.notes ?? '');
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

  function handleSave() {
    if (!session) return;
    const hasScore = games.some(g => g.score !== '');
    if (!hasScore) {
      Alert.alert('No scores entered', 'Enter at least one score before saving.');
      return;
    }

    const updated: EditableSession = {
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
      games: games.map(g => ({
        game: g.game,
        score: g.score ? parseInt(g.score, 10) : null,
        ball: g.ball || null,
        frames: g.frames,
        notes: g.notes.trim() || null,
      })),
      notes: sessionNotes.trim() || null,
    };

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

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            {/* Session type */}
            <View style={styles.typeBar}>
              {SESSION_TYPES.map(({ key, label }) => (
                <ScalePressable
                  key={key}
                  style={[styles.typePill, sessionType === key && styles.typePillActive]}
                  onPress={() => {
                    setSessionType(key);
                    markDirty();
                  }}
                >
                  <Text
                    style={[
                      styles.typePillText,
                      sessionType === key && styles.typePillTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </ScalePressable>
              ))}
            </View>

            {/* Date */}
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.fieldRow}
                onPress={() => setShowDatePicker(v => !v)}
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
                    returnKeyType="done"
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
                    />
                  </View>
                </View>
                <View style={styles.card}>
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Made Cut</Text>
                    <View style={styles.madeCutOptions}>
                      {(['Yes', 'No', 'N/A'] as const).map(opt => (
                        <ScalePressable
                          key={opt}
                          style={[
                            styles.madeCutBtn,
                            madeCut === opt && styles.madeCutBtnActive,
                          ]}
                          onPress={() => {
                            setMadeCut(opt);
                            markDirty();
                          }}
                        >
                          <Text
                            style={[
                              styles.madeCutBtnText,
                              madeCut === opt && styles.madeCutBtnTextActive,
                            ]}
                          >
                            {opt}
                          </Text>
                        </ScalePressable>
                      ))}
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
                    />
                  </View>
                </View>
              </>
            )}

            {/* Games */}
            {games.map((g, i) => (
              <View key={g.game} style={styles.gameCard}>
                <Text style={styles.gameLabel}>GAME {g.game}</Text>

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
                    keyboardType="number-pad"
                    placeholder="—"
                    placeholderTextColor="#48484A"
                    maxLength={3}
                    returnKeyType="done"
                  />
                </View>

                {/* Ball */}
                <TouchableOpacity
                  style={styles.ballRow}
                  onPress={() => {
                    setBallPickerForIndex(i);
                    setBallPickerOpen(true);
                  }}
                >
                  <Text style={styles.fieldLabel}>Ball</Text>
                  <Text style={g.ball ? styles.fieldValueTeal : styles.fieldValueDim}>
                    {g.ball || 'Select...'}
                  </Text>
                </TouchableOpacity>

                {/* Frame data edit button */}
                {onEditFrames && (
                  <TouchableOpacity
                    style={styles.editFramesButton}
                    onPress={() => onEditFrames(i)}
                  >
                    <Text style={styles.editFramesText}>
                      {g.frames && g.frames.length > 0 ? 'Edit Frames' : 'Log Frames'}
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
        </KeyboardAvoidingView>

        {/* Ball picker modal */}
        <Modal
          visible={ballPickerOpen}
          animationType="slide"
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
                    games[ballPickerForIndex]?.ball === ball.name;
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
                              idx === ballPickerForIndex ? { ...g, ball: ball.name } : g
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
  typeBar: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typePill: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#38383A',
  },
  typePillActive: { backgroundColor: '#00CEC9', borderColor: '#00CEC9' },
  typePillText: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },
  typePillTextActive: { color: '#000000' },

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
  gameLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
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
    fontWeight: '700',
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

  // Tournament Made Cut
  madeCutOptions: { flexDirection: 'row', gap: 8 },
  madeCutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#2C2C2E',
    borderWidth: 1,
    borderColor: '#38383A',
  },
  madeCutBtnActive: { backgroundColor: '#00CEC9', borderColor: '#00CEC9' },
  madeCutBtnText: { fontSize: 14, fontWeight: '500', color: '#8E8E93' },
  madeCutBtnTextActive: { color: '#000000' },

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
