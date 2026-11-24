// Phase 31B helpers: per-game extras (speed, line, ball switch), per-session
// extras (house, condition, spare drill), ball wear, miss tags, season recap,
// CSV export. Everything here is pure -- read-time math over saved sessions.
import type {
  Ball,
  DrillCounts,
  DrillTarget,
  GameEntry,
  LaneCondition,
  MissTag,
  Session,
} from './types';

// ---------------------------------------------------------------------------
// Form parsing
// ---------------------------------------------------------------------------

/** "16.4" -> 16.4. Plausible bowling speeds only (8-30 mph), one decimal. */
export function parseSpeed(text: string | null | undefined): number | null {
  if (!text) return null;
  const n = Number(String(text).replace(',', '.').trim());
  if (!Number.isFinite(n) || n < 8 || n > 30) return null;
  return Math.round(n * 10) / 10;
}

/** Board 1-39 (boards counted from the right edge -- right-handed). */
export function parseBoard(text: string | null | undefined): number | null {
  if (!text) return null;
  const n = parseInt(String(text).trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > 39) return null;
  return n;
}

/** Frame 2-10 (a switch "at frame 1" is just a different ball). */
export function parseSwitchFrame(text: string | null | undefined): number | null {
  if (!text) return null;
  const n = parseInt(String(text).trim(), 10);
  if (!Number.isFinite(n) || n < 2 || n > 10) return null;
  return n;
}

export type GameExtrasForm = {
  speed?: string;
  feet?: string;
  target?: string;
  switchFrame?: string;
  switchBall?: string;
};

/** Form strings -> the optional saved fields (absent when blank). */
export function gameExtrasFromForm(f: GameExtrasForm): Pick<
  GameEntry,
  'speed' | 'feet' | 'target' | 'switchFrame' | 'switchBall'
> {
  const out: Pick<GameEntry, 'speed' | 'feet' | 'target' | 'switchFrame' | 'switchBall'> = {};
  const speed = parseSpeed(f.speed);
  const feet = parseBoard(f.feet);
  const target = parseBoard(f.target);
  const switchFrame = parseSwitchFrame(f.switchFrame);
  const switchBall = f.switchBall?.trim() || null;
  if (speed != null) out.speed = speed;
  if (feet != null) out.feet = feet;
  if (target != null) out.target = target;
  if (switchFrame != null) {
    out.switchFrame = switchFrame;
    if (switchBall) out.switchBall = switchBall;
  }
  return out;
}

/** Saved fields -> form strings. */
export function gameExtrasToForm(g: Partial<GameEntry>): Required<GameExtrasForm> {
  return {
    speed: g.speed != null ? String(g.speed) : '',
    feet: g.feet != null ? String(g.feet) : '',
    target: g.target != null ? String(g.target) : '',
    switchFrame: g.switchFrame != null ? String(g.switchFrame) : '',
    switchBall: g.switchBall ?? '',
  };
}

export function gameExtrasHaveContent(f: GameExtrasForm): boolean {
  return !!(f.speed?.trim() || f.feet?.trim() || f.target?.trim() || f.switchFrame?.trim());
}

// ---------------------------------------------------------------------------
// House + condition
// ---------------------------------------------------------------------------

export const DEFAULT_HOUSE = "Earl Anthony's";

export const CONDITION_LABELS: Record<LaneCondition, string> = {
  fresh: 'Fresh',
  broken: 'Broken down',
  pattern: 'Pattern',
};

export function isCondition(v: unknown): v is LaneCondition {
  return v === 'fresh' || v === 'broken' || v === 'pattern';
}

/** The house on the most recent session that has one, else Earl Anthony's. */
export function lastHouse(sessions: Session[]): string {
  let best: Session | null = null;
  for (const s of sessions) {
    if (!s.house?.trim()) continue;
    if (!best || s.date > best.date) best = s;
  }
  return best?.house?.trim() || DEFAULT_HOUSE;
}

/** Session house for stats: unset = the home house (all history was there). */
export function houseOf(s: Session): string {
  return s.house?.trim() || DEFAULT_HOUSE;
}

// ---------------------------------------------------------------------------
// Spare drill
// ---------------------------------------------------------------------------

export const DRILL_TARGETS: readonly DrillTarget[] = ['tenPin', 'sevenPin', 'single', 'multi'];

export const DRILL_LABELS: Record<DrillTarget, string> = {
  tenPin: '10 pin',
  sevenPin: '7 pin',
  single: 'Other single',
  multi: 'Multi-pin',
};

export function emptyDrill(): DrillCounts {
  return {
    tenPin: { made: 0, missed: 0 },
    sevenPin: { made: 0, missed: 0 },
    single: { made: 0, missed: 0 },
    multi: { made: 0, missed: 0 },
  };
}

/** Defensive: any stored shape -> a full DrillCounts (bad counts -> 0). */
export function normalizeDrill(d: unknown): DrillCounts | null {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const out = emptyDrill();
  let any = false;
  for (const t of DRILL_TARGETS) {
    const v = (d as Record<string, unknown>)[t];
    if (!v || typeof v !== 'object') continue;
    const made = Number((v as { made?: unknown }).made);
    const missed = Number((v as { missed?: unknown }).missed);
    out[t].made = Number.isFinite(made) && made > 0 ? Math.floor(made) : 0;
    out[t].missed = Number.isFinite(missed) && missed > 0 ? Math.floor(missed) : 0;
    if (out[t].made + out[t].missed > 0) any = true;
  }
  return any ? out : null;
}

export function drillShots(d: DrillCounts | null | undefined): number {
  if (!d) return 0;
  let n = 0;
  for (const t of DRILL_TARGETS) n += (d[t]?.made ?? 0) + (d[t]?.missed ?? 0);
  return n;
}

/** Drill totals across sessions (any type, but only Practice logs drills). */
export function drillTotals(sessions: Session[]): DrillCounts {
  const out = emptyDrill();
  for (const s of sessions) {
    const d = normalizeDrill(s.drill);
    if (!d) continue;
    for (const t of DRILL_TARGETS) {
      out[t].made += d[t].made;
      out[t].missed += d[t].missed;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ball wear
// ---------------------------------------------------------------------------

/** Games bowled with this ball on or after `sinceISO` (service day counts:
 *  balls come back from the shop before the night they're bowled). A game
 *  switched INTO this ball mid-game counts too. */
export function gamesSince(sessions: Session[], ballName: string, sinceISO: string): number {
  let n = 0;
  for (const s of sessions) {
    if (!s.date || s.date < sinceISO) continue;
    for (const g of s.games ?? []) {
      if (g.score == null && !g.frames?.length) continue;
      if (g.ball === ballName || (g.switchFrame != null && g.switchBall === ballName)) n++;
    }
  }
  return n;
}

export type BallWear = {
  resurfaced: { date: string; games: number } | null;
  oil: { date: string; games: number } | null;
};

export function ballWear(sessions: Session[], ball: Ball): BallWear {
  return {
    resurfaced: ball.resurfacedOn
      ? { date: ball.resurfacedOn, games: gamesSince(sessions, ball.name, ball.resurfacedOn) }
      : null,
    oil: ball.oilExtractedOn
      ? { date: ball.oilExtractedOn, games: gamesSince(sessions, ball.name, ball.oilExtractedOn) }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Line log: "start here" when a ball is picked
// ---------------------------------------------------------------------------

export type StartHere = { feet: number | null; target: number | null; score: number | null; date: string };

/** The most recent game with this ball that has a line logged. */
export function startHere(sessions: Session[], ballName: string): StartHere | null {
  let best: StartHere | null = null;
  for (const s of sessions) {
    for (const g of s.games ?? []) {
      if (g.ball !== ballName) continue;
      if (g.feet == null && g.target == null) continue;
      // >= : a later game the same night (games are in order) wins.
      if (!best || s.date >= best.date) {
        best = { feet: g.feet ?? null, target: g.target ?? null, score: g.score ?? null, date: s.date };
      }
    }
  }
  return best;
}

export function formatLine(feet: number | null | undefined, target: number | null | undefined): string {
  const f = feet != null ? String(feet) : '?';
  const t = target != null ? String(target) : '?';
  return `${f} → ${t}`;
}

// ---------------------------------------------------------------------------
// Miss tags
// ---------------------------------------------------------------------------

export const MISS_TAGS: readonly MissTag[] = ['yank', 'fast', 'target'];

export const MISS_LABELS: Record<MissTag, string> = {
  yank: 'Yank',
  fast: 'Fast',
  target: 'Missed target',
};

export function isMissTag(v: unknown): v is MissTag {
  return v === 'yank' || v === 'fast' || v === 'target';
}

export type MissStats = {
  /** Frames with a scored first ball, in games that have frames. */
  firstBalls: number;
  /** Games with at least one tag (so "no tags" never reads as "no misses"). */
  taggedGames: number;
  counts: Record<MissTag, number>;
  /** Tags per game number (1, 2, 3...) over tagged games. */
  byGame: Array<{ game: number; games: number; tags: number; perGame: number }>;
  /** Average score: games with a yank tag vs tagged games without one. */
  avgWithYank: number | null;
  avgWithoutYank: number | null;
};

export function computeMissStats(sessions: Session[]): MissStats {
  const counts: Record<MissTag, number> = { yank: 0, fast: 0, target: 0 };
  let firstBalls = 0;
  let taggedGames = 0;
  const byGame = new Map<number, { games: number; tags: number }>();
  let withYank = { pins: 0, n: 0 };
  let withoutYank = { pins: 0, n: 0 };
  for (const s of sessions) {
    (s.games ?? []).forEach((g, gi) => {
      const frames = g.frames ?? [];
      if (!frames.length) return;
      let tags = 0;
      let yank = false;
      for (const f of frames) {
        if (!f?.throws?.length) continue;
        firstBalls++;
        if (isMissTag(f.missTag)) {
          counts[f.missTag]++;
          tags++;
          if (f.missTag === 'yank') yank = true;
        }
      }
      if (tags === 0) return;
      taggedGames++;
      const num = g.game ?? gi + 1;
      const e = byGame.get(num) ?? { games: 0, tags: 0 };
      e.games++;
      e.tags += tags;
      byGame.set(num, e);
      if (g.score != null) {
        if (yank) withYank = { pins: withYank.pins + g.score, n: withYank.n + 1 };
        else withoutYank = { pins: withoutYank.pins + g.score, n: withoutYank.n + 1 };
      }
    });
  }
  return {
    firstBalls,
    taggedGames,
    counts,
    byGame: [...byGame.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([game, e]) => ({ game, games: e.games, tags: e.tags, perGame: e.tags / e.games })),
    avgWithYank: withYank.n ? withYank.pins / withYank.n : null,
    avgWithoutYank: withoutYank.n ? withoutYank.pins / withoutYank.n : null,
  };
}

// ---------------------------------------------------------------------------
// Speed + condition splits
// ---------------------------------------------------------------------------

export type SpeedStats = {
  games: number;
  avgSpeed: number | null;
  /** Average score in games at/above the median speed vs below it. */
  fasterAvg: number | null;
  slowerAvg: number | null;
  median: number | null;
};

export function computeSpeedStats(sessions: Session[]): SpeedStats {
  const pts: Array<{ speed: number; score: number }> = [];
  for (const s of sessions) {
    for (const g of s.games ?? []) {
      if (typeof g.speed === 'number' && Number.isFinite(g.speed) && g.score != null) {
        pts.push({ speed: g.speed, score: g.score });
      }
    }
  }
  if (!pts.length) return { games: 0, avgSpeed: null, fasterAvg: null, slowerAvg: null, median: null };
  const speeds = pts.map((p) => p.speed).sort((a, b) => a - b);
  const mid = Math.floor(speeds.length / 2);
  const median = speeds.length % 2 ? speeds[mid] : (speeds[mid - 1] + speeds[mid]) / 2;
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const faster = pts.filter((p) => p.speed > median).map((p) => p.score);
  const slower = pts.filter((p) => p.speed <= median).map((p) => p.score);
  return {
    games: pts.length,
    avgSpeed: avg(speeds),
    fasterAvg: faster.length ? avg(faster) : null,
    slowerAvg: slower.length ? avg(slower) : null,
    median,
  };
}

export type ConditionRow = { key: LaneCondition | 'unset'; label: string; games: number; avg: number };

export function computeConditionStats(sessions: Session[]): ConditionRow[] {
  const acc = new Map<LaneCondition | 'unset', { pins: number; n: number }>();
  for (const s of sessions) {
    const key = isCondition(s.condition) ? s.condition : 'unset';
    for (const g of s.games ?? []) {
      if (g.score == null) continue;
      const e = acc.get(key) ?? { pins: 0, n: 0 };
      e.pins += g.score;
      e.n++;
      acc.set(key, e);
    }
  }
  const order: Array<LaneCondition | 'unset'> = ['fresh', 'broken', 'pattern', 'unset'];
  return order
    .filter((k) => acc.has(k))
    .map((k) => {
      const e = acc.get(k)!;
      return { key: k, label: k === 'unset' ? 'Not set' : CONDITION_LABELS[k], games: e.n, avg: e.pins / e.n };
    });
}

export type HouseRow = { house: string; games: number; avg: number };

export function computeHouseStats(sessions: Session[]): HouseRow[] {
  const acc = new Map<string, { pins: number; n: number }>();
  for (const s of sessions) {
    const h = houseOf(s);
    for (const g of s.games ?? []) {
      if (g.score == null) continue;
      const e = acc.get(h) ?? { pins: 0, n: 0 };
      e.pins += g.score;
      e.n++;
      acc.set(h, e);
    }
  }
  return [...acc.entries()]
    .map(([house, e]) => ({ house, games: e.n, avg: e.pins / e.n }))
    .sort((a, b) => b.games - a.games);
}

// ---------------------------------------------------------------------------
// Season recap (read-only; Stats shows it for a finished season)
// ---------------------------------------------------------------------------

export type SeasonRecap = {
  games: number;
  avg: number | null;
  highGame: { score: number; date: string } | null;
  highSeries: { score: number; date: string } | null;
  topBall: { name: string; games: number } | null;
  bestNight: { avg: number; date: string; games: number } | null;
};

export function computeSeasonRecap(sessions: Session[]): SeasonRecap {
  let games = 0;
  let pins = 0;
  let highGame: SeasonRecap['highGame'] = null;
  let highSeries: SeasonRecap['highSeries'] = null;
  let bestNight: SeasonRecap['bestNight'] = null;
  const balls = new Map<string, number>();
  for (const s of sessions) {
    const scored = (s.games ?? []).filter((g) => g.score != null);
    if (!scored.length) continue;
    let series = 0;
    for (const g of scored) {
      const sc = g.score as number;
      games++;
      pins += sc;
      series += sc;
      if (!highGame || sc > highGame.score) highGame = { score: sc, date: s.date };
      if (g.ball) balls.set(g.ball, (balls.get(g.ball) ?? 0) + 1);
    }
    // A series is a 3-game night (league / makeup / tournament block).
    if (scored.length === 3 && (!highSeries || series > highSeries.score)) {
      highSeries = { score: series, date: s.date };
    }
    if (scored.length >= 3) {
      const avg = series / scored.length;
      if (!bestNight || avg > bestNight.avg) bestNight = { avg, date: s.date, games: scored.length };
    }
  }
  let topBall: SeasonRecap['topBall'] = null;
  for (const [name, n] of balls) if (!topBall || n > topBall.games) topBall = { name, games: n };
  return { games, avg: games ? pins / games : null, highGame, highSeries, topBall, bestNight };
}

// ---------------------------------------------------------------------------
// CSV export (one row per game)
// ---------------------------------------------------------------------------

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const CSV_HEADER = [
  'date', 'type', 'week', 'opponent', 'event', 'house', 'condition',
  'game', 'score', 'ball', 'speed', 'feet', 'target', 'switch_frame', 'switch_ball',
  'strikes', 'spares', 'opens', 'frames_logged', 'game_notes', 'session_notes',
];

function frameCounts(frames: GameEntry['frames']): { strikes: number; spares: number; opens: number } | null {
  if (!frames || !frames.length) return null;
  let strikes = 0;
  let spares = 0;
  let opens = 0;
  frames.forEach((f, i) => {
    const t = f?.throws ?? [];
    if (!t.length) return;
    if (i < 9) {
      if (t[0] === 'X') strikes++;
      else if (t[1] === '/') spares++;
      else if (t.length >= 2) opens++;
      return;
    }
    // 10th: count each first ball / spare the same way as frames 1-9 do for
    // its first frame-equivalent only (strike on ball 1, or spare on ball 2).
    if (t[0] === 'X') strikes++;
    else if (t[1] === '/') spares++;
    else if (t.length >= 2) opens++;
  });
  return { strikes, spares, opens };
}

export function sessionsToCsv(sessions: Session[]): string {
  const rows: string[] = [CSV_HEADER.join(',')];
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  for (const s of sorted) {
    (s.games ?? []).forEach((g, gi) => {
      const fc = frameCounts(g.frames);
      rows.push(
        [
          s.date,
          s.type,
          s.week,
          s.opponent,
          s.name,
          houseOf(s),
          isCondition(s.condition) ? CONDITION_LABELS[s.condition] : '',
          g.game ?? gi + 1,
          g.score,
          g.ball,
          g.speed,
          g.feet,
          g.target,
          g.switchFrame,
          g.switchFrame != null ? g.switchBall : '',
          fc?.strikes,
          fc?.spares,
          fc?.opens,
          fc ? 'yes' : 'no',
          g.notes,
          gi === 0 ? s.notes : '',
        ]
          .map(csvCell)
          .join(',')
      );
    });
  }
  return rows.join('\n') + '\n';
}
