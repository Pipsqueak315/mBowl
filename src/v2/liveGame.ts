// Live game button plumbing (Phase 28 WP7, decision D5). Level 1: reads the
// draft, never writes it.
//
// - useLiveGame(): which game the button offers -- the first game in the saved
//   draft without a score -- or null (no draft, or every game scored).
// - notifyDraftChanged(): the Log page calls this after every draft write so
//   the button updates without polling.
// - requestLiveGame(): the button asks; the Log page answers by opening Log
//   Frames itself, through the same path as tapping the game's row. That keeps
//   the KEYS.FRAME_RESULT hand-off and the draft-resume prompt exactly as they
//   are: the score always lands in the Log page's own game list.
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { readDraft } from '@/src/storage';

type Listener = () => void;

const draftListeners = new Set<Listener>();
const liveListeners = new Set<Listener>();
let liveRequested = false;

export function notifyDraftChanged(): void {
  draftListeners.forEach(l => l());
}

export function requestLiveGame(): void {
  liveRequested = true;
  liveListeners.forEach(l => l());
}

/** Subscribe to Live button taps. Returns the unsubscribe function. */
export function onLiveGameRequest(listener: Listener): () => void {
  liveListeners.add(listener);
  return () => {
    liveListeners.delete(listener);
  };
}

export function hasLiveGameRequest(): boolean {
  return liveRequested;
}

export function clearLiveGameRequest(): void {
  liveRequested = false;
}

/** Index of the first game with no score, or -1. */
export function firstUnscoredGame(games: readonly { score: string }[]): number {
  return games.findIndex(g => g.score.trim() === '');
}

export function useLiveGame(): { gameIndex: number } | null {
  const [gameIndex, setGameIndex] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      readDraft()
        .then(draft => {
          if (!alive) return;
          const idx = draft ? firstUnscoredGame(draft.games) : -1;
          setGameIndex(idx >= 0 ? idx : null);
        })
        .catch(() => {
          if (alive) setGameIndex(null);
        });
    };
    refresh();
    draftListeners.add(refresh);
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') refresh();
    });
    return () => {
      alive = false;
      draftListeners.delete(refresh);
      sub.remove();
    };
  }, []);

  return gameIndex === null ? null : { gameIndex };
}
