// Quick-mode keypad (Phase 28 WP2, decision D9). Replaces the 13-chip bar.
// Same keys and the same availability rule as the chip bar (the caller passes
// the set from getAvailableChips); ⌫ deletes the last throw.
//   7 columns (cover portrait):  X / — ⌫ 1 2 3  ·  4 5 6 7 8 9 0
//   4 columns (landscape, open portrait): X / — ⌫ · 1 2 3 4 · 5 6 7 8 · 9 0
// Every key is >= 44pt tall and spans its whole cell.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { color } from '@/src/v2/theme';

export const DELETE_KEY = '⌫';
const KEYS = ['X', '/', '—', DELETE_KEY, '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export default function Keypad({
  columns,
  available,
  canDelete,
  onKey,
  onDelete,
  keyHeight = 48,
}: {
  columns: 7 | 4;
  /** Throw keys that are legal right now (getAvailableChips). */
  available: Set<string>;
  canDelete: boolean;
  onKey: (key: string) => void;
  onDelete: () => void;
  keyHeight?: number;
}) {
  const rows: string[][] = [];
  for (let i = 0; i < KEYS.length; i += columns) rows.push(KEYS.slice(i, i + columns));

  return (
    <View style={styles.pad}>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map(k => {
            const isDelete = k === DELETE_KEY;
            const enabled = isDelete ? canDelete : available.has(k);
            return (
              <Pressable
                key={k}
                disabled={!enabled}
                onPress={() => {
                  Haptics.selectionAsync();
                  if (isDelete) onDelete();
                  else onKey(k);
                }}
                style={({ pressed }) => [
                  styles.key,
                  { height: keyHeight },
                  isDelete && styles.keyDelete,
                  !enabled && styles.keyDisabled,
                  pressed && styles.keyPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={isDelete ? 'Delete last throw' : k === '—' ? 'Gutter or miss' : k}
                accessibilityState={{ disabled: !enabled }}
              >
                <Text
                  style={[
                    styles.keyText,
                    k === 'X' && enabled && styles.strikeText,
                    isDelete && styles.deleteText,
                    !enabled && styles.keyTextDisabled,
                  ]}
                >
                  {k}
                </Text>
              </Pressable>
            );
          })}
          {/* Short last row: invisible spacers keep every key the same width. */}
          {Array.from({ length: columns - row.length }).map((_, i) => (
            <View key={`sp-${i}`} style={styles.spacer} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { gap: 6 },
  row: { flexDirection: 'row', gap: 6 },
  key: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: color.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyDelete: { backgroundColor: color.surface },
  keyDisabled: { backgroundColor: color.surface, opacity: 0.45 },
  keyPressed: { backgroundColor: color.border },
  keyText: { fontSize: 20, fontWeight: '500', color: color.white, fontVariant: ['tabular-nums'] },
  strikeText: { color: color.teal },
  deleteText: { color: color.bad },
  keyTextDisabled: { color: color.dimmer },
  spacer: { flex: 1 },
});
