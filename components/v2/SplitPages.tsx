// Open-screen page pairs (Phase 28 WP6). Two pages side by side (open
// landscape) or top / bottom (open portrait), split at the fold.
//
// The spec's first choice, @expo/ui ArrangementView, needs iOS 27.1 and hosts
// SwiftUI views, so this is the spec's fallback: a plain row (or column) with
// a 40pt gap where the fold is. Each page manages its own scroll and data
// loading; each gets its width through PageContext.
import type { ReactNode } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageContext } from '@/src/v2/page';
import { color } from '@/src/v2/theme';

/** Gap left free at the fold (spec: x 455-495 on the open landscape screen). */
export const FOLD_GAP = 40;

export default function SplitPages({
  first,
  second,
  stacked = false,
}: {
  first: ReactNode;
  second: ReactNode;
  /** Open portrait: first on top, second below. */
  stacked?: boolean;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const usable = Math.max(0, width - insets.left - insets.right);
  const paneWidth = stacked ? usable : Math.max(0, (usable - FOLD_GAP) / 2);
  const frame = { width: paneWidth };

  return (
    <View
      style={[
        styles.split,
        stacked && styles.stacked,
        { paddingLeft: insets.left, paddingRight: insets.right },
      ]}
    >
      <View style={styles.pane}>
        <PageContext.Provider value={frame}>{first}</PageContext.Provider>
      </View>
      {stacked && <View style={styles.foldLine} />}
      <View style={styles.pane}>
        <PageContext.Provider value={frame}>{second}</PageContext.Provider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  split: { flex: 1, flexDirection: 'row', gap: FOLD_GAP, backgroundColor: color.bg },
  stacked: { flexDirection: 'column', gap: FOLD_GAP / 2 },
  pane: { flex: 1, overflow: 'hidden' },
  foldLine: { height: StyleSheet.hairlineWidth, backgroundColor: color.border },
});
