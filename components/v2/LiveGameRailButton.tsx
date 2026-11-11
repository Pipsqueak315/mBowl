// Live game button for the Duo's side rail (Phase 28 polish, Marcus Nov 10).
// When the tab bar is a side rail (cover screen, open landscape), the 84pt
// column holds only the clock at the top and the tab capsule at the bottom --
// about 280pt in between is empty. iOS's own bottom accessory sits under a
// bottom tab bar, so on the rail we draw the same button ourselves: a glass
// capsule centered in the column just above the tab capsule, where iOS puts
// accessories like the music mini-player. Same action as LiveGameButton.
//
// Position measured on the Duo cover screen (466 x 678pt, Nov 10 screenshots):
// tab capsule x 394-442, y 442-654 -> its top is 236pt above the window
// bottom and its right edge 24pt in from the screen edge.
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { requestLiveGame } from '@/src/v2/liveGame';
import { color } from '@/src/v2/theme';

const CAPSULE_TOP_FROM_BOTTOM = 236;
const GAP_ABOVE_CAPSULE = 12;
const EDGE_OFFSET = 24;

export default function LiveGameRailButton({
  gameNumber,
  side,
}: {
  gameNumber: number;
  side: 'left' | 'right';
}) {
  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { bottom: CAPSULE_TOP_FROM_BOTTOM + GAP_ABOVE_CAPSULE },
        side === 'right' ? { right: EDGE_OFFSET } : { left: EDGE_OFFSET },
      ]}
    >
      <BlurView intensity={60} tint="systemChromeMaterialDark" style={styles.glass}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            requestLiveGame();
            router.navigate('/(tabs)/log');
          }}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Live game: score game ${gameNumber}`}
        >
          <View style={styles.dot} />
          <Text style={styles.label} numberOfLines={2}>
            {`Game\n${gameNumber}`}
          </Text>
        </Pressable>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', width: 48 },
  glass: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  button: { height: 64, alignItems: 'center', justifyContent: 'center', gap: 4 },
  pressed: { opacity: 0.6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.teal },
  label: { fontSize: 11, fontWeight: '600', color: color.white, textAlign: 'center', lineHeight: 13 },
});
