// Phase 31B: the optional per-game rows shared by the Log form and the History
// edit sheet -- speed, line (feet -> target), and a mid-game ball switch.
// Everything is optional; blank rows save nothing.
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { GameExtrasForm, StartHere } from '@/src/extras';
import { formatLine, gameExtrasHaveContent } from '@/src/extras';

type Field = keyof GameExtrasForm;

export default function GameExtrasFields({
  value,
  onChange,
  onPickSwitchBall,
  startHere,
  ballName,
}: {
  value: GameExtrasForm;
  onChange: (field: Field, v: string) => void;
  /** Opens the ball picker for the switch ball. */
  onPickSwitchBall: () => void;
  /** Last logged line with this game's ball (shown until a line is typed). */
  startHere?: StartHere | null;
  ballName?: string;
}) {
  const digits = (v: string, max: number) => v.replace(/[^0-9]/g, '').slice(0, max);
  const lineEmpty = !value.feet && !value.target;
  // Collapsed by default so a plain night stays fast; opens itself when the
  // game already has any of these.
  const [open, setOpen] = useState(() => gameExtrasHaveContent(value));
  const summary = [
    !lineEmpty ? formatLine(value.feet ? Number(value.feet) : null, value.target ? Number(value.target) : null) : null,
    value.speed ? `${value.speed} mph` : null,
    value.switchFrame ? `switch f${value.switchFrame}` : null,
  ].filter(Boolean).join(' · ');
  return (
    <View>
      {startHere && lineEmpty && ballName ? (
        <Text style={styles.hint}>
          Start here: last time with {ballName}, {formatLine(startHere.feet, startHere.target)}
          {startHere.score != null ? ` (shot ${startHere.score})` : ''}
        </Text>
      ) : null}
      <TouchableOpacity
        style={styles.row}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.label}>Line · speed</Text>
        <View style={styles.right}>
          <Text style={styles.summary} numberOfLines={1}>{open ? '' : summary || 'Optional'}</Text>
          <IconSymbol name={open ? 'chevron.up' : 'chevron.down'} size={13} color="#8E8E93" />
        </View>
      </TouchableOpacity>
      {open && (
      <>
      <View style={styles.row}>
        <Text style={styles.label}>Line</Text>
        <View style={styles.right}>
          <TextInput
            style={styles.input}
            value={value.feet ?? ''}
            onChangeText={(v) => onChange('feet', digits(v, 2))}
            keyboardType="number-pad"
            placeholder="feet"
            placeholderTextColor="#48484A"
            maxLength={2}
            returnKeyType="done"
            accessibilityLabel="Feet board"
          />
          <Text style={styles.arrow}>→</Text>
          <TextInput
            style={styles.input}
            value={value.target ?? ''}
            onChangeText={(v) => onChange('target', digits(v, 2))}
            keyboardType="number-pad"
            placeholder="target"
            placeholderTextColor="#48484A"
            maxLength={2}
            returnKeyType="done"
            accessibilityLabel="Target board"
          />
        </View>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Speed</Text>
        <View style={styles.right}>
          <TextInput
            style={styles.input}
            value={value.speed ?? ''}
            onChangeText={(v) => onChange('speed', v.replace(/[^0-9.]/g, '').slice(0, 4))}
            keyboardType="decimal-pad"
            placeholder="mph"
            placeholderTextColor="#48484A"
            maxLength={4}
            returnKeyType="done"
            accessibilityLabel="Ball speed in miles per hour"
          />
        </View>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Switched at frame</Text>
        <View style={styles.right}>
          <TextInput
            style={styles.input}
            value={value.switchFrame ?? ''}
            onChangeText={(v) => onChange('switchFrame', digits(v, 2))}
            keyboardType="number-pad"
            placeholder="—"
            placeholderTextColor="#48484A"
            maxLength={2}
            returnKeyType="done"
            accessibilityLabel="Frame the ball switch happened"
          />
          {value.switchFrame ? (
            <TouchableOpacity style={styles.ballBtn} onPress={onPickSwitchBall}>
              <Text style={value.switchBall ? styles.ballSet : styles.ballDim} numberOfLines={1}>
                {value.switchBall || 'to…'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, color: '#00CEC9', marginTop: 2, marginBottom: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#38383A',
  },
  label: { fontSize: 15, color: '#FFFFFF' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  input: {
    minWidth: 56,
    minHeight: 44,
    fontSize: 15,
    color: '#00CEC9',
    textAlign: 'right',
    paddingHorizontal: 4,
  },
  arrow: { fontSize: 15, color: '#8E8E93' },
  summary: { fontSize: 15, color: '#8E8E93', flexShrink: 1 },
  ballBtn: { minHeight: 44, justifyContent: 'center', maxWidth: 140, paddingLeft: 6 },
  ballSet: { fontSize: 15, color: '#00CEC9' },
  ballDim: { fontSize: 15, color: '#48484A' },
});
