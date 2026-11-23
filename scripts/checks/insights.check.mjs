// Phase 30A checks against the REAL src/tiltCost.ts, src/leaveFixes.ts and
// src/recipe.ts. Hand-built games with known answers.
import { computeTiltCost } from '../../src/tiltCost.ts';
import { cardForLeave, cardsFromReference, topLeaveFixes, CARD_LEAVE_KEYS } from '../../src/leaveFixes.ts';
import { goalRange, goalLevelSessions, pinsPerMissedSpare } from '../../src/recipe.ts';
import { check, eq, done } from './lib.mjs';

const near = (a, b, label) => check(a != null && Math.abs(a - b) < 1e-9, label, `expected ${b}, got ${a}`);
const fr = throws => ({ throws, note: null, throwNotes: {} });
const session = (games, id = 1) => ({
  id, type: 'league', date: '2026-10-01', week: 1, opponent: null, name: null, format: null,
  pattern: null, madeCut: null, placement: null, notes: null,
  games: games.map((g, i) => ({ game: i + 1, score: g.score ?? null, ball: null, frames: g.frames, notes: null })),
});

// --- Tilt cost ------------------------------------------------------------
{
  // Frames: O O M M O M M M M M(10th)  (O = open 8-1, M = strike)
  const O = fr(['8', '1']);
  const X = fr(['X']);
  const tenth = fr(['X', 'X', 'X']);
  const g = { frames: [O, O, X, X, O, X, X, X, X, tenth] };
  const t = computeTiltCost([session([g])]);
  // Pairs (f1..f9 -> next): O->O, O->X, X->X, X->O, O->X, X->X, X->X, X->X, X->10th(X)
  eq([t.afterOpen, t.afterMark], [3, 6], 'tilt: pair counts');
  near(t.openAfterOpenPct, 100 / 3, 'tilt: 1 of 3 frames after an open is open');
  near(t.openAfterMarkPct, 100 / 6, 'tilt: 1 of 6 frames after a mark is open');
  near(t.backToBackPerGame, 1, 'tilt: one open-open pair per game');
  near(t.firstBallAfterOpen, (8 + 10 + 10) / 3, 'tilt: first ball after an open');
  // Within-game: 2 opens among 9 next-frames; expected after an open = 3 x 2/9.
  // Observed 1 -> excess 1/3 a game, 1/3 / 3 frames after an open = 11.1%.
  near(t.extraOpensPerGame, 1 - 3 * (2 / 9), 'tilt: extra opens per game (within-game)');
  near(t.excessPct, ((1 - 3 * (2 / 9)) / 3) * 100, 'tilt: excess % of frames after an open');
}
{
  // An off game and a clean game, opens spread out (never back to back within
  // a game): the raw rates differ, but the within-game excess is 0.
  const O = fr(['8', '1']);
  const X = fr(['X']);
  const off = { frames: [O, X, O, X, O, X, O, X, O, X] };
  const clean = { frames: [X, X, X, X, X, X, X, X, X, fr(['X', 'X', 'X'])] };
  const t = computeTiltCost([session([off, clean])]);
  eq(t.extraOpensPerGame, 0, 'tilt: off night alone is not tilt');
}
{
  // An unfinished next frame is not a pair; no opens → extra 0, openAfterOpen null.
  const g = { frames: [fr(['X']), fr(['X']), fr(['9'])] };
  const t = computeTiltCost([session([g])]);
  eq([t.afterOpen, t.afterMark], [0, 1], 'tilt: unfinished frame skipped');
  eq(t.openAfterOpenPct, null, 'tilt: no opens → null');
  eq(computeTiltCost([]).gamesWithFrames, 0, 'tilt: no data');
}

// --- Leave -> fix ---------------------------------------------------------
{
  const cards = [
    { name: 'Corner pin (7 or 10)', fix: 'corner fix' },
    { name: 'Ringing 10 pin', fix: 'ringing fix' },
    { name: 'Solid 8 pin', fix: 'solid 8 fix' },
    { name: 'Washout', fix: 'washout fix' },
  ];
  eq(cardForLeave('10 Pin', cards)?.name, 'Ringing 10 pin', 'fix: most specific card wins for the 10');
  eq(cardForLeave('7 Pin', cards)?.name, 'Corner pin (7 or 10)', 'fix: 7 pin falls to the corner card here');
  eq(cardForLeave('9 Pin', cards), null, 'fix: no card covers the 9');
  const leaves = [
    { name: '9 Pin', count: 10, converted: 9 },
    { name: '10 Pin', count: 8, converted: 5 },
    { name: '8 Pin', count: 2, converted: 2 },
  ];
  const top = topLeaveFixes(leaves, cards, 3);
  eq(top.map(f => f.leave), ['10 Pin', '8 Pin'], 'fix: uncovered leaves skipped, order by count');
  const baby = topLeaveFixes(
    [{ name: 'Baby Split (2-7)', count: 3, converted: 1 }, { name: 'Baby Split (3-10)', count: 2, converted: 1 }],
    [{ name: 'Baby split (2-7 or 3-10)', fix: 'baby fix' }],
  );
  eq(baby.map(f => f.leave), ['Baby Split (2-7)'], 'fix: one row per card');
  near(top[0].sharePct, 40, 'fix: share counts every leave (8 of 20)');
  eq(top[0].fix, 'ringing fix', 'fix: the card text');
  eq(topLeaveFixes([], cards), [], 'fix: no leaves');
  // Stored reference blob: valid cards used, junk ignored, empty -> defaults.
  const defaults = [{ name: 'Solid 8 pin', fix: 'default' }];
  eq(cardsFromReference({ pocketDiagnostics: { cards: [{ name: 'Solid 8 pin', fix: 'mine' }, null, 3] } }, defaults),
    [{ name: 'Solid 8 pin', fix: 'mine' }], 'fix: stored cards win');
  eq(cardsFromReference({}, defaults), defaults, 'fix: no stored cards → defaults');
  check(Object.keys(CARD_LEAVE_KEYS).length === 14, 'fix: 14 cards mapped');
}

// --- 190 recipe -----------------------------------------------------------
{
  eq(goalRange(190), { lo: 180, hi: 200 }, 'recipe: 190 → 180-200');
  eq(goalRange(null), { lo: 180, hi: 200 }, 'recipe: no target → 190');
  const s = session([
    { score: 185, frames: [fr(['X'])] },
    { score: 185, frames: null },          // no frames → out
    { score: 210, frames: [fr(['X'])] },   // out of range
    { score: 180, frames: [fr(['9', '/'])] },
  ]);
  const good = goalLevelSessions([s, session([{ score: 150, frames: [fr(['X'])] }], 2)], 180, 200);
  eq(good.length, 1, 'recipe: sessions with no goal-level game dropped');
  eq(good[0].games.map(g => g.score), [185, 180], 'recipe: framed games in range only');
  eq(s.games.length, 4, 'recipe: input not mutated');
  const leak = {
    single: { attempts: 10, made: 6, pinsLost: 36, costed: 3 }, // 1 uncosted miss
    multi: { attempts: 5, made: 3, pinsLost: 20, costed: 2 },
  };
  near(pinsPerMissedSpare(leak), 56 / 5, 'recipe: pins per COSTED missed spare');
  eq(pinsPerMissedSpare({ single: { attempts: 1, made: 1, pinsLost: 0, costed: 0 }, multi: { attempts: 0, made: 0, pinsLost: 0, costed: 0 } }), null, 'recipe: no misses → null');
}

done('insights');
