// Layout classes (Phase 28 WP0). One hook decides which arrangement a screen
// renders, from the USABLE window: window size minus the left/right safe-area
// insets, so the Duo's 84pt side rail doesn't count as page width.
// Re-evaluates live on fold, unfold, and rotation (useWindowDimensions).
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type LayoutClass = 'compact' | 'compactWide' | 'splitSideBySide' | 'splitStacked';

/** Tune after checking on the Duo — one place, one line each. */
export const LAYOUT_THRESHOLDS = {
  /** Below this usable width: one portrait page (cover portrait ≈382, phones). */
  compactMaxWidth: 520,
  /** Usable width at/above this: two pages side by side (open landscape ≈951). */
  sideBySideMinWidth: 820,
  /** Height below this with a wide window: cover landscape (≈466). */
  shortMaxHeight: 520,
  /** Height at/above this with a mid width: open portrait, stacked (≈951). */
  stackedMinHeight: 820,
} as const;

export function classifyLayout(usableWidth: number, height: number): LayoutClass {
  const t = LAYOUT_THRESHOLDS;
  if (usableWidth >= t.sideBySideMinWidth) return 'splitSideBySide';
  if (usableWidth >= t.compactMaxWidth && height >= t.stackedMinHeight) return 'splitStacked';
  if (usableWidth >= t.compactMaxWidth && height < t.shortMaxHeight) return 'compactWide';
  return 'compact';
}

export function useLayoutClass(): {
  layout: LayoutClass;
  usableWidth: number;
  height: number;
  isSplit: boolean;
} {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const usableWidth = Math.max(0, width - insets.left - insets.right);
  const layout = classifyLayout(usableWidth, height);
  return { layout, usableWidth, height, isSplit: layout === 'splitSideBySide' || layout === 'splitStacked' };
}
