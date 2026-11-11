import * as Haptics from 'expo-haptics';
import { NativeTabs } from 'expo-router/native-tabs';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LiveGameButton from '@/components/v2/LiveGameButton';
import LiveGameRailButton from '@/components/v2/LiveGameRailButton';
import { useLiveGame } from '@/src/v2/liveGame';

/** A side safe-area inset this wide means the tab bar is the Duo's side rail. */
const RAIL_MIN_INSET = 60;

// Phase 27.4: native iOS tabs (UITabBarController). iOS places the bar itself:
// a side column on the Duo's cover screen and open-landscape, floating at the
// bottom when open in portrait (iOS 27 `preferredPlacement`), with the system
// Liquid Glass look. Each tab is its own stack (see components/TabStack.tsx),
// which supplies the header the old JS tab bar used to draw.
export default function TabLayout() {
  // Phase 28 WP7: the Live game button, in the native bottom accessory, only
  // while the draft has a game without a score.
  // On the side rail (cover screen, open landscape) it sits in the rail's
  // empty middle, just above the tab capsule; with a bottom tab bar (open
  // portrait) it uses iOS's own bottom accessory.
  const live = useLiveGame();
  const insets = useSafeAreaInsets();
  const railSide: 'left' | 'right' | null =
    insets.right >= RAIL_MIN_INSET ? 'right' : insets.left >= RAIL_MIN_INSET ? 'left' : null;
  return (
    <View style={styles.root}>
    <NativeTabs
      tintColor="#00CEC9"
      preferredPlacement="automatic"
      screenListeners={{
        tabPress: () => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      }}
    >
      {live && !railSide && (
        <NativeTabs.BottomAccessory>
          <LiveGameButton gameNumber={live.gameIndex + 1} />
        </NativeTabs.BottomAccessory>
      )}
      <NativeTabs.Trigger name="log">
        <NativeTabs.Trigger.Icon sf="square.and.pencil" />
        <NativeTabs.Trigger.Label>Log</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="stats">
        <NativeTabs.Trigger.Icon sf="chart.bar.fill" />
        <NativeTabs.Trigger.Label>Stats</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Icon sf="list.bullet" />
        <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="reference">
        <NativeTabs.Trigger.Icon sf="book.fill" />
        <NativeTabs.Trigger.Label>Reference</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
    {live && railSide && <LiveGameRailButton gameNumber={live.gameIndex + 1} side={railSide} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
