import { useState, useLayoutEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IconSymbol } from '@/components/ui/icon-symbol';

const SESSIONS_KEY = 'mbowl_sessions_v1';

type FrameEntry = {
  throws: string[];
  note: string | null;
  throwNotes: Record<string, string | null>;
};

type GameEntry = {
  game: number;
  score: number;
  ball: string | null;
  frames: FrameEntry[] | null;
  notes: string | null;
};

type Session = {
  id: number | string;
  type: 'league' | 'makeup' | 'tournament' | 'practice';
  date: string;
  week: number | null;
  opponent: string | null;
  name: string | null;
  format: string | null;
  pattern: string | null;
  madeCut: 'Yes' | 'No' | 'N/A' | null;
  placement: string | null;
  games: GameEntry[];
  notes: string | null;
};

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
  if (!games.length) return 0;
  return games.reduce((sum, g) => sum + g.score, 0) / games.length;
}

function seriesTotal(games: GameEntry[]): number {
  return games.reduce((sum, g) => sum + g.score, 0);
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

function FrameGrid({ frames }: { frames: FrameEntry[] }) {
  return (
    <View style={styles.frameGrid}>
      {frames.slice(0, 10).map((frame, fi) => {
        const is10th = fi === 9;
        const throws = is10th ? frame.throws.slice(0, 3) : frame.throws.slice(0, 2);
        return (
          <View key={fi} style={[styles.frameBox, is10th && styles.frameBoxWide]}>
            <View style={styles.frameThrows}>
              {throws.map((t, ti) => (
                <Text key={ti} style={[styles.frameThrowChip, t === 'X' && styles.strikeChip]}>
                  {t}
                </Text>
              ))}
            </View>
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

function SessionCard({
  session,
  onDelete,
}: {
  session: Session;
  onDelete: (id: number | string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const swipeRef = useRef<Swipeable>(null);
  const avg = sessionAvg(session.games);
  const series = seriesTotal(session.games);
  const isPractice = session.type === 'practice';
  const frameStats = expanded ? calcFrameStats(session.games) : null;

  const renderRightActions = () => (
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
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              onDelete(session.id);
            },
          },
        ]);
      }}
    >
      <Text style={styles.deleteActionText}>Delete</Text>
    </TouchableOpacity>
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
              {session.games.map((g, i) => (
                <Text key={i} style={[styles.gameScore, { color: scoreColor(g.score, avg) }]}>
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
                    style={[styles.gameExpandScore, { color: scoreColor(g.score, avg) }]}
                  >
                    {g.score}
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
  const navigation = useNavigation();

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

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(SESSIONS_KEY).then((raw) => {
        if (!raw) {
          setSessions([]);
          return;
        }
        const all = JSON.parse(raw) as Session[];
        all.sort((a, b) => b.date.localeCompare(a.date));
        setSessions(all);
      });
    }, [])
  );

  const handleDelete = useCallback((id: number | string) => {
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

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
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
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
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Sessions list or empty state */}
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol name="list.bullet" size={48} color="#48484A" />
            <Text style={styles.emptyText}>{EMPTY_LABELS[filter]}</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <SessionCard session={item} onDelete={handleDelete} />
            )}
            contentContainerStyle={styles.listContent}
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
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSettingsOpen(false)}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
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

  // Swipe delete action
  deleteAction: {
    backgroundColor: '#FF453A',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 13,
    marginLeft: 8,
  },
  deleteActionText: {
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
