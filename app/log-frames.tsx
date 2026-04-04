import { useState, useLayoutEffect, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import type { FrameData, ThrowEntry } from '@/src/types';
import { IconSymbol } from '@/components/ui/icon-symbol';
import ScalePressable from '@/components/ScalePressable';
import PinDeck from '@/components/PinDeck';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ThrowVal = string; // 'X' | '/' | '—' | '0'-'9'
// FrameData is imported from @/src/types
type Mode = 'post' | 'live';
type InputMode = 'pins' | 'quick';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHIPS: string[] = ['X', '/', '—', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const FRAME_ITEM_W = 52;
export const FRAME_RESULT_KEY = 'mbowl_frame_result';
const ALL_UP: boolean[] = Array(10).fill(true);

// ---------------------------------------------------------------------------
// Score calculation
// ---------------------------------------------------------------------------

function pinVal(t: ThrowVal, prevPins: number): number {
  if (t === 'X') return 10;
  if (t === '/') return 10 - prevPins;
  if (t === '—') return 0;
  return parseInt(t, 10) || 0;
}

function framesToPins(frames: FrameData[]): number[] {
  const pins: number[] = [];
  for (const f of frames) {
    for (const t of f.throws) {
      pins.push(pinVal(t, pins[pins.length - 1] ?? 0));
    }
  }
  return pins;
}

function isFrameComplete(frames: FrameData[], fi: number): boolean {
  const throws = frames[fi].throws;
  if (throws.length === 0) return false;
  if (fi < 9) return throws[0] === 'X' || throws.length >= 2;
  if (throws.length < 2) return false;
  if (throws[0] !== 'X' && throws[1] !== '/') return true;
  return throws.length >= 3;
}

function calculateScores(frames: FrameData[]): (number | null)[] {
  const pins = framesToPins(frames);
  const raw: (number | null)[] = [];
  let pi = 0;

  for (let fi = 0; fi < 10; fi++) {
    const { throws } = frames[fi];
    if (throws.length === 0) { raw.push(null); continue; }

    if (fi === 9) {
      if (isFrameComplete(frames, 9)) {
        let s = 0;
        for (let j = 0; j < throws.length; j++) s += pins[pi + j] ?? 0;
        raw.push(s);
      } else { raw.push(null); }
      pi += throws.length;
    } else if (throws[0] === 'X') {
      const b1 = pins[pi + 1], b2 = pins[pi + 2];
      raw.push(b1 !== undefined && b2 !== undefined ? 10 + b1 + b2 : null);
      pi += 1;
    } else if (throws.length >= 2 && throws[1] === '/') {
      const bonus = pins[pi + 2];
      raw.push(bonus !== undefined ? 10 + bonus : null);
      pi += 2;
    } else if (throws.length >= 2) {
      raw.push(pins[pi] + pins[pi + 1]);
      pi += 2;
    } else {
      raw.push(null);
      pi += throws.length;
    }
  }

  const cum: (number | null)[] = [];
  let running = 0, blocked = false;
  for (let i = 0; i < 10; i++) {
    if (blocked || raw[i] === null) { blocked = true; cum.push(null); }
    else { running += raw[i]!; cum.push(running); }
  }
  return cum;
}

// ---------------------------------------------------------------------------
// Max score calculation
// ---------------------------------------------------------------------------

// Fill every remaining throw with the best possible result.
// Frames 1–9: unfilled throw 1 → strike; partial frame → spare.
// 10th frame: fill remaining slots with strikes (or spare where applicable).
function buildMaxFrames(frames: FrameData[]): FrameData[] {
  return frames.map((f, fi) => {
    const throws = f.throws;
    if (fi < 9) {
      if (throws.length === 0) return { ...f, throws: ['X'] };
      if (throws.length === 1 && throws[0] !== 'X') return { ...f, throws: [...throws, '/'] };
      return f;
    }
    // 10th frame
    if (throws.length === 0) return { ...f, throws: ['X', 'X', 'X'] };
    if (throws.length === 1) {
      if (throws[0] === 'X') return { ...f, throws: ['X', 'X', 'X'] };
      return { ...f, throws: [...throws, '/', 'X'] };
    }
    if (throws.length === 2) {
      const [t1, t2] = throws;
      if (t1 === 'X' && t2 === 'X') return { ...f, throws: [...throws, 'X'] };
      if (t1 === 'X') return { ...f, throws: [...throws, '/'] }; // spare remaining pins
      if (t2 === '/') return { ...f, throws: [...throws, 'X'] };
      return f; // open frame in 10th — no bonus ball earned
    }
    return f; // 3 throws = complete
  });
}

function calculateMaxScore(frames: FrameData[]): number {
  const filled = buildMaxFrames(frames);
  const s = calculateScores(filled);
  return s[9] ?? 0;
}

// ---------------------------------------------------------------------------
// Strike streak
// ---------------------------------------------------------------------------

// Count consecutive 'X' throws from the most recent throw backward.
function getStrikeStreak(frames: FrameData[]): number {
  const allThrows: string[] = [];
  for (let fi = 0; fi < 10; fi++) {
    for (const t of frames[fi].throws) allThrows.push(t);
  }
  let streak = 0;
  for (let i = allThrows.length - 1; i >= 0; i--) {
    if (allThrows[i] === 'X') streak++;
    else break;
  }
  return streak;
}

// ---------------------------------------------------------------------------
// Chip availability
// ---------------------------------------------------------------------------

function getAvailableChips(frames: FrameData[], fi: number): Set<string> {
  const { throws } = frames[fi];
  const ti = throws.length;
  const is10th = fi === 9;

  if (!is10th) {
    if (ti === 0) return new Set(['X', '—', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    const t1Pins = throws[0] === '—' ? 0 : parseInt(throws[0], 10);
    const avail: string[] = ['/', '—'];
    for (let i = 0; i <= 10 - t1Pins; i++) avail.push(String(i));
    return new Set(avail);
  }

  if (ti === 0) return new Set(['X', '—', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
  if (ti === 1) {
    const t1 = throws[0];
    if (t1 === 'X') return new Set(['X', '—', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    const t1Pins = t1 === '—' ? 0 : parseInt(t1, 10);
    const avail: string[] = ['/', '—'];
    for (let i = 0; i <= 10 - t1Pins; i++) avail.push(String(i));
    return new Set(avail);
  }
  const t1 = throws[0], t2 = throws[1];
  if (t1 === 'X' && t2 === 'X') return new Set(['X', '—', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
  if (t1 === 'X') {
    const t2Pins = t2 === '—' ? 0 : parseInt(t2, 10);
    const avail: string[] = ['/', '—'];
    for (let i = 0; i <= 10 - t2Pins; i++) avail.push(String(i));
    return new Set(avail);
  }
  if (t2 === '/') return new Set(['X', '—', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
  return new Set();
}

// ---------------------------------------------------------------------------
// Pin deck helpers
// ---------------------------------------------------------------------------

// Synthesise a pinsStanding array from a chip-bar notation string.
// Used when throw N was entered via chip bar so we can still drive PinDeck
// correctly for throw N+1 (correct "/" detection, correct available-pin count).
function synthFromNotation(notation: string): boolean[] {
  if (notation === 'X') return Array(10).fill(false);       // all knocked
  if (notation === '—' || notation === '0') return ALL_UP;  // gutter
  const n = parseInt(notation, 10);
  if (isNaN(n)) return ALL_UP;
  // First n indices knocked (false), remaining standing (true)
  return Array.from({ length: 10 }, (_, i) => i >= n);
}

// Return the pinsStanding state after a specific throw, real or synthesised.
function getPinsAfterThrow(frame: FrameData, throwIdx: number): boolean[] {
  const actual = frame.pinsStanding?.[throwIdx];
  if (actual) return actual;
  return synthFromNotation(frame.throws[throwIdx]);
}

// Derive the PinDeck props for the CURRENT pending throw in a frame.
function getPinDeckProps(
  frames: FrameData[],
  fi: number,
): { availablePins: boolean[]; isFirstThrow: boolean; prevPinsStanding: boolean[] | null } {
  const frame = frames[fi];
  const ti = frame.throws.length; // index of the throw about to be entered
  const is10th = fi === 9;

  if (!is10th) {
    if (ti === 0) return { availablePins: ALL_UP, isFirstThrow: true, prevPinsStanding: null };
    const prev = getPinsAfterThrow(frame, 0);
    return { availablePins: prev, isFirstThrow: false, prevPinsStanding: prev };
  }

  // ---- 10th frame ----
  if (ti === 0) return { availablePins: ALL_UP, isFirstThrow: true, prevPinsStanding: null };

  if (ti === 1) {
    if (frame.throws[0] === 'X') {
      // Strike on first ball → reset all 10 for second ball
      return { availablePins: ALL_UP, isFirstThrow: true, prevPinsStanding: null };
    }
    const prev = getPinsAfterThrow(frame, 0);
    return { availablePins: prev, isFirstThrow: false, prevPinsStanding: prev };
  }

  // ti === 2 (third ball in 10th)
  const t1 = frame.throws[0];
  const t2 = frame.throws[1];

  if (t1 === 'X' && t2 === 'X') {
    // Two strikes → reset all 10
    return { availablePins: ALL_UP, isFirstThrow: true, prevPinsStanding: null };
  }
  if (t1 === 'X') {
    // First was strike, second was not → third at remaining pins from second ball
    const prev = getPinsAfterThrow(frame, 1);
    return { availablePins: prev, isFirstThrow: false, prevPinsStanding: prev };
  }
  // First two formed a spare → reset all 10
  return { availablePins: ALL_UP, isFirstThrow: true, prevPinsStanding: null };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FrameStripItem({
  frame, index, score, isCurrent, onPress,
}: {
  frame: FrameData; index: number; score: number | null; isCurrent: boolean; onPress: () => void;
}) {
  const slotCount = index === 9 ? 3 : 2;
  const hasPinData = !!(frame.pinsStanding && frame.pinsStanding.length > 0);
  return (
    <TouchableOpacity
      activeOpacity={0.65}
      onPress={onPress}
      style={[styles.stripItem, isCurrent && styles.stripItemCurrent]}
    >
      <Text style={[styles.stripNum, isCurrent && styles.stripNumCurrent]}>{index + 1}</Text>
      <View style={styles.stripThrows}>
        {Array.from({ length: slotCount }).map((_, i) => {
          const t = frame.throws[i];
          return (
            <View key={i} style={styles.stripThrowBox}>
              <Text style={[
                styles.stripThrowText,
                t === 'X' && styles.strikeText,
                isCurrent && !!t && styles.stripThrowTextActive,
              ]}>
                {t ?? ''}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={styles.stripBottomRow}>
        <Text style={[styles.stripScore, isCurrent && styles.stripScoreActive]}>
          {score !== null ? String(score) : ''}
        </Text>
        {hasPinData && <View style={styles.stripPinDot} />}
      </View>
    </TouchableOpacity>
  );
}

// Per-frame note toggle — rendered inside ActiveFrameCard, available in both modes
function FrameNoteField({
  value, onChange,
}: {
  value: string; onChange: (note: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.frameNoteWrapper}>
      <TouchableOpacity style={styles.frameNoteToggle} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.frameNoteLabel}>Frame note</Text>
        <IconSymbol
          name={open ? 'chevron.up' : 'chevron.down'}
          size={13}
          color="#8E8E93"
        />
      </TouchableOpacity>
      {open && (
        <TextInput
          style={styles.frameNoteInput}
          value={value}
          onChangeText={onChange}
          placeholder="Note for this frame..."
          placeholderTextColor="#48484A"
          multiline
          returnKeyType="done"
        />
      )}
    </View>
  );
}

function ActiveFrameCard({
  frame,
  frameIndex,
  onNoteChange,
}: {
  frame: FrameData;
  frameIndex: number;
  onNoteChange: (note: string) => void;
}) {
  const slotCount = frameIndex === 9 ? 3 : 2;
  const { throws } = frame;

  return (
    <View style={styles.activeCard}>
      <Text style={styles.activeFrameLabel}>FRAME {frameIndex + 1}</Text>
      <View style={styles.activeSlotsRow}>
        {Array.from({ length: slotCount }).map((_, i) => {
          const t = throws[i];
          const filled = t !== undefined;
          return (
            <View key={i} style={[styles.activeSlot, filled && styles.activeSlotFilled]}>
              <Text style={[
                styles.activeSlotText,
                !filled && styles.activeSlotEmpty,
                t === 'X' && styles.activeStrikeText,
              ]}>
                {filled ? t : '·'}
              </Text>
            </View>
          );
        })}
      </View>
      <FrameNoteField value={frame.note} onChange={onNoteChange} />
    </View>
  );
}

// Per-throw note — Live mode only, shown below active card
function ThrowNoteBar({
  frame,
  onThrowNoteChange,
}: {
  frame: FrameData;
  onThrowNoteChange: (ti: number, note: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ti = frame.throws.length - 1;
  if (ti < 0) return null;

  const note = frame.throwNotes[ti] ?? '';
  return (
    <View style={styles.throwNoteBar}>
      <TouchableOpacity style={styles.throwNoteToggle} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.throwNoteLabel}>Throw {ti + 1} note</Text>
        <IconSymbol
          name={open ? 'chevron.up' : 'chevron.down'}
          size={13}
          color="#8E8E93"
        />
      </TouchableOpacity>
      {open && (
        <TextInput
          style={styles.throwNoteInput}
          value={note}
          onChangeText={(t) => onThrowNoteChange(ti, t)}
          placeholder="Note for this throw..."
          placeholderTextColor="#48484A"
          multiline
          returnKeyType="done"
          autoFocus
        />
      )}
    </View>
  );
}

function ChipBar({
  available, onPress, bottomInset,
}: {
  available: Set<string>; onPress: (chip: string) => void; bottomInset: number;
}) {
  return (
    <View style={[styles.chipBar, { paddingBottom: bottomInset + 8 }]}>
      {CHIPS.map((chip) => {
        const enabled = available.has(chip);
        return (
          <TouchableOpacity
            key={chip}
            style={[styles.chip, !enabled && styles.chipDisabled]}
            onPress={() => onPress(chip)}
            disabled={!enabled}
            activeOpacity={0.55}
          >
            <Text style={[styles.chipText, !enabled && styles.chipTextDisabled]}>{chip}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function emptyFrames(): FrameData[] {
  return Array.from({ length: 10 }, () => ({ throws: [], note: '', throwNotes: {} }));
}

function throwEntriesToFrameData(entries: ThrowEntry[]): FrameData[] {
  const result = emptyFrames();
  for (let i = 0; i < Math.min(entries.length, 10); i++) {
    const e = entries[i];
    result[i] = {
      throws: e.throws ?? [],
      note: e.note ?? '',
      throwNotes: e.throwNotes ?? {},
      pinsStanding: e.pinsStanding ?? undefined,
    };
  }
  return result;
}

// Return the index of the first incomplete frame (for positioning cursor after pre-load).
function firstIncompleteFrame(frames: FrameData[]): number {
  for (let i = 0; i < 10; i++) {
    if (!isFrameComplete(frames, i)) return i;
  }
  return 9;
}

export default function LogFramesScreen() {
  const { gameIndex, priorScores, initialFrames } = useLocalSearchParams<{
    gameIndex: string;
    priorScores?: string;
    initialFrames?: string;
  }>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const stripRef = useRef<FlatList<FrameData>>(null);

  const [mode, setMode] = useState<Mode>('post');
  // Pins mode is the default for both Post-Game and Live.
  const [inputMode, setInputMode] = useState<InputMode>('pins');

  const [frames, setFrames] = useState<FrameData[]>(() => {
    if (initialFrames) {
      try {
        const parsed = JSON.parse(initialFrames) as ThrowEntry[];
        return throwEntriesToFrameData(parsed);
      } catch {
        return emptyFrames();
      }
    }
    return emptyFrames();
  });
  const [currentFrame, setCurrentFrame] = useState(() => {
    if (initialFrames) {
      try {
        const parsed = JSON.parse(initialFrames) as ThrowEntry[];
        return firstIncompleteFrame(throwEntriesToFrameData(parsed));
      } catch {
        return 0;
      }
    }
    return 0;
  });

  // Streak animation
  const streakAnim = useSharedValue(0);
  const prevStreakRef = useRef(0);

  // Strip auto-scroll
  useEffect(() => {
    stripRef.current?.scrollToIndex({
      index: Math.min(currentFrame, 9),
      animated: true,
      viewPosition: 0.5,
    });
  }, [currentFrame]);

  // When mode changes, reset inputMode to pins (default for both modes).
  useEffect(() => {
    setInputMode('pins');
  }, [mode]);

  // Derived — all memoised on frames so scoring only reruns when frames changes
  const scores = useMemo(() => calculateScores(frames), [frames]);
  const allComplete = useMemo(() => isFrameComplete(frames, 9), [frames]);
  const available = useMemo(
    () => (allComplete && currentFrame === 9 ? new Set<string>() : getAvailableChips(frames, currentFrame)),
    [frames, allComplete, currentFrame],
  );
  const runningTotal = useMemo(
    () => [...scores].reverse().find((s) => s !== null) ?? null,
    [scores],
  );
  const canDelete = useMemo(() => frames.some((f) => f.throws.length > 0), [frames]);

  // Series total — prior game scores passed in as comma-separated param
  const priorGameScores = priorScores
    ? priorScores.split(',').filter((s) => s !== '')
    : [];
  const priorTotal = priorGameScores.reduce((sum, s) => sum + (parseInt(s, 10) || 0), 0);
  const gameCount = priorGameScores.length + 1;
  const showSeries = gameCount > 1;
  const seriesTotal = priorTotal + (runningTotal ?? 0);

  // Max available score — Live + Pins mode only, not when complete
  const showMax = mode === 'live' && inputMode === 'pins' && !allComplete;
  const rawMax = useMemo(() => (showMax ? calculateMaxScore(frames) : null), [showMax, frames]);
  const maxScore = rawMax !== null ? Math.max(rawMax, runningTotal ?? 0) : null;

  // Strike streak
  const strikeStreak = useMemo(() => getStrikeStreak(frames), [frames]);
  const showStreak = strikeStreak >= 2;

  // Streak animation — fire on increment, instant clear on break
  useEffect(() => {
    const prev = prevStreakRef.current;
    prevStreakRef.current = strikeStreak;
    if (strikeStreak >= 2 && strikeStreak > prev) {
      streakAnim.value = 0;
      streakAnim.value = withSpring(1, { damping: 12, stiffness: 200 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (strikeStreak < 2) {
      streakAnim.value = 0;
    }
  }, [strikeStreak]);

  const streakAnimStyle = useAnimatedStyle(() => ({
    opacity: streakAnim.value,
    transform: [{ scale: 0.85 + 0.15 * streakAnim.value }],
  }));

  // ---- Actions ------------------------------------------------------------

  function addThrow(chip: string) {
    if (allComplete && currentFrame === 9) return;
    if (chip === 'X') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const newFrames = frames.map((f, i) =>
      i === currentFrame ? { ...f, throws: [...f.throws, chip] } : f
    );
    setFrames(newFrames);
    if (isFrameComplete(newFrames, currentFrame) && currentFrame < 9) {
      setCurrentFrame((p) => p + 1);
    }
  }

  // Called by PinDeck.onConfirm — records both the notation and the raw pin state.
  function addThrowWithPins(notation: string, throwPinsStanding: boolean[]) {
    if (allComplete && currentFrame === 9) return;
    if (notation === 'X') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const throwIdx = frames[currentFrame].throws.length;
    const newFrames = frames.map((f, i) => {
      if (i !== currentFrame) return f;
      const pinsStanding = [...(f.pinsStanding ?? [])];
      pinsStanding[throwIdx] = throwPinsStanding;
      return { ...f, throws: [...f.throws, notation], pinsStanding };
    });
    setFrames(newFrames);
    if (isFrameComplete(newFrames, currentFrame) && currentFrame < 9) {
      setCurrentFrame((p) => p + 1);
    }
  }

  function deleteLastThrow() {
    if (frames[currentFrame].throws.length > 0) {
      setFrames((prev) =>
        prev.map((f, i) => {
          if (i !== currentFrame) return f;
          return {
            ...f,
            throws: f.throws.slice(0, -1),
            pinsStanding: f.pinsStanding?.slice(0, -1),
          };
        })
      );
    } else if (currentFrame > 0) {
      const prevFi = currentFrame - 1;
      setFrames((prev) =>
        prev.map((f, i) => {
          if (i !== prevFi) return f;
          return {
            ...f,
            throws: f.throws.slice(0, -1),
            pinsStanding: f.pinsStanding?.slice(0, -1),
          };
        })
      );
      setCurrentFrame(prevFi);
    }
  }

  function updateFrameNote(fi: number, note: string) {
    setFrames((prev) =>
      prev.map((f, i) => (i === fi ? { ...f, note } : f))
    );
  }

  function updateThrowNote(fi: number, ti: number, note: string) {
    setFrames((prev) =>
      prev.map((f, i) => {
        if (i !== fi) return f;
        return { ...f, throwNotes: { ...f.throwNotes, [ti]: note } };
      })
    );
  }

  async function handleDone() {
    const result = {
      gameIndex: gameIndex !== undefined ? parseInt(gameIndex, 10) : 0,
      score: scores[9] ?? 0,
      frames,
    };
    await AsyncStorage.setItem(FRAME_RESULT_KEY, JSON.stringify(result));
    navigation.goBack();
  }

  // Use a ref so the Cancel button always calls the latest handleCancel
  // without needing to re-register the header on every frame change
  const handleCancelRef = useRef<() => void>(() => {});
  handleCancelRef.current = () => {
    const hasData = frames.some((f) => f.throws.length > 0);
    if (!hasData) { navigation.goBack(); return; }
    Alert.alert(
      'Discard Frames?',
      'Your frame data will not be saved.',
      [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.goBack(); } },
      ]
    );
  };

  // Header
  useLayoutEffect(() => {
    const gameNum = gameIndex !== undefined ? parseInt(gameIndex, 10) + 1 : '';
    navigation.setOptions({
      title: gameNum ? `Game ${gameNum} Frames` : 'Log Frames',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => handleCancelRef.current()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ marginLeft: Platform.OS === 'ios' ? 0 : 4 }}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, gameIndex]);

  // ---- Render -------------------------------------------------------------

  const showThrowNoteBar =
    mode === 'live' && inputMode === 'quick' && !(allComplete && currentFrame === 9) && frames[currentFrame].throws.length > 0;

  // Compute PinDeck props once — used in render to avoid duplication.
  const pinDeckProps = (!(allComplete && currentFrame === 9) && inputMode === 'pins')
    ? getPinDeckProps(frames, currentFrame)
    : null;

  return (
    <View style={styles.container}>
      {/* Mode toggle (Post-Game / Live) */}
      <View style={styles.toggleBar}>
        {(['post', 'live'] as Mode[]).map((m) => (
          <ScalePressable
            key={m}
            style={[styles.togglePill, mode === m && styles.togglePillActive]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.toggleText, mode === m && styles.toggleTextActive]}>
              {m === 'post' ? 'Post-Game' : 'Live'}
            </Text>
          </ScalePressable>
        ))}
      </View>

      {/* Input mode toggle (Pins / Quick) */}
      <View style={styles.inputModeBar}>
        {(['pins', 'quick'] as InputMode[]).map((m) => (
          <ScalePressable
            key={m}
            style={[styles.inputModePill, inputMode === m && styles.inputModePillActive]}
            onPress={() => setInputMode(m)}
          >
            <Text style={[styles.inputModeText, inputMode === m && styles.inputModeTextActive]}>
              {m === 'pins' ? 'Pins' : 'Quick'}
            </Text>
          </ScalePressable>
        ))}
      </View>

      {/* Top strip */}
      <FlatList
        ref={stripRef}
        data={frames}
        keyExtractor={(_, i) => String(i)}
        horizontal
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: FRAME_ITEM_W, offset: FRAME_ITEM_W * index, index })}
        onScrollToIndexFailed={() => {}}
        renderItem={({ item, index }) => (
          <FrameStripItem
            frame={item}
            index={index}
            score={scores[index]}
            isCurrent={index === currentFrame}
            onPress={() => {
              if (index === currentFrame) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setCurrentFrame(index);
            }}
          />
        )}
        style={styles.strip}
        contentContainerStyle={styles.stripContent}
      />

      {/* Running total */}
      <View style={styles.totalRow}>
        <View>
          <Text style={styles.totalLabel}>Running Total</Text>
          {showSeries && (
            <Text style={styles.seriesText}>SERIES  {seriesTotal}</Text>
          )}
        </View>
        <View style={styles.totalRight}>
          {maxScore !== null && (
            <Text style={styles.maxLabel}>MAX  {maxScore}</Text>
          )}
          <Text style={[styles.totalValue, allComplete && styles.totalValueFinal]}>
            {runningTotal !== null ? String(runningTotal) : '—'}
          </Text>
        </View>
      </View>

      {/* Strike streak badge */}
      {showStreak && (
        <Animated.View style={[styles.streakBadge, streakAnimStyle]}>
          <Text style={styles.streakText}>🔥 {strikeStreak} IN A ROW</Text>
        </Animated.View>
      )}

      {/* Active frame card or complete state */}
      <View style={styles.cardArea}>
        {(allComplete && currentFrame === 9) ? (
          <View style={styles.completeCard}>
            <Text style={styles.completeTitle}>All Frames Complete</Text>
            <Text style={styles.completeFinalScore}>{scores[9]}</Text>
            <Text style={styles.completeLabel}>Final Score</Text>
            <ScalePressable style={styles.doneButton} onPress={handleDone}>
              <Text style={styles.doneButtonText}>Done</Text>
            </ScalePressable>
          </View>
        ) : (
          <ActiveFrameCard
            key={currentFrame}
            frame={frames[currentFrame]}
            frameIndex={currentFrame}
            onNoteChange={(note) => updateFrameNote(currentFrame, note)}
          />
        )}
      </View>

      {/* Per-throw note — Live mode only */}
      {showThrowNoteBar && (
        <ThrowNoteBar
          key={`${currentFrame}-${frames[currentFrame].throws.length}`}
          frame={frames[currentFrame]}
          onThrowNoteChange={(ti, note) => updateThrowNote(currentFrame, ti, note)}
        />
      )}

      {/* Delete last throw — always visible so layout is stable */}
      <TouchableOpacity
        style={[styles.deleteRow, !canDelete && styles.deleteRowDisabled]}
        onPress={deleteLastThrow}
        disabled={!canDelete}
        activeOpacity={0.6}
      >
        <Text style={[styles.deleteRowText, !canDelete && styles.deleteRowTextDisabled]}>
          ⌫  Delete Last Throw
        </Text>
      </TouchableOpacity>

      {/* Input area: chip bar (Quick mode or complete) — pin deck (Pins mode, not complete) */}
      {(inputMode === 'quick' || (allComplete && currentFrame === 9)) ? (
        <ChipBar available={available} onPress={addThrow} bottomInset={insets.bottom} />
      ) : pinDeckProps && (
        <View style={[styles.pinDeckContainer, { paddingBottom: insets.bottom + 8 }]}>
          <PinDeck
            key={`pd-${currentFrame}-${frames[currentFrame].throws.length}`}
            availablePins={pinDeckProps.availablePins}
            isFirstThrow={pinDeckProps.isFirstThrow}
            prevPinsStanding={pinDeckProps.prevPinsStanding}
            onConfirm={(ps, notation) => addThrowWithPins(notation, ps)}
          />
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },

  // Mode toggle
  toggleBar: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    padding: 3,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
  },
  togglePill: { flex: 1, paddingVertical: 6, borderRadius: 8, alignItems: 'center' },
  togglePillActive: { backgroundColor: '#2C2C2E' },
  toggleText: { fontSize: 14, color: '#8E8E93', fontWeight: '500' },
  toggleTextActive: { color: '#FFFFFF', fontWeight: '600' },

  // Strip
  strip: { flexGrow: 0 },
  stripContent: { paddingHorizontal: 8 },
  stripItem: {
    width: FRAME_ITEM_W,
    height: 72,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderRadius: 8,
  },
  stripItemCurrent: { backgroundColor: '#1C1C1E' },
  stripNum: { fontSize: 10, fontWeight: '600', color: '#48484A', letterSpacing: 0.3 },
  stripNumCurrent: { color: '#00CEC9' },
  stripThrows: { flexDirection: 'row', gap: 2, alignItems: 'center' },
  stripThrowBox: { minWidth: 13, alignItems: 'center' },
  stripThrowText: { fontSize: 13, fontWeight: '600', color: '#48484A' },
  stripThrowTextActive: { color: '#FFFFFF' },
  strikeText: { color: '#00CEC9' },
  stripScore: { fontSize: 11, fontWeight: '600', color: '#8E8E93' },
  stripScoreActive: { color: '#FFFFFF' },

  // Total row
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#38383A',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#38383A',
  },
  totalRight: { alignItems: 'flex-end' },
  totalLabel: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  totalValue: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  totalValueFinal: { color: '#00CEC9' },
  maxLabel: { fontSize: 11, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.5, textAlign: 'right' },
  seriesText: { fontSize: 12, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.8, marginTop: 2 },

  // Strike streak badge
  streakBadge: {
    alignSelf: 'center',
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#2C2C2E',
    marginTop: 6,
    marginBottom: 2,
  },
  streakText: { fontSize: 13, fontWeight: '700', color: '#FFD60A' },

  // Card area
  cardArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  // Active frame card
  activeCard: { alignItems: 'center', gap: 20, width: '100%' },
  activeFrameLabel: { fontSize: 11, fontWeight: '700', color: '#8E8E93', letterSpacing: 1.5 },
  activeSlotsRow: { flexDirection: 'row', gap: 16 },
  activeSlot: {
    width: 80, height: 80, borderRadius: 14,
    backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center',
  },
  activeSlotFilled: { backgroundColor: '#1C1C1E' },
  activeSlotText: { fontSize: 40, fontWeight: '700', color: '#FFFFFF' },
  activeSlotEmpty: { color: '#38383A' },
  activeStrikeText: { color: '#00CEC9', fontSize: 44 },

  // Frame note (inside active card)
  frameNoteWrapper: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#38383A',
    paddingTop: 4,
  },
  frameNoteToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  frameNoteLabel: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  frameNoteInput: {
    fontSize: 14,
    color: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 0,
    minHeight: 36,
  },

  // Complete card
  completeCard: { alignItems: 'center', gap: 8 },
  completeTitle: { fontSize: 15, color: '#8E8E93', fontWeight: '500', letterSpacing: 0.5 },
  completeFinalScore: { fontSize: 80, fontWeight: '800', color: '#00CEC9' },
  completeLabel: { fontSize: 13, color: '#48484A', fontWeight: '500' },
  doneButton: {
    marginTop: 16,
    backgroundColor: '#00CEC9',
    borderRadius: 13,
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  doneButtonText: { fontSize: 17, fontWeight: '700', color: '#000000' },

  // Per-throw note bar (Live mode)
  throwNoteBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#38383A',
    backgroundColor: '#000000',
    paddingHorizontal: 16,
  },
  throwNoteToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  throwNoteLabel: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  throwNoteInput: {
    fontSize: 14,
    color: '#FFFFFF',
    paddingVertical: 8,
    paddingBottom: 12,
    minHeight: 36,
  },

  // Cancel header button
  cancelText: { fontSize: 17, color: '#00CEC9' },

  // Delete row
  deleteRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#38383A',
    backgroundColor: '#000000',
  },
  deleteRowDisabled: { opacity: 0.3 },
  deleteRowText: { fontSize: 15, fontWeight: '600', color: '#FF453A' },
  deleteRowTextDisabled: { color: '#8E8E93' },

  // Chip bar
  chipBar: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
    paddingTop: 10,
    paddingHorizontal: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#38383A',
  },
  chip: {
    flex: 1, marginHorizontal: 2, paddingVertical: 14,
    borderRadius: 8, backgroundColor: '#2C2C2E',
    alignItems: 'center', justifyContent: 'center',
  },
  chipDisabled: { backgroundColor: '#1C1C1E' },
  chipText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  chipTextDisabled: { color: '#38383A' },

  // Input mode toggle (Pins / Quick)
  inputModeBar: {
    flexDirection: 'row',
    backgroundColor: '#000000',
    borderRadius: 8,
    padding: 2,
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 2,
  },
  inputModePill: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: 'center',
  },
  inputModePillActive: { backgroundColor: '#2C2C2E' },
  inputModeText: { fontSize: 12, color: '#48484A', fontWeight: '500' },
  inputModeTextActive: { color: '#FFFFFF', fontWeight: '600' },

  // Pin deck container (replaces chip bar area)
  pinDeckContainer: {
    backgroundColor: '#1C1C1E',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#38383A',
  },

  // Frame strip bottom row (score + optional pin dot)
  stripBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  stripPinDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00CEC9',
  },
});
