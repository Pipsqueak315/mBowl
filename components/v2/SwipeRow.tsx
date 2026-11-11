// Swipe-to-reveal row (Nov 10 polish). One component for every swipeable row
// so they all look and move the same (History sessions, Log games).
//
// Why it exists (Marcus, Nov 10 Duo check):
//  - Press-and-hold showed red/blue "buttons" through the row. The actions sit
//    BEHIND the row (ReanimatedSwipeable lays them out absolutely underneath),
//    and the row faded to 85% on press, so they bled through. Here the actions
//    are fully transparent until the row actually starts to move, and rows
//    should press with an opaque highlight, never an opacity fade.
//  - The library's default spring is heavily overdamped (mass 2, damping 1000),
//    so a slow release crept shut. This uses the app-wide `motion.spring`.
//  - friction 1: the row tracks the finger 1:1, like iOS.
//
// Look, the iOS way: actions are flush, full-height, square blocks glued to the
// row's trailing edge and slide in with it.
//  - Plain list rows (History) run under the Duo's rail: pass `trailingBleed`
//    (the right safe-area inset) and the last action's background runs to the
//    screen edge while its label stays in the visible part.
//  - Grouped rows (Log game cards) pass `radius`: the row and its actions are
//    clipped to the card's rounded corners, like iOS inset-grouped lists.
import { useRef, type ReactNode } from 'react';
import { Text, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import * as Haptics from 'expo-haptics';
import { color, motion } from '@/src/v2/theme';

export type SwipeAction = {
  label: string;
  /** Background. Use color.bad for destructive actions. */
  tint: string;
  onPress: () => void;
};

/** Width of one action block (iOS uses ~74-80pt). */
export const SWIPE_ACTION_WIDTH = 80;

const ANIMATION = { ...motion.spring };

export default function SwipeRow({
  actions,
  children,
  trailingBleed = 0,
  radius = 0,
  style,
  enabled = true,
}: {
  actions: SwipeAction[];
  children: ReactNode;
  /** Extra width past the last action that sits under the rail / safe area. */
  trailingBleed?: number;
  /** Corner radius when the row is a rounded card (clips row + actions). */
  radius?: number;
  /** Outer margins etc. for the row container. */
  style?: StyleProp<ViewStyle>;
  enabled?: boolean;
}) {
  const ref = useRef<SwipeableMethods>(null);
  const hasActions = enabled && actions.length > 0;

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={1}
      overshootRight={false}
      rightThreshold={SWIPE_ACTION_WIDTH * 0.6}
      animationOptions={ANIMATION}
      enabled={hasActions}
      containerStyle={[radius > 0 && { borderRadius: radius }, style]}
      renderRightActions={
        hasActions
          ? (progress, translation) => (
              <Actions
                actions={actions}
                trailingBleed={trailingBleed}
                progress={progress}
                translation={translation}
                close={() => ref.current?.close()}
              />
            )
          : undefined
      }
    >
      {children}
    </ReanimatedSwipeable>
  );
}

function Actions({
  actions,
  trailingBleed,
  progress,
  translation,
  close,
}: {
  actions: SwipeAction[];
  trailingBleed: number;
  progress: SharedValue<number>;
  translation: SharedValue<number>;
  close: () => void;
}) {
  const width = actions.length * SWIPE_ACTION_WIDTH + trailingBleed;
  // Glued to the row's trailing edge: off to the right at rest, in place when
  // the row has moved `width` to the left. Invisible until the row moves, so
  // nothing can ever show through the row.
  const slide = useAnimatedStyle(() => ({
    opacity: progress.value > 0 ? 1 : 0,
    transform: [{ translateX: Math.max(0, width + translation.value) }],
  }));

  return (
    <Animated.View style={[styles.actions, { width }, slide]}>
      {actions.map((a, i) => {
        const last = i === actions.length - 1;
        return (
          <Pressable
            key={a.label}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              close();
              a.onPress();
            }}
            style={({ pressed }) => [
              styles.action,
              { backgroundColor: a.tint, width: SWIPE_ACTION_WIDTH + (last ? trailingBleed : 0) },
              pressed && styles.actionPressed,
            ]}
          >
            <View style={{ width: SWIPE_ACTION_WIDTH, alignItems: 'center' }}>
              <Text style={styles.label} numberOfLines={1}>
                {a.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignSelf: 'stretch' },
  action: { justifyContent: 'center', alignItems: 'flex-start' },
  actionPressed: { opacity: 0.8 },
  label: { color: color.white, fontSize: 15, fontWeight: '600' },
});
