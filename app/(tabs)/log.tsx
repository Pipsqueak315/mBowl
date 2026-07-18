import { useState, useLayoutEffect, useEffect, useRef, useCallback } from 'react';
import SettingsContent from '@/components/SettingsContent';
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
import { BlurView } from 'expo-blur';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Swipeable } from 'react-native-gesture-handler';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { FRAME_RESULT_KEY } from '@/app/log-frames';
import * as Haptics from 'expo-haptics';

import { IconSymbol } from '@/components/ui/icon-symbol';
import ScalePressable from '@/components/ScalePressable';
import { FrameGrid } from '@/components/FrameGrid';
import {
  readSessionsResult,
  writeSessions,
  readBalls,
  readDraft,
  writeDraft,
  readSettings,
} from '@/src/storage';
import { writeBackup } from '@/src/backup';
import type { ThrowEntry, Ball, DraftData } from '@/src/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_SEASON_START = '2025-09-06';

function calcWeek(d: Date, seasonStartISO?: string | null): number {
  const start = new Date((seasonStartISO ?? DEFAULT_SEASON_START) + 'T00:00:00');
  const diff = d.getTime() - start.getTime();
  if (diff < 0) return 1;
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function makeGame(): Game {
  return { id: String(Date.now() + Math.random()), score: '', ball: '', notes: '' };
}

// Does this draft hold anything a user would want restored? Date and week are
// auto-initialised on mount/reset, so they are NOT content — a form carrying
// only those is the empty skeleton. The auto-save effect uses this to refuse
// persisting an empty draft, which is the single guard behind S5 and S6:
//   S5 — post-submit resetForm() must not recreate a phantom empty draft.
//   S6 — mount setWeek() must not overwrite the real persisted draft (still in
//        pendingDraft memory) with the empty form while Resume is pending.
// Returning false here makes auto-save SKIP (never writeDraft(null)), so an
// existing persisted draft is preserved, not deleted.
function draftHasContent(d: DraftData): boolean {
  if (d.opponent?.trim()) return true;
  if (d.sessionNotes?.trim()) return true;
  if (d.tournamentName?.trim()) return true;
  if (d.tournamentFormat?.trim()) return true;
  if (d.tournamentPattern?.trim()) return true;
  if (d.placement?.trim()) return true;
  if (d.madeCut && d.madeCut !== 'N/A') return true;
  if (d.sessionType && d.sessionType !== 'league') return true;
  for (const g of d.games ?? []) {
    if (g.score) return true;
    if (g.ball) return true;
    if (g.notes?.trim()) return true;
    if (g.frames && g.frames.length > 0) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SessionType = 'league' | 'makeup' | 'tournament' | 'practice';
type MadeCut = 'Yes' | 'No' | 'N/A';
type Game = { id: string; score: string; ball: string; notes: string; frames?: ThrowEntry[]; calculatedScore?: number };

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StrengthDots({ strength }: { strength: number }) {
  return (
    <View style={styles.dotsRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={[styles.dot, i <= strength ? styles.dotFilled : styles.dotEmpty]} />
      ))}
    </View>
  );
}

type GameRowProps = {
  game: Game;
  index: number;
  onChange: (field: 'score' | 'ball' | 'notes', value: string) => void;
  onPickBall: () => void;
  onLogFrames: () => void;
};

function GameRow({ game, index, onChange, onPickBall, onLogFrames }: GameRowProps) {
  function handleScoreEndEditing() {
    if (game.calculatedScore === undefined) return;
    const entered = parseInt(game.score, 10);
    if (isNaN(entered) || entered === game.calculatedScore) return;
    Alert.alert(
      'Override Calculated Score?',
      `This game has a calculated score of ${game.calculatedScore} from frame data. Replace with ${entered}?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => onChange('score', String(game.calculatedScore)) },
        { text: 'Override', style: 'destructive' },
      ]
    );
  }

  return (
    <View style={styles.gameCard}>
      <Text style={styles.gameLabel}>GAME {index + 1}</Text>

      {/* Score */}
      <View style={styles.scoreRow}>
        <Text style={styles.fieldLabel}>Score</Text>
        <TextInput
          style={styles.scoreInput}
          value={game.score}
          onChangeText={(v) => {
            const digits = v.replace(/[^0-9]/g, '');
            if (digits === '') { onChange('score', ''); return; }
            onChange('score', String(Math.min(300, parseInt(digits, 10))));
          }}
          onEndEditing={handleScoreEndEditing}
          keyboardType="number-pad"
          placeholder="—"
          placeholderTextColor="#48484A"
          maxLength={3}
          returnKeyType="done"
        />
      </View>

      {/* Ball */}
      <TouchableOpacity style={styles.ballRow} onPress={onPickBall}>
        <Text style={styles.fieldLabel}>Ball</Text>
        <Text style={game.ball ? styles.fieldValueTeal : styles.fieldValueDim}>
          {game.ball || 'Select...'}
        </Text>
      </TouchableOpacity>

      {/* Inline mini scorecard — shown when frame data exists */}
      {game.frames && game.frames.length > 0 && (
        <View style={styles.miniScorecardWrapper}>
          <FrameGrid frames={game.frames} variant="compact" />
        </View>
      )}

      {/* Log / Edit Frames button */}
      <TouchableOpacity
        style={styles.logFramesButton}
        onPress={onLogFrames}
      >
        <Text style={styles.logFramesText}>
          {game.frames && game.frames.length > 0 ? 'Edit Frames' : 'Log Frames'}
        </Text>
        <IconSymbol name="chevron.right" size={14} color="#8E8E93" />
      </TouchableOpacity>

      {/* Game notes */}
      <TextInput
        style={styles.gameNotesInput}
        value={game.notes}
        onChangeText={(v) => onChange('notes', v)}
        placeholder="Game notes..."
        placeholderTextColor="#48484A"
        multiline
      />
    </View>
  );
}

const SESSION_TYPES: { key: SessionType; label: string }[] = [
  { key: 'league', label: 'League' },
  { key: 'makeup', label: 'Makeup' },
  { key: 'tournament', label: 'Tournament' },
  { key: 'practice', label: 'Practice' },
];

const MADE_CUT_OPTIONS: MadeCut[] = ['Yes', 'No', 'N/A'];

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function LogScreen() {
  const navigation = useNavigation();
  const initialized = useRef(false);
  // Tracks the loaded season start ISO string for week calculation without a settings state
  const seasonStartRef = useRef<string | null>(null);
  // Debounce handle for draft auto-save
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Core form
  const [sessionType, setSessionType] = useState<SessionType>('league');
  const [date, setDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [week, setWeek] = useState(() => String(calcWeek(new Date(), null)));
  // League / Makeup
  const [opponent, setOpponent] = useState('');
  // Tournament
  const [tournamentName, setTournamentName] = useState('');
  const [tournamentFormat, setTournamentFormat] = useState('');
  const [tournamentPattern, setTournamentPattern] = useState('');
  const [madeCut, setMadeCut] = useState<MadeCut>('N/A');
  const [placement, setPlacement] = useState('');
  // Games
  const [games, setGames] = useState<Game[]>([makeGame()]);
  // Session notes
  const [sessionNotes, setSessionNotes] = useState('');
  // Ball picker
  const [ballPickerOpen, setBallPickerOpen] = useState(false);
  const [ballPickerForGameId, setBallPickerForGameId] = useState<string | null>(null);
  const [availableBalls, setAvailableBalls] = useState<Ball[]>([]);
  // Draft resume
  const [draftResumeVisible, setDraftResumeVisible] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<DraftData | null>(null);
  // Settings modal
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Used by Manage Balls → Settings transition to avoid setTimeout timing hack
  const pendingOpenSettings = useRef(false);

  // ---- Mount: load balls + check for draft --------------------------------
  useEffect(() => {
    async function init() {
      const [balls, draft, settingsData] = await Promise.all([readBalls(), readDraft(), readSettings()]);
      if (balls) {
        setAvailableBalls(balls.filter((b) => b.active).sort((a, b) => a.strength - b.strength));
      }
      if (draft) {
        setPendingDraft(draft);
        setDraftResumeVisible(true);
      }
      // Recalculate week using actual season start now that settings are loaded
      if (settingsData?.seasonStart) {
        seasonStartRef.current = settingsData.seasonStart;
        setWeek(String(calcWeek(new Date(), settingsData.seasonStart)));
      }
      initialized.current = true;
    }
    init();
  }, []);

  // ---- Reload balls when Settings modal closes ----------------------------
  const wasSettingsOpen = useRef(false);
  useEffect(() => {
    if (wasSettingsOpen.current && !settingsOpen) {
      let active = true;
      readBalls().then(b => {
        if (active && b) setAvailableBalls(b.filter(ball => ball.active).sort((a, b) => a.strength - b.strength));
      });
      return () => { active = false; };
    }
    wasSettingsOpen.current = settingsOpen;
  }, [settingsOpen]);

  // ---- Read frame result when returning from log-frames -------------------
  useFocusEffect(
    useCallback(() => {
      let active = true;
      AsyncStorage.getItem(FRAME_RESULT_KEY).then((raw) => {
        if (!active || !raw) return;
        AsyncStorage.removeItem(FRAME_RESULT_KEY);
        const result = JSON.parse(raw) as {
          gameIndex: number;
          score: number;
          frames: ThrowEntry[];
        };
        setGames((prev) =>
          prev.map((g, i) =>
            i === result.gameIndex
              ? { ...g, score: String(result.score), frames: result.frames, calculatedScore: result.score }
              : g
          )
        );
      });
      return () => { active = false; };
    }, [])
  );

  // ---- Auto-save draft on every form change (debounced 400ms) -------------
  useEffect(() => {
    if (!initialized.current) return;
    const draft: DraftData = {
      sessionType,
      date: date.toISOString(),
      week,
      opponent,
      tournamentName,
      tournamentFormat,
      tournamentPattern,
      madeCut,
      placement,
      games,
      sessionNotes,
    };
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      // Only persist a draft the user has actually put content into. Skipping an
      // empty form here (rather than writing it, or clearing to null) is the one
      // guard that fixes both S5 and S6 — see draftHasContent above.
      if (draftHasContent(draft)) writeDraft(draft);
    }, 400);
    return () => {
      if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    };
  }, [
    sessionType, date, week, opponent,
    tournamentName, tournamentFormat, tournamentPattern, madeCut, placement,
    games, sessionNotes,
  ]);

  // ---- Header gear icon ---------------------------------------------------
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

  // ---- Helpers ------------------------------------------------------------

  const handleDateChange = (_event: unknown, selectedDate?: Date) => {
    if (selectedDate) {
      setDate(selectedDate);
      setWeek(String(calcWeek(selectedDate, seasonStartRef.current)));
    }
  };

  const addGame = () => setGames((prev) => [...prev, makeGame()]);

  const confirmRemove = (id: string) => {
    Alert.alert('Remove Game', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setGames((prev) => prev.filter((g) => g.id !== id)),
      },
    ]);
  };

  const updateGame = (id: string, field: 'score' | 'ball' | 'notes', value: string) =>
    setGames((prev) => prev.map((g) => (g.id === id ? { ...g, [field]: value } : g)));

  const openBallPicker = (gameId: string) => {
    setBallPickerForGameId(gameId);
    readBalls().then(b => {
      if (b) setAvailableBalls(b.filter(ball => ball.active).sort((a, b) => a.strength - b.strength));
    });
    setBallPickerOpen(true);
  };

  const selectBall = (ballName: string) => {
    if (ballPickerForGameId) updateGame(ballPickerForGameId, 'ball', ballName);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBallPickerOpen(false);
    setBallPickerForGameId(null);
  };

  function resetForm() {
    const now = new Date();
    setSessionType('league');
    setDate(now);
    setWeek(String(calcWeek(now)));
    setOpponent('');
    setTournamentName('');
    setTournamentFormat('');
    setTournamentPattern('');
    setMadeCut('N/A');
    setPlacement('');
    setGames([makeGame()]);
    setSessionNotes('');
    setShowDatePicker(false);
  }

  // ---- Draft resume -------------------------------------------------------

  function resumeDraft() {
    if (!pendingDraft) return;
    const d = pendingDraft;
    setSessionType(d.sessionType);
    setDate(new Date(d.date));
    setWeek(d.week ?? '');
    setOpponent(d.opponent ?? '');
    setTournamentName(d.tournamentName ?? '');
    setTournamentFormat(d.tournamentFormat ?? '');
    setTournamentPattern(d.tournamentPattern ?? '');
    setMadeCut(d.madeCut ?? 'N/A');
    setPlacement(d.placement ?? '');
    setGames(d.games?.length ? d.games : [makeGame()]);
    setSessionNotes(d.sessionNotes ?? '');
    setDraftResumeVisible(false);
    setPendingDraft(null);
  }

  async function discardDraft() {
    await writeDraft(null);
    setDraftResumeVisible(false);
    setPendingDraft(null);
  }

  // ---- Submit -------------------------------------------------------------

  async function handleSubmit() {
    const hasScore = games.some((g) => g.score !== '');
    if (!hasScore) {
      Alert.alert('No scores entered', 'Enter at least one score before submitting.');
      return;
    }
    if (sessionType === 'league' && !opponent.trim()) {
      Alert.alert('Opponent required', 'Enter an opponent name for League sessions.');
      return;
    }

    const session = {
      id: Date.now(),
      type: sessionType,
      date: formatDateISO(date),
      week: (sessionType === 'league' || sessionType === 'makeup')
        ? parseInt(week, 10) || null
        : null,
      opponent: (sessionType === 'league' || sessionType === 'makeup')
        ? opponent.trim() || null
        : null,
      name: sessionType === 'tournament' ? tournamentName.trim() || null : null,
      format: sessionType === 'tournament' ? tournamentFormat.trim() || null : null,
      pattern: sessionType === 'tournament' ? tournamentPattern.trim() || null : null,
      madeCut: sessionType === 'tournament' ? madeCut : null,
      placement: sessionType === 'tournament' ? placement.trim() || null : null,
      games: games.map((g, i) => ({
        game: i + 1,
        score: g.score ? parseInt(g.score, 10) : null,
        ball: g.ball || null,
        frames: g.frames
          ? g.frames.map((f) => ({
              throws: f.throws,
              note: f.note || null,
              throwNotes: f.throwNotes ?? {},
              pinsStanding: f.pinsStanding ?? null,
            }))
          : null,
        notes: g.notes.trim() || null,
      })),
      notes: sessionNotes.trim() || null,
    };

    // writeSessions is a full replace — `existing` becomes the entire store.
    // A failed or corrupt read reports [], and appending to that would erase
    // every saved session. Refuse instead; the draft is left untouched so the
    // just-entered session survives, and the shadow-key restore on next launch
    // repairs the store.
    const existingRead = await readSessionsResult();
    if (existingRead.status === 'invalid' || existingRead.status === 'error') {
      Alert.alert(
        'Could not save session',
        'Your saved sessions could not be read. This session was not saved, because saving now would overwrite your history. Your entry is kept as a draft — please relaunch the app and try again.'
      );
      return;
    }
    await writeSessions([session, ...existingRead.value]);
    void writeBackup();
    await writeDraft(null);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    resetForm();
    router.navigate('/(tabs)/stats');
  }

  // ---- Render -------------------------------------------------------------

  const showWeek = sessionType === 'league' || sessionType === 'makeup';
  const showOpponent = sessionType === 'league' || sessionType === 'makeup';
  const showTournament = sessionType === 'tournament';

  const currentBallForPicker = ballPickerForGameId
    ? games.find((g) => g.id === ballPickerForGameId)?.ball ?? ''
    : '';

  return (
    <>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={88}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {/* ---- Type selector ---- */}
          <View style={styles.typeBar}>
            {SESSION_TYPES.map(({ key, label }) => (
              <ScalePressable
                key={key}
                style={[styles.typePill, sessionType === key && styles.typePillActive]}
                onPress={() => setSessionType(key)}
              >
                <Text style={[styles.typePillText, sessionType === key && styles.typePillTextActive]}>
                  {label}
                </Text>
              </ScalePressable>
            ))}
          </View>

          {/* ---- Date ---- */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.fieldRow}
              onPress={() => setShowDatePicker((v) => !v)}
            >
              <Text style={styles.fieldLabel}>Date</Text>
              <Text style={styles.fieldValueTeal}>{formatDate(date)}</Text>
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
                  value={date}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  textColor="#FFFFFF"
                  style={styles.datePicker}
                />
              </>
            )}
          </View>

          {/* ---- Week (League / Makeup) ---- */}
          {showWeek && (
            <View style={styles.card}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Week</Text>
                <TextInput
                  style={styles.weekInput}
                  value={week}
                  onChangeText={setWeek}
                  keyboardType="number-pad"
                  placeholder="—"
                  placeholderTextColor="#48484A"
                  returnKeyType="done"
                />
              </View>
            </View>
          )}

          {/* ---- Opponent (League / Makeup) ---- */}
          {showOpponent && (
            <View style={styles.card}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>
                  Opponent
                  {sessionType === 'league' && <Text style={styles.required}> *</Text>}
                </Text>
                <TextInput
                  style={styles.inlineInput}
                  value={opponent}
                  onChangeText={setOpponent}
                  placeholder={sessionType === 'league' ? 'Required' : 'Optional'}
                  placeholderTextColor="#48484A"
                  returnKeyType="done"
                />
              </View>
            </View>
          )}

          {/* ---- Tournament fields ---- */}
          {showTournament && (
            <>
              <View style={styles.card}>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Name</Text>
                  <TextInput
                    style={styles.inlineInput}
                    value={tournamentName}
                    onChangeText={setTournamentName}
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
                    onChangeText={setTournamentFormat}
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
                    onChangeText={setTournamentPattern}
                    placeholder="e.g. Chameleon 39'"
                    placeholderTextColor="#48484A"
                    returnKeyType="done"
                  />
                </View>
              </View>
              <View style={styles.card}>
                <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.fieldLabel}>Made Cut</Text>
                  <View style={styles.madeCutBar}>
                    {MADE_CUT_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[
                          styles.madeCutPill,
                          madeCut === opt && styles.madeCutPillActive,
                        ]}
                        onPress={() => setMadeCut(opt)}
                      >
                        <Text
                          style={[
                            styles.madeCutText,
                            madeCut === opt && styles.madeCutTextActive,
                          ]}
                        >
                          {opt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
              <View style={styles.card}>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Finish / Place</Text>
                  <TextInput
                    style={styles.inlineInput}
                    value={placement}
                    onChangeText={setPlacement}
                    placeholder="e.g. 3rd"
                    placeholderTextColor="#48484A"
                    returnKeyType="done"
                  />
                </View>
              </View>
            </>
          )}

          {/* ---- Games ---- */}
          <Text style={styles.sectionLabel}>GAMES</Text>
          {games.map((game, index) => (
            <Swipeable
              key={game.id}
              renderRightActions={() =>
                games.length > 1 ? (
                  <TouchableOpacity
                    style={styles.swipeDelete}
                    onPress={() => confirmRemove(game.id)}
                  >
                    <Text style={styles.swipeDeleteText}>Remove</Text>
                  </TouchableOpacity>
                ) : null
              }
              overshootRight={false}
            >
              <GameRow
                game={game}
                index={index}
                onChange={(f, v) => updateGame(game.id, f, v)}
                onPickBall={() => openBallPicker(game.id)}
                onLogFrames={() => router.push({
                  pathname: '/log-frames',
                  params: {
                    gameIndex: String(index),
                    priorScores: games.slice(0, index).map((g) => parseInt(g.score, 10) || 0).join(','),
                    ...(game.frames && game.frames.length > 0
                      ? { initialFrames: JSON.stringify(game.frames) }
                      : {}),
                  },
                })}
              />
            </Swipeable>
          ))}
          <ScalePressable style={styles.addGameButton} onPress={addGame}>
            <Text style={styles.addGameText}>+ Add Game</Text>
          </ScalePressable>

          {/* ---- Session notes ---- */}
          <Text style={styles.sectionLabel}>SESSION NOTES</Text>
          <View style={styles.card}>
            <TextInput
              style={styles.sessionNotesInput}
              value={sessionNotes}
              onChangeText={setSessionNotes}
              placeholder="Optional notes about this session..."
              placeholderTextColor="#48484A"
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* ---- Submit ---- */}
          <ScalePressable style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitText}>Submit Session</Text>
          </ScalePressable>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ================================================================
          Ball Picker Modal
      ================================================================ */}
      <Modal
        visible={ballPickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setBallPickerOpen(false)}
        onDismiss={() => {
          if (pendingOpenSettings.current) {
            pendingOpenSettings.current = false;
            setSettingsOpen(true);
          }
        }}
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Ball</Text>
            <TouchableOpacity onPress={() => setBallPickerOpen(false)}>
              <Text style={styles.doneText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <ScrollView>
            {availableBalls.length === 0 ? (
              <View style={styles.ballPickerEmpty}>
                <Text style={styles.ballPickerEmptyText}>
                  No balls configured.{'\n'}Tap Manage Balls below to add your arsenal.
                </Text>
              </View>
            ) : (
              availableBalls.map((ball) => {
                const selected = ball.name === currentBallForPicker;
                return (
                  <TouchableOpacity
                    key={ball.id}
                    style={styles.ballPickerRow}
                    onPress={() => selectBall(ball.name)}
                  >
                    <StrengthDots strength={ball.strength} />
                    <Text style={styles.ballPickerName}>{ball.name}</Text>
                    {selected && (
                      <IconSymbol name="checkmark" size={16} color="#00CEC9" />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
          <View style={styles.manageBallsRow}>
            <TouchableOpacity
              onPress={() => {
                pendingOpenSettings.current = true;
                setBallPickerOpen(false);
              }}
            >
              <Text style={styles.manageBallsText}>Manage Balls</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ================================================================
          Draft Resume Sheet
      ================================================================ */}
      <Modal
        visible={draftResumeVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {}}
      >
        <BlurView intensity={60} tint="dark" style={styles.resumeOverlay}>
          <View style={styles.resumeSheet}>
            <Text style={styles.resumeTitle}>Resume Session?</Text>
            <Text style={styles.resumeSubtitle}>
              You have an unfinished session in progress.
            </Text>
            <ScalePressable style={styles.resumeButton} onPress={resumeDraft}>
              <Text style={styles.resumeButtonText}>Resume</Text>
            </ScalePressable>
            <ScalePressable style={styles.discardButton} onPress={discardDraft}>
              <Text style={styles.discardButtonText}>Discard</Text>
            </ScalePressable>
          </View>
        </BlurView>
      </Modal>

      {/* ================================================================
          Settings Modal
      ================================================================ */}
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
  flex: { flex: 1, backgroundColor: '#000000' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  // Type bar
  typeBar: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    padding: 3,
    marginBottom: 20,
  },
  typePill: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  typePillActive: { backgroundColor: '#2C2C2E' },
  typePillText: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  typePillTextActive: { color: '#FFFFFF', fontWeight: '600' },

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
  required: { color: '#FF453A' },

  // Inline text input (right-aligned, in fieldRow)
  inlineInput: {
    fontSize: 15,
    color: '#00CEC9',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
    padding: 0,
  },

  // Date picker
  pickerDoneRow: { alignItems: 'flex-end', paddingTop: 8, paddingRight: 2 },
  pickerDoneText: { fontSize: 15, color: '#00CEC9', fontWeight: '600' },
  datePicker: { marginBottom: 8 },

  // Week
  weekInput: {
    fontSize: 15,
    color: '#00CEC9',
    textAlign: 'right',
    minWidth: 60,
    padding: 0,
  },

  // Made Cut
  madeCutBar: {
    flexDirection: 'row',
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    padding: 2,
  },
  madeCutPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 6,
  },
  madeCutPillActive: { backgroundColor: '#1C1C1E' },
  madeCutText: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  madeCutTextActive: { color: '#FFFFFF', fontWeight: '600' },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },

  // Game card
  gameCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 13,
    padding: 16,
    marginBottom: 10,
  },
  gameLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  scoreInput: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'right',
    minWidth: 90,
    padding: 0,
  },
  ballRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#38383A',
    marginBottom: 4,
  },
  logFramesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  logFramesText: { fontSize: 15, color: '#FFFFFF' },
  logFramesRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  framesLoggedBadge: { fontSize: 12, color: '#30D158', fontWeight: '600' },

  // Mini scorecard
  miniScorecardWrapper: {
    marginBottom: 10,
  },
  gameNotesInput: {
    fontSize: 14,
    color: '#8E8E93',
    minHeight: 32,
    padding: 0,
  },

  // Swipe delete
  swipeDelete: {
    backgroundColor: '#FF453A',
    justifyContent: 'center',
    alignItems: 'center',
    width: 90,
    borderRadius: 13,
    marginBottom: 10,
    marginLeft: 8,
  },
  swipeDeleteText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },

  // Add game
  addGameButton: { paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
  addGameText: { fontSize: 17, color: '#00CEC9', fontWeight: '500' },

  // Session notes
  sessionNotesInput: {
    fontSize: 15,
    color: '#FFFFFF',
    minHeight: 80,
    paddingVertical: 14,
    textAlignVertical: 'top',
  },

  // Submit
  submitButton: {
    backgroundColor: '#00CEC9',
    borderRadius: 13,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  submitText: { fontSize: 17, fontWeight: '700', color: '#000000' },

  // Bottom spacer
  bottomSpacer: { height: 40 },

  // Gear button
  gearButton: { marginRight: 16 },

  // Shared modal chrome
  modal: { flex: 1, backgroundColor: '#1C1C1E' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#38383A',
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  doneText: { color: '#00CEC9', fontSize: 17, fontWeight: '600' },

  // Ball picker empty state
  ballPickerEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  ballPickerEmptyText: {
    color: '#8E8E93',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Ball picker rows
  ballPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#38383A',
    gap: 12,
  },
  ballPickerName: { flex: 1, fontSize: 15, color: '#FFFFFF' },
  dotsRow: { flexDirection: 'row', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotFilled: { backgroundColor: '#00CEC9' },
  dotEmpty: { backgroundColor: '#38383A' },

  // Manage Balls footer in ball picker
  manageBallsRow: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#38383A',
    alignItems: 'center',
  },
  manageBallsText: { fontSize: 15, color: '#00CEC9', fontWeight: '500' },

  // Draft resume sheet
  resumeOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  resumeSheet: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 48,
    gap: 12,
  },
  resumeTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  resumeSubtitle: { fontSize: 15, color: '#8E8E93', textAlign: 'center', marginBottom: 8 },
  resumeButton: {
    backgroundColor: '#00CEC9',
    borderRadius: 13,
    paddingVertical: 15,
    alignItems: 'center',
  },
  resumeButtonText: { fontSize: 17, fontWeight: '700', color: '#000000' },
  discardButton: {
    borderRadius: 13,
    paddingVertical: 15,
    alignItems: 'center',
  },
  discardButtonText: { fontSize: 17, fontWeight: '500', color: '#FF453A' },
});
