// v2.1 P8 (Nov 24 audit): iOS number pads have no Return key, so a score or
// week field had no way to close its keyboard (returnKeyType="done" does
// nothing on a number pad). This bar sits on top of the keyboard with one
// Done button, like Apple's own number-entry screens.
//
// Render ONE bar per screen or sheet, with that screen's own id, and give
// each number-pad TextInput `inputAccessoryViewID={id}`. Ids are per screen
// so two mounted screens never fight over the same id.
import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { color } from '@/src/v2/theme';

export const DONE_BAR = {
  log: 'mbowl-done-log',
  edit: 'mbowl-done-edit',
  settings: 'mbowl-done-settings',
} as const;

export default function KeyboardDoneBar({ id }: { id: string }) {
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={id} backgroundColor={color.surface}>
      <View style={styles.bar}>
        <Pressable
          onPress={() => Keyboard.dismiss()}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Done"
        >
          <Text style={styles.text}>Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    paddingHorizontal: 8,
  },
  button: { minHeight: 44, minWidth: 64, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.5 },
  text: { fontSize: 17, fontWeight: '600', color: color.teal },
});
