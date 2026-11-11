import { useState, useLayoutEffect, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, usePreventRemove } from 'expo-router/react-navigation';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';

import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import type { FrameData, ThrowEntry } from '@/src/types';
import { KEYS } from '@/src/storage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import ScalePressable from '@/components/ScalePressable';
import PinDeck from '@/components/PinDeck';
import SegmentedControl from '@/components/v2/SegmentedControl';
import Scorecard from '@/components/v2/Scorecard';
import Keypad from '@/components/v2/Keypad';
import { useLayoutClass } from '@/src/v2/layout';
import { useSideInsets } from '@/src/v2/page';
import SplitPages from '@/components/v2/SplitPages';
import StatsPage from '@/components/pages/StatsPage';
import { color } from '@/src/v2/theme';

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

const MODE_SEGMENTS = [
  { key: 'live', label: 'Live' },
  { key: 'post', label: 'Post-game' },
] as const;
const INPUT_SEGMENTS = [
  { key: 'pins', label: 'Pins' },
  { key: 'quick', label: 'Quick' },
] as const;
// Window heights below this get the compact layout (26.5). The Duo cover screen
// is 678pt; a standard 6.1" iPhone is 844pt.
const COMPACT_HEIGHT = 760;
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

// Count consecutive 'X' throws ending at the most recently thrown ball.
// Walk frames backward from the last frame that has any throws; an empty
// (skipped) frame is a gap that ends the streak, as does any non-strike
// throw. The 10th frame's multiple strikes each count.
function getStrikeStreak(frames: FrameData[]): number {
  let lastPlayed = -1;
  for (let fi = 9; fi >= 0; fi--) {
    if (frames[fi].throws.length > 0) { lastPlayed = fi; break; }
  }
  if (lastPlayed === -1) return 0;

  let streak = 0;
  for (let fi = lastPlayed; fi >= 0; fi--) {
    const throws = frames[fi].throws;
    if (throws.length === 0) break; // skipped frame → gap → streak ends
    let broke = false;
    for (let ti = throws.length - 1; ti >= 0; ti--) {
      if (throws[ti] === 'X') streak++;
      else { broke = true; break; }
    }
    if (broke) break;
  }
  return streak;
}

// ---------------------------------------------------------------------------
// Chip availability
// ---------------------------------------------------------------------------

// Count chips for a 2nd/3rd ball at a partial rack: only counts strictly below
// the pins left are valid — clearing them all is a spare, entered via '/'.
function countChipsBelow(pinsLeft: number): string[] {
  const avail: string[] = ['/', '—'];
  for (let i = 0; i < pinsLeft; i++) avail.push(String(i));
  return avail;
}

function getAvailableChips(frames: FrameData[], fi: number): Set<string> {
  // A complete frame takes no further throws — 10th included.
  if (isFrameComplete(frames, fi)) return new Set();

  const { throws } = frames[fi];
  const ti = throws.length;
  const is10th = fi === 9;

  if (!is10th) {
    if (ti === 0) return new Set(['X', '—', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    const t1Pins = throws[0] === '—' ? 0 : parseInt(throws[0], 10);
    return new Set(countChipsBelow(10 - t1Pins));
  }

  if (ti === 0) return new Set(['X', '—', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
  if (ti === 1) {
    const t1 = throws[0];
    if (t1 === 'X') return new Set(['X', '—', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    const t1Pins = t1 === '—' ? 0 : parseInt(t1, 10);
    return new Set(countChipsBelow(10 - t1Pins));
  }
  const t1 = throws[0], t2 = throws[1];
  if (t1 === 'X' && t2 === 'X') return new Set(['X', '—', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
  if (t1 === 'X') {
    const t2Pins = t2 === '—' ? 0 : parseInt(t2, 10);
    return new Set(countChipsBelow(10 - t2Pins));
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
// Returns null when the frame is complete — there is no pending throw to enter.
function getPinDeckProps(
  frames: FrameData[],
  fi: number,
): { availablePins: boolean[]; isFirstThrow: boolean; prevPinsStanding: boolean[] | null } | null {
  if (isFrameComplete(frames, fi)) return null;

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
  compact = false,
}: {
  frame: FrameData;
  frameIndex: number;
  onNoteChange: (note: string) => void;
  compact?: boolean;
}) {
  const slotCount = frameIndex === 9 ? 3 : 2;
  const { throws } = frame;
  const ball = Math.min(throws.length + 1, slotCount);

  const slots = Array.from({ length: slotCount }).map((_, i) => {
    const t = throws[i];
    const filled = t !== undefined;
    const isNext = i === throws.length;
    return (
      <View
        key={i}
        style={[
          styles.activeSlot,
          compact && styles.activeSlotCompact,
          filled && styles.activeSlotFilled,
          compact && isNext && styles.activeSlotNext,
        ]}
      >
        <Text style={[
          styles.activeSlotText,
          compact && styles.activeSlotTextCompact,
          !filled && styles.activeSlotEmpty,
          t === 'X' && styles.activeStrikeText,
          compact && t === 'X' && styles.activeStrikeTextCompact,
        ]}>
          {filled ? t : compact ? '' : '·'}
        </Text>
      </View>
    );
  });

  // Phase 28 WP2 (short windows -- the cover screen): one row, small slots,
  // "Frame 6 · ball 2", as in the approved render. Leaves room for the note.
  if (compact) {
    return (
      <View style={[styles.activeCard, styles.activeCardTight]}>
        <View style={styles.activeRow}>
          <View style={styles.activeSlotsRowCompact}>{slots}</View>
          <Text style={styles.activeRowLabel}>
            Frame {frameIndex + 1} · ball {ball}
          </Text>
        </View>
        <FrameNoteField value={frame.note} onChange={onNoteChange} />
      </View>
    );
  }

  return (
    <View style={styles.activeCard}>
      <Text style={styles.activeFrameLabel}>Frame {frameIndex + 1}</Text>
      <View style={styles.activeSlotsRow}>{slots}</View>
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

function LogFramesBody() {
  const { gameIndex, priorScores, initialFrames } = useLocalSearchParams<{
    gameIndex: string;
    priorScores?: string;
    initialFrames?: string;
  }>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  // 27.0 M3: the screen stays on for as long as Log Frames is open (live
  // scoring between throws); released automatically when the screen unmounts.
  useKeepAwake();
  // 26.5: short windows (the Duo's 678pt cover screen, SE-size phones) get a
  // tighter layout so the pin deck + Confirm never fall off the bottom. Read
  // live from useWindowDimensions so it re-evaluates on fold / unfold.
  const { height: windowHeight } = useWindowDimensions();
  const compact = windowHeight < COMPACT_HEIGHT;
  // Phase 28 WP2: arrangement from the usable window (Duo rail excluded).
  // compactWide = short + wide (cover landscape): input and frame info sit
  // side by side. Everything else is the portrait stack.
  const { layout } = useLayoutClass();
  const wide = layout === 'compactWide';
  const narrow = layout === 'compact';

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

  // When mode changes, reset inputMode to pins (default for both modes).
  useEffect(() => {
    setInputMode('pins');
  }, [mode]);

  // Derived — all memoised on frames so scoring only reruns when frames changes
  const scores = useMemo(() => calculateScores(frames), [frames]);
  // Every frame, not just the 10th — a complete 10th over empty earlier frames
  // is not a finished game and scores[9] would be null.
  const allComplete = useMemo(
    () => frames.every((_, i) => isFrameComplete(frames, i)),
    [frames],
  );
  const currentFrameComplete = useMemo(
    () => isFrameComplete(frames, currentFrame),
    [frames, currentFrame],
  );
  const available = useMemo(
    () => getAvailableChips(frames, currentFrame),
    [frames, currentFrame],
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
    if (currentFrameComplete) return;
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
    if (currentFrameComplete) return;
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
    // A fast double tap on the final-score card's Done must not write twice or
    // go back twice.
    if (savedRef.current) return;
    // Backstop: never persist a placeholder 0 over a game that has not scored out.
    if (scores[9] === null) {
      Alert.alert('Game Not Complete', 'Fill in every frame before saving.');
      return;
    }
    const result = {
      gameIndex: gameIndex !== undefined ? parseInt(gameIndex, 10) : 0,
      score: scores[9],
      frames,
    };
    // Mark the save BEFORE the await, so a swipe-back during the write can't
    // raise the discard confirm under a screen that is about to close.
    savedRef.current = true;
    try {
      await AsyncStorage.setItem(KEYS.FRAME_RESULT, JSON.stringify(result));
    } catch (e) {
      savedRef.current = false;
      console.error('[log-frames] saving frame result failed', e);
      Alert.alert('Save Failed', 'Your frames were not saved. Tap Done to try again.');
      return;
    }
    navigation.goBack();
  }

  // ---- Leaving the screen (26.3) -------------------------------------------
  // ONE "Discard Frames?" confirm guards every way out: the header Cancel
  // button, the iOS swipe-back gesture (native-stack cancels the native dismiss
  // and routes it here), and any other pop. Done sets savedRef first so it is
  // never challenged. "Unsaved" means changed since the screen opened — so
  // backing out of History → Edit Frames without touching anything doesn't
  // warn about losing data that was never changed.
  // B2 cancel boundary is unchanged: a discard never writes KEYS.FRAME_RESULT,
  // so callers still infer "cancelled" from the key's absence.
  const savedRef = useRef(false);
  // Snapshot of the frames as the screen opened (lazy initial state: computed
  // once, on the first render, from the initial `frames`).
  const [initialFramesJson] = useState(() => JSON.stringify(frames));
  const isDirty = useMemo(() => JSON.stringify(frames) !== initialFramesJson, [frames, initialFramesJson]);
  usePreventRemove(isDirty, ({ data }) => {
    if (savedRef.current) {
      navigation.dispatch(data.action);
      return;
    }
    Alert.alert(
      'Discard Frames?',
      'Your frame data will not be saved.',
      [
        { text: 'Keep Editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            navigation.dispatch(data.action);
          },
        },
      ]
    );
  });

  // Header Cancel just asks to leave; usePreventRemove above decides whether
  // that needs the confirm (frames entered) or can go straight back (empty).
  const handleCancelRef = useRef<() => void>(() => {});
  handleCancelRef.current = () => {
    navigation.goBack();
  };

  // Header (Phase 28 WP2): ✕ leading and "Game N". Set once per screen and
  // never changed while the screen is open.
  // Nov 11 fix: WP2 also added a teal Done capsule as headerRight, inserted
  // into the native header the moment the game completed. On the Duo that
  // mid-screen header change wedged the screen at game over -- Done, the
  // capsule and ✕ all stopped responding, then the app aborted (SIGABRT on the
  // TurboModule queue, crash log 2026-11-11 06:29). The pre-v2 header never
  // changed mid-screen and never hung, so the header is static again and Done
  // lives only in the "Final score" card. Cancel goes through a ref so the
  // header never holds a stale closure.
  useLayoutEffect(() => {
    const gameNum = gameIndex !== undefined ? parseInt(gameIndex, 10) + 1 : '';
    navigation.setOptions({
      title: gameNum ? `Game ${gameNum}` : 'Log Frames',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => handleCancelRef.current()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.headerIconBtn}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <IconSymbol name="xmark" size={17} color={color.white} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, gameIndex]);

  // ---- Render -------------------------------------------------------------

  const showThrowNoteBar =
    mode === 'live' && inputMode === 'quick' && !(allComplete && currentFrame === 9) && frames[currentFrame].throws.length > 0;

  // Compute PinDeck props once — used in render to avoid duplication.
  // null when the frame is complete, which falls the input area back to the
  // (fully disabled) chip bar so the layout height stays stable.
  const pinDeckProps = inputMode === 'pins' ? getPinDeckProps(frames, currentFrame) : null;

  function selectFrame(index: number) {
    if (index === currentFrame) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentFrame(index);
  }

  const isGameOver = allComplete && currentFrame === 9;

  // --- Pieces shared by every arrangement ---------------------------------

  const controls = (
    <View style={styles.controlsRow}>
      <View style={styles.controlCell}>
        <SegmentedControl
          segments={MODE_SEGMENTS}
          value={mode}
          onChange={(k) => setMode(k)}
          accessibilityLabel="Scoring mode"
        />
      </View>
      <View style={styles.controlCell}>
        <SegmentedControl
          segments={INPUT_SEGMENTS}
          value={inputMode}
          onChange={(k) => setInputMode(k)}
          accessibilityLabel="Input mode"
        />
      </View>
    </View>
  );

  const scorecard = (
    <Scorecard
      frames={frames}
      scores={scores}
      currentFrame={currentFrame}
      onSelect={selectFrame}
      tall={!compact}
    />
  );

  const totals = (
    <View style={styles.totalRow}>
      <View>
        <Text style={styles.totalLabel}>Running total</Text>
        {showSeries && <Text style={styles.seriesText}>Series {seriesTotal}</Text>}
      </View>
      <View style={styles.totalRight}>
        {maxScore !== null && <Text style={styles.maxLabel}>Max {maxScore}</Text>}
        <Text style={[styles.totalValue, allComplete && styles.totalValueFinal]}>
          {runningTotal !== null ? String(runningTotal) : '—'}
        </Text>
      </View>
    </View>
  );

  const streak = showStreak ? (
    <Animated.View style={[styles.streakBadge, streakAnimStyle]}>
      <Text style={styles.streakText}>🔥 {strikeStreak} in a row</Text>
    </Animated.View>
  ) : null;

  // The middle scrolls instead of overlapping when a short window can't fit
  // everything (Nov 10 Duo check F4: FRAME 1 / Running Total and Frame note /
  // Delete Last Throw collided on the cover screen).
  const middle = (
    <ScrollView
      style={styles.middle}
      contentContainerStyle={styles.middleContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {streak}
      {isGameOver ? (
        <View style={styles.completeCard}>
          <Text style={styles.completeTitle}>Final score</Text>
          <Text style={[styles.completeFinalScore, compact && styles.completeFinalScoreCompact]}>
            {scores[9]}
          </Text>
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
          compact={compact}
        />
      )}
      {showThrowNoteBar && (
        <ThrowNoteBar
          key={`${currentFrame}-${frames[currentFrame].throws.length}`}
          frame={frames[currentFrame]}
          onThrowNoteChange={(ti, note) => updateThrowNote(currentFrame, ti, note)}
        />
      )}
    </ScrollView>
  );

  // Pins mode: delete-last-throw is its own row. Quick mode: the ⌫ key.
  const deleteRow = (
    <TouchableOpacity
      style={[styles.deleteRow, !canDelete && styles.deleteRowDisabled]}
      onPress={deleteLastThrow}
      disabled={!canDelete}
      activeOpacity={0.6}
      accessibilityRole="button"
    >
      <Text style={[styles.deleteRowText, !canDelete && styles.deleteRowTextDisabled]}>
        ⌫  Delete last throw
      </Text>
    </TouchableOpacity>
  );

  const pinDeck = pinDeckProps ? (
    <PinDeck
      key={`pd-${currentFrame}-${frames[currentFrame].throws.length}`}
      availablePins={pinDeckProps.availablePins}
      isFirstThrow={pinDeckProps.isFirstThrow}
      prevPinsStanding={pinDeckProps.prevPinsStanding}
      onConfirm={(ps, notation) => addThrowWithPins(notation, ps)}
      compact={compact}
      side={wide}
    />
  ) : null;

  // Quick mode, or a finished game in Pins mode (keys all disabled, ⌫ live).
  const keypad = (
    <Keypad
      columns={narrow ? 7 : 4}
      available={currentFrameComplete ? new Set<string>() : available}
      canDelete={canDelete}
      onKey={addThrow}
      onDelete={deleteLastThrow}
      keyHeight={narrow ? 48 : wide ? 46 : 60}
    />
  );

  // Each band pads itself by the side insets, so the grey input panel and the
  // hairlines run edge to edge while the content clears the Duo's rail and
  // status column (Nov 10 check: the grey panel stopped short of the rail).
  const side = useSideInsets();
  const padSides = { paddingLeft: side.left, paddingRight: side.right };

  // --- Cover landscape: input on the left, frame info on the right ---------
  if (wide) {
    return (
      <View style={styles.container}>
        <View style={[styles.wideTop, padSides]}>
          {controls}
          {scorecard}
        </View>
        <View style={[styles.wideBody, padSides, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.wideInput}>
            {pinDeck ?? <View style={styles.wideKeypad}>{keypad}</View>}
          </View>
          <View style={styles.wideInfo}>
            {totals}
            {middle}
            {pinDeck && deleteRow}
          </View>
        </View>
      </View>
    );
  }

  // --- Portrait stack (cover portrait, phones, open screen) ----------------
  // Log Frames has no tab bar, so on the Duo's cover screen the right 84pt
  // column only holds the clock (y 75-160, measured Nov 10). The top band --
  // the two toggles and the running total -- stays clear of it; everything
  // from the scorecard down uses the full width (scorecard cells ~43pt
  // instead of ~34, wider Strike / Confirm and keypad).
  return (
    <View style={styles.container}>
      <View style={[styles.top, padSides]}>{controls}</View>
      <View style={padSides}>{totals}</View>
      <View style={styles.scorecardBand}>{scorecard}</View>
      <View style={styles.middleWrap}>{middle}</View>
      {pinDeck ? (
        <>
          {deleteRow}
          <View style={[styles.inputArea, { paddingBottom: insets.bottom + 8 }]}>{pinDeck}</View>
        </>
      ) : (
        <View style={[styles.inputArea, styles.keypadArea, { paddingBottom: insets.bottom + 8 }]}>
          {keypad}
        </View>
      )}
    </View>
  );
}

// Phase 28 WP6: on the open screen in landscape, Log Frames | Stats. Open
// portrait gives Log Frames the whole screen (spec); the cover screen and
// phones show Log Frames alone. LogFramesBody keeps its place in the tree in
// every case, so a game in progress survives fold / unfold / rotate.
export default function LogFramesScreen() {
  const { layout } = useLayoutClass();
  return (
    <SplitPages
      split={layout === 'splitSideBySide'}
      primary={<LogFramesBody />}
      secondary={<StatsPage embedded />}
    />
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },

  // Phase 28 WP2 arrangement
  middleWrap: { flex: 1 },
  scorecardBand: { paddingHorizontal: 8, paddingTop: 10 },
  top: { paddingHorizontal: 12, paddingTop: 10, gap: 10, paddingBottom: 10 },
  controlsRow: { flexDirection: 'row', gap: 10 },
  controlCell: { flex: 1 },
  middle: { flex: 1 },
  middleContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 8 },
  inputArea: {
    backgroundColor: '#1C1C1E',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#38383A',
  },
  keypadArea: { paddingTop: 10, paddingHorizontal: 10 },
  wideTop: { paddingHorizontal: 12, paddingTop: 8, gap: 8, paddingBottom: 8 },
  wideBody: { flex: 1, flexDirection: 'row' },
  wideInput: { justifyContent: 'center', paddingHorizontal: 4 },
  wideKeypad: { width: 300, paddingHorizontal: 8 },
  wideInfo: {
    flex: 1,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#38383A',
  },

  // Header buttons
  headerIconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  // Total row
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#38383A',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#38383A',
  },
  totalRight: { alignItems: 'flex-end' },
  totalLabel: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  totalValue: { fontSize: 22, fontWeight: '300', color: '#FFFFFF' },
  totalValueFinal: { color: '#00CEC9' },
  maxLabel: { fontSize: 12, fontWeight: '500', color: '#8E8E93', textAlign: 'right' },
  seriesText: { fontSize: 12, fontWeight: '500', color: '#8E8E93', marginTop: 2 },

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
  streakText: { fontSize: 13, fontWeight: '600', color: '#FFD60A' },

  // Active frame card
  activeCard: { alignItems: 'center', gap: 20, width: '100%' },
  activeFrameLabel: { fontSize: 13, fontWeight: '500', color: '#8E8E93' },
  activeSlotsRow: { flexDirection: 'row', gap: 16 },
  activeSlot: {
    width: 80, height: 80, borderRadius: 14,
    backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center',
  },
  activeSlotCompact: { width: 44, height: 44, borderRadius: 10 },
  activeSlotTextCompact: { fontSize: 22, fontWeight: '300' },
  activeStrikeTextCompact: { fontSize: 22 },
  activeSlotNext: { borderWidth: 1.5, borderColor: '#00CEC9', backgroundColor: 'transparent' },
  activeCardTight: { gap: 6, alignItems: 'stretch' },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 14, alignSelf: 'stretch' },
  activeSlotsRowCompact: { flexDirection: 'row', gap: 8 },
  activeRowLabel: { fontSize: 15, color: '#8E8E93', fontWeight: '400' },
  activeSlotFilled: { backgroundColor: '#1C1C1E' },
  activeSlotText: { fontSize: 40, fontWeight: '200', color: '#FFFFFF' },
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
  completeTitle: { fontSize: 15, color: '#8E8E93', fontWeight: '500' },
  completeFinalScore: { fontSize: 80, fontWeight: '200', color: '#00CEC9' },
  completeFinalScoreCompact: { fontSize: 60 },
  doneButton: {
    marginTop: 16,
    backgroundColor: '#00CEC9',
    borderRadius: 13,
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  doneButtonText: { fontSize: 17, fontWeight: '600', color: '#000000' },

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

});
