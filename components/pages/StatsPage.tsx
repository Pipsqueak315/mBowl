import { useState, useLayoutEffect, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { PIN_ROWS } from '@/src/pinLayout';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from 'expo-router/react-navigation';
import SettingsContent from '@/components/SettingsContent';
import FilterHeader from '@/components/v2/FilterHeader';
import { usePageWidth, useSideInsets, usePageVisible } from '@/src/v2/page';
import { useLayoutClass } from '@/src/v2/layout';
import { LineChart } from 'react-native-chart-kit';
import { readSessions, readSettings, readReference } from '@/src/storage';
import { onDataChanged } from '@/src/dataEvents';
import type { Session, Settings, ThrowEntry } from '@/src/types';
import HeaderIconButton from '@/components/v2/HeaderIconButton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { computeLeaveStats } from '@/src/leaveUtils';
import { filterSessions, ALL_TIME, type SeasonSelection, type TypeFilter } from '@/src/sessionFilter';
import { getSeasons, currentSeason, resolveSeasonRanges } from '@/src/seasons';
import ScalePressable from '@/components/ScalePressable';
import { computeGoalPath, type GoalPath } from '@/src/goalPath';
import { computeSpareLeak, type SpareBucket, type SpareLeak } from '@/src/spareLeak';
import { goalRange, goalLevelSessions, pinsPerMissedSpare } from '@/src/recipe';
import { cardsFromReference, topLeaveFixes, type LeaveFix } from '@/src/leaveFixes';
import { computeTiltCost, type TiltCost } from '@/src/tiltCost';
import { DEFAULT_DIAGNOSTICS } from '@/components/PocketDiagnosticsTab';
import { upgradeReference } from '@/src/referenceUpgrade';

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
  backgroundColor: '#000000',
  backgroundGradientFrom: '#000000',
  backgroundGradientTo: '#000000',
  // Phase 28 WP4: soft area fill under a thin teal line.
  fillShadowGradientFrom: '#00CEC9',
  fillShadowGradientFromOpacity: 0.22,
  fillShadowGradientTo: '#00CEC9',
  fillShadowGradientToOpacity: 0,
  decimalPlaces: 0,
  color: (opacity = 1) => 'rgba(0, 206, 201, ' + String(opacity) + ')',
  labelColor: (opacity = 1) => 'rgba(142, 142, 147, ' + String(opacity) + ')',
  propsForDots: {
    r: '3',
    strokeWidth: '2',
    stroke: '#00CEC9',
    fill: '#000000',
  },
  propsForBackgroundLines: {
    stroke: '#1C1C1E',
    strokeDasharray: '',
  },
};


const TYPE_FULL_LABEL: Record<Exclude<TypeFilter, 'all'>, string> = {
  league: 'League',
  tournament: 'Tournament',
  practice: 'Practice',
  makeup: 'Makeup',
};

// --- Leave stats helpers ---
const LEAVE_PIN_ROWS = PIN_ROWS; // src/pinLayout.ts (N9)

// N15 (Phase 26.1): the one shared conversionColor is split by metric.
// Aggregate Makeable % — band LOCKED at green ≥80 / orange ≥60 (Phase 24).
function makeableColor(pct: number): string {
  if (pct >= 80) return '#30D158';
  if (pct >= 60) return '#FF9F0A';
  return '#FF453A';
}

// Per-leave conversion rows. Non-split leaves keep the 80/60 band. Splits get
// their own scale: most are low-percentage by nature (real export: 9/44 = 20%
// across all splits; Big 4 0/7), so a miss reads dim grey, never red — red
// should flag a makeable spare you're leaving, not a 4-6-7-10.
// `isSplit` comes from leaveUtils (single source of truth) — nothing derived here.
function leaveConversionColor(pct: number, isSplit: boolean): string {
  if (isSplit) {
    if (pct >= 40) return '#30D158';
    if (pct >= 15) return '#FF9F0A';
    return '#8E8E93';
  }
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
          <Text style={[styles.leaveName, styles.leaveNameShrink]} numberOfLines={1}>{leave.name}</Text>
          {leave.isSplit && <Text style={styles.splitBadge}>SPLIT</Text>}
        </View>
        <Text style={styles.leaveCount}>× {leave.count}</Text>
      </View>
      <Text style={[styles.leaveConvPct, { color: leaveConversionColor(leave.conversionPct, leave.isSplit) }]}>
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

// Local today as YYYY-MM-DD, for resolving the current season.
function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Series total for a session with exactly three scored games, else null.
// Shared by High Series and the Series Trend chart so both use one rule.
const SERIES_GAMES = 3;
function threeGameSeriesTotal(s: Session): number | null {
  const scored = s.games.filter(g => g.score != null);
  if (scored.length !== SERIES_GAMES) return null;
  return scored.reduce((sum, g) => sum + (g.score as number), 0);
}

function calcMetrics(sessions: Session[]): Metrics | null {
  if (sessions.length === 0) return null;

  const allGames = sessions.flatMap(s => s.games.filter(g => g.score != null));
  if (allGames.length === 0) return null;

  const scores = allGames.map(g => g.score as number);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const highGame = Math.max(...scores);

  // High Series counts standard 3-game series only (Phase 24 Part 6b) — an
  // 8-game tournament block is not a series and would dwarf every league night.
  let highSeries = 0;
  for (const s of sessions) {
    const total = threeGameSeriesTotal(s);
    if (total != null && total > highSeries) highSeries = total;
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

// Build series-per-session data (one point per 3-game session, chronological).
// Non-3-game sessions are excluded (Phase 24 Part 6b), same rule as High Series.
function buildSeriesData(sessions: Session[]): ChartPoint | null {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const labels: string[] = [];
  const data: number[] = [];

  for (const s of sorted) {
    const total = threeGameSeriesTotal(s);
    if (total != null && total > 0) {
      // Show date label every 3rd plotted point so labels don't crowd
      labels.push(data.length % 3 === 0 ? formatDateLabel(s.date) : '');
      data.push(total);
    }
  }

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

// --- Season comparison (Phase 24 Part 3) ---
// One aggregate over a filtered session set, reusing the existing metric
// functions verbatim — no new metric logic. `gamesWithFrames` / `totalGames`
// drive both the coverage readout and the sample-size delta gate.
interface SeasonMetricSet {
  avg: number | null;
  firstBallAvg: number | null;
  strikePct: number | null;
  doublesPct: number | null;
  cleanPct: number | null;
  sparePct: number | null;
  makeablePct: number | null;
  opensPerGame: number | null;
  bounceBackPct: number | null;
  gamesWithFrames: number;
  totalGames: number;
}

type MetricKey = Exclude<keyof SeasonMetricSet, 'gamesWithFrames' | 'totalGames'>;

function computeSeasonMetrics(sessions: Session[]): SeasonMetricSet {
  const m = calcMetrics(sessions);
  const adv = calcAdvancedStats(sessions);
  const leaves = computeLeaveStats(sessions) as { makeableSparePct: number | null };
  const totalGames = sessions.reduce(
    (n, s) => n + s.games.filter(g => g.score != null).length,
    0,
  );
  return {
    avg: m ? m.avg : null,
    firstBallAvg: adv.firstBallAvg,
    strikePct: m?.frameStats ? m.frameStats.strikeRate : null,
    doublesPct: adv.doublesPct,
    cleanPct: adv.gamesWithFrames > 0 ? (adv.cleanGames / adv.gamesWithFrames) * 100 : null,
    sparePct: m?.frameStats ? m.frameStats.spareRate : null,
    makeablePct: leaves.makeableSparePct,
    opensPerGame: m?.frameStats ? m.frameStats.opensPerGame : null,
    bounceBackPct: adv.bounceBackPct,
    gamesWithFrames: adv.gamesWithFrames,
    totalGames,
  };
}

// `frame: true` rows are frame/pin-derived — their delta is suppressed unless
// BOTH seasons have >= MIN_FRAME_GAMES games with frame data. `invert: true`
// (Opens/G) means lower is better, flipping the delta colour direction.
const MIN_FRAME_GAMES = 10;
type CmpFmt = 'pct' | 'avg1' | 'avg2';
const COMPARE_ROWS: {
  key: MetricKey;
  label: string;
  frame: boolean;
  fmt: CmpFmt;
  invert?: boolean;
}[] = [
  { key: 'avg', label: 'Average', frame: false, fmt: 'avg1' },
  { key: 'firstBallAvg', label: 'First Ball', frame: true, fmt: 'avg1' },
  { key: 'strikePct', label: 'Strike %', frame: true, fmt: 'pct' },
  { key: 'doublesPct', label: 'Doubles %', frame: true, fmt: 'pct' },
  { key: 'cleanPct', label: 'Clean %', frame: true, fmt: 'pct' },
  { key: 'sparePct', label: 'Spare %', frame: true, fmt: 'pct' },
  { key: 'makeablePct', label: 'Makeable %', frame: true, fmt: 'pct' },
  { key: 'opensPerGame', label: 'Opens/G', frame: true, fmt: 'avg2', invert: true },
  { key: 'bounceBackPct', label: 'Bounce-Back %', frame: true, fmt: 'pct' },
];

function fmtMetric(v: number | null, fmt: CmpFmt): string {
  if (v == null) return '—';
  if (fmt === 'pct') return `${Math.round(v)}%`;
  if (fmt === 'avg2') return v.toFixed(2);
  return v.toFixed(1);
}

// Signed delta rounded to the row's display precision, so colour and text agree
// (a raw delta that rounds to 0 must read as neutral "0", not a coloured arrow).
function deltaValue(d: number, fmt: CmpFmt): number {
  if (fmt === 'pct') return Math.round(d);
  if (fmt === 'avg2') return Number(d.toFixed(2));
  return Number(d.toFixed(1));
}

// --- Seven-cell color bands (Phase 24 Part 6) ---
// Goal-based (Marcus, Nov 2026: "end the season at a 190 average").
//   green  = the level that produces a 190 average — read from his own games
//            scoring 180–200 in the Oct 2026 export (FB 8.9, Strike 48%,
//            Spare 65–67%, Opens 1.6); Clean from P(0 opens) at 1.6 opens/game.
//   orange = his current level (all-time: FB 8.6, Strike 39%, Doubles 36%,
//            Clean 7%, Spare 60%, Opens 2.2, Bounce-Back 75%) up to the goal.
//   red    = below his current level.
// Deliberately separate from makeableColor / leaveConversionColor (N15).
// `invert` = lower is better (Opens/G). Callers pass the value AT DISPLAY
// PRECISION so the colour always agrees with the number on screen.
interface Band {
  green: number;
  orange: number;
  invert?: boolean;
}
const CELL_BANDS = {
  firstBall: { green: 8.9, orange: 8.6 },
  strike: { green: 48, orange: 39 },
  doubles: { green: 42, orange: 36 },
  clean: { green: 20, orange: 7 },
  spare: { green: 67, orange: 60 },
  opensPerGame: { green: 1.6, orange: 2.2, invert: true },
  bounceBack: { green: 80, orange: 75 },
} satisfies Record<string, Band>;

function bandColor(value: number, band: Band): string {
  if (band.invert) {
    if (value <= band.green) return '#30D158';
    if (value <= band.orange) return '#FF9F0A';
    return '#FF453A';
  }
  if (value >= band.green) return '#30D158';
  if (value >= band.orange) return '#FF9F0A';
  return '#FF453A';
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
  first = false,
}: {
  label: string;
  value?: string | null;
  color?: string;
  children?: ReactNode;
  /** First cell in its row: no divider on its left. */
  first?: boolean;
}) {
  const locked = value == null && children == null;
  // Phase 28 WP4: value on top (colored by its band when the sample allows),
  // sentence-case label below, hairline dividers between cells, no box.
  return (
    <View style={[styles.gridCell, !first && styles.gridCellDivider]}>
      {locked ? (
        <View style={styles.gridLock}>
          <IconSymbol name="lock.fill" size={13} color="#48484A" />
        </View>
      ) : children != null ? (
        children
      ) : (
        <Text
          style={[color ? styles.gridCellValueColored : styles.gridCellValue, color ? { color } : null]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value}
        </Text>
      )}
      <Text style={styles.gridCellLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// --- Path to goal (Phase 29) ---
// The needed average's colour: green = already on pace, orange = within 10 pins
// of the current league average, red = more than that, grey = out of reach.
const PATH_COLOR: Record<GoalPath['status'], string> = {
  needsSetup: '#8E8E93',
  noGames: '#FFFFFF',
  onPace: '#30D158',
  close: '#FF9F0A',
  stretch: '#FF453A',
  outOfReach: '#8E8E93',
  done: '#FFFFFF',
};

function PathRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.pathRow, !last && styles.pathRowBorder]}>
      <Text style={styles.pathRowLabel}>{label}</Text>
      <Text style={styles.pathRowValue}>{value}</Text>
    </View>
  );
}

function GoalPathCard({ path, onOpenSettings }: { path: GoalPath; onOpenSettings: () => void }) {
  const title = path.goal != null ? `Path to ${path.goal}` : 'Path to goal';
  if (path.status === 'needsSetup') {
    const missing =
      path.goal == null && path.weeks == null
        ? 'a target average and this season\'s league weeks'
        : path.goal == null
          ? 'a target average'
          : 'this season\'s league weeks';
    return (
      <View style={styles.leavesCard}>
        <Text style={styles.leavesTitle}>{title}</Text>
        <Text style={styles.pathSetupText}>Set {missing} in Settings to see the average you need.</Text>
        <ScalePressable style={styles.pathSetupButton} onPress={onOpenSettings} accessibilityRole="button">
          <Text style={styles.pathSetupButtonText}>Open Settings</Text>
        </ScalePressable>
      </View>
    );
  }
  if (path.status === 'done') {
    const avg = path.currentAvg;
    const diff = avg != null && path.goal != null ? avg - path.goal : null;
    const color = diff == null ? '#FFFFFF' : diff >= 0 ? '#30D158' : '#FF453A';
    return (
      <View style={styles.leavesCard}>
        <Text style={styles.leavesTitle}>{title}</Text>
        <Text style={[styles.pathBig, { color }]}>{avg != null ? avg.toFixed(1) : '—'}</Text>
        <Text style={styles.pathCaption}>final league average · {path.gamesBowled} games</Text>
        {diff != null && (
          <PathRow label="vs goal" value={`${diff >= 0 ? '+' : '−'}${Math.abs(diff).toFixed(1)}`} last />
        )}
      </View>
    );
  }
  const needed = path.neededAvg as number;
  const caption =
    path.status === 'outOfReach'
      ? `needed over the last ${path.gamesLeft} games — more than 300, out of reach this season`
      : path.status === 'onPace'
        ? `needed over the last ${path.gamesLeft} games — you're on pace`
        : `needed over the last ${path.gamesLeft} games`;
  return (
    <View style={styles.leavesCard}>
      <Text style={styles.leavesTitle}>{title}</Text>
      <Text style={[styles.pathBig, { color: PATH_COLOR[path.status] }]}>{needed.toFixed(1)}</Text>
      <Text style={styles.pathCaption}>{caption}</Text>
      <View style={styles.pathRows}>
        {path.status !== 'outOfReach' && (
          <PathRow label="Each week" value={`${path.neededSeries} series`} />
        )}
        <PathRow
          label="League average"
          value={path.currentAvg != null ? `${path.currentAvg.toFixed(1)} · ${path.gamesBowled} games` : '—'}
        />
        <PathRow label="Weeks left" value={`${path.weeksLeft} of ${path.weeks}`} last />
      </View>
    </View>
  );
}

// --- Spare leak (Phase 29) ---
// Conversion colour uses the non-split 80/60 band, withheld under 5 chances.
const LEAK_MIN_ATTEMPTS = 5;

function LeakRow({
  label,
  bucket,
  perGame,
  indent = false,
  border,
}: {
  label: string;
  bucket: SpareBucket;
  perGame: number | null;
  indent?: boolean;
  border: boolean;
}) {
  const pct = bucket.attempts > 0 ? (bucket.made / bucket.attempts) * 100 : null;
  const color =
    pct != null && bucket.attempts >= LEAK_MIN_ATTEMPTS ? leaveConversionColor(pct, false) : '#FFFFFF';
  return (
    <View style={[styles.leakRow, border && styles.leaveListRowBorder]}>
      <View style={[styles.ballStatInfo, indent && styles.leakIndent]}>
        <Text style={indent ? styles.leakSubName : styles.ballStatName}>{label}</Text>
        <Text style={styles.ballStatCount}>
          {bucket.made} of {bucket.attempts}
        </Text>
      </View>
      <Text style={[styles.leakPct, { color }]}>{pct != null ? `${Math.round(pct)}%` : '—'}</Text>
      <Text style={styles.leakPins}>{perGame != null ? perGame.toFixed(1) : '—'}</Text>
    </View>
  );
}

function SpareLeakCard({ leak, avg, target }: { leak: SpareLeak; avg: number | null; target: number | null | undefined }) {
  if (leak.gamesWithFrames === 0 || leak.totalPerGame == null) {
    return (
      <View style={[styles.card, styles.naCard, styles.leavesNaCard]}>
        <Text style={styles.cardLabel}>Spare leak</Text>
        <IconSymbol name="lock.fill" size={18} color="#48484A" />
        <Text style={styles.naText}>Log frames to unlock.</Text>
      </View>
    );
  }
  const total = leak.totalPerGame;
  const gap = target != null && avg != null ? target - avg : null;
  let gapText: string | null = null;
  if (gap != null && gap > 0 && total > 0) {
    gapText =
      total >= gap
        ? `More than your whole gap to ${target}`
        : `About ${Math.round((total / gap) * 100)}% of your gap to ${target}`;
  }
  const perPinGame = (b: SpareBucket) => (leak.gamesWithPins > 0 ? b.pinsLost / leak.gamesWithPins : null);
  const rows: { label: string; bucket: SpareBucket; perGame: number | null; indent?: boolean }[] = [];
  if (leak.single.attempts > 0) rows.push({ label: 'Single pins', bucket: leak.single, perGame: leak.singlePerGame });
  if (leak.tenPin.attempts > 0) rows.push({ label: '10 pin', bucket: leak.tenPin, perGame: perPinGame(leak.tenPin), indent: true });
  if (leak.sevenPin.attempts > 0) rows.push({ label: '7 pin', bucket: leak.sevenPin, perGame: perPinGame(leak.sevenPin), indent: true });
  if (leak.multi.attempts > 0) rows.push({ label: 'Multi-pin', bucket: leak.multi, perGame: leak.multiPerGame });
  return (
    <View style={styles.leavesCard}>
      <Text style={styles.leavesTitle}>Spare leak</Text>
      <Text style={styles.pathBig}>{total.toFixed(1)}</Text>
      <Text style={styles.pathCaption}>pins a game lost to missed makeable spares</Text>
      {gapText && <Text style={styles.leakGap}>{gapText}</Text>}
      {rows.length > 0 && (
        <View style={styles.leakTable}>
          <View style={styles.leakHeaderRow}>
            <Text style={[styles.ballStatInfo, styles.leakHeader]}> </Text>
            <Text style={[styles.leakPct, styles.leakHeader]}>Made</Text>
            <Text style={[styles.leakPins, styles.leakHeader]}>Pins/g</Text>
          </View>
          {rows.map((r, i) => (
            <LeakRow key={r.label} label={r.label} bucket={r.bucket} perGame={r.perGame} indent={r.indent} border={i > 0} />
          ))}
        </View>
      )}
      <Text style={styles.leakNote}>
        Pins a game you'd gain by making them, bonus balls included. Splits left out.
        {leak.usedFillEstimate ? ' A 10th-frame fill ball uses your first-ball average.' : ''}
      </Text>
    </View>
  );
}

// --- 190 recipe (Phase 30A) ---
// Goal-level games (target ± 10, all-time, with frames) vs the current view,
// on the grid's own metric definitions. Gap = what the current view is short
// of the goal-level games; a check when it already matches them.
interface RecipeRowDef {
  label: string;
  base: number | null;
  now: number | null;
  digits: number;
  suffix: string;
  invert?: boolean; // lower is better (Opens/game)
}

function RecipeCard({
  lo,
  hi,
  goodGames,
  rows,
  opensPins,
  nowGated,
}: {
  lo: number;
  hi: number;
  goodGames: number;
  rows: RecipeRowDef[];
  opensPins: { gap: number; pins: number } | null;
  /** Under MIN_FRAME_GAMES framed games in this view: show Now, but no gaps. */
  nowGated: boolean;
}) {
  if (goodGames < MIN_FRAME_GAMES) {
    return (
      <View style={[styles.card, styles.naCard, styles.leavesNaCard]}>
        <Text style={styles.cardLabel}>Your {lo}–{hi} games</Text>
        <IconSymbol name="lock.fill" size={18} color="#48484A" />
        <Text style={styles.naText}>
          Needs {MIN_FRAME_GAMES} games scoring {lo}–{hi} with frames ({goodGames} so far).
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.leavesCard}>
      <Text style={styles.leavesTitle}>Your {lo}–{hi} games</Text>
      <Text style={styles.pathCaption}>
        What your {goodGames} games at {lo}–{hi} (all-time, any type, with frames) do, next to this view
      </Text>
      <View style={[styles.cmpHeaderRow, styles.recipeHeader]}>
        <Text style={styles.cmpLabelCell}> </Text>
        <Text style={[styles.cmpValCell, styles.cmpHeaderText]}>{lo}–{hi}</Text>
        <Text style={[styles.cmpValCell, styles.cmpHeaderText]}>Now</Text>
        <Text style={[styles.cmpDeltaCell, styles.cmpHeaderText]}>Gap</Text>
      </View>
      {rows.map((r, i) => {
        let gapText = '—';
        let gapColor = '#48484A';
        if (!nowGated && r.base != null && r.now != null) {
          const base = Number(r.base.toFixed(r.digits));
          const now = Number(r.now.toFixed(r.digits));
          const short = r.invert ? now - base : base - now;
          if (short <= 0) {
            gapText = '✓';
            gapColor = '#30D158';
          } else {
            gapText = `${r.invert ? '−' : '+'}${short.toFixed(r.digits)}${r.suffix}`;
            gapColor = '#FF9F0A';
          }
        }
        const fmt = (v: number | null) => (v == null ? '—' : `${v.toFixed(r.digits)}${r.suffix}`);
        return (
          <View key={r.label} style={[styles.cmpRow, i > 0 && styles.leaveListRowBorder]}>
            <Text style={styles.cmpLabelCell}>{r.label}</Text>
            <Text style={styles.cmpValCell}>{fmt(r.base)}</Text>
            <Text style={styles.cmpValCell}>{fmt(r.now)}</Text>
            <Text style={[styles.cmpDeltaCell, { color: gapColor }]}>{gapText}</Text>
          </View>
        );
      })}
      {!nowGated && opensPins && (
        <Text style={styles.leakGap}>
          {opensPins.gap.toFixed(1)} fewer opens a game is worth about {opensPins.pins.toFixed(0)} pins a game
        </Text>
      )}
      <Text style={styles.leakNote}>
        Same definitions as the grid above. A check means this view already matches your {lo}–{hi} games.
        {nowGated ? ` Gaps show from ${MIN_FRAME_GAMES} games with frames in this view.` : ''}
      </Text>
    </View>
  );
}

// --- Leave -> fix (Phase 30A) ---
function LeaveFixCard({ hasPinData, fixes }: { hasPinData: boolean; fixes: LeaveFix[] }) {
  if (!hasPinData) {
    return (
      <View style={[styles.card, styles.naCard, styles.leavesNaCard]}>
        <Text style={styles.cardLabel}>Leave → fix</Text>
        <IconSymbol name="lock.fill" size={18} color="#48484A" />
        <Text style={styles.naText}>Log frames with pin tracking to unlock.</Text>
      </View>
    );
  }
  return (
    <View style={styles.leavesCard}>
      <Text style={styles.leavesTitle}>Leave → fix</Text>
      {fixes.length === 0 ? (
        <Text style={styles.pathSetupText}>None of your leaves here match a Pocket Diagnostics card yet.</Text>
      ) : (
        <>
          <Text style={styles.pathCaption}>Your most common leaves, with the fix from Pocket Diagnostics</Text>
          {fixes.map((f, i) => (
            <View key={f.leave} style={[styles.fixRow, i > 0 && styles.leaveListRowBorder]}>
              <View style={styles.fixHead}>
                <Text style={styles.ballStatName}>{f.leave}</Text>
                <Text style={[styles.ballStatCount, styles.fixCount]}>
                  {Math.round(f.sharePct)}% of leaves · made {f.converted} of {f.count}
                </Text>
              </View>
              <Text style={styles.fixCardName}>{f.card}</Text>
              <Text style={styles.fixText}>{f.fix}</Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

// --- Tilt cost (Phase 30A) ---
function TiltCard({ tilt, pinsPerMiss }: { tilt: TiltCost; pinsPerMiss: number | null }) {
  if (tilt.gamesWithFrames < MIN_FRAME_GAMES || tilt.openAfterOpenPct == null || tilt.openAfterMarkPct == null) {
    return (
      <View style={[styles.card, styles.naCard, styles.leavesNaCard]}>
        <Text style={styles.cardLabel}>Tilt cost</Text>
        <IconSymbol name="lock.fill" size={18} color="#48484A" />
        <Text style={styles.naText}>Needs {MIN_FRAME_GAMES} games with frames and at least one open.</Text>
      </View>
    );
  }
  // Colour on the within-game excess (see src/tiltCost.ts), not the raw gap
  // between the two rates -- an off night alone doesn't read as tilt.
  const ex = tilt.excessPct ?? 0;
  const color = ex <= 2 ? '#30D158' : ex <= 10 ? '#FF9F0A' : '#FF453A';
  const extra = tilt.extraOpensPerGame ?? 0;
  const cost =
    extra < 0.05
      ? 'None — an open doesn\'t lead to another'
      : pinsPerMiss != null
        ? `about ${(extra * pinsPerMiss).toFixed(1)} pins a game`
        : `about ${extra.toFixed(1)} extra opens a game`;
  return (
    <View style={styles.leavesCard}>
      <Text style={styles.leavesTitle}>Tilt cost</Text>
      <Text style={[styles.pathBig, { color }]}>{Math.round(tilt.openAfterOpenPct)}%</Text>
      <Text style={styles.pathCaption}>
        chance of another open right after an open · {Math.round(tilt.openAfterMarkPct)}% after a mark
      </Text>
      <View style={styles.pathRows}>
        <PathRow
          label="Back-to-back opens"
          value={tilt.backToBackPerGame != null ? `${tilt.backToBackPerGame.toFixed(1)} a game` : '—'}
        />
        <PathRow
          label="First ball after an open"
          value={
            tilt.firstBallAfterOpen != null && tilt.firstBallAfterMark != null
              ? `${tilt.firstBallAfterOpen.toFixed(1)} · ${tilt.firstBallAfterMark.toFixed(1)} after a mark`
              : '—'
          }
        />
        <PathRow label="What it costs" value={cost} last />
      </View>
      <Text style={styles.leakNote}>
        The frame right after each frame, inside the same game. Cost = opens after an open beyond each game's own open rate, at what a missed spare costs you in Spare leak.
      </Text>
    </View>
  );
}

// --- Component ---
export default function StatsPage({ embedded = false }: { embedded?: boolean }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Season selection is not persisted — reset to the current season on each
  // focus (see focus effect). ALL_TIME is a safe pre-load default.
  const [seasonSel, setSeasonSel] = useState<SeasonSelection>(ALL_TIME);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  // Phase 30A: Reference (Pocket Diagnostics cards) for Leave -> fix. Display only.
  const [reference, setReference] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [showAllLeaves, setShowAllLeaves] = useState(false);
  const [leaveSort, setLeaveSort] = useState<LeaveSort>('frequency');
  const navigation = useNavigation();
  const visible = usePageVisible();
  const dataSigRef = useRef('');
  // Duo rail + status column live in the side safe areas (Nov 10 Duo check
  // F1/F2): pad the page by them, and size the charts to this page's width
  // (half the window when the open screen shows two pages).
  const insets = useSideInsets();
  const pageWidth = usePageWidth();
  // Cover landscape: hero column on the left, Striking + Spares on the right.
  const wide = useLayoutClass().layout === 'compactWide' && !embedded;
  // Chart fills the card edge-to-edge; card sits inside 16px scroll padding each side
  const chartWidth = pageWidth - 32;

  useLayoutEffect(() => {
    // The embedded copy (second page of an open-screen pair) leaves the header
    // to the page that owns the screen.
    if (embedded) return;
    navigation.setOptions({
      headerRight: () => (
        <HeaderIconButton
          icon="gearshape"
          onPress={() => setSettingsOpen(true)}
          accessibilityLabel="Settings"
        />
      ),
    });
  }, [navigation, embedded]);

  useFocusEffect(
    useCallback(() => {
      // Hidden second page of a folded pair: nothing to draw, so no work.
      if (!visible) return;
      let active = true;
      // Leaves sort, type filter, and season selection are all non-persistent —
      // reset each visit. The season default (current season) needs the loaded
      // settings, so it is set after the read completes.
      setLeaveSort('frequency');
      setTypeFilter('all');
      (async () => {
        // Nov 10 polish: the spinner only shows on the very first load. On a
        // refocus the page stays up while storage is re-read, and the charts
        // are only recomputed when the data actually changed (before, every tab
        // switch blanked the page to a spinner and redrew every chart).
        const [sessionsData, settingsData, referenceData] = await Promise.all([
          readSessions(),
          readSettings(),
          readReference(),
        ]);
        if (active) {
          const sig = JSON.stringify([sessionsData, settingsData, referenceData]);
          if (sig !== dataSigRef.current) {
            dataSigRef.current = sig;
            setSessions(sessionsData);
            setSettings(settingsData);
            setReference(referenceData);
          }
          const cur = currentSeason(getSeasons(settingsData), todayISO());
          setSeasonSel(cur ? cur.id : ALL_TIME);
          setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [visible]),
  );

  // S23 (Nov 15): on the open screen Stats and History share one focus, so a
  // History edit / delete (or a Restore) never re-ran the focus load above and
  // Stats showed the old numbers. Re-read on a data change -- data only; the
  // filters stay where they are.
  useEffect(() => onDataChanged(() => {
    if (!visible) return; // a hidden page reloads when it's shown again
    void (async () => {
      const [sessionsData, settingsData, referenceData] = await Promise.all([
        readSessions(),
        readSettings(),
        readReference(),
      ]);
      const sig = JSON.stringify([sessionsData, settingsData, referenceData]);
      if (sig !== dataSigRef.current) {
        dataSigRef.current = sig;
        setSessions(sessionsData);
        setSettings(settingsData);
        setReference(referenceData);
      }
    })();
  }), [visible]);

  const seasons = useMemo(() => getSeasons(settings), [settings]);
  // Season pills: most-recent season first (leftmost = the default selection),
  // then All-Time. Uses each season's `short` label.
  const seasonPills = useMemo(() => {
    const pills = resolveSeasonRanges(seasons)
      .slice()
      .reverse()
      .map(r => ({ key: r.id, label: r.short }));
    pills.push({ key: ALL_TIME, label: 'All-Time' });
    return pills;
  }, [seasons]);
  const filtered = useMemo(
    () => filterSessions(sessions, seasonSel, seasons, typeFilter),
    [sessions, seasonSel, seasons, typeFilter],
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
  const spareLeak = useMemo<SpareLeak>(() => computeSpareLeak(filtered), [filtered]);
  const pinsPerMiss = useMemo(() => pinsPerMissedSpare(spareLeak), [spareLeak]);

  // 190 recipe (Phase 30A): goal-level games, all-time, any type -- run
  // through the same metric functions as the grid.
  const recipe = useMemo(() => {
    const { lo, hi } = goalRange(settings.targetAverage);
    const good = goalLevelSessions(sessions, lo, hi);
    const gm = calcMetrics(good);
    const ga = calcAdvancedStats(good);
    const fs = metrics?.frameStats ?? null;
    const rows: RecipeRowDef[] = [
      { label: 'First ball', base: ga.firstBallAvg, now: advancedStats.firstBallAvg, digits: 1, suffix: '' },
      { label: 'Strike', base: gm?.frameStats?.strikeRate ?? null, now: fs?.strikeRate ?? null, digits: 1, suffix: '%' },
      { label: 'Spare', base: gm?.frameStats?.spareRate ?? null, now: fs?.spareRate ?? null, digits: 1, suffix: '%' },
      { label: 'Opens/game', base: gm?.frameStats?.opensPerGame ?? null, now: fs?.opensPerGame ?? null, digits: 1, suffix: '', invert: true },
    ];
    const ob = gm?.frameStats?.opensPerGame;
    const on = fs?.opensPerGame;
    const opensGap = ob != null && on != null ? Number(on.toFixed(1)) - Number(ob.toFixed(1)) : 0;
    const opensPins =
      opensGap > 0 && pinsPerMiss != null ? { gap: opensGap, pins: opensGap * pinsPerMiss } : null;
    const nowGated = advancedStats.gamesWithFrames < MIN_FRAME_GAMES;
    return { lo, hi, goodGames: ga.gamesWithFrames, rows, opensPins, nowGated };
  }, [sessions, settings.targetAverage, metrics, advancedStats, pinsPerMiss]);

  // Leave -> fix (Phase 30A): the view's leaves + the Pocket Diagnostics cards.
  const fixCards = useMemo(
    // Phase 30B: the v1 -> v2 text upgrade in memory (the Reference tab writes it).
    () => cardsFromReference(upgradeReference(reference).value, DEFAULT_DIAGNOSTICS.cards),
    [reference],
  );
  const leaveFixes = useMemo(() => topLeaveFixes(leaveStats.leaves, fixCards, 3), [leaveStats.leaves, fixCards]);

  // Tilt cost (Phase 30A).
  const tilt = useMemo<TiltCost>(() => computeTiltCost(filtered), [filtered]);

  // Path to goal (Phase 29): the selected season's league + makeup games, so
  // only with a single season selected and a type filter that includes league
  // nights. Shown for the current season (with a set-up prompt if needed) and
  // for a past season only once its league weeks are set.
  const goalPath = useMemo<GoalPath | null>(() => {
    if (seasonSel === ALL_TIME) return null;
    if (typeFilter !== 'all' && typeFilter !== 'league' && typeFilter !== 'makeup') return null;
    const season = seasons.find(x => x.id === seasonSel);
    if (!season) return null;
    const today = todayISO();
    const isCurrent = currentSeason(seasons, today)?.id === seasonSel;
    if (!isCurrent && !season.weeks) return null;
    // Final only once the season has ENDED -- a season added ahead of time
    // (not started yet) is not finished.
    const range = resolveSeasonRanges(seasons).find(r => r.id === seasonSel);
    const finished = !isCurrent && range?.end != null && today > range.end;
    const path = computeGoalPath(
      filterSessions(sessions, seasonSel, seasons, 'all'),
      settings.targetAverage,
      season.weeks,
      undefined,
      finished,
    );
    // A finished season with no league games has nothing to show.
    if (path.status === 'done' && path.gamesBowled === 0) return null;
    return path;
  }, [seasonSel, typeFilter, seasons, sessions, settings.targetAverage]);

  // Display text + band colour for the seven frame-derived grid cells. Colour
  // is withheld (white, as before) below MIN_FRAME_GAMES games with frame data —
  // the sample can't support a verdict. Each colour is computed from the value
  // rounded to its display precision so the colour never disagrees with the text.
  const cells = useMemo(() => {
    const gated = advancedStats.gamesWithFrames >= MIN_FRAME_GAMES;
    const cell = (raw: number | null | undefined, digits: number, suffix: string, band: Band) => {
      if (raw == null) return null;
      const shown = Number(raw.toFixed(digits));
      return { text: `${raw.toFixed(digits)}${suffix}`, color: gated ? bandColor(shown, band) : undefined };
    };
    const fs = metrics?.frameStats ?? null;
    const cleanPct =
      advancedStats.gamesWithFrames > 0 ? (advancedStats.cleanGames / advancedStats.gamesWithFrames) * 100 : null;
    return {
      firstBall: cell(advancedStats.firstBallAvg, 1, '', CELL_BANDS.firstBall),
      strike: cell(fs?.strikeRate, 1, '%', CELL_BANDS.strike),
      doubles: cell(advancedStats.doublesPct, 0, '%', CELL_BANDS.doubles),
      spare: cell(fs?.spareRate, 1, '%', CELL_BANDS.spare),
      opensPerGame: cell(fs?.opensPerGame, 1, '', CELL_BANDS.opensPerGame),
      bounceBack: cell(advancedStats.bounceBackPct, 0, '%', CELL_BANDS.bounceBack),
      // Clean shows N/M, not a %, so band on the exact share (19.6% is not 20%).
      cleanColor: gated && cleanPct != null ? bandColor(cleanPct, CELL_BANDS.clean) : undefined,
    };
  }, [advancedStats, metrics]);

  // Season comparison: the selected season (A) vs its immediately preceding
  // season (B). Reuses filterSessions + computeSeasonMetrics, honouring the
  // active type filter so the A column matches the cards above. Hidden when
  // All-Time is selected or the selected season has no predecessor.
  const comparison = useMemo(() => {
    if (seasonSel === ALL_TIME) return null;
    const ranges = resolveSeasonRanges(seasons); // ascending by start
    const idx = ranges.findIndex(r => r.id === seasonSel);
    if (idx <= 0) return null; // not found, or earliest season (no predecessor)
    const cur = ranges[idx];
    const prev = ranges[idx - 1];
    return {
      a: { season: cur, m: computeSeasonMetrics(filterSessions(sessions, cur.id, seasons, typeFilter)) },
      b: { season: prev, m: computeSeasonMetrics(filterSessions(sessions, prev.id, seasons, typeFilter)) },
    };
  }, [seasonSel, seasons, sessions, typeFilter]);

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
        contentContainerStyle={[
          styles.content,
          { paddingLeft: 16 + insets.left, paddingRight: 16 + insets.right },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Phase 28 WP4: season menu + type segmented control (replaces the pills). */}
        <FilterHeader
          seasonOptions={seasonPills}
          season={seasonSel}
          onSeasonChange={setSeasonSel}
          type={typeFilter}
          onTypeChange={setTypeFilter}
        />

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#00CEC9" size="large" />
          </View>
        ) : !metrics ? (
          <View style={styles.centered}>
            <IconSymbol name="chart.bar.fill" size={52} color="#48484A" />
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
            <Text style={styles.emptySubtitle}>{emptySubtitle}</Text>
            {goalPath && (
              <View style={styles.emptyPath}>
                <GoalPathCard path={goalPath} onOpenSettings={() => setSettingsOpen(true)} />
              </View>
            )}
          </View>
        ) : (
          <>
            <View style={wide ? styles.wideTop : undefined}>
            {/* Hero (Phase 28 WP4): Average label, big white number, delta,
                counts. High game / High series are stacked divider rows --
                beside the average in portrait (so Striking and Spares both
                fit above the fold on the cover screen), under it in the
                landscape hero column. */}
            <View style={[styles.hero, wide ? styles.heroWide : styles.heroSide]}>
              <View style={wide ? undefined : styles.heroMain}>
                <Text style={styles.heroAvgLabel}>Average</Text>
                <Text style={styles.heroAvgNumber} numberOfLines={1} adjustsFontSizeToFit>
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
              <View style={[styles.heroRows, styles.heroRowsWide, !wide && styles.heroRowsSide]}>
                <View style={[styles.heroRow, styles.heroRowWide]}>
                  <Text style={styles.heroRowLabel}>High game</Text>
                  <Text style={styles.heroRowValue}>{metrics.highGame}</Text>
                </View>
                <View style={[styles.heroRow, styles.heroRowWide, styles.heroRowLast]}>
                  <Text style={styles.heroRowLabel}>High series</Text>
                  <Text style={styles.heroRowValue}>{metrics.highSeries > 0 ? metrics.highSeries : '—'}</Text>
                </View>
              </View>
            </View>

            <View style={wide ? styles.wideSections : undefined}>
            {/* STRIKING group */}
            <Text style={styles.groupEyebrow}>Striking</Text>
            <View style={styles.gridRow}>
              <GridCell
                first label="First ball"
                value={cells.firstBall?.text ?? null}
                color={cells.firstBall?.color}
              />
              <GridCell
                label="Strike"
                value={cells.strike?.text ?? null}
                color={cells.strike?.color}
              />
              <GridCell
                label="Doubles"
                value={cells.doubles?.text ?? null}
                color={cells.doubles?.color}
              />
              <GridCell label="Clean">
                {advancedStats.gamesWithFrames === 0 ? undefined : (
                  <Text
                    style={
                      cells.cleanColor
                        ? [styles.gridCellValueColored, { color: cells.cleanColor }]
                        : styles.gridCellValue
                    }
                  >
                    {advancedStats.cleanGames}
                    <Text style={styles.cleanDenom}>/{advancedStats.gamesWithFrames}</Text>
                  </Text>
                )}
              </GridCell>
            </View>

            {/* SPARES & RECOVERY group */}
            <Text style={styles.groupEyebrow}>Spares &amp; recovery</Text>
            <View style={styles.gridRow}>
              <GridCell
                first label="Spare"
                value={cells.spare?.text ?? null}
                color={cells.spare?.color}
              />
              <GridCell
                label="Makeable"
                value={
                  !leaveStats.hasPinData
                    ? null
                    : leaveStats.makeableSparePct != null
                      ? `${Math.round(leaveStats.makeableSparePct)}%`
                      : '—'
                }
                color={
                  leaveStats.hasPinData && leaveStats.makeableSparePct != null
                    ? makeableColor(leaveStats.makeableSparePct)
                    : undefined
                }
              />
              <GridCell
                label="Opens/game"
                value={cells.opensPerGame?.text ?? null}
                color={cells.opensPerGame?.color}
              />
              <GridCell
                label="Bounce-back"
                value={cells.bounceBack?.text ?? null}
                color={cells.bounceBack?.color}
              />
            </View>

            </View>
            </View>

            {/* Phase 29: the two goal cards, full width under the grids. */}
            {goalPath && <GoalPathCard path={goalPath} onOpenSettings={() => setSettingsOpen(true)} />}
            <RecipeCard
              lo={recipe.lo}
              hi={recipe.hi}
              goodGames={recipe.goodGames}
              rows={recipe.rows}
              opensPins={recipe.opensPins}
              nowGated={recipe.nowGated}
            />
            {/* Gap to the target: the league average when Path to goal has one,
                so the two cards never disagree; otherwise the page's average. */}
            <SpareLeakCard
              leak={spareLeak}
              avg={goalPath?.currentAvg ?? metrics.avg}
              target={settings.targetAverage}
            />
            <LeaveFixCard hasPinData={leaveStats.hasPinData} fixes={leaveFixes} />
            <TiltCard tilt={tilt} pinsPerMiss={pinsPerMiss} />

            {/* Series chart */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Series</Text>
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
                  <Text style={styles.chartEmptyText}>Need at least 2 three-game series to show trend</Text>
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
                    <Text style={styles.cardLabel}>Score distribution</Text>
                    <IconSymbol name="lock.fill" size={18} color="#48484A" />
                    <Text style={styles.naText}>No game scores in range to display.</Text>
                  </View>
                );
              }
              return (
                <View style={styles.histCard}>
                  <Text style={styles.histTitle}>Score distribution</Text>
                  {nonEmpty.map(bucket => {
                    const barPct = maxCount > 0 ? bucket.count / maxCount : 0;
                    return (
                      <View key={bucket.label} style={styles.histRow}>
                        <Text style={styles.histLabel}>{bucket.label}</Text>
                        <View style={styles.histBarTrack}>
                          <View
                            style={[
                              styles.histBar,
                              bucket.count !== maxCount && styles.histBarDim,
                              { width: `${Math.max(barPct * 100, 4)}%` },
                            ]}
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
              <Text style={styles.chartTitle}>Game by game</Text>
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
                <Text style={styles.cardLabel}>By ball</Text>
                <Text style={styles.naText}>No ball data logged yet.</Text>
              </View>
            ) : (
              <View style={styles.leavesCard}>
                <Text style={styles.leavesTitle}>By ball</Text>
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
                <Text style={styles.cardLabel}>By game number</Text>
                <IconSymbol name="lock.fill" size={18} color="#48484A" />
                <Text style={styles.naText}>Log a session to see game-by-game trends.</Text>
              </View>
            ) : (
              <View style={styles.leavesCard}>
                <Text style={styles.leavesTitle}>By game number</Text>
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

            {/* Season Comparison — selected season vs its predecessor */}
            {comparison && (
              <View style={styles.leavesCard}>
                <Text style={styles.leavesTitle}>Season comparison</Text>
                <View style={styles.cmpHeaderRow}>
                  <Text style={styles.cmpLabelCell}> </Text>
                  <Text style={[styles.cmpValCell, styles.cmpHeaderText]}>
                    {comparison.a.season.short}
                  </Text>
                  <Text style={[styles.cmpValCell, styles.cmpHeaderText]}>
                    {comparison.b.season.short}
                  </Text>
                  <Text style={[styles.cmpDeltaCell, styles.cmpHeaderText]}>Δ</Text>
                </View>
                <View style={styles.cmpCoverageRow}>
                  <Text style={styles.cmpLabelCell}> </Text>
                  <Text style={[styles.cmpValCell, styles.cmpCoverageText]}>
                    {comparison.a.m.gamesWithFrames}/{comparison.a.m.totalGames} fr
                  </Text>
                  <Text style={[styles.cmpValCell, styles.cmpCoverageText]}>
                    {comparison.b.m.gamesWithFrames}/{comparison.b.m.totalGames} fr
                  </Text>
                  <Text style={styles.cmpDeltaCell}> </Text>
                </View>
                {COMPARE_ROWS.map((row, i) => {
                  const av = comparison.a.m[row.key];
                  const bv = comparison.b.m[row.key];
                  const enoughFrames =
                    comparison.a.m.gamesWithFrames >= MIN_FRAME_GAMES &&
                    comparison.b.m.gamesWithFrames >= MIN_FRAME_GAMES;
                  const showDelta = av != null && bv != null && (!row.frame || enoughFrames);
                  let deltaText = '—';
                  let deltaColor = '#48484A';
                  if (showDelta) {
                    const dv = deltaValue((av as number) - (bv as number), row.fmt);
                    const mag = Math.abs(dv);
                    const body =
                      row.fmt === 'pct' ? String(mag) : row.fmt === 'avg2' ? mag.toFixed(2) : mag.toFixed(1);
                    deltaText = dv > 0 ? `+${body}` : dv < 0 ? `−${body}` : body;
                    deltaColor =
                      dv === 0 ? '#8E8E93' : (row.invert ? dv < 0 : dv > 0) ? '#30D158' : '#FF453A';
                  }
                  return (
                    <View key={row.key} style={[styles.cmpRow, i > 0 && styles.leaveListRowBorder]}>
                      <Text style={styles.cmpLabelCell}>{row.label}</Text>
                      <Text style={styles.cmpValCell}>{fmtMetric(av, row.fmt)}</Text>
                      <Text style={styles.cmpValCell}>{fmtMetric(bv, row.fmt)}</Text>
                      <Text style={[styles.cmpDeltaCell, { color: deltaColor }]}>{deltaText}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Settings Modal */}
      <Modal
        visible={settingsOpen}
        animationType="slide"
        supportedOrientations={['portrait', 'landscape']}
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

  // --- Hero (Phase 28 WP4) ---
  wideTop: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  wideSections: { flex: 1 },
  hero: { marginBottom: 20 },
  heroWide: { width: 196 },
  heroSide: { flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  heroMain: { flex: 1, minWidth: 0 },
  heroRowsSide: { width: 150, marginTop: 0, borderTopWidth: 0 },
  heroRowLast: { borderBottomWidth: 0 },
  heroAvgLabel: { fontSize: 15, fontWeight: '400', color: '#8E8E93' },
  heroAvgNumber: {
    fontSize: 64,
    fontWeight: '200',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    lineHeight: 72,
  },
  heroDelta: { fontSize: 15, fontWeight: '500', marginTop: 2 },
  heroMeta: { fontSize: 13, fontWeight: '400', color: '#8E8E93', marginTop: 2 },
  heroRows: {
    flexDirection: 'row',
    marginTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#38383A',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#38383A',
  },
  heroRowsWide: { flexDirection: 'column', borderBottomWidth: 0 },
  heroRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingRight: 12,
  },
  heroRowWide: {
    borderLeftWidth: 0,
    paddingLeft: 0,
    paddingRight: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#38383A',
  },
  heroRowLabel: { fontSize: 15, fontWeight: '400', color: '#8E8E93' },
  heroRowValue: { fontSize: 22, fontWeight: '300', color: '#FFFFFF', fontVariant: ['tabular-nums'] },

  // --- Section header + 4-up metric row (no boxes) ---
  groupEyebrow: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  gridCell: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 2,
    minHeight: 50,
    justifyContent: 'center',
  },
  gridCellDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#38383A',
  },
  gridLock: { height: 28, justifyContent: 'center' },
  gridCellLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E8E93',
  },
  gridCellValue: {
    fontSize: 22,
    fontWeight: '300',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  gridCellValueColored: {
    fontSize: 22,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  cleanDenom: {
    fontSize: 15,
    fontWeight: '300',
    color: '#8E8E93',
  },

  // Full-width NA / locked card (Score Distribution, By Ball, By Game, Leaves)
  card: { paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { color: '#FFFFFF', fontSize: 20, fontWeight: '600', marginBottom: 6, alignSelf: 'flex-start' },
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
  chartCard: { marginBottom: 20, overflow: 'hidden', paddingTop: 4 },
  chartTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '600', marginBottom: 8 },
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


  // --- Leaves / list-card sections ---
  leavesCard: { paddingTop: 4, paddingBottom: 4, marginBottom: 20 },

  // Path to goal + Spare leak (Phase 29)
  emptyPath: { alignSelf: 'stretch', marginTop: 24 },
  pathBig: {
    fontSize: 44,
    fontWeight: '200',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
    lineHeight: 50,
  },
  pathCaption: { fontSize: 13, fontWeight: '400', color: '#8E8E93', marginTop: 2 },
  pathRows: { marginTop: 10 },
  pathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  pathRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#38383A' },
  pathRowLabel: { fontSize: 15, fontWeight: '400', color: '#8E8E93', flexShrink: 0, marginRight: 12 },
  pathRowValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontSize: 15,
    fontWeight: '300',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  pathSetupText: { fontSize: 15, fontWeight: '400', color: '#8E8E93', lineHeight: 20 },
  pathSetupButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 10,
    borderRadius: 22,
    backgroundColor: '#1C1C1E',
  },
  pathSetupButtonText: { fontSize: 15, fontWeight: '600', color: '#00CEC9' },
  leakGap: { fontSize: 13, fontWeight: '500', color: '#00CEC9', marginTop: 4 },
  leakTable: { marginTop: 12 },
  leakHeaderRow: { flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 4 },
  leakHeader: { fontSize: 11, fontWeight: '500', color: '#8E8E93' },
  leakRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  leakIndent: { paddingLeft: 14 },
  leakSubName: { color: '#8E8E93', fontSize: 13.5, fontWeight: '500' },
  leakPct: { width: 56, textAlign: 'right', fontSize: 16, fontWeight: '400', fontVariant: ['tabular-nums'] },
  leakPins: {
    width: 64,
    textAlign: 'right',
    fontSize: 16,
    fontWeight: '300',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  leakNote: { color: '#48484A', fontSize: 11, lineHeight: 15, marginTop: 8 },
  recipeHeader: { marginTop: 12 },
  fixRow: { paddingVertical: 10, gap: 4 },
  fixHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  fixCount: { flexShrink: 1, textAlign: 'right' },
  fixCardName: { color: '#00CEC9', fontSize: 11, fontWeight: '500' },
  fixText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '400', lineHeight: 19 },
  leavesTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '600', marginBottom: 8 },
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

  // Season comparison table
  cmpHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 4,
  },
  cmpCoverageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383A',
  },
  cmpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  cmpLabelCell: {
    flex: 1.5,
    color: '#FFFFFF',
    fontSize: 14,
  },
  cmpValCell: {
    flex: 1,
    textAlign: 'right',
    color: '#FFFFFF',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  cmpDeltaCell: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '600',
    color: '#48484A',
    fontVariant: ['tabular-nums'],
  },
  cmpHeaderText: {
    color: '#00CEC9',
    fontSize: 12.5,
    fontWeight: '600',
  },
  cmpCoverageText: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '400',
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
  leaveNameShrink: { flexShrink: 1 }, // N13 (Phase 31A)
  splitBadge: {
    flexShrink: 0,
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
    paddingTop: 4,
    paddingBottom: 4,
    marginBottom: 20,
  },
  histTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '600', marginBottom: 8 },
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
  // Phase 28 WP4: only the tallest bar is teal.
  histBarDim: { backgroundColor: '#48484A' },
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
