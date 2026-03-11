const fs = require('fs');
const path = require('path');

const content = `import { useState, useLayoutEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IconSymbol } from '@/components/ui/icon-symbol';

// --- Types ---
interface FrameEntry {
  throws: string[];
  note?: string | null;
  throwNotes?: Record<string, string | null>;
}

interface GameEntry {
  game: number;
  score: number | null;
  ball?: string | null;
  frames?: FrameEntry[] | null;
  notes?: string | null;
}

interface Session {
  id: number | string;
  type: string;
  date: string;
  games: GameEntry[];
  [key: string]: unknown;
}

interface Settings {
  seasonStart?: string | null;
  seasonEnd?: string | null;
}

interface FrameStats {
  strikeRate: number;
  spareRate: number;
  opensPerGame: number;
}

interface Metrics {
  avg: number;
  highGame: number;
  highSeries: number;
  frameStats: FrameStats | null;
  gameCount: number;
  sessionCount: number;
}

type ToggleMode = 'season' | 'alltime';

// --- Helpers ---
function avgColor(avg: number): string {
  if (avg >= 180) return '#30D158';
  if (avg >= 166) return '#FF9F0A';
  return '#FF453A';
}

function filterSessions(
  sessions: Session[],
  mode: ToggleMode,
  settings: Settings | null,
): Session[] {
  if (mode === 'alltime' || !settings?.seasonStart || !settings?.seasonEnd) {
    return sessions;
  }
  return sessions.filter(s => s.date >= settings.seasonStart! && s.date <= settings.seasonEnd!);
}

function calcMetrics(sessions: Session[]): Metrics | null {
  if (sessions.length === 0) return null;

  const allGames = sessions.flatMap(s =>
    s.games.filter(g => g.score != null),
  );
  if (allGames.length === 0) return null;

  const scores = allGames.map(g => g.score as number);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const highGame = Math.max(...scores);

  let highSeries = 0;
  for (const s of sessions) {
    const total = s.games
      .filter(g => g.score != null)
      .reduce((sum, g) => sum + (g.score as number), 0);
    if (total > highSeries) highSeries = total;
  }

  // Frame stats — only from games that actually have frame data
  const gamesWithFrames = allGames.filter(
    g => Array.isArray(g.frames) && (g.frames as FrameEntry[]).length > 0,
  );

  let frameStats: FrameStats | null = null;
  if (gamesWithFrames.length > 0) {
    let totalFrames = 0;
    let strikes = 0;
    let spareOpps = 0;
    let spares = 0;
    let opens = 0;

    for (const g of gamesWithFrames) {
      // Frames 1-9 only for strike/spare/open calculation
      const scoringFrames = (g.frames as FrameEntry[]).slice(0, 9);
      for (const f of scoringFrames) {
        totalFrames++;
        if (f.throws[0] === 'X') {
          strikes++;
        } else {
          spareOpps++;
          if (f.throws[1] === '/') {
            spares++;
          } else {
            opens++;
          }
        }
      }
    }

    frameStats = {
      strikeRate: totalFrames > 0 ? (strikes / totalFrames) * 100 : 0,
      spareRate: spareOpps > 0 ? (spares / spareOpps) * 100 : 0,
      opensPerGame: gamesWithFrames.length > 0 ? opens / gamesWithFrames.length : 0,
    };
  }

  return { avg, highGame, highSeries, frameStats, gameCount: allGames.length, sessionCount: sessions.length };
}

const NA_LABELS = ['Strike %', 'Spare %', 'Opens/Game'] as const;

// --- Component ---
export default function StatsScreen() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toggle, setToggle] = useState<ToggleMode>('season');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
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
      let active = true;
      (async () => {
        setLoading(true);
        const [sRaw, stRaw] = await Promise.all([
          AsyncStorage.getItem('mbowl_sessions_v1'),
          AsyncStorage.getItem('mbowl_settings_v1'),
        ]);
        if (active) {
          setSessions(sRaw ? JSON.parse(sRaw) : []);
          setSettings(stRaw ? JSON.parse(stRaw) : null);
          setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const hasSeasonDates = !!(settings?.seasonStart && settings?.seasonEnd);
  const filtered = filterSessions(sessions, toggle, settings);
  const metrics = calcMetrics(filtered);

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Season Toggle */}
        <View style={styles.toggleSection}>
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleBtn, toggle === 'season' && styles.toggleBtnActive]}
              onPress={() => setToggle('season')}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleText, toggle === 'season' && styles.toggleTextActive]}>
                Current Season
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, toggle === 'alltime' && styles.toggleBtnActive]}
              onPress={() => setToggle('alltime')}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleText, toggle === 'alltime' && styles.toggleTextActive]}>
                All-Time
              </Text>
            </TouchableOpacity>
          </View>
          {toggle === 'season' && !hasSeasonDates && (
            <Text style={styles.noSeasonHint}>No season dates set — showing all sessions</Text>
          )}
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#00CEC9" size="large" />
          </View>
        ) : !metrics ? (
          <View style={styles.centered}>
            <IconSymbol name="chart.bar.fill" size={52} color="#48484A" />
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptySubtitle}>Log your first session to see stats here.</Text>
          </View>
        ) : (
          <>
            {/* Overall Average — hero */}
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>Overall Average</Text>
              <Text style={[styles.heroNumber, { color: avgColor(metrics.avg) }]}>
                {metrics.avg.toFixed(1)}
              </Text>
              <Text style={styles.heroMeta}>
                {metrics.gameCount} games · {metrics.sessionCount} sessions
              </Text>
            </View>

            {/* High Game + High Series */}
            <View style={styles.row2}>
              <View style={[styles.card, styles.flex1]}>
                <Text style={styles.cardLabel}>High Game</Text>
                <Text style={styles.cardNumber}>{metrics.highGame}</Text>
              </View>
              <View style={[styles.card, styles.flex1]}>
                <Text style={styles.cardLabel}>High Series</Text>
                <Text style={styles.cardNumber}>{metrics.highSeries}</Text>
              </View>
            </View>

            {/* Strike % + Spare % + Opens/Game */}
            {metrics.frameStats ? (
              <View style={styles.row3}>
                <View style={[styles.card, styles.flex1]}>
                  <Text style={styles.cardLabel}>Strike %</Text>
                  <Text style={styles.cardNumber}>
                    {metrics.frameStats.strikeRate.toFixed(1)}%
                  </Text>
                </View>
                <View style={[styles.card, styles.flex1]}>
                  <Text style={styles.cardLabel}>Spare %</Text>
                  <Text style={styles.cardNumber}>
                    {metrics.frameStats.spareRate.toFixed(1)}%
                  </Text>
                </View>
                <View style={[styles.card, styles.flex1]}>
                  <Text style={styles.cardLabel}>Opens/Game</Text>
                  <Text style={styles.cardNumber}>
                    {metrics.frameStats.opensPerGame.toFixed(1)}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.row3}>
                {NA_LABELS.map(label => (
                  <View key={label} style={[styles.card, styles.flex1, styles.naCard]}>
                    <Text style={styles.cardLabel}>{label}</Text>
                    <IconSymbol name="lock.fill" size={18} color="#48484A" />
                    <Text style={styles.naText}>Log frames to unlock.</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Settings Modal */}
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
  scroll: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  // Toggle
  toggleSection: {
    marginBottom: 20,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    padding: 3,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#00CEC9',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  toggleTextActive: {
    color: '#000000',
  },
  noSeasonHint: {
    color: '#8E8E93',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  // States
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: '#8E8E93',
    fontSize: 15,
    textAlign: 'center',
  },
  // Hero
  heroCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 13,
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
  },
  heroLabel: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  heroNumber: {
    fontSize: 64,
    fontWeight: '700',
    lineHeight: 72,
  },
  heroMeta: {
    color: '#8E8E93',
    fontSize: 13,
    marginTop: 6,
  },
  // Cards
  row2: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  row3: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 13,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex1: {
    flex: 1,
  },
  cardLabel: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
    textAlign: 'center',
  },
  cardNumber: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  // NA state
  naCard: {
    gap: 6,
    paddingVertical: 18,
  },
  naText: {
    color: '#48484A',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },
  // Gear / modal
  gearButton: {
    marginRight: 16,
  },
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
`;

const outPath = path.join('C:', 'Users', 'marcus', 'Desktop', 'mBowl', 'app', '(tabs)', 'stats.tsx');
fs.writeFileSync(outPath, content, 'utf8');
console.log('Written: ' + outPath);
