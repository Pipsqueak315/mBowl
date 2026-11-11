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

/**
 * Edge-to-edge backgrounds (Phase 28 polish, Marcus Nov 10). iOS's rule:
 * backgrounds ignore the safe area, content respects it -- but only SQUARE
 * backgrounds (plain list rows, bars). A rounded card that bleeds on one side
 * looks lopsided (Nov 10 check), so rounded cards stay inset on both sides
 * (inset-grouped) and nothing uses this today; kept for a future square band. For a boxed row or
 * group inside a page whose content is inset by `pad` + the side insets, this
 * returns styles that stretch the BOX to the screen edge on any side that has
 * a safe-area inset (the Duo's rail / clock column) while keeping the CONTENT
 * where it was. Sides without an inset keep the normal rounded card.
 *   outer -> on the box's outermost view (negative margins + square corners)
 *   inner -> on the view that pads the box's content
 */
export function useBleed(pad = 16, radius = 13): {
  outer: { marginLeft: number; marginRight: number; borderTopLeftRadius: number; borderBottomLeftRadius: number; borderTopRightRadius: number; borderBottomRightRadius: number };
  inner: { paddingLeft: number; paddingRight: number };
} {
  const { left, right } = useSideInsets();
  return {
    outer: {
      marginLeft: -left,
      marginRight: -right,
      borderTopLeftRadius: left > 0 ? 0 : radius,
      borderBottomLeftRadius: left > 0 ? 0 : radius,
      borderTopRightRadius: right > 0 ? 0 : radius,
      borderBottomRightRadius: right > 0 ? 0 : radius,
    },
    inner: { paddingLeft: pad + left, paddingRight: pad + right },
  };
}

/**
 * False for the second page of a pair while the Duo is folded (SplitPages
 * keeps it mounted but hidden). Hidden pages skip their focus reloads, so a
 * tab switch only does the work for what's on screen (Nov 10 polish: tab
 * switches felt slow some of the time because hidden copies of Stats were
 * re-reading storage and re-drawing charts nobody could see).
 */
export const PageVisibleContext = createContext(true);

export function usePageVisible(): boolean {
  return useContext(PageVisibleContext);
}
