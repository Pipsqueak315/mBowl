// Open-screen page pairs (Phase 28 WP6). Two pages side by side (open
// landscape) or top / bottom (open portrait), split at the fold.
//
// The spec's first choice, @expo/ui ArrangementView, needs iOS 27.1 and hosts
// SwiftUI views, so this is the spec's fallback: a plain row (or column) with
// a 40pt gap where the fold is. Each page manages its own scroll and data
// loading; each gets its width through PageContext.
//
// State survives fold / unfold / rotate (plan 28.6): both pages always sit at
// the same place in the React tree, whether or not the split is showing; the
// secondary page is hidden (display: none) when folded, never unmounted. So a
// game in progress in Log Frames, an unsaved Log form, or an edit open in the
// second page is never remounted. `secondaryFirst` puts the secondary page on the left / top
// visually (History tab: Stats | History) without moving the primary in the
// tree.
import type { ReactNode } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageContext } from '@/src/v2/page';
import { color } from '@/src/v2/theme';

/** Gap left free at the fold (spec: x 455-495 on the open landscape screen). */
export const FOLD_GAP = 40;

export default function SplitPages({
  primary,
  secondary,
  split,
  stacked = false,
  secondaryFirst = false,
}: {
  primary: ReactNode;
  secondary: ReactNode;
  /** Show both pages. False = the primary alone, full screen. */
  split: boolean;
  /** Open portrait: one page on top, one below. */
  stacked?: boolean;
  /** Show the secondary page on the left (or top). */
  secondaryFirst?: boolean;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const usable = Math.max(0, width - insets.left - insets.right);
  const paneWidth = stacked ? usable : Math.max(0, (usable - FOLD_GAP) / 2);
  // null outside a split: the page then pads itself and sizes to the window.
  const frame = split ? { width: paneWidth } : null;

  const direction = stacked
    ? secondaryFirst ? 'column-reverse' : 'column'
    : secondaryFirst ? 'row-reverse' : 'row';

  return (
    <View
      style={[
        styles.split,
        { flexDirection: direction },
        split && { gap: stacked ? FOLD_GAP / 2 : FOLD_GAP, paddingLeft: insets.left, paddingRight: insets.right },
      ]}
    >
      <View style={styles.pane}>
        <PageContext.Provider value={frame}>{primary}</PageContext.Provider>
      </View>
      {/* The secondary page stays mounted and is only hidden when folded, so
          an edit in progress there (History -> Edit -> Edit Frames) is never
          torn down mid-hand-off -- an unmounted History page would leave its
          KEYS.FRAME_RESULT for the Log tab to pick up (reviewer, Nov 10). */}
      <View style={[styles.pane, !split && styles.hidden]}>
        <PageContext.Provider value={frame}>{secondary}</PageContext.Provider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  split: { flex: 1, backgroundColor: color.bg },
  pane: { flex: 1, overflow: 'hidden' },
  hidden: { display: 'none' },
});
