import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

// ---------------------------------------------------------------------------
// Pin layout
//
// Standard bowling pin numbering (index = pinNumber - 1):
//
//   7(6)  8(7)  9(8)  10(9)   ← back row   (displayed at TOP)
//     4(3)  5(4)  6(5)        ← middle row
//       2(1)  3(2)            ← front-middle
//           1(0)              ← headpin     (displayed at BOTTOM)
//
// Each inner array = one display row, top to bottom.
// Numbers are 0-based pin indices.
// ---------------------------------------------------------------------------

const PIN_ROWS: number[][] = [
  [6, 7, 8, 9], // back row: pins 7, 8, 9, 10
  [3, 4, 5],    // middle row: pins 4, 5, 6
  [1, 2],       // front-middle: pins 2, 3
  [0],          // headpin: pin 1
];

// ---------------------------------------------------------------------------
// Throw notation computation (exported for use in log-frames when wired)
//
// pinsStanding: boolean[10] — true = pin still standing after this throw
// prevPinsStanding: boolean[10] | null/undefined — state after the prior throw
//   (null/undefined = this IS the first throw of the ball)
// ---------------------------------------------------------------------------

export function computeNotation(
  pinsStanding: boolean[],
  prevPinsStanding?: boolean[] | null,
): string {
  if (!prevPinsStanding) {
    // First throw of a ball — all 10 pins in play
    const knocked = pinsStanding.filter(s => !s).length;
    if (knocked === 10) return 'X';
    if (knocked === 0) return '—';
    return String(knocked);
  }

  // Subsequent throw — only pins that were standing before count
  const prevCount = prevPinsStanding.filter(s => s).length;
  const knocked = prevPinsStanding.filter((s, i) => s && !pinsStanding[i]).length;
  if (knocked === 0) return '—';
  if (knocked === prevCount) return '/';
  return String(knocked);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type PinDeckProps = {
  /**
   * Which pins were standing BEFORE this throw (10 booleans, index = pin - 1).
   * Typically all-true for a first ball. For subsequent throws, pass the
   * pinsStanding result from the previous throw.
   */
  availablePins: boolean[];

  /**
   * true  → show "Strike" quick-action (first ball of a frame / 10th-frame resets)
   * false → show "Spare" quick-action (second / third ball, clearing a leave)
   */
  isFirstThrow: boolean;

  /**
   * pinsStanding from the PREVIOUS throw in this frame.
   * Used to compute spare ("/") vs numeric notation on subsequent throws.
   */
  prevPinsStanding?: boolean[] | null;

  /**
   * Fired when the user taps Confirm.
   * @param pinsStanding  Final state of all 10 pins (true = still standing).
   * @param notation      Computed throw notation: "X", "/", "—", or "1"–"9".
   */
  onConfirm: (pinsStanding: boolean[], notation: string) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PinDeck({
  availablePins,
  isFirstThrow,
  prevPinsStanding,
  onConfirm,
}: PinDeckProps) {
  // Initialize: available pins start STANDING, unavailable pins start DOWN.
  const [standing, setStanding] = useState<boolean[]>(() =>
    availablePins.map(a => a),
  );

  // Tap a pin to toggle it between standing and knocked-down.
  // Non-available pins are not interactive (already down from a prior throw).
  function togglePin(index: number) {
    if (!availablePins[index]) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStanding(prev => prev.map((s, i) => (i === index ? !s : s)));
  }

  // Strike / Spare quick-action: knock all currently-available pins down at once.
  function handleQuickAction() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStanding(prev => prev.map((s, i) => (availablePins[i] ? false : s)));
  }

  function handleConfirm() {
    const notation = computeNotation(standing, prevPinsStanding);
    onConfirm(standing, notation);
  }

  const quickLabel = isFirstThrow ? 'Strike' : 'Spare';

  return (
    <View style={styles.container}>
      {/* Pin triangle */}
      <View style={styles.deck}>
        {PIN_ROWS.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.pinRow}>
            {row.map(pinIndex => {
              const available = availablePins[pinIndex];
              const isStanding = standing[pinIndex];

              return (
                <TouchableOpacity
                  key={pinIndex}
                  style={[
                    styles.pin,
                    available && isStanding  && styles.pinStanding,
                    available && !isStanding && styles.pinDown,
                    !available               && styles.pinUnavailable,
                  ]}
                  onPress={() => togglePin(pinIndex)}
                  activeOpacity={available ? 0.65 : 1}
                  disabled={!available}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text
                    style={[
                      styles.pinLabel,
                      available && isStanding  && styles.pinLabelStanding,
                      (!isStanding || !available) && styles.pinLabelDown,
                    ]}
                  >
                    {pinIndex + 1}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Quick-action + Confirm buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={handleQuickAction}
          activeOpacity={0.75}
        >
          <Text style={styles.quickBtnText}>{quickLabel}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={handleConfirm}
          activeOpacity={0.75}
        >
          <Text style={styles.confirmBtnText}>Confirm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const PIN_SIZE = 48; // circle diameter — meets 44pt minimum tap target
const PIN_GAP  = 10; // gap between pins in the same row
const ROW_GAP  = 8;  // vertical gap between rows

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 16,
  },

  // Pin triangle
  deck: {
    alignItems: 'center',
    gap: ROW_GAP,
    marginBottom: 24,
  },
  pinRow: {
    flexDirection: 'row',
    gap: PIN_GAP,
  },

  // Base pin circle
  pin: {
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: PIN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },

  // Standing: teal fill, black label
  pinStanding: {
    backgroundColor: '#00CEC9',
    borderColor: '#00CEC9',
  },

  // Knocked down: dim fill, dark label
  pinDown: {
    backgroundColor: '#2C2C2E',
    borderColor: '#38383A',
  },

  // Unavailable (already knocked down in a prior throw): very faint
  pinUnavailable: {
    backgroundColor: '#1C1C1E',
    borderColor: '#38383A',
    opacity: 0.3,
  },

  pinLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  pinLabelStanding: {
    color: '#000000',
  },
  pinLabelDown: {
    color: '#48484A',
  },

  // Buttons
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    width: '100%',
  },
  quickBtn: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  quickBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#00CEC9',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
});
