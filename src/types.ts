// ---------------------------------------------------------------------------
// Shared data types — imported by all tabs and components
// ---------------------------------------------------------------------------

/** Per-frame data as stored: all optional to accommodate old/partial data */
export type ThrowEntry = {
  throws: string[];
  note?: string | null;
  throwNotes?: Record<string, string | null>;
  pinsStanding?: Array<boolean[] | null> | null;
};

/**
 * Per-frame data during live editing in log-frames.tsx.
 * All fields required — emptyFrames() always initialises them.
 */
export type FrameData = {
  throws: string[];
  note: string;
  throwNotes: Record<string, string | null>;
  pinsStanding?: Array<boolean[] | null>;
};

export type GameEntry = {
  game: number;
  score: number | null;
  ball: string | null;
  frames: ThrowEntry[] | null;
  notes: string | null;
};

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
};

export type Ball = {
  id: string;
  name: string;
  short: string;
  strength: number;
  active: boolean;
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
  }>;
  sessionNotes: string;
};
