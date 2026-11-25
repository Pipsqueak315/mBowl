// Season dropdown (Phase 28 WP0, decision D3). "Winners 26 ⌄" opens the native
// iOS action sheet listing every season (newest first) plus All-Time. Selection
// stays non-persistent, exactly like the pills it replaces — the caller owns it.
import { ActionSheetIOS, Pressable, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { color, type } from '@/src/v2/theme';

export type SeasonOption = { key: string; label: string };

export default function SeasonMenu({
  options,
  value,
  onChange,
}: {
  /** Newest season first, All-Time last — same order as the old pills. */
  options: readonly SeasonOption[];
  value: string;
  onChange: (key: string) => void;
}) {
  const current = options.find(o => o.key === value)?.label ?? 'Season';

  function open() {
    Haptics.selectionAsync();
    const labels = options.map(o => (o.key === value ? `✓ ${o.label}` : o.label));
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Season',
        options: [...labels, 'Cancel'],
        cancelButtonIndex: labels.length,
        userInterfaceStyle: 'dark',
        tintColor: color.teal,
      },
      index => {
        if (index < 0 || index >= options.length) return;
        const picked = options[index];
        if (picked.key !== value) onChange(picked.key);
      },
    );
  }

  return (
    <Pressable
      onPress={open}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel={`Season: ${current}`}
      accessibilityHint="Opens the list of seasons"
      hitSlop={{ left: 8, right: 8 }}
    >
      <Text style={styles.label} numberOfLines={1}>{current}</Text>
      <IconSymbol name="chevron.down" size={13} color={color.teal} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // v2.1 P5: 44pt tall tap area (was ~36pt with slop)
  button: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', minHeight: 44 },
  label: { ...type.action, fontSize: 15 },
});
