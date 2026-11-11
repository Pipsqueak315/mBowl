// iOS-style segmented control (Phase 28 WP0, decision D3/D6). Replaces the teal
// filter pills. JS so it works on every build; swapping in a native control
// later only touches this file. Haptic on change (CLAUDE.md: filter/toggle tap).
//
// Tap feel (Marcus, Nov 10 Duo check: the old small pills "need tapping in
// different spots"): every segment's touch area is >= 44pt tall (minHeight +
// hitSlop) and spans the whole segment, and this control is never placed in a
// horizontal ScrollView -- a nested scroll steals small finger movements as
// scrolls and cancels the tap. Segments flex to fill the track instead.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { color, radius } from '@/src/v2/theme';

export type Segment<K extends string> = { key: K; label: string };

export default function SegmentedControl<K extends string>({
  segments,
  value,
  onChange,
  accessibilityLabel,
}: {
  segments: readonly Segment<K>[];
  value: K;
  onChange: (key: K) => void;
  accessibilityLabel?: string;
}) {
  return (
    <View style={styles.track} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {segments.map(s => {
        const selected = s.key === value;
        return (
          <Pressable
            key={s.key}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.segmentSelected,
              pressed && !selected && styles.segmentPressed,
            ]}
            onPress={() => {
              if (selected) return;
              Haptics.selectionAsync();
              onChange(s.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            hitSlop={{ top: 8, bottom: 8 }}
          >
            <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
              {s.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: color.surface,
    borderRadius: radius.control - 1,
    padding: 2,
  },
  segment: {
    flex: 1,
    minHeight: 32, // + 8pt hitSlop above and below = a 48pt touch target
    borderRadius: radius.control - 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  segmentSelected: {
    backgroundColor: color.card,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  segmentPressed: { opacity: 0.6 },
  label: { fontSize: 13, fontWeight: '500', color: color.dim },
  labelSelected: { color: color.white, fontWeight: '600' },
});
