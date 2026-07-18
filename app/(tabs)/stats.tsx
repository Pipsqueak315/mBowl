import { useState, useLayoutEffect, useCallback, useMemo, useEffect, type ReactNode } from 'react';
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
import * as Haptics from 'expo-haptics';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import SettingsContent from '@/components/SettingsContent';
import { LineChart } from 'react-native-chart-kit';
import { readSessions, readSettings } from '@/src/storage';
import type { Session, Settings, ThrowEntry } from '@/src/types';
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

// Session-type filter (Phase 22). 'all' + the four Session['type'] values.
type TypeFilter = 'all' | Session['type'];

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
    r: '3',
    strokeWidth: '2',
    stroke: '#00CEC9',
    fill: '#1C1C1E',
  },
  propsForBackgroundLines: {
    stroke: '#38383A',
    strokeDasharray: '',
  },
};

// --- Session-type filter pills (Phase 22) ---
const TYPE_PILLS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'league', label: 'Lg' },
  { key: 'tournament', label: 'Trn' },
  { key: 'practice', label: 'Prc' },
  { key: 'makeup', label: 'Mk' },
];

const TYPE_FULL_LABEL: Record<Exclude<TypeFilter, 'all'>, string> = {
  league: 'League',
  tournament: 'Tournament',
  practice: 'Practice',
  makeup: 'Makeup',
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

// Filter by the season window (when in season mode with dates set) AND by the
// selected session type. AND logic: a session must satisfy both to survive.
// This is the single choke point — every downstream memo reads `filtered`, so
// the type filter propagates through the entire tab from here.
function filterSessions(
  sessions: Session[],
  mode: ToggleMode,
  settings: Settings,
  typeFilter: TypeFilter,
): Session[] {
  let result = sessions;
  if (mode === 'season' && settings?.seasonStart && settings?.seasonEnd) {
    result = result.filter(
      s => s.date >= settings.seasonStart! && s.date <= settings.seasonEnd!,
    );
  }
  if (typeFilter !== 'all') {
    result = result.filter(s => s.type === typeFilter);
  }
  return result;
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

// Compact 4-across grid cell. White '300' value by default; pass `color` to
// colour-code a value (weight bumps to '400' for legibility). `value == null`
// AND no children → the locked state (frame-derived metric not yet unlocked),
// restyled to a small lock glyph in place of the value. Same gating behaviour
// as the old "Log frames to unlock" cards, just compacted.
function GridCell({
  label,
  value,
  color,
  children,
}: {
  label: string;
  value?: string | null;
  color?: string;
  children?: ReactNode;
}) {
  const locked = value == null && children == null;
  return (
    <View style={styles.gridCell}>
      <Text style={styles.gridCellLabel} numberOfLines={1}>{label}</Text>
      {locked ? (
        <IconSymbol name="lock.fill" size={13} color="#48484A" />
      ) : children != null ? (
        children
      ) : (
        <Text style={[color ? styles.gridCellValueColored : styles.gridCellValue, color ? { color } : null]}>
          {value}
        </Text>
      )}
    </View>
  );
}

// --- Component ---
export default function StatsScreen() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toggle, setToggle] = useState<ToggleMode>('season');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
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
      // Neither the leaves sort nor the type filter is persisted — reset both each visit.
      setLeaveSort('frequency');
      setTypeFilter('all');
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
    () => filterSessions(sessions, toggle, settings, typeFilter),
    [sessions, toggle, settings, typeFilter],
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

  // Average goal delta — memoized. "+X.X vs target" / "-X.X vs target" / "On target".
  const avgGoalDelta = useMemo(() => {
    const target = settings.targetAverage;
    if (target == null || !metrics) return null;
    const diff = metrics.avg - target;
    if (Math.abs(diff) <= 0.5) return { text: 'On target', color: '#00CEC9' };
    if (diff > 0) return { text: `+${diff.toFixed(1)} vs target`, color: '#30D158' };
    return { text: `${diff.toFixed(1)} vs target`, color: '#FF453A' };
  }, [metrics, settings.targetAverage]);

  useEffect(() => { setShowAllLeaves(false); }, [filtered]);

  const emptyTitle =
    typeFilter === 'all' ? 'No sessions yet' : `No ${TYPE_FULL_LABEL[typeFilter]} sessions`;
  const emptySubtitle =
    typeFilter === 'all'
      ? 'Log your first session to see stats here.'
      : 'Nothing matches this filter yet.';

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Controls row — season segmented + type pills share one line */}
        <View style={styles.controlsRow}>
          <View style={styles.segmented}>
            <ScalePressable
              style={[styles.segBtn, toggle === 'season' && styles.segBtnActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setToggle('season');
              }}
            >
              <Text style={[styles.segText, toggle === 'season' && styles.segTextActive]}>Season</Text>
            </ScalePressable>
            <ScalePressable
              style={[styles.segBtn, toggle === 'alltime' && styles.segBtnActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setToggle('alltime');
              }}
            >
              <Text style={[styles.segText, toggle === 'alltime' && styles.segTextActive]}>All</Text>
            </ScalePressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pillsScroll}
            contentContainerStyle={styles.pillsContent}
          >
            {TYPE_PILLS.map(p => (
              <ScalePressable
                key={p.key}
                style={[styles.pill, typeFilter === p.key && styles.pillActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setTypeFilter(p.key);
                }}
              >
                <Text style={[styles.pillText, typeFilter === p.key && styles.pillTextActive]}>
                  {p.label}
                </Text>
              </ScalePressable>
            ))}
          </ScrollView>
        </View>
        {toggle === 'season' && !hasSeasonDates && (
          <Text style={styles.noSeasonHint}>No season dates set — showing all sessions</Text>
        )}

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#00CEC9" size="large" />
          </View>
        ) : !metrics ? (
          <View style={styles.centered}>
            <IconSymbol name="chart.bar.fill" size={52} color="#48484A" />
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
            <Text style={styles.emptySubtitle}>{emptySubtitle}</Text>
          </View>
        ) : (
          <>
            {/* Hero strip — Average (left ~58%) + High Game / High Series stack (right ~42%) */}
            <View style={styles.heroRow}>
              <View style={styles.heroAvgCard}>
                <Text style={styles.heroAvgLabel}>Average</Text>
                <Text style={[styles.heroAvgNumber, { color: avgColor(metrics.avg) }]}>
                  {metrics.avg.toFixed(1)}
                </Text>
                {avgGoalDelta && (
                  <Text style={[styles.heroDelta, { color: avgGoalDelta.color }]}>
                    {avgGoalDelta.text}
                  </Text>
                )}
                <Text style={styles.heroMeta}>
                  {metrics.gameCount} games · {metrics.sessionCount} sessions
                </Text>
              </View>
              <View style={styles.heroSideCol}>
                <View style={styles.slimCard}>
                  <Text style={styles.slimLabel}>High Game</Text>
                  <Text style={styles.slimValue}>{metrics.highGame}</Text>
                </View>
                <View style={styles.slimCard}>
                  <Text style={styles.slimLabel}>High Series</Text>
                  <Text style={styles.slimValue}>{metrics.highSeries}</Text>
                </View>
              </View>
            </View>

            {/* STRIKING group */}
            <Text style={styles.groupEyebrow}>Striking</Text>
            <View style={styles.gridRow}>
              <GridCell
                label="FIRST BALL"
                value={advancedStats.firstBallAvg != null ? advancedStats.firstBallAvg.toFixed(1) : null}
              />
              <GridCell
                label="STRIKE"
                value={metrics.frameStats ? `${metrics.frameStats.strikeRate.toFixed(1)}%` : null}
              />
              <GridCell
                label="DOUBLES"
                value={advancedStats.doublesPct != null ? `${Math.round(advancedStats.doublesPct)}%` : null}
              />
              <GridCell label="CLEAN">
                {advancedStats.gamesWithFrames === 0 ? undefined : (
                  <Text style={styles.gridCellValue}>
                    {advancedStats.cleanGames}
                    <Text style={styles.cleanDenom}>/{advancedStats.gamesWithFrames}</Text>
                  </Text>
                )}
              </GridCell>
            </View>

            {/* SPARES & RECOVERY group */}
            <Text style={styles.groupEyebrow}>Spares &amp; Recovery</Text>
            <View style={styles.gridRow}>
              <GridCell
                label="SPARE"
                value={metrics.frameStats ? `${metrics.frameStats.spareRate.toFixed(1)}%` : null}
              />
              <GridCell
                label="MAKEABLE"
                value={
                  !leaveStats.hasPinData
                    ? null
                    : leaveStats.makeableSparePct != null
                      ? `${Math.round(leaveStats.makeableSparePct)}%`
                      : '—'
                }
                color={
                  leaveStats.hasPinData && leaveStats.makeableSparePct != null
                    ? conversionColor(leaveStats.makeableSparePct)
                    : undefined
                }
              />
              <GridCell
                label="OPENS/G"
                value={metrics.frameStats ? metrics.frameStats.opensPerGame.toFixed(1) : null}
              />
              <GridCell
                label="BOUNCE-BK"
                value={advancedStats.bounceBackPct != null ? `${Math.round(advancedStats.bounceBackPct)}%` : null}
              />
            </View>

            {/* Series Trend Chart — compact */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Series Trend</Text>
              {seriesChartPoint ? (
                <LineChart
                  data={{
                    labels: seriesChartPoint.labels,
                    datasets: [{ data: seriesChartPoint.data, strokeWidth: 2 }],
                  }}
                  width={chartWidth}
                  height={100}
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

            {/* Score Distribution — moved above the fold; empty ranges hidden */}
            {(() => {
              const nonEmpty = histogram.filter(b => b.count > 0);
              const maxCount = nonEmpty.reduce((m, b) => Math.max(m, b.count), 0);
              if (nonEmpty.length === 0) {
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
                  {nonEmpty.map(bucket => {
                    const barPct = maxCount > 0 ? bucket.count / maxCount : 0;
                    return (
                      <View key={bucket.label} style={styles.histRow}>
                        <Text style={styles.histLabel}>{bucket.label}</Text>
                        <View style={styles.histBarTrack}>
                          <View
                            style={[styles.histBar, { width: `${Math.max(barPct * 100, 4)}%` }]}
                          />
                        </View>
                        <Text style={styles.histCount}>{bucket.count}</Text>
                      </View>
                    );
                  })}
                </View>
              );
            })()}

            {/* Game-by-Game Trend Chart — below the fold, compact */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Game-by-Game Trend</Text>
              {gameChartPoint ? (
                <LineChart
                  data={{
                    labels: gameChartPoint.labels,
                    datasets: [{ data: gameChartPoint.data, strokeWidth: 2 }],
                  }}
                  width={chartWidth}
                  height={100}
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

  // --- Controls row: season segmented + type pills ---
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
    borderRadius: 9,
    padding: 3,
    flexShrink: 0,
    marginRight: 8,
  },
  segBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
    alignItems: 'center',
  },
  segBtnActive: {
    backgroundColor: '#00CEC9',
  },
  segText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#8E8E93',
  },
  segTextActive: {
    color: '#000000',
  },
  pillsScroll: {
    flex: 1,
  },
  pillsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 2,
  },
  pill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#38383A',
  },
  pillActive: {
    backgroundColor: 'rgba(0, 206, 201, 0.16)',
    borderColor: '#00CEC9',
  },
  pillText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#8E8E93',
  },
  pillTextActive: {
    color: '#00CEC9',
    fontWeight: '600',
  },
  noSeasonHint: {
    color: '#8E8E93',
    fontSize: 12,
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 10,
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

  // --- Hero strip ---
  heroRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  heroAvgCard: {
    flex: 58,
    backgroundColor: '#1C1C1E',
    borderRadius: 13,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  heroAvgLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.2,
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  heroAvgNumber: {
    fontSize: 40,
    fontWeight: '200',
    lineHeight: 46,
  },
  heroDelta: {
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 3,
  },
  heroMeta: {
    fontSize: 11,
    fontWeight: '400',
    color: '#8E8E93',
    marginTop: 3,
  },
  heroSideCol: {
    flex: 42,
    gap: 8,
  },
  slimCard: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slimLabel: {
    fontSize: 9.5,
    fontWeight: '500',
    letterSpacing: 0.4,
    color: '#8E8E93',
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  slimValue: {
    fontSize: 19,
    fontWeight: '300',
    color: '#FFFFFF',
    marginLeft: 6,
  },

  // --- Group eyebrow + 4-across grid ---
  groupEyebrow: {
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 1.4,
    color: '#48484A',
    textTransform: 'uppercase',
    marginBottom: 6,
    marginLeft: 2,
    marginTop: 2,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  gridCell: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 58,
  },
  gridCellLabel: {
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 0.3,
    color: '#8E8E93',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  gridCellValue: {
    fontSize: 16,
    fontWeight: '300',
    color: '#FFFFFF',
  },
  gridCellValueColored: {
    fontSize: 16,
    fontWeight: '400',
  },
  cleanDenom: {
    fontSize: 11,
    fontWeight: '300',
    color: '#8E8E93',
  },

  // Full-width NA / locked card (Score Distribution, By Ball, By Game, Leaves)
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 13,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingTop: 12,
    paddingBottom: 4,
  },
  chartTitle: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  chart: {
    borderRadius: 0,
  },
  chartEmpty: {
    height: 80,
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

  // --- Leaves / list-card sections ---
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
    paddingVertical: 9,
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
    fontSize: 13.5,
    fontWeight: '500',
  },
  leaveCount: {
    color: '#8E8E93',
    fontSize: 10.5,
    fontWeight: '400',
  },
  leaveConvPct: {
    fontSize: 15,
    fontWeight: '400',
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
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#00CEC9',
    borderWidth: 1,
    borderColor: '#00CEC9',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },

  // --- Score Distribution ---
  histCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 13,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    marginBottom: 12,
  },
  histTitle: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  histLabel: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '500',
    width: 58,
  },
  histBarTrack: {
    flex: 1,
    height: 9,
    backgroundColor: '#2C2C2E',
    borderRadius: 5,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  histBar: {
    height: 9,
    backgroundColor: '#00CEC9',
    borderRadius: 5,
  },
  histCount: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '400',
    width: 22,
    textAlign: 'right',
  },

  // --- By Ball / By Game Number list rows ---
  ballStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
  },
  ballStatInfo: {
    flex: 1,
    gap: 2,
  },
  ballStatName: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '500',
  },
  ballStatCount: {
    color: '#8E8E93',
    fontSize: 10.5,
    fontWeight: '400',
  },
  ballStatAvg: {
    fontSize: 16,
    fontWeight: '400',
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
