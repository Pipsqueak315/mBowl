import type { Session } from './types';

// ---------------------------------------------------------------------------
// Path to goal (Phase 29)
//
// "What average do I need over the rest of the season to finish at my target?"
// Read-time only: derived from the season's sessions + two settings values
// (settings.targetAverage and the season's optional `weeks`). Nothing is
// written onto sessions.
//
// League average = league + makeup games only (practice and tournament games
// don't count toward a league average). Weeks bowled = the highest week number
// logged in those sessions (a makeup carries the week it makes up); a season
// with no week numbers falls back to the number of league/makeup sessions.
// Weeks Marcus missed (absent, scored at average) aren't in the app, so the
// average here is the app's own average over the games it knows about.
// ---------------------------------------------------------------------------

export const LEAGUE_GAMES_PER_WEEK = 3;

export type GoalPathStatus =
  | 'needsSetup'  // no target average, or no season length
  | 'noGames'     // season set up, nothing bowled yet
  | 'onPace'      // the needed average is at or below the current one
  | 'close'       // needed average within 10 pins above the current one
  | 'stretch'     // more than 10 above, still possible (<= 300)
  | 'outOfReach'  // needs more than 300
  | 'done';       // no weeks left: the season's final number

export interface GoalPath {
  status: GoalPathStatus;
  goal: number | null;
  weeks: number | null;
  /** Scored league + makeup games in the season. */
  gamesBowled: number;
  /** League average over those games, null with none. */
  currentAvg: number | null;
  weeksBowled: number;
  weeksLeft: number;
  gamesLeft: number;
  /** Average needed over gamesLeft to finish at goal. null when done / not set up. */
  neededAvg: number | null;
  /** neededAvg × games per week, rounded up — "a 610 series each week". */
  neededSeries: number | null;
}

const isLeagueNight = (s: Session): boolean => s.type === 'league' || s.type === 'makeup';

/**
 * @param seasonSessions sessions already narrowed to ONE season (any type —
 *   only league + makeup are counted here)
 * @param goal settings.targetAverage
 * @param weeks the season's length in league weeks (Season.weeks)
 */
export function computeGoalPath(
  seasonSessions: Session[],
  goal: number | null | undefined,
  weeks: number | null | undefined,
  gamesPerWeek: number = LEAGUE_GAMES_PER_WEEK,
): GoalPath {
  const league = seasonSessions.filter(isLeagueNight);
  let pins = 0;
  let games = 0;
  let maxWeek = 0;
  for (const s of league) {
    if (typeof s.week === 'number' && Number.isFinite(s.week) && s.week > maxWeek) maxWeek = s.week;
    for (const g of s.games ?? []) {
      if (g && typeof g.score === 'number' && Number.isFinite(g.score)) {
        pins += g.score;
        games++;
      }
    }
  }
  const weeksBowled = maxWeek > 0 ? maxWeek : league.length;
  const currentAvg = games > 0 ? pins / games : null;

  const target: number | null =
    typeof goal === 'number' && Number.isFinite(goal) && goal > 0 ? goal : null;
  const length: number | null =
    typeof weeks === 'number' && Number.isFinite(weeks) && weeks > 0 ? weeks : null;
  const base: GoalPath = {
    status: 'needsSetup',
    goal: target,
    weeks: length,
    gamesBowled: games,
    currentAvg,
    weeksBowled,
    weeksLeft: 0,
    gamesLeft: 0,
    neededAvg: null,
    neededSeries: null,
  };
  if (target == null || length == null) return base;

  const weeksLeft = Math.max(0, length - weeksBowled);
  const gamesLeft = weeksLeft * gamesPerWeek;
  const withLeft = { ...base, weeksLeft, gamesLeft };

  if (gamesLeft === 0) return { ...withLeft, status: 'done' };
  // Pins still needed over the games left so the season total averages `goal`.
  const neededAvg = (target * (games + gamesLeft) - pins) / gamesLeft;
  const neededSeries = Math.ceil(neededAvg * gamesPerWeek);
  const result = { ...withLeft, neededAvg, neededSeries };

  if (games === 0) return { ...result, status: 'noGames' };
  if (neededAvg > 300) return { ...result, status: 'outOfReach' };
  const gap = neededAvg - (currentAvg as number);
  if (gap <= 0) return { ...result, status: 'onPace' };
  if (gap <= 10) return { ...result, status: 'close' };
  return { ...result, status: 'stretch' };
}
