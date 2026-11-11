// Log tab. Open screen pair: Log | Stats.
// Phase 28 WP6: the page lives in components/pages; this route only decides
// one page (cover screen, phones) or a pair (open screen).
import LogPage from '@/components/pages/LogPage';
import StatsPage from '@/components/pages/StatsPage';
import SplitPages from '@/components/v2/SplitPages';
import { useLayoutClass } from '@/src/v2/layout';

export default function LogScreen() {
  const { layout } = useLayoutClass();
  if (layout === 'splitSideBySide' || layout === 'splitStacked') {
    return (
      <SplitPages
        stacked={layout === 'splitStacked'}
        first={<LogPage />}
        second={<StatsPage embedded />}
      />
    );
  }
  return <LogPage />;
}
