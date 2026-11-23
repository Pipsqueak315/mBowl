// Phase 29 checks against the REAL src/goalPath.ts and src/spareLeak.ts.
// Hand-built games with known answers — the real backup never enters the repo.
import { computeGoalPath } from '../../src/goalPath.ts';
import { computeSpareLeak } from '../../src/spareLeak.ts';
import { check, eq, done, pins } from './lib.mjs';

const near = (a, b, label) => check(a != null && Math.abs(a - b) < 1e-9, label, `expected ${b}, got ${a}`);

const night = (week, scores, type = 'league') => ({
  id: week, type, date: '2026-10-01', week, opponent: null, name: null, format: null,
  pattern: null, madeCut: null, placement: null, notes: null,
  games: scores.map((score, i) => ({ game: i + 1, score, ball: null, frames: null, notes: null })),
});

// --- Path to goal ---------------------------------------------------------
{
  // 2 weeks × 3 games at 180 = 1080 pins over 6 games. 10-week season → 8 left = 24 games.
  // Need (190 × 30 − 1080) / 24 = 192.5.
  const s = [night(1, [180, 180, 180]), night(2, [170, 190, 180])];
  const p = computeGoalPath(s, 190, 10);
  eq(p.gamesBowled, 6, 'goal: games bowled');
  near(p.currentAvg, 180, 'goal: current avg');
  eq([p.weeksBowled, p.weeksLeft, p.gamesLeft], [2, 8, 24], 'goal: weeks/games left');
  near(p.neededAvg, 192.5, 'goal: needed avg');
  eq(p.neededSeries, 578, 'goal: needed series rounds up (577.5 → 578)');
  eq(p.status, 'stretch', 'goal: 12.5 above current → stretch');
}
{
  // Practice and tournament games never count toward the league average.
  const s = [night(1, [200, 200, 200]), night(0, [100, 100], 'practice'), night(0, [120], 'tournament')];
  const p = computeGoalPath(s, 190, 4);
  eq(p.gamesBowled, 3, 'goal: only league + makeup games count');
  eq(p.status, 'onPace', 'goal: 200 avg chasing 190 is on pace');
  // A makeup carries its week number: max week 3 → 1 week left.
  const m = computeGoalPath([night(1, [190, 190, 190]), night(3, [190, 190, 190], 'makeup')], 190, 4);
  eq([m.weeksBowled, m.gamesLeft], [3, 3], 'goal: makeup week counts toward weeks bowled');
}
{
  eq(computeGoalPath([night(1, [180, 180, 180])], null, 30).status, 'needsSetup', 'goal: no target → needsSetup');
  eq(computeGoalPath([night(1, [180, 180, 180])], 190, null).status, 'needsSetup', 'goal: no weeks → needsSetup');
  eq(computeGoalPath([], 190, 30).status, 'noGames', 'goal: nothing bowled → noGames');
  eq(computeGoalPath([], 190, 30).neededAvg, 190, 'goal: nothing bowled → need the goal itself');
  eq(computeGoalPath([night(5, [180, 180, 180])], 190, 5).status, 'done', 'goal: last week bowled → done');
  eq(computeGoalPath([night(9, [50, 50, 50])], 190, 10).status, 'outOfReach', 'goal: > 300 needed → outOfReach');
  // A past season is final even when fewer weeks were logged than its length.
  const past = computeGoalPath([night(26, [180, 180, 180])], 190, 33, 3, true);
  eq([past.status, past.gamesLeft], ['done', 0], 'goal: finished season → done, no games left');
  // No week numbers → session count stands in.
  const noWeeks = [night(null, [180, 180, 180]), night(null, [180, 180, 180])];
  eq(computeGoalPath(noWeeks, 190, 10).weeksBowled, 2, 'goal: no week numbers → session count');
}

// --- Spare leak -----------------------------------------------------------
const fr = (throws, standing) => ({ throws, note: null, throwNotes: {}, pinsStanding: standing ? [standing] : null });
const game = frames => ({ ...night(1, [null]), games: [{ game: 1, score: null, ball: null, frames, notes: null }] });
const filler = n => Array.from({ length: n }, () => fr(['8', '1'], pins(9, 10)));

{
  // Frame 1: X. Frame 2: 9 then miss the 10 pin. Frame 3 first ball 8.
  // Cost = 1 on deck + 8 bonus + 1 (strike before) = 10.
  const g = game([fr(['X'], pins()), fr(['9', '—'], pins(10)), fr(['8', '1'], pins(4, 7)), ...filler(7)]);
  const l = computeSpareLeak([g]);
  eq([l.single.attempts, l.single.made], [1, 0], 'leak: one single-pin chance, missed');
  eq(l.single.pinsLost, 10, 'leak: deck + next ball + strike bonus');
  eq([l.tenPin.attempts, l.sevenPin.attempts], [1, 0], 'leak: pin data → it was the 10');
  // Frame 3 (4-7, 8 then 1) is makeable multi-pin (not a split): missed, 1 on deck + next first ball 8 = 9.
  // Filler frames 4–9 (9-10 leave, 8 then 1) also multi, each 1 + 8 = 9; frame 10 uses the fill estimate.
  eq(l.multi.attempts, 8, 'leak: 4-7 + seven 9-10 leaves are multi-pin makeable');
  check(l.usedFillEstimate, 'leak: a 10th-frame miss uses the fill estimate');
  eq([l.gamesWithFrames, l.gamesWithPins], [1, 1], 'leak: game counts');
}
{
  // Quick mode (no pin data): singles still count from notation; no 10/7 split, no multi.
  const g = game([fr(['9', '/']), fr(['9', '0']), fr(['7', '2']), ...Array.from({ length: 7 }, () => fr(['X']))]);
  const l = computeSpareLeak([g]);
  eq([l.single.attempts, l.single.made], [2, 1], 'leak quick: singles from notation');
  // Frame 2: 9,0 → 1 on deck + next first ball 7 = 8 (frame 1 was a spare, not a strike).
  eq(l.single.pinsLost, 8, 'leak quick: deck + next ball');
  eq([l.tenPin.attempts, l.multi.attempts, l.gamesWithPins], [0, 0, 0], 'leak quick: no pin-data buckets');
  eq(l.multiPerGame, null, 'leak quick: no pin-data games → multi rate null');
  eq(l.totalPerGame, 8, 'leak quick: total = singles only');
}
{
  // Splits are left out of multi-pin (7-10 after an 8 count).
  const g = game([fr(['8', '—'], pins(7, 10)), ...Array.from({ length: 9 }, () => fr(['X'], pins()))]);
  const l = computeSpareLeak([g]);
  eq([l.single.attempts, l.multi.attempts], [0, 0], 'leak: a split is neither single nor multi');
  eq(computeSpareLeak([]).totalPerGame, null, 'leak: no data → null');
  // Unfinished game: a miss with no next ball logged counts as a missed chance, adds no pins, no estimate.
  const partial = computeSpareLeak([game([fr(['X'], pins()), fr(['X'], pins()), fr(['9', '—'], pins(10))])]);
  eq([partial.single.attempts, partial.single.made, partial.single.pinsLost, partial.single.costed, partial.usedFillEstimate], [1, 0, 0, 0, false], 'leak: unfinished game miss counted, no pins, not costed');
}

done('goals');
