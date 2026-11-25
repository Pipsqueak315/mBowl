// v2.1 P7 (Nov 24 audit): one haptics map for the whole app. Before this each
// file picked its own style, so a strike felt the same as a pin tap, Keypad X
// fired twice, Confirm / game over / Remove game had none, and saves were
// Heavy in one place and Success in another (sometimes before the save
// landed). Use these names, not expo-haptics directly.
//
//   select  -- a pin, a segment, a key, picking a frame or a ball (light tick)
//   tap     -- a throw or a value committed, a button that does a thing
//   mark    -- a strike or a spare goes in
//   success -- a game finished, a session / edit saved (only after the write landed)
//   warning -- a destructive action confirmed (discard, remove, delete)
import * as Haptics from 'expo-haptics';

export const haptic = {
  select: () => void Haptics.selectionAsync(),
  tap: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  mark: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  success: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
};

/** A strike or spare gets `mark`; any other throw gets `tap`. */
export function hapticForThrow(notation: string): void {
  if (notation === 'X' || notation === '/') haptic.mark();
  else haptic.tap();
}
