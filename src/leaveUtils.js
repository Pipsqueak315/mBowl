/**
 * Leave statistics utility.
 * Processes a sessions array and extracts bowling leave data.
 *
 * "Leave" = the pins still standing after the first throw of a frame,
 *  when that first throw was NOT a strike.
 *
 * Requires pinsStanding data (logged via PinDeck input mode in Log Frames).
 * Frames entered via chip bar only have no pinsStanding → skipped.
 */

// Named leave combinations — key = sorted pin numbers joined with '-'
const NAMED_LEAVES = {
  '4-6-7-10': 'Big 4',
  '4-6-7-9-10': 'Greek Church',
  '7-10': '7-10 Split',
  '6-7-10': '6-7-10',
  '2-8-10': '2-8-10 Bucket',
  '2-4-5-8': '2-4-5-8 Bucket',
  '4-6': '4-6 Split',
  '5-7': '5-7 Split',
  '2-7': 'Baby Split (2-7)',
  '3-10': 'Baby Split (3-10)',
  '4-7-9': '4-7-9 Cluster',
  '2-8': 'Sleeper (2-8)',
  '3-9': 'Sleeper (3-9)',
};

/**
 * Return a human-readable name for a leave.
 * @param {number[]} pins - sorted 1-based pin numbers still standing
 * @returns {string}
 */
function getLeaveName(pins) {
  if (pins.length === 1) return `${pins[0]} Pin`;
  const key = pins.join('-');
  return NAMED_LEAVES[key] ?? key;
}

// ---------------------------------------------------------------------------
// Split detection
// ---------------------------------------------------------------------------

/**
 * Physical pin-deck adjacency. Two pins are "adjacent" (no gap between them)
 * when they are true nearest neighbours on the triangular deck (12" apart) —
 * OR they sit directly in line front-to-back with no pin between them (a
 * "sleeper", e.g. the 8 hidden behind the 2), because an in-line pin can be
 * driven through and is therefore not split off.
 *
 * Layout (pin numbers), apex toward the bowler:
 *
 *     7  8  9  10
 *      4  5  6
 *       2  3
 *        1
 *
 * Keys and values are 1-based pin numbers. Symmetric by construction:
 * every edge a→b has a matching b→a.
 */
const PIN_ADJACENCY = {
  1: [2, 3],
  2: [1, 3, 4, 5, 8], // 8: sleeper directly behind the 2
  3: [1, 2, 5, 6, 9], // 9: sleeper directly behind the 3
  4: [2, 5, 7, 8],
  5: [2, 3, 4, 6, 8, 9],
  6: [3, 5, 9, 10],
  7: [4, 8],
  8: [2, 4, 5, 7, 9], // 2: sleeper directly ahead of the 8
  9: [3, 5, 6, 8, 10], // 3: sleeper directly ahead of the 9
  10: [6, 9],
};

/**
 * Count connected components among a set of standing pins, using PIN_ADJACENCY.
 * @param {number[]} standingPins - 1-based pin numbers still standing
 * @returns {number}
 */
function countStandingComponents(standingPins) {
  const standing = new Set(standingPins);
  const visited = new Set();
  let components = 0;
  for (const pin of standingPins) {
    if (visited.has(pin)) continue;
    components += 1;
    const stack = [pin];
    visited.add(pin);
    while (stack.length > 0) {
      const p = stack.pop();
      for (const neighbour of PIN_ADJACENCY[p] ?? []) {
        if (standing.has(neighbour) && !visited.has(neighbour)) {
          visited.add(neighbour);
          stack.push(neighbour);
        }
      }
    }
  }
  return components;
}

/**
 * Is this leave a split?
 *
 * Community-standard (lateral-gap) definition: the headpin (index 0) is DOWN,
 * two or more pins remain standing, AND those standing pins are separated by at
 * least one non-adjacent gap — i.e. they do not all form a single connected
 * cluster under PIN_ADJACENCY. A single standing pin is never a split; a
 * standing headpin is never a split.
 *
 * Derived at read time from pinsStanding — never persisted. Safe on bad input:
 * returns false for null / non-array / wrong length, and never throws.
 *
 * @param {boolean[] | null | undefined} pinsStanding - length-10 boolean array,
 *   indices 0–9 = pins 1–10, true = still standing (state after the first ball)
 * @returns {boolean}
 */
export function isSplit(pinsStanding) {
  if (!Array.isArray(pinsStanding) || pinsStanding.length !== 10) return false;
  if (pinsStanding[0]) return false; // headpin standing → never a split
  const standingPins = [];
  for (let i = 0; i < 10; i++) {
    if (pinsStanding[i]) standingPins.push(i + 1);
  }
  if (standingPins.length < 2) return false; // single pin (or none) → never a split
  return countStandingComponents(standingPins) > 1;
}

/**
 * Compute leave statistics from a sessions array.
 *
 * @param {import('./types').Session[]} sessions - array of session objects
 * @returns {{
 *   leaves: Array<{pins: number[], name: string, count: number, converted: number, conversionPct: number, isSplit: boolean}>,
 *   hasPinData: boolean,
 *   makeableSparePct: number | null,
 *   makeableCount: number,
 *   makeableConverted: number
 * }}
 *   leaves: most frequent non-strike leaves, sorted by count descending
 *   hasPinData: true if at least one frame in the data had valid pinsStanding
 *   makeableSparePct: conversion % across non-split (makeable) leaves only,
 *     null when there are no makeable leaves. Splits are excluded entirely.
 *   makeableCount / makeableConverted: the makeable-leave totals behind the %
 */
export function computeLeaveStats(sessions) {
  /** @type {Record<string, { pins: number[], count: number, converted: number, isSplit: boolean }>} */
  const leaveMap = {};
  let hasPinData = false;

  for (const session of (Array.isArray(sessions) ? sessions : [])) {
    if (!session) continue;
    for (const game of (session.games ?? [])) {
      if (!game || !Array.isArray(game.frames)) continue;

      for (const frame of game.frames) {
        if (!frame || !Array.isArray(frame.throws) || frame.throws.length === 0) continue;

        // pinsStanding[0] = pin state after the first throw (true = still standing)
        const pinsAfterFirst = frame.pinsStanding?.[0];
        if (!Array.isArray(pinsAfterFirst) || pinsAfterFirst.length !== 10) continue;

        // At least one frame has valid pin data
        hasPinData = true;

        // Strike = all 10 pins down after first throw → no leave, skip
        if (!pinsAfterFirst.some(Boolean)) continue;

        // Collect sorted 1-based pin numbers still standing
        const standingPins = pinsAfterFirst
          .map((standing, idx) => (standing ? idx + 1 : 0))
          .filter(Boolean)
          .sort((a, b) => a - b);

        if (standingPins.length === 0) continue;

        // Spare conversion: second throw notation is '/'
        const converted = frame.throws.length >= 2 && frame.throws[1] === '/';

        const key = standingPins.join('-');
        if (!leaveMap[key]) {
          leaveMap[key] = {
            pins: standingPins,
            count: 0,
            converted: 0,
            // Split status is a pure function of the leave shape → compute once per key.
            isSplit: isSplit(pinsAfterFirst),
          };
        }
        leaveMap[key].count += 1;
        if (converted) leaveMap[key].converted += 1;
      }
    }
  }

  // All leaves sorted by frequency — callers slice as needed
  const leaves = Object.values(leaveMap)
    .map(({ pins, count, converted, isSplit: split }) => ({
      pins,
      name: getLeaveName(pins),
      count,
      converted,
      conversionPct: count > 0 ? (converted / count) * 100 : 0,
      isSplit: split,
    }))
    .sort((a, b) => b.count - a.count);

  // Makeable spare = conversion across non-split leaves only.
  // Splits are excluded from the denominator entirely.
  let makeableCount = 0;
  let makeableConverted = 0;
  for (const leave of leaves) {
    if (leave.isSplit) continue;
    makeableCount += leave.count;
    makeableConverted += leave.converted;
  }
  const makeableSparePct =
    makeableCount > 0 ? (makeableConverted / makeableCount) * 100 : null;

  return { leaves, hasPinData, makeableSparePct, makeableCount, makeableConverted };
}
