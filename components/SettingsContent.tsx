import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { readSettings, writeSettings, readBalls, writeBalls } from '@/src/storage';
import ScalePressable from '@/components/ScalePressable';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Ball = { id: string; name: string; short: string; strength: number; active: boolean };
type Settings = { seasonStart?: string | null; seasonEnd?: string | null };
type Props = { onClose: () => void };

// ---------------------------------------------------------------------------
// Sub-component: strength dots
// ---------------------------------------------------------------------------

function StrengthDots({ strength }: { strength: number }) {
  return (
    <View style={styles.dotsRow}>
      {[1, 2, 3, 4, 5].map(i => (
        <View key={i} style={[styles.dot, i <= strength ? styles.dotFilled : styles.dotEmpty]} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SettingsContent({ onClose }: Props) {
  const [settings, setSettings] = useState<Settings>({});
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [balls, setBalls] = useState<Ball[]>([]);
  const [editingBallId, setEditingBallId] = useState<string | null>(null);
  const [editingBallName, setEditingBallName] = useState('');

  const [addingBall, setAddingBall] = useState(false);
  const [newBallName, setNewBallName] = useState('');
  const [newBallStrength, setNewBallStrength] = useState(3);

  // Load settings + balls on mount
  useEffect(() => {
    (async () => {
      const [s, b] = await Promise.all([readSettings(), readBalls()]);
      setSettings((s as Settings) ?? {});
      setBalls((b as Ball[]) ?? []);
    })();
  }, []);

  // ---------------------------------------------------------------------------
  // Persistence helpers
  // ---------------------------------------------------------------------------

  async function saveSettingsData(updated: Settings) {
    setSettings(updated);
    await writeSettings(updated);
  }

  async function saveBallsData(updated: Ball[]) {
    setBalls(updated);
    await writeBalls(updated);
  }

  // ---------------------------------------------------------------------------
  // Date helpers — avoid timezone shifts by parsing with noon UTC offset
  // ---------------------------------------------------------------------------

  function parseDate(iso?: string | null): Date {
    if (!iso) return new Date();
    return new Date(iso + 'T12:00:00');
  }

  function formatDateDisplay(iso?: string | null): string {
    if (!iso) return 'Not set';
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function toISODate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  // ---------------------------------------------------------------------------
  // Ball actions
  // ---------------------------------------------------------------------------

  function toggleBall(id: string) {
    saveBallsData(balls.map(b => (b.id === id ? { ...b, active: !b.active } : b)));
  }

  function startRename(ball: Ball) {
    setEditingBallId(ball.id);
    setEditingBallName(ball.name);
  }

  function commitRename(id: string) {
    const trimmed = editingBallName.trim();
    if (trimmed) {
      saveBallsData(balls.map(b => (b.id === id ? { ...b, name: trimmed } : b)));
    }
    setEditingBallId(null);
  }

  function addBall() {
    const trimmed = newBallName.trim();
    if (!trimmed) return;
    const newBall: Ball = {
      id: String(Date.now()),
      name: trimmed,
      short: trimmed.substring(0, 3).toUpperCase(),
      strength: newBallStrength,
      active: true,
    };
    const updated = [...balls, newBall].sort((a, b) => a.strength - b.strength);
    saveBallsData(updated);
    setNewBallName('');
    setNewBallStrength(3);
    setAddingBall(false);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.done}>Done</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.kavFlex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
      >
        {/* ----------------------------------------------------------------
            Season Dates
        ---------------------------------------------------------------- */}
        <Text style={styles.sectionLabel}>SEASON</Text>
        <View style={styles.card}>
          {/* Start Date */}
          <TouchableOpacity
            style={styles.fieldRow}
            onPress={() => {
              setShowStartPicker(v => !v);
              setShowEndPicker(false);
            }}
          >
            <Text style={styles.fieldLabel}>Start Date</Text>
            <Text style={settings.seasonStart ? styles.valueSet : styles.valueDim}>
              {formatDateDisplay(settings.seasonStart)}
            </Text>
          </TouchableOpacity>

          {showStartPicker && (
            <View style={styles.pickerWrap}>
              <TouchableOpacity
                style={styles.pickerDoneRow}
                onPress={() => setShowStartPicker(false)}
              >
                <Text style={styles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
              <DateTimePicker
                value={parseDate(settings.seasonStart)}
                mode="date"
                display="spinner"
                onChange={(_e, d) => {
                  if (d) saveSettingsData({ ...settings, seasonStart: toISODate(d) });
                }}
                textColor="#FFFFFF"
                style={styles.datePicker}
              />
            </View>
          )}

          <View style={styles.separator} />

          {/* End Date */}
          <TouchableOpacity
            style={styles.fieldRow}
            onPress={() => {
              setShowEndPicker(v => !v);
              setShowStartPicker(false);
            }}
          >
            <Text style={styles.fieldLabel}>End Date</Text>
            <Text style={settings.seasonEnd ? styles.valueSet : styles.valueDim}>
              {formatDateDisplay(settings.seasonEnd)}
            </Text>
          </TouchableOpacity>

          {showEndPicker && (
            <View style={styles.pickerWrap}>
              <TouchableOpacity
                style={styles.pickerDoneRow}
                onPress={() => setShowEndPicker(false)}
              >
                <Text style={styles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
              <DateTimePicker
                value={parseDate(settings.seasonEnd)}
                mode="date"
                display="spinner"
                onChange={(_e, d) => {
                  if (d) saveSettingsData({ ...settings, seasonEnd: toISODate(d) });
                }}
                textColor="#FFFFFF"
                style={styles.datePicker}
              />
            </View>
          )}
        </View>

        {/* ----------------------------------------------------------------
            Ball Roster
        ---------------------------------------------------------------- */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>BALL ROSTER</Text>
          <TouchableOpacity onPress={() => setAddingBall(v => !v)}>
            <Text style={styles.addLink}>{addingBall ? 'Cancel' : '+ Add Ball'}</Text>
          </TouchableOpacity>
        </View>

        {/* Add Ball form */}
        {addingBall && (
          <View style={styles.card}>
            <TextInput
              style={styles.addBallInput}
              value={newBallName}
              onChangeText={setNewBallName}
              placeholder="Ball name"
              placeholderTextColor="#48484A"
              returnKeyType="done"
              autoFocus
            />
            <Text style={styles.strengthTitle}>Strength</Text>
            <View style={styles.strengthRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <ScalePressable
                  key={n}
                  style={[styles.strengthBtn, newBallStrength === n && styles.strengthBtnActive]}
                  onPress={() => setNewBallStrength(n)}
                >
                  <Text
                    style={[
                      styles.strengthBtnText,
                      newBallStrength === n && styles.strengthBtnTextActive,
                    ]}
                  >
                    {n}
                  </Text>
                </ScalePressable>
              ))}
            </View>
            <ScalePressable
              style={[styles.saveBtn, !newBallName.trim() && styles.saveBtnDisabled]}
              onPress={addBall}
              disabled={!newBallName.trim()}
            >
              <Text style={styles.saveBtnText}>Save Ball</Text>
            </ScalePressable>
          </View>
        )}

        {/* Ball list */}
        {balls.length === 0 ? (
          <View style={[styles.card, styles.emptyCard]}>
            <Text style={styles.emptyText}>No balls in roster.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {balls.map((ball, index) => (
              <View key={ball.id}>
                {index > 0 && <View style={styles.separator} />}
                <View style={styles.ballRow}>
                  <StrengthDots strength={ball.strength} />

                  {editingBallId === ball.id ? (
                    <TextInput
                      style={styles.ballNameEdit}
                      value={editingBallName}
                      onChangeText={setEditingBallName}
                      onBlur={() => commitRename(ball.id)}
                      onSubmitEditing={() => commitRename(ball.id)}
                      autoFocus
                      returnKeyType="done"
                    />
                  ) : (
                    <TouchableOpacity style={styles.ballNameTap} onPress={() => startRename(ball)}>
                      <Text style={[styles.ballName, !ball.active && styles.ballNameDim]}>
                        {ball.name}
                      </Text>
                      <Text style={styles.renameCue}>Tap to rename</Text>
                    </TouchableOpacity>
                  )}

                  <Switch
                    value={ball.active}
                    onValueChange={() => toggleBall(ball.id)}
                    trackColor={{ false: '#38383A', true: '#00CEC9' }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor="#38383A"
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383A',
    backgroundColor: '#000000',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  done: {
    fontSize: 17,
    fontWeight: '600',
    color: '#00CEC9',
  },
  kavFlex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 40,
  },
  // Section
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addLink: {
    fontSize: 15,
    color: '#00CEC9',
    fontWeight: '500',
  },
  // Card
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 13,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  separator: {
    height: 0.5,
    backgroundColor: '#38383A',
  },
  // Field row (date pickers)
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  fieldLabel: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  valueSet: {
    fontSize: 15,
    color: '#00CEC9',
  },
  valueDim: {
    fontSize: 15,
    color: '#48484A',
  },
  // Date picker inline
  pickerWrap: {
    paddingBottom: 8,
  },
  pickerDoneRow: {
    alignItems: 'flex-end',
    paddingTop: 4,
    paddingRight: 2,
  },
  pickerDoneText: {
    fontSize: 15,
    color: '#00CEC9',
    fontWeight: '600',
  },
  datePicker: {
    marginBottom: 4,
  },
  // Add Ball form
  addBallInput: {
    fontSize: 16,
    color: '#FFFFFF',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383A',
  },
  strengthTitle: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
    marginTop: 14,
    marginBottom: 10,
  },
  strengthRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  strengthBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    alignItems: 'center',
  },
  strengthBtnActive: {
    backgroundColor: '#00CEC9',
  },
  strengthBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8E8E93',
  },
  strengthBtnTextActive: {
    color: '#000000',
  },
  saveBtn: {
    backgroundColor: '#00CEC9',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 16,
  },
  saveBtnDisabled: {
    backgroundColor: '#2C2C2E',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  // Ball roster list
  ballRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  ballNameTap: {
    flex: 1,
  },
  ballName: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  ballNameDim: {
    color: '#48484A',
  },
  renameCue: {
    fontSize: 11,
    color: '#48484A',
    marginTop: 2,
  },
  ballNameEdit: {
    flex: 1,
    fontSize: 15,
    color: '#00CEC9',
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#00CEC9',
  },
  // Strength dots
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotFilled: {
    backgroundColor: '#00CEC9',
  },
  dotEmpty: {
    backgroundColor: '#38383A',
  },
  // Empty / bottom
  emptyCard: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#48484A',
    fontSize: 15,
  },
  bottomSpacer: {
    height: 40,
  },
});
