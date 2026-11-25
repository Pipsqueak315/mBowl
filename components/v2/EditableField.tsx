// v2.1 P5 (Nov 24 audit): a labelled text field where the whole block -- the
// label and the text -- is the tap target. The Reference fields were 20pt-tall
// TextInputs under a label that did nothing when tapped, well under the 44pt
// rule. Tapping the label (or anywhere in the block) now puts the cursor in
// the field.
import { useRef } from 'react';
import { Pressable, Text, TextInput } from 'react-native';
import type { StyleProp, TextInputProps, TextStyle, ViewStyle } from 'react-native';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  blockStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

export default function EditableField({ label, blockStyle, labelStyle, inputStyle, ...input }: Props) {
  const ref = useRef<TextInput>(null);
  return (
    <Pressable style={blockStyle} onPress={() => ref.current?.focus()} accessible={false}>
      <Text style={labelStyle}>{label}</Text>
      <TextInput ref={ref} style={inputStyle} accessibilityLabel={label} {...input} />
    </Pressable>
  );
}
