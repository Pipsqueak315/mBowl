// Stats tab. Open screen pair: Stats | History.
// Phase 28 WP6: the page lives in components/pages; this route only decides
// one page (cover screen, phones) or a pair (open screen).
import StatsPage from '@/components/pages/StatsPage';
import HistoryPage from '@/components/pages/HistoryPage';
import SplitPages from '@/components/v2/SplitPages';
import { useLayoutClass } from '@/src/v2/layout';

export default function StatsScreen() {
  const { layout } = useLayoutClass();
  if (layout === 'splitSideBySide' || layout === 'splitStacked') {
    return (
      <SplitPages
        stacked={layout === 'splitStacked'}
        first={<StatsPage />}
        second={<HistoryPage embedded />}
      />
    );
  }
  return <StatsPage />;
}
