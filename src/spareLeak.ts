import { isSplit } from './leaveUtils';
import type { Session, ThrowEntry } from './types';

// ---------------------------------------------------------------------------
// Spare leak (Phase 29)
//
// How many pins a game missed makeable spares cost, and where they leak from.
// Read-time only — same instinct as isSplit / calcAdvancedStats.
//
// Pins a missed spare cost = what the frame would have scored as a spare minus
// what it actually scored, with every other ball left as bowled:
//   + the pins left on the deck after ball 2      (10 − ball 1 − ball 2)
//   + the next ball as a spare bonus              (the next frame's first ball)
//   + the same deck pins again if the frame before was a strike (its bonus
//     counts ball 2 of this frame)
// The next ball is taken from the game itself. Only a missed spare in the 10th
// frame (no next ball exists) uses an estimate: the first-ball average of the
// same data, standing in for the fill ball. A miss in frames 1–9 of an
// unfinished game (no next ball logged) still counts as a missed chance, but
// adds no pins: its cost isn't known.
//
// Coverage:
//  - Single pins come from the throw notation (first ball '9'), so every game
//    with frames counts, Pins mode or Quick.
//  - Which pin (10 / 7) and multi-pin leaves need pin data (Pins mode).
//    Multi-pin = makeable leaves with 2+ pins; splits are left out, same rule as
//    Makeable % (isSplit is the single source of truth).
//  - First ball of each of the 10 frames, same as Leave stats. Fresh racks
//    later in the 10th (after a first-ball strike) are not counted.
// ---------------------------------------------------------------------------

export interface SpareBucket {
  attempts: number;
  made: number;
  /** Total pins those misses cost (see above). */
  pinsLost: number;
  /** Misses whose cost is known (not the last logged frame of an unfinished game). */
  costed: number;
}

export interface SpareLeak {
  /** Games with frame data — denominator for single-pin rates. */
  gamesWithFrames: number;
  /** Games with any pin data — denominator for pin-data rates. */
  gamesWithPins: number;
  single: SpareBucket;
  tenPin: SpareBucket;
  sevenPin: SpareBucket;
  multi: SpareBucket;
  /** Pins a game: single misses (per framed game) + multi misses (per pin-data game). */
  singlePerGame: number | null;
  multiPerGame: number | null;
  totalPerGame: number | null;
  /** True when a 10th-frame miss used the fill-ball estimate. */
  usedFillEstimate: boolean;
}

const emptyBucket = (): SpareBucket => ({ attempts: 0, made: 0, pinsLost: 0, costed: 0 });

// Pins knocked down by one first ball. '—' (em dash, U+2014) is the gutter token.
function firstBallPins(t: string | undefined): number | null {
  if (t == null) return null;
  if (t === 'X') return 10;
  if (t === '—' || t === '-') return 0;
  const n = parseInt(t, 10);
  return Number.isNaN(n) ? null : Math.max(0, Math.min(10, n));
}

// Pins knocked down by a second ball given how many were left.
function secondBallPins(t: string | undefined, left: number): number | null {
  if (t == null) return null;
  if (t === '/') return left;
  if (t === '—' || t === '-') return 0;
  const n = parseInt(t, 10);
  return Number.isNaN(n) ? null : Math.max(0, Math.min(left, n));
}

function validPins(f: ThrowEntry | null | undefined): boolean[] | null {
  const p = f?.pinsStanding?.[0];
  return Array.isArray(p) && p.length === 10 ? p : null;
}

function hasFrames(frames: unknown): frames is ThrowEntry[] {
  return Array.isArray(frames) && frames.length > 0;
}

export function computeSpareLeak(sessions: Session[]): SpareLeak {
  // Pass 1: first-ball average (the 10th-frame fill estimate).
  let fbTotal = 0;
  let fbCount = 0;
  for (const s of sessions ?? []) {
    for (const g of s?.games ?? []) {
      if (!g || !hasFrames(g.frames)) continue;
      for (const f of g.frames) {
        const p = firstBallPins(f?.throws?.[0]);
        if (p != null) {
          fbTotal += p;
          fbCount++;
        }
      }
    }
  }
  const fillEstimate = fbCount > 0 ? fbTotal / fbCount : 8;

  const single = emptyBucket();
  const tenPin = emptyBucket();
  const sevenPin = emptyBucket();
  const multi = emptyBucket();
  let gamesWithFrames = 0;
  let gamesWithPins = 0;
  let usedFillEstimate = false;

  for (const s of sessions ?? []) {
    for (const g of s?.games ?? []) {
      if (!g || !hasFrames(g.frames)) continue;
      const frames = g.frames;
      gamesWithFrames++;
      if (frames.some(f => validPins(f) != null)) gamesWithPins++;

      const n = Math.min(frames.length, 10);
      for (let i = 0; i < n; i++) {
        const t = frames[i]?.throws;
        if (!Array.isArray(t) || t.length < 2) continue; // not a finished spare chance
        const p1 = firstBallPins(t[0]);
        if (p1 == null || p1 === 10) continue; // unreadable, or a strike
        const left = 10 - p1;
        const made = t[1] === '/';
        const p2 = secondBallPins(t[1], left);
        if (p2 == null) continue;

        let cost = 0;
        let costKnown = true;
        if (!made) {
          const onDeck = left - p2;
          let bonus: number;
          if (i < 9) {
            const next = firstBallPins(frames[i + 1]?.throws?.[0]);
            if (next == null) {
              costKnown = false; // unfinished game: no next ball to count
              bonus = 0;
            } else {
              bonus = next;
            }
          } else {
            bonus = fillEstimate;
            usedFillEstimate = true;
          }
          const strikeBefore = i > 0 && frames[i - 1]?.throws?.[0] === 'X' ? onDeck : 0;
          cost = costKnown ? onDeck + bonus + strikeBefore : 0;
        }

        const add = (b: SpareBucket) => {
          b.attempts++;
          if (made) b.made++;
          else if (costKnown) {
            b.pinsLost += cost;
            b.costed++;
          }
        };

        const pins = validPins(frames[i]);
        if (left === 1) {
          add(single);
          if (pins) {
            const standing = pins.flatMap((up, idx) => (up ? [idx + 1] : []));
            if (standing.length === 1 && standing[0] === 10) add(tenPin);
            if (standing.length === 1 && standing[0] === 7) add(sevenPin);
          }
        } else if (pins) {
          const standingCount = pins.filter(Boolean).length;
          if (standingCount >= 2 && !isSplit(pins)) add(multi);
        }
      }
    }
  }

  const singlePerGame = gamesWithFrames > 0 ? single.pinsLost / gamesWithFrames : null;
  const multiPerGame = gamesWithPins > 0 ? multi.pinsLost / gamesWithPins : null;
  const totalPerGame =
    singlePerGame == null && multiPerGame == null ? null : (singlePerGame ?? 0) + (multiPerGame ?? 0);

  return {
    gamesWithFrames,
    gamesWithPins,
    single,
    tenPin,
    sevenPin,
    multi,
    singlePerGame,
    multiPerGame,
    totalPerGame,
    usedFillEstimate,
  };
}
