import type { Season, Session } from './types';
import { resolveSeasonRanges } from './seasons';

// Shared session filter — the single implementation used by both the Stats tab
// and the History tab. Extracted from stats.tsx in Phase 24 Part 0; evolved in
// Part 2 from a binary season/all-time mode to a season-id selection so a season
// selector could be added to both tabs without a second, divergent filter copy
// (see audit S16 — MiniPinDeck/FrameGrid drift).

// Session-type filter (Phase 22). 'all' + the four Session['type'] values.
export type TypeFilter = 'all' | Session['type'];

// Season selection: a Season.id, or ALL_TIME. Not persisted — both tabs reset to
// the current season on focus, matching the type-pill / leaves-sort behaviour.
export const ALL_TIME = '__all_time__';
export type SeasonSelection = string;

// Filter by the selected season's derived date range AND by the selected session
// type. AND logic: a session must satisfy both to survive. This is the single
// choke point — every downstream Stats memo reads `filtered`, so both filters
// propagate through the entire tab from here.
export function filterSessions(
  sessions: Session[],
  seasonSel: SeasonSelection,
  seasons: Season[],
  typeFilter: TypeFilter,
): Session[] {
  let result = sessions;

  if (seasonSel !== ALL_TIME) {
    const range = resolveSeasonRanges(seasons).find(r => r.id === seasonSel);
    // A resolvable season narrows to its gapless [start, end] window (end null =
    // open-ended, most recent season). An unresolvable id (e.g. a season deleted
    // mid-visit) applies no season filter — selection resets on next focus.
    if (range) {
      result = result.filter(
        s => s.date >= range.start && (range.end === null || s.date <= range.end),
      );
    }
  }

  if (typeFilter !== 'all') {
    result = result.filter(s => s.type === typeFilter);
  }
  return result;
}
