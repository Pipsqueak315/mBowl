import type { Session, ThrowEntry } from './types';

// ---------------------------------------------------------------------------
// Tilt cost (Phase 30A)
//
// Does one open frame lead to another? Compares the frame right after an open
// with the frame right after a mark, inside the same game. Frame pairs like
// Bounce-back % on Stats (first frame 1-9, the second the next frame, the 10th
// can be the second) with one difference: a pair whose second frame isn't
// finished is skipped here (Bounce-back counts it as a missed bounce), so the
// two add up to 100 only when the view has no unfinished games. Read-time only.
//
//   openAfterOpenPct  = opens / frames that follow an open
//   openAfterMarkPct  = opens / frames that follow a mark (strike or spare)
//   backToBackPerGame = open-open pairs per game with frames
//   firstBallAfterOpen / AfterMark = first-ball pin average of the next frame
//   extraOpensPerGame / excessPct = opens after an open beyond what each
//     GAME's own open rate predicts. Compared game by game, so an off night
//     (lots of opens everywhere) doesn't read as tilt -- only opens that
//     cluster right after an open, within a game, count. Floored at 0.
// ---------------------------------------------------------------------------

export interface TiltCost {
  gamesWithFrames: number;
  afterOpen: number;      // frames that follow an open
  afterMark: number;      // frames that follow a mark
  openAfterOpenPct: number | null;
  openAfterMarkPct: number | null;
  backToBackPerGame: number | null;
  firstBallAfterOpen: number | null;
  firstBallAfterMark: number | null;
  extraOpensPerGame: number | null;
  /** Extra opens as a share of frames after an open, 0-100 (null without opens). */
  excessPct: number | null;
}

const isStrike = (f: ThrowEntry) => f.throws?.[0] === 'X';
const isSpare = (f: ThrowEntry) => f.throws?.[1] === '/';
const isMark = (f: ThrowEntry) => isStrike(f) || isSpare(f);
// A finished non-mark frame (same rule as Stats' frameIsOpen).
const isOpen = (f: ThrowEntry) =>
  Array.isArray(f.throws) && f.throws[0] !== 'X' && f.throws[1] != null && f.throws[1] !== '/';
const isDone = (f: ThrowEntry) => isMark(f) || isOpen(f);

function firstBallPins(t: string | undefined): number | null {
  if (t == null) return null;
  if (t === 'X') return 10;
  if (t === '—' || t === '-') return 0;
  const n = parseInt(t, 10);
  return Number.isNaN(n) ? null : Math.max(0, Math.min(10, n));
}

export function computeTiltCost(sessions: Session[]): TiltCost {
  let games = 0;
  let afterOpen = 0, openAfterOpen = 0, fbAfterOpenSum = 0, fbAfterOpenN = 0;
  let afterMark = 0, openAfterMark = 0, fbAfterMarkSum = 0, fbAfterMarkN = 0;
  let expectedAfterOpen = 0; // sum over games: frames after an open x that game's open rate

  for (const s of sessions ?? []) {
    for (const g of s?.games ?? []) {
      const frames = g?.frames;
      if (!Array.isArray(frames) || frames.length === 0) continue;
      games++;
      let gPairs = 0, gOpens = 0, gAfterOpen = 0;
      for (let i = 0; i < frames.length - 1 && i < 9; i++) {
        const f = frames[i];
        const next = frames[i + 1];
        if (!f || !next || !isDone(next)) continue;
        const nextOpen = isOpen(next);
        const fb = firstBallPins(next.throws?.[0]);
        gPairs++;
        if (nextOpen) gOpens++;
        if (isOpen(f)) gAfterOpen++;
        if (isOpen(f)) {
          afterOpen++;
          if (nextOpen) openAfterOpen++;
          if (fb != null) { fbAfterOpenSum += fb; fbAfterOpenN++; }
        } else if (isMark(f)) {
          afterMark++;
          if (nextOpen) openAfterMark++;
          if (fb != null) { fbAfterMarkSum += fb; fbAfterMarkN++; }
        }
      }
      if (gPairs > 0) expectedAfterOpen += gAfterOpen * (gOpens / gPairs);
    }
  }

  const openAfterOpenPct = afterOpen > 0 ? (openAfterOpen / afterOpen) * 100 : null;
  const openAfterMarkPct = afterMark > 0 ? (openAfterMark / afterMark) * 100 : null;
  let extraOpensPerGame: number | null = null;
  let excessPct: number | null = null;
  if (games > 0 && afterOpen > 0) {
    const excess = Math.max(0, openAfterOpen - expectedAfterOpen);
    extraOpensPerGame = excess / games;
    excessPct = (excess / afterOpen) * 100;
  }

  return {
    gamesWithFrames: games,
    afterOpen,
    afterMark,
    openAfterOpenPct,
    openAfterMarkPct,
    backToBackPerGame: games > 0 ? openAfterOpen / games : null,
    firstBallAfterOpen: fbAfterOpenN > 0 ? fbAfterOpenSum / fbAfterOpenN : null,
    firstBallAfterMark: fbAfterMarkN > 0 ? fbAfterMarkSum / fbAfterMarkN : null,
    extraOpensPerGame,
    excessPct,
  };
}
