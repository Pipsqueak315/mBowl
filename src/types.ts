// ---------------------------------------------------------------------------
// Shared data types — imported by all tabs and components
// ---------------------------------------------------------------------------

/** Per-frame data as stored: all optional to accommodate old/partial data */
export type ThrowEntry = {
  throws: string[];
  note?: string | null;
  throwNotes?: Record<string, string | null>;
  pinsStanding?: Array<boolean[] | null> | null;
  // Phase 31B, additive + optional: a first ball that missed, and how. No tag
  // = a good shot (Marcus only tags misses). Analytics only, never scoring.
  missTag?: MissTag | null;
};

/** Phase 31B miss tags (first ball only). */
export type MissTag = 'yank' | 'fast' | 'target';

/**
 * Per-frame data during live editing in log-frames.tsx.
 * All fields required — emptyFrames() always initialises them.
 */
export type FrameData = {
  throws: string[];
  note: string;
  throwNotes: Record<string, string | null>;
  pinsStanding?: Array<boolean[] | null>;
  missTag?: MissTag | null;
};

export type GameEntry = {
  game: number;
  score: number | null;
  ball: string | null;
  frames: ThrowEntry[] | null;
  notes: string | null;
  // Phase 31B, all additive + optional (old games simply lack them):
  /** Average first-ball speed off the overhead, mph (e.g. 16.4). */
  speed?: number | null;
  /** Line: feet board -> target board (boards counted from the right, right-handed). */
  feet?: number | null;
  target?: number | null;
  /** Switched balls mid-game: from this frame on, with switchBall. Stats keep
   *  the game's one ball (the spec's "one ball per game"); this is a note. */
  switchFrame?: number | null;
  switchBall?: string | null;
};

/** Phase 31B lane condition. */
export type LaneCondition = 'fresh' | 'broken' | 'pattern';

/** Phase 31B spare drill (Practice): makes / misses per target. */
export type DrillTarget = 'tenPin' | 'sevenPin' | 'single' | 'multi';
export type DrillCounts = Record<DrillTarget, { made: number; missed: number }>;

export type Session = {
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
  // Phase 31B, additive + optional:
  house?: string | null;
  condition?: LaneCondition | null;
  /** Practice only. */
  drill?: DrillCounts | null;
};

export type Ball = {
  id: string;
  name: string;
  short: string;
  strength: number;
  active: boolean;
  // Phase 31B, additive + optional: last service dates ("YYYY-MM-DD").
  resurfacedOn?: string | null;
  oilExtractedOn?: string | null;
};

/**
 * A bowling season. Phase 24: seasons are first-class. Only `start` is stored —
 * a season's end is DERIVED as (next season's start − 1 day); the most recent
 * season is open-ended. This gapless model means no session can fall outside a
 * season and there is no end-date field to keep in sync. See src/seasons.ts.
 */
export type Season = {
  id: string;     // stable, e.g. "winners-2025"
  label: string;  // "Bob's Saturday Winners 2025"
  short: string;  // "Winners 25" — for pills
  start: string;  // "YYYY-MM-DD"
  // Phase 29, additive + optional: the season's length in league weeks. Only
  // used by Path to goal on Stats (src/goalPath.ts). Absent = not set.
  weeks?: number | null;
};

export type Settings = {
  seasonStart?: string | null;
  seasonEnd?: string | null;
  targetAverage?: number | null;
  targetSeries?: number | null;
  // Phase 24, additive. Absent on legacy blobs — synthesized read-time from
  // DEFAULT_SEASONS by getSeasons(). seasonStart/seasonEnd are left in place and
  // remain the source of truth for week auto-suggest (log.tsx). Never
  // persisted on read: mbowl_settings_v1 has no shadow key.
  seasons?: Season[];
};

/** Shape of the in-progress log form persisted as a draft */
export type DraftData = {
  sessionType: 'league' | 'makeup' | 'tournament' | 'practice';
  date: string;
  week: string;
  opponent: string;
  tournamentName: string;
  tournamentFormat: string;
  tournamentPattern: string;
  madeCut: 'Yes' | 'No' | 'N/A';
  placement: string;
  games: Array<{
    id: string;
    score: string;
    ball: string;
    notes: string;
    frames?: ThrowEntry[];
    // Phase 31B (form strings; optional so older drafts still load)
    speed?: string;
    feet?: string;
    target?: string;
    switchFrame?: string;
    switchBall?: string;
  }>;
  sessionNotes: string;
  // Phase 31B
  house?: string;
  condition?: LaneCondition | null;
  drill?: DrillCounts | null;
};
