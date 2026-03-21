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

/**
 * Compute leave statistics from a sessions array.
 *
 * @param {Array} sessions - array of session objects (already filtered for season/all-time)
 * @returns {{
 *   leaves: Array<{pins: number[], name: string, count: number, converted: number, conversionPct: number}>,
 *   hasPinData: boolean
 * }}
 *   leaves: top-10 most frequent non-strike leaves, sorted by count descending
 *   hasPinData: true if at least one frame in the data had valid pinsStanding
 */
export function computeLeaveStats(sessions) {
  /** @type {Record<string, { pins: number[], count: number, converted: number }>} */
  const leaveMap = {};
  let hasPinData = false;

  for (const session of sessions) {
    for (const game of (session.games ?? [])) {
      if (!Array.isArray(game.frames)) continue;

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
          leaveMap[key] = { pins: standingPins, count: 0, converted: 0 };
        }
        leaveMap[key].count += 1;
        if (converted) leaveMap[key].converted += 1;
      }
    }
  }

  // All leaves sorted by frequency — callers slice as needed
  const leaves = Object.values(leaveMap)
    .map(({ pins, count, converted }) => ({
      pins,
      name: getLeaveName(pins),
      count,
      converted,
      conversionPct: count > 0 ? (converted / count) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return { leaves, hasPinData };
}
