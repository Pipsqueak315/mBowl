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

export type Settings = {
  seasonStart?: string | null;
  seasonEnd?: string | null;
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
