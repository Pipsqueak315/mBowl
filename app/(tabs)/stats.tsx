import { useState, useLayoutEffect, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import SettingsContent from '@/components/SettingsContent';
import { LineChart } from 'react-native-chart-kit';
import { readSessions, readSettings } from '@/src/storage';
import type { GameEntry, Session, Settings, ThrowEntry } from '@/src/types';
import { IconSymbol } from '@/components/ui/icon-symbol';
import ScalePressable from '@/components/ScalePressable';
import { computeLeaveStats } from '@/src/leaveUtils';

// --- Types ---
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

interface ChartPoint {
  labels: string[];
  data: number[];
}

type ToggleMode = 'season' | 'alltime';

interface LeaveEntry {
  pins: number[];
  name: string;
  count: number;
  converted: number;
  conversionPct: number;
  isSplit: boolean;
}

interface BallStat {
  ball: string;
  count: number;
  avg: number;
}

interface HistBucket {
  label: string;
  count: number;
}

// --- Chart Config (defined outside component — stable reference) ---
const CHART_CONFIG = {
  backgroundColor: '#1C1C1E',
  backgroundGradientFrom: '#1C1C1E',
  backgroundGradientTo: '#1C1C1E',
  decimalPlaces: 0,
  color: (opacity = 1) => 'rgba(0, 206, 201, ' + String(opacity) + ')',
  labelColor: (opacity = 1) => 'rgba(142, 142, 147, ' + String(opacity) + ')',
  propsForDots: {
    r: '4',
    strokeWidth: '2',
    stroke: '#00CEC9',
    fill: '#1C1C1E',
  },
  propsForBackgroundLines: {
    stroke: '#38383A',
    strokeDasharray: '',
  },
};

// --- Leave stats helpers ---
const LEAVE_PIN_ROWS: number[][] = [[6, 7, 8, 9], [3, 4, 5], [1, 2], [0]];

function conversionColor(pct: number): string {
  if (pct >= 80) return '#30D158';
  if (pct >= 60) return '#FF9F0A';
  return '#FF453A';
}

function LeaveMiniPinDeck({ pins }: { pins: number[] }) {
  const pinSet = new Set(pins);
  return (
    <View style={styles.leaveDeck}>
      {LEAVE_PIN_ROWS.map((row, ri) => (
        <View key={ri} style={styles.leaveRow}>
          {row.map(idx => (
            <View
              key={idx}
              style={[styles.leavePin, pinSet.has(idx + 1) ? styles.leavePinUp : styles.leavePinDown]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function LeaveRow({ leave, showBorder }: { leave: LeaveEntry; showBorder: boolean }) {
  return (
    <View style={[styles.leaveListRow, showBorder && styles.leaveListRowBorder]}>
      <LeaveMiniPinDeck pins={leave.pins} />
      <View style={styles.leaveInfo}>
        <View style={styles.leaveNameRow}>
          <Text style={styles.leaveName}>{leave.name}</Text>
          {leave.isSplit && <Text style={styles.splitBadge}>SPLIT</Text>}
        </View>
        <Text style={styles.leaveCount}>× {leave.count}</Text>
      </View>
      <Text style={[styles.leaveConvPct, { color: conversionColor(leave.conversionPct) }]}>
        {Math.round(leave.conversionPct)}%
      </Text>
    </View>
  );
}

// --- Helpers ---
function avgColor(avg: number): string {
  if (avg >= 180) return '#30D158';
  if (avg >= 166) return '#FF9F0A';
  return '#FF453A';
}

function formatDateLabel(date: string): string {
  const p = date.split('-');
  return parseInt(p[1]) + '/' + parseInt(p[2]);
}

function filterSessions(
  sessions: Session[],
  mode: ToggleMode,
  settings: Settings,
): Session[] {
  if (mode === 'alltime' || !settings?.seasonStart || !settings?.seasonEnd) {
    return sessions;
  }
  return sessions.filter(
    s => s.date >= settings.seasonStart! && s.date <= settings.seasonEnd!,
  );
}

function calcMetrics(sessions: Session[]): Metrics | null {
  if (sessions.length === 0) return null;

  const allGames = sessions.flatMap(s => s.games.filter(g => g.score != null));
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

  const gamesWithFrames = allGames.filter(
    g => Array.isArray(g.frames) && g.frames.length > 0,
  );

  let frameStats: FrameStats | null = null;
  if (gamesWithFrames.length > 0) {
    let totalFrames = 0, strikes = 0, spareOpps = 0, spares = 0, opens = 0;
    for (const g of gamesWithFrames) {
      const scoringFrames = g.frames!.slice(0, 9);
      for (const f of scoringFrames) {
        totalFrames++;
        if (f.throws[0] === 'X') {
          strikes++;
        } else {
          spareOpps++;
          if (f.throws[1] === '/') spares++;
          else opens++;
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

// Build series-per-session data (one point per session, chronological)
function buildSeriesData(sessions: Session[]): ChartPoint | null {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const labels: string[] = [];
  const data: number[] = [];

  sorted.forEach((s, i) => {
    const total = s.games
      .filter(g => g.score != null)
      .reduce((sum, g) => sum + (g.score as number), 0);
    if (total > 0) {
      // Show date label every 3rd session so labels don't crowd
      labels.push(i % 3 === 0 ? formatDateLabel(s.date) : '');
      data.push(total);
    }
  });

  if (data.length < 2) return null;
  return { labels, data };
}

// Build game-by-game data (every individual game in chronological order)
function buildGameData(sessions: Session[]): ChartPoint | null {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const data: number[] = [];
  const labels: string[] = [];

  for (const s of sorted) {
    s.games.filter(g => g.score != null).forEach(g => {
      data.push(g.score as number);
      labels.push('');
    });
  }

  if (data.length < 2) return null;
  return { labels, data };
}

// --- Score Distribution ---
const HIST_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '100–119', min: 100, max: 119 },
  { label: '120–139', min: 120, max: 139 },
  { label: '140–159', min: 140, max: 159 },
  { label: '160–179', min: 160, max: 179 },
  { label: '180–199', min: 180, max: 199 },
  { label: '200–219', min: 200, max: 219 },
  { label: '220–239', min: 220, max: 239 },
  { label: '240–259', min: 240, max: 259 },
  { label: '260–279', min: 260, max: 279 },
  { label: '280–300', min: 280, max: 300 },
];

function buildHistogram(sessions: Session[]): HistBucket[] {
  const counts = HIST_BUCKETS.map(b => ({ label: b.label, min: b.min, max: b.max, count: 0 }));
  for (const s of sessions) {
    for (const g of s.games) {
      if (g.score == null) continue;
      const score = g.score as number;
      const bucket = counts.find(b => score >= b.min && score <= b.max);
      if (bucket) bucket.count++;
    }
  }
  return counts.map(({ label, count }) => ({ label, count }));
}

// --- Per-Ball Performance ---
function buildBallStats(sessions: Session[]): BallStat[] {
  const ballMap: Record<string, { sum: number; count: number }> = {};
  for (const s of sessions) {
    for (const g of s.games) {
      if (g.score == null || !g.ball) continue;
      const ball = g.ball as string;
      if (!ballMap[ball]) ballMap[ball] = { sum: 0, count: 0 };
      ballMap[ball].sum += g.score as number;
      ballMap[ball].count++;
    }
  }
  return Object.entries(ballMap)
    .map(([ball, { sum, count }]) => ({ ball, count, avg: sum / count }))
    .sort((a, b) => b.avg - a.avg);
}

// --- Game-by-Game Performance ---
// Games 1–3 stay as individual rows; games 4 and beyond collapse into one
// "Game 4+" bucket (aggregate average, combined count). key 4 == the bucket.
interface GamePositionStat {
  key: number;
  label: string;
  avg: number;
  count: number;
}

function buildGameByGameStats(sessions: Session[]): GamePositionStat[] {
  const map: Record<number, { sum: number; count: number }> = {};
  for (const s of sessions) {
    for (const g of s.games) {
      if (g.score == null) continue;
      const key = g.game >= 4 ? 4 : g.game;
      if (!map[key]) map[key] = { sum: 0, count: 0 };
      map[key].sum += g.score as number;
      map[key].count++;
    }
  }
  return Object.entries(map)
    .map(([k, { sum, count }]) => {
      const key = parseInt(k, 10);
      return { key, label: key >= 4 ? 'Game 4+' : `Game ${key}`, avg: sum / count, count };
    })
    .sort((a, b) => a.key - b.key);
}

// --- Advanced frame-derived stats (all read-time, no persistence) ---
interface AdvancedStats {
  firstBallAvg: number | null;   // mean pins on throw 1 across frames with throw data
  bounceBackPct: number | null;  // of frames after an open, % that scored a mark
  doublesPct: number | null;     // of strike balls with a successor, % followed by a strike
  cleanGames: number;            // games with zero open frames (N)
  gamesWithFrames: number;       // games that have frame data (M)
}

// Pins knocked down on the first throw of a frame, or null if unreadable.
// '—' (em dash, U+2014) is the gutter/miss token used throughout the app and by
// the scorer (log-frames.tsx pinsForThrow) — it must count as 0, not be skipped.
function firstBallPins(t: string): number | null {
  if (t === 'X') return 10;
  if (t === '—' || t === '-') return 0;
  const n = parseInt(t, 10);
  return isNaN(n) ? null : n;
}

const frameIsStrike = (f: ThrowEntry): boolean => f.throws[0] === 'X';
const frameIsSpare = (f: ThrowEntry): boolean => f.throws[1] === '/';
const frameIsMark = (f: ThrowEntry): boolean => frameIsStrike(f) || frameIsSpare(f);
// A completed non-mark frame: first ball not a strike, second ball present and
// not a spare. Works for the 10th frame too ('9','-' is open; '9','/' is not).
const frameIsOpen = (f: ThrowEntry): boolean =>
  f.throws[0] !== 'X' && f.throws[1] != null && f.throws[1] !== '/';

function calcAdvancedStats(sessions: Session[]): AdvancedStats {
  let firstBallTotal = 0, firstBallCount = 0;
  let bounceOpp = 0, bounceHit = 0;
  let doubleOpp = 0, doubleHit = 0;
  let cleanGames = 0, gamesWithFrames = 0;

  for (const s of sessions) {
    for (const g of s.games) {
      if (!Array.isArray(g.frames) || g.frames.length === 0) continue;
      const frames = g.frames;
      gamesWithFrames++;

      // First ball average — every frame's first throw, including the 10th.
      for (const f of frames) {
        if (!f || !Array.isArray(f.throws) || f.throws.length === 0) continue;
        const pins = firstBallPins(f.throws[0]);
        if (pins != null) { firstBallTotal += pins; firstBallCount++; }
      }

      // Clean game — no open frame anywhere in the game.
      let hasOpen = false;
      for (const f of frames) {
        if (f && frameIsOpen(f)) { hasOpen = true; break; }
      }
      if (!hasOpen) cleanGames++;

      // Bounce-back — frame following an open frame that scored a mark.
      // Anchors are frames 1–9 (they must have a following frame in the game);
      // pairs never cross the game boundary.
      for (let i = 0; i < frames.length - 1 && i < 9; i++) {
        const f = frames[i];
        const next = frames[i + 1];
        if (!f || !next) continue;
        if (frameIsOpen(f)) {
          bounceOpp++;
          if (frameIsMark(next)) bounceHit++;
        }
      }

      // Doubles — consecutive strikes across the game's flat ball sequence.
      // Building the sequence (not comparing frame[i]/frame[i+1]) is what makes
      // the 10th frame's multiple strikes count correctly (X X X → two doubles),
      // while a strike with no successor ball is never counted.
      const balls: string[] = [];
      for (let i = 0; i < frames.length && i < 9; i++) {
        const t = frames[i]?.throws ?? [];
        if (t[0] === 'X') {
          balls.push('X');
        } else {
          if (t[0] != null) balls.push(t[0]);
          if (t[1] != null) balls.push(t[1]);
        }
      }
      if (frames[9] && Array.isArray(frames[9].throws)) {
        for (const t of frames[9].throws.slice(0, 3)) balls.push(t);
      }
      for (let k = 0; k < balls.length - 1; k++) {
        if (balls[k] === 'X') {
          doubleOpp++;
          if (balls[k + 1] === 'X') doubleHit++;
        }
      }
    }
  }

  return {
    firstBallAvg: firstBallCount > 0 ? firstBallTotal / firstBallCount : null,
    bounceBackPct: bounceOpp > 0 ? (bounceHit / bounceOpp) * 100 : null,
    doublesPct: doubleOpp > 0 ? (doubleHit / doubleOpp) * 100 : null,
    cleanGames,
    gamesWithFrames,
  };
}

// --- Leaves sort ---
const LEAVE_SORTS = [
  { key: 'frequency', label: 'Frequency' },
  { key: 'opportunity', label: 'Opportunity' },
  { key: 'conv', label: 'Conv %' },
] as const;
type LeaveSort = (typeof LEAVE_SORTS)[number]['key'];

const NA_LABELS = ['Strike %', 'Spare %', 'Opens/Game'] as const;

// Small stat cell matching the Strike%/Spare%/Opens row exactly. White value,
// no colour thresholds; null value renders the shared "Log frames to unlock" N/A.
function StatCell({ label, value }: { label: string; value: string | null }) {
  if (value == null) {
    return (
      <View style={[styles.card, styles.flex1, styles.naCard]}>
        <Text style={styles.cardLabel}>{label}</Text>
        <IconSymbol name="lock.fill" size={18} color="#48484A" />
        <Text style={styles.naText}>Log frames to unlock.</Text>
      </View>
    );
  }
  return (
    <View style={[styles.card, styles.flex1]}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardNumber}>{value}</Text>
    </View>
  );
}

// --- Component ---
export default function StatsScreen() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toggle, setToggle] = useState<ToggleMode>('season');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [showAllLeaves, setShowAllLeaves] = useState(false);
  const [leaveSort, setLeaveSort] = useState<LeaveSort>('frequency');
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  // Chart fills the card edge-to-edge; card sits inside 16px scroll padding each side
  const chartWidth = width - 32;

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
      // Leaves sort has no persisted preference — reset to Frequency each visit.
      setLeaveSort('frequency');
      (async () => {
        setLoading(true);
        const [sessionsData, settingsData] = await Promise.all([
          readSessions(),
          readSettings(),
        ]);
        if (active) {
          setSessions(sessionsData);
          setSettings(settingsData);
          setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const hasSeasonDates = !!(settings?.seasonStart && settings?.seasonEnd);
  const filtered = useMemo(
    () => filterSessions(sessions, toggle, settings),
    [sessions, toggle, settings],
  );
  const metrics = useMemo(() => calcMetrics(filtered), [filtered]);
  const seriesChartPoint = useMemo(
    () => (metrics ? buildSeriesData(filtered) : null),
    [metrics, filtered],
  );
  const gameChartPoint = useMemo(
    () => (metrics ? buildGameData(filtered) : null),
    [metrics, filtered],
  );
  const leaveStats = useMemo<{
    leaves: LeaveEntry[];
    hasPinData: boolean;
    makeableSparePct: number | null;
    makeableCount: number;
  }>(
    () =>
      computeLeaveStats(filtered) as {
        leaves: LeaveEntry[];
        hasPinData: boolean;
        makeableSparePct: number | null;
        makeableCount: number;
      },
    [filtered],
  );
  const histogram = useMemo<HistBucket[]>(() => buildHistogram(filtered), [filtered]);
  const ballStats = useMemo<BallStat[]>(() => buildBallStats(filtered), [filtered]);
  const gameByGameStats = useMemo<GamePositionStat[]>(() => buildGameByGameStats(filtered), [filtered]);
  const advancedStats = useMemo<AdvancedStats>(() => calcAdvancedStats(filtered), [filtered]);

  // Leaves sorted by the active toggle. Opportunity = count × (1 − conversion
  // rate) = the raw number of missed makeable chances. No persisted preference.
  const sortedLeaves = useMemo<LeaveEntry[]>(() => {
    const arr = [...leaveStats.leaves];
    if (leaveSort === 'opportunity') {
      arr.sort((a, b) => {
        const oa = a.count * (1 - a.conversionPct / 100);
        const ob = b.count * (1 - b.conversionPct / 100);
        return ob - oa || b.count - a.count;
      });
    } else if (leaveSort === 'conv') {
      arr.sort((a, b) => b.conversionPct - a.conversionPct || b.count - a.count);
    } else {
      arr.sort((a, b) => b.count - a.count);
    }
    return arr;
  }, [leaveStats.leaves, leaveSort]);

  // Goal deltas — memoized so they don't recalculate on every render
  const avgGoalDelta = useMemo(() => {
    const target = settings.targetAverage;
    if (target == null || !metrics) return null;
    const diff = metrics.avg - target;
    if (Math.abs(diff) <= 0.5) return { text: 'On target', color: '#00CEC9' };
    if (diff > 0) return { text: `+${diff.toFixed(1)} above target`, color: '#30D158' };
    return { text: `${diff.toFixed(1)} below target`, color: '#FF453A' };
  }, [metrics, settings.targetAverage]);

  const seriesGoalDelta = useMemo(() => {
    const target = settings.targetSeries;
    if (target == null || !metrics) return null;
    const diff = metrics.highSeries - target;
    if (diff === 0) return { text: 'On target', color: '#00CEC9' };
    if (diff > 0) return { text: `+${diff} above target`, color: '#30D158' };
    return { text: `${diff} below target`, color: '#FF453A' };
  }, [metrics, settings.targetSeries]);

  useEffect(() => { setShowAllLeaves(false); }, [filtered]);

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
            <ScalePressable
              style={[styles.toggleBtn, toggle === 'season' && styles.toggleBtnActive]}
              onPress={() => setToggle('season')}
            >
              <Text style={[styles.toggleText, toggle === 'season' && styles.toggleTextActive]}>
                Current Season
              </Text>
            </ScalePressable>
            <ScalePressable
              style={[styles.toggleBtn, toggle === 'alltime' && styles.toggleBtnActive]}
              onPress={() => setToggle('alltime')}
            >
              <Text style={[styles.toggleText, toggle === 'alltime' && styles.toggleTextActive]}>
                All-Time
              </Text>
            </ScalePressable>
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
              {avgGoalDelta && (
                <Text style={[styles.heroGoalDelta, { color: avgGoalDelta.color }]}>
                  {avgGoalDelta.text}
                </Text>
              )}
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
                {seriesGoalDelta && (
                  <Text style={[styles.cardGoalDelta, { color: seriesGoalDelta.color }]}>
                    {seriesGoalDelta.text}
                  </Text>
                )}
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

            {/* First Ball Avg + Bounce-Back % + Doubles % — white values, no thresholds yet */}
            <View style={styles.row3}>
              <StatCell
                label="First Ball Avg"
                value={advancedStats.firstBallAvg != null ? advancedStats.firstBallAvg.toFixed(1) : null}
              />
              <StatCell
                label="Bounce-Back %"
                value={advancedStats.bounceBackPct != null ? `${Math.round(advancedStats.bounceBackPct)}%` : null}
              />
              <StatCell
                label="Doubles %"
                value={advancedStats.doublesPct != null ? `${Math.round(advancedStats.doublesPct)}%` : null}
              />
            </View>

            {/* Makeable Spare % + Clean Games */}
            <View style={styles.row2}>
              {/* Makeable Spare % — pin-data gated, splits excluded from denominator */}
              {!leaveStats.hasPinData ? (
                <View style={[styles.card, styles.flex1, styles.naCard]}>
                  <Text style={styles.cardLabel}>Makeable Spare %</Text>
                  <IconSymbol name="lock.fill" size={18} color="#48484A" />
                  <Text style={styles.naText}>Log frames with pin tracking to unlock.</Text>
                </View>
              ) : (
                <View style={[styles.card, styles.flex1]}>
                  <Text style={styles.cardLabel}>Makeable Spare %</Text>
                  <Text
                    style={[
                      styles.cardNumber,
                      {
                        color:
                          leaveStats.makeableSparePct != null
                            ? conversionColor(leaveStats.makeableSparePct)
                            : '#FFFFFF',
                      },
                    ]}
                  >
                    {leaveStats.makeableSparePct != null
                      ? `${Math.round(leaveStats.makeableSparePct)}%`
                      : '—'}
                  </Text>
                  <Text style={styles.makeableSub}>
                    {leaveStats.makeableSparePct != null
                      ? `Splits excluded · ${leaveStats.makeableCount} makeable`
                      : 'No makeable leaves yet'}
                  </Text>
                </View>
              )}

              {/* Clean Games — games with zero open frames; white value only */}
              {advancedStats.gamesWithFrames === 0 ? (
                <View style={[styles.card, styles.flex1, styles.naCard]}>
                  <Text style={styles.cardLabel}>Clean Games</Text>
                  <IconSymbol name="lock.fill" size={18} color="#48484A" />
                  <Text style={styles.naText}>Log frames to unlock.</Text>
                </View>
              ) : (
                <View style={[styles.card, styles.flex1]}>
                  <Text style={styles.cardLabel}>Clean Games</Text>
                  <Text style={styles.cardNumber}>
                    {advancedStats.cleanGames} of {advancedStats.gamesWithFrames}
                  </Text>
                </View>
              )}
            </View>

            {/* Series Trend Chart */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Series Trend</Text>
              {seriesChartPoint ? (
                <LineChart
                  data={{
                    labels: seriesChartPoint.labels,
                    datasets: [{ data: seriesChartPoint.data, strokeWidth: 2 }],
                  }}
                  width={chartWidth}
                  height={180}
                  chartConfig={CHART_CONFIG}
                  bezier
                  withInnerLines
                  withOuterLines={false}
                  style={styles.chart}
                />
              ) : (
                <View style={styles.chartEmpty}>
                  <Text style={styles.chartEmptyText}>Need at least 2 sessions to show trend</Text>
                </View>
              )}
            </View>

            {/* Game-by-Game Trend Chart */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Game-by-Game Trend</Text>
              {gameChartPoint ? (
                <LineChart
                  data={{
                    labels: gameChartPoint.labels,
                    datasets: [{ data: gameChartPoint.data, strokeWidth: 2 }],
                  }}
                  width={chartWidth}
                  height={180}
                  chartConfig={CHART_CONFIG}
                  bezier
                  withDots={false}
                  withInnerLines
                  withOuterLines={false}
                  withVerticalLabels={false}
                  style={styles.chart}
                />
              ) : (
                <View style={styles.chartEmpty}>
                  <Text style={styles.chartEmptyText}>Need at least 2 games to show trend</Text>
                </View>
              )}
            </View>

            {/* Score Distribution */}
            {(() => {
              const histTotal = histogram.reduce((s, b) => s + b.count, 0);
              const maxCount = histogram.reduce((m, b) => Math.max(m, b.count), 0);
              if (histTotal === 0) {
                return (
                  <View style={[styles.card, styles.naCard, styles.leavesNaCard]}>
                    <Text style={styles.cardLabel}>Score Distribution</Text>
                    <IconSymbol name="lock.fill" size={18} color="#48484A" />
                    <Text style={styles.naText}>No game scores in range to display.</Text>
                  </View>
                );
              }
              return (
                <View style={styles.histCard}>
                  <Text style={styles.histTitle}>Score Distribution</Text>
                  {histogram.map(bucket => {
                    const barPct = maxCount > 0 ? bucket.count / maxCount : 0;
                    return (
                      <View key={bucket.label} style={styles.histRow}>
                        <Text style={styles.histLabel}>{bucket.label}</Text>
                        <View style={styles.histBarTrack}>
                          <View
                            style={[
                              styles.histBar,
                              { width: barPct > 0 ? `${Math.max(barPct * 100, 2)}%` : 0 },
                            ]}
                          />
                        </View>
                        <Text style={styles.histCount}>
                          {bucket.count > 0 ? bucket.count : ''}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              );
            })()}

            {/* By Ball */}
            {ballStats.length === 0 ? (
              <View style={[styles.card, styles.naCard, styles.leavesNaCard]}>
                <Text style={styles.cardLabel}>By Ball</Text>
                <Text style={styles.naText}>No ball data logged yet.</Text>
              </View>
            ) : (
              <View style={styles.leavesCard}>
                <Text style={styles.leavesTitle}>By Ball</Text>
                {ballStats.map((bs, i) => (
                  <View
                    key={bs.ball}
                    style={[styles.ballStatRow, i > 0 && styles.leaveListRowBorder]}
                  >
                    <View style={styles.ballStatInfo}>
                      <Text style={styles.ballStatName}>{bs.ball}</Text>
                      <Text style={styles.ballStatCount}>{bs.count} game{bs.count !== 1 ? 's' : ''}</Text>
                    </View>
                    <Text style={[styles.ballStatAvg, { color: avgColor(bs.avg) }]}>
                      {bs.avg.toFixed(1)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* By Game Number */}
            {gameByGameStats.length === 0 ? (
              <View style={[styles.card, styles.naCard, styles.leavesNaCard]}>
                <Text style={styles.cardLabel}>By Game Number</Text>
                <IconSymbol name="lock.fill" size={18} color="#48484A" />
                <Text style={styles.naText}>Log a session to see game-by-game trends.</Text>
              </View>
            ) : (
              <View style={styles.leavesCard}>
                <Text style={styles.leavesTitle}>By Game Number</Text>
                {gameByGameStats.map((gs, i) => (
                  <View
                    key={gs.key}
                    style={[styles.ballStatRow, i > 0 && styles.leaveListRowBorder]}
                  >
                    <View style={styles.ballStatInfo}>
                      <Text style={styles.ballStatName}>{gs.label}</Text>
                      <Text style={styles.ballStatCount}>{gs.count} game{gs.count !== 1 ? 's' : ''}</Text>
                    </View>
                    <Text style={[styles.ballStatAvg, { color: avgColor(gs.avg) }]}>
                      {gs.avg.toFixed(1)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Leaves — single merged card: sort toggle, top 6, Show All expander */}
            {!leaveStats.hasPinData ? (
              <View style={[styles.card, styles.naCard, styles.leavesNaCard]}>
                <Text style={styles.cardLabel}>Leaves</Text>
                <IconSymbol name="lock.fill" size={18} color="#48484A" />
                <Text style={styles.naText}>Log frames with pin tracking to unlock.</Text>
              </View>
            ) : leaveStats.leaves.length === 0 ? (
              <View style={[styles.card, styles.naCard, styles.leavesNaCard]}>
                <Text style={styles.cardLabel}>Leaves</Text>
                <Text style={styles.naText}>No leaves recorded — all strikes!</Text>
              </View>
            ) : (
              <View style={styles.leavesCard}>
                <Text style={styles.leavesTitle}>Leaves</Text>
                <View style={styles.sortRow}>
                  {LEAVE_SORTS.map(s => (
                    <TouchableOpacity
                      key={s.key}
                      style={[styles.sortChip, leaveSort === s.key && styles.sortChipActive]}
                      onPress={() => setLeaveSort(s.key)}
                    >
                      <Text
                        style={[styles.sortChipText, leaveSort === s.key && styles.sortChipTextActive]}
                      >
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {(showAllLeaves ? sortedLeaves : sortedLeaves.slice(0, 6)).map((leave, i) => (
                  <LeaveRow key={leave.pins.join('-')} leave={leave} showBorder={i > 0} />
                ))}
                {sortedLeaves.length > 6 && (
                  <TouchableOpacity
                    onPress={() => setShowAllLeaves(v => !v)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.showAllRow}
                  >
                    <Text style={styles.allLeavesToggle}>
                      {showAllLeaves ? 'Show Less' : `Show All (${sortedLeaves.length})`}
                    </Text>
                  </TouchableOpacity>
                )}
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
        <SettingsContent onClose={() => setSettingsOpen(false)} />
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
  heroGoalDelta: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  cardGoalDelta: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  // Metric cards
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
  // Charts
  chartCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 13,
    marginBottom: 12,
    overflow: 'hidden',
    paddingTop: 16,
    paddingBottom: 8,
  },
  chartTitle: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  chart: {
    borderRadius: 0,
  },
  chartEmpty: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  chartEmptyText: {
    color: '#48484A',
    fontSize: 14,
    textAlign: 'center',
  },
  // Gear button
  gearButton: {
    marginRight: 16,
  },

  // --- Common Leaves section ---
  leavesCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 13,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    marginBottom: 12,
  },
  leavesTitle: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  leavesNaCard: {
    marginBottom: 12,
  },
  leaveListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  leaveListRowBorder: {
    borderTopWidth: 0.5,
    borderTopColor: '#38383A',
  },

  // Mini pin diagram inside leave rows
  leaveDeck: {
    alignItems: 'center',
    gap: 2,
    marginRight: 14,
    width: 36,
  },
  leaveRow: {
    flexDirection: 'row',
    gap: 2,
  },
  leavePin: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  leavePinUp: { backgroundColor: '#00CEC9' },
  leavePinDown: { backgroundColor: '#38383A' },

  // Leave row text
  leaveInfo: {
    flex: 1,
    gap: 2,
  },
  leaveName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  leaveCount: {
    color: '#8E8E93',
    fontSize: 12,
  },
  leaveConvPct: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 46,
    textAlign: 'right',
  },
  leaveNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  splitBadge: {
    marginLeft: 6,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#00CEC9',
    borderWidth: 1,
    borderColor: '#00CEC9',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  makeableSub: {
    color: '#8E8E93',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },

  // --- Score Distribution ---
  histCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 13,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    marginBottom: 12,
  },
  histTitle: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
  },
  histLabel: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '500',
    width: 66,
  },
  histBarTrack: {
    flex: 1,
    height: 14,
    backgroundColor: '#2C2C2E',
    borderRadius: 7,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  histBar: {
    height: 14,
    backgroundColor: '#00CEC9',
    borderRadius: 7,
  },
  histCount: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    width: 24,
    textAlign: 'right',
  },

  // --- By Ball ---
  ballStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
  },
  ballStatInfo: {
    flex: 1,
    gap: 2,
  },
  ballStatName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  ballStatCount: {
    color: '#8E8E93',
    fontSize: 12,
  },
  ballStatAvg: {
    fontSize: 22,
    fontWeight: '700',
  },

  allLeavesToggle: {
    color: '#00CEC9',
    fontSize: 13,
    fontWeight: '600',
  },
  showAllRow: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: 0.5,
    borderTopColor: '#38383A',
    marginTop: 2,
  },

  // --- Leaves sort toggle ---
  sortRow: {
    flexDirection: 'row',
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    padding: 2,
    marginTop: 4,
    marginBottom: 4,
  },
  sortChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  sortChipActive: {
    backgroundColor: '#1C1C1E',
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
  },
  sortChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
