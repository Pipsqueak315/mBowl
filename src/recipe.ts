import type { Session } from './types';
import type { SpareLeak } from './spareLeak';

// ---------------------------------------------------------------------------
// 190 recipe (Phase 30A)
//
// "What do my goal-level games do differently?" The baseline is Marcus's own
// games scored within GOAL_WINDOW pins of his target average (180-200 for a
// 190 target), all-time and any type, with frame data -- the same idea the
// Stats color bands were built from (Nov 10: his 22 games at 180-200). Stats
// runs its existing metric functions (calcMetrics / calcAdvancedStats) over
// these sessions, so the numbers use exactly the grid's definitions.
// Read-time only.
// ---------------------------------------------------------------------------

export const GOAL_WINDOW = 10;
export const DEFAULT_GOAL = 190;

export function goalRange(target: number | null | undefined): { lo: number; hi: number } {
  const t = typeof target === 'number' && Number.isFinite(target) && target > 0 ? target : DEFAULT_GOAL;
  return { lo: Math.max(0, t - GOAL_WINDOW), hi: Math.min(300, t + GOAL_WINDOW) };
}

/**
 * Sessions trimmed to the games scored in [lo, hi] that have frame data.
 * Sessions left with no games are dropped. Never mutates the input.
 */
export function goalLevelSessions(sessions: Session[], lo: number, hi: number): Session[] {
  const out: Session[] = [];
  for (const s of sessions ?? []) {
    const games = (s?.games ?? []).filter(
      g =>
        g != null &&
        typeof g.score === 'number' &&
        g.score >= lo &&
        g.score <= hi &&
        Array.isArray(g.frames) &&
        g.frames.length > 0,
    );
    if (games.length > 0) out.push({ ...s, games });
  }
  return out;
}

/**
 * Average pins one missed makeable spare cost in this data (Spare leak's own
 * counterfactual), or null with no costed misses. Used to put "about N pins"
 * on an opens gap.
 */
export function pinsPerMissedSpare(leak: SpareLeak): number | null {
  const misses =
    leak.single.attempts - leak.single.made + (leak.multi.attempts - leak.multi.made);
  const pins = leak.single.pinsLost + leak.multi.pinsLost;
  return misses > 0 && pins > 0 ? pins / misses : null;
}
