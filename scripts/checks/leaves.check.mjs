// Leave + split checks against the REAL src/leaveUtils.js (Phase 26A.2).
// Pins down split detection (Phase 20) and the Makeable % denominator rule.
import { isSplit, computeLeaveStats } from '../../src/leaveUtils.js';
import { SEED_SESSIONS } from '../../src/seeds.js';
import { check, eq, done, pins } from './lib.mjs';

// --- isSplit truth table ------------------------------------------------------
const SPLITS = [
  [7, 10], [4, 6], [5, 7], [8, 10], [3, 10], [2, 7], // classic 2-pin splits
  [2, 8, 10], [4, 7, 9],                             // brief: both ARE splits
  [4, 6, 7, 10],                                     // Big 4
];
const NOT_SPLITS = [
  [10], [7], [5],             // single pins are never splits
  [2, 4, 5, 8], [3, 6, 10],   // connected clusters (bucket / 3-6-10)
  [2, 8], [3, 9],             // sleepers count as adjacent
  [9, 10], [4, 5], [7, 8],    // neighbours
  [1, 7, 10],                 // headpin standing → never a split
];
for (const s of SPLITS) check(isSplit(pins(...s)) === true, `isSplit ${s.join('-')} is a split`);
for (const s of NOT_SPLITS) check(isSplit(pins(...s)) === false, `isSplit ${s.join('-')} is NOT a split`);

// Bad input never throws, always false.
for (const bad of [null, undefined, [], 'x', Array(9).fill(true)]) {
  let out;
  try { out = isSplit(bad); } catch { out = 'threw'; }
  eq(out, false, `isSplit(${JSON.stringify(bad)}) → false`);
}

// --- computeLeaveStats on the seeds ------------------------------------------
const stats = computeLeaveStats(SEED_SESSIONS);
check(Array.isArray(stats.leaves), 'computeLeaveStats returns a leaves array');
for (const l of stats.leaves) {
  check(Number.isFinite(l.conversionPct), `leave ${l.name}: conversion % is a number`);
  check(l.converted <= l.count, `leave ${l.name}: converted ≤ count`);
  eq(l.isSplit, isSplit(pins(...l.pins)), `leave ${l.name}: isSplit matches leaveUtils`);
}
// Makeable excludes splits from its denominator.
const makeable = stats.leaves.filter(l => !l.isSplit);
const makeableCount = makeable.reduce((n, l) => n + l.count, 0);
eq(stats.makeableCount, makeableCount, 'makeableCount = sum of non-split leave counts');
check(
  stats.makeableSparePct === null || (stats.makeableSparePct >= 0 && stats.makeableSparePct <= 100),
  'makeableSparePct is null or 0–100',
);

// Empty input is safe.
const empty = computeLeaveStats([]);
eq(empty.makeableSparePct, null, 'no sessions → makeableSparePct null (not NaN)');
eq(empty.hasPinData, false, 'no sessions → hasPinData false');

done('leaves');
