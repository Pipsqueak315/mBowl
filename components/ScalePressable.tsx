import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { motion } from '@/src/v2/theme';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';

type Props = Omit<PressableProps, 'style'> & {
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
    <Animated.View style={[style, animStyle]}>
      <Pressable
        onPressIn={e => {
          scale.value = withSpring(motion.pressScale, motion.spring);
          onPressIn?.(e);
        }}
        onPressOut={e => {
          scale.value = withSpring(1, motion.spring);
          onPressOut?.(e);
        }}
        onPress={onPress}
        style={StyleSheet.absoluteFill}
        {...rest}
      />
      {children}
    </Animated.View>
  );
}
