import { Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { motion } from '@/src/v2/theme';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';

// S17 (Nov 11 audit): the Pressable IS the box and wraps the children. It used
// to be an absoluteFill SIBLING under {children}: Fabric hit-tests the deepest
// view (the label's Text), responder negotiation only walks ANCESTORS, so a tap
// landing on the label text never reached the Pressable and did nothing.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

export default function ScalePressable({
  children,
  style,
  onPress,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={e => {
        scale.value = withSpring(motion.pressScale, motion.spring);
        onPressIn?.(e);
      }}
      onPressOut={e => {
        scale.value = withSpring(1, motion.spring);
        onPressOut?.(e);
      }}
      onPress={onPress}
      style={[style, animStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
