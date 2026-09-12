import type { Season, Settings } from './types';

// ---------------------------------------------------------------------------
// Season model (Phase 24)
//
// Governing principle: season membership is DERIVED AT READ TIME from
// session.date. Nothing is written onto sessions. Same instinct as isSplit and
// calcAdvancedStats — retroactively correct by construction, cannot drift.
//
// Gapless model: only `start` is stored. A season's end is (next season's
// start − 1 day); the most recent season is open-ended. No session can fall
// outside a season, and there is no end-date field to keep in sync.
// ---------------------------------------------------------------------------

// The three real seasons. Synthesized in memory when settings.seasons is absent
// (legacy blobs). NEVER persisted on read — mbowl_settings_v1 has no shadow key.
export const DEFAULT_SEASONS: Season[] = [
  { id: 'winners-2025', label: "Bob's Saturday Winners 2025", short: 'Winners 25', start: '2025-09-06' },
  { id: 'jubilee-2026', label: "Bob's Saturday Jubilee 2026", short: 'Jubilee 26', start: '2026-05-30' },
  { id: 'winners-2026', label: "Bob's Saturday Winners 2026", short: 'Winners 26', start: '2026-09-12' },
];

// A season with its derived end. `end === null` means open-ended (most recent).
export type ResolvedSeason = Season & { end: string | null };

// Read-time synthesizer. Returns the persisted seasons when present, else the
// defaults. Does NOT persist — callers that want to persist must go through
// Settings' explicit save. A stored-but-empty array falls back to defaults so a
// user can never strand themselves with zero seasons.
export function getSeasons(settings: Settings | null | undefined): Season[] {
  const s = settings?.seasons;
  return Array.isArray(s) && s.length > 0 ? s : DEFAULT_SEASONS;
}

// YYYY-MM-DD date math in UTC — avoids DST/local-offset drift. The rest of the
// app compares date strings lexically (YYYY-MM-DD sorts correctly), so the only
// real arithmetic needed is "one day before".
function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Sort by start ascending, derive each end as the next start minus one day,
// leave the last open-ended (end: null).
export function resolveSeasonRanges(seasons: Season[]): ResolvedSeason[] {
  const sorted = [...seasons].sort((a, b) => a.start.localeCompare(b.start));
  return sorted.map((s, i) => {
    const next = sorted[i + 1];
    return { ...s, end: next ? addDaysISO(next.start, -1) : null };
  });
}

// The id of the season whose range contains `date`, or null if before the
// earliest season's start (only possible if a date precedes every season).
export function seasonForDate(date: string, seasons: Season[]): string | null {
  const ranges = resolveSeasonRanges(seasons);
  for (const r of ranges) {
    if (date >= r.start && (r.end === null || date <= r.end)) return r.id;
  }
  return null;
}

// The resolved season whose range contains `today` (a YYYY-MM-DD string),
// or null. Used as the default selection on Stats and History.
export function currentSeason(
  seasons: Season[],
  today: string,
): ResolvedSeason | null {
  const ranges = resolveSeasonRanges(seasons);
  for (const r of ranges) {
    if (today >= r.start && (r.end === null || today <= r.end)) return r;
  }
  return null;
}
