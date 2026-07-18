import { View, Text, StyleSheet } from 'react-native';
import type { ViewStyle, TextStyle } from 'react-native';
import type { ThrowEntry } from '@/src/types';

// ---------------------------------------------------------------------------
// FrameGrid — shared mini scorecard used by the Log tab (inline in each
// GameRow) and the History tab (expanded card + share card).
//
// The JSX/logic — throw-slicing, 10th-frame handling, and the leave mini-deck
// mapping — lives here once. Two visual treatments are selected by `variant`:
//   • 'compact' — Log's separated, fixed-width boxes that wrap.
//   • 'full'    — History's connected, bordered, flex scorecard.
// The two style tables below are byte-for-byte the originals from log.tsx /
// history.tsx, so each surface renders exactly as before — with the single
// deliberate exception that the standing-pin color is now unified (see
// STANDING_PIN), fixing log's earlier drift to #FFFFFF (audit S16).
// ---------------------------------------------------------------------------

// Pin index → row layout for the mini leave diagram (indices 0-9 = pins 1-10).
const MINI_PIN_ROWS: number[][] = [[6, 7, 8, 9], [3, 4, 5], [1, 2], [0]];

// Standing-pin color — single source of truth. Teal accent, matching the
// canonical Stats "Leaves" LeaveMiniPinDeck. Referenced by both variants so
// the two decks can never drift apart again. Knocked-down pins recede to
// #38383A (kept literal per variant — they never diverged).
const STANDING_PIN = '#00CEC9';

export type FrameGridVariant = 'compact' | 'full';

type FrameStyles = {
  frameGrid: ViewStyle;
  frameBox: ViewStyle;
  frameBoxWide: ViewStyle;
  frameThrows: ViewStyle;
  frameThrowChip: TextStyle;
  strikeChip: TextStyle;
  frameNumberRow: ViewStyle;
  frameNumberText: TextStyle;
  miniDeck: ViewStyle;
  miniRow: ViewStyle;
  miniPin: ViewStyle;
  miniPinUp: ViewStyle;
  miniPinDown: ViewStyle;
};

function MiniPinDeck({ pinsStanding, styles }: { pinsStanding: boolean[]; styles: FrameStyles }) {
  if (!pinsStanding.some(s => s)) return null; // all down → nothing interesting to show
  return (
    <View style={styles.miniDeck}>
      {MINI_PIN_ROWS.map((row, ri) => (
        <View key={ri} style={styles.miniRow}>
          {row.map(idx => (
            <View
              key={idx}
              style={[styles.miniPin, pinsStanding[idx] ? styles.miniPinUp : styles.miniPinDown]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export function FrameGrid({ frames, variant }: { frames: ThrowEntry[]; variant: FrameGridVariant }) {
  const styles = variant === 'full' ? fullStyles : compactStyles;
  return (
    <View style={styles.frameGrid}>
      {frames.slice(0, 10).map((frame, fi) => {
        const is10th = fi === 9;
        const throws = is10th ? frame.throws.slice(0, 3) : frame.throws.slice(0, 2);
        // Show mini pin diagram for the state after the first ball (the leave)
        const leaveData = frame.pinsStanding?.[0] ?? null;
        return (
          <View key={fi} style={[styles.frameBox, is10th && styles.frameBoxWide]}>
            <View style={styles.frameThrows}>
              {throws.map((t, ti) => (
                <Text key={ti} style={[styles.frameThrowChip, t === 'X' && styles.strikeChip]}>
                  {t}
                </Text>
              ))}
            </View>
            {leaveData && <MiniPinDeck pinsStanding={leaveData} styles={styles} />}
            <View style={styles.frameNumberRow}>
              <Text style={styles.frameNumberText}>{fi + 1}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// 'compact' — copied verbatim from log.tsx; only miniPinUp changed (was
// '#FFFFFF', now the unified STANDING_PIN).
const compactStyles: FrameStyles = StyleSheet.create({
  frameGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  frameBox: {
    width: 28,
    backgroundColor: '#2C2C2E',
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 2,
    alignItems: 'center',
    gap: 2,
  },
  frameBoxWide: { width: 38 },
  frameThrows: { flexDirection: 'row', gap: 1, flexWrap: 'wrap', justifyContent: 'center' },
  frameThrowChip: { fontSize: 9, fontWeight: '500', color: '#FFFFFF' },
  strikeChip: { color: '#00CEC9' },
  frameNumberRow: { marginTop: 1 },
  frameNumberText: { fontSize: 7, color: '#48484A', fontWeight: '500' },
  miniDeck: { gap: 1 },
  miniRow: { flexDirection: 'row', justifyContent: 'center', gap: 1 },
  miniPin: { width: 4, height: 4, borderRadius: 2 },
  miniPinUp: { backgroundColor: STANDING_PIN },
  miniPinDown: { backgroundColor: '#38383A' },
});

// 'full' — copied verbatim from history.tsx; miniPinUp value unchanged
// (#00CEC9), now sourced from the shared STANDING_PIN constant.
const fullStyles: FrameStyles = StyleSheet.create({
  frameGrid: {
    flexDirection: 'row',
    marginTop: 6,
    borderWidth: 0.5,
    borderColor: '#38383A',
    borderRadius: 6,
    overflow: 'hidden',
  },
  frameBox: {
    flex: 1,
    borderRightWidth: 0.5,
    borderRightColor: '#38383A',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  frameBoxWide: {
    flex: 1.4,
    borderRightWidth: 0,
  },
  frameThrows: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 2,
    minHeight: 16,
  },
  frameThrowChip: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '500',
  },
  strikeChip: {
    color: '#00CEC9',
  },
  frameNumberRow: {
    marginTop: 2,
    borderTopWidth: 0.5,
    borderTopColor: '#38383A',
    width: '100%',
    alignItems: 'center',
    paddingTop: 2,
  },
  frameNumberText: {
    color: '#48484A',
    fontSize: 8,
  },
  miniDeck: {
    alignItems: 'center',
    gap: 1.5,
    marginVertical: 2,
  },
  miniRow: {
    flexDirection: 'row',
    gap: 1.5,
  },
  miniPin: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  miniPinUp: { backgroundColor: STANDING_PIN },
  miniPinDown: { backgroundColor: '#38383A' },
});
