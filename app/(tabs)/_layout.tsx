import * as Haptics from 'expo-haptics';
import { NativeTabs } from 'expo-router/native-tabs';
import LiveGameButton from '@/components/v2/LiveGameButton';
import { useLiveGame } from '@/src/v2/liveGame';

// Phase 27.4: native iOS tabs (UITabBarController). iOS places the bar itself:
// a side column on the Duo's cover screen and open-landscape, floating at the
// bottom when open in portrait (iOS 27 `preferredPlacement`), with the system
// Liquid Glass look. Each tab is its own stack (see components/TabStack.tsx),
// which supplies the header the old JS tab bar used to draw.
export default function TabLayout() {
  // Phase 28 WP7: the Live game button, in the native bottom accessory, only
  // while the draft has a game without a score.
  const live = useLiveGame();
  return (
    <NativeTabs
      tintColor="#00CEC9"
      preferredPlacement="automatic"
      screenListeners={{
        tabPress: () => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      }}
    >
      {live && (
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
  );
}
