// Page context (Phase 28 WP6). A tab screen renders one page on the cover
// screen and two pages side by side (or stacked) on the open screen. A page
// can't use the window size to lay itself out any more, so it asks here:
//   usePageWidth()  -- the width this page actually has.
//   useSideInsets() -- left/right padding that clears the Duo's rail and status
//                      column. Inside SplitPages the split container already
//                      pads the window edges, so pages get zero here.
import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type PageFrame = { width: number };

export const PageContext = createContext<PageFrame | null>(null);

export function usePageWidth(): number {
  const page = useContext(PageContext);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return page ? page.width : Math.max(0, width - insets.left - insets.right);
}

export function useSideInsets(): { left: number; right: number } {
  const page = useContext(PageContext);
  const insets = useSafeAreaInsets();
  return page ? { left: 0, right: 0 } : { left: insets.left, right: insets.right };
}

/** True when this page is one half of a split. */
export function useIsInSplit(): boolean {
  return useContext(PageContext) !== null;
}
