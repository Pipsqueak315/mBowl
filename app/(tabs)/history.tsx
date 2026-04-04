import { useState, useLayoutEffect, useCallback, useRef, useEffect } from 'react';
import SettingsContent from '@/components/SettingsContent';
import EditSessionModal, { type EditableSession } from '@/components/EditSessionModal';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { readSessions, writeSessions } from '@/src/storage';
import { writeBackup } from '@/src/backup';
import { FRAME_RESULT_KEY } from '@/app/log-frames';
import type { ThrowEntry, GameEntry, Session } from '@/src/types';
import { IconSymbol } from '@/components/ui/icon-symbol';
import ScalePressable from '@/components/ScalePressable';

type FilterType = 'all' | 'league' | 'makeup' | 'practice' | 'tournament';

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'league', label: 'League' },
  { key: 'makeup', label: 'Makeup' },
  { key: 'practice', label: 'Practice' },
  { key: 'tournament', label: 'Tournament' },
];

const EMPTY_LABELS: Record<FilterType, string> = {
  all: 'No sessions yet',
  league: 'No league sessions yet',
  makeup: 'No makeup sessions yet',
  practice: 'No practice sessions yet',
  tournament: 'No tournament sessions yet',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function sessionAvg(games: GameEntry[]): number {
  const scored = games.filter(g => g.score != null);
  if (!scored.length) return 0;
  return scored.reduce((sum, g) => sum + (g.score as number), 0) / scored.length;
}

function seriesTotal(games: GameEntry[]): number {
  return games.reduce((sum, g) => sum + (g.score ?? 0), 0);
}

function scoreColor(score: number, avg: number): string {
  const diff = score - avg;
  if (diff >= 5) return '#30D158';
  if (diff >= -5) return '#FF9F0A';
  return '#FF453A';
}

function seriesColor(total: number): string {
  if (total > 550) return '#30D158';
  if (total >= 500) return '#FF9F0A';
  return '#FF453A';
}

function typeBadgeColor(type: Session['type']): string {
  switch (type) {
    case 'league': return '#00CEC9';
    case 'makeup': return '#FF9F0A';
    case 'practice': return '#8E8E93';
    case 'tournament': return '#FFD60A';
  }
}

function typeBadgeTextColor(type: Session['type']): string {
  return type === 'tournament' ? '#000000' : '#FFFFFF';
}

function typeLabel(type: Session['type']): string {
  switch (type) {
    case 'league': return 'League';
    case 'makeup': return 'Makeup';
    case 'practice': return 'Practice';
    case 'tournament': return 'Tournament';
  }
}

function calcFrameStats(
  games: GameEntry[]
): { strikes: number; sparesPct: number | null; opens: number } | null {
  const gamesWithFrames = games.filter((g) => g.frames && g.frames.length === 10);
  if (!gamesWithFrames.length) return null;

  let totalStrikes = 0;
  let totalSpares = 0;
  let totalOpens = 0;
  let totalNonStrikeFrames = 0;

  for (const game of gamesWithFrames) {
    const frames = game.frames!;
    for (let i = 0; i < 9; i++) {
      const f = frames[i];
      if (!f || !f.throws.length) continue;
      if (f.throws[0] === 'X') {
        totalStrikes++;
      } else {
        totalNonStrikeFrames++;
        if (f.throws[1] === '/') {
          totalSpares++;
        } else if (f.throws.length >= 2) {
          totalOpens++;
        }
      }
    }
    const f10 = frames[9];
    if (f10 && f10.throws.length) {
      for (const t of f10.throws) {
        if (t === 'X') totalStrikes++;
      }
    }
  }

  const sparesPct =
    totalNonStrikeFrames > 0 ? (totalSpares / totalNonStrikeFrames) * 100 : null;
  return { strikes: totalStrikes, sparesPct, opens: totalOpens };
}

// Compact 5-dot × 4-row pin diagram used inside each frame box.
// Only rendered when pinsStanding data exists AND at least one pin is standing.
const MINI_PIN_ROWS: number[][] = [[6, 7, 8, 9], [3, 4, 5], [1, 2], [0]];

function MiniPinDeck({ pinsStanding }: { pinsStanding: boolean[] }) {
  if (!pinsStanding.some(s => s)) return null; // all down → nothing interesting to show
  return (
    <View style={styles.miniDeck}>
      {MINI_PIN_ROWS.map((row, ri) => (
        <View key={ri} style={styles.miniRow}>
          {row.map(idx => (
            <View
              key={idx}
              style={[styles.miniPin, pinsStanding[idx] ? styles.miniPinUp : styles.miniPinDown]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function FrameGrid({ frames }: { frames: ThrowEntry[] }) {
  return (
    <View style={styles.frameGrid}>
      {frames.slice(0, 10).map((frame, fi) => {
        const is10th = fi === 9;
        const throws = is10th ? frame.throws.slice(0, 3) : frame.throws.slice(0, 2);
        // Show mini pin diagram for the state after the first ball (the leave)
        const leaveData = frame.pinsStanding?.[0] ?? null;
        return (
          <View key={fi} style={[styles.frameBox, is10th && styles.frameBoxWide]}>
            <View style={styles.frameThrows}>
              {throws.map((t, ti) => (
                <Text key={ti} style={[styles.frameThrowChip, t === 'X' && styles.strikeChip]}>
                  {t}
                </Text>
              ))}
            </View>
            {leaveData && <MiniPinDeck pinsStanding={leaveData} />}
            <View style={styles.frameNumberRow}>
              <Text style={styles.frameNumberText}>{fi + 1}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function MadeCutBadge({ madeCut }: { madeCut: string | null }) {
  if (!madeCut || madeCut === 'N/A') {
    return (
      <View style={[styles.madeCutBadge, { backgroundColor: '#48484A' }]}>
        <Text style={styles.madeCutText}>N/A</Text>
      </View>
    );
  }
  if (madeCut === 'Yes') {
    return (
      <View style={[styles.madeCutBadge, { backgroundColor: '#30D158' }]}>
        <Text style={styles.madeCutText}>Made Cut</Text>
      </View>
    );
  }
  return (
    <View style={[styles.madeCutBadge, { backgroundColor: '#FF453A' }]}>
      <Text style={styles.madeCutText}>Missed Cut</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Share card — rendered off-screen, captured with captureRef
// ---------------------------------------------------------------------------

function ShareCardView({ session }: { session: Session }) {
  const avg = sessionAvg(session.games);
  const series = seriesTotal(session.games);
  const isPractice = session.type === 'practice';
  const frameStats = calcFrameStats(session.games);
  const hasFrames = session.games.some(g => g.frames && g.frames.length === 10);

  return (
    <View style={sc.card}>
      {/* Header row */}
      <View style={sc.headerRow}>
        <Text style={sc.date}>{formatDate(session.date)}</Text>
        <View style={[sc.badge, { backgroundColor: typeBadgeColor(session.type) }]}>
          <Text style={[sc.badgeText, { color: typeBadgeTextColor(session.type) }]}>
            {typeLabel(session.type)}
          </Text>
        </View>
      </View>

      {/* Tournament info */}
      {session.type === 'tournament' && (session.name || session.madeCut || session.placement) && (
        <View style={sc.tournRow}>
          {session.name ? <Text style={sc.tournName}>{session.name}</Text> : null}
          {session.madeCut && session.madeCut !== 'N/A' ? (
            <View style={[sc.madeCutBadge, { backgroundColor: session.madeCut === 'Yes' ? '#30D158' : '#FF453A' }]}>
              <Text style={sc.madeCutText}>{session.madeCut === 'Yes' ? 'Made Cut' : 'Missed Cut'}</Text>
            </View>
          ) : null}
          {session.placement ? <Text style={sc.placement}>Finish: {session.placement}</Text> : null}
        </View>
      )}

      {/* Per-game scores */}
      <View style={sc.gamesRow}>
        {session.games.filter(g => g.score != null).map((g, i) => (
          <View key={i} style={sc.gameItem}>
            <Text style={[sc.gameScore, { color: scoreColor(g.score as number, avg) }]}>
              {g.score}
            </Text>
            {g.ball ? <Text style={sc.gameBall}>{g.ball}</Text> : null}
          </View>
        ))}
        {!isPractice && (
          <View style={sc.seriesItem}>
            <Text style={[sc.seriesScore, { color: seriesColor(series) }]}>{series}</Text>
            <Text style={sc.seriesLabel}>series</Text>
          </View>
        )}
      </View>

      {/* Frame grid per game */}
      {hasFrames && (
        <View style={sc.framesSection}>
          {session.games.map((g, i) =>
            g.frames && g.frames.length === 10 ? (
              <View key={i} style={sc.gameFrameRow}>
                <Text style={sc.gameFrameLabel}>G{g.game}</Text>
                <FrameGrid frames={g.frames} />
              </View>
            ) : null
          )}
        </View>
      )}

      {/* Key stats */}
      {frameStats && (
        <View style={sc.statsRow}>
          <View style={sc.statItem}>
            <Text style={sc.statValue}>{frameStats.strikes}</Text>
            <Text style={sc.statLabel}>Strikes</Text>
          </View>
          <View style={sc.statDivider} />
          <View style={sc.statItem}>
            <Text style={sc.statValue}>
              {frameStats.sparesPct != null ? `${Math.round(frameStats.sparesPct)}%` : 'N/A'}
            </Text>
            <Text style={sc.statLabel}>Spare %</Text>
          </View>
          <View style={sc.statDivider} />
          <View style={sc.statItem}>
            <Text style={sc.statValue}>{frameStats.opens}</Text>
            <Text style={sc.statLabel}>Opens</Text>
          </View>
        </View>
      )}

      {/* Watermark */}
      <Text style={sc.watermark}>mBowl</Text>
    </View>
  );
}

// Share card styles (inline, self-contained — never references outer `styles`)
const sc = StyleSheet.create({
  card: {
    width: 340,
    backgroundColor: '#1C1C1E',
    borderRadius: 13,
    padding: 16,
    gap: 12,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  tournRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tournName: { fontSize: 13, color: '#FFFFFF', fontWeight: '500' },
  madeCutBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  madeCutText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  placement: { fontSize: 12, color: '#8E8E93' },
  gamesRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
  gameItem: { alignItems: 'center', gap: 3 },
  gameScore: { fontSize: 28, fontWeight: '700' },
  gameBall: { fontSize: 10, color: '#8E8E93', textAlign: 'center' },
  seriesItem: { marginLeft: 'auto', alignItems: 'center' },
  seriesScore: { fontSize: 22, fontWeight: '700' },
  seriesLabel: { fontSize: 10, color: '#8E8E93' },
  framesSection: { gap: 6 },
  gameFrameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gameFrameLabel: { fontSize: 10, fontWeight: '700', color: '#8E8E93', width: 16 },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    paddingVertical: 10,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  statLabel: { fontSize: 10, color: '#8E8E93', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#38383A', marginVertical: 4 },
  watermark: { fontSize: 10, color: '#00CEC9', textAlign: 'right', opacity: 0.6 },
});

function SessionCard({
  session,
  onDelete,
  onEdit,
}: {
  session: Session;
  onDelete: (id: number | string) => void;
  onEdit: (session: Session) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [sharing, setSharing] = useState(false);
  const swipeRef = useRef<Swipeable>(null);
  const shareCardRef = useRef<View>(null);
  const avg = sessionAvg(session.games);
  const series = seriesTotal(session.games);
  const isPractice = session.type === 'practice';
  const frameStats = expanded ? calcFrameStats(session.games) : null;

  async function handleShare() {
    if (Platform.OS !== 'ios') return;
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) return;
    setSharing(true);
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      const uri = await captureRef(shareCardRef, { format: 'png', quality: 1 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
    } catch {
      // share cancelled or failed — silent
    } finally {
      setSharing(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  const renderRightActions = () => (
    <View style={styles.swipeActions}>
      <TouchableOpacity
        style={styles.editAction}
        onPress={() => {
          swipeRef.current?.close();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onEdit(session);
        }}
      >
        <Text style={styles.swipeActionText}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => {
          swipeRef.current?.close();
          Alert.alert('Delete Session', 'Are you sure? This cannot be undone.', [
            { text: 'Cancel', style: 'cancel', onPress: () => swipeRef.current?.close() },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onDelete(session.id);
              },
            },
          ]);
        }}
      >
        <Text style={styles.swipeActionText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      friction={2}
      overshootRight={false}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setExpanded((e) => !e)}
        style={styles.card}
      >
        {/* Collapsed header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <Text style={styles.cardDate}>{formatDate(session.date)}</Text>
            <View
              style={[
                styles.typeBadge,
                { backgroundColor: typeBadgeColor(session.type) },
              ]}
            >
              <Text
                style={[
                  styles.typeBadgeText,
                  { color: typeBadgeTextColor(session.type) },
                ]}
              >
                {typeLabel(session.type)}
              </Text>
            </View>
          </View>

          <View style={styles.cardRight}>
            <View style={styles.scoresRow}>
              {session.games.filter(g => g.score != null).map((g, i) => (
                <Text key={i} style={[styles.gameScore, { color: scoreColor(g.score as number, avg) }]}>
                  {g.score}
                </Text>
              ))}
            </View>
            {!isPractice && (
              <Text style={[styles.seriesTotal, { color: seriesColor(series) }]}>
                {series} series
              </Text>
            )}
          </View>
        </View>

        {/* Expanded content */}
        {expanded && (
          <View style={styles.expandedContent}>
            <View style={styles.expandDivider} />

            {/* Per-game rows */}
            {session.games.map((g, i) => (
              <View key={i} style={styles.gameRow}>
                <View style={styles.gameRowHeader}>
                  <Text style={styles.gameLabel}>Game {g.game}</Text>
                  <Text
                    style={[styles.gameExpandScore, { color: scoreColor(g.score ?? 0, avg) }]}
                  >
                    {g.score ?? '—'}
                  </Text>
                  {g.ball ? (
                    <Text style={styles.gameBall}>{g.ball}</Text>
                  ) : null}
                </View>
                {g.notes ? (
                  <Text style={styles.gameNotes}>{g.notes}</Text>
                ) : null}
                {g.frames && g.frames.length === 10 ? (
                  <FrameGrid frames={g.frames} />
                ) : null}
              </View>
            ))}

            {/* Key stats row */}
            {frameStats ? (
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{frameStats.strikes}</Text>
                  <Text style={styles.statLabel}>Strikes</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {frameStats.sparesPct != null
                      ? `${Math.round(frameStats.sparesPct)}%`
                      : 'N/A'}
                  </Text>
                  <Text style={styles.statLabel}>Spare %</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{frameStats.opens}</Text>
                  <Text style={styles.statLabel}>Opens</Text>
                </View>
              </View>
            ) : null}

            {/* Tournament extras */}
            {session.type === 'tournament' ? (
              <View style={styles.tournamentBlock}>
                {session.name ? (
                  <Text style={styles.tournamentName}>{session.name}</Text>
                ) : null}
                <View style={styles.tournamentMeta}>
                  <MadeCutBadge madeCut={session.madeCut} />
                  {session.placement ? (
                    <Text style={styles.tournamentPlacement}>
                      Finish: {session.placement}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Session notes */}
            {session.notes ? (
              <Text style={styles.sessionNotes}>{session.notes}</Text>
            ) : null}

            {/* Share button */}
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShare}
              disabled={sharing}
              activeOpacity={0.7}
            >
              <IconSymbol name="square.and.arrow.up" size={14} color="#00CEC9" />
              <Text style={styles.shareButtonText}>{sharing ? 'Sharing…' : 'Share'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Off-screen capture view for share card — always mounted when expanded */}
        {expanded && (
          <View
            ref={shareCardRef}
            style={styles.offScreenCapture}
            collapsable={false}
          >
            <ShareCardView session={session} />
          </View>
        )}
      </TouchableOpacity>
    </Swipeable>
  );
}

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Tracks a pending frame-edit: session snapshot + game index, used to reopen modal on return
  const pendingFrameEditRef = useRef<{ session: Session; gameIndex: number } | null>(null);
  // When set, triggers a router.push after the edit modal state update has been applied
  const shouldPushFramesRef = useRef<{
    gameIndex: number;
    priorScores: string;
    initialFrames: string;
  } | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setSettingsOpen(true)}
          style={styles.gearButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <IconSymbol name="gearshape.fill" size={22} color="#8E8E93" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  // Push to log-frames once editModalOpen has settled to false (avoids navigating over an open modal)
  useEffect(() => {
    if (!editModalOpen && shouldPushFramesRef.current) {
      const { gameIndex, priorScores, initialFrames } = shouldPushFramesRef.current;
      shouldPushFramesRef.current = null;
      router.push({
        pathname: '/log-frames',
        params: { gameIndex: String(gameIndex), priorScores, initialFrames },
      });
    }
  }, [editModalOpen]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        setLoaded(false);
        const raw = await readSessions();
        if (!active) return;
        raw.sort((a, b) => b.date.localeCompare(a.date));
        setSessions(raw);
        setLoaded(true);

        // If returning from a frame edit, reopen the edit modal with updated data
        const resultRaw = await AsyncStorage.getItem(FRAME_RESULT_KEY);
        if (!active) return;
        if (resultRaw && pendingFrameEditRef.current) {
          const result = JSON.parse(resultRaw) as {
            gameIndex: number;
            score: number;
            frames: ThrowEntry[];
          };
          await AsyncStorage.removeItem(FRAME_RESULT_KEY);
          const pending = pendingFrameEditRef.current;
          pendingFrameEditRef.current = null;
          const updatedSession: Session = {
            ...pending.session,
            games: pending.session.games.map((g, i) =>
              i === result.gameIndex
                ? { ...g, score: result.score, frames: result.frames }
                : g
            ),
          };
          if (active) {
            setEditingSession(updatedSession);
            setEditModalOpen(true);
          }
        }
      };
      load();
      return () => { active = false; };
    }, [])
  );

  const handleDelete = useCallback((id: number | string) => {
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      writeSessions(updated).then(() => { void writeBackup(); });
      return updated;
    });
  }, []);

  const handleEdit = useCallback((session: Session) => {
    setEditingSession(session);
    setEditModalOpen(true);
  }, []);

  const handleSaveEdit = useCallback((updated: EditableSession) => {
    setSessions(prev => {
      const newSessions = prev.map(s => s.id === updated.id ? (updated as Session) : s);
      newSessions.sort((a, b) => b.date.localeCompare(a.date));
      writeSessions(newSessions).then(() => { void writeBackup(); });
      return newSessions;
    });
    setEditModalOpen(false);
    setEditingSession(null);
  }, []);

  const handleEditFrames = useCallback((gameIndex: number) => {
    if (!editingSession) return;
    const game = editingSession.games[gameIndex];
    const priorScores = editingSession.games
      .slice(0, gameIndex)
      .map(g => g.score ?? 0)
      .join(',');
    const initialFrames = game?.frames ? JSON.stringify(game.frames) : '';
    pendingFrameEditRef.current = { session: editingSession, gameIndex };
    shouldPushFramesRef.current = { gameIndex, priorScores, initialFrames };
    setEditModalOpen(false);
  }, [editingSession]);

  const filtered =
    filter === 'all' ? sessions : sessions.filter((s) => s.type === filter);

  return (
    <>
      <View style={styles.container}>
        {/* Filter pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterBar}
          contentContainerStyle={styles.filterBarContent}
        >
          {FILTERS.map((f) => (
            <ScalePressable
              key={f.key}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFilter(f.key);
              }}
              style={[
                styles.filterPill,
                filter === f.key && styles.filterPillActive,
              ]}
            >
              <Text
                style={[
                  styles.filterPillText,
                  filter === f.key && styles.filterPillTextActive,
                ]}
              >
                {f.label}
              </Text>
            </ScalePressable>
          ))}
        </ScrollView>

        {/* Sessions list or empty state */}
        {!loaded ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color="#8E8E93" />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol name="list.bullet" size={48} color="#48484A" />
            <Text style={styles.emptyText}>{EMPTY_LABELS[filter]}</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <SessionCard session={item} onDelete={handleDelete} onEdit={handleEdit} />
            )}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 16 }]}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Settings modal */}
      <Modal
        visible={settingsOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <SettingsContent onClose={() => setSettingsOpen(false)} />
      </Modal>

      {/* Edit session modal */}
      <EditSessionModal
        session={editingSession}
        visible={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingSession(null);
        }}
        onSave={handleSaveEdit}
        onEditFrames={handleEditFrames}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  // Filter bar
  filterBar: {
    flexGrow: 0,
    paddingTop: 12,
  },
  filterBarContent: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 12,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#38383A',
  },
  filterPillActive: {
    backgroundColor: '#00CEC9',
    borderColor: '#00CEC9',
  },
  filterPillText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#000000',
    fontWeight: '600',
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 10,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    color: '#48484A',
    fontSize: 16,
    fontWeight: '500',
  },

  // Card
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 13,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLeft: {
    flex: 1,
    gap: 6,
  },
  cardDate: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  scoresRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gameScore: {
    fontSize: 18,
    fontWeight: '700',
  },
  seriesTotal: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Expanded
  expandedContent: {
    marginTop: 12,
  },
  expandDivider: {
    height: 0.5,
    backgroundColor: '#38383A',
    marginBottom: 12,
  },
  gameRow: {
    marginBottom: 12,
    gap: 4,
  },
  gameRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  gameLabel: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flex: 0,
  },
  gameExpandScore: {
    fontSize: 18,
    fontWeight: '700',
  },
  gameBall: {
    color: '#8E8E93',
    fontSize: 13,
    flex: 1,
    textAlign: 'right',
  },
  gameNotes: {
    color: '#8E8E93',
    fontSize: 13,
    fontStyle: 'italic',
  },

  // Frame grid
  frameGrid: {
    flexDirection: 'row',
    marginTop: 6,
    borderWidth: 0.5,
    borderColor: '#38383A',
    borderRadius: 6,
    overflow: 'hidden',
  },
  frameBox: {
    flex: 1,
    borderRightWidth: 0.5,
    borderRightColor: '#38383A',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  frameBoxWide: {
    flex: 1.4,
    borderRightWidth: 0,
  },
  frameThrows: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 2,
    minHeight: 16,
  },
  frameThrowChip: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  strikeChip: {
    color: '#00CEC9',
  },
  frameNumberRow: {
    marginTop: 2,
    borderTopWidth: 0.5,
    borderTopColor: '#38383A',
    width: '100%',
    alignItems: 'center',
    paddingTop: 2,
  },
  frameNumberText: {
    color: '#48484A',
    fontSize: 8,
  },

  // Mini pin diagram (inside FrameGrid frame boxes)
  miniDeck: {
    alignItems: 'center',
    gap: 1.5,
    marginVertical: 2,
  },
  miniRow: {
    flexDirection: 'row',
    gap: 1.5,
  },
  miniPin: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  miniPinUp: { backgroundColor: '#00CEC9' },
  miniPinDown: { backgroundColor: '#38383A' },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  statLabel: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 2,
  },
  statDivider: {
    width: 0.5,
    backgroundColor: '#38383A',
  },

  // Tournament block
  tournamentBlock: {
    marginBottom: 12,
    gap: 6,
  },
  tournamentName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  tournamentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  madeCutBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  madeCutText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  tournamentPlacement: {
    color: '#8E8E93',
    fontSize: 13,
  },

  // Session notes
  sessionNotes: {
    color: '#8E8E93',
    fontSize: 13,
    fontStyle: 'italic',
  },

  // Share
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#38383A',
  },
  shareButtonText: { fontSize: 14, fontWeight: '600', color: '#00CEC9' },
  offScreenCapture: {
    position: 'absolute',
    left: -10000,
    top: 0,
    backgroundColor: '#1C1C1E',
  },

  // Swipe actions
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingLeft: 8,
    gap: 8,
  },
  editAction: {
    backgroundColor: '#0A84FF',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 13,
  },
  deleteAction: {
    backgroundColor: '#FF453A',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 13,
  },
  swipeActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Gear button
  gearButton: {
    marginRight: 16,
  },

  // Settings modal
  modal: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383A',
  },
  doneText: {
    color: '#00CEC9',
    fontSize: 17,
    fontWeight: '600',
  },
});
