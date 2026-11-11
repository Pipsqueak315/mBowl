// One layout animation for every expand / collapse in the app (Nov 10 polish).
// Before this, Reference cards used LayoutAnimation's 300ms preset and History
// rows jumped with no animation at all, so the same gesture felt different
// from tab to tab. Call right before the state change that resizes something.
import { LayoutAnimation } from 'react-native';
import { motion } from '@/src/v2/theme';

const LAYOUT = LayoutAnimation.create(
  motion.layoutMs,
  LayoutAnimation.Types.easeInEaseOut,
  LayoutAnimation.Properties.opacity,
);

export function animateNextLayout(): void {
  LayoutAnimation.configureNext(LAYOUT);
}
