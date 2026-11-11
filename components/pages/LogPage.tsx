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
  AppState,
} from 'react-native';
import { useSideInsets } from '@/src/v2/page';
import SwipeRow from '@/components/v2/SwipeRow';
import { color } from '@/src/v2/theme';
import { BlurView } from 'expo-blur';
import { useNavigation, useFocusEffect } from 'expo-router/react-navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useIsFocused } from 'expo-router';
import * as Haptics from 'expo-haptics';

import HeaderIconButton from '@/components/v2/HeaderIconButton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import ScalePressable from '@/components/ScalePressable';
import { FrameGrid } from '@/components/FrameGrid';
import SegmentedControl from '@/components/v2/SegmentedControl';
import { useLayoutClass } from '@/src/v2/layout';
import {
  readSessionsResult,
  writeSessions,
  readBalls,
  readDraft,
  writeDraft,
  readSettings,
  KEYS,
} from '@/src/storage';
import { writeBackup } from '@/src/backup';
import {
  notifyDraftChanged,
  onLiveGameRequest,
  hasLiveGameRequest,
  clearLiveGameRequest,
  firstUnscoredGame,
} from '@/src/v2/liveGame';
import type { ThrowEntry, Ball, DraftData, Settings } from '@/src/types';
import { getSeasons, seasonForDate } from '@/src/seasons';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// S19: a stale form date must also be >= 12h old, so a league night that runs
// past midnight never moves an empty form (e.g. while Game 1's FRAME_RESULT is
// still on its way back) to the next day. A week in memory clears it easily.
const STALE_MS = 12 * 60 * 60 * 1000;

const DEFAULT_SEASON_START = '2025-09-06';

function calcWeek(d: Date, seasonStartISO?: string | null): number {
  const start = new Date((seasonStartISO ?? DEFAULT_SEASON_START) + 'T00:00:00');
  const diff = d.getTime() - start.getTime();
  if (diff < 0) return 1;
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}

// Week auto-suggest (Nov 11 fix): count from the start of the SEASON the date
// falls in (Phase 24 season model), not the legacy settings.seasonStart -- which
// was never moved past 2025 and suggested "Week 62" in Nov 2026. Falls back to
// the legacy start only for a date before every season. Suggestion only: the
// Week field stays editable and nothing is stored until Submit.
function weekFor(d: Date, settings: Settings | null): number {
  const seasons = getSeasons(settings);
  const id = seasonForDate(formatDateISO(d), seasons);
  const season = id ? seasons.find((s) => s.id === id) : undefined;
  return calcWeek(d, season?.start ?? settings?.seasonStart ?? null);
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
  /** Edge-to-edge card background (Phase 28 polish): corner + padding styles. */
  cardStyle?: import('react-native').StyleProp<import('react-native').ViewStyle>;
};

function GameRow({ game, index, onChange, onPickBall, onLogFrames, cardStyle }: GameRowProps) {
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
    <View style={[styles.gameCard, cardStyle]}>
      <Text style={styles.gameLabel}>Game {index + 1}</Text>

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
        <View>
          <Text style={styles.logFramesText}>
            {game.frames && game.frames.length > 0 ? 'Edit frames' : 'Log frames'}
          </Text>
          <Text style={styles.logFramesStatus}>
            {game.frames && game.frames.length > 0 ? 'Frames logged' : 'No frames yet'}
          </Text>
        </View>
        <IconSymbol name="chevron.right" size={14} color="#8E8E93" />
      </TouchableOpacity>

      {/* Game notes */}
      <TextInput
        style={styles.gameNotesInput}
        value={game.notes}
        onChangeText={(v) => onChange('notes', v)}
        placeholder="Game notes"
        placeholderTextColor="#48484A"
        multiline
      />
    </View>
  );
}

const SESSION_TYPE_SEGMENTS = [
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
// Main screen
// ---------------------------------------------------------------------------

export default function LogPage() {
  // Phase 28: pad by the side safe areas so nothing sits under the Duo's tab
  // rail or status column (Nov 10 Duo check F1/F2).
  const sideInsets = useSideInsets();
  const navigation = useNavigation();
  const initialized = useRef(false);
  // Loaded settings, for the week suggestion (seasons) without a settings state
  const settingsRef = useRef<Settings | null>(null);
  // Debounce handle for draft auto-save
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Core form
  const [sessionType, setSessionType] = useState<SessionType>('league');
  const [date, setDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [week, setWeek] = useState(() => String(weekFor(new Date(), null)));
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
  // Phase 28 WP7: set once the mount-time draft check has finished, so a Live
  // game request never acts on the empty form a pending draft is about to
  // replace.
  const [ready, setReady] = useState(false);
  // Cover landscape: details and games side by side (Phase 28 WP3).
  const wide = useLayoutClass().layout === 'compactWide';
  // Rounded groups are inset-grouped cards (Nov 10 polish): the same margin on
  // both sides, inside the safe areas -- iOS never runs a ROUNDED card under the
  // rail, only plain (square) backgrounds like History's list rows.
  const [liveTick, setLiveTick] = useState(0);

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
      settingsRef.current = settingsData ?? null;
      setWeek(String(weekFor(new Date(), settingsRef.current)));
      initialized.current = true;
      setReady(true);
    }
    init();
  }, []);

  // ---- S19: keep an untouched form's date / week current ---------------------
  // `date` used to be set only at mount, on resume and in resetForm, so if the
  // app sat in memory from one league night to the next, Submit saved last
  // week's date (and weekFor() suggested last week's week). settingsRef was
  // also never refreshed after a Settings change.
  //
  // Rule: re-read settings, then -- only for a form with NO content (same test
  // as the draft auto-save, so the S5/S6 rules hold), no pending draft / resume
  // prompt, no open date picker, and a date the APP set (never one Marcus
  // picked, e.g. while backfilling from SyncPassport) -- move a stale date to
  // today and re-suggest the week. Same day: only an untouched week suggestion
  // is re-computed (season dates may have changed).
  const dateUserSetRef = useRef(false);
  const dateSetAtRef = useRef(Date.now());
  const liveFormRef = useRef({ hasContent: false, blocked: true, date: new Date(), week: '' });
  liveFormRef.current = {
    hasContent: draftHasContent({
      sessionType, date: '', week, opponent,
      tournamentName, tournamentFormat, tournamentPattern, madeCut, placement,
      games, sessionNotes,
    }),
    blocked: draftResumeVisible || pendingDraft !== null || showDatePicker,
    date,
    week,
  };
  const refreshFormDate = useCallback(async () => {
    const prevSettings = settingsRef.current;
    let fresh = prevSettings;
    try {
      fresh = (await readSettings()) ?? null;
    } catch {
      // keep the settings we have
    }
    settingsRef.current = fresh;
    const f = liveFormRef.current;
    if (!initialized.current || f.blocked || f.hasContent || dateUserSetRef.current) return;
    const now = new Date();
    if (formatDateISO(f.date) !== formatDateISO(now)) {
      if (now.getTime() - dateSetAtRef.current < STALE_MS) return;
      dateSetAtRef.current = now.getTime();
      setDate(now);
      setWeek(String(weekFor(now, fresh)));
      return;
    }
    if (f.week === String(weekFor(f.date, prevSettings))) {
      const next = String(weekFor(f.date, fresh));
      if (next !== f.week) setWeek(next);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void refreshFormDate();
    }, [refreshFormDate])
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refreshFormDate();
    });
    return () => sub.remove();
  }, [refreshFormDate]);

  // ---- Reload balls (+ S19 settings) when Settings modal closes -----------
  const wasSettingsOpen = useRef(false);
  useEffect(() => {
    const justClosed = wasSettingsOpen.current && !settingsOpen;
    wasSettingsOpen.current = settingsOpen;
    if (justClosed) {
      let active = true;
      readBalls().then(b => {
        if (active && b) setAvailableBalls(b.filter(ball => ball.active).sort((a, b) => a.strength - b.strength));
      });
      void refreshFormDate();
      return () => { active = false; };
    }
  }, [settingsOpen, refreshFormDate]);

  // ---- Read frame result when returning from log-frames -------------------
  useFocusEffect(
    useCallback(() => {
      let active = true;
      AsyncStorage.getItem(KEYS.FRAME_RESULT).then((raw) => {
        if (!active || !raw) return;
        AsyncStorage.removeItem(KEYS.FRAME_RESULT);
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
      if (draftHasContent(draft)) writeDraft(draft).then(notifyDraftChanged);
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
        <HeaderIconButton
          icon="gearshape"
          onPress={() => setSettingsOpen(true)}
          accessibilityLabel="Settings"
        />
      ),
    });
  }, [navigation]);

  // ---- Helpers ------------------------------------------------------------

  const handleDateChange = (_event: unknown, selectedDate?: Date) => {
    if (selectedDate) {
      dateUserSetRef.current = true; // S19: never auto-move a picked date
      setDate(selectedDate);
      setWeek(String(weekFor(selectedDate, settingsRef.current)));
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
    dateUserSetRef.current = false;
    dateSetAtRef.current = now.getTime();
    setSessionType('league');
    setDate(now);
    setWeek(String(weekFor(now, settingsRef.current)));
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
    dateUserSetRef.current = true; // S19: a resumed draft keeps its own date
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
    // A Live game request was for the draft's game; the draft is gone.
    clearLiveGameRequest();
    await writeDraft(null);
    notifyDraftChanged();
    setDraftResumeVisible(false);
    setPendingDraft(null);
  }

  // ---- Submit -------------------------------------------------------------

  // S18: Submit is in flight. A second tap during the awaits below would build
  // a second session (new Date.now() id) and save the same night twice.
  const submittingRef = useRef(false);

  async function handleSubmit() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      await submitSession();
    } finally {
      submittingRef.current = false;
    }
  }

  async function submitSession() {
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
    // N20 (folded into S18): disarm the pending draft auto-save before the
    // draft is cleared, or it can fire after writeDraft(null) and put the
    // just-submitted form back as a phantom draft. Done here, not at the top:
    // on the early returns above the form stays as-is and its pending save
    // should still land.
    if (draftSaveTimer.current) {
      clearTimeout(draftSaveTimer.current);
      draftSaveTimer.current = null;
    }
    await writeSessions([session, ...existingRead.value]);
    void writeBackup();
    await writeDraft(null);
    notifyDraftChanged();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    resetForm();
    router.navigate('/(tabs)/stats');
  }

  // ---- Render -------------------------------------------------------------

  // Open Log Frames for one game -- the game row and the Live game button
  // both come through here.
  // Guards a double tap (row or Live button) from stacking two Log Frames
  // screens; cleared when this page is focused again.
  const openingFramesRef = useRef(false);
  function openLogFrames(index: number) {
    const game = games[index];
    if (!game || openingFramesRef.current) return;
    openingFramesRef.current = true;
    router.push({
      pathname: '/log-frames',
      params: {
        gameIndex: String(index),
        priorScores: games.slice(0, index).map((g) => parseInt(g.score, 10) || 0).join(','),
        ...(game.frames && game.frames.length > 0
          ? { initialFrames: JSON.stringify(game.frames) }
          : {}),
      },
    });
  }

  // ---- Live game button (Phase 28 WP7) --------------------------------------
  // The button (any tab) asks; this page answers once the draft is loaded and
  // any resume prompt is settled, using its own game list.
  // M2: only the FOCUSED Log page answers. A Log page that isn't on screen
  // (e.g. a stale second copy) must never take the request -- it would open
  // Log Frames for its own empty form and then stay latched.
  const isFocused = useIsFocused();
  useEffect(() => onLiveGameRequest(() => setLiveTick((t) => t + 1)), []);
  useFocusEffect(
    useCallback(() => {
      openingFramesRef.current = false;
      // Only re-render the form when a Live game request is actually waiting
      // (Nov 10 polish: an unconditional bump re-rendered the whole Log page on
      // every tab switch).
      if (hasLiveGameRequest()) setLiveTick((t) => t + 1);
    }, [])
  );
  useEffect(() => {
    if (!isFocused || !ready || draftResumeVisible || !hasLiveGameRequest()) return;
    clearLiveGameRequest();
    const idx = firstUnscoredGame(games);
    if (idx >= 0) openLogFrames(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTick, ready, draftResumeVisible, isFocused]);

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
          contentContainerStyle={[
            styles.scrollContent,
            { paddingLeft: 16 + sideInsets.left, paddingRight: 16 + sideInsets.right },
          ]}
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <View style={wide ? styles.wideCols : undefined}>
          <View style={wide ? styles.wideCol : undefined}>
          {/* ---- Type selector (Phase 28 WP3: v2 segmented control) ---- */}
          <View style={styles.typeBar}>
            <SegmentedControl
              segments={SESSION_TYPE_SEGMENTS}
              value={sessionType}
              onChange={setSessionType}
              accessibilityLabel="Session type"
            />
          </View>

          {/* ---- Details: one grouped list (Phase 28 WP3) ---- */}
          <View style={styles.detailsGroup}>
          {/* ---- Date ---- */}
          <View style={styles.groupRowFirst}>
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
            <View style={styles.groupRow}>
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
            <View style={styles.groupRow}>
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
              <View style={styles.groupRow}>
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
              <View style={styles.groupRow}>
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
              <View style={styles.groupRow}>
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
              <View style={styles.groupRow}>
                <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.fieldLabel}>Made cut</Text>
                  <View style={styles.madeCutBar}>
                    <SegmentedControl
                      segments={MADE_CUT_SEGMENTS}
                      value={madeCut}
                      onChange={setMadeCut}
                      accessibilityLabel="Made cut"
                    />
                  </View>
                </View>
              </View>
              <View style={styles.groupRow}>
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

          </View>
          </View>

          <View style={wide ? styles.wideCol : undefined}>
          {/* ---- Games ---- */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Games</Text>
            <TouchableOpacity onPress={addGame} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.addGameText}>Add game</Text>
            </TouchableOpacity>
          </View>
          {games.map((game, index) => (
            <SwipeRow
              key={game.id}
              radius={13}
              style={styles.gameSwipe}
              actions={
                games.length > 1
                  ? [{ label: 'Remove', tint: color.bad, onPress: () => confirmRemove(game.id) }]
                  : []
              }
            >
              <GameRow
                game={game}
                index={index}
                onChange={(f, v) => updateGame(game.id, f, v)}
                onPickBall={() => openBallPicker(game.id)}
                onLogFrames={() => openLogFrames(index)}
              />
            </SwipeRow>
          ))}
          </View>
          </View>

          {/* ---- Session notes ---- */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Notes</Text>
          </View>
          <View style={styles.card}>
            <TextInput
              style={styles.sessionNotesInput}
              value={sessionNotes}
              onChangeText={setSessionNotes}
              placeholder="Optional notes about this session"
              placeholderTextColor="#48484A"
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* ---- Submit ---- */}
          <ScalePressable style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitText}>Submit session</Text>
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
  scrollContent: { paddingTop: 12 },

  // Phase 28 WP3 layout
  wideCols: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  wideCol: { flex: 1 },
  detailsGroup: {
    backgroundColor: '#1C1C1E',
    borderRadius: 13,
    overflow: 'hidden',
    marginBottom: 20,
  },
  groupRowFirst: { paddingHorizontal: 16 },
  groupRow: {
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#38383A',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#FFFFFF' },
  logFramesStatus: { fontSize: 13, color: '#8E8E93', marginTop: 2 },

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
  fieldLabel: { fontSize: 17, color: '#FFFFFF', fontWeight: '400' },
  fieldValueTeal: { fontSize: 17, color: '#00CEC9' },
  fieldValueDim: { fontSize: 17, color: '#48484A' },
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
  madeCutBar: { width: 170 },


  // Game card
  gameCard: {
    backgroundColor: '#1C1C1E',
    padding: 16,
  },
  gameSwipe: { marginBottom: 10 },
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
    marginBottom: 4,
  },
  scoreInput: {
    fontSize: 28,
    fontWeight: '300',
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

  // Add game (section header action)
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
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  submitText: { fontSize: 17, fontWeight: '600', color: '#000000' },

  // Bottom spacer
  bottomSpacer: { height: 40 },


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
  resumeTitle: { fontSize: 20, fontWeight: '600', color: '#FFFFFF', textAlign: 'center' },
  resumeSubtitle: { fontSize: 15, color: '#8E8E93', textAlign: 'center', marginBottom: 8 },
  resumeButton: {
    backgroundColor: '#00CEC9',
    borderRadius: 13,
    paddingVertical: 15,
    alignItems: 'center',
  },
  resumeButtonText: { fontSize: 17, fontWeight: '600', color: '#000000' },
  discardButton: {
    borderRadius: 13,
    paddingVertical: 15,
    alignItems: 'center',
  },
  discardButtonText: { fontSize: 17, fontWeight: '500', color: '#FF453A' },
});
