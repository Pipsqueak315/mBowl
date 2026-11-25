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
  Keyboard,
  Platform,
  Alert,
  ActionSheetIOS,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { readSettingsResult, writeSettings, readBallsResult, writeBalls, readSessionsResult } from '@/src/storage';
import {
  writeBackup,
  restoreBackup,
  exportBackup,
  pickBackupFile,
  summarizeBackup,
  restoreFromPickedJson,
  lastBackupAt,
  exportCsv,
} from '@/src/backup';
import { readSessions } from '@/src/storage';
import { ballWear, sessionsToCsv } from '@/src/extras';
import type { Session } from '@/src/types';
import { notifyDataChanged } from '@/src/dataEvents';
import ScalePressable from '@/components/ScalePressable';
import SegmentedControl from '@/components/v2/SegmentedControl';
import KeyboardDoneBar, { DONE_BAR } from '@/components/v2/KeyboardDoneBar';
import type { Settings, Ball, Season } from '@/src/types';
import { getSeasons, resolveSeasonRanges } from '@/src/seasons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = { onClose: () => void };

// ---------------------------------------------------------------------------
// Sub-components: strength dots
// ---------------------------------------------------------------------------

// v2.1 P5: the five 8pt dots were separate ~24x16pt tap targets with
// overlapping slop (easy to hit the wrong one). Now the dots are one 44pt
// control that opens a 1-5 action sheet.
const STRENGTH_OPTIONS = ['1 · Weakest', '2', '3', '4', '5 · Strongest'];

function TappableStrengthDots({
  strength,
  ballName,
  onPress,
}: {
  strength: number;
  ballName: string;
  onPress: (value: number) => void;
}) {
  function choose() {
    Keyboard.dismiss();
    if (Platform.OS !== 'ios') return;
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: `${ballName} strength`,
        options: [...STRENGTH_OPTIONS, 'Cancel'],
        cancelButtonIndex: STRENGTH_OPTIONS.length,
      },
      (i) => {
        if (i < STRENGTH_OPTIONS.length && i + 1 !== strength) onPress(i + 1);
      },
    );
  }
  return (
    <TouchableOpacity
      style={styles.dotsTap}
      onPress={choose}
      accessibilityRole="button"
      accessibilityLabel={`Strength ${strength} of 5`}
      accessibilityHint="Opens a list to change it"
    >
      <View style={styles.dotsRow}>
        {[1, 2, 3, 4, 5].map(i => (
          <View key={i} style={[styles.dot, i <= strength ? styles.dotFilled : styles.dotEmpty]} />
        ))}
      </View>
    </TouchableOpacity>
  );
}

const STRENGTH_SEGMENTS = [
  { key: '1', label: '1' },
  { key: '2', label: '2' },
  { key: '3', label: '3' },
  { key: '4', label: '4' },
  { key: '5', label: '5' },
] as const;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function withCare(b: Ball, field: 'resurfacedOn' | 'oilExtractedOn', v: string | null): Ball {
  return field === 'resurfacedOn' ? { ...b, resurfacedOn: v } : { ...b, oilExtractedOn: v };
}

// Phase 31B data health: "45 sessions · 140 games · 98 with frames · backed up today".
function healthLine(sessions: Session[], backupAt: string | null): string {
  let games = 0;
  let framed = 0;
  for (const s of sessions) {
    for (const g of s.games ?? []) {
      if (g.score == null) continue;
      games++;
      if (g.frames && g.frames.length > 0) framed++;
    }
  }
  let backed = 'no backup file yet';
  if (backupAt) {
    const d = new Date(backupAt);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    backed = sameDay
      ? `backed up today ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
      : `backed up ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  return `${sessions.length} sessions · ${games} games · ${framed} with frames · ${backed}`;
}

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
  // Phase 31B: data health + ball care (display-only reads; ball dates save
  // through saveBallsData like every other ball change).
  const [sessionsForStats, setSessionsForStats] = useState<Session[]>([]);
  const [backupAt, setBackupAt] = useState<string | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [careEdit, setCareEdit] = useState<{ ballId: string; field: 'resurfacedOn' | 'oilExtractedOn'; date: Date } | null>(null);
  async function loadHealth() {
    const [saved, at] = await Promise.all([readSessions(), lastBackupAt()]);
    setSessionsForStats(saved);
    setBackupAt(at);
  }
  useEffect(() => { void loadHealth(); }, []);

  // D5 / F14 (Phase 31A): goal fields used to save only on blur, with the
  // settings from the last render -- tapping Done with the keyboard up could
  // close the sheet before the blur save ran. Now every keystroke schedules a
  // save of the latest value, and blur / Done / closing the sheet flushes it.
  const latestSettingsRef = useRef<Settings>({});
  const goalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Review fix: every load / save / rollback goes through applySettings, so the
  // ref is never behind what is on screen (a goal keystroke in the first frame
  // after load must not build on {} and write a settings blob with no seasons).
  function applySettings(v: Settings) {
    latestSettingsRef.current = v;
    setSettings(v);
  }
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
    applySettings(s.value);
    setBalls(b.value);
    lastSavedSettings.current = s.value;
    lastSavedBalls.current = b.value;
    void loadHealth();
  }

  // Load settings + balls on mount
  useEffect(() => {
    let active = true;
    (async () => {
      const [s, b] = await Promise.all([readSettingsResult(), readBallsResult()]);
      if (!active) return;
      settingsReadable.current = s.status === 'ok' || s.status === 'missing';
      ballsReadable.current = b.status === 'ok' || b.status === 'missing';
      applySettings(s.value);
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
      if (lastSavedSettings.current) applySettings(lastSavedSettings.current);
      refuseUnreadable('settings');
      return;
    }
    applySettings(updated);
    const ok = await writeSettings(updated);
    if (!ok) {
      if (lastSavedSettings.current) applySettings(lastSavedSettings.current);
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
    const d = new Date(iso + 'T12:00:00');
    // A malformed stored date must never reach the native date picker.
    return Number.isNaN(d.getTime()) ? new Date() : d;
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
          autoCorrect={false}
          autoFocus
        />
        <TextInput
          style={styles.addBallInput}
          value={seasonDraft.short}
          onChangeText={t => setSeasonDraft(d => (d ? { ...d, short: t } : d))}
          placeholder="Short label (for pills, e.g. Winners 25)"
          placeholderTextColor="#48484A"
          returnKeyType="done"
          autoCorrect={false}
          maxLength={16}
        />
        <TouchableOpacity
          style={styles.fieldRow}
          onPress={() => {
            Keyboard.dismiss(); // v2.1 P1
            setShowSeasonStartPicker(v => !v);
          }}
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
            inputAccessoryViewID={DONE_BAR.settings}
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

      {/* v2.1 P1 / P8: the ScrollView insets itself by the keyboard, and taps
          on controls work the first time with the keyboard up. */}
      <View style={styles.kavFlex}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
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
            style={styles.addLinkTap}
            hitSlop={{ left: 12, right: 12 }}
            onPress={() =>
              seasonDraft && seasonDraftIsNew ? closeSeasonEditor() : openAddSeason()
            }
          >
            <Text style={styles.addLink}>
              {seasonDraft && seasonDraftIsNew ? 'Cancel' : 'Add season'}
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
              inputAccessoryViewID={DONE_BAR.settings}
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
              inputAccessoryViewID={DONE_BAR.settings}
            />
          </View>
        </View>

        {/* ----------------------------------------------------------------
            Ball Roster
        ---------------------------------------------------------------- */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Ball roster</Text>
          <TouchableOpacity
            style={styles.addLinkTap}
            hitSlop={{ left: 12, right: 12 }}
            onPress={() => setAddingBall(v => !v)}
          >
            <Text style={styles.addLink}>{addingBall ? 'Cancel' : 'Add ball'}</Text>
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
              autoCorrect={false}
              autoFocus
            />
            <Text style={styles.strengthTitle}>Strength</Text>
            <View style={styles.strengthRow}>
              <SegmentedControl
                segments={STRENGTH_SEGMENTS}
                value={String(newBallStrength) as (typeof STRENGTH_SEGMENTS)[number]['key']}
                onChange={(k) => setNewBallStrength(Number(k))}
                accessibilityLabel="Ball strength"
              />
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
                    ballName={ball.name}
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
                      autoCorrect={false}
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
        {/* ----------------------------------------------------------------
            Phase 31B: Ball care -- games since the last resurface / oil
            extraction, counted from history. No thresholds; just the count.
        ---------------------------------------------------------------- */}
        {balls.some(b => b.active) && (
          <>
            <Text style={styles.sectionLabel}>Ball care</Text>
            <View style={styles.card}>
              {balls.filter(b => b.active).map((ball, index) => {
                const wear = ballWear(sessionsForStats, ball);
                return (
                  <View key={ball.id}>
                    {index > 0 && <View style={styles.separator} />}
                    <View style={styles.careBlock}>
                      <Text style={styles.careName} numberOfLines={1}>{ball.name}</Text>
                      {(['resurfacedOn', 'oilExtractedOn'] as const).map(field => {
                        const w = field === 'resurfacedOn' ? wear.resurfaced : wear.oil;
                        const editing = careEdit?.ballId === ball.id && careEdit.field === field;
                        return (
                          <View key={field}>
                            <TouchableOpacity
                              style={styles.careRow}
                              onPress={() =>
                                setCareEdit(editing ? null : {
                                  ballId: ball.id,
                                  field,
                                  date: ball[field] ? parseDate(ball[field]) : new Date(),
                                })
                              }
                            >
                              <Text style={styles.careLabel}>
                                {field === 'resurfacedOn' ? 'Resurfaced' : 'Oil extracted'}
                              </Text>
                              <Text style={w ? styles.careValue : styles.valueDim}>
                                {w ? `${formatDateShort(w.date)} · ${w.games} game${w.games === 1 ? '' : 's'} since` : 'Not set'}
                              </Text>
                            </TouchableOpacity>
                            {editing && careEdit && (
                              <View style={styles.pickerWrap}>
                                <View style={styles.careActions}>
                                  {ball[field] ? (
                                    <TouchableOpacity
                                      style={styles.careAction}
                                      onPress={() => {
                                        setCareEdit(null);
                                        saveBallsData(balls.map(b => (b.id === ball.id ? withCare(b, field, null) : b)));
                                      }}
                                    >
                                      <Text style={styles.careClear}>Clear</Text>
                                    </TouchableOpacity>
                                  ) : <View />}
                                  <TouchableOpacity
                                    style={styles.careAction}
                                    onPress={() => {
                                      const iso = toISODate(careEdit.date);
                                      setCareEdit(null);
                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                      saveBallsData(balls.map(b => (b.id === ball.id ? withCare(b, field, iso) : b)));
                                    }}
                                  >
                                    <Text style={styles.pickerDoneText}>Save</Text>
                                  </TouchableOpacity>
                                </View>
                                <DateTimePicker
                                  value={careEdit.date}
                                  mode="date"
                                  display="spinner"
                                  maximumDate={new Date()}
                                  onChange={(_e, d) => {
                                    if (d) setCareEdit(prev => (prev ? { ...prev, date: d } : prev));
                                  }}
                                  textColor="#FFFFFF"
                                  style={styles.datePicker}
                                />
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Phase 31A: one grouped "Backup" card instead of three loose buttons. */}
        <Text style={styles.sectionLabel}>Backup</Text>
        {/* Phase 31B: data health at a glance */}
        <Text style={styles.healthLine}>{healthLine(sessionsForStats, backupAt)}</Text>
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
              void loadHealth();
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
        <ScalePressable
          style={styles.backupRow}
          disabled={exportingCsv}
          onPress={async () => {
            if (exportingCsv) return;
            setExportingCsv(true);
            try {
              // Read with status: never share an empty CSV because a read failed.
              const read = await readSessionsResult();
              if (read.status === 'invalid' || read.status === 'error') {
                Alert.alert('Export Failed', "Your saved sessions couldn't be read, so no CSV was made. Relaunch the app and try again.");
                return;
              }
              if (read.value.length === 0) {
                Alert.alert('Nothing to export', 'There are no saved sessions yet.');
                return;
              }
              const result = await exportCsv(sessionsToCsv(read.value));
              if (!result.success) Alert.alert('Export Failed', result.error ?? 'Unknown error.');
            } finally {
              setExportingCsv(false);
            }
          }}
        >
          <Text style={[styles.exportText, exportingCsv && styles.exportTextBusy]}>
            {exportingCsv ? 'Exporting…' : 'Export Games (CSV)'}
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
      </View>
      <KeyboardDoneBar id={DONE_BAR.settings} />
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
    fontSize: 17,
    color: '#00CEC9',
    fontWeight: '500',
  },
  // v2.1 P5: a 44pt tap area for the text links
  addLinkTap: { minHeight: 44, justifyContent: 'center' },
  dotsTap: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingRight: 8 },
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
    marginBottom: 16,
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
    paddingVertical: 4, // v2.1 P5: the strength control is 44pt tall now
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
  healthLine: { fontSize: 13, color: '#8E8E93', marginBottom: 8 },
  careBlock: { paddingVertical: 8 },
  careName: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', paddingVertical: 4 },
  careRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
  careLabel: { fontSize: 15, color: '#FFFFFF' },
  careValue: { fontSize: 15, color: '#00CEC9' },
  careActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  careAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  careClear: { fontSize: 15, color: '#FF453A' },
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
