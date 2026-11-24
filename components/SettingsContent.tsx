import { useState, useEffect, useRef } from 'react';
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
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { readSettingsResult, writeSettings, readBallsResult, writeBalls } from '@/src/storage';
import {
  writeBackup,
  restoreBackup,
  exportBackup,
  pickBackupFile,
  summarizeBackup,
  restoreFromPickedJson,
} from '@/src/backup';
import { notifyDataChanged } from '@/src/dataEvents';
import ScalePressable from '@/components/ScalePressable';
import type { Settings, Ball, Season } from '@/src/types';
import { getSeasons, resolveSeasonRanges } from '@/src/seasons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = { onClose: () => void };

// ---------------------------------------------------------------------------
// Sub-components: strength dots
// ---------------------------------------------------------------------------

function TappableStrengthDots({
  strength,
  onPress,
}: {
  strength: number;
  onPress: (value: number) => void;
}) {
  return (
    <View style={styles.dotsRow}>
      {[1, 2, 3, 4, 5].map(i => (
        <TouchableOpacity
          key={i}
          onPress={() => onPress(i)}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <View style={[styles.dot, i <= strength ? styles.dotFilled : styles.dotEmpty]} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SettingsContent({ onClose }: Props) {
  const [settings, setSettings] = useState<Settings>({});
  // Export in flight — ignores a second tap so two share sheets can't stack.
  const [exporting, setExporting] = useState(false);

  const [balls, setBalls] = useState<Ball[]>([]);
  const [editingBallId, setEditingBallId] = useState<string | null>(null);
  const [editingBallName, setEditingBallName] = useState('');

  const [addingBall, setAddingBall] = useState(false);
  const [newBallName, setNewBallName] = useState('');
  const [newBallStrength, setNewBallStrength] = useState(3);

  // Season editor: a single draft panel drives both add and edit. `isNew`
  // distinguishes an append from an in-place replace. Delete is edit-only.
  const [seasonDraft, setSeasonDraft] = useState<Season | null>(null);
  const [seasonDraftIsNew, setSeasonDraftIsNew] = useState(false);
  const [showSeasonStartPicker, setShowSeasonStartPicker] = useState(false);

  // F5 (Nov 15): whether each key read back cleanly when the sheet loaded. A
  // read that failed or came back corrupt shows defaults (empty seasons, no
  // balls) -- saving "defaults + one edit" over it would erase the real data,
  // and settings has no shadow key. So a bad read blocks saving that key.
  // The sheet is the only writer of settings + balls while it's open, so the
  // copy loaded here stays current; it is re-read after a Restore (A8).
  const settingsReadable = useRef(false);
  const ballsReadable = useRef(false);
  const [restoring, setRestoring] = useState(false);

  // D5 / F14 (Phase 31A): goal fields used to save only on blur, with the
  // settings from the last render -- tapping Done with the keyboard up could
  // close the sheet before the blur save ran. Now every keystroke schedules a
  // save of the latest value, and blur / Done / closing the sheet flushes it.
  const latestSettingsRef = useRef<Settings>({});
  const goalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { latestSettingsRef.current = settings; }, [settings]);
  function setGoal(patch: Partial<Settings>) {
    const next = { ...latestSettingsRef.current, ...patch };
    latestSettingsRef.current = next;
    setSettings(next);
    if (goalTimer.current) clearTimeout(goalTimer.current);
    goalTimer.current = setTimeout(() => {
      goalTimer.current = null;
      void saveSettingsData(latestSettingsRef.current);
    }, 600);
  }
  function flushGoals() {
    if (!goalTimer.current) return;
    clearTimeout(goalTimer.current);
    goalTimer.current = null;
    void saveSettingsData(latestSettingsRef.current);
  }
  useEffect(() => () => flushGoals(), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData(): Promise<void> {
    const [s, b] = await Promise.all([readSettingsResult(), readBallsResult()]);
    settingsReadable.current = s.status === 'ok' || s.status === 'missing';
    ballsReadable.current = b.status === 'ok' || b.status === 'missing';
    setSettings(s.value);
    setBalls(b.value);
    lastSavedSettings.current = s.value;
    lastSavedBalls.current = b.value;
  }

  // Load settings + balls on mount
  useEffect(() => {
    let active = true;
    (async () => {
      const [s, b] = await Promise.all([readSettingsResult(), readBallsResult()]);
      if (!active) return;
      settingsReadable.current = s.status === 'ok' || s.status === 'missing';
      ballsReadable.current = b.status === 'ok' || b.status === 'missing';
      setSettings(s.value);
      setBalls(b.value);
      lastSavedSettings.current = s.value;
      lastSavedBalls.current = b.value;
    })();
    return () => { active = false; };
  }, []);

  // ---------------------------------------------------------------------------
  // Persistence helpers
  // ---------------------------------------------------------------------------

  function refuseUnreadable(what: string) {
    Alert.alert(
      `Can't save ${what}`,
      `Your saved ${what} couldn't be read, so nothing was changed (saving now could erase them). Close Settings and relaunch the app, then try again.`
    );
  }

  // The screen updates at once (controlled Switches would snap back while the
  // write is in flight) and rolls back if the save is refused or fails.
  // lastSaved* = what is on disk, the rollback target.
  const lastSavedSettings = useRef<Settings | null>(null);
  const lastSavedBalls = useRef<Ball[] | null>(null);

  async function saveSettingsData(updated: Settings) {
    if (!settingsReadable.current) {
      if (lastSavedSettings.current) setSettings(lastSavedSettings.current);
      refuseUnreadable('settings');
      return;
    }
    setSettings(updated);
    const ok = await writeSettings(updated);
    if (!ok) {
      if (lastSavedSettings.current) setSettings(lastSavedSettings.current);
      Alert.alert("Couldn't save settings", 'The phone could not save the change (storage may be full).');
      return;
    }
    lastSavedSettings.current = updated;
    void writeBackup();
    notifyDataChanged('settings');
  }

  async function saveBallsData(updated: Ball[]) {
    if (!ballsReadable.current) {
      if (lastSavedBalls.current) setBalls(lastSavedBalls.current);
      refuseUnreadable('balls');
      return;
    }
    setBalls(updated);
    const ok = await writeBalls(updated);
    if (!ok) {
      if (lastSavedBalls.current) setBalls(lastSavedBalls.current);
      Alert.alert("Couldn't save balls", 'The phone could not save the change (storage may be full).');
      return;
    }
    lastSavedBalls.current = updated;
    void writeBackup();
  }

  // A7: Restore from file… -- pick a backup .json, show what's in it, confirm.
  const pickingRef = useRef(false);
  async function startRestoreFromFile() {
    if (restoring || pickingRef.current) return; // a double tap opens one picker
    pickingRef.current = true;
    let picked: Awaited<ReturnType<typeof pickBackupFile>>;
    try {
      picked = await pickBackupFile();
    } finally {
      pickingRef.current = false;
    }
    if (picked === null) return; // cancelled
    if ('error' in picked) {
      Alert.alert('Restore Failed', picked.error);
      return;
    }
    const summary = summarizeBackup(picked.json);
    if ('error' in summary) {
      Alert.alert('Restore Failed', summary.error);
      return;
    }
    const { sessions, games, exportedAt } = summary.summary;
    const when = exportedAt
      ? new Date(exportedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
      : 'unknown date';
    Alert.alert(
      'Restore from this file?',
      `${picked.name}\n${sessions} sessions · ${games} games · exported ${when}\n\nThis replaces ALL data on the phone (sessions, balls, settings, reference). What's on the phone now is kept as a copy in Files → mBowl → Backups first.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setRestoring(true);
            try {
              const result = await restoreFromPickedJson(picked.json);
              if (result.success) {
                await loadData();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert(
                  'Backup Restored',
                  `${sessions} sessions restored. If anything still looks out of date, close and reopen the app.`
                );
              } else {
                Alert.alert('Restore Failed', result.error ?? 'Unknown error.');
              }
            } finally {
              setRestoring(false);
            }
          },
        },
      ]
    );
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

  function formatDateShort(iso?: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

  function changeStrength(id: string, value: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    saveBallsData(balls.map(b => (b.id === id ? { ...b, strength: value } : b)));
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
  // Season actions — a season save is an EXPLICIT persist. When settings.seasons
  // was absent (synthesized from defaults), the first save here materializes the
  // full list. seasonStart/seasonEnd are never touched.
  // ---------------------------------------------------------------------------

  function slugify(label: string, existingIds: string[]): string {
    const base =
      label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') ||
      `season-${Date.now()}`;
    let id = base;
    let n = 2;
    while (existingIds.includes(id)) id = `${base}-${n++}`;
    return id;
  }

  function openAddSeason() {
    setSeasonDraftIsNew(true);
    setShowSeasonStartPicker(false);
    setSeasonDraft({ id: '', label: '', short: '', start: toISODate(new Date()) });
  }

  function openEditSeason(season: Season) {
    setSeasonDraftIsNew(false);
    setShowSeasonStartPicker(false);
    setSeasonDraft({ ...season });
  }

  function closeSeasonEditor() {
    setSeasonDraft(null);
    setShowSeasonStartPicker(false);
  }

  function saveSeasonDraft() {
    if (!seasonDraft) return;
    const label = seasonDraft.label.trim();
    if (!label || !seasonDraft.start) return;
    const short = seasonDraft.short.trim() || label;
    // Phase 29: optional league-week count (Path to goal). Blank = not set.
    const weeks = typeof seasonDraft.weeks === 'number' && seasonDraft.weeks > 0 ? seasonDraft.weeks : null;

    const current = getSeasons(settings);
    let updated: Season[];
    if (seasonDraftIsNew) {
      const id = slugify(label, current.map(s => s.id));
      updated = [...current, { id, label, short, start: seasonDraft.start, weeks }];
    } else {
      updated = current.map(s =>
        s.id === seasonDraft.id ? { ...s, label, short, start: seasonDraft.start, weeks } : s,
      );
    }
    updated.sort((a, b) => a.start.localeCompare(b.start));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    saveSettingsData({ ...settings, seasons: updated });
    closeSeasonEditor();
  }

  function deleteSeasonDraft() {
    if (!seasonDraft || seasonDraftIsNew) return;
    const current = getSeasons(settings);
    if (current.length <= 1) {
      Alert.alert('Cannot Delete', 'At least one season must remain.');
      return;
    }
    Alert.alert(
      'Delete Season?',
      `"${seasonDraft.label}" will be removed. Sessions are never deleted — they will fall into the adjacent season.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updated = current.filter(s => s.id !== seasonDraft.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            saveSettingsData({ ...settings, seasons: updated });
            closeSeasonEditor();
          },
        },
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const resolvedSeasons = resolveSeasonRanges(getSeasons(settings));

  function renderSeasonEditor() {
    if (!seasonDraft) return null;
    return (
      <View style={styles.seasonEditor}>
        <TextInput
          style={styles.addBallInput}
          value={seasonDraft.label}
          onChangeText={t => setSeasonDraft(d => (d ? { ...d, label: t } : d))}
          placeholder="Season name"
          placeholderTextColor="#48484A"
          returnKeyType="done"
          autoFocus
        />
        <TextInput
          style={styles.addBallInput}
          value={seasonDraft.short}
          onChangeText={t => setSeasonDraft(d => (d ? { ...d, short: t } : d))}
          placeholder="Short label (for pills, e.g. Winners 25)"
          placeholderTextColor="#48484A"
          returnKeyType="done"
          maxLength={16}
        />
        <TouchableOpacity
          style={styles.fieldRow}
          onPress={() => setShowSeasonStartPicker(v => !v)}
        >
          <Text style={styles.fieldLabel}>Start Date</Text>
          <Text style={seasonDraft.start ? styles.valueSet : styles.valueDim}>
            {formatDateDisplay(seasonDraft.start)}
          </Text>
        </TouchableOpacity>
        {showSeasonStartPicker && (
          <View style={styles.pickerWrap}>
            <TouchableOpacity
              style={styles.pickerDoneRow}
              onPress={() => setShowSeasonStartPicker(false)}
            >
              <Text style={styles.pickerDoneText}>Done</Text>
            </TouchableOpacity>
            <DateTimePicker
              value={parseDate(seasonDraft.start)}
              mode="date"
              display="spinner"
              onChange={(_e, d) => {
                if (d) setSeasonDraft(prev => (prev ? { ...prev, start: toISODate(d) } : prev));
              }}
              textColor="#FFFFFF"
              style={styles.datePicker}
            />
          </View>
        )}
        {/* Phase 29: season length for Path to goal on Stats. Saved with the
            season (Save below), so no blur-save path. */}
        <View style={[styles.fieldRow, styles.weeksRow]}>
          <Text style={styles.fieldLabel}>League Weeks</Text>
          <TextInput
            style={[styles.goalInput, styles.weeksInput]}
            value={seasonDraft.weeks != null ? String(seasonDraft.weeks) : ''}
            onChangeText={v => {
              const digits = v.replace(/[^0-9]/g, '');
              setSeasonDraft(d =>
                d ? { ...d, weeks: digits === '' ? null : Math.min(99, parseInt(digits, 10)) } : d,
              );
            }}
            keyboardType="number-pad"
            placeholder="—"
            placeholderTextColor="#48484A"
            maxLength={2}
            returnKeyType="done"
            accessibilityLabel="League weeks in this season"
          />
        </View>
        <View style={styles.seasonEditorButtons}>
          <ScalePressable
            style={[styles.saveBtn, styles.seasonSaveBtn, !seasonDraft.label.trim() && styles.saveBtnDisabled]}
            onPress={saveSeasonDraft}
            disabled={!seasonDraft.label.trim()}
          >
            <Text style={styles.saveBtnText}>{seasonDraftIsNew ? 'Add Season' : 'Save'}</Text>
          </ScalePressable>
          {!seasonDraftIsNew && (
            <ScalePressable style={styles.seasonDeleteBtn} onPress={deleteSeasonDraft}>
              <Text style={styles.seasonDeleteText}>Delete</Text>
            </ScalePressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <TouchableOpacity
          onPress={() => {
            flushGoals();
            onClose();
          }}
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
        {/* Phase 31A: the legacy Season Start/End card is no longer shown --
            Seasons below replaced it (Phase 24). seasonStart / seasonEnd stay in
            settings untouched (weekFor() falls back to seasonStart only for a
            date before every season). */}
        {/* ----------------------------------------------------------------
            Seasons (Phase 24) — gapless. Only start is stored; each end is
            derived as the next start minus a day. Adding a season is how a
            season rolls over.
        ---------------------------------------------------------------- */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Seasons</Text>
          <TouchableOpacity
            onPress={() =>
              seasonDraft && seasonDraftIsNew ? closeSeasonEditor() : openAddSeason()
            }
          >
            <Text style={styles.addLink}>
              {seasonDraft && seasonDraftIsNew ? 'Cancel' : '+ Add Season'}
            </Text>
          </TouchableOpacity>
        </View>

        {seasonDraft && seasonDraftIsNew && (
          <View style={styles.card}>{renderSeasonEditor()}</View>
        )}

        <View style={styles.card}>
          {resolvedSeasons.map((s, index) => (
            <View key={s.id}>
              {index > 0 && <View style={styles.separator} />}
              {seasonDraft && !seasonDraftIsNew && seasonDraft.id === s.id ? (
                renderSeasonEditor()
              ) : (
                <TouchableOpacity style={styles.seasonRow} onPress={() => openEditSeason(s)}>
                  <View style={styles.seasonRowText}>
                    <Text style={styles.seasonLabel}>{s.label}</Text>
                    <Text style={styles.seasonRange}>
                      {formatDateShort(s.start)} → {s.end ? formatDateShort(s.end) : 'open'}
                      {s.weeks ? ` · ${s.weeks} wks` : ''}
                    </Text>
                  </View>
                  <Text style={styles.seasonShort}>{s.short}</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* ----------------------------------------------------------------
            Goals
        ---------------------------------------------------------------- */}
        <Text style={styles.sectionLabel}>Goals</Text>
        <View style={styles.card}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Target Average</Text>
            <TextInput
              style={styles.goalInput}
              value={settings.targetAverage != null ? String(settings.targetAverage) : ''}
              onChangeText={v => {
                const digits = v.replace(/[^0-9]/g, '');
                setGoal({ targetAverage: digits === '' ? null : Math.min(300, parseInt(digits, 10)) });
              }}
              onBlur={flushGoals}
              keyboardType="number-pad"
              placeholder="—"
              placeholderTextColor="#48484A"
              maxLength={3}
              returnKeyType="done"
            />
          </View>
          <View style={[styles.fieldRow, styles.fieldRowLast]}>
            <Text style={styles.fieldLabel}>Target Series</Text>
            <TextInput
              style={styles.goalInput}
              value={settings.targetSeries != null ? String(settings.targetSeries) : ''}
              onChangeText={v => {
                const digits = v.replace(/[^0-9]/g, '');
                setGoal({ targetSeries: digits === '' ? null : Math.min(900, parseInt(digits, 10)) });
              }}
              onBlur={flushGoals}
              keyboardType="number-pad"
              placeholder="—"
              placeholderTextColor="#48484A"
              maxLength={3}
              returnKeyType="done"
            />
          </View>
        </View>

        {/* ----------------------------------------------------------------
            Ball Roster
        ---------------------------------------------------------------- */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Ball roster</Text>
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
                  <TappableStrengthDots
                    strength={ball.strength}
                    onPress={(v) => changeStrength(ball.id, v)}
                  />

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
                    <TouchableOpacity
                      style={styles.ballNameTap}
                      onPress={() => startRename(ball)}
                      accessibilityHint="Tap to rename"
                    >
                      <Text style={[styles.ballName, !ball.active && styles.ballNameDim]}>
                        {ball.name}
                      </Text>
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

        {/* ----------------------------------------------------------------
            Export Backup (Phase 26.0b) + Restore from Backup
        ---------------------------------------------------------------- */}
        {/* Phase 31A: one grouped "Backup" card instead of three loose buttons. */}
        <Text style={styles.sectionLabel}>Backup</Text>
        <View style={[styles.card, styles.backupCard]}>
        <ScalePressable
          style={styles.backupRow}
          disabled={exporting}
          onPress={async () => {
            if (exporting) return;
            setExporting(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            try {
              const result = await exportBackup();
              if (!result.success) {
                Alert.alert('Export Failed', result.error ?? 'Unknown error.');
              }
            } finally {
              setExporting(false);
            }
          }}
        >
          <Text style={[styles.exportText, exporting && styles.exportTextBusy]}>
            {exporting ? 'Exporting…' : 'Export Backup'}
          </Text>
        </ScalePressable>
        <View style={styles.separator} />
        <TouchableOpacity
          style={styles.backupRow}
          onPress={() => {
            Alert.alert(
              'Restore from Backup?',
              'This will replace ALL current data (sessions, balls, settings, reference) with the data from your last backup. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Restore',
                  style: 'destructive',
                  onPress: async () => {
                    const result = await restoreBackup();
                    if (result.success) {
                      await loadData();
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      Alert.alert('Backup Restored', 'Your data has been restored. If anything still looks out of date, close and reopen the app.');
                    } else {
                      Alert.alert('Restore Failed', result.error ?? 'Unknown error.');
                    }
                  },
                },
              ]
            );
          }}
        >
          <Text style={styles.restoreText}>Restore from Backup</Text>
        </TouchableOpacity>
        <View style={styles.separator} />
        <TouchableOpacity
          style={styles.backupRow}
          disabled={restoring}
          onPress={() => { void startRestoreFromFile(); }}
        >
          <Text style={[styles.restoreText, restoring && styles.exportTextBusy]}>
            {restoring ? 'Restoring…' : 'Restore from File…'}
          </Text>
        </TouchableOpacity>
        </View>

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
  // Phase 31A: Stats / Reference-style section headers (20/600, sentence case).
  sectionLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
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
    fontWeight: '600',
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

  // Goals
  fieldRowLast: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#38383A',
  },
  // League Weeks: the input fills a 50pt row so the whole height is tappable.
  weeksRow: { paddingVertical: 3 },
  weeksInput: { minHeight: 44, minWidth: 88 },
  goalInput: {
    fontSize: 17,
    fontWeight: '300',
    color: '#00CEC9',
    textAlign: 'right',
    minWidth: 60,
    padding: 0,
  },

  // Seasons
  seasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  seasonRowText: {
    flex: 1,
  },
  seasonLabel: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  seasonRange: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  seasonShort: {
    fontSize: 13,
    color: '#00CEC9',
    fontWeight: '500',
  },
  seasonEditor: {
    paddingVertical: 4,
  },
  seasonEditorButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  seasonSaveBtn: {
    flex: 1,
    marginBottom: 0,
  },
  seasonDeleteBtn: {
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2C2C2E',
  },
  seasonDeleteText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF453A',
  },

  // Restore from backup
  backupCard: { paddingVertical: 0 },
  backupRow: { minHeight: 50, justifyContent: 'center', paddingVertical: 14 },
  restoreText: {
    fontSize: 15,
    color: '#FF453A',
    fontWeight: '500',
  },
  exportText: {
    fontSize: 15,
    color: '#00CEC9',
    fontWeight: '500',
  },
  exportTextBusy: {
    color: '#8E8E93',
  },
});
