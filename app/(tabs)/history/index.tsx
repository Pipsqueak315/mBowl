// History tab. Open screen pair: Stats | History (same as the Stats tab; History is
// the primary page, shown on the right).
// Phase 28 WP6: the page lives in components/pages; this route only decides
// one page (cover screen, phones) or a pair (open screen). The primary page
// keeps its place in the tree either way, so fold / unfold never resets it.
import StatsPage from '@/components/pages/StatsPage';
import HistoryPage from '@/components/pages/HistoryPage';
import SplitPages from '@/components/v2/SplitPages';
import { useLayoutClass } from '@/src/v2/layout';

export default function HistoryScreen() {
  const { layout } = useLayoutClass();
  return (
    <SplitPages
      split={layout === 'splitSideBySide' || layout === 'splitStacked'}
      stacked={layout === 'splitStacked'}
      secondaryFirst
      primary={<HistoryPage />}
      secondary={<StatsPage embedded />}
    />
  );
}
