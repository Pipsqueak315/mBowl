// Log Frames scorecard (Phase 28 WP2). A full-width box score: ten connected
// columns with hairline dividers, the 10th a little wider, the current frame
// tinted teal. Replaces the old horizontally scrolling frame strip, so it
// always fills the page width (Nov 10 Duo check F5) and never scrolls.
// Tapping a frame selects it, exactly like the strip did.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { FrameData } from '@/src/types';
import { color } from '@/src/v2/theme';

export default function Scorecard({
  frames,
  scores,
  currentFrame,
  onSelect,
  tall = false,
}: {
  frames: FrameData[];
  scores: (number | null)[];
  currentFrame: number;
  onSelect: (index: number) => void;
  /** Roomier cells when the window has the height for it. */
  tall?: boolean;
}) {
  return (
    <View style={styles.grid} accessibilityRole="list" accessibilityLabel="Scorecard">
      {frames.slice(0, 10).map((frame, fi) => {
        const is10th = fi === 9;
        const isCurrent = fi === currentFrame;
        const slotCount = is10th ? 3 : 2;
        const hasPinData = !!(frame.pinsStanding && frame.pinsStanding.length > 0);
        const score = scores[fi];
        return (
          <Pressable
            key={fi}
            onPress={() => onSelect(fi)}
            style={({ pressed }) => [
              styles.cell,
              tall && styles.cellTall,
              is10th && styles.cell10th,
              isCurrent && styles.cellCurrent,
              pressed && !isCurrent && styles.cellPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: isCurrent }}
            accessibilityLabel={`Frame ${fi + 1}${score !== null ? `, ${score}` : ''}`}
          >
            <Text style={[styles.num, isCurrent && styles.numCurrent]}>{fi + 1}</Text>
            <View style={styles.throws}>
              {Array.from({ length: slotCount }).map((_, i) => {
                const t = frame.throws[i];
                return (
                  <Text
                    key={i}
                    style={[styles.throw, t === 'X' && styles.strike]}
                    numberOfLines={1}
                  >
                    {t ?? ''}
                  </Text>
                );
              })}
            </View>
            <View style={styles.bottom}>
              <Text style={[styles.score, isCurrent && styles.scoreCurrent]} numberOfLines={1}>
                {score !== null ? String(score) : ''}
              </Text>
              {hasPinData && <View style={styles.pinDot} />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  cell: {
    flex: 1,
    height: 60,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: color.border,
  },
  cellTall: { height: 70 },
  cell10th: { flex: 1.45, borderRightWidth: 0 },
  cellCurrent: { backgroundColor: color.tealTint },
  cellPressed: { backgroundColor: color.surface },
  num: { fontSize: 10, fontWeight: '500', color: color.dimmer },
  numCurrent: { color: color.teal },
  throws: { flexDirection: 'row', gap: 1, alignItems: 'center', minHeight: 17 },
  throw: {
    minWidth: 10,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    color: color.white,
    fontVariant: ['tabular-nums'],
  },
  strike: { color: color.teal },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  score: { fontSize: 11, fontWeight: '500', color: color.dim, fontVariant: ['tabular-nums'] },
  scoreCurrent: { color: color.white },
  pinDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: color.teal },
});
