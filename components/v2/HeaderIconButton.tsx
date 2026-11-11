// Header icon button (Phase 28 polish). iOS 26+ wraps every header bar button
// in its own Liquid Glass pill, so the button must be a plain, centered,
// square hit area with NO margins of its own -- the old `marginRight: 16`
// (from the JS tab-bar header days) pushed the gear off-center inside the
// pill on every tab (Marcus, Nov 10). One component so all four tabs match.
import { Pressable, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { SymbolViewProps } from 'expo-symbols';

export default function HeaderIconButton({
  icon,
  onPress,
  accessibilityLabel,
}: {
  icon: SymbolViewProps['name'];
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {/* White, regular weight: the iOS toolbar look (system glass pills hold
          label-colored glyphs, not grey ones). */}
      <IconSymbol name={icon} size={20} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.5 },
});
