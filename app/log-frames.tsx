import { useState, useLayoutEffect, useEffect, useRef, useCallback } from 'react';
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

import { IconSymbol } from '@/components/ui/icon-symbol';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ThrowVal = string; // 'X' | '/' | '—' | '0'-'9'
type FrameData = {
  throws: ThrowVal[];
  note: string;
  throwNotes: string[]; // indexed by throw position
};
type Mode = 'post' | 'live';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHIPS: string[] = ['X', '/', '—', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const FRAME_ITEM_W = 52;
const FRAME_RESULT_KEY = 'mbowl_frame_result';

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
// Sub-components
// ---------------------------------------------------------------------------

function FrameStripItem({
  frame, index, score, isCurrent,
}: {
  frame: FrameData; index: number; score: number | null; isCurrent: boolean;
}) {
  const slotCount = index === 9 ? 3 : 2;
  return (
    <View style={[styles.stripItem, isCurrent && styles.stripItemCurrent]}>
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
      <Text style={[styles.stripScore, isCurrent && styles.stripScoreActive]}>
        {score !== null ? String(score) : ''}
      </Text>
    </View>
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
  return Array.from({ length: 10 }, () => ({ throws: [], note: '', throwNotes: [] }));
}

export default function LogFramesScreen() {
  const { gameIndex } = useLocalSearchParams<{ gameIndex: string }>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const stripRef = useRef<FlatList<FrameData>>(null);

  const [mode, setMode] = useState<Mode>('post');
  const [frames, setFrames] = useState<FrameData[]>(emptyFrames);
  const [currentFrame, setCurrentFrame] = useState(0);

  // Strip auto-scroll
  useEffect(() => {
    stripRef.current?.scrollToIndex({
      index: Math.min(currentFrame, 9),
      animated: true,
      viewPosition: 0.5,
    });
  }, [currentFrame]);

  // Derived
  const scores = calculateScores(frames);
  const allComplete = isFrameComplete(frames, 9);
  const available = allComplete ? new Set<string>() : getAvailableChips(frames, currentFrame);
  const runningTotal = [...scores].reverse().find((s) => s !== null) ?? null;
  const canDelete = frames.some((f) => f.throws.length > 0);

  // ---- Actions ------------------------------------------------------------

  function addThrow(chip: string) {
    if (allComplete) return;
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

  function deleteLastThrow() {
    if (frames[currentFrame].throws.length > 0) {
      setFrames((prev) =>
        prev.map((f, i) =>
          i === currentFrame ? { ...f, throws: f.throws.slice(0, -1) } : f
        )
      );
    } else if (currentFrame > 0) {
      const prevFi = currentFrame - 1;
      setFrames((prev) =>
        prev.map((f, i) =>
          i === prevFi ? { ...f, throws: f.throws.slice(0, -1) } : f
        )
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
        const throwNotes = [...f.throwNotes];
        throwNotes[ti] = note;
        return { ...f, throwNotes };
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
  handleCancelRef.current = useCallback(() => {
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
  }, [frames, navigation]);

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
    mode === 'live' && !allComplete && frames[currentFrame].throws.length > 0;

  return (
    <View style={styles.container}>
      {/* Mode toggle */}
      <View style={styles.toggleBar}>
        {(['post', 'live'] as Mode[]).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.togglePill, mode === m && styles.togglePillActive]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.toggleText, mode === m && styles.toggleTextActive]}>
              {m === 'post' ? 'Post-Game' : 'Live'}
            </Text>
          </TouchableOpacity>
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
            isCurrent={index === currentFrame && !allComplete}
          />
        )}
        style={styles.strip}
        contentContainerStyle={styles.stripContent}
      />

      {/* Running total */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Running Total</Text>
        <Text style={[styles.totalValue, allComplete && styles.totalValueFinal]}>
          {runningTotal !== null ? String(runningTotal) : '—'}
        </Text>
      </View>

      {/* Active frame card or complete state */}
      <View style={styles.cardArea}>
        {allComplete ? (
          <View style={styles.completeCard}>
            <Text style={styles.completeTitle}>All Frames Complete</Text>
            <Text style={styles.completeFinalScore}>{scores[9]}</Text>
            <Text style={styles.completeLabel}>Final Score</Text>
            <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
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

      {/* Delete last throw */}
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

      {/* Chip bar */}
      <ChipBar available={available} onPress={addThrow} bottomInset={insets.bottom} />
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
  totalLabel: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  totalValue: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  totalValueFinal: { color: '#00CEC9' },

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
});
