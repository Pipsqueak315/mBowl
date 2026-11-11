// Live game button (Phase 28 WP7, decision D5). Sits in the native tab bar's
// bottom accessory (iOS 26+). Shows when the draft has a game without a score:
// a live dot and "Game N". Tap -> the Log tab opens Log Frames for that game.
// No mid-game resume (D5): Log Frames opens on the game as the draft has it.
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { NativeTabs } from 'expo-router/native-tabs';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { requestLiveGame } from '@/src/v2/liveGame';
import { color } from '@/src/v2/theme';

export default function LiveGameButton({ gameNumber }: { gameNumber: number }) {
  // Rendered twice by iOS (regular + inline accessory); no local state here.
  const placement = NativeTabs.BottomAccessory.usePlacement();
  const inline = placement === 'inline';

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        requestLiveGame();
        router.navigate('/(tabs)/log');
      }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`Live game: score game ${gameNumber}`}
    >
      <View style={styles.dot} />
      <Text style={[styles.label, inline && styles.labelInline]} numberOfLines={1}>
        Game {gameNumber}
      </Text>
      {!inline && <Text style={styles.sub}>Tap to score</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  pressed: { opacity: 0.6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.teal },
  label: { fontSize: 15, fontWeight: '600', color: color.white },
  labelInline: { fontSize: 13 },
  sub: { fontSize: 13, color: color.dim },
});
