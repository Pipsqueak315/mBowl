// Stats + History filter header (Phase 28 WP4/WP5, decision D3): the season
// dropdown on top, the session-type segmented control under it. Replaces the
// two rows of small pills in horizontal ScrollViews, which were hard to tap
// (Nov 10 Duo check). Same state as before -- the caller owns the season
// selection and the type filter, both non-persistent.
import { View, StyleSheet } from 'react-native';
import SeasonMenu, { type SeasonOption } from '@/components/v2/SeasonMenu';
import SegmentedControl from '@/components/v2/SegmentedControl';
import type { TypeFilter } from '@/src/sessionFilter';

const TYPE_SEGMENTS = [
  { key: 'all', label: 'All' },
  { key: 'league', label: 'League' },
  { key: 'tournament', label: 'Tourney' },
  { key: 'practice', label: 'Practice' },
  { key: 'makeup', label: 'Makeup' },
] as const satisfies readonly { key: TypeFilter; label: string }[];

export default function FilterHeader({
  seasonOptions,
  season,
  onSeasonChange,
  type,
  onTypeChange,
}: {
  seasonOptions: readonly SeasonOption[];
  season: string;
  onSeasonChange: (key: string) => void;
  type: TypeFilter;
  onTypeChange: (key: TypeFilter) => void;
}) {
  return (
    <View style={styles.wrap}>
      <SeasonMenu options={seasonOptions} value={season} onChange={onSeasonChange} />
      <SegmentedControl
        segments={TYPE_SEGMENTS}
        value={type}
        onChange={onTypeChange}
        accessibilityLabel="Session type"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // flexShrink 0: a long list below must never squeeze the controls (Nov 10
  // Duo check: History's old pill rows were clipped when a card expanded).
  wrap: { gap: 12, marginBottom: 14, flexShrink: 0 },
});
